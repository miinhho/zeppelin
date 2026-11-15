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

import { ChangeDetectorRef, ElementRef } from '@angular/core';
import type { ECharts } from 'echarts/core';
import { GraphConfig, VisualizationLineChart } from '@zeppelin/sdk';
import { PivotTransformation, TableData, Visualization } from '@zeppelin/visualization';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VisualizationScatterSettingComponent } from '../common/scatter-setting/scatter-setting.component';
import { ScatterChartVisualizationComponent } from './scatter-chart-visualization.component';

interface MappedPoint {
  x: number;
  y: number;
  color: string;
  size?: number;
}

interface ScatterFixture {
  chart: ECharts;
  component: ScatterChartVisualizationComponent;
  container: HTMLDivElement;
  points: () => MappedPoint[];
  radii: () => number[];
  selectSize: (name?: string) => void;
  config: GraphConfig;
  resize: (width: number) => void;
  disconnect: () => void;
  tooltips: () => unknown[];
}

const createChart = (): ScatterFixture => {
  // ECharts measures SVG labels on a canvas; jsdom does not implement text measurement.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    save: vi.fn(),
    restore: vi.fn(),
    measureText: (text: string) => ({ width: text.length * 7 })
  } as unknown as CanvasRenderingContext2D);

  let resizeCallback = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
  );
  const field = (name: string, index: number) => ({ name, index, aggr: 'sum' });
  const config = new GraphConfig();
  config.mode = 'scatterChart';
  config.keys = [field('x', 0)];
  config.setting.scatterChart = { xAxis: field('x', 0), yAxis: field('y', 1), group: field('group', 4) };

  const table = new TableData();
  table.columns = ['x', 'y', 'size', 'other', 'group'];
  table.rows = [
    { x: '1', y: '10', size: '2', other: '20', group: 'A' },
    { x: '2', y: '10', size: '8', other: '8', group: 'B' },
    { x: '3', y: '10', size: '20', other: '2', group: 'A' }
  ];

  const transformation = new PivotTransformation(config);
  transformation.setTableData(table);
  const visualization = {
    getConfig: () => config,
    getTransformation: () => transformation,
    transformed: transformation.transform(table)
  } as Visualization;

  const component = new ScatterChartVisualizationComponent(visualization, {
    markForCheck: vi.fn()
  } as unknown as ChangeDetectorRef);
  component.scatterSettingComponent = { init: vi.fn() } as unknown as VisualizationScatterSettingComponent;

  const container = document.createElement('div');
  document.body.appendChild(container);
  component.container = new ElementRef(container);

  let width = 600;
  Object.defineProperty(container, 'clientWidth', { get: () => width });
  component.render();
  const chart = component.chart!;
  // ECharts' runtime model/geometry APIs are not exposed by its public instance type.
  const runtimeChart = chart as unknown as {
    getModel(): {
      getSeries(): Array<{
        getData(): {
          count(): number;
          getItemLayout(index: number): [number, number];
          getItemVisual(index: number, key: 'style'): { fill: string };
          getItemGraphicEl(index: number): { getBoundingRect(): { width: number } };
        };
        formatTooltip(index: number, multipleSeries: boolean): unknown;
      }>;
    };
  };
  const points = (): MappedPoint[] =>
    runtimeChart
      .getModel()
      .getSeries()
      .flatMap(series => {
        const data = series.getData();
        return Array.from({ length: data.count() }, (_, index) => {
          const [x, y] = data.getItemLayout(index);
          return {
            x,
            y,
            color: data.getItemVisual(index, 'style').fill,
            size: data.getItemGraphicEl(index).getBoundingRect().width / 2
          };
        });
      })
      .sort((a, b) => a.x - b.x);
  const radii = () =>
    points()
      .map(point => point.size!)
      .sort((a, b) => a - b);

  const selectSize = (name?: string) => {
    config.setting.scatterChart!.size = name ? field(name, table.columns.indexOf(name)) : undefined;
    component.render();
  };
  return {
    chart,
    component,
    container,
    points,
    radii,
    selectSize,
    config,
    resize: (nextWidth: number) => {
      width = nextWidth;
      resizeCallback();
    },
    disconnect,
    tooltips: () =>
      runtimeChart
        .getModel()
        .getSeries()
        .flatMap(series =>
          Array.from({ length: series.getData().count() }, (_, index) => series.formatTooltip(index, false))
        )
  };
};

describe('ScatterChartVisualizationComponent point sizes', () => {
  let fixture: ScatterFixture;

  afterEach(() => {
    fixture?.component.ngOnDestroy();
    fixture?.container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the selected size values independently of Y while preserving positions and groups', () => {
    fixture = createChart();
    fixture.selectSize();
    const positionsAndGroups = () => fixture.points().map(({ x, y, color }) => ({ x, y, color }));
    const baseline = positionsAndGroups();

    fixture.selectSize('size');
    const sizes = fixture.points().map(point => point.size!);
    expect(sizes[0]).toBeLessThan(sizes[1]);
    expect(sizes[1]).toBeLessThan(sizes[2]);
    expect(positionsAndGroups()).toEqual(baseline);

    fixture.selectSize('other');
    expect(fixture.points().map(point => point.size)).toEqual([...sizes].reverse());
    expect(positionsAndGroups()).toEqual(baseline);
  });

  it('restores the default rendered radii when the size selection is cleared', () => {
    fixture = createChart();
    fixture.selectSize();
    const defaultRadii = fixture.radii();

    fixture.selectSize('size');
    expect(fixture.radii()).not.toEqual(defaultRadii);

    fixture.selectSize();
    expect(fixture.radii()).toEqual(defaultRadii);
  });

  it('keeps Y values in tooltips and preserves the group legend across size selections', () => {
    fixture = createChart();
    fixture.selectSize();
    const tooltipContent = () => fixture.tooltips();
    const legendItems = () => fixture.chart.getOption().legend;
    const tooltips = tooltipContent();
    const legends = legendItems();
    expect(tooltips).toContainEqual(
      expect.objectContaining({
        header: 'y.A',
        blocks: expect.arrayContaining([expect.objectContaining({ value: 10 })])
      })
    );
    expect(legends).toHaveLength(1);
    expect(fixture.container.querySelector('svg path')).not.toBeNull();

    for (const size of ['size', 'other', undefined]) {
      fixture.selectSize(size);
      expect(tooltipContent()).toEqual(tooltips);
      expect(legendItems()).toEqual(legends);
    }
  });

  it('resizes the live SVG without replacing data and disposes once on destruction', () => {
    fixture = createChart();
    const chart = fixture.chart;
    const option = chart.getOption().series;
    const setOption = vi.spyOn(chart, 'setOption');
    const dispose = vi.spyOn(chart, 'dispose');
    fixture.config.height = 520;
    fixture.resize(780);
    expect(chart.getWidth()).toBe(780);
    expect(chart.getHeight()).toBe(520);
    expect(chart.getOption().series).toEqual(option);
    expect(setOption).not.toHaveBeenCalled();
    expect(fixture.container.querySelector('svg')?.getAttribute('width')).toBe('780');
    fixture.component.ngOnDestroy();
    expect(fixture.disconnect).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
    expect(chart.isDisposed()).toBe(true);
    fixture.resize(900);
    fixture.component.render();
    fixture.component.ngOnDestroy();
    expect(dispose).toHaveBeenCalledOnce();
    expect(fixture.container.querySelector('svg')).toBeNull();
  });

  it('resets line focus on double-click and removes zoom when focus is disabled', () => {
    fixture = createChart();
    fixture.config.mode = 'lineChart';
    fixture.config.setting.lineChart = new VisualizationLineChart();
    fixture.config.setting.lineChart.lineWithFocus = true;
    fixture.component.render();
    const chart = fixture.chart;
    chart.dispatchAction({ type: 'dataZoom', start: 25, end: 75 });
    expect(chart.getOption().dataZoom).toEqual([expect.objectContaining({ start: 25, end: 75 })]);
    chart.getZr().trigger('dblclick', {});
    expect(chart.getOption().dataZoom).toEqual([expect.objectContaining({ start: 0, end: 100 })]);
    fixture.config.setting.lineChart.lineWithFocus = false;
    fixture.component.render();
    expect(chart.getOption().dataZoom).toEqual([]);
  });
});
