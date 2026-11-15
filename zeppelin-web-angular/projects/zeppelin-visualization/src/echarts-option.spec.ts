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

import { GraphConfig } from '@zeppelin/sdk';
import * as echarts from 'echarts';
import type { BarSeriesOption, CustomSeriesOption, LineSeriesOption, ScatterSeriesOption } from 'echarts';
import { describe, expect, it } from 'vitest';

import { buildEChartsOption, ChartRow } from './echarts-option';
import { PivotTransformation } from './pivot-transformation';
import { TableData } from './table-data';

const field = (name: string, index: number, aggr = 'sum') => ({ name, index, aggr });
function pivot(config: GraphConfig, columns: string[], rows: ChartRow[]) {
  const table = new TableData();
  table.columns = columns;
  table.rows = rows;
  const transformation = new PivotTransformation(config);
  transformation.setTableData(table);
  return buildEChartsOption(config, transformation.transform(table).rows, columns);
}

function groupedConfig(mode: string) {
  const config = new GraphConfig();
  config.mode = mode;
  config.keys = [field('category', 0)];
  config.groups = [field('region', 1)];
  config.values = [field('sales', 2), field('cost', 3, 'avg')];
  return config;
}

const source = [
  { category: 'B', region: 'east', sales: '2', cost: '10' },
  { category: 'B', region: 'east', sales: '4', cost: '20' },
  { category: 'A', region: 'east', sales: '6', cost: '12' },
  { category: 'B', region: 'west', sales: '8', cost: '30' }
];
const columns = ['category', 'region', 'sales', 'cost'];

describe('shared ECharts mapping with existing pivot transformation', () => {
  it('keeps duplicate-key aggregation, sparse groups, multiple measures and original category order', () => {
    const config = groupedConfig('multiBarChart');
    config.setting.multiBarChart = { stacked: true, xLabelStatus: 'rotate', rotate: { degree: '-45' } };
    const option = pivot(config, columns, structuredClone(source));
    const series = option.series as BarSeriesOption[];
    expect(series.find(item => item.name === 'sales(sum).east')?.data).toEqual([
      ['B', 6],
      ['A', 6]
    ]);
    expect(series.find(item => item.name === 'cost(avg).east')?.data).toEqual([
      ['B', 15],
      ['A', 12]
    ]);
    expect(series.find(item => item.name === 'sales(sum).west')?.data).toEqual([['B', 8]]);
    expect(series.every(item => item.stack === 'values')).toBe(true);
    expect(option.xAxis).toMatchObject({ data: ['B', 'A'], axisLabel: { rotate: 45 } });
    expect(option.yAxis).toMatchObject({ scale: false });
    config.setting.multiBarChart.stacked = false;
    expect(
      (pivot(config, columns, structuredClone(source)).series as BarSeriesOption[]).every(item => !item.stack)
    ).toBe(true);
  });

  it('uses existing percentages for expanded area without inventing absent groups', () => {
    const config = groupedConfig('stackedAreaChart');
    config.values = [field('sales', 2)];
    config.setting.stackedAreaChart = { style: 'expand', xLabelStatus: 'hide', rotate: {} };
    const option = pivot(config, columns, structuredClone(source));
    const series = option.series as LineSeriesOption[];
    expect(series.find(item => item.name === 'sales(sum).east')?.data).toEqual([
      ['B', 6 / 14],
      ['A', 1]
    ]);
    expect(series.find(item => item.name === 'sales(sum).west')?.data).toEqual([['B', 8 / 14]]);
    expect(option.xAxis).toMatchObject({ show: false });
  });

  it('retains transformed null gaps and zero values instead of coercing both to zero', () => {
    const config = groupedConfig('lineChart');
    const option = buildEChartsOption(
      config,
      [
        { category: 'A', __key__: 'sales(sum)', __value__: 3 },
        { category: 'B', __key__: 'sales(sum)', __value__: null },
        { category: 'C', __key__: 'sales(sum)', __value__: 0 }
      ],
      columns
    );
    const series = option.series as LineSeriesOption[];
    expect(series[0].data).toEqual([
      ['A', 3],
      ['B', null],
      ['C', 0]
    ]);
    expect(series[0].connectNulls).toBe(false);
  });

  it('keeps saved date labels, zero baseline and drag zoom without mutating settings', () => {
    const config = new GraphConfig();
    config.mode = 'lineChart';
    config.keys = [field('day', 0)];
    config.values = [field('value', 1)];
    config.setting.lineChart = {
      forceY: true,
      lineWithFocus: true,
      isDateFormat: true,
      dateFormat: 'YYYY-MM-DD HH:mm',
      xLabelStatus: 'default',
      rotate: {}
    };
    const option = pivot(config, ['day', 'value'], [{ day: '2026-01-02T03:04:00', value: 5 }]);
    const saved = JSON.stringify(config);
    const axis = option.xAxis as echarts.XAXisComponentOption;
    expect(axis.type).toBe('time');
    const formatter = axis.axisLabel!.formatter as (value: number) => string;
    expect(formatter(new Date('2026-01-02T03:04:00').valueOf())).toBe('2026-01-02 03:04');
    expect(option.yAxis).toMatchObject({ min: 0 });
    expect(option.dataZoom).toMatchObject([{ type: 'inside', xAxisIndex: 0 }]);
    expect(JSON.stringify(config)).toBe(saved);
  });

  it('resolves unset scatter axes from ordered source columns, not unrelated pivot keys', () => {
    const config = new GraphConfig();
    config.mode = 'scatterChart';
    config.keys = [field('unrelated', 2)];
    const option = pivot(config, ['x', 'y', 'unrelated'], [{ x: 'first', y: '10', unrelated: 'wrong' }]);
    expect((option.series as ScatterSeriesOption[])[0].data).toEqual([['first', 10, null]]);
    config.setting.scatterChart = { xAxis: field('unrelated', 2), yAxis: field('y', 1) };
    const explicit = pivot(config, ['x', 'y', 'unrelated'], [{ x: 'first', y: '10', unrelated: 'selected' }]);
    expect((explicit.series as ScatterSeriesOption[])[0].data).toEqual([['selected', 10, null]]);
  });

  it('renders mixed-sign stream bands centered around zero without synthetic legend or tooltip data', () => {
    const config = groupedConfig('stackedAreaChart');
    config.values = [field('sales', 2)];
    config.setting.stackedAreaChart = { style: 'stream', xLabelStatus: 'default', rotate: {} };
    const option = pivot(config, columns, [
      { category: 'A', region: 'east', sales: 10 },
      { category: 'B', region: 'east', sales: 10 },
      { category: 'A', region: 'west', sales: -4 },
      { category: 'B', region: 'west', sales: -4 }
    ]);
    const series = option.series as CustomSeriesOption[];
    expect(series.map(item => item.name)).toEqual(['sales(sum).east', 'sales(sum).west']);
    expect(series[0].data).toEqual([
      ['A', -3, 7, 10, 'A', -3, 7],
      ['B', -3, 7, 10, 'A', -3, 7]
    ]);
    expect(series[1].data).toEqual([
      ['A', -3, -7, -4, 'A', -3, -7],
      ['B', -3, -7, -4, 'A', -3, -7]
    ]);
    expect(series.every(item => JSON.stringify(item.encode?.tooltip) === '[3]')).toBe(true);

    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 600, height: 400 });
    try {
      chart.setOption(option);
      const polygons = chart
        .getZr()
        .storage.getDisplayList()
        .filter(
          (item): item is InstanceType<typeof echarts.graphic.Polygon> => item instanceof echarts.graphic.Polygon
        );
      const ys = polygons.flatMap(item => item.shape.points.map(point => point[1]));
      expect(polygons).toHaveLength(2);
      const zero = chart.convertToPixel({ yAxisIndex: 0 }, 0) as number;
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(zero);
      expect(chart.renderToSVGString()).toContain('<svg');
    } finally {
      chart.dispose();
    }
  });
});
