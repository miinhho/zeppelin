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

import { DatasetType, GraphConfig } from '@zeppelin/sdk';
import { describe, expect, it } from 'vitest';
import { createDashboard, SourceNote, sourceOutputs } from './dashboard-model';

function source(): SourceNote {
  return {
    id: 'sales',
    name: 'Sales',
    path: '/Reports/Sales',
    paragraphs: [
      {
        id: 'monthly',
        title: 'Monthly revenue',
        text: '%sql SELECT * FROM sales',
        config: {
          colWidth: 8,
          results: {
            0: {
              graph: {
                ...new GraphConfig(),
                mode: 'multiBarChart',
                keys: [{ name: 'Month', index: 0, aggr: 'sum' }],
                values: [{ name: 'Revenue', index: 1, aggr: 'sum' }]
              }
            }
          }
        },
        results: {
          msg: [
            { type: DatasetType.TABLE, data: 'Month\tRevenue\nJan\t10' },
            { type: DatasetType.TEXT, data: 'Notes' }
          ]
        }
      },
      {
        id: 'dynamic',
        config: {},
        results: { msg: [{ type: DatasetType.ANGULAR, data: '<button>Run</button>' }] }
      }
    ]
  } as SourceNote;
}

describe('notebook dashboard conversion', () => {
  it('keeps output references and chart settings while edits leave the source unchanged', () => {
    const notebook = source();
    const before = structuredClone(notebook);
    const dashboard = createDashboard(notebook);
    expect(dashboard.sourceNoteId).toBe('sales');
    expect(dashboard.widgets.map(widget => [widget.paragraphId, widget.outputIndex])).toEqual([
      ['monthly', 0],
      ['monthly', 1]
    ]);
    expect(dashboard.widgets[0].width).toBe(8);
    expect(dashboard.widgets[0].config?.graph.mode).toBe('multiBarChart');
    dashboard.widgets[0].config!.graph.keys[0].name = 'Changed';
    expect(notebook).toEqual(before);
    expect(dashboard.widgets[0]).not.toHaveProperty('result');
    expect(sourceOutputs(notebook).map(output => output.result.type)).toEqual([DatasetType.TABLE, DatasetType.TEXT]);
  });

  it('creates a distinct document name in the source folder without treating other folders as collisions', () => {
    const notebook = source();
    expect(createDashboard(notebook, ['/Other/Sales dashboard']).title).toBe('Sales dashboard');
    expect(createDashboard(notebook, [
      '/Reports/Sales dashboard',
      '/Reports/Sales dashboard 2',
      '/Other/Sales dashboard 3'
    ]).title).toBe('Sales dashboard 3');
  });
});
