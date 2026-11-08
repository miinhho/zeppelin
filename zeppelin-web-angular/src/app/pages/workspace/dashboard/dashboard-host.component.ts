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

import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DashboardInputsRequest,
  DashboardNativeResultHandle,
  DashboardNativeResultProps,
  DashboardReactProps,
  DashboardRoute,
  DashboardSettingsRequest,
  DashboardSettingsResult,
  DashboardSourceNote
} from '@zeppelin/sdk';
import { MessageService } from '@zeppelin/services';
import { Subject, combineLatest, firstValueFrom, switchMap, takeUntil } from 'rxjs';

import { DashboardInputsDialogComponent } from './dashboard-inputs-dialog.component';
import { DashboardNativeResultComponent } from './dashboard-native-result.component';
import { DashboardSettingsDialogComponent } from './dashboard-settings-dialog.component';
import { DashboardService } from './dashboard.service';

@Component({
  selector: 'zeppelin-dashboard-host',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error) {
      <div class="dashboard-host-error" role="alert">
        {{ error }}
        <button nz-button (click)="retry()">Retry dashboard</button>
      </div>
    }
    @if (reactProps) {
      @for (attempt of mountAttempts; track attempt) {
        <div zeppelin-react-mount="./Dashboard" [reactProps]="reactProps"></div>
      }
    }
    <ng-container #nativeViews></ng-container>
  `,
  styles: [
    ':host { display: block; min-height: 100%; }',
    '.dashboard-host-error { margin: 16px; padding: 16px; border: 1px solid #ff7875; }'
  ]
})
export class DashboardHostComponent implements OnInit, OnDestroy {
  @ViewChild('nativeViews', { read: ViewContainerRef, static: true }) private views!: ViewContainerRef;
  mountAttempts = [0];
  error = '';
  private readonly destroy$ = new Subject<void>();
  private readonly nativeTeardowns = new Set<() => void>();
  private originalTitle = '';
  private guard?: () => boolean;
  private guardToken?: object;
  private nativeBusy = false;
  private destroyed = false;

  reactProps: DashboardReactProps = {
    route: { kind: 'list', edit: false },
    onList: () => firstValueFrom(this.service.list()),
    onListSources: () => firstValueFrom(this.service.listSources()),
    onLoad: id => firstValueFrom(this.service.load(id)),
    onLoadSource: id => firstValueFrom(this.service.source(id)),
    onCreate: async sourceId => {
      const id = await firstValueFrom(
        this.service.source(sourceId).pipe(switchMap(source => this.service.create(source)))
      );
      this.messages.listNodes();
      return id;
    },
    onSave: async (id, definition) => {
      const result = await firstValueFrom(this.service.save(id, definition));
      this.messages.listNodes();
      return result;
    },
    onDelete: async id => {
      await firstValueFrom(this.service.delete(id));
      this.messages.listNodes();
    },
    onNavigate: (route, replace) => this.navigate(route, replace),
    onSourceHref: id =>
      this.location.prepareExternalUrl(this.router.serializeUrl(this.router.createUrlTree(['/notebook', id]))),
    onMountResult: (element, props) => this.mountResult(element, props),
    onOpenSettings: request => this.openSettings(request),
    onOpenInputs: request => this.openInputs(request),
    onRegisterCanLeave: guard => this.registerCanLeave(guard),
    onTitleChange: title => this.title.setTitle(`${title} - Zeppelin`),
    onError: error => this.reportError(error)
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: DashboardService,
    private messages: MessageService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private title: Title,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.originalTitle = this.title.getTitle();
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, query]) => {
        const id = params.get('id') ?? undefined;
        const sourceNoteId = params.get('sourceNoteId') ?? undefined;
        this.reactProps = {
          ...this.reactProps,
          route: {
            kind: id ? 'document' : sourceNoteId ? 'create' : 'list',
            id,
            sourceNoteId,
            edit: query.get('edit') === 'true',
            tab: query.get('tab') ?? undefined,
            q: query.get('q') ?? undefined
          }
        };
        this.cdr.markForCheck();
      });
  }

  canLeave(currentUrl?: string, nextUrl?: string): boolean {
    if (this.nativeBusy) return false;
    if (currentUrl && nextUrl && currentUrl.split('?')[0] === nextUrl.split('?')[0]) {
      const nextEditing = new URLSearchParams(nextUrl.split('?')[1] || '').get('edit') === 'true';
      if (this.reactProps.route.edit === nextEditing) return true;
    }
    return this.guard ? this.guard() : true;
  }

  registerCanLeave(guard: () => boolean): () => void {
    const token = {};
    this.guard = guard;
    this.guardToken = token;
    return () =>
      this.zone.run(() => {
        if (this.guardToken === token) {
          this.guard = undefined;
          this.guardToken = undefined;
        }
      });
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    // React independently protects its authoritative dirty/saving state.
    if (this.nativeBusy) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  retry(): void {
    if (!this.canLeave()) return;
    this.error = '';
    this.mountAttempts = [this.mountAttempts[0] + 1];
  }

  private navigate(route: DashboardRoute, replace = false): void {
    const commands =
      route.kind === 'list'
        ? ['/dashboard']
        : route.kind === 'create'
          ? ['/dashboard', 'new', route.sourceNoteId]
          : ['/dashboard', route.id];
    void this.router.navigate(commands, {
      queryParams: { edit: route.edit ? 'true' : null, tab: route.tab ?? null, q: route.q ?? null },
      replaceUrl: replace
    });
  }

  private mountResult(element: HTMLElement, props: DashboardNativeResultProps): DashboardNativeResultHandle {
    let ref: ComponentRef<DashboardNativeResultComponent>;
    try {
      ref = this.views.createComponent(DashboardNativeResultComponent);
    } catch (error) {
      this.reportError(error);
      throw error;
    }
    const node = ref.location.nativeElement as HTMLElement;
    let active = true;
    const destroy = () =>
      this.zone.run(() => {
        if (!active) return;
        active = false;
        this.nativeTeardowns.delete(destroy);
        try {
          this.removeView(ref);
        } catch (error) {
          this.reportError(error);
        } finally {
          node.remove();
        }
      });
    this.nativeTeardowns.add(destroy);
    const update = (next: DashboardNativeResultProps) =>
      this.zone.run(() => {
        if (!active || this.destroyed) return;
        try {
          ref.setInput('props', next);
          ref.changeDetectorRef.detectChanges();
        } catch (error) {
          ref.instance.showError(error);
          ref.changeDetectorRef.markForCheck();
          this.reportError(error);
        }
      });
    // The native renderer measures its container during its first view check.
    element.appendChild(node);
    update(props);
    return { update, destroy };
  }

  private openSettings(request: DashboardSettingsRequest): Promise<DashboardSettingsResult> {
    if (this.destroyed || this.nativeBusy) return Promise.resolve(undefined);
    return new Promise(resolve => {
      const ref = this.views.createComponent(DashboardSettingsDialogComponent);
      let active = true;
      const teardown = (result?: DashboardSettingsResult) => {
        if (!active) return;
        active = false;
        subscription.unsubscribe();
        this.nativeTeardowns.delete(cancel);
        try {
          this.removeView(ref);
        } finally {
          resolve(result);
        }
      };
      const cancel = () => teardown();
      const subscription = ref.instance.closed.subscribe(result => teardown(result));
      this.nativeTeardowns.add(cancel);
      ref.onDestroy(cancel);
      try {
        ref.setInput('request', request);
        ref.changeDetectorRef.detectChanges();
      } catch (error) {
        this.reportError(error);
        teardown();
      }
    });
  }

  private openInputs(request: DashboardInputsRequest): Promise<DashboardSourceNote | undefined> {
    if (this.destroyed || this.nativeBusy) return Promise.resolve(undefined);
    return new Promise(resolve => {
      const ref = this.views.createComponent(DashboardInputsDialogComponent);
      let active = true;
      const teardown = (source?: DashboardSourceNote) => {
        if (!active) return;
        active = false;
        closed.unsubscribe();
        busy.unsubscribe();
        this.nativeTeardowns.delete(cancel);
        try {
          this.removeView(ref);
        } finally {
          this.nativeBusy = false;
          resolve(source);
        }
      };
      const cancel = () => teardown();
      const closed = ref.instance.closed.subscribe(source => teardown(source));
      const busy = ref.instance.busyChange.subscribe(value => {
        this.nativeBusy = value;
      });
      this.nativeTeardowns.add(cancel);
      ref.onDestroy(cancel);
      try {
        ref.setInput('request', request);
        ref.changeDetectorRef.detectChanges();
      } catch (error) {
        this.reportError(error);
        teardown();
      }
    });
  }

  private removeView<T>(ref: ComponentRef<T>): void {
    const index = this.views.indexOf(ref.hostView);
    if (index >= 0) this.views.remove(index);
    else if (!ref.hostView.destroyed) ref.destroy();
  }

  private reportError(error: unknown): void {
    if (this.destroyed) return;
    this.error = error instanceof Error ? error.message : 'Unable to display the dashboard.';
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    for (const teardown of [...this.nativeTeardowns]) teardown();
    this.guard = undefined;
    this.guardToken = undefined;
    this.destroy$.next();
    this.destroy$.complete();
    this.title.setTitle(this.originalTitle || 'Zeppelin');
  }
}
