/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useId, type ChangeEvent } from 'react';
import { Input } from 'antd';
import { useDashboardCommands, useDashboardDocument } from '../../../model/DashboardDocumentProvider';
import * as styles from './WidgetTextField.css';

interface WidgetTextFieldProps {
  id: string;
  disabled: boolean;
}

export const WidgetTextField = ({ id, disabled }: WidgetTextFieldProps) => {
  const { definition } = useDashboardDocument();
  const commands = useDashboardCommands();
  const inputId = useId();
  const widget = definition.widgets.find(item => item.id === id);

  useEffect(() => () => commands.finishEdit(), [commands, id]);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    commands.setWidgetText(id, event.target.value);
  };

  if (!widget || (widget.kind !== 'heading' && widget.kind !== 'text')) return null;

  return (
    <div className={styles.textField}>
      <label className={styles.label} htmlFor={inputId}>
        {widget.kind === 'heading' ? 'Heading' : 'Text'}
      </label>
      <Input.TextArea
        className={styles.editor}
        id={inputId}
        rows={3}
        value={widget.text || ''}
        disabled={disabled}
        onChange={handleTextChange}
        onBlur={commands.finishEdit}
      />
    </div>
  );
};
