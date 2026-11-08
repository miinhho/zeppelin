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

import { useEffect, useState, type ChangeEvent } from 'react';
import { FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Spin } from 'antd';
import type { DashboardReactProps, NotesInfoItem } from '@zeppelin/sdk';
import { dashboardRequestError } from '../../lib/dashboardErrors';
import { useDashboardTheme } from '../theme';
import * as styles from './CreateDashboardDialog.css';

type CreateDashboardDialogProps = {
  onListSources: DashboardReactProps['onListSources'];
  onChoose: (id: string) => void;
  onCancel: () => void;
};

const folderPath = (path: string): string => {
  const separator = path.lastIndexOf('/');
  return separator > 0 ? path.slice(0, separator) : '/';
};

export const CreateDashboardDialog = ({ onListSources, onChoose, onCancel }: CreateDashboardDialogProps) => {
  const themeStyle = useDashboardTheme();
  const [sources, setSources] = useState<NotesInfoItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setSources([]);
    setSelectedSource(undefined);

    void Promise.resolve()
      .then(() => onListSources())
      .then(items => {
        if (current) setSources(items);
      })
      .catch(reason => {
        if (current) setError(dashboardRequestError(reason, 'Unable to load source notebooks.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [onListSources, attempt]);

  const changeQuery = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const clearSearch = () => {
    setQuery('');
  };

  const retrySources = () => {
    setAttempt(value => value + 1);
  };

  const confirmSource = () => {
    if (selectedSource && !loading && !error) onChoose(selectedSource);
  };

  const searchTerm = query.trim().toLocaleLowerCase();
  const filtered = sources.filter(item => item.path.toLocaleLowerCase().includes(searchTerm));

  return (
    <Modal
      title="Choose a source notebook"
      open
      okText="Create dashboard"
      okButtonProps={{ disabled: !selectedSource || loading || !!error }}
      onCancel={onCancel}
      onOk={confirmSource}
    >
      <div className={styles.notebookPicker} style={themeStyle}>
        <Input
          type="search"
          prefix={<SearchOutlined />}
          placeholder="Search notebooks or folders"
          aria-label="Search source notebooks"
          value={query}
          onChange={changeQuery}
        />

        {loading ? (
          <div className={styles.requestState} role="status">
            <Spin />
            <span>Loading notebooks…</span>
          </div>
        ) : error ? (
          <div className={styles.requestState} role="alert">
            <span>{error}</span>
            <Button onClick={retrySources}>Retry</Button>
          </div>
        ) : filtered.length ? (
          <div className={styles.sourceOptions} aria-label="Source notebooks">
            {filtered.map(source => (
              <button
                type="button"
                key={source.id}
                className={styles.sourceChoice}
                data-selected={selectedSource === source.id || undefined}
                aria-pressed={selectedSource === source.id}
                onClick={() => setSelectedSource(source.id)}
              >
                <FileTextOutlined />
                <span className={styles.sourceName}>
                  <strong>{source.path.split('/').pop() || source.id}</strong>
                  <span className={styles.sourceFolder}>{folderPath(source.path)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.requestState}>
            <span>{query ? 'No matching notebooks' : 'No source notebooks available'}</span>
            {query && <Button onClick={clearSearch}>Clear search</Button>}
          </div>
        )}
      </div>
    </Modal>
  );
};
