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

import type { GraphConfig } from '@zeppelin/sdk';
import { format as formatDate } from 'date-fns';
import type { CustomSeriesRenderItem, EChartsOption, SeriesOption } from 'echarts';

export type ChartRow = Readonly<Record<string, unknown>>;

const colors = ['#03578c', '#179bd4', '#bf4f07', '#005041', '#8543e0', '#57c2e9', '#03138c', '#8c0357'];

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// G2's date mask uses Moment-style year/day tokens; keep the saved mask unchanged.
function dateLabel(value: number | string, mask: string): string {
  const pattern = mask.replace(/YYYY|YY|DD|D/g, token => ({ YYYY: 'yyyy', YY: 'yy', DD: 'dd', D: 'd' })[token]!);
  return formatDate(new Date(value), pattern);
}

const streamSegment: CustomSeriesRenderItem = (params, api) => {
  if (params.dataIndex === 0) {
    return;
  }
  // Each item carries the previous bounds as well, so filtering/zooming cannot
  // accidentally connect two categories that were not adjacent in the source.
  const x = api.value(0);
  const previousX = api.value(4);
  return {
    type: 'polygon',
    shape: {
      points: [
        api.coord([previousX, api.value(5)]),
        api.coord([previousX, api.value(6)]),
        api.coord([x, api.value(2)]),
        api.coord([x, api.value(1)])
      ]
    },
    style: { fill: api.visual('color'), opacity: 0.65 }
  };
};

/** Map already transformed rows only; aggregation and saved defaults stay with PivotTransformation. */
export function buildEChartsOption(
  config: Readonly<GraphConfig>,
  rows: readonly ChartRow[],
  columns: readonly string[]
): EChartsOption {
  const scatter = config.setting.scatterChart;
  const key =
    config.mode === 'scatterChart' ? (scatter?.xAxis?.name ?? columns[0] ?? '') : (config.keys[0]?.name ?? '');
  const categories = [...new Set(rows.map(row => String(row[key] ?? '')))];
  const grouped = new Map<string, ChartRow[]>();
  for (const row of rows) {
    const name = String(row.__key__ ?? '');
    const group = grouped.get(name);
    if (group) {
      group.push(row);
    } else {
      grouped.set(name, [row]);
    }
  }
  const names = [...grouped.keys()];
  const option: EChartsOption = {
    animation: false,
    color: colors,
    legend: { data: names, top: 8, right: 16, type: 'scroll' },
    tooltip: { trigger: 'item', renderMode: 'richText' },
    grid: { top: 64, left: 50, right: 30, bottom: 50, containLabel: true }
  };

  if (config.mode === 'pieChart') {
    option.series = [
      {
        type: 'pie',
        radius: '65%',
        center: ['50%', '58%'],
        data: rows.map(row => ({ name: String(row.__key__ ?? ''), value: number(row.__value__) ?? 0 })),
        label: { show: false },
        emphasis: { label: { show: true } }
      }
    ];
    return option;
  }

  const line = config.setting.lineChart;
  const dateAxis =
    config.mode === 'lineChart' &&
    line?.isDateFormat &&
    rows.length > 0 &&
    rows.every(row => Number.isFinite(new Date(String(row[key])).valueOf()));
  const axisSetting =
    config.mode === 'lineChart'
      ? line
      : config.mode === 'multiBarChart'
        ? config.setting.multiBarChart
        : config.mode === 'stackedAreaChart'
          ? config.setting.stackedAreaChart
          : undefined;
  const rotation = Number.parseInt(axisSetting?.rotate?.degree ?? '-45', 10);
  const xAxis = {
    show: axisSetting?.xLabelStatus !== 'hide',
    axisLabel: {
      // ECharts' positive rotation is counter-clockwise; saved G2 angles are clockwise.
      rotate: axisSetting?.xLabelStatus === 'rotate' && Number.isFinite(rotation) ? -rotation : 0
    }
  };
  option.xAxis = dateAxis
    ? {
        ...xAxis,
        type: 'time',
        axisLabel: {
          ...xAxis.axisLabel,
          formatter: (value: number) => dateLabel(value, line?.dateFormat || 'YYYY-MM-DD')
        }
      }
    : { ...xAxis, type: 'category', data: categories };
  option.yAxis = {
    type: 'value',
    scale: config.mode === 'lineChart' && !line?.forceY,
    ...(config.mode === 'lineChart' && line?.forceY ? { min: 0 } : {})
  };

  if (config.mode === 'scatterChart') {
    const sizeField = scatter?.size?.name;
    const sizes = sizeField
      ? rows.map(row => number(row[sizeField])).filter((value): value is number => value !== null)
      : [];
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const size of sizes) {
      minimum = Math.min(minimum, size);
      maximum = Math.max(maximum, size);
    }
    option.series = [...grouped].map(([name, group]) => ({
      type: 'scatter',
      name,
      dimensions: [key, 'value', 'size'],
      encode: { x: 0, y: 1, tooltip: [1] },
      data: group.map(row => [
        String(row[key] ?? ''),
        number(row.__value__),
        sizeField ? number(row[sizeField]) : null
      ]),
      symbolSize: sizeField
        ? (value: Array<string | number | null>) => {
            const size = number(value[2]);
            return size === null ? 8 : maximum === minimum ? 12 : 4 + (16 * (size - minimum)) / (maximum - minimum);
          }
        : 8,
      itemStyle: { opacity: 0.65 }
    }));
    return option;
  }

  const area = config.mode === 'stackedAreaChart';
  if (area && config.setting.stackedAreaChart?.style === 'stream') {
    // Center the complete signed extent, rather than adding a negative baseline
    // to ECharts' sign-separated stacking (which produces incorrect geometry).
    const offsets = new Map<string, number>();
    for (const row of rows) {
      const category = String(row[key] ?? '');
      offsets.set(category, (offsets.get(category) ?? 0) + (number(row.__value__) ?? 0));
    }
    const positive = new Map<string, number>();
    const negative = new Map<string, number>();
    option.series = [...grouped].map(([name, group]) => {
      const data = group.map(row => {
        const category = String(row[key] ?? '');
        const value = number(row.__value__) ?? 0;
        const accumulation = value < 0 ? negative : positive;
        const lower = accumulation.get(category) ?? 0;
        const upper = lower + value;
        accumulation.set(category, upper);
        const offset = (offsets.get(category) ?? 0) / 2;
        return [category, lower - offset, upper - offset, value] as Array<string | number>;
      });
      return {
        type: 'custom',
        name,
        renderItem: streamSegment,
        dimensions: [key, 'lower', 'upper', 'value', 'previousKey', 'previousLower', 'previousUpper'],
        encode: { x: [0, 4], y: [1, 2, 5, 6], tooltip: [3] },
        data: data.map((point, index) => [...point, ...(index ? data[index - 1].slice(0, 3) : point.slice(0, 3))])
      };
    });
    return option;
  }

  const series: SeriesOption[] = [...grouped].map(([name, group]) => {
    const data = group.map(row => [
      dateAxis ? new Date(String(row[key])).valueOf() : String(row[key] ?? ''),
      number(area && config.setting.stackedAreaChart?.style === 'expand' ? row.__percent__ : row.__value__)
    ]);
    if (config.mode === 'multiBarChart') {
      return { type: 'bar', name, data, ...(config.setting.multiBarChart?.stacked ? { stack: 'values' } : {}) };
    }
    return {
      type: 'line',
      name,
      data,
      connectNulls: false,
      ...(area ? { stack: 'values', areaStyle: { opacity: 0.65 }, showSymbol: false } : {})
    };
  });
  option.series = series;
  if (config.mode === 'lineChart' && line?.lineWithFocus) {
    option.toolbox = { left: 8, top: 8, feature: { dataZoom: { yAxisIndex: 'none' } } };
    option.dataZoom = [{ type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: false, moveOnMouseMove: false }];
  }
  return option;
}
