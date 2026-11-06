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

import { ChangeDetectorRef, ElementRef } from '@angular/core';
import {
  DatasetType,
  GraphConfig,
  ParagraphConfigResult,
  ParagraphIResultsMsgItem,
  VisualizationLineChart
} from '@zeppelin/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookParagraphResultComponent } from '../share/result/result.component';
import { DashboardResultDirective } from './dashboard-result.directive';

// Exercise the dashboard invalidation policy without loading the notebook's
// external templates, dynamic compiler, or visualization portal modules.
vi.mock('../share/result/result.component', () => ({ NotebookParagraphResultComponent: class {} }));

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let observers: ResizeObserverBoundary[];
let directives: DashboardResultDirective[];

class ResizeObserverBoundary {
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(private callback: ResizeObserverCallback) {
    observers.push(this);
  }

  notify(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function flushFrame(): void {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback(0));
}

function setup(mode = 'lineChart', initialWidth = 600, type = DatasetType.TABLE) {
  let width = initialWidth;
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { get: () => width });
  const renderer = {
    config: undefined as ParagraphConfigResult | undefined,
    result: undefined as ParagraphIResultsMsgItem | undefined,
    updateResult: vi.fn<NotebookParagraphResultComponent['updateResult']>(),
    onResize: vi.fn<NotebookParagraphResultComponent['onResize']>(),
    getCurrentVisualization: () => ({ id: renderer.config?.graph.mode ?? 'table' })
  };
  renderer.updateResult.mockImplementation((config, result) => {
    renderer.config = config;
    renderer.result = result;
  });
  renderer.onResize.mockImplementation(event => {
    renderer.config!.graph.height = event.height!;
  });
  const cdr = { markForCheck: vi.fn() };
  const directive = new DashboardResultDirective(
    renderer as unknown as NotebookParagraphResultComponent,
    new ElementRef(host),
    cdr as unknown as ChangeDetectorRef
  );
  directives.push(directive);
  directive.dashboardConfig = { graph: { ...new GraphConfig(), mode } };
  directive.dashboardResult = { type, data: 'Month\tValue\nJan\t10' };
  directive.dashboardHeight = 360;
  directive.ngOnChanges();
  return {
    directive,
    renderer,
    cdr,
    mount() {
      directive.ngAfterViewInit();
      return observers[observers.length - 1];
    },
    resize(newWidth: number) {
      width = newWidth;
      observers[observers.length - 1].notify();
    }
  };
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  observers = [];
  directives = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverBoundary);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id))
  );
});

afterEach(() => {
  directives.forEach(directive => directive.ngOnDestroy());
  vi.unstubAllGlobals();
});

describe('dashboard result invalidation', () => {
  it('leaves the initial draw to the native component, including the first width observation', () => {
    const { directive, renderer, mount } = setup();
    const observer = mount();
    observer.notify();
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.updateResult).not.toHaveBeenCalled();
    expect(renderer.onResize).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(observer.observe).toHaveBeenCalledOnce();
  });

  it('isolates deep renderer defaults and forced presentation values from the source graph', () => {
    const { directive, renderer } = setup();
    directive.dashboardConfig.graph.optionOpen = true;
    directive.dashboardConfig.graph.keys = [{ name: 'Month', index: 0, aggr: 'sum' }];
    const source = structuredClone(directive.dashboardConfig);
    directive.ngOnChanges();
    renderer.config!.graph.keys[0].name = 'native default';
    renderer.config!.graph.setting.lineChart = new VisualizationLineChart();
    expect(directive.dashboardConfig).toEqual(source);
    expect(renderer.config!.graph.height).toBe(360);
    expect(renderer.config!.graph.optionOpen).toBe(false);
  });

  it('ignores rebuilt equal inputs, saved heights, and UI-only settings without replacing live state', () => {
    const { directive, renderer, mount } = setup('table');
    mount();
    const live = renderer.config;
    renderer.config!.graph.optionOpen = true;
    directive.dashboardConfig = structuredClone(directive.dashboardConfig);
    directive.dashboardConfig.graph.height = 999;
    directive.dashboardConfig.graph.optionOpen = true;
    directive.dashboardResult = { ...directive.dashboardResult };
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.config).toBe(live);
    expect(renderer.config!.graph.optionOpen).toBe(true);
    expect(renderer.config!.graph.height).toBe(360);
    expect(renderer.updateResult).not.toHaveBeenCalled();
    expect(renderer.onResize).not.toHaveBeenCalled();
  });

  it('recognizes renderer-populated defaults and accepts already-rendered native config edits', () => {
    const { directive, renderer, mount } = setup();
    mount();
    renderer.config!.graph.setting.lineChart = new VisualizationLineChart();
    directive.dashboardConfig = structuredClone(directive.dashboardConfig);
    directive.ngOnChanges();
    directive.dashboardConfig = structuredClone(renderer.config!);
    directive.ngOnChanges();
    renderer.config!.graph.keys = [{ name: 'Value', index: 1, aggr: 'sum' }];
    directive.dashboardConfig = structuredClone(renderer.config!);
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.updateResult).not.toHaveBeenCalled();
    expect(renderer.onResize).not.toHaveBeenCalled();
  });

  it('coalesces data, graph, height, and width edits into one latest-result render', () => {
    const { directive, renderer, mount, resize } = setup();
    mount();
    directive.dashboardResult = { ...directive.dashboardResult, data: 'Month\tValue\nJan\t20' };
    directive.ngOnChanges();
    directive.dashboardConfig = structuredClone(directive.dashboardConfig);
    directive.dashboardConfig.graph.mode = 'multiBarChart';
    directive.dashboardResult = { ...directive.dashboardResult, data: 'Month\tValue\nJan\t30' };
    directive.dashboardHeight = 420;
    directive.ngOnChanges();
    resize(450);
    resize(400);
    expect(frames.size).toBe(1);
    flushFrame();
    expect(renderer.updateResult).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ graph: expect.objectContaining({ mode: 'multiBarChart', height: 420 }) }),
      expect.objectContaining({ data: 'Month\tValue\nJan\t30' })
    );
    expect(renderer.onResize).not.toHaveBeenCalled();
    resize(400);
    expect(frames.size).toBe(0);
  });

  it('does not render a graph edit reverted before the next frame', () => {
    const { directive, renderer, mount } = setup();
    mount();
    const original = directive.dashboardConfig;
    directive.dashboardConfig = { graph: { ...original.graph, mode: 'pieChart' } };
    directive.ngOnChanges();
    directive.dashboardConfig = original;
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.updateResult).not.toHaveBeenCalled();
    expect(renderer.onResize).not.toHaveBeenCalled();
  });

  it('invalidates nested graph semantics and an undo even when output data is unchanged', () => {
    const { directive, renderer, mount } = setup();
    mount();
    const original = structuredClone(directive.dashboardConfig);
    renderer.config!.graph.optionOpen = true;
    directive.dashboardConfig.graph.values = [{ name: 'Value', index: 1, aggr: 'sum' }];
    directive.ngOnChanges();
    flushFrame();
    directive.dashboardConfig = original;
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.updateResult).toHaveBeenCalledTimes(2);
    expect(renderer.config!.graph.values).toEqual([]);
    expect(renderer.config!.graph.optionOpen).toBe(true);
  });

  it('renders changed output text and type, but not unrelated graph settings on text output', () => {
    const { directive, renderer, mount } = setup('table', 600, DatasetType.TEXT);
    mount();
    directive.dashboardConfig = { graph: { ...directive.dashboardConfig.graph, mode: 'pieChart' } };
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.updateResult).not.toHaveBeenCalled();
    directive.dashboardResult = { type: DatasetType.TEXT, data: 'new output' };
    directive.ngOnChanges();
    flushFrame();
    directive.dashboardResult = { type: DatasetType.HTML, data: 'new output' };
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.updateResult).toHaveBeenCalledTimes(2);
    expect(renderer.onResize).not.toHaveBeenCalled();
  });

  it('propagates render errors without accepting a failed graph as successfully displayed', () => {
    const { directive, renderer, mount } = setup();
    mount();
    renderer.updateResult.mockImplementationOnce(config => {
      renderer.config = config;
      throw new Error('chart failed');
    });
    directive.dashboardConfig = { graph: { ...directive.dashboardConfig.graph, mode: 'pieChart' } };
    directive.ngOnChanges();
    expect(flushFrame).toThrow('chart failed');
    expect(frames.size).toBe(0);
    directive.dashboardHeight = 420;
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.updateResult).toHaveBeenCalledTimes(2);
  });
});

describe('dashboard result sizing and lifetime', () => {
  it('fits width and height without reparsing chart data and ignores height-only observer notifications', () => {
    const { directive, renderer, mount, resize } = setup();
    const observer = mount();
    resize(500);
    resize(450);
    directive.dashboardHeight = 410;
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.onResize).toHaveBeenCalledExactlyOnceWith({ height: 410 });
    expect(renderer.updateResult).not.toHaveBeenCalled();
    observer.notify();
    flushFrame();
    expect(renderer.onResize).toHaveBeenCalledOnce();
  });

  it.each([DatasetType.TABLE, DatasetType.TEXT])('lets %s table/text adapt to size without a native refresh', type => {
    const { directive, renderer, mount, resize } = setup('table', 600, type);
    mount();
    const live = renderer.config;
    resize(300);
    directive.dashboardHeight = 500;
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.config).toBe(live);
    expect(renderer.updateResult).not.toHaveBeenCalled();
    expect(renderer.onResize).not.toHaveBeenCalled();
  });

  it('treats an unavailable visualization rendered as a native table as CSS-only sizing', () => {
    const { renderer, mount, resize } = setup('unavailable-plugin');
    vi.spyOn(renderer, 'getCurrentVisualization').mockReturnValue({ id: 'table' });
    mount();
    resize(400);
    flushFrame();
    expect(renderer.updateResult).not.toHaveBeenCalled();
    expect(renderer.onResize).not.toHaveBeenCalled();
  });

  it('only fits the resized result rather than neighboring chart instances', () => {
    const first = setup();
    const firstObserver = first.mount();
    const second = setup();
    second.mount();
    first.directive.dashboardHeight = 450;
    first.directive.ngOnChanges();
    firstObserver.notify();
    flushFrame();
    expect(first.renderer.onResize).toHaveBeenCalledOnce();
    expect(second.renderer.onResize).not.toHaveBeenCalled();
    expect(first.renderer.updateResult).not.toHaveBeenCalled();
    expect(second.renderer.updateResult).not.toHaveBeenCalled();
  });

  it('defers hidden data changes and renders the latest output once when visible', () => {
    const { directive, renderer, mount, resize } = setup();
    mount();
    resize(0);
    directive.dashboardResult = { ...directive.dashboardResult, data: 'latest output' };
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.updateResult).not.toHaveBeenCalled();
    resize(600);
    flushFrame();
    expect(renderer.updateResult).toHaveBeenCalledOnce();
    expect(renderer.onResize).not.toHaveBeenCalled();
  });

  it('keeps renderer-populated graph defaults on a data-only source refresh', () => {
    const { directive, renderer, mount } = setup();
    mount();
    const live = renderer.config;
    renderer.config!.graph.setting.lineChart = new VisualizationLineChart();
    directive.dashboardResult = { ...directive.dashboardResult, data: 'new source data' };
    directive.ngOnChanges();
    flushFrame();
    expect(renderer.config).toBe(live);
    expect(renderer.config!.graph.setting.lineChart).toEqual(new VisualizationLineChart());
    expect(renderer.updateResult).toHaveBeenCalledOnce();
    expect(renderer.onResize).not.toHaveBeenCalled();
  });

  it.each([0, 600])(
    'fits once after becoming visible from width %s, even at the previous positive width',
    initialWidth => {
      const { renderer, mount, resize } = setup('lineChart', initialWidth);
      mount();
      resize(0);
      resize(600);
      flushFrame();
      resize(600);
      flushFrame();
      expect(renderer.onResize).toHaveBeenCalledOnce();
      expect(renderer.updateResult).not.toHaveBeenCalled();
    }
  );

  it('cancels queued work and ignores observer/input notifications after teardown', () => {
    const { directive, renderer, mount, resize } = setup();
    const observer = mount();
    resize(400);
    const callback = [...frames.values()][0];
    directive.ngOnDestroy();
    observer.notify();
    directive.dashboardResult = { ...directive.dashboardResult, data: 'after teardown' };
    directive.ngOnChanges();
    callback(0);
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
    expect(renderer.updateResult).not.toHaveBeenCalled();
    expect(renderer.onResize).not.toHaveBeenCalled();
  });
});
