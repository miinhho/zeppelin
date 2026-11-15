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

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnInit,
  ViewChild
} from '@angular/core';
import { GraphConfig } from '@zeppelin/sdk';

import { EChartsVisualizationComponentBase, Visualization, VISUALIZATION } from '@zeppelin/visualization';

import { VisualizationScatterSettingComponent } from '../common/scatter-setting/scatter-setting.component';

@Component({
  selector: 'zeppelin-scatter-chart-visualization',
  templateUrl: './scatter-chart-visualization.component.html',
  styleUrls: ['./scatter-chart-visualization.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ScatterChartVisualizationComponent
  extends EChartsVisualizationComponentBase
  implements OnInit, AfterViewInit
{
  @ViewChild('container', { static: false }) container!: ElementRef<HTMLDivElement>;
  @ViewChild(VisualizationScatterSettingComponent, { static: false })
  scatterSettingComponent!: VisualizationScatterSettingComponent;

  constructor(
    @Inject(VISUALIZATION) public visualization: Visualization,
    private cdr: ChangeDetectorRef
  ) {
    super(visualization);
  }

  refreshSetting(_config: GraphConfig) {
    this.scatterSettingComponent.init();
    this.cdr.markForCheck();
  }

  ngOnInit() {}

  ngAfterViewInit() {
    this.render();
  }
}
