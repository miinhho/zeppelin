/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import type {
  DashboardLayoutKind,
  DashboardNote,
  DashboardReactProps,
  DashboardResultReference,
  DashboardRoute,
  DashboardSourceNote
} from '@zeppelin/sdk';
import {
  DashboardDocumentProvider,
  useDashboardCommands,
  useDashboardDocument
} from '../model/DashboardDocumentProvider';
import { DashboardSourceProvider, useDashboardParagraphActions } from '../model/DashboardSourceProvider';
import { dashboardRequestError } from '../lib/dashboardErrors';
import { DashboardHeader } from './document/DashboardHeader';
import { DashboardTabs, type DashboardTabEdit } from './document/DashboardTabs';
import { DashboardWidgetGrid } from './widgets/DashboardWidgetGrid';
import { DashboardWidgetCard } from './widgets/DashboardWidgetCard';
import { DashboardResultPicker } from './panels/DashboardResultPicker';
import { DashboardLayoutPalette } from './panels/DashboardLayoutPalette';
import { DashboardWidgetSettings } from './panels/DashboardWidgetSettings';
import * as styles from './DashboardPage.css';

export interface DashboardPageProps {
  note: DashboardNote;
  source?: DashboardSourceNote;
  sourceLoadedAt?: Date;
  sourceError?: string;
  route: DashboardRoute;
  host: DashboardReactProps;
  onSourceChange: (source: DashboardSourceNote | undefined, error?: string) => void;
  onReloadSource: () => Promise<void>;
}

export const DashboardPage = ({
  note,
  source,
  sourceLoadedAt,
  sourceError,
  route,
  host,
  onSourceChange,
  onReloadSource
}: DashboardPageProps) => (
  <DashboardDocumentProvider note={note} onSave={host.onSave}>
    <DashboardSourceProvider
      dashboardId={note.id}
      source={source}
      loadedAt={sourceLoadedAt}
      sourceError={sourceError}
      sourceHref={host.onSourceHref(note.config.dashboard!.sourceNoteId)}
      mountResult={host.onMountResult}
      openSettings={host.onOpenSettings}
      openInputs={host.onOpenInputs}
      onSourceChange={onSourceChange}
    >
      <DashboardContent
        route={route}
        onNavigate={host.onNavigate}
        onRegisterCanLeave={host.onRegisterCanLeave}
        onTitleChange={host.onTitleChange}
        onReloadSource={onReloadSource}
        onSourceChange={onSourceChange}
      />
    </DashboardSourceProvider>
  </DashboardDocumentProvider>
);

interface DashboardContentProps {
  route: DashboardRoute;
  onNavigate: DashboardReactProps['onNavigate'];
  onRegisterCanLeave: DashboardReactProps['onRegisterCanLeave'];
  onTitleChange: DashboardReactProps['onTitleChange'];
  onReloadSource: () => Promise<void>;
  onSourceChange: DashboardPageProps['onSourceChange'];
}

const DashboardContent = ({
  route,
  onNavigate,
  onRegisterCanLeave,
  onTitleChange,
  onReloadSource,
  onSourceChange
}: DashboardContentProps) => {
  const { definition, saved, dirty, saving, error } = useDashboardDocument();
  const commands = useDashboardCommands();
  const paragraphActions = useDashboardParagraphActions();
  const [activeTab, setActiveTab] = useState(() => route.tab || definition.tabs[0]);
  const [selectedId, setSelectedId] = useState('');
  const [sidebar, setSidebar] = useState<'results' | 'layout' | null>(route.edit ? 'results' : null);
  const [tabEdit, setTabEdit] = useState<DashboardTabEdit>();
  const [resizingId, setResizingId] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(false);
  const tab = definition.tabs.includes(activeTab) ? activeTab : definition.tabs[0];
  const phase = paragraphActions.phase;
  const blocked = saving || resizingId !== undefined || phase.kind !== 'idle';
  const pickerBlocked = saving || resizingId !== undefined || (phase.kind !== 'idle' && phase.kind !== 'replacement');
  const currentSidebar = phase.kind === 'replacement' ? 'results' : sidebar;
  const nativeOpen = phase.kind === 'settings' || phase.kind === 'inputs';
  const runningInputs = phase.kind === 'inputs' && phase.running;
  const pageWidgets = definition.widgets.filter(widget => widget.tab === tab);

  const clearSelection = useCallback(() => {
    setSelectedId('');
    setSidebar(null);
    setTabEdit(undefined);
  }, []);

  const canLeave = useCallback(() => {
    if (blocked) return false;
    if (dirty && !window.confirm('Discard unsaved changes?')) return false;
    if (dirty) commands.discard();
    clearSelection();
    return true;
  }, [blocked, dirty, commands, clearSelection]);

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useLayoutEffect(() => onRegisterCanLeave(canLeave), [onRegisterCanLeave, canLeave]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && !saving && resizingId === undefined && !runningInputs) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, saving, resizingId, runningInputs]);

  const wasEditing = useRef(route.edit);
  useLayoutEffect(() => {
    if (wasEditing.current && !route.edit) {
      if (canLeave()) {
        commands.discard();
        clearSelection();
      } else onNavigate({ ...route, edit: true }, true);
    }
    wasEditing.current = route.edit;
  }, [route, canLeave, commands, clearSelection, onNavigate]);

  const previousRouteTab = useRef(route.tab);
  useEffect(() => {
    if (previousRouteTab.current === route.tab) return;
    previousRouteTab.current = route.tab;
    if (route.tab && definition.tabs.includes(route.tab)) setActiveTab(route.tab);
  }, [route.tab, definition.tabs]);

  useEffect(() => onTitleChange(definition.title), [definition.title, onTitleChange]);

  const inspectWidget = useCallback((id: string) => {
    setSelectedId(id);
    if (id) setSidebar('layout');
  }, []);

  const resizeStateChanged = useCallback((id: string, active: boolean) => {
    setResizingId(previous => (active ? id : previous === id ? undefined : previous));
  }, []);

  const navigateTab = (name: string) => {
    setActiveTab(name);
    setSelectedId('');
    setTabEdit(undefined);
    onNavigate({ ...route, tab: name }, true);
  };

  const startEditing = () => {
    setSidebar('results');
    onNavigate({ ...route, edit: true });
  };
  const exitEditing = (reason: 'saved' | 'discarded') => {
    const tabs = reason === 'discarded' ? saved.tabs : definition.tabs;
    clearSelection();
    onNavigate({ ...route, edit: false, tab: tabs.includes(tab) ? tab : tabs[0] });
  };

  const revealInvalidWidget = (id: string) => {
    const widget = definition.widgets.find(item => item.id === id);
    if (!widget) return;
    navigateTab(widget.tab);
    inspectWidget(id);
    requestAnimationFrame(() =>
      document.getElementById(`dashboard-settings-${id}`)?.querySelector('textarea')?.focus()
    );
  };

  const reload = async () => {
    if (blocked || refreshing) return;
    setRefreshing(true);
    try {
      await onReloadSource();
    } catch (reason) {
      if (alive.current) onSourceChange(undefined, dashboardRequestError(reason, 'Source notebook is unavailable.'));
    } finally {
      if (alive.current) setRefreshing(false);
    }
  };

  const dropResult = (reference: DashboardResultReference, beforeId?: string) => {
    const id = paragraphActions.insertResult(reference, tab, beforeId);
    if (id) setSelectedId(id);
  };

  const dropLayout = (kind: DashboardLayoutKind, beforeId?: string) => {
    const id = commands.insertLayout(kind, tab, beforeId);
    inspectWidget(id);
  };

  return (
    <section className={styles.page}>
      <DashboardHeader
        tab={tab}
        editing={route.edit}
        disabled={blocked}
        refreshing={refreshing}
        onBack={() => onNavigate({ kind: 'list', edit: false, q: route.q })}
        onEdit={startEditing}
        onReload={reload}
        onExitEdit={exitEditing}
        onInvalidWidget={revealInvalidWidget}
      />
      {error ? (
        <div className={styles.errorNotice} role="alert">
          {error}
        </div>
      ) : null}
      {paragraphActions.error && currentSidebar !== 'results' ? (
        <div className={styles.errorNotice} role="alert">
          {paragraphActions.error}
        </div>
      ) : null}

      <div className={styles.workspace + (route.edit && currentSidebar ? ` ${styles.workspaceWithSettings}` : '')}>
        <main className={styles.dashboardContent}>
          <DashboardTabs
            activeTab={tab}
            editing={route.edit}
            disabled={blocked}
            edit={tabEdit}
            showAddContent={!currentSidebar}
            onNavigate={navigateTab}
            onRequestEdit={setTabEdit}
            onCancelEdit={() => setTabEdit(undefined)}
            onShowContent={() => setSidebar('results')}
          />
          <DashboardWidgetGrid
            tab={tab}
            labelledBy={`dashboard-tab-${definition.tabs.indexOf(tab)}`}
            disabled={!route.edit || blocked}
            onResultDrop={dropResult}
            onLayoutDrop={dropLayout}
          >
            {definition.widgets.map(widget => (
              <DashboardWidgetCard
                key={widget.id}
                id={widget.id}
                activeTab={tab}
                editing={route.edit}
                disabled={blocked}
                selected={selectedId === widget.id}
                onSelect={inspectWidget}
                onResizeStateChange={resizeStateChanged}
              />
            ))}
          </DashboardWidgetGrid>
          {pageWidgets.length === 0 ? (
            <div className={styles.emptyPage}>
              <h2>{route.edit ? 'Add content to this page' : 'No content on this page'}</h2>
              {route.edit ? (
                <Button disabled={blocked} onClick={() => setSidebar('results')}>
                  Choose results
                </Button>
              ) : null}
            </div>
          ) : null}
        </main>

        {route.edit && currentSidebar ? (
          <aside className={styles.settingsPanel} aria-label="Dashboard builder">
            <div className={styles.panelTabs} role="group" aria-label="Builder tools">
              <Button
                type={currentSidebar === 'results' ? 'primary' : 'text'}
                aria-pressed={currentSidebar === 'results'}
                disabled={nativeOpen}
                onClick={() => setSidebar('results')}
              >
                Results
              </Button>
              <Button
                type={currentSidebar === 'layout' ? 'primary' : 'text'}
                aria-pressed={currentSidebar === 'layout'}
                disabled={blocked}
                onClick={() => setSidebar('layout')}
              >
                Layout
              </Button>
              <Button type="text" aria-label="Close builder" disabled={blocked} onClick={() => setSidebar(null)}>
                ×
              </Button>
            </div>
            <div className={styles.panelContent}>
              {currentSidebar === 'results' ? (
                <DashboardResultPicker
                  key={phase.kind === 'replacement' ? 'replace' : 'results'}
                  tab={tab}
                  disabled={pickerBlocked}
                  onAdded={setSelectedId}
                />
              ) : (
                <>
                  <DashboardLayoutPalette
                    tab={tab}
                    disabled={blocked}
                    onAdded={inspectWidget}
                    onAddPage={() => setTabEdit({ kind: 'add' })}
                  />
                  {selectedId ? <DashboardWidgetSettings id={selectedId} disabled={blocked} /> : null}
                </>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
};
