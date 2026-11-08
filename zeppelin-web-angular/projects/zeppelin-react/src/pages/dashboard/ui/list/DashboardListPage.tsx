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
import { DashboardOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Spin } from 'antd';
import type { DashboardReactProps, DashboardSummary } from '@zeppelin/sdk';
import { CreateDashboardDialog } from './CreateDashboardDialog';
import { DeleteDashboardDialog } from './DeleteDashboardDialog';
import { DashboardListCard } from './DashboardListCard';
import { dashboardRequestError } from '../../lib/dashboardErrors';
import * as styles from './DashboardListPage.css';

type ListModal = { kind: 'source' } | { kind: 'delete'; target: DashboardSummary };

export const DashboardListPage = ({ host }: { host: DashboardReactProps }) => {
  const { onList, onTitleChange } = host;
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [query, setQuery] = useState(host.route.q || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState<ListModal>();

  useEffect(() => onTitleChange('Dashboards'), [onTitleChange]);

  useEffect(() => {
    setQuery(host.route.q || '');
  }, [host.route.q]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');

    void Promise.resolve()
      .then(() => onList())
      .then(items => {
        if (current) setDashboards([...items].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(reason => {
        if (current) setError(dashboardRequestError(reason, 'Unable to load dashboards.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [onList, refresh]);

  const searchDashboards = (value: string) => {
    setQuery(value);
    host.onNavigate({ kind: 'list', edit: false, q: value || undefined }, true);
  };

  const changeQuery = (event: ChangeEvent<HTMLInputElement>) => {
    searchDashboards(event.target.value);
  };

  const clearSearch = () => {
    searchDashboards('');
  };

  const refreshDashboards = () => {
    setRefresh(value => value + 1);
  };

  const openDashboard = (id: string) => {
    host.onNavigate({ kind: 'document', id, edit: false, q: query || undefined });
  };

  const editDashboard = (id: string) => {
    host.onNavigate({ kind: 'document', id, edit: true, q: query || undefined });
  };

  const openCreateDialog = () => {
    setModal({ kind: 'source' });
  };

  const chooseSource = (id: string) => {
    host.onNavigate({ kind: 'create', sourceNoteId: id, edit: false, q: query || undefined });
  };

  const openDeleteDialog = (target: DashboardSummary) => {
    setModal({ kind: 'delete', target });
  };

  const closeDialog = () => {
    setModal(undefined);
  };

  const dashboardDeleted = (id: string) => {
    setDashboards(items => items.filter(item => item.id !== id));
    setModal(undefined);
  };

  const searchTerm = query.trim().toLocaleLowerCase();
  const filtered = dashboards.filter(item => `${item.name} ${item.path}`.toLocaleLowerCase().includes(searchTerm));
  const deleting = modal?.kind === 'delete';

  return (
    <section className={styles.listPage}>
      <header className={styles.listHeader}>
        <div className={styles.listHeading}>
          <DashboardOutlined />
          <h1 className={styles.pageTitle}>Dashboards</h1>
          <span className={styles.dashboardCount}>{dashboards.length}</span>
        </div>
        <div className={styles.listActions}>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            aria-label="Refresh dashboards"
            disabled={loading || deleting}
            onClick={refreshDashboards}
          />
          <Button type="primary" icon={<PlusOutlined />} disabled={deleting} onClick={openCreateDialog}>
            Dashboard
          </Button>
        </div>
      </header>

      <div className={styles.searchToolbar}>
        <Input
          type="search"
          prefix={<SearchOutlined />}
          placeholder="Search dashboards"
          aria-label="Search dashboards"
          value={query}
          onChange={changeQuery}
        />
      </div>

      {loading ? (
        <div className={styles.requestState} role="status">
          <Spin />
          <span>Loading dashboards…</span>
        </div>
      ) : error ? (
        <div className={styles.requestState} role="alert">
          <h2 className={styles.requestTitle}>{error}</h2>
          <Button onClick={refreshDashboards}>Retry</Button>
        </div>
      ) : filtered.length ? (
        <div className={styles.dashboardCards}>
          {filtered.map(dashboard => (
            <DashboardListCard
              key={dashboard.id}
              dashboard={dashboard}
              sourceHref={host.onSourceHref(dashboard.sourceNoteId)}
              onOpen={openDashboard}
              onEdit={editDashboard}
              onDelete={openDeleteDialog}
            />
          ))}
        </div>
      ) : (
        <div className={styles.requestState}>
          <DashboardOutlined />
          <h2 className={styles.requestTitle}>{query ? 'No matching dashboards' : 'No dashboards yet'}</h2>
          {query ? (
            <Button onClick={clearSearch}>Clear search</Button>
          ) : (
            <Button type="primary" onClick={openCreateDialog}>
              Create dashboard
            </Button>
          )}
        </div>
      )}

      {modal?.kind === 'source' && (
        <CreateDashboardDialog onListSources={host.onListSources} onCancel={closeDialog} onChoose={chooseSource} />
      )}
      {modal?.kind === 'delete' && (
        <DeleteDashboardDialog
          key={modal.target.id}
          target={modal.target}
          onDelete={host.onDelete}
          onCancel={closeDialog}
          onDeleted={dashboardDeleted}
        />
      )}
    </section>
  );
};
