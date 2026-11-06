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

import { ElementRef } from '@angular/core';
import type * as G2 from '@antv/g2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GraphConfig } from '@zeppelin/sdk';
import { G2VisualizationComponentBase } from './g2-visualization-component-base';
import type { Visualization } from './visualization';

class TestG2VisualizationComponent extends G2VisualizationComponentBase {
  container = new ElementRef(document.createElement('div'));
  renderBefore = vi.fn();
  refreshSetting = vi.fn();

  setScale(chart: G2.Chart): void {
    chart.scale(this.getKey(), { type: 'cat' });
  }
}

function createChart() {
  let destroyed = false;
  const assertLive = () => {
    if (destroyed) {
      throw new Error('Chart used after destruction');
    }
  };
  return {
    changeHeight: vi.fn((_height: number) => assertLive()),
    scale: vi.fn((_key: string, _options: unknown) => assertLive()),
    forceFit: vi.fn(() => assertLive()),
    destroy: vi.fn(() => {
      destroyed = true;
    })
  };
}

function createComponent() {
  const config = new GraphConfig();
  config.keys = [{ name: 'initial', index: 0, aggr: 'sum' }];
  const getConfig = vi.fn(() => config);
  const component = new TestG2VisualizationComponent({ getConfig } as unknown as Visualization);
  const chart = createChart();
  component.chart = chart as unknown as G2.Chart;
  return { component, chart, getConfig };
}

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('G2 refresh lifecycle', () => {
  it('rejects refresh before chart initialization without scheduling work', () => {
    const { component, getConfig } = createComponent();
    component.chart = undefined;

    expect(() => component.refresh()).toThrow("Can't find the chart");
    expect(getConfig).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('coalesces deferred work using the latest config while changing height immediately', () => {
    const { component, chart, getConfig } = createComponent();
    component.refresh();
    const latest = new GraphConfig();
    latest.height = 560;
    latest.keys = [{ name: 'latest', index: 1, aggr: 'sum' }];
    getConfig.mockReturnValue(latest);
    component.refresh();
    component.refresh();

    expect(chart.changeHeight.mock.calls).toEqual([[300], [560], [560]]);
    expect(chart.scale).not.toHaveBeenCalled();
    expect(chart.forceFit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    vi.runAllTimers();

    expect(chart.scale).toHaveBeenCalledExactlyOnceWith('latest', { type: 'cat' });
    expect(chart.forceFit).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    const next = new GraphConfig();
    next.height = 0;
    next.keys = [{ name: 'next', index: 2, aggr: 'sum' }];
    getConfig.mockReturnValue(next);
    component.refresh();
    expect(chart.changeHeight).toHaveBeenLastCalledWith(400);
    expect(vi.getTimerCount()).toBe(1);

    vi.runAllTimers();

    expect(chart.scale).toHaveBeenLastCalledWith('next', { type: 'cat' });
    expect(chart.scale).toHaveBeenCalledTimes(2);
    expect(chart.forceFit).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
  });

  it('cancels pending work on destruction without affecting a fresh component', () => {
    const { component, chart } = createComponent();
    component.refresh();
    component.refresh();
    const timersAtDestroy: number[] = [];
    const destroy = chart.destroy.getMockImplementation()!;
    chart.destroy.mockImplementation(() => {
      timersAtDestroy.push(vi.getTimerCount());
      destroy();
    });

    component.ngOnDestroy();

    expect(timersAtDestroy).toEqual([0]);
    expect(component.chart).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(chart.scale).not.toHaveBeenCalled();
    expect(chart.forceFit).not.toHaveBeenCalled();
    component.ngOnDestroy();
    expect(chart.destroy).toHaveBeenCalledTimes(1);
    expect(() => component.refresh()).toThrow("Can't find the chart");

    const fresh = createComponent();
    fresh.component.refresh();
    vi.runAllTimers();

    expect(fresh.chart.scale).toHaveBeenCalledExactlyOnceWith('initial', { type: 'cat' });
    expect(fresh.chart.forceFit).toHaveBeenCalledTimes(1);
    expect(chart.scale).not.toHaveBeenCalled();
    expect(chart.forceFit).not.toHaveBeenCalled();
    fresh.component.ngOnDestroy();
  });

  it('propagates deferred scale failures and permits a later refresh', () => {
    const { component, chart } = createComponent();
    vi.spyOn(component, 'setScale').mockImplementationOnce(() => {
      throw new Error('Invalid scale');
    });
    component.refresh();

    expect(() => vi.runAllTimers()).toThrow('Invalid scale');
    expect(chart.forceFit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    component.refresh();
    vi.runAllTimers();

    expect(chart.scale).toHaveBeenCalledExactlyOnceWith('initial', { type: 'cat' });
    expect(chart.forceFit).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
  });
});
