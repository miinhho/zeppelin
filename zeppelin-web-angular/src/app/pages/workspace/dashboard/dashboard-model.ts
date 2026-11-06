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

import {
  DatasetType,
  GraphConfig,
  Note,
  NoteConfig,
  ParagraphConfigResult,
  ParagraphIResultsMsgItem
} from '@zeppelin/sdk';

export type SourceNote = NonNullable<Note['note']>;

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

export type DashboardNote = SourceNote & {
  config: NoteConfig & { documentType?: 'dashboard'; dashboard?: DashboardDefinition };
};

export interface DashboardOutput {
  paragraphId: string;
  outputIndex: number;
  title: string;
  result: ParagraphIResultsMsgItem;
  config: ParagraphConfigResult;
}

export function sourceOutputs(source: SourceNote): DashboardOutput[] {
  const outputs: DashboardOutput[] = [];
  source.paragraphs.forEach((paragraph, paragraphIndex) => {
    (paragraph.results?.msg ?? []).forEach((result, outputIndex) => {
      if (result.type !== DatasetType.TABLE && result.type !== DatasetType.TEXT) {
        return;
      }
      const saved = paragraph.config.results?.[outputIndex]?.graph;
      outputs.push({
        paragraphId: paragraph.id,
        outputIndex,
        title: paragraph.title || `Paragraph ${paragraphIndex + 1}`,
        result,
        config: { graph: structuredClone({ ...new GraphConfig(), ...saved }) }
      });
    });
  });
  return outputs;
}

export function createDashboard(source: SourceNote, existingPaths?: readonly string[]): DashboardDefinition {
  const tab = 'Overview';
  const folder = source.path.substring(0, source.path.lastIndexOf('/'));
  const base = `${source.name} dashboard`;
  let title = base;
  let suffix = 2;
  while (existingPaths?.includes(`${folder}/${title}`)) {
    title = `${base} ${suffix++}`;
  }
  return {
    version: 1,
    title,
    sourceNoteId: source.id,
    widgets: sourceOutputs(source).map(output => {
      const paragraph = source.paragraphs.find(item => item.id === output.paragraphId)!;
      return {
        id: crypto.randomUUID(),
        kind: 'chart',
        title: output.title,
        paragraphId: output.paragraphId,
        outputIndex: output.outputIndex,
        config: output.config,
        width: Math.max(1, Math.min(12, paragraph.config.colWidth ?? 6)),
        height: Math.max(240, Math.min(1000, output.config.graph.height + 64)),
        tab
      };
    }),
    tabs: [tab]
  };
}
