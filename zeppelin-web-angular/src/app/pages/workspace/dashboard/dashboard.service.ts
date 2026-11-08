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
import {
  createDashboardDefinition, DashboardDefinition, DashboardNote, DashboardSourceNote, DashboardSummary, NotesInfoItem
} from '@zeppelin/sdk';
import { Observable, forkJoin, map, switchMap } from 'rxjs';

import { BaseRest } from '../../../services/base-rest';
import { BaseUrlService } from '../../../services/base-url.service';

@Injectable({ providedIn: 'root' })
export class DashboardService extends BaseRest {
  constructor(
    private http: HttpClient,
    baseUrlService: BaseUrlService
  ) {
    super(baseUrlService);
  }

  create(source: DashboardSourceNote): Observable<string> {
    return this.http.get<NotesInfoItem[]>(this.restUrl`/notebook`).pipe(
      switchMap(notes =>
        this.http.post<string>(
          this.restUrl`/notebook/${encodeURIComponent(source.id)}/dashboard`,
          createDashboardDefinition(source, notes.map(note => note.path))
        )
      )
    );
  }

  load(id: string): Observable<DashboardNote> {
    return this.http.get<DashboardNote>(this.restUrl`/notebook/${encodeURIComponent(id)}`);
  }

  source(id: string): Observable<DashboardSourceNote> {
    return this.http.get<DashboardSourceNote>(this.restUrl`/notebook/${encodeURIComponent(id)}`);
  }

  save(id: string, definition: DashboardDefinition): Observable<string> {
    return this.http.put<string>(this.restUrl`/notebook/${encodeURIComponent(id)}/dashboard`, definition);
  }

  list(): Observable<DashboardSummary[]> {
    return this.http.get<DashboardSummary[]>(this.restUrl`/notebook/dashboards`);
  }

  listSources(): Observable<NotesInfoItem[]> {
    return forkJoin({
      notes: this.http.get<NotesInfoItem[]>(this.restUrl`/notebook`),
      dashboards: this.list()
    }).pipe(
      map(({ notes, dashboards }) => {
        const dashboardIds = new Set(dashboards.map(dashboard => dashboard.id));
        return notes.filter(note => !dashboardIds.has(note.id)).sort((a, b) => a.path.localeCompare(b.path));
      })
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(this.restUrl`/notebook/${encodeURIComponent(id)}`);
  }
}
