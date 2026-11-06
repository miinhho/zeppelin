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

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DynamicFormParams, ParagraphItem, ParagraphStates } from '@zeppelin/sdk';
import { Observable, timer } from 'rxjs';
import { exhaustMap, map, takeWhile } from 'rxjs/operators';

import { BaseRest } from '../../../services/base-rest';
import { BaseUrlService } from '../../../services/base-url.service';
import { SourceNote } from './dashboard-model';

export function paragraphIsRunning(paragraph: ParagraphItem): boolean {
  return paragraph.status === ParagraphStates.PENDING || paragraph.status === ParagraphStates.RUNNING;
}

@Injectable({ providedIn: 'root' })
export class DashboardParagraphService extends BaseRest {
  constructor(
    private http: HttpClient,
    baseUrlService: BaseUrlService
  ) {
    super(baseUrlService);
  }

  saveNoteParams(noteId: string, params: DynamicFormParams): Observable<string> {
    return this.http.put<string>(this.restUrl`/notebook/${encodeURIComponent(noteId)}/forms`, { params });
  }

  run(noteId: string, paragraphId: string, params: DynamicFormParams): Observable<void> {
    return this.http.post<void>(
      this.restUrl`/notebook/job/${encodeURIComponent(noteId)}/${encodeURIComponent(paragraphId)}`,
      { params }
    );
  }

  cancel(noteId: string, paragraphId: string): Observable<void> {
    return this.http.delete<void>(
      this.restUrl`/notebook/job/${encodeURIComponent(noteId)}/${encodeURIComponent(paragraphId)}`
    );
  }

  source(noteId: string): Observable<SourceNote> {
    return this.http.get<SourceNote>(this.restUrl`/notebook/${encodeURIComponent(noteId)}`);
  }

  watch(noteId: string, paragraphId: string): Observable<SourceNote> {
    return timer(0, 1000).pipe(
      exhaustMap(() => this.source(noteId)),
      map(source => {
        if (!source.paragraphs.some(paragraph => paragraph.id === paragraphId)) {
          throw new Error('The source paragraph no longer exists.');
        }
        return source;
      }),
      takeWhile(source => paragraphIsRunning(source.paragraphs.find(paragraph => paragraph.id === paragraphId)!), true)
    );
  }
}
