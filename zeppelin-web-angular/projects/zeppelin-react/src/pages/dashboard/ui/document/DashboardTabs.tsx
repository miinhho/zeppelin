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

import type { KeyboardEvent } from 'react';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useDashboardCommands, useDashboardDocument } from '../../model/DashboardDocumentProvider';
import { DashboardTabNameInput } from './DashboardTabNameInput';
import * as styles from './DashboardTabs.css';

export type DashboardTabEdit = { kind: 'add' } | { kind: 'rename'; tab: string };

type DashboardTabsProps = {
  activeTab: string;
  editing: boolean;
  disabled: boolean;
  edit?: DashboardTabEdit;
  showAddContent: boolean;
  onNavigate: (tab: string) => void;
  onRequestEdit: (edit: DashboardTabEdit) => void;
  onCancelEdit: () => void;
  onShowContent: () => void;
};

export const DashboardTabs = ({
  activeTab,
  editing,
  disabled,
  edit,
  showAddContent,
  onNavigate,
  onRequestEdit,
  onCancelEdit,
  onShowContent
}: DashboardTabsProps) => {
  const { definition } = useDashboardDocument();
  const { removeTab, finishEdit } = useDashboardCommands();
  const { tabs } = definition;

  const navigate = (tab: string) => {
    if (disabled) return;
    finishEdit();
    onNavigate(tab);
  };

  const navigateWithKeyboard = (event: KeyboardEvent, index: number) => {
    let target: number;
    switch (event.key) {
      case 'ArrowRight':
        target = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        target = (index + tabs.length - 1) % tabs.length;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    navigate(tabs[target]);
    requestAnimationFrame(() => document.getElementById(`dashboard-tab-${target}`)?.focus());
  };

  const deleteTab = (tab: string) => {
    const next = tabs.find(name => name !== tab);
    if (disabled || !next || !window.confirm('Delete this tab and its widgets?')) return;
    removeTab(tab);
    onCancelEdit();
    onNavigate(next);
  };

  const addTab = () => {
    onRequestEdit({ kind: 'add' });
  };

  return (
    <nav className={styles.tabs} role="tablist" aria-label="Dashboard pages">
      {tabs.map((tab, index) => {
        const selected = tab === activeTab;
        const renaming = editing && edit?.kind === 'rename' && edit.tab === tab;

        return (
          <div className={`${styles.tabItem} ${selected ? styles.selectedTab : ''}`} key={tab}>
            {renaming ? (
              <DashboardTabNameInput
                key={`rename:${tab}`}
                edit={{ kind: 'rename', tab }}
                disabled={disabled}
                onNavigate={onNavigate}
                onCancel={onCancelEdit}
              />
            ) : (
              <>
                <Button
                  type="text"
                  className={styles.tabLabel}
                  role="tab"
                  id={`dashboard-tab-${index}`}
                  aria-controls="dashboard-panel"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  disabled={disabled}
                  onClick={() => navigate(tab)}
                  onKeyDown={event => navigateWithKeyboard(event, index)}
                >
                  {tab}
                </Button>

                {editing && selected && (
                  <>
                    <Button
                      type="text"
                      size="small"
                      className={styles.tabAction}
                      icon={<EditOutlined />}
                      aria-label="Rename tab"
                      disabled={disabled}
                      onClick={() => onRequestEdit({ kind: 'rename', tab })}
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      className={styles.tabAction}
                      icon={<DeleteOutlined />}
                      aria-label="Delete tab"
                      disabled={disabled || tabs.length < 2}
                      onClick={() => deleteTab(tab)}
                    />
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      {editing &&
        (edit?.kind === 'add' ? (
          <div className={styles.newTab}>
            <DashboardTabNameInput
              key="add"
              edit={edit}
              disabled={disabled}
              onNavigate={onNavigate}
              onCancel={onCancelEdit}
            />
          </div>
        ) : (
          <Button type="text" icon={<PlusOutlined />} aria-label="Add tab" disabled={disabled} onClick={addTab} />
        ))}

      {editing && showAddContent && (
        <Button className={styles.addContent} disabled={disabled} onClick={onShowContent}>
          Add content
        </Button>
      )}
    </nav>
  );
};
