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

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Spin } from 'antd';
import { ReactErrorBoundary } from '@/components';
import { ZeppelinThemeProvider } from '@/theme';
import type { DashboardNote, DashboardReactProps, DashboardSourceNote } from '@zeppelin/sdk';
import { DashboardListPage } from './dashboard/ui/list/DashboardListPage';
import { DashboardPage } from './dashboard/ui/DashboardPage';
import { dashboardRequestError } from './dashboard/lib/dashboardErrors';
import { useDashboardTheme } from './dashboard/ui/theme';
import * as styles from './Dashboard.css';

export type { DashboardReactProps } from '@zeppelin/sdk';

const RouteError = ({ message, host, retry }: { message: string; host: DashboardReactProps; retry: () => void }) => (
  <div className={styles.requestState} role="alert">
    <h2>{message}</h2>
    <div className={styles.requestActions}>
      <Button onClick={() => host.onNavigate({ kind: 'list', edit: false, q: host.route.q })}>Dashboards</Button>
      <Button onClick={retry}>Retry</Button>
    </div>
  </div>
);

const DashboardCreate = ({ host }: { host: DashboardReactProps }) => {
  const { onCreate, onNavigate, onTitleChange, route } = host;
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef<{ attempt: number; promise: Promise<string>; completed: boolean } | undefined>(undefined);

  useEffect(() => onTitleChange('Creating dashboard'), [onTitleChange]);
  useEffect(() => {
    let current = true;
    setError('');
    if (!requestRef.current || requestRef.current.attempt !== attempt) {
      requestRef.current = {
        attempt,
        promise: route.sourceNoteId
          ? Promise.resolve().then(() => onCreate(route.sourceNoteId!))
          : Promise.reject(new Error('Choose a source notebook to create a dashboard.')),
        completed: false
      };
    }
    const request = requestRef.current;
    void request.promise
      .then(id => {
        if (current && !request.completed) {
          request.completed = true;
          onNavigate({ kind: 'document', id, edit: true, q: route.q }, true);
        }
      })
      .catch(reason => {
        if (current) setError(dashboardRequestError(reason, 'Unable to create dashboard.'));
      });
    return () => {
      current = false;
    };
  }, [attempt, onCreate, onNavigate, route.sourceNoteId, route.q]);
  return error ? (
    <RouteError message={error} host={host} retry={() => setAttempt(value => value + 1)} />
  ) : (
    <div className={styles.requestState} role="status">
      <Spin />
      <span>Creating dashboard…</span>
    </div>
  );
};

const DashboardDocument = ({ host }: { host: DashboardReactProps }) => {
  const { onLoad, onLoadSource, route } = host;
  const [note, setNote] = useState<DashboardNote>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [source, setSource] = useState<{ note?: DashboardSourceNote; loadedAt?: Date; error?: string }>({});
  const documentRequest = useRef<{ attempt: number; promise: Promise<DashboardNote> } | undefined>(undefined);
  const sourceRequest = useRef({ sequence: 0 }).current;
  const initialSourceId = useRef<string | undefined>(undefined);
  const mounted = useRef(false);
  const sourceId = note?.config.dashboard?.sourceNoteId;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      initialSourceId.current = undefined;
      sourceRequest.sequence++;
    };
  }, [sourceRequest]);

  useEffect(() => {
    let current = true;
    setError('');
    if (!documentRequest.current || documentRequest.current.attempt !== attempt) {
      documentRequest.current = {
        attempt,
        promise: Promise.resolve().then(() => {
          if (!route.id) throw new Error('Dashboard ID is required.');
          return onLoad(route.id);
        })
      };
    }
    void documentRequest.current.promise
      .then(loaded => {
        if (current) {
          if (!loaded.config.dashboard) throw new Error('This notebook is not a dashboard.');
          setNote(loaded);
        }
      })
      .catch(reason => {
        if (current) setError(dashboardRequestError(reason, 'Unable to load dashboard.'));
      });
    return () => {
      current = false;
    };
  }, [attempt, onLoad, route.id]);

  const reloadSource = useCallback(async () => {
    if (!sourceId) return;
    const request = ++sourceRequest.sequence;
    setSource(previous => (previous.error ? {} : previous));
    try {
      const loaded = await onLoadSource(sourceId);
      if (mounted.current && sourceRequest.sequence === request) setSource({ note: loaded, loadedAt: new Date() });
    } catch (reason) {
      if (mounted.current && sourceRequest.sequence === request) {
        setSource({ error: dashboardRequestError(reason, 'Unable to load source notebook.') });
      }
    }
  }, [onLoadSource, sourceId, sourceRequest]);

  useEffect(() => {
    if (!sourceId || initialSourceId.current === sourceId) return;
    initialSourceId.current = sourceId;
    void reloadSource();
  }, [reloadSource, sourceId]);

  const sourceChanged = useCallback(
    (updated: DashboardSourceNote | undefined, message?: string) => {
      sourceRequest.sequence++;
      setSource({ note: updated, loadedAt: updated ? new Date() : undefined, error: message });
    },
    [sourceRequest]
  );

  if (error) {
    return <RouteError message={error} host={host} retry={() => setAttempt(value => value + 1)} />;
  }
  if (!note) {
    return (
      <div className={styles.requestState} role="status">
        <Spin />
        <span>Loading dashboard…</span>
      </div>
    );
  }
  return (
    <DashboardPage
      key={note.id}
      note={note}
      source={source.note}
      sourceLoadedAt={source.loadedAt}
      sourceError={source.error}
      route={host.route}
      host={host}
      onSourceChange={sourceChanged}
      onReloadSource={reloadSource}
    />
  );
};

export const Dashboard = (host: DashboardReactProps) => {
  const themeStyle = useDashboardTheme();
  return (
    <div className={styles.root} style={themeStyle}>
      {host.route.kind === 'list' ? (
        <DashboardListPage host={host} />
      ) : host.route.kind === 'create' ? (
        <DashboardCreate key={`create:${host.route.sourceNoteId}`} host={host} />
      ) : (
        <DashboardDocument key={`document:${host.route.id}`} host={host} />
      )}
    </div>
  );
};

export interface DashboardMountHandle {
  update: (props: DashboardReactProps) => void;
  unmount: () => void;
}

export const mount = (element: HTMLElement, initialProps: DashboardReactProps): DashboardMountHandle => {
  if (!element) {
    throw new Error('Mount element is required');
  }
  const root = createRoot(element);
  const renderWith = (props: DashboardReactProps) =>
    root.render(
      <ReactErrorBoundary onError={props.onError}>
        <ZeppelinThemeProvider>
          <Dashboard {...props} />
        </ZeppelinThemeProvider>
      </ReactErrorBoundary>
    );
  renderWith(initialProps);
  return { update: renderWith, unmount: () => root.unmount() };
};
