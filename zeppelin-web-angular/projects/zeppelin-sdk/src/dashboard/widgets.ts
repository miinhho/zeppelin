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
  DashboardLayoutKind,
  DashboardOutput,
  DashboardResultReference,
  DashboardSourceNote,
  DashboardWidget,
  DashboardWidgetProperties
} from './types';
import { dashboardOutputConfig, dashboardParagraphOutput } from './results';

export const dashboardWidgetMinimumHeight = (widget: DashboardWidget): number => {
  if (widget.kind === 'chart') return 160;
  return widget.kind === 'divider' ? 24 : 48;
};

export const dashboardWidgetAutomaticHeight = (widget: DashboardWidget, output?: DashboardOutput): boolean => {
  if (widget.heightMode) return widget.heightMode === 'auto';
  return (
    widget.kind !== 'chart' ||
    output?.result.type === 'TEXT' ||
    (widget.config?.graph.mode ?? output?.config.graph.mode ?? 'table') === 'table'
  );
};

export const resizeDashboardWidget = (widget: DashboardWidget, width: number, height?: number): DashboardWidget => {
  const columns = Math.max(1, Math.min(12, Math.round(Number(width) || 1)));
  if (height === undefined) return columns === widget.width ? widget : { ...widget, width: columns };

  const minimum = dashboardWidgetMinimumHeight(widget);
  const pixels = Math.max(minimum, Math.min(1600, Math.round(Number(height) || minimum)));
  if (columns === widget.width && pixels === widget.height && widget.heightMode === 'fixed') return widget;

  return { ...widget, width: columns, height: pixels, heightMode: 'fixed' };
};

export const createDashboardOutputWidget = (
  output: Pick<DashboardOutput, 'paragraphId' | 'outputIndex' | 'title' | 'config'>,
  tab: string,
  width = 6
): DashboardWidget => ({
  id: crypto.randomUUID(),
  kind: 'chart',
  title: output.title,
  paragraphId: output.paragraphId,
  outputIndex: output.outputIndex,
  config: output.config,
  width: Math.max(1, Math.min(12, width)),
  height: Math.max(240, Math.min(1000, output.config.graph.height + 64)),
  tab
});

const referencedOutput = (source: DashboardSourceNote, reference: DashboardResultReference) => {
  const index = source.paragraphs.findIndex(paragraph => paragraph.id === reference.paragraphId);
  if (index < 0) return undefined;

  const paragraph = source.paragraphs[index];
  const output = dashboardParagraphOutput(paragraph, index, reference.outputIndex);
  return {
    width: paragraph.config.colWidth ?? 6,
    fields: {
      paragraphId: paragraph.id,
      outputIndex: reference.outputIndex,
      title: output?.title ?? (paragraph.title || `Paragraph ${index + 1}`),
      config: output?.config ?? dashboardOutputConfig(paragraph, reference.outputIndex)
    }
  };
};

export const createDashboardResultWidget = (
  source: DashboardSourceNote,
  reference: DashboardResultReference,
  tab: string
): DashboardWidget | undefined => {
  const output = referencedOutput(source, reference);
  return output ? createDashboardOutputWidget(output.fields, tab, output.width) : undefined;
};

export const replaceDashboardWidgetResult = (
  widget: DashboardWidget,
  source: DashboardSourceNote,
  reference: DashboardResultReference
): DashboardWidget | undefined => {
  const output = referencedOutput(source, reference);
  return output ? { ...widget, ...output.fields } : undefined;
};

export const createDashboardLayoutWidget = (kind: DashboardLayoutKind, tab: string): DashboardWidget => ({
  id: crypto.randomUUID(),
  kind,
  title: '',
  text: '',
  tab,
  width: kind === 'text' ? 4 : 12,
  height: kind === 'divider' ? 24 : 64,
  heightMode: 'auto',
  textAlign: 'center',
  verticalAlign: 'center'
});

export const dashboardWidgetsEqual = (left: DashboardWidget, right: DashboardWidget): boolean => {
  if (left === right) return true;

  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.title === right.title &&
    left.paragraphId === right.paragraphId &&
    left.outputIndex === right.outputIndex &&
    left.width === right.width &&
    left.height === right.height &&
    left.heightMode === right.heightMode &&
    left.text === right.text &&
    left.textAlign === right.textAlign &&
    left.verticalAlign === right.verticalAlign &&
    left.tab === right.tab &&
    (left.config === right.config || JSON.stringify(left.config) === JSON.stringify(right.config))
  );
};

export const replaceDashboardWidget = (
  definition: DashboardDefinition,
  widget: DashboardWidget
): DashboardDefinition => {
  const index = definition.widgets.findIndex(item => item.id === widget.id);
  if (index < 0 || dashboardWidgetsEqual(definition.widgets[index], widget)) return definition;

  const widgets = definition.widgets.slice();
  widgets[index] = widget;
  return { ...definition, widgets };
};

export const setDashboardWidgetProperties = (
  definition: DashboardDefinition,
  id: string,
  properties: DashboardWidgetProperties
): DashboardDefinition => {
  const widget = definition.widgets.find(item => item.id === id);
  return widget ? replaceDashboardWidget(definition, { ...widget, ...properties }) : definition;
};

export const setDashboardWidgetSize = (
  definition: DashboardDefinition,
  id: string,
  width: number,
  height?: number
): DashboardDefinition => {
  const widget = definition.widgets.find(item => item.id === id);
  return widget ? replaceDashboardWidget(definition, resizeDashboardWidget(widget, width, height)) : definition;
};

export const insertDashboardWidget = (
  definition: DashboardDefinition,
  widget: DashboardWidget,
  beforeId?: string
): DashboardDefinition => {
  const index = definition.widgets.findIndex(item => item.id === beforeId);
  const at = index < 0 ? definition.widgets.length : index;

  return { ...definition, widgets: [...definition.widgets.slice(0, at), widget, ...definition.widgets.slice(at)] };
};

export const removeDashboardWidget = (definition: DashboardDefinition, id: string): DashboardDefinition =>
  definition.widgets.some(widget => widget.id === id)
    ? { ...definition, widgets: definition.widgets.filter(widget => widget.id !== id) }
    : definition;

export const moveDashboardWidget = (
  definition: DashboardDefinition,
  tab: string,
  id: string,
  beforeId?: string
): DashboardDefinition => {
  const page = definition.widgets.filter(widget => widget.tab === tab);
  const from = page.findIndex(widget => widget.id === id);
  if (from < 0 || id === beforeId) return definition;

  const [widget] = page.splice(from, 1);
  const to = page.findIndex(item => item.id === beforeId);
  page.splice(to < 0 ? page.length : to, 0, widget);

  let index = 0;
  const widgets = definition.widgets.map(item => (item.tab === tab ? page[index++] : item));
  return widgets.every((item, position) => item === definition.widgets[position])
    ? definition
    : { ...definition, widgets };
};
