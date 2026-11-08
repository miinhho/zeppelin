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

import { describe, expect, it } from 'vitest';
import {
  GraphConfig,
  dashboardDefinitionsEqual,
  moveDashboardWidget,
  replaceDashboardWidget,
  setDashboardTitle,
  setDashboardWidgetProperties,
  setDashboardWidgetSize,
  type DashboardDefinition
} from '@zeppelin/sdk';
import {
  changeDocumentHistory,
  createDocumentHistory,
  redoDocumentHistory,
  undoDocumentHistory
} from './documentHistory';

const definition = (): DashboardDefinition => ({
  version: 1,
  title: 'Sales',
  sourceNoteId: 'source',
  tabs: ['Overview', 'Details'],
  widgets: [
    {
      id: 'revenue',
      kind: 'chart',
      title: 'Revenue',
      paragraphId: 'revenue',
      outputIndex: 0,
      width: 6,
      height: 360,
      heightMode: 'auto',
      tab: 'Overview',
      config: { graph: new GraphConfig() }
    },
    { id: 'notes', kind: 'text', title: 'Notes', text: 'Details', width: 12, height: 180, tab: 'Details' },
    {
      id: 'orders',
      kind: 'chart',
      title: 'Orders',
      paragraphId: 'orders',
      outputIndex: 0,
      width: 6,
      height: 360,
      tab: 'Overview'
    }
  ]
});

describe('dashboard document history', () => {
  it('undoes a typing session together and redoes its final value without modifying the saved document', () => {
    const saved = definition();
    let history = createDocumentHistory(saved);
    history = changeDocumentHistory(history, current => setDashboardTitle(current, 'New'), 'title');
    history = changeDocumentHistory(history, current => setDashboardTitle(current, 'New title'), 'title');
    expect(dashboardDefinitionsEqual(history.current, history.saved)).toBe(false);
    history = undoDocumentHistory(history);
    expect(history.current.title).toBe('Sales');
    expect(dashboardDefinitionsEqual(history.current, history.saved)).toBe(true);
    history = redoDocumentHistory(history);
    expect(history.current.title).toBe('New title');
    expect(saved.title).toBe('Sales');
  });

  it('restores content-fit after a height edit while retaining the preceding width edit', () => {
    const saved = definition();
    let history = createDocumentHistory(saved);
    history = changeDocumentHistory(history, current => setDashboardWidgetSize(current, 'revenue', 4));
    history = changeDocumentHistory(history, current => setDashboardWidgetSize(current, 'revenue', 4, 520));
    expect(history.current.widgets[0].heightMode).toBe('fixed');
    history = undoDocumentHistory(history);
    expect(history.current.widgets[0]).toMatchObject({ width: 4, heightMode: 'auto' });
    history = redoDocumentHistory(history);
    expect(history.current.widgets[0]).toMatchObject({ width: 4, height: 520, heightMode: 'fixed' });
    expect(saved.widgets[0]).toMatchObject({ width: 6, height: 360, heightMode: 'auto' });
  });

  it('does not create a phantom edit from unchanged native settings and recognizes typing back to saved values', () => {
    const saved = definition();
    let history = createDocumentHistory(saved);
    history = changeDocumentHistory(history, current =>
      replaceDashboardWidget(current, structuredClone(saved.widgets[0]))
    );
    history = changeDocumentHistory(history, current => setDashboardTitle(current, 'Changed'), 'title');
    history = changeDocumentHistory(history, current => setDashboardTitle(current, saved.title), 'title');
    expect(dashboardDefinitionsEqual(history.current, saved)).toBe(true);
    history = undoDocumentHistory(history);
    expect(dashboardDefinitionsEqual(history.current, saved)).toBe(true);
    expect(undoDocumentHistory(history).current).toBe(saved);
  });

  it('keeps alignment edits independent from text typing and invalidates redo after a new edit', () => {
    let history = createDocumentHistory(definition());
    history = changeDocumentHistory(
      history,
      current => setDashboardWidgetProperties(current, 'notes', { text: 'Quarterly' }),
      'text:notes'
    );
    history = changeDocumentHistory(
      history,
      current => setDashboardWidgetProperties(current, 'notes', { text: 'Quarterly revenue' }),
      'text:notes'
    );
    history = changeDocumentHistory(history, current =>
      setDashboardWidgetProperties(current, 'notes', { textAlign: 'right' })
    );
    history = undoDocumentHistory(history);
    expect(history.current.widgets[1]).toMatchObject({ text: 'Quarterly revenue' });
    expect(history.current.widgets[1].textAlign).toBeUndefined();
    history = undoDocumentHistory(history);
    expect(history.current.widgets[1].text).toBe('Details');
    history = changeDocumentHistory(history, current => setDashboardTitle(current, 'Different'));
    history = redoDocumentHistory(history);
    expect(history.current.title).toBe('Different');
    expect(history.current.widgets[1].text).toBe('Details');
  });

  it('reorders only the active page and restores its prior order with one undo', () => {
    let history = createDocumentHistory(definition());
    history = changeDocumentHistory(history, current => moveDashboardWidget(current, 'Overview', 'orders', 'revenue'));
    expect(history.current.widgets.map(widget => widget.id)).toEqual(['orders', 'notes', 'revenue']);
    history = undoDocumentHistory(history);
    expect(history.current.widgets.map(widget => widget.id)).toEqual(['revenue', 'notes', 'orders']);
  });
});
