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

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  addDashboardTab,
  createDashboardLayoutWidget,
  dashboardDefinitionsEqual,
  dashboardValidationError,
  insertDashboardWidget,
  moveDashboardWidget,
  removeDashboardTab,
  removeDashboardWidget,
  renameDashboardTab,
  replaceDashboardWidget,
  setDashboardTitle,
  setDashboardWidgetProperties,
  setDashboardWidgetSize,
  type DashboardDefinition,
  type DashboardLayoutKind,
  type DashboardNote,
  type DashboardReactProps,
  type DashboardWidget,
  type DashboardWidgetProperties
} from '@zeppelin/sdk';
import { dashboardRequestError } from '../lib/dashboardErrors';
import {
  changeDocumentHistory,
  createDocumentHistory,
  redoDocumentHistory,
  undoDocumentHistory
} from './documentHistory';

interface DashboardDocumentSnapshot {
  id: string;
  path: string;
  definition: DashboardDefinition;
  saved: DashboardDefinition;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  error: string;
}

type SaveResult = { kind: 'saved' | 'unchanged' | 'failed' } | { kind: 'invalid'; widgetId?: string };

interface DashboardCommands {
  setTitle: (title: string) => void;
  setWidgetProperties: (id: string, properties: DashboardWidgetProperties) => void;
  setWidgetText: (id: string, text: string) => void;
  resizeWidget: (id: string, width: number, height?: number, continuous?: boolean) => void;
  insertWidget: (widget: DashboardWidget, beforeId?: string) => void;
  insertLayout: (kind: DashboardLayoutKind, tab: string, beforeId?: string) => string;
  replaceWidget: (widget: DashboardWidget) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, tab: string, beforeId?: string) => void;
  addTab: (name: string) => void;
  renameTab: (tab: string, name: string) => void;
  removeTab: (tab: string) => void;
  finishEdit: () => void;
  undo: () => void;
  redo: () => void;
  discard: () => void;
  save: () => Promise<SaveResult>;
}

const DocumentContext = createContext<DashboardDocumentSnapshot | null>(null);
const CommandsContext = createContext<DashboardCommands | null>(null);

export const useDashboardDocument = (): DashboardDocumentSnapshot => {
  const document = useContext(DocumentContext);
  if (!document) throw new Error('Dashboard document provider is required');
  return document;
};

export const useDashboardCommands = (): DashboardCommands => {
  const commands = useContext(CommandsContext);
  if (!commands) throw new Error('Dashboard document provider is required');
  return commands;
};

interface DashboardDocumentProviderProps {
  note: DashboardNote;
  onSave: DashboardReactProps['onSave'];
  children: ReactNode;
}

export const DashboardDocumentProvider = ({ note, onSave, children }: DashboardDocumentProviderProps) => {
  const [history, setHistory] = useState(() => createDocumentHistory(note.config.dashboard!));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const pendingSave = useRef<Promise<SaveResult> | undefined>(undefined);
  const dirty = !dashboardDefinitionsEqual(history.current, history.saved);

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const commit = useCallback((update: (definition: DashboardDefinition) => DashboardDefinition, group?: string) => {
    setHistory(previous => changeDocumentHistory(previous, update, group));
    setError('');
  }, []);

  const persist = (): Promise<SaveResult> => {
    if (pendingSave.current) return pendingSave.current;
    if (!dirty) return Promise.resolve({ kind: 'unchanged' });

    const invalid = dashboardValidationError(history.current);
    if (invalid) {
      setError(invalid.kind === 'title' ? 'Enter a dashboard title.' : 'Enter text for this block before saving.');
      return Promise.resolve({ kind: 'invalid', widgetId: invalid.kind === 'content' ? invalid.widgetId : undefined });
    }

    const snapshot = setDashboardTitle(history.current, history.current.title.trim());
    setSaving(true);
    setError('');

    const request = Promise.resolve()
      .then(() => onSave(note.id, structuredClone(snapshot)))
      .then<SaveResult>(() => {
        if (!alive.current) return { kind: 'failed' };
        setHistory(createDocumentHistory(snapshot));
        return { kind: 'saved' };
      })
      .catch((reason): SaveResult => {
        if (alive.current) setError(dashboardRequestError(reason, 'Unable to save dashboard.'));
        return { kind: 'failed' };
      })
      .finally(() => {
        pendingSave.current = undefined;
        if (alive.current) setSaving(false);
      });

    pendingSave.current = request;
    return request;
  };

  // Keep the imperative save command stable without duplicating document state.
  const saveHandler = useRef(persist);
  useLayoutEffect(() => {
    saveHandler.current = persist;
  });

  const commands = useMemo<DashboardCommands>(
    () => ({
      setTitle: title => commit(definition => setDashboardTitle(definition, title), 'title'),
      setWidgetProperties: (id, properties) =>
        commit(definition => setDashboardWidgetProperties(definition, id, properties)),
      setWidgetText: (id, text) =>
        commit(definition => setDashboardWidgetProperties(definition, id, { text }), `text:${id}`),
      resizeWidget: (id, width, height, continuous) =>
        commit(
          definition => setDashboardWidgetSize(definition, id, width, height),
          continuous ? `size:${id}` : undefined
        ),
      insertWidget: (widget, beforeId) => commit(definition => insertDashboardWidget(definition, widget, beforeId)),
      insertLayout: (kind, tab, beforeId) => {
        const widget = createDashboardLayoutWidget(kind, tab);
        commit(definition => insertDashboardWidget(definition, widget, beforeId));
        return widget.id;
      },
      replaceWidget: widget => commit(definition => replaceDashboardWidget(definition, widget)),
      removeWidget: id => commit(definition => removeDashboardWidget(definition, id)),
      moveWidget: (id, tab, beforeId) => commit(definition => moveDashboardWidget(definition, tab, id, beforeId)),
      addTab: name => commit(definition => addDashboardTab(definition, name)),
      renameTab: (tab, name) => commit(definition => renameDashboardTab(definition, tab, name)),
      removeTab: tab => commit(definition => removeDashboardTab(definition, tab)),
      finishEdit: () => setHistory(previous => (previous.group ? { ...previous, group: undefined } : previous)),
      undo: () => {
        setHistory(undoDocumentHistory);
        setError('');
      },
      redo: () => {
        setHistory(redoDocumentHistory);
        setError('');
      },
      discard: () => {
        setHistory(previous => createDocumentHistory(previous.saved));
        setError('');
      },
      save: () => saveHandler.current()
    }),
    [commit]
  );

  const { current: definition, saved } = history;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const snapshot = useMemo(
    () => ({
      id: note.id,
      path: note.path,
      definition,
      saved,
      dirty,
      canUndo,
      canRedo,
      saving,
      error
    }),
    [note.id, note.path, definition, saved, dirty, canUndo, canRedo, saving, error]
  );

  return (
    <CommandsContext.Provider value={commands}>
      <DocumentContext.Provider value={snapshot}>{children}</DocumentContext.Provider>
    </CommandsContext.Provider>
  );
};
