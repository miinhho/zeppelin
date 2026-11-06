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

import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { WorkspaceShareModule } from '../share/share.module';
import { DashboardListComponent } from './dashboard-list.component';
import { DashboardParagraphInputsComponent } from './dashboard-paragraph-inputs.component';
import { DashboardResultDirective } from './dashboard-result.directive';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';

@NgModule({
  declarations: [DashboardComponent, DashboardListComponent, DashboardResultDirective],
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    NzButtonModule,
    NzDropDownModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    NzModalModule,
    DashboardParagraphInputsComponent,
    WorkspaceShareModule,
    DashboardRoutingModule
  ]
})
export class DashboardModule {}
