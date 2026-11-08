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
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent
} from 'react';
import { resizeDashboardWidget, type DashboardWidget } from '@zeppelin/sdk';
import { useDashboardCommands } from '../../model/DashboardDocumentProvider';

export type ResizeAxis = 'horizontal' | 'vertical' | 'both';

interface ResizeOrigin {
  pointerId: number;
  handle: HTMLButtonElement;
  axis: ResizeAxis;
  x: number;
  y: number;
  height: number;
  column: number;
  widget: DashboardWidget;
}

interface WidgetResizeOptions {
  widget: DashboardWidget;
  editing: boolean;
  disabled: boolean;
  visible: boolean;
  onSelect: (id: string) => void;
  onResizeStateChange: (id: string, active: boolean) => void;
}

const widgetAtPointer = (origin: ResizeOrigin, x: number, y: number): DashboardWidget =>
  resizeDashboardWidget(
    origin.widget,
    origin.axis === 'vertical' ? origin.widget.width : origin.widget.width + Math.round((x - origin.x) / origin.column),
    origin.axis === 'horizontal' ? undefined : origin.height + y - origin.y
  );

const releasePointer = (origin: ResizeOrigin) => {
  if (origin.handle.hasPointerCapture(origin.pointerId)) origin.handle.releasePointerCapture(origin.pointerId);
};

export const useWidgetResize = ({
  widget,
  editing,
  disabled,
  visible,
  onSelect,
  onResizeStateChange
}: WidgetResizeOptions) => {
  const commands = useDashboardCommands();
  const element = useRef<HTMLElement>(null);
  const origin = useRef<ResizeOrigin | undefined>(undefined);
  const notify = useRef(onResizeStateChange);
  const [preview, setPreview] = useState<DashboardWidget>();
  const resizing = preview !== undefined;

  useLayoutEffect(() => {
    notify.current = onResizeStateChange;
  }, [onResizeStateChange]);

  const cancelResize = useCallback(() => {
    const active = origin.current;
    if (!active) return;
    origin.current = undefined;
    setPreview(undefined);
    releasePointer(active);
    notify.current(active.widget.id, false);
  }, []);

  useLayoutEffect(
    () => () => {
      const active = origin.current;
      if (!active) return;
      origin.current = undefined;
      releasePointer(active);
      notify.current(active.widget.id, false);
    },
    []
  );

  useEffect(() => {
    if (!editing || !visible) cancelResize();
  }, [editing, visible, cancelResize]);

  useEffect(() => {
    if (!resizing) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancelResize();
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [resizing, cancelResize]);

  const renderedHeight = (): number => element.current?.getBoundingClientRect().height || widget.height;

  const startResize = (event: PointerEvent<HTMLButtonElement>, axis: ResizeAxis) => {
    if (!editing || disabled || origin.current || event.button !== 0) return;
    const grid = element.current?.closest<HTMLElement>('[data-dashboard-widget-grid]');
    if (!grid) return;
    event.preventDefault();
    event.stopPropagation();
    commands.finishEdit();

    const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 16;
    origin.current = {
      pointerId: event.pointerId,
      handle: event.currentTarget,
      axis,
      x: event.clientX,
      y: event.clientY,
      height: renderedHeight(),
      column: (grid.clientWidth + gap) / 12 || 1,
      widget
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreview(widget);
    onSelect(widget.id);
    notify.current(widget.id, true);
  };

  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    const active = origin.current;
    if (active?.pointerId !== event.pointerId) return;
    setPreview(widgetAtPointer(active, event.clientX, event.clientY));
  };

  const finishResize = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const active = origin.current;
    if (!active || active.pointerId !== event.pointerId) return;
    origin.current = undefined;
    setPreview(undefined);
    releasePointer(active);

    if (commit) {
      const final = widgetAtPointer(active, event.clientX, event.clientY);
      commands.resizeWidget(active.widget.id, final.width, active.axis === 'horizontal' ? undefined : final.height);
    }
    notify.current(active.widget.id, false);
  };

  const handleKeyboardResize = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      !editing ||
      disabled ||
      origin.current ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    const next = resizeDashboardWidget(
      widget,
      widget.width + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0),
      vertical ? renderedHeight() + (event.key === 'ArrowUp' ? -20 : 20) : undefined
    );
    commands.resizeWidget(widget.id, next.width, vertical ? next.height : undefined, true);
  };

  return {
    element,
    preview,
    axis: origin.current?.axis,
    startResize,
    moveResize,
    finishResize,
    handleKeyboardResize,
    finishEdit: commands.finishEdit
  };
};
