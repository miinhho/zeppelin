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

import { DashboardSettingsResult, DashboardSourceNote, DashboardWidget, GraphConfig } from '@zeppelin/sdk';
import { describe, expect, it } from 'vitest';

import { DashboardInputsDialogComponent } from './dashboard-inputs-dialog.component';
import { DashboardSettingsDialogComponent } from './dashboard-settings-dialog.component';

const source = { id: 'source', name: 'Notebook', paragraphs: [] } as unknown as DashboardSourceNote;

function widget(): DashboardWidget {
  return {
    id: 'chart',
    kind: 'chart',
    title: 'Original',
    paragraphId: 'paragraph',
    outputIndex: 0,
    width: 6,
    height: 400,
    tab: 'Overview',
    config: { graph: new GraphConfig() }
  };
}

describe('Dashboard native dialog transactions', () => {
  it('isolates title and native graph edits until Apply', () => {
    const original = widget();
    const dialog = new DashboardSettingsDialogComponent();
    dialog.request = { dashboardId: 'dashboard', source, widget: original };
    dialog.ngOnChanges();
    let result: DashboardSettingsResult;
    dialog.closed.subscribe(value => {
      result = value;
    });
    dialog.draft.title = 'Draft title';
    const config = structuredClone(dialog.config);
    config.graph.mode = 'pieChart';
    config.graph.optionOpen = true;
    dialog.configChanged(config);
    expect(original.title).toBe('Original');
    expect(original.config?.graph.mode).toBe('table');
    dialog.finish('apply');
    expect(result!).toMatchObject({
      kind: 'apply',
      widget: { title: 'Draft title', config: { graph: { mode: 'pieChart', optionOpen: false, height: 324 } } }
    });
    expect(original.title).toBe('Original');
  });

  it('returns the unapplied draft for replacement and can reopen that draft after picker cancellation', () => {
    const original = widget();
    const dialog = new DashboardSettingsDialogComponent();
    dialog.request = { dashboardId: 'dashboard', source, widget: original };
    dialog.ngOnChanges();
    let result: DashboardSettingsResult;
    dialog.closed.subscribe(value => {
      result = value;
    });
    dialog.draft.title = 'Kept across replacement';
    dialog.finish('replace');
    expect(result!.kind).toBe('replace');
    const reopened = new DashboardSettingsDialogComponent();
    reopened.request = { ...dialog.request, widget: result!.widget };
    reopened.ngOnChanges();
    expect(reopened.draft.title).toBe('Kept across replacement');
    expect(original.title).toBe('Original');
    reopened.closed.emit(undefined);
    expect(original.title).toBe('Original');
  });

  it('blocks all close actions while source execution is busy and releases busy on destruction', () => {
    const busyStates: boolean[] = [];
    const snapshots: DashboardSourceNote[] = [];
    const dialog = new DashboardInputsDialogComponent();
    dialog.request = {
      source,
      widget: widget(),
      onBusyChange: value => busyStates.push(value),
      onSourceChange: value => snapshots.push(value)
    };
    const closed: Array<DashboardSourceNote | undefined> = [];
    dialog.closed.subscribe(value => closed.push(value));
    dialog.busyChanged(true);
    dialog.close();
    expect(closed).toEqual([]);
    const updated = { ...source, name: 'Updated notebook' };
    dialog.sourceChanged(updated);
    expect(snapshots).toEqual([updated]);
    dialog.busyChanged(false);
    dialog.close();
    expect(closed).toEqual([updated]);
    dialog.busyChanged(true);
    dialog.ngOnDestroy();
    expect(busyStates).toEqual([true, false, true, false]);
  });
});
