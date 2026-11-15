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

import { Component, ElementRef, OnDestroy } from '@angular/core';
import { BarChart, CustomChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  BrushComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent
} from 'echarts/components';
import { ECharts, init, use } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

import { GraphConfig } from '@zeppelin/sdk';
import { buildEChartsOption, ChartRow } from './echarts-option';
import { TableData } from './table-data';
import { Visualization } from './visualization';

use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  BrushComponent,
  DataZoomComponent,
  ToolboxComponent,
  SVGRenderer
]);

@Component({ template: '', standalone: false })
export abstract class EChartsVisualizationComponentBase implements OnDestroy {
  abstract container: ElementRef<HTMLDivElement>;
  chart?: ECharts | null;
  config?: GraphConfig;
  private resizeObserver?: ResizeObserver;
  private destroyed = false;

  constructor(public visualization: Visualization) {}

  abstract refreshSetting(config: GraphConfig): void;

  render(): void {
    if (this.destroyed) {
      return;
    }
    const config = this.visualization.getConfig();
    this.config = config;
    this.refreshSetting(config);
    if (!this.chart) {
      this.chart = init(this.container.nativeElement, undefined, { renderer: 'svg', height: config.height || 400 });
      this.chart.getZr().on('dblclick', this.resetZoom);
      this.resizeObserver = new ResizeObserver(() => this.refresh());
      this.resizeObserver.observe(this.container.nativeElement);
    }
    const table = this.visualization.getTransformation().getTableData() as TableData;
    const transformed = this.visualization.transformed as { rows: ChartRow[] };
    this.chart.dispatchAction({ type: 'takeGlobalCursor', key: 'dataZoomSelect', dataZoomSelectActive: false });
    this.chart.setOption(buildEChartsOption(config, transformed.rows, table.columns), { notMerge: true });
    this.chart.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'dataZoomSelect',
      dataZoomSelectActive: this.focusEnabled()
    });
    this.refresh();
  }

  private focusEnabled(): boolean {
    return this.config?.mode === 'lineChart' && !!this.config.setting.lineChart?.lineWithFocus;
  }

  private readonly resetZoom = (): void => {
    if (this.focusEnabled()) {
      this.chart?.dispatchAction({ type: 'restore' });
      this.chart?.dispatchAction({ type: 'takeGlobalCursor', key: 'dataZoomSelect', dataZoomSelectActive: true });
    }
  };

  refresh(): void {
    if (this.destroyed || !this.chart) {
      return;
    }
    this.config = this.visualization.getConfig();
    this.chart.resize({ height: this.config.height || 400 });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.chart) {
      this.chart.getZr().off('dblclick', this.resetZoom);
      this.chart.dispose();
      this.chart = null;
    }
  }
}
