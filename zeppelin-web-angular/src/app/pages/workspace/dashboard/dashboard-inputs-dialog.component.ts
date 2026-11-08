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

import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { DashboardInputsRequest, DashboardSourceNote } from '@zeppelin/sdk';

@Component({
  selector: 'zeppelin-dashboard-inputs-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-modal
      [nzVisible]="true"
      [nzTitle]="(request.widget.title || 'Paragraph') + ' · Inputs & run'"
      [nzWidth]="560"
      [nzFooter]="footer"
      [nzMaskClosable]="false"
      [nzClosable]="!busy"
      [nzKeyboard]="!busy"
      (nzOnCancel)="close()"
    >
      <ng-container *nzModalContent>
        @if (error) {
          <div role="alert">{{ error }}</div>
        }
        @if (paragraph; as item) {
          <a [routerLink]="['/notebook', request.source.id]" target="_blank" rel="noopener">
            {{ request.source.name }} / {{ item.title || 'Paragraph' }}
          </a>
          <p>Runs this paragraph in the source notebook. Notebook inputs are shared with its paragraphs.</p>
          <zeppelin-dashboard-paragraph-inputs
            [noteId]="request.source.id"
            [paragraph]="item"
            [noteForms]="request.source.noteForms || {}"
            [noteParams]="request.source.noteParams || {}"
            (sourceChange)="sourceChanged($event)"
            (busyChange)="busyChanged($event)"
          ></zeppelin-dashboard-paragraph-inputs>
        } @else {
          <div role="alert">The source paragraph no longer exists.</div>
        }
      </ng-container>
    </nz-modal>
    <ng-template #footer><button nz-button (click)="close()" [disabled]="busy">Close</button></ng-template>
  `
})
export class DashboardInputsDialogComponent implements OnDestroy {
  @Input() request!: DashboardInputsRequest;
  @Output() readonly closed = new EventEmitter<DashboardSourceNote | undefined>();
  @Output() readonly busyChange = new EventEmitter<boolean>();
  busy = false;
  error = '';
  private latestSource?: DashboardSourceNote;

  get paragraph() {
    return this.request.source.paragraphs.find(item => item.id === this.request.widget.paragraphId);
  }

  sourceChanged(source: DashboardSourceNote): void {
    this.latestSource = source;
    try {
      this.request.onSourceChange(source);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unable to update source results.';
    }
  }

  busyChanged(busy: boolean): void {
    this.busy = busy;
    this.busyChange.emit(busy);
    try {
      this.request.onBusyChange(busy);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unable to update source execution state.';
    }
  }

  close(): void {
    if (!this.busy) this.closed.emit(this.latestSource);
  }

  ngOnDestroy(): void {
    if (this.busy) this.busyChanged(false);
  }
}
