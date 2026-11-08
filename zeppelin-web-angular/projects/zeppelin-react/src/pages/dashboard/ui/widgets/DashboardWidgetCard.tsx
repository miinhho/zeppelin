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

import { memo, type CSSProperties } from 'react';
import { dashboardResultKey, dashboardWidgetAutomaticHeight, type DashboardWidget } from '@zeppelin/sdk';
import { useDashboardDocument } from '../../model/DashboardDocumentProvider';
import { useDashboardParagraphActions, useDashboardSource } from '../../model/DashboardSourceProvider';
import { useDashboardDropTarget } from './DashboardWidgetGrid';
import { DashboardWidgetMenu } from './DashboardWidgetMenu';
import { DashboardParagraphResult } from './DashboardParagraphResult';
import { useWidgetResize, type ResizeAxis } from './useWidgetResize';
import * as styles from './DashboardWidgetCard.css';

interface DashboardWidgetCardProps {
  id: string;
  editing: boolean;
  disabled: boolean;
  selected: boolean;
  activeTab: string;
  onSelect: (id: string) => void;
  onResizeStateChange: (id: string, active: boolean) => void;
}

const resizeLabels: Record<ResizeAxis, string> = {
  horizontal: 'Resize width',
  vertical: 'Resize height',
  both: 'Resize width and height; use arrow keys'
};
const resizeAxes: ResizeAxis[] = ['horizontal', 'vertical', 'both'];
const resultFrameHeight = 76;

export const DashboardWidgetCard = memo((props: DashboardWidgetCardProps) => {
  const { definition } = useDashboardDocument();
  const widget = definition.widgets.find(item => item.id === props.id);
  return widget ? <DashboardWidgetFrame {...props} widget={widget} /> : null;
});
DashboardWidgetCard.displayName = 'DashboardWidgetCard';

type DashboardWidgetFrameProps = DashboardWidgetCardProps & { widget: DashboardWidget };

const DashboardWidgetFrame = memo(
  ({
    widget,
    id,
    editing,
    disabled,
    selected,
    activeTab,
    onSelect,
    onResizeStateChange
  }: DashboardWidgetFrameProps) => {
    const { outputByKey } = useDashboardSource();
    const paragraphActions = useDashboardParagraphActions();
    const dropTarget = useDashboardDropTarget(id);
    const visible = widget.tab === activeTab;
    const resize = useWidgetResize({ widget, editing, disabled, visible, onSelect, onResizeStateChange });
    const rendered = resize.preview ?? widget;
    const output = widget.paragraphId
      ? outputByKey.get(dashboardResultKey({ paragraphId: widget.paragraphId, outputIndex: widget.outputIndex ?? 0 }))
      : undefined;
    const automatic =
      dashboardWidgetAutomaticHeight(widget, output) && (!resize.preview || resize.axis === 'horizontal');
    const cardClasses = [
      styles.cardFrame,
      selected && editing ? styles.selectedFrame : '',
      dropTarget ? styles.dropIndicator : ''
    ]
      .filter(Boolean)
      .join(' ');
    const cardSize: CSSProperties = {
      display: visible ? undefined : 'none',
      gridColumn: `span ${rendered.width}`,
      height: automatic ? undefined : rendered.height,
      textAlign: widget.textAlign || (widget.kind === 'chart' ? 'left' : 'center')
    };
    const contentAlignment: CSSProperties = {
      justifyContent:
        widget.verticalAlign === 'top'
          ? 'flex-start'
          : widget.verticalAlign === 'bottom'
            ? 'safe flex-end'
            : 'safe center'
    };

    const select = () => {
      if (editing && !disabled) onSelect(id);
    };
    const configure = () => {
      if (editing && !disabled && widget.kind === 'chart') paragraphActions.configure(widget);
    };

    return (
      <article
        ref={resize.element}
        id={`dashboard-widget-${id}`}
        data-widget-id={id}
        data-widget-tab={widget.tab}
        className={cardClasses}
        style={cardSize}
        onClick={select}
        onDoubleClick={configure}
      >
        {editing || widget.kind === 'chart' || widget.title ? (
          <div className={styles.cardHeading}>
            {editing ? (
              <button
                className={styles.moveHandle}
                data-dashboard-drag-handle
                draggable={!disabled}
                aria-label="Drag widget"
                disabled={disabled}
              >
                ⠿
              </button>
            ) : null}
            <h2 className={styles.widgetTitle}>{widget.title || (editing ? widget.kind : '')}</h2>
            <DashboardWidgetMenu id={id} editing={editing} disabled={disabled} onSelect={onSelect} />
          </div>
        ) : null}

        {widget.kind === 'chart' ? (
          <DashboardParagraphResult
            widget={rendered}
            width={rendered.width}
            height={Math.max(100, rendered.height - resultFrameHeight)}
          />
        ) : (
          <div className={styles.layoutContent} style={contentAlignment}>
            {widget.kind === 'divider' ? (
              <hr className={styles.divider} />
            ) : widget.kind === 'heading' ? (
              <h2 className={styles.headingContent + (!widget.text ? ` ${styles.emptyText}` : '')}>
                {widget.text || (editing ? 'Heading' : '')}
              </h2>
            ) : (
              <div className={styles.textContent + (!widget.text ? ` ${styles.emptyText}` : '')}>
                {widget.text || (editing ? 'Text' : '')}
              </div>
            )}
          </div>
        )}

        {editing
          ? resizeAxes.map(axis => (
              <button
                key={axis}
                className={styles.resizeGrips[axis]}
                aria-label={resizeLabels[axis]}
                disabled={disabled && !resize.preview}
                onPointerDown={event => resize.startResize(event, axis)}
                onPointerMove={resize.moveResize}
                onPointerUp={event => resize.finishResize(event, true)}
                onPointerCancel={event => resize.finishResize(event, false)}
                onLostPointerCapture={event => resize.finishResize(event, false)}
                onKeyDown={resize.handleKeyboardResize}
                onBlur={resize.finishEdit}
                onClick={event => event.stopPropagation()}
              />
            ))
          : null}
      </article>
    );
  }
);

DashboardWidgetFrame.displayName = 'DashboardWidgetFrame';
