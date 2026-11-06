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

import { NgModule } from '@angular/core';
import { CanDeactivateFn, RouterModule, Routes } from '@angular/router';

import { DashboardListComponent } from './dashboard-list.component';
import { DashboardComponent } from './dashboard.component';

const canLeaveDashboard: CanDeactivateFn<DashboardComponent> = (component, _route, current, next) => {
  const sameDocument = current.url.split('?')[0] === next?.url.split('?')[0];
  const nextEditing = new URLSearchParams(next?.url.split('?')[1] || '').get('edit') === 'true';
  return sameDocument && component.editing === nextEditing ? true : component.canLeave();
};

const routes: Routes = [
  { path: '', component: DashboardListComponent, pathMatch: 'full' },
  {
    path: 'new/:sourceNoteId',
    component: DashboardComponent,
    canDeactivate: [canLeaveDashboard],
    runGuardsAndResolvers: 'always'
  },
  { path: ':id', component: DashboardComponent, canDeactivate: [canLeaveDashboard], runGuardsAndResolvers: 'always' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule {}
