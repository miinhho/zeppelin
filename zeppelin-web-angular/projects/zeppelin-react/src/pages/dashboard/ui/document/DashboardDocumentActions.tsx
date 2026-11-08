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

import { useLayoutEffect, useRef } from 'react';
import { RedoOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { useDashboardCommands, useDashboardDocument } from '../../model/DashboardDocumentProvider';
import * as styles from './DashboardDocumentActions.css';

type DashboardDocumentActionsProps = {
  disabled: boolean;
  onExitEdit: (reason: 'saved' | 'discarded') => void;
  onInvalidWidget: (id: string) => void;
};

export const DashboardDocumentActions = ({ disabled, onExitEdit, onInvalidWidget }: DashboardDocumentActionsProps) => {
  const { id, dirty, saving, canUndo, canRedo } = useDashboardDocument();
  const commands = useDashboardCommands();
  const lifetime = useRef(0);
  const locked = disabled || saving;
  const status = saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved';

  useLayoutEffect(() => {
    lifetime.current += 1;

    return () => {
      lifetime.current += 1;
    };
  }, [id]);

  const discard = () => {
    if (locked || (dirty && !window.confirm('Discard unsaved changes?'))) return;
    commands.discard();
    onExitEdit('discarded');
  };

  const save = async () => {
    if (locked) return;
    const current = lifetime.current;
    const result = await commands.save();
    if (current !== lifetime.current) return;

    if (result.kind === 'invalid') {
      if (result.widgetId) onInvalidWidget(result.widgetId);
    } else if (result.kind === 'saved' || result.kind === 'unchanged') {
      onExitEdit('saved');
    }
  };

  return (
    <>
      <span className={styles.saveStatus} role="status" aria-live="polite">
        {status}
      </span>
      <Space.Compact>
        <Button icon={<UndoOutlined />} aria-label="Undo" disabled={locked || !canUndo} onClick={commands.undo} />
        <Button icon={<RedoOutlined />} aria-label="Redo" disabled={locked || !canRedo} onClick={commands.redo} />
      </Space.Compact>
      <Button disabled={locked} onClick={discard}>
        {dirty ? 'Discard' : 'Exit edit mode'}
      </Button>
      <Button type="primary" disabled={locked || !dirty} onClick={save}>
        Save
      </Button>
    </>
  );
};
