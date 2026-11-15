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

import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import en from '@angular/common/locales/en';
import { ChangeDetectorRef, Component, NgModule, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { RouterModule } from '@angular/router';
import {
  AreaChartOutline,
  BarChartOutline,
  CaretDownOutline,
  CloseOutline,
  DotChartOutline,
  DownOutline,
  DownloadOutline,
  LineChartOutline,
  PieChartOutline,
  TableOutline
} from '@ant-design/icons-angular/icons';
import { en_US, NZ_I18N } from 'ng-zorro-antd/i18n';
import { NZ_ICONS } from 'ng-zorro-antd/icon';
import { NzResizeEvent } from 'ng-zorro-antd/resizable';

import { RUNTIME_COMPILER_PROVIDERS } from '@zeppelin/app-runtime-compiler.providers';
import { NotebookParagraphResultComponent } from '@zeppelin/pages/workspace/share/result/result.component';
import { WorkspaceShareModule } from '@zeppelin/pages/workspace/share/share.module';
import {
  DatasetType,
  GraphConfig,
  ParagraphConfigResult,
  ParagraphIResultsMsgItem,
  VisualizationLineChart,
  VisualizationMultiBarChart,
  VisualizationScatterChart,
  VisualizationStackedAreaChart
} from '@zeppelin/sdk';

const POSITIVE_TABLE = [
  'X\tY\tDay\tGroup\tRevenue\tCost\tSize',
  '1\t8\t2026-11-01\tNorth\t10\t4\t1',
  '2\t12\t2026-11-01\tNorth\t5\t2\t64',
  '3\t6\t2026-11-01\tSouth\t8\t3\t9',
  '4\t15\t2026-11-02\tNorth\t12\t5\t25',
  '5\t9\t2026-11-02\tSouth\t7\t4\t4',
  '6\t18\t2026-11-03\tNorth\t20\t8\t100',
  '7\t11\t2026-11-04\tNorth\t16\t6\t16',
  '8\t14\t2026-11-04\tSouth\t11\t5\t49'
].join('\n');

const SIGNED_TABLE = [
  'X\tY\tDay\tGroup\tRevenue\tCost\tSize',
  '1\t8\t2026-11-01\tNorth\t10\t-4\t1',
  '2\t12\t2026-11-01\tNorth\t5\t-2\t64',
  '3\t6\t2026-11-01\tSouth\t8\t3\t9',
  '4\t15\t2026-11-02\tNorth\t12\t-5\t25',
  '5\t9\t2026-11-02\tSouth\t7\t4\t4',
  '6\t18\t2026-11-03\tNorth\t20\t-8\t100',
  '7\t11\t2026-11-04\tNorth\t16\t-6\t16',
  '8\t14\t2026-11-04\tSouth\t11\t5\t49'
].join('\n');

function createConfig(): ParagraphConfigResult {
  const graph = new GraphConfig();
  const field = (name: string, index: number) => ({ name, index, aggr: 'sum' });
  graph.mode = 'multiBarChart';
  graph.height = 360;
  graph.optionOpen = true;
  graph.keys = [field('Day', 2)];
  graph.groups = [field('Group', 3)];
  graph.values = [field('Revenue', 4), field('Cost', 5)];
  graph.setting = {
    multiBarChart: new VisualizationMultiBarChart(),
    lineChart: new VisualizationLineChart(),
    stackedAreaChart: new VisualizationStackedAreaChart(),
    scatterChart: Object.assign(new VisualizationScatterChart(), {
      xAxis: field('X', 0),
      yAxis: field('Y', 1),
      group: field('Group', 3),
      size: field('Size', 6)
    })
  };
  return { graph };
}

@Component({
  selector: 'zeppelin-echarts-proof',
  standalone: false,
  templateUrl: './proof.component.html',
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
        color: #243746;
      }
      h1 {
        font-size: 24px;
        margin-bottom: 8px;
      }
      .limit {
        padding: 12px;
        background: #fff8e5;
        border-left: 4px solid #b77900;
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        margin: 16px 0;
      }
      .controls label {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .controls input[type='number'] {
        width: 90px;
      }
      .proof-stage {
        border: 1px solid #cbd5df;
        padding: 16px;
        box-sizing: border-box;
      }
      .state {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
        margin: 12px 0;
      }
      .evidence {
        margin-top: 24px;
      }
      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        padding: 12px;
        background: #f5f7fa;
      }
      button,
      select,
      input {
        font: inherit;
      }
      button {
        cursor: pointer;
      }
    `
  ]
})
export class EChartsProofComponent {
  @ViewChild(NotebookParagraphResultComponent) paragraphResult?: NotebookParagraphResultComponent;

  config = createConfig();
  result: ParagraphIResultsMsgItem = { type: DatasetType.TABLE, data: POSITIVE_TABLE };
  mounted = true;
  width = 1040;
  fixture = 'positive';
  savedConfig = '';
  readonly configEvents: ParagraphConfigResult[] = [];
  readonly sizeEvents: Array<{ width?: number; height?: number; col?: number }> = [];
  mountCount = 1;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get currentConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  get configEventLog(): string {
    return JSON.stringify(this.configEvents, null, 2);
  }

  get sizeEventLog(): string {
    return JSON.stringify(this.sizeEvents, null, 2);
  }

  captureConfig(config: ParagraphConfigResult): void {
    this.config = config;
    this.configEvents.push(JSON.parse(JSON.stringify(config)) as ParagraphConfigResult);
  }

  captureSize(event: NzResizeEvent): void {
    this.sizeEvents.push({ width: event.width, height: event.height, col: event.col });
  }

  changeHeight(height: number): void {
    if (this.paragraphResult) {
      this.paragraphResult.onResize({ height });
    } else {
      this.config.graph.height = height;
    }
  }

  changeFixture(fixture: string): void {
    this.fixture = fixture;
    this.result = { type: DatasetType.TABLE, data: fixture === 'signed' ? SIGNED_TABLE : POSITIVE_TABLE };
    this.paragraphResult?.updateResult(this.config, this.result);
  }

  toggleMounted(): void {
    this.mounted = !this.mounted;
    if (this.mounted) {
      this.mountCount++;
    }
  }

  saveConfig(): void {
    this.savedConfig = JSON.stringify(this.config, null, 2);
  }

  restoreConfig(): void {
    this.mounted = false;
    this.cdr.detectChanges();
    this.config = JSON.parse(this.savedConfig) as ParagraphConfigResult;
    this.mounted = true;
    this.mountCount++;
  }
}

registerLocaleData(en);

@NgModule({
  declarations: [EChartsProofComponent],
  bootstrap: [EChartsProofComponent],
  imports: [BrowserModule, FormsModule, RouterModule.forRoot([]), WorkspaceShareModule],
  providers: [
    ...RUNTIME_COMPILER_PROVIDERS,
    provideHttpClient(),
    { provide: NZ_I18N, useValue: en_US },
    {
      provide: NZ_ICONS,
      useValue: [
        AreaChartOutline,
        BarChartOutline,
        CaretDownOutline,
        CloseOutline,
        DotChartOutline,
        DownOutline,
        DownloadOutline,
        LineChartOutline,
        PieChartOutline,
        TableOutline
      ]
    }
  ]
})
export class EChartsProofModule {}

void platformBrowserDynamic().bootstrapModule(EChartsProofModule);
