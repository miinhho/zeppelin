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
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from '@zeppelin/services';
import { describe, expect, it, vi } from 'vitest';

import { DashboardHostComponent } from './dashboard-host.component';
import { DashboardService } from './dashboard.service';

function host() {
  return new DashboardHostComponent(
    {} as ActivatedRoute,
    {} as Router,
    {} as DashboardService,
    {} as MessageService,
    new NgZone({}),
    { markForCheck: () => undefined } as ChangeDetectorRef,
    { setTitle: () => undefined } as unknown as Title,
    {} as Location
  );
}

describe('DashboardHostComponent navigation lifecycle', () => {
  it('registers synchronously and does not let an old unmount remove the current guard', () => {
    const component = host();
    const unregisterOld = component.registerCanLeave(() => true);
    const unregisterCurrent = component.registerCanLeave(() => false);
    expect(component.canLeave()).toBe(false);
    unregisterOld();
    expect(component.canLeave()).toBe(false);
    unregisterCurrent();
    expect(component.canLeave()).toBe(true);
  });

  it('keeps same-document tab/search changes but guards edit-mode exits and other documents', () => {
    const component = host();
    component.reactProps.route = { kind: 'document', id: 'one', edit: true };
    const guard = vi.fn(() => false);
    component.registerCanLeave(guard);
    expect(component.canLeave('/dashboard/one?edit=true&tab=A', '/dashboard/one?edit=true&tab=B&q=text')).toBe(true);
    expect(guard).not.toHaveBeenCalled();
    expect(component.canLeave('/dashboard/one?edit=true', '/dashboard/one')).toBe(false);
    expect(component.canLeave('/dashboard/one?edit=true', '/dashboard/two?edit=true')).toBe(false);
  });

  it('does not call the router confirmation guard for browser unload', () => {
    const component = host();
    const guard = vi.fn(() => false);
    component.registerCanLeave(guard);
    const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
    component.beforeUnload(event);
    expect(guard).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('releases its guard when destroyed and tolerates a late unregister', () => {
    const component = host();
    const unregister = component.registerCanLeave(() => false);
    component.ngOnDestroy();
    unregister();
    expect(component.canLeave()).toBe(true);
  });
});
