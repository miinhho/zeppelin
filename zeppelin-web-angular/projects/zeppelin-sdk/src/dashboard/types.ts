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

import type { Note, NoteConfig, ParagraphConfigResult, ParagraphIResultsMsgItem } from '../interfaces/public-api';

export type DashboardSourceNote = NonNullable<Note['note']>;

export interface DashboardWidget {
  id: string;
  kind: 'chart' | 'text' | 'heading' | 'divider';
  title: string;
  paragraphId?: string;
  outputIndex?: number;
  config?: ParagraphConfigResult;
  width: number;
  height: number;
  heightMode?: 'auto' | 'fixed';
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  text?: string;
  tab: string;
}

export interface DashboardDefinition {
  version: 1;
  title: string;
  sourceNoteId: string;
  widgets: DashboardWidget[];
  tabs: string[];
}

export interface DashboardSummary {
  id: string;
  path: string;
  name: string;
  sourceNoteId: string;
}

export type DashboardNote = DashboardSourceNote & {
  config: NoteConfig & { documentType?: 'dashboard'; dashboard?: DashboardDefinition };
};

export interface DashboardOutput {
  paragraphId: string;
  outputIndex: number;
  title: string;
  result: ParagraphIResultsMsgItem;
  config: ParagraphConfigResult;
}

export interface DashboardResultReference {
  paragraphId: string;
  outputIndex: number;
}

export type DashboardLayoutKind = Exclude<DashboardWidget['kind'], 'chart'>;

export type DashboardWidgetProperties = Pick<
  Partial<DashboardWidget>,
  'text' | 'textAlign' | 'verticalAlign' | 'heightMode'
>;
