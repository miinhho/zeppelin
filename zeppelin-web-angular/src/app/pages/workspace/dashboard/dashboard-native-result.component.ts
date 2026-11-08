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

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DashboardNativeResultProps, ParagraphConfigResult } from '@zeppelin/sdk';

@Component({
  selector: 'zeppelin-dashboard-native-result',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error) {
      <div role="alert">{{ error }}</div>
    }
    @if (props; as item) {
      <zeppelin-notebook-paragraph-result
        zeppelin-dashboard-result
        [id]="item.id"
        [dashboardResult]="item.result"
        [dashboardConfig]="item.config"
        [dashboardHeight]="item.height"
        [published]="item.published"
        [currentCol]="item.currentCol"
        [isPending]="item.isPending"
        (configChange)="configChanged($event)"
      ></zeppelin-notebook-paragraph-result>
    }
  `,
  styles: [':host { display: block; min-width: 0; width: 100%; }']
})
export class DashboardNativeResultComponent {
  @Input() props!: DashboardNativeResultProps;
  error = '';

  configChanged(config: ParagraphConfigResult): void {
    try {
      this.props.onConfigChange?.(config);
    } catch (error) {
      this.showError(error);
    }
  }

  showError(error: unknown): void {
    this.error = error instanceof Error ? error.message : 'Unable to render this result.';
  }
}
