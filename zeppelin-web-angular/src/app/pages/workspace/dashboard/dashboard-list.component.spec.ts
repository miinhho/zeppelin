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

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NotesInfoItem } from '@zeppelin/sdk';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { BaseUrlService } from '../../../services/base-url.service';
import { DashboardListComponent } from './dashboard-list.component';
import { DashboardSummary } from './dashboard-model';
import { DashboardService } from './dashboard.service';

const revenue: DashboardSummary = {
  id: 'revenue',
  name: 'Revenue',
  path: '/Sales/Revenue',
  sourceNoteId: 'sales-source'
};
const orders: DashboardSummary = { id: 'orders', name: 'Orders', path: '/Sales/Orders', sourceNoteId: 'sales-source' };

const createList = () => {
  const request = new Subject<void>();
  const sourceRequest = new Subject<NotesInfoItem[]>();
  const service = {
    delete: vi.fn(() => request),
    list: vi.fn(() => of([revenue, orders])),
    listSources: vi.fn(() => sourceRequest)
  };
  const params = new BehaviorSubject(convertToParamMap({ q: 'Sales', unrelated: 'keep' }));
  const route = { queryParamMap: params } as unknown as ActivatedRoute;
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };
  const component = new DashboardListComponent(
    service as unknown as DashboardService,
    { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    route,
    router as unknown as Router
  );
  component.dashboards = [revenue, orders];
  component.query = 'Revenue';
  component.search();
  return { component, request, sourceRequest, service, params, route, router };
};

describe('dashboard deletion', () => {
  it('keeps the dashboard until deletion succeeds, then updates the active search without removing other dashboards', () => {
    const { component, request, service } = createList();
    component.openDelete(revenue);
    component.confirmDelete();
    component.cancelDelete();
    expect(component.deletePending).toBe(true);
    expect(component.deleteTarget).toBe(revenue);
    expect(component.filtered).toEqual([revenue]);

    expect(service.delete).toHaveBeenCalledTimes(1);
    expect(service.delete).toHaveBeenCalledWith(revenue.id);
    request.next();
    request.complete();
    expect(component.deletePending).toBe(false);
    expect(component.deleteTarget).toBeUndefined();
    expect(component.dashboards).toEqual([orders]);
    expect(component.filtered).toEqual([]);
    expect(component.query).toBe('Revenue');
    component.ngOnDestroy();
  });

  it('retains the dashboard and confirmation on permission failure, allowing cancellation', () => {
    const { component, request } = createList();
    component.openDelete(revenue);
    component.confirmDelete();
    request.error(new HttpErrorResponse({ status: 403 }));
    expect(component.deletePending).toBe(false);
    expect(component.deleteTarget).toBe(revenue);
    expect(component.dashboards).toEqual([revenue, orders]);
    expect(component.filtered).toEqual([revenue]);
    expect(component.deleteError).toBeTruthy();

    component.cancelDelete();
    expect(component.deleteTarget).toBeUndefined();
    expect(component.deleteError).toBe('');
    expect(component.dashboards).toEqual([revenue, orders]);
    component.ngOnDestroy();
  });
});

describe('dashboard discovery', () => {
  it('restores name and folder search from the URL, responds to back navigation, and merges search updates', () => {
    const { component, params, route, router } = createList();
    component.ngOnInit();
    expect(component.query).toBe('Sales');
    expect(component.filtered).toEqual([orders, revenue]);

    params.next(convertToParamMap({ q: 'revenue', unrelated: 'keep' }));
    expect(component.query).toBe('revenue');
    expect(component.filtered).toEqual([revenue]);
    component.query = '';
    component.search();
    expect(component.filtered).toEqual([orders, revenue]);
    expect(router.navigate).toHaveBeenLastCalledWith([], {
      relativeTo: route,
      queryParams: { q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    component.ngOnDestroy();
  });

  it('loads real source choices, filters folder paths, and creates through the existing conversion route with list search', () => {
    const { component, sourceRequest, router } = createList();
    router.navigate.mockClear();
    component.openSourcePicker();
    expect(component.sourcePickerOpen).toBe(true);
    expect(component.sourcesLoading).toBe(true);
    expect(component.filteredSources).toEqual([]);
    component.createDashboard();
    expect(router.navigate).not.toHaveBeenCalled();

    const sales = { id: 'sales-source', path: '/Sales/Analysis' };
    sourceRequest.next([sales, { id: 'research', path: '/Research/Overview' }]);
    sourceRequest.complete();
    component.sourceQuery = 'sales';
    component.searchSources();
    expect(component.filteredSources).toEqual([sales]);
    expect(component.sourceName(sales)).toBe('Analysis');
    expect(component.folderPath(sales.path)).toBe('/Sales');
    expect(component.folderPath('Root notebook')).toBe('/');
    component.selectedSource = sales;
    component.createDashboard();
    expect(router.navigate).toHaveBeenLastCalledWith(['/dashboard', 'new', 'sales-source'], {
      queryParams: { q: 'Revenue' },
      queryParamsHandling: 'merge'
    });
    component.ngOnDestroy();
  });

  it('keeps source loading failures visible and retries without retaining stale selections', () => {
    const { component, sourceRequest, service } = createList();
    component.openSourcePicker();
    sourceRequest.error(new HttpErrorResponse({ status: 503 }));
    expect(component.sourcesLoading).toBe(false);
    expect(component.sourcesError).toBe('Unable to load source notebooks.');
    const retry = new Subject<NotesInfoItem[]>();
    service.listSources.mockReturnValueOnce(retry);
    component.loadSources();
    expect(component.sourcesError).toBe('');
    expect(component.selectedSource).toBeUndefined();
    const source = { id: 'source', path: '/Analysis' };
    retry.next([source]);
    retry.complete();
    expect(component.sourcesLoading).toBe(false);
    expect(component.filteredSources).toEqual([source]);
    component.closeSourcePicker();
    expect(component.sourcePickerOpen).toBe(false);
    component.ngOnDestroy();
  });
});

describe('dashboard source listing', () => {
  it('excludes dashboard documents using the existing readable dashboard list without loading full notes', () => {
    const source = { id: 'sales-source', path: '/Sales/Analysis' };
    const http = {
      get: vi.fn((url: string) =>
        of(url === '/api/notebook' ? [source, { id: revenue.id, path: revenue.path }] : [revenue])
      )
    };
    const service = new DashboardService(
      http as unknown as HttpClient,
      {
        getRestApiBase: () => '/api'
      } as BaseUrlService
    );
    let sources: NotesInfoItem[] = [];
    service.listSources().subscribe(notes => {
      sources = notes;
    });
    expect(sources).toEqual([source]);
    expect(http.get.mock.calls).toEqual([['/api/notebook'], ['/api/notebook/dashboards']]);
  });
});
