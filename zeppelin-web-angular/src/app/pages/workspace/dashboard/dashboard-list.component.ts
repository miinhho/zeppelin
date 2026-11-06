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

import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotesInfoItem } from '@zeppelin/sdk';
import { Subject, finalize, takeUntil } from 'rxjs';

import { DashboardSummary } from './dashboard-model';
import { DashboardService } from './dashboard.service';

@Component({
  selector: 'zeppelin-dashboard-list',
  templateUrl: './dashboard-list.component.html',
  styleUrls: ['./dashboard-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class DashboardListComponent implements OnInit, OnDestroy {
  dashboards: DashboardSummary[] = [];
  filtered: DashboardSummary[] = [];
  query = '';
  loading = false;
  error = '';
  deleteTarget?: DashboardSummary;
  deletePending = false;
  deleteError = '';
  sourcePickerOpen = false;
  sources: NotesInfoItem[] = [];
  filteredSources: NotesInfoItem[] = [];
  sourceQuery = '';
  sourcesLoading = false;
  sourcesError = '';
  selectedSource?: NotesInfoItem;
  private destroy$ = new Subject<void>();

  constructor(
    private service: DashboardService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.query = params.get('q') || '';
      this.filterDashboards();
    });
    this.load();
  }

  load(): void {
    if (this.loading || this.deleteTarget) {
      return;
    }
    this.loading = true;
    this.error = '';
    this.service
      .list()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: dashboards => {
          this.dashboards = dashboards.sort((a, b) => a.name.localeCompare(b.name));
          this.filterDashboards();
        },
        error: () => {
          this.dashboards = [];
          this.filtered = [];
          this.error = 'Unable to load dashboards.';
        }
      });
  }

  search(): void {
    this.filterDashboards();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.query || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private filterDashboards(): void {
    const query = this.query.trim().toLocaleLowerCase();
    this.filtered = this.dashboards.filter(dashboard =>
      `${dashboard.name} ${dashboard.path}`.toLocaleLowerCase().includes(query)
    );
    this.cdr.markForCheck();
  }

  folderPath(path: string): string {
    const separator = path.lastIndexOf('/');
    return separator > 0 ? path.slice(0, separator) : '/';
  }

  sourceName(source: NotesInfoItem): string {
    return source.path.split('/').pop() || source.id;
  }

  openSourcePicker(): void {
    if (this.deleteTarget) {
      return;
    }
    this.sourcePickerOpen = true;
    this.sourceQuery = '';
    this.selectedSource = undefined;
    this.loadSources();
  }

  closeSourcePicker(): void {
    this.sourcePickerOpen = false;
  }

  loadSources(): void {
    if (this.sourcesLoading) {
      return;
    }
    this.sourcesLoading = true;
    this.sourcesError = '';
    this.sources = [];
    this.filteredSources = [];
    this.selectedSource = undefined;
    this.service
      .listSources()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.sourcesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: sources => {
          this.sources = sources;
          this.searchSources();
        },
        error: () => {
          this.sourcesError = 'Unable to load source notebooks.';
        }
      });
  }

  searchSources(): void {
    const query = this.sourceQuery.trim().toLocaleLowerCase();
    this.filteredSources = this.sources.filter(source => source.path.toLocaleLowerCase().includes(query));
    this.cdr.markForCheck();
  }

  createDashboard(): void {
    if (!this.selectedSource || this.sourcesLoading || this.sourcesError) {
      return;
    }
    void this.router.navigate(['/dashboard', 'new', this.selectedSource.id], {
      queryParams: { q: this.query || null },
      queryParamsHandling: 'merge'
    });
  }

  openDelete(dashboard: DashboardSummary): void {
    if (this.loading || this.deletePending) {
      return;
    }
    this.deleteTarget = dashboard;
    this.deleteError = '';
  }

  cancelDelete(): void {
    if (!this.deletePending) {
      this.deleteTarget = undefined;
      this.deleteError = '';
    }
  }

  confirmDelete(): void {
    const target = this.deleteTarget;
    if (!target || this.deletePending) {
      return;
    }
    this.deletePending = true;
    this.deleteError = '';
    this.service
      .delete(target.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.deletePending = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.dashboards = this.dashboards.filter(dashboard => dashboard.id !== target.id);
          this.deleteTarget = undefined;
          this.filterDashboards();
        },
        error: (error: HttpErrorResponse) => {
          this.deleteError =
            error.status === 403 ? 'Only dashboard owners can delete this dashboard.' : 'Unable to delete dashboard.';
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
