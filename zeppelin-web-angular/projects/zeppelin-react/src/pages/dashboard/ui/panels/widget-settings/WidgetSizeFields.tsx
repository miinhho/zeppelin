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

import { useEffect, useId } from 'react';
import { Button, InputNumber, Select } from 'antd';
import { dashboardResultKey, dashboardWidgetAutomaticHeight, dashboardWidgetMinimumHeight } from '@zeppelin/sdk';
import { useDashboardCommands, useDashboardDocument } from '../../../model/DashboardDocumentProvider';
import { useDashboardSource } from '../../../model/DashboardSourceProvider';
import * as styles from './WidgetSizeFields.css';

const widthPresets = [
  { label: 'Full', width: 12 },
  { label: 'Half', width: 6 },
  { label: 'Third', width: 4 }
];
const heightOptions = [
  { value: 'auto', label: 'Fit content' },
  { value: 'fixed', label: 'Fixed height' }
];

interface WidgetSizeFieldsProps {
  id: string;
  disabled: boolean;
}

export const WidgetSizeFields = ({ id, disabled }: WidgetSizeFieldsProps) => {
  const { definition } = useDashboardDocument();
  const commands = useDashboardCommands();
  const { outputByKey } = useDashboardSource();
  const columnsId = useId();
  const heightModeId = useId();
  const widget = definition.widgets.find(item => item.id === id);

  useEffect(() => () => commands.finishEdit(), [commands, id]);

  if (!widget) return null;

  const output = widget.paragraphId
    ? outputByKey.get(dashboardResultKey({ paragraphId: widget.paragraphId, outputIndex: widget.outputIndex ?? 0 }))
    : undefined;
  const automaticHeight = dashboardWidgetAutomaticHeight(widget, output);

  const handleWidthChange = (value: number | null) => {
    if (value === null || disabled) return;

    commands.resizeWidget(id, value, undefined, true);
  };

  const handleHeightChange = (value: number | null) => {
    if (value === null || disabled) return;

    commands.resizeWidget(id, widget.width, value, true);
  };

  const handleWidthPreset = (width: number) => {
    if (disabled) return;

    commands.resizeWidget(id, width);
  };

  const handleHeightModeChange = (mode: string) => {
    if (disabled) return;

    if (mode === 'auto') {
      commands.setWidgetProperties(id, { heightMode: 'auto' });
      return;
    }

    const renderedHeight = document.getElementById(`dashboard-widget-${id}`)?.getBoundingClientRect().height;

    commands.resizeWidget(id, widget.width, renderedHeight || widget.height);
  };

  return (
    <div className={styles.sizeFields}>
      <div className={styles.widthField}>
        <label className={styles.label} htmlFor={columnsId}>
          Width · 12 columns
        </label>
        <InputNumber<number>
          className={styles.numberInput}
          id={columnsId}
          min={1}
          max={12}
          precision={0}
          value={widget.width}
          disabled={disabled}
          onChange={handleWidthChange}
          onBlur={commands.finishEdit}
        />
        <div className={styles.widthPresets} role="group" aria-label="Width presets">
          {widthPresets.map(({ label, width }) => (
            <Button
              size="small"
              key={label}
              disabled={disabled}
              aria-pressed={widget.width === width}
              onClick={() => handleWidthPreset(width)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className={styles.heightField}>
        <label className={styles.label} htmlFor={heightModeId}>
          Height
        </label>
        <Select
          id={heightModeId}
          aria-label="Height"
          value={automaticHeight ? 'auto' : 'fixed'}
          options={heightOptions}
          disabled={disabled}
          onChange={handleHeightModeChange}
        />
        {!automaticHeight && (
          <InputNumber<number>
            className={styles.numberInput}
            aria-label="Height in pixels"
            min={dashboardWidgetMinimumHeight(widget)}
            max={1600}
            precision={0}
            value={widget.height}
            disabled={disabled}
            onChange={handleHeightChange}
            onBlur={commands.finishEdit}
          />
        )}
      </div>
    </div>
  );
};
