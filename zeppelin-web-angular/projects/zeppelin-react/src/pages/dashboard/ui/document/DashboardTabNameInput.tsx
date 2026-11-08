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

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { useDashboardCommands, useDashboardDocument } from '../../model/DashboardDocumentProvider';
import type { DashboardTabEdit } from './DashboardTabs';
import * as styles from './DashboardTabNameInput.css';

type DashboardTabNameInputProps = {
  edit: DashboardTabEdit;
  disabled: boolean;
  onNavigate: (tab: string) => void;
  onCancel: () => void;
};

export const DashboardTabNameInput = ({ edit, disabled, onNavigate, onCancel }: DashboardTabNameInputProps) => {
  const { definition } = useDashboardDocument();
  const { addTab, renameTab } = useDashboardCommands();
  const [name, setName] = useState(edit.kind === 'rename' ? edit.tab : '');
  const finished = useRef(false);
  const adding = edit.kind === 'add';
  const trimmed = name.trim();
  const valid = trimmed.length > 0 && !definition.tabs.includes(trimmed);

  const finish = (commit: boolean) => {
    if (finished.current || disabled) return;
    finished.current = true;

    if (commit && valid) {
      if (edit.kind === 'add') addTab(trimmed);
      else renameTab(edit.tab, trimmed);
      onCancel();
      onNavigate(trimmed);
    } else {
      onCancel();
    }
  };

  const changeName = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault();
    finish(event.key === 'Enter');
  };

  const confirmName = () => finish(true);
  const cancelName = () => finish(false);

  return (
    <>
      <Input
        autoFocus
        className={styles.nameField}
        aria-label={adding ? 'New tab name' : 'Tab name'}
        placeholder={adding ? 'Tab name' : undefined}
        value={name}
        disabled={disabled}
        onChange={changeName}
        onKeyDown={handleKey}
        onBlur={adding ? undefined : confirmName}
      />
      {adding && (
        <>
          <Button
            icon={<CheckOutlined />}
            aria-label="Confirm new tab"
            disabled={disabled || !valid}
            onClick={confirmName}
          />
          <Button icon={<CloseOutlined />} aria-label="Cancel new tab" disabled={disabled} onClick={cancelName} />
        </>
      )}
    </>
  );
};
