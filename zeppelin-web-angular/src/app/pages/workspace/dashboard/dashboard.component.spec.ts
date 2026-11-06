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

import { ChangeDetectorRef } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { DatasetType, GraphConfig } from '@zeppelin/sdk';
import { MessageService } from '@zeppelin/services';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardDefinition, DashboardNote, SourceNote } from './dashboard-model';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from './dashboard.service';

function setup(tab = 'Overview') {
  const source = {
    id: 'source',
    name: 'Sales',
    path: '/Reports/Sales',
    noteParams: {},
    paragraphs: ['revenue', 'orders'].map(id => ({
      id,
      title: id,
      config: {},
      settings: { forms: {}, params: {} },
      status: 'FINISHED',
      results: { code: 'SUCCESS', msg: [{ type: DatasetType.TABLE, data: 'Month\tValue\nJan\t10' }] }
    }))
  } as SourceNote;
  const definition: DashboardDefinition = {
    version: 1,
    title: 'Sales dashboard',
    sourceNoteId: 'source',
    tabs: ['Overview', 'Details'],
    widgets: [
      {
        id: 'card',
        kind: 'chart',
        title: 'Revenue',
        paragraphId: 'revenue',
        outputIndex: 0,
        width: 6,
        height: 360,
        tab: 'Overview',
        config: { graph: new GraphConfig() }
      },
      { id: 'text', kind: 'text', title: 'Notes', text: 'Details', width: 12, height: 180, tab: 'Details' }
    ]
  };
  const query = new BehaviorSubject(convertToParamMap({ edit: 'true', tab, q: 'Sales' }));
  const route = {
    queryParamMap: query,
    paramMap: of(convertToParamMap({ id: 'dashboard' })),
    snapshot: { queryParamMap: query.value }
  } as unknown as ActivatedRoute;
  const save = new Subject<string>();
  const service = {
    load: () => of({ path: '/Reports/Sales dashboard', config: { dashboard: definition } } as DashboardNote),
    source: () => of(source),
    save: () => save
  } as unknown as DashboardService;
  const component = new DashboardComponent(
    route,
    { navigate: vi.fn() } as unknown as Router,
    service,
    {} as MessageService,
    { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    { getTitle: () => 'Zeppelin', setTitle: vi.fn() } as unknown as Title
  );
  component.ngOnInit();
  return { component, source, query, save };
}

beforeEach(() => vi.stubGlobal('requestAnimationFrame', () => 1));
afterEach(() => vi.unstubAllGlobals());

describe('dashboard editing state', () => {
  it('coalesces title typing and restores the saved document through undo and redo', () => {
    const { component } = setup();
    component.definition!.title = 'New';
    component.change('title');
    component.definition!.title = 'New title';
    component.change('title');
    component.finishChange();
    expect(component.dirty).toBe(true);
    component.undo();
    expect(component.definition!.title).toBe('Sales dashboard');
    expect(component.dirty).toBe(false);
    component.redo();
    expect(component.definition!.title).toBe('New title');
    expect(component.dirty).toBe(true);
    component.ngOnDestroy();
  });

  it('restores removed cards without reverting newer source inputs or results', () => {
    const { component, source } = setup();
    component.removeWidget(component.definition!.widgets[0]);
    const latest = structuredClone(source);
    latest.noteParams = { region: 'West' };
    latest.paragraphs[0].results!.msg[0].data = 'Month\tValue\nJan\t99';
    component.sourceChanged(latest);
    component.undo();
    expect(component.definition!.widgets.map(widget => widget.id)).toEqual(['card', 'text']);
    expect(component.source!.noteParams).toEqual({ region: 'West' });
    expect(component.displays[0].result!.data).toBe('Month\tValue\nJan\t99');
    expect(component.dirty).toBe(false);
    component.ngOnDestroy();
  });

  it('restores the requested page and changes pages without discarding an editing draft', () => {
    const { component, query } = setup('Details');
    expect(component.displays.map(item => item.widget.id)).toEqual(['text']);
    component.definition!.title = 'Draft title';
    component.change('title');
    query.next(convertToParamMap({ edit: 'true', tab: 'Overview', q: 'Sales' }));
    expect(component.displays.map(item => item.widget.id)).toEqual(['card']);
    expect(component.definition!.title).toBe('Draft title');
    expect(component.dirty).toBe(true);
    component.ngOnDestroy();
  });

  it('isolates replacement settings until Apply and preserves a failed save for retry', () => {
    const { component, source, save } = setup();
    const before = structuredClone(source);
    component.openWidget(component.definition!.widgets[0]);
    component.openParagraphPicker(true);
    component.addParagraph(component.paragraphChoices.find(choice => choice.paragraphId === 'orders')!);
    expect(component.definition!.widgets[0].paragraphId).toBe('revenue');
    component.applyWidget();
    expect(component.definition!.widgets[0].paragraphId).toBe('orders');
    component.save();
    save.error({ status: 403 });
    expect(component.dirty).toBe(true);
    expect(component.definition!.widgets[0].paragraphId).toBe('orders');
    expect(component.saveError).not.toBe('');
    expect(source).toEqual(before);
    component.undo();
    expect(component.definition!.widgets[0].paragraphId).toBe('revenue');
    component.ngOnDestroy();
  });

  it('preserves content-fit during width edits and restores it when a manual height is undone', () => {
    const { component } = setup();
    const widget = component.definition!.widgets[0];
    component.setHeightMode(widget, 'auto');
    component.setWidth(widget, 4);
    expect(component.isAutoHeight(widget)).toBe(true);
    component.setSize(widget, 4, 520);
    expect(component.isAutoHeight(widget)).toBe(false);
    expect(widget.height).toBe(520);
    component.undo();
    const restored = component.definition!.widgets[0];
    expect(restored.width).toBe(4);
    expect(component.isAutoHeight(restored)).toBe(true);
    component.redo();
    expect(component.definition!.widgets[0].heightMode).toBe('fixed');
    expect(component.definition!.widgets[0].height).toBe(520);
    component.ngOnDestroy();
  });

  it('edits text directly in the layout draft and keeps alignment independently undoable', () => {
    const { component, source } = setup();
    const before = structuredClone(source);
    component.addLayout('text');
    const widget = component.selectedWidget!;
    component.setText(widget, 'Quarterly');
    component.setText(widget, 'Quarterly revenue');
    component.finishChange();
    component.setAlignment(widget, 'right');
    component.setVerticalAlignment(widget, 'bottom');
    expect(component.definition!.widgets.find(item => item.id === widget.id)!.text).toBe('Quarterly revenue');
    component.undo();
    expect(component.definition!.widgets.find(item => item.id === widget.id)!.textAlign).toBe('right');
    expect(component.definition!.widgets.find(item => item.id === widget.id)!.verticalAlign).not.toBe('bottom');
    component.undo();
    component.undo();
    expect(component.definition!.widgets.find(item => item.id === widget.id)!.text).toBe('');
    expect(source).toEqual(before);
    component.ngOnDestroy();
  });

  it('keeps an empty inline text draft editable instead of submitting an invalid document', () => {
    const { component, save } = setup();
    component.addLayout('heading');
    component.save();
    expect(component.saving).toBe(false);
    expect(component.saveError).not.toBe('');
    expect(component.selectedWidget!.kind).toBe('heading');
    component.setText(component.selectedWidget!, 'Revenue');
    component.save();
    save.next('dashboard');
    save.complete();
    expect(component.dirty).toBe(false);
    expect(component.saveError).toBe('');
    component.ngOnDestroy();
  });

  it('cancels a pointer resize without leaving a phantom unsaved layout change', () => {
    const { component } = setup();
    const widget = component.definition!.widgets[0];
    const before = structuredClone(component.definition);
    const grid = document.createElement('div');
    grid.innerHTML = '<article class="widget"><button></button></article>';
    grid.style.columnGap = '16px';
    document.body.appendChild(grid);
    const card = grid.querySelector('article')!;
    const handle = grid.querySelector('button')!;
    handle.setPointerCapture = vi.fn();
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ height: 200 } as DOMRect);
    try {
      component.startResize(
        {
          button: 0,
          pointerId: 1,
          clientX: 0,
          clientY: 0,
          currentTarget: handle,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn()
        } as unknown as PointerEvent,
        widget,
        'vertical'
      );
      component.onPointerMove({ pointerId: 1, clientX: 0, clientY: 120 } as PointerEvent);
      expect(widget.heightMode).toBe('fixed');
      component.onPointerUp({ pointerId: 1, type: 'pointercancel' } as PointerEvent);
      component.change();
      expect(component.definition).toEqual(before);
      expect(component.dirty).toBe(false);
      expect(component.history).toEqual([]);
    } finally {
      grid.remove();
      component.ngOnDestroy();
    }
  });
});
