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

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useDashboardDocument } from '../../model/DashboardDocumentProvider';
import { useDashboardSource } from '../../model/DashboardSourceProvider';
import { DashboardDocumentActions } from './DashboardDocumentActions';
import { DashboardTitleField } from './DashboardTitleField';
import * as styles from './DashboardHeader.css';

type DashboardHeaderProps = {
  tab: string;
  editing: boolean;
  disabled: boolean;
  refreshing: boolean;
  onBack: () => void;
  onEdit: () => void;
  onReload: () => void;
  onExitEdit: (reason: 'saved' | 'discarded') => void;
  onInvalidWidget: (id: string) => void;
};

export const DashboardHeader = ({
  tab,
  editing,
  disabled,
  refreshing,
  onBack,
  onEdit,
  onReload,
  onExitEdit,
  onInvalidWidget
}: DashboardHeaderProps) => {
  const { id, path, definition } = useDashboardDocument();
  const { source, sourceHref, loadedAt, error } = useDashboardSource();
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState('');
  const clipboardRequest = useRef(0);
  const folder = path.substring(0, path.lastIndexOf('/')) || '/';

  useLayoutEffect(() => {
    clipboardRequest.current += 1;
    setCopied(false);
    setShareError('');

    return () => {
      clipboardRequest.current += 1;
    };
  }, [id, tab]);

  const copyLink = async () => {
    const request = ++clipboardRequest.current;
    const url = new URL(window.location.href);
    url.hash = `/dashboard/${encodeURIComponent(id)}?tab=${encodeURIComponent(tab)}`;
    setCopied(false);
    setShareError('');

    try {
      await navigator.clipboard.writeText(url.href);
      if (request === clipboardRequest.current) setCopied(true);
    } catch {
      if (request === clipboardRequest.current) {
        setShareError('Unable to copy the link. Copy the address from your browser.');
      }
    }
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Back to dashboards" onClick={onBack} />

          <div className={styles.documentHeading}>
            <div className={styles.context}>
              <span className={styles.folder}>{folder}</span>
              <span className={styles.documentType}>Dashboard</span>
            </div>
            {editing ? (
              <DashboardTitleField disabled={disabled} />
            ) : (
              <h1 className={styles.title}>{definition.title}</h1>
            )}

            <div className={styles.metadata}>
              {source ? (
                <a className={styles.sourceLink} href={sourceHref} target="_blank" rel="noopener noreferrer">
                  {source.name}
                </a>
              ) : (
                <span>Source notebook</span>
              )}
              {loadedAt ? (
                <span title={`Saved notebook results loaded at ${loadedAt.toLocaleString()}`}>
                  Loaded {loadedAt.toLocaleTimeString()}
                </span>
              ) : (
                <span>{error ? 'Source unavailable' : source ? '' : 'Loading saved results…'}</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          {editing ? (
            <DashboardDocumentActions disabled={disabled} onExitEdit={onExitEdit} onInvalidWidget={onInvalidWidget} />
          ) : (
            <>
              <Button onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</Button>
              <Button type="primary" disabled={disabled} onClick={onEdit}>
                Edit dashboard
              </Button>
            </>
          )}
          <Button
            icon={<ReloadOutlined spin={refreshing} />}
            aria-label="Reload saved results"
            title="Reload saved notebook results without running paragraphs"
            disabled={disabled || refreshing}
            onClick={onReload}
          >
            {refreshing ? 'Reloading…' : undefined}
          </Button>
        </div>
      </header>

      {shareError && (
        <div className={styles.shareError} role="alert">
          {shareError}
        </div>
      )}
    </>
  );
};
