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

import type {
  DashboardDefinition,
  DashboardNote,
  DashboardSourceNote,
  DashboardSummary,
  DashboardWidget
} from './dashboard/types';
import type { NotesInfoItem, ParagraphConfigResult, ParagraphIResultsMsgItem } from './interfaces/public-api';

export interface DashboardRoute {
  kind: 'list' | 'create' | 'document';
  id?: string;
  sourceNoteId?: string;
  edit: boolean;
  tab?: string;
  q?: string;
}

export interface DashboardNativeResultProps {
  id: string;
  result: ParagraphIResultsMsgItem;
  config: ParagraphConfigResult;
  height: number;
  currentCol: number;
  isPending: boolean;
  published: boolean;
  onConfigChange?: (config: ParagraphConfigResult) => void;
}

export interface DashboardNativeResultHandle {
  update: (props: DashboardNativeResultProps) => void;
  destroy: () => void;
}

export interface DashboardSettingsRequest {
  dashboardId: string;
  widget: DashboardWidget;
  source: DashboardSourceNote;
}

export type DashboardSettingsResult =
  { kind: 'apply'; widget: DashboardWidget } | { kind: 'replace'; widget: DashboardWidget } | undefined;

export interface DashboardInputsRequest {
  widget: DashboardWidget;
  source: DashboardSourceNote;
  onSourceChange: (source: DashboardSourceNote) => void;
  onBusyChange: (busy: boolean) => void;
}

/** Flat callbacks use the existing ReactMountDirective NgZone boundary. */
export interface DashboardReactProps extends Record<string, unknown> {
  route: DashboardRoute;
  onList: () => Promise<DashboardSummary[]>;
  onListSources: () => Promise<NotesInfoItem[]>;
  onLoad: (id: string) => Promise<DashboardNote>;
  onLoadSource: (id: string) => Promise<DashboardSourceNote>;
  onCreate: (sourceNoteId: string) => Promise<string>;
  onSave: (id: string, definition: DashboardDefinition) => Promise<string>;
  onDelete: (id: string) => Promise<void>;
  onNavigate: (route: DashboardRoute, replace?: boolean) => void;
  onSourceHref: (sourceNoteId: string) => string;
  onMountResult: (element: HTMLElement, props: DashboardNativeResultProps) => DashboardNativeResultHandle;
  onOpenSettings: (request: DashboardSettingsRequest) => Promise<DashboardSettingsResult>;
  onOpenInputs: (request: DashboardInputsRequest) => Promise<DashboardSourceNote | undefined>;
  onRegisterCanLeave: (guard: () => boolean) => () => void;
  onTitleChange: (title: string) => void;
  onError?: (error: unknown) => void;
}
