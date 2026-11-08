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

import type { DashboardDefinition, DashboardSourceNote } from './types';
import { dashboardSourceOutputs } from './results';
import { createDashboardOutputWidget, dashboardWidgetsEqual } from './widgets';

export const createDashboardDefinition = (
  source: DashboardSourceNote,
  existingPaths?: readonly string[]
): DashboardDefinition => {
  const tab = 'Overview';
  const folder = source.path.substring(0, source.path.lastIndexOf('/'));
  const base = `${source.name} dashboard`;
  let title = base;
  let suffix = 2;
  while (existingPaths?.includes(`${folder}/${title}`)) title = `${base} ${suffix++}`;

  const paragraphs = new Map(source.paragraphs.map(paragraph => [paragraph.id, paragraph]));
  return {
    version: 1,
    title,
    sourceNoteId: source.id,
    tabs: [tab],
    widgets: dashboardSourceOutputs(source).map(output =>
      createDashboardOutputWidget(output, tab, paragraphs.get(output.paragraphId)?.config.colWidth ?? 6)
    )
  };
};

export const dashboardDefinitionsEqual = (left: DashboardDefinition, right: DashboardDefinition): boolean => {
  if (left === right) return true;
  return (
    left.version === right.version &&
    left.sourceNoteId === right.sourceNoteId &&
    left.title === right.title &&
    left.tabs.length === right.tabs.length &&
    left.tabs.every((tab, index) => tab === right.tabs[index]) &&
    left.widgets.length === right.widgets.length &&
    left.widgets.every((widget, index) => dashboardWidgetsEqual(widget, right.widgets[index]))
  );
};

export const dashboardValidationError = (
  definition: DashboardDefinition
): { kind: 'title' } | { kind: 'content'; widgetId: string } | undefined => {
  if (!definition.title.trim()) return { kind: 'title' };
  const empty = definition.widgets.find(
    widget => (widget.kind === 'text' || widget.kind === 'heading') && !widget.text?.trim()
  );
  return empty ? { kind: 'content', widgetId: empty.id } : undefined;
};
