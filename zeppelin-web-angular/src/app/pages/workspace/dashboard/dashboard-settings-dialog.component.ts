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

import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import {
  DashboardOutput,
  GraphConfig,
  DashboardSettingsRequest,
  DashboardSettingsResult,
  DashboardWidget,
  ParagraphConfigResult,
  dashboardSourceOutputs
} from '@zeppelin/sdk';

@Component({
  selector: 'zeppelin-dashboard-settings-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-modal
      [nzVisible]="true"
      nzTitle="Display settings"
      [nzWidth]="1000"
      [nzStyle]="{ top: '24px' }"
      [nzBodyStyle]="{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }"
      [nzFooter]="footer"
      [nzMaskClosable]="false"
      (nzOnCancel)="closed.emit(undefined)"
    >
      <ng-container *nzModalContent>
        @if (draft; as widget) {
          <div class="focused-editor">
            <div class="editor-preview">
              @if (output && !failed) {
                <zeppelin-notebook-paragraph-result
                  zeppelin-dashboard-result
                  [id]="'editor-' + request.dashboardId + '-' + widget.id"
                  [dashboardResult]="output.result"
                  [dashboardConfig]="config"
                  [dashboardHeight]="360"
                  [published]="false"
                  [currentCol]="12"
                  [isPending]="false"
                  (configChange)="configChanged($event)"
                ></zeppelin-notebook-paragraph-result>
              } @else {
                <div role="alert">{{ failed ? 'Source execution failed' : 'Source result is unavailable' }}</div>
              }
            </div>
            <aside class="display-properties">
              <label for="display-title">Title</label>
              <input id="display-title" nz-input [(ngModel)]="widget.title" />
              <span>Result</span>
              <strong>{{ paragraph?.title || 'Paragraph' }}</strong>
              <button nz-button nzSize="small" (click)="finish('replace')">Replace result</button>
            </aside>
          </div>
        }
      </ng-container>
    </nz-modal>
    <ng-template #footer>
      <button nz-button (click)="closed.emit(undefined)">Cancel</button>
      <button nz-button nzType="primary" (click)="finish('apply')">Apply</button>
    </ng-template>
  `,
  styles: [
    '.focused-editor { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 24px; }',
    '.editor-preview { min-width: 0; min-height: 360px; }',
    '.display-properties { display: flex; flex-direction: column; gap: 12px; }',
    '@media (max-width: 700px) { .focused-editor { grid-template-columns: minmax(0, 1fr); } }'
  ]
})
export class DashboardSettingsDialogComponent implements OnChanges {
  @Input() request!: DashboardSettingsRequest;
  @Output() readonly closed = new EventEmitter<DashboardSettingsResult>();
  draft!: DashboardWidget;
  config!: ParagraphConfigResult;
  output?: DashboardOutput;

  get paragraph() {
    return this.request.source.paragraphs.find(item => item.id === this.draft.paragraphId);
  }

  get failed(): boolean {
    return this.paragraph?.status === 'ERROR' || this.paragraph?.results?.code === 'ERROR';
  }

  ngOnChanges(): void {
    this.draft = structuredClone(this.request.widget);
    this.output = dashboardSourceOutputs(this.request.source).find(
      item => item.paragraphId === this.draft.paragraphId && item.outputIndex === this.draft.outputIndex
    );
    this.config = structuredClone(this.draft.config ?? this.output?.config ?? { graph: new GraphConfig() });
  }

  configChanged(config: ParagraphConfigResult): void {
    this.draft.config = structuredClone(config);
    this.config = this.draft.config;
  }

  finish(kind: 'apply' | 'replace'): void {
    const widget = structuredClone(this.draft);
    if (widget.config) {
      widget.config.graph.optionOpen = false;
      widget.config.graph.height = Math.max(100, widget.height - 76);
    }
    this.closed.emit({ kind, widget });
  }
}
