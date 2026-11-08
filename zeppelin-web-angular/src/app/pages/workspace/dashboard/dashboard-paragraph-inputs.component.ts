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

import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output
} from '@angular/core';
import { DashboardSourceNote, DynamicFormParams, DynamicForms, ParagraphItem, ParagraphStates } from '@zeppelin/sdk';
import { isEqual } from 'lodash';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { Observable, of, Subscription } from 'rxjs';
import { concatMap, finalize, tap } from 'rxjs/operators';

import { WorkspaceShareModule } from '../share/share.module';
import { DashboardParagraphService, paragraphIsRunning } from './dashboard-paragraph.service';

@Component({
  selector: 'zeppelin-dashboard-paragraph-inputs',
  standalone: true,
  imports: [WorkspaceShareModule, NzButtonModule],
  templateUrl: './dashboard-paragraph-inputs.component.html',
  styleUrls: ['./dashboard-paragraph-inputs.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardParagraphInputsComponent implements OnChanges, OnDestroy {
  @Input() noteId = '';
  @Input() paragraph!: ParagraphItem;
  @Input() noteForms: DynamicForms = {};
  @Input() noteParams: DynamicFormParams = {};
  @Output() readonly sourceChange = new EventEmitter<DashboardSourceNote>();
  @Output() readonly busyChange = new EventEmitter<boolean>();

  paragraphForms: DynamicForms = {};
  paragraphParams: DynamicFormParams = {};
  localNoteForms: DynamicForms = {};
  localNoteParams: DynamicFormParams = {};
  busy = false;
  cancelling = false;
  runAccepted = false;
  status = '';
  error = '';
  sourceError = '';

  private savedNoteParams: DynamicFormParams = {};
  private activeNoteId = '';
  private activeParagraphId = '';
  private operation = new Subscription();
  private destroyed = false;

  constructor(
    private paragraphService: DashboardParagraphService,
    private cdr: ChangeDetectorRef
  ) {}

  get hasParagraphForms(): boolean {
    return Object.keys(this.paragraphForms).length > 0;
  }

  get hasNoteForms(): boolean {
    return Object.keys(this.localNoteForms).length > 0;
  }

  ngOnChanges(): void {
    if (!this.paragraph) {
      return;
    }
    const sourceChanged = this.noteId !== this.activeNoteId || this.paragraph.id !== this.activeParagraphId;
    if (sourceChanged) {
      this.operation.unsubscribe();
      this.operation = new Subscription();
      this.setBusy(false);
      this.activeNoteId = this.noteId;
      this.activeParagraphId = this.paragraph.id;
      this.error = '';
    }
    if (this.busy) {
      return;
    }
    this.setDrafts(this.paragraph, this.noteForms, this.noteParams);
    if (paragraphIsRunning(this.paragraph)) {
      this.setBusy(true);
      this.runAccepted = true;
      this.observe(this.paragraphService.watch(this.activeNoteId, this.activeParagraphId));
    }
  }

  run(): void {
    if (this.busy || this.cancelling || !this.noteId || !this.paragraph) {
      return;
    }
    this.error = '';
    this.runAccepted = false;
    this.setBusy(true);
    const params = structuredClone(this.paragraphParams);
    const noteParams = structuredClone(this.localNoteParams);
    const save: Observable<unknown> = isEqual(noteParams, this.savedNoteParams)
      ? of(undefined)
      : this.paragraphService.saveNoteParams(this.activeNoteId, noteParams).pipe(
          concatMap(() => this.paragraphService.source(this.activeNoteId)),
          tap(source => this.acceptSource(source))
        );
    this.observe(
      save.pipe(
        concatMap(() => this.paragraphService.run(this.activeNoteId, this.activeParagraphId, params)),
        tap(() => (this.runAccepted = true)),
        concatMap(() => this.paragraphService.watch(this.activeNoteId, this.activeParagraphId))
      )
    );
  }

  cancel(): void {
    if (!this.busy || !this.runAccepted || this.cancelling) {
      return;
    }
    this.cancelling = true;
    this.error = '';
    this.operation.add(
      this.paragraphService
        .cancel(this.activeNoteId, this.activeParagraphId)
        .pipe(
          finalize(() => {
            this.cancelling = false;
            if (!this.destroyed) {
              this.cdr.markForCheck();
            }
          })
        )
        .subscribe({
          error: error => {
            this.error = this.requestError(error);
            this.cdr.markForCheck();
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.operation.unsubscribe();
    this.setBusy(false);
  }

  private observe(source: Observable<DashboardSourceNote>): void {
    this.operation.add(
      source
        .pipe(
          finalize(() => {
            this.runAccepted = false;
            this.setBusy(false);
            if (!this.destroyed) {
              this.cdr.markForCheck();
            }
          })
        )
        .subscribe({
          next: snapshot => this.acceptSource(snapshot),
          error: error => {
            this.error = this.requestError(error);
            this.cdr.markForCheck();
          }
        })
    );
  }

  private acceptSource(source: DashboardSourceNote): void {
    const paragraph = source.paragraphs.find(item => item.id === this.activeParagraphId);
    if (paragraph) {
      this.updateStatus(paragraph);
      this.savedNoteParams = structuredClone(source.noteParams ?? {});
      if (!paragraphIsRunning(paragraph) && this.runAccepted) {
        this.setDrafts(paragraph, source.noteForms ?? {}, source.noteParams ?? {});
      }
    }
    this.sourceChange.emit(source);
    this.cdr.markForCheck();
  }

  private setDrafts(paragraph: ParagraphItem, noteForms: DynamicForms, noteParams: DynamicFormParams): void {
    this.paragraphForms = structuredClone(paragraph.settings?.forms ?? {});
    this.paragraphParams = structuredClone(paragraph.settings?.params ?? {});
    this.localNoteForms = structuredClone(noteForms);
    this.localNoteParams = structuredClone(noteParams);
    this.savedNoteParams = structuredClone(noteParams);
    this.updateStatus(paragraph);
  }

  private updateStatus(paragraph: ParagraphItem): void {
    this.status = paragraph.status;
    this.sourceError = paragraph.status === ParagraphStates.ERROR ? (paragraph.errorMessage ?? '') : '';
  }

  private setBusy(busy: boolean): void {
    if (this.busy !== busy) {
      this.busy = busy;
      this.busyChange.emit(busy);
    }
  }

  private requestError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        return 'Permission denied (403).';
      }
      const message = error.error?.message;
      if (typeof message === 'string' && message) {
        return message;
      }
      return error.status ? `Source request failed (${error.status}).` : 'Unable to reach the source notebook.';
    }
    return error instanceof Error ? error.message : 'The source request failed.';
  }
}
