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

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { ShareModule } from '@zeppelin/share';
import { WorkspaceShareModule } from '../share/share.module';
import { DashboardHostComponent } from './dashboard-host.component';
import { DashboardInputsDialogComponent } from './dashboard-inputs-dialog.component';
import { DashboardNativeResultComponent } from './dashboard-native-result.component';
import { DashboardParagraphInputsComponent } from './dashboard-paragraph-inputs.component';
import { DashboardResultDirective } from './dashboard-result.directive';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardSettingsDialogComponent } from './dashboard-settings-dialog.component';

@NgModule({
  declarations: [
    DashboardHostComponent,
    DashboardNativeResultComponent,
    DashboardSettingsDialogComponent,
    DashboardInputsDialogComponent,
    DashboardResultDirective
  ],
  imports: [
    CommonModule,
    FormsModule,
    ShareModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    DashboardParagraphInputsComponent,
    WorkspaceShareModule,
    DashboardRoutingModule
  ]
})
export class DashboardModule {}
