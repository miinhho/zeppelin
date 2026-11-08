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

import type { DragEvent } from 'react';
import { Button } from 'antd';
import type { DashboardLayoutKind } from '@zeppelin/sdk';
import { dashboardDragType, encodeDashboardDrag } from '../../lib/dashboardDrag';
import { useDashboardCommands } from '../../model/DashboardDocumentProvider';
import * as styles from './DashboardLayoutPalette.css';

const layoutElements: { kind: DashboardLayoutKind; label: string }[] = [
  { kind: 'heading', label: 'Heading' },
  { kind: 'text', label: 'Text' },
  { kind: 'divider', label: 'Divider' }
];

interface DashboardLayoutPaletteProps {
  tab: string;
  disabled: boolean;
  onAdded: (id: string) => void;
  onAddPage: () => void;
}

export const DashboardLayoutPalette = ({ tab, disabled, onAdded, onAddPage }: DashboardLayoutPaletteProps) => {
  const commands = useDashboardCommands();

  const handleDragStart = (event: DragEvent<HTMLElement>, kind: DashboardLayoutKind) => {
    if (disabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData(dashboardDragType, encodeDashboardDrag({ type: 'layout', kind }));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleAdd = (kind: DashboardLayoutKind) => {
    if (disabled) return;

    const id = commands.insertLayout(kind, tab);

    onAdded(id);
  };

  return (
    <div className={styles.elements}>
      {layoutElements.map(({ kind, label }) => (
        <Button
          className={styles.elementButton}
          key={kind}
          draggable={!disabled}
          disabled={disabled}
          onDragStart={event => handleDragStart(event, kind)}
          onClick={() => handleAdd(kind)}
        >
          {label}
        </Button>
      ))}
      <Button className={styles.elementButton} disabled={disabled} onClick={onAddPage}>
        Page
      </Button>
    </div>
  );
};
