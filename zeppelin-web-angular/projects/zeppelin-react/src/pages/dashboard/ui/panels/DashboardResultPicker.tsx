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

import { useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { Button, Checkbox, Input, type CheckboxProps } from 'antd';
import { dashboardResultKey, type DashboardOutput, type DashboardResultReference } from '@zeppelin/sdk';
import { dashboardDragType, encodeDashboardDrag } from '../../lib/dashboardDrag';
import { useDashboardDocument } from '../../model/DashboardDocumentProvider';
import { useDashboardParagraphActions, useDashboardSource } from '../../model/DashboardSourceProvider';
import * as styles from './DashboardResultPicker.css';

const modeLabels: Record<string, string> = {
  table: 'Table',
  lineChart: 'Line chart',
  multiBarChart: 'Bar chart',
  pieChart: 'Pie chart',
  stackedAreaChart: 'Area chart',
  scatterChart: 'Scatter plot'
};

interface ResultChoiceData {
  reference: DashboardResultReference;
  title: string;
  label: string;
  failed: boolean;
  position: number;
  included: boolean;
}

interface ResultChoiceProps {
  choice: ResultChoiceData;
  replacing: boolean;
  disabled: boolean;
  onChoose: (reference: DashboardResultReference) => void;
}

const ResultChoice = ({ choice, replacing, disabled, onChoose }: ResultChoiceProps) => {
  const unavailable = disabled || choice.included;

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (unavailable || replacing) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData(dashboardDragType, encodeDashboardDrag({ type: 'result', reference: choice.reference }));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleChoose = () => onChoose(choice.reference);

  return (
    <div
      className={styles.choice}
      data-included={choice.included || undefined}
      draggable={!unavailable && !replacing}
      onDragStart={handleDragStart}
    >
      <div className={styles.description}>
        <strong className={styles.resultTitle}>{choice.title}</strong>
        <small className={styles.resultMetadata}>
          {choice.label} · Paragraph {choice.position}
        </small>
        {choice.failed && <small className={styles.executionError}>Execution failed</small>}
      </div>
      <Button
        size="small"
        className={styles.chooseButton}
        disabled={unavailable}
        aria-label={`${replacing ? 'Use' : 'Add'} ${choice.title}`}
        onClick={handleChoose}
      >
        {choice.included ? 'Added' : replacing ? 'Use' : 'Add'}
      </Button>
    </div>
  );
};

interface DashboardResultPickerProps {
  tab: string;
  disabled: boolean;
  onAdded: (id: string) => void;
}

export const DashboardResultPicker = ({ tab, disabled, onAdded }: DashboardResultPickerProps) => {
  const { definition } = useDashboardDocument();
  const { source, outputs, sourceHref, error, loading } = useDashboardSource();
  const paragraphActions = useDashboardParagraphActions();
  const [query, setQuery] = useState('');
  const [onlyUnused, setOnlyUnused] = useState(false);
  const replacement = paragraphActions.phase.kind === 'replacement' ? paragraphActions.phase.widget : undefined;
  const replacing = replacement !== undefined;

  const choices = useMemo(() => {
    const included = new Set<string>();

    for (const widget of definition.widgets) {
      if (widget.tab === tab && widget.kind === 'chart' && widget.paragraphId) {
        included.add(dashboardResultKey({ paragraphId: widget.paragraphId, outputIndex: widget.outputIndex ?? 0 }));
      }
    }

    const outputsByParagraph = new Map<string, DashboardOutput[]>();

    for (const output of outputs) {
      const paragraphOutputs = outputsByParagraph.get(output.paragraphId);

      if (paragraphOutputs) {
        paragraphOutputs.push(output);
      } else {
        outputsByParagraph.set(output.paragraphId, [output]);
      }
    }

    return (
      source?.paragraphs.flatMap((paragraph, index): ResultChoiceData[] => {
        const candidates = outputsByParagraph.get(paragraph.id) ?? [];

        return (candidates.length ? candidates : [undefined]).map(output => {
          const reference = { paragraphId: paragraph.id, outputIndex: output?.outputIndex ?? 0 };
          const resultLabel =
            output?.result.type === 'TEXT'
              ? 'Text'
              : output
                ? modeLabels[output.config.graph.mode] || 'Result'
                : 'No saved result';

          return {
            reference,
            title: paragraph.title || `Paragraph ${index + 1}`,
            label: `${resultLabel}${candidates.length > 1 && output ? ` · Output ${output.outputIndex + 1}` : ''}`,
            failed: paragraph.status === 'ERROR' || paragraph.results?.code === 'ERROR',
            position: index + 1,
            included: !replacing && included.has(dashboardResultKey(reference))
          };
        });
      }) ?? []
    );
  }, [definition.widgets, tab, source, outputs, replacing]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredChoices = useMemo(
    () =>
      choices.filter(
        choice => choice.title.toLowerCase().includes(normalizedQuery) && (replacing || !onlyUnused || !choice.included)
      ),
    [choices, normalizedQuery, onlyUnused, replacing]
  );
  const emptyMessage =
    error ||
    (loading
      ? 'Loading saved results…'
      : onlyUnused && !replacing
        ? 'All matching results are on this page'
        : 'No matching results');

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value);
  const handleUnusedChange: CheckboxProps['onChange'] = event => setOnlyUnused(event.target.checked);
  const handleCancelReplacement = () => paragraphActions.cancelReplacement();

  const handleChoose = (reference: DashboardResultReference) => {
    if (disabled) return;

    if (replacing) {
      paragraphActions.chooseReplacement(reference);
      return;
    }

    const id = paragraphActions.insertResult(reference, tab);

    if (id) onAdded(id);
  };

  return (
    <section className={styles.picker} aria-label="Saved results">
      {replacement && (
        <div className={styles.replacementHeading}>
          <strong>Replace {replacement.title || 'result'}</strong>
          <Button className={styles.cancelButton} onClick={handleCancelReplacement}>
            Cancel
          </Button>
        </div>
      )}
      <a className={styles.sourceLink} href={sourceHref} target="_blank" rel="noopener noreferrer">
        {source?.name || 'Source notebook'}
      </a>
      <Input
        type="search"
        aria-label="Search results"
        placeholder="Search results"
        value={query}
        onChange={handleQueryChange}
      />
      {!replacing && (
        <Checkbox className={styles.unusedFilter} checked={onlyUnused} onChange={handleUnusedChange}>
          Not on this page
        </Checkbox>
      )}
      {error && (
        <p className={styles.sourceError} role="alert">
          {error}
        </p>
      )}
      {paragraphActions.error && paragraphActions.error !== error && (
        <p className={styles.sourceError} role="alert">
          {paragraphActions.error}
        </p>
      )}
      <div className={styles.choices}>
        {filteredChoices.map(choice => (
          <ResultChoice
            key={dashboardResultKey(choice.reference)}
            choice={choice}
            replacing={replacing}
            disabled={disabled}
            onChoose={handleChoose}
          />
        ))}
      </div>
      {filteredChoices.length === 0 && !error && (
        <div className={styles.emptyResults} role="status">
          {emptyMessage}
        </div>
      )}
    </section>
  );
};
