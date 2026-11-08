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

import { createContext, useCallback, useContext, useEffect, useState, type DragEvent, type ReactNode } from 'react';
import type { DashboardLayoutKind, DashboardResultReference } from '@zeppelin/sdk';
import { dashboardDragType, decodeDashboardDrag, encodeDashboardDrag } from '../../lib/dashboardDrag';
import { useDashboardCommands } from '../../model/DashboardDocumentProvider';
import * as styles from './DashboardWidgetGrid.css';

interface DashboardWidgetGridProps {
  tab: string;
  labelledBy: string;
  disabled: boolean;
  onResultDrop: (reference: DashboardResultReference, beforeId?: string) => void;
  onLayoutDrop: (kind: DashboardLayoutKind, beforeId?: string) => void;
  children: ReactNode;
}

const DropTargetContext = createContext<string | undefined>(undefined);

export const useDashboardDropTarget = (id: string): boolean => useContext(DropTargetContext) === id;

export const DashboardWidgetGrid = ({
  tab,
  labelledBy,
  disabled,
  onResultDrop,
  onLayoutDrop,
  children
}: DashboardWidgetGridProps) => {
  const commands = useDashboardCommands();
  const [dragging, setDragging] = useState(false);
  const [dropBeforeId, setDropBeforeId] = useState<string>();

  const endDrag = useCallback(() => {
    setDragging(false);
    setDropBeforeId(undefined);
  }, []);

  useEffect(() => {
    document.addEventListener('dragend', endDrag);
    return () => document.removeEventListener('dragend', endDrag);
  }, [endDrag]);

  useEffect(endDrag, [tab, disabled, endDrag]);

  const targetWidget = (event: DragEvent<HTMLElement>): string | undefined => {
    if (!(event.target instanceof Element)) return;
    const element = event.target.closest<HTMLElement>('[data-widget-id]');
    return element?.dataset.widgetTab === tab ? element.dataset.widgetId : undefined;
  };

  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-dashboard-drag-handle]')) return;
    const id = targetWidget(event);
    if (disabled || !id) {
      event.preventDefault();
      return;
    }

    commands.finishEdit();
    event.dataTransfer.setData(dashboardDragType, encodeDashboardDrag({ type: 'widget', id }));
    event.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (disabled || !event.dataTransfer.types.includes(dashboardDragType)) return;
    event.preventDefault();
    setDragging(true);
    setDropBeforeId(targetWidget(event));
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    endDrag();
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    const payload = decodeDashboardDrag(event.dataTransfer.getData(dashboardDragType));
    const beforeId = targetWidget(event);
    endDrag();
    if (disabled || !payload) return;
    event.preventDefault();

    if (payload.type === 'widget') {
      if (payload.id !== beforeId) commands.moveWidget(payload.id, tab, beforeId);
    } else if (payload.type === 'result') {
      onResultDrop(payload.reference, beforeId);
    } else {
      onLayoutDrop(payload.kind, beforeId);
    }
  };

  return (
    <section
      id="dashboard-panel"
      role="tabpanel"
      aria-labelledby={labelledBy}
      tabIndex={0}
      className={styles.panel}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DropTargetContext.Provider value={dropBeforeId}>
        <div data-dashboard-widget-grid className={`${styles.grid} ${dragging ? styles.dropArea : ''}`}>
          {children}
        </div>
      </DropTargetContext.Provider>
    </section>
  );
};
