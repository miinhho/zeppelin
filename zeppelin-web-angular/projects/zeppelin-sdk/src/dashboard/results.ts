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

import { DatasetType, GraphConfig } from '../interfaces/public-api';
import type { DashboardOutput, DashboardResultReference, DashboardSourceNote } from './types';

type SourceParagraph = DashboardSourceNote['paragraphs'][number];

export const dashboardResultKey = (reference: DashboardResultReference): string =>
  `${reference.paragraphId}:${reference.outputIndex}`;

export const dashboardOutputConfig = (paragraph: SourceParagraph, outputIndex: number): DashboardOutput['config'] => ({
  graph: structuredClone({ ...new GraphConfig(), ...paragraph.config.results?.[outputIndex]?.graph })
});

export const dashboardParagraphOutput = (
  paragraph: SourceParagraph,
  paragraphIndex: number,
  outputIndex: number
): DashboardOutput | undefined => {
  const result = paragraph.results?.msg?.[outputIndex];
  if (!result || (result.type !== DatasetType.TABLE && result.type !== DatasetType.TEXT)) return undefined;

  return {
    paragraphId: paragraph.id,
    outputIndex,
    title: paragraph.title || `Paragraph ${paragraphIndex + 1}`,
    result,
    config: dashboardOutputConfig(paragraph, outputIndex)
  };
};

export const dashboardSourceOutputs = (source: DashboardSourceNote): DashboardOutput[] => {
  const outputs: DashboardOutput[] = [];

  source.paragraphs.forEach((paragraph, index) => {
    paragraph.results?.msg?.forEach((_result, outputIndex) => {
      const output = dashboardParagraphOutput(paragraph, index, outputIndex);
      if (output) outputs.push(output);
    });
  });

  return outputs;
};
