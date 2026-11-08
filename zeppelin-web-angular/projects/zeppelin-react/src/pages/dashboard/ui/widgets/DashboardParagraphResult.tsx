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

import { memo, type CSSProperties } from 'react';
import { dashboardResultKey, type DashboardWidget } from '@zeppelin/sdk';
import { useDashboardSource } from '../../model/DashboardSourceProvider';
import { DashboardNativeResult } from '../../lib/DashboardNativeResult';
import * as styles from './DashboardParagraphResult.css';

interface DashboardParagraphResultProps {
  widget: DashboardWidget;
  width: number;
  height: number;
}

export const DashboardParagraphResult = memo(({ widget, width, height }: DashboardParagraphResultProps) => {
  const { outputByKey, paragraphById, sourceHref, error, loading, mountResult } = useDashboardSource();
  const paragraph = widget.paragraphId ? paragraphById.get(widget.paragraphId) : undefined;
  const output = widget.paragraphId
    ? outputByKey.get(dashboardResultKey({ paragraphId: widget.paragraphId, outputIndex: widget.outputIndex ?? 0 }))
    : undefined;
  const config = widget.config ?? output?.config;
  const failed = paragraph?.status === 'ERROR' || paragraph?.results?.code === 'ERROR';
  const message = failed
    ? 'Source execution failed'
    : error || (loading ? 'Loading saved results…' : 'Source result is unavailable');
  const details = paragraph?.errorMessage || (failed ? output?.result.data : undefined);
  const resultTime = paragraph?.dateFinished || paragraph?.dateUpdated;
  const alignment = { '--zeppelin-table-text-align': widget.textAlign || 'start' } as CSSProperties;

  return (
    <>
      <div className={styles.resultContent} style={alignment}>
        {output && config && !failed ? (
          <DashboardNativeResult
            mountResult={mountResult}
            presentation={{
              id: `dashboard-${widget.id}`,
              result: output.result,
              config,
              currentCol: width,
              height,
              published: true,
              isPending: paragraph?.status === 'RUNNING' || paragraph?.status === 'PENDING'
            }}
          />
        ) : (
          <div className={styles.resultUnavailable} role="status">
            <span>{message}</span>
            {details ? (
              <details>
                <summary>Error details</summary>
                <pre className={styles.errorDetails}>{details}</pre>
              </details>
            ) : null}
            <a className={styles.sourceLink} href={sourceHref} target="_blank" rel="noopener noreferrer">
              Open source notebook
            </a>
          </div>
        )}
      </div>
      <div className={styles.resultStatus}>
        <span>{paragraph?.status}</span>
        {resultTime ? <time title="Source paragraph result time">{String(resultTime)}</time> : null}
      </div>
    </>
  );
});

DashboardParagraphResult.displayName = 'DashboardParagraphResult';
