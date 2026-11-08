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

import { useId } from 'react';
import { Select } from 'antd';
import type { DashboardWidget } from '@zeppelin/sdk';
import { useDashboardCommands, useDashboardDocument } from '../../../model/DashboardDocumentProvider';
import * as styles from './WidgetAlignmentFields.css';

const horizontalOptions = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' }
];
const verticalOptions = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' }
];

export const WidgetAlignmentFields = ({ id, disabled }: { id: string; disabled: boolean }) => {
  const { definition } = useDashboardDocument();
  const commands = useDashboardCommands();
  const horizontalId = useId();
  const verticalId = useId();
  const widget = definition.widgets.find(item => item.id === id);
  if (!widget || widget.kind === 'divider') return null;

  return (
    <div className={styles.alignmentFields}>
      <div className={styles.alignmentField}>
        <label className={styles.label} htmlFor={horizontalId}>
          Text alignment
        </label>
        <Select<DashboardWidget['textAlign']>
          id={horizontalId}
          aria-label="Text alignment"
          value={widget.textAlign || 'center'}
          options={horizontalOptions}
          disabled={disabled}
          onChange={textAlign => commands.setWidgetProperties(id, { textAlign })}
        />
      </div>
      {widget.kind !== 'chart' ? (
        <div className={styles.alignmentField}>
          <label className={styles.label} htmlFor={verticalId}>
            Vertical alignment
          </label>
          <Select<DashboardWidget['verticalAlign']>
            id={verticalId}
            aria-label="Vertical alignment"
            value={widget.verticalAlign || 'center'}
            options={verticalOptions}
            disabled={disabled}
            onChange={verticalAlign => commands.setWidgetProperties(id, { verticalAlign })}
          />
        </div>
      ) : null}
    </div>
  );
};
