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

import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Button, Dropdown, type MenuProps } from 'antd';
import { useDashboardCommands, useDashboardDocument } from '../../model/DashboardDocumentProvider';
import { useDashboardParagraphActions, useDashboardSource } from '../../model/DashboardSourceProvider';
import * as styles from './DashboardWidgetMenu.css';

interface DashboardWidgetMenuProps {
  id: string;
  editing: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
}

export const DashboardWidgetMenu = ({ id, editing, disabled, onSelect }: DashboardWidgetMenuProps) => {
  const { definition } = useDashboardDocument();
  const commands = useDashboardCommands();
  const { source, sourceHref, paragraphById } = useDashboardSource();
  const paragraphActions = useDashboardParagraphActions();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const widget = definition.widgets.find(item => item.id === id);
  if (!widget) return null;

  const page = definition.widgets.filter(item => item.tab === widget.tab);
  const index = page.findIndex(item => item.id === id);
  const items: NonNullable<MenuProps['items']> = [];

  const configure = () => {
    if (widget.kind === 'chart') paragraphActions.configure(widget);
    else onSelect(id);
  };

  const remove = () => {
    commands.removeWidget(id);
    onSelect('');
  };

  if (editing && widget.kind !== 'divider') {
    items.push({
      key: 'settings',
      label: widget.kind === 'chart' ? 'Display settings' : 'Edit content',
      disabled: disabled || (widget.kind === 'chart' && !source),
      onClick: configure
    });
  }

  if (widget.kind === 'chart') {
    items.push({
      key: 'inputs',
      label: 'Inputs & run',
      disabled: disabled || !widget.paragraphId || !paragraphById.has(widget.paragraphId),
      onClick: () => paragraphActions.run(widget)
    });
    items.push({
      key: 'source',
      label: (
        <a href={sourceHref} target="_blank" rel="noopener noreferrer">
          Open source notebook
        </a>
      )
    });
  }

  if (editing) {
    items.push({
      key: 'earlier',
      label: 'Move earlier',
      disabled: disabled || index <= 0,
      onClick: () => commands.moveWidget(id, widget.tab, page[index - 1]?.id)
    });
    items.push({
      key: 'later',
      label: 'Move later',
      disabled: disabled || index >= page.length - 1,
      onClick: () => commands.moveWidget(id, widget.tab, page[index + 2]?.id)
    });
    items.push({ key: 'remove', label: 'Remove from dashboard', danger: true, disabled, onClick: remove });
  }

  const handleTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  const handleMenuKey = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    trigger.current?.focus();
  };

  const handleMenuClick: NonNullable<MenuProps['onClick']> = info => {
    info.domEvent.stopPropagation();
    setOpen(false);
  };

  const stopPropagation = (event: MouseEvent) => event.stopPropagation();

  return (
    <Dropdown
      trigger={['click']}
      disabled={disabled}
      open={open && !disabled}
      onOpenChange={setOpen}
      autoFocus
      menu={{ items, onClick: handleMenuClick, onKeyDown: handleMenuKey }}
    >
      <Button
        ref={trigger}
        type="text"
        className={styles.menuTrigger}
        aria-label={`Actions for ${widget.title || widget.kind}`}
        aria-haspopup="menu"
        aria-expanded={open && !disabled}
        disabled={disabled}
        onKeyDown={handleTriggerKey}
        onClick={stopPropagation}
        onDoubleClick={stopPropagation}
      >
        •••
      </Button>
    </Dropdown>
  );
};
