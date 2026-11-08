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

import { act, useState } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardNote, DashboardReactProps, DashboardSourceNote, DashboardSummary } from '@zeppelin/sdk';
import type { DashboardPageProps } from './dashboard/ui/DashboardPage';
import { mount, type DashboardMountHandle } from './Dashboard';

// Keep the root's async lifetimes under test independently of canvas/native rendering.
// The stateful editor seam makes a mistaken remount observable as a lost draft.
vi.mock('./dashboard/ui/DashboardPage', () => ({
  DashboardPage: ({ note, source, sourceError, onReloadSource, onSourceChange }: DashboardPageProps) => {
    const [draft, setDraft] = useState(note.config.dashboard!.title);
    return (
      <section aria-label="Dashboard editor">
        <h1>{note.config.dashboard!.title}</h1>
        <input aria-label="Editor draft" value={draft} onChange={event => setDraft(event.target.value)} />
        <p>{source?.name || 'No source results'}</p>
        {sourceError && <p role="alert">{sourceError}</p>}
        <button onClick={() => void onReloadSource()}>Reload saved results</button>
        <button onClick={() => onSourceChange(source ? { ...source, name: 'Updated source results' } : undefined)}>
          Receive source update
        </button>
      </section>
    );
  }
}));

const source = (id: string): DashboardSourceNote => ({
  id,
  name: `Source ${id}`,
  path: `/Reports/Source ${id}`,
  paragraphs: [],
  defaultInterpreterGroup: 'spark',
  noteParams: {},
  noteForms: {},
  angularObjects: {},
  info: {},
  config: {
    releaseresource: false,
    isZeppelinNotebookCronEnable: false,
    looknfeel: 'default',
    personalizedMode: 'false'
  }
});

const note = (id: string): DashboardNote => ({
  ...source(id),
  name: `Dashboard ${id}`,
  path: `/Reports/Dashboard ${id}`,
  config: {
    ...source(id).config,
    documentType: 'dashboard',
    dashboard: {
      version: 1,
      title: `Dashboard ${id}`,
      sourceNoteId: `source-${id}`,
      tabs: ['Overview'],
      widgets: []
    }
  }
});

const summary: DashboardSummary = { id: 'a', name: 'Sales', path: '/Reports/Sales', sourceNoteId: 'source-a' };

const props = (overrides: Partial<DashboardReactProps> = {}): DashboardReactProps => ({
  route: { kind: 'list', edit: false },
  onList: vi.fn().mockResolvedValue([summary]),
  onListSources: vi.fn().mockResolvedValue([{ id: 'source-a', path: '/Reports/Source notebook' }]),
  onLoad: vi.fn().mockImplementation((id: string) => Promise.resolve(note(id))),
  onLoadSource: vi.fn().mockImplementation((id: string) => Promise.resolve(source(id))),
  onCreate: vi.fn().mockResolvedValue('created'),
  onSave: vi.fn().mockResolvedValue('saved'),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onNavigate: vi.fn(),
  onSourceHref: id => `#/notebook/${id}`,
  onMountResult: vi.fn().mockReturnValue({ update: vi.fn(), destroy: vi.fn() }),
  onOpenSettings: vi.fn().mockResolvedValue(undefined),
  onOpenInputs: vi.fn().mockResolvedValue(undefined),
  onRegisterCanLeave: vi.fn().mockReturnValue(() => undefined),
  onTitleChange: vi.fn(),
  ...overrides
});

describe('Dashboard route and list lifetimes', () => {
  let element: HTMLDivElement | undefined;
  let handle: DashboardMountHandle | undefined;

  const start = async (host: DashboardReactProps) => {
    element = document.createElement('div');
    document.body.appendChild(element);
    await act(async () => {
      handle = mount(element!, host);
    });
  };

  const update = async (host: DashboardReactProps) => {
    await act(async () => handle!.update(host));
  };

  afterEach(() => {
    act(() => handle?.unmount());
    element?.remove();
    element = undefined;
    handle = undefined;
    vi.restoreAllMocks();
  });

  it('creates once for a source route while query changes and uses the latest query for edit navigation', async () => {
    const creation = Promise.withResolvers<string>();
    const host = props({
      route: { kind: 'create', sourceNoteId: 'source-a', edit: false, q: 'Sales' },
      onCreate: vi.fn().mockReturnValue(creation.promise)
    });
    await start(host);
    await update({ ...host, route: { ...host.route, q: 'Reports', tab: 'Overview', edit: true } });
    expect(screen.getByRole('status').textContent).toContain('Creating dashboard');
    await act(async () => creation.resolve('created-a'));
    expect(host.onCreate).toHaveBeenCalledTimes(1);
    expect(host.onNavigate).toHaveBeenCalledWith({ kind: 'document', id: 'created-a', edit: true, q: 'Reports' }, true);
  });

  it('ignores stale create completions after switching source routes', async () => {
    const first = Promise.withResolvers<string>();
    const second = Promise.withResolvers<string>();
    const host = props({
      route: { kind: 'create', sourceNoteId: 'a', edit: false },
      onCreate: vi.fn().mockImplementation((id: string) => (id === 'a' ? first.promise : second.promise))
    });
    await start(host);
    await update({ ...host, route: { kind: 'create', sourceNoteId: 'b', edit: false, q: 'retained' } });
    await act(async () => first.resolve('obsolete'));
    expect(host.onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Creating dashboard');
    await act(async () => second.resolve('current'));
    expect(host.onNavigate).toHaveBeenCalledWith({ kind: 'document', id: 'current', edit: true, q: 'retained' }, true);
  });

  it('keeps one create attempt across callback updates and only retries after a failure', async () => {
    const creation = Promise.withResolvers<string>();
    const onCreate = vi.fn().mockReturnValue(creation.promise);
    const host = props({ route: { kind: 'create', sourceNoteId: 'source-a', edit: false }, onCreate });
    await start(host);
    const retryCreate = vi.fn().mockResolvedValue('retry-created');
    const navigate = vi.fn();
    const updated = {
      ...host,
      route: { ...host.route, q: 'Current search', tab: 'Details', edit: true },
      onCreate: retryCreate,
      onNavigate: navigate
    };
    await update(updated);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(retryCreate).not.toHaveBeenCalled();
    await act(async () => creation.reject(new Error('Creation failed')));
    expect(screen.getByRole('alert').textContent).toContain('Creation failed');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })));
    expect(retryCreate).toHaveBeenCalledExactlyOnceWith('source-a');
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      { kind: 'document', id: 'retry-created', edit: true, q: 'Current search' },
      true
    );
    expect(host.onNavigate).not.toHaveBeenCalled();
  });

  it('does not let a late document response replace the active dashboard', async () => {
    const first = Promise.withResolvers<DashboardNote>();
    const host = props({
      route: { kind: 'document', id: 'a', edit: false },
      onLoad: vi.fn().mockImplementation((id: string) => (id === 'a' ? first.promise : Promise.resolve(note(id))))
    });
    await start(host);
    await update({ ...host, route: { kind: 'document', id: 'b', edit: false } });
    expect(screen.getByRole('heading', { name: 'Dashboard b' })).toBeTruthy();
    await act(async () => first.resolve(note('a')));
    expect(screen.queryByRole('heading', { name: 'Dashboard a' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Dashboard b' })).toBeTruthy();
    expect(host.onLoadSource).not.toHaveBeenCalledWith('source-a');
  });

  it('clears the previous source on a route change and ignores its late source response', async () => {
    const firstSource = Promise.withResolvers<DashboardSourceNote>();
    const host = props({
      route: { kind: 'document', id: 'a', edit: false },
      onLoadSource: vi
        .fn()
        .mockImplementation((id: string) =>
          id === 'source-a'
            ? firstSource.promise
            : Promise.reject({ message: 'Request failed', error: { message: 'Source b is forbidden' } })
        )
    });
    await start(host);
    expect(screen.getByRole('heading', { name: 'Dashboard a' })).toBeTruthy();
    await update({ ...host, route: { kind: 'document', id: 'b', edit: false } });
    expect(screen.getByRole('heading', { name: 'Dashboard b' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Source b is forbidden');
    await act(async () => firstSource.resolve(source('source-a')));
    expect(screen.queryByText('Source source-a')).toBeNull();
    expect(screen.getByText('No source results')).toBeTruthy();
  });

  it('keeps the editor draft across edit/tab/query changes and source updates, clearing results on failed reload', async () => {
    const host = props({ route: { kind: 'document', id: 'a', edit: true } });
    await start(host);
    fireEvent.change(screen.getByLabelText('Editor draft'), { target: { value: 'Unsaved dashboard' } });
    await update({
      ...host,
      route: { ...host.route, edit: false, tab: 'Details', q: 'Sales' },
      onLoad: vi.fn().mockRejectedValue(new Error('Unexpected document reload'))
    });
    fireEvent.click(screen.getByRole('button', { name: 'Receive source update' }));
    expect(screen.getByText('Updated source results')).toBeTruthy();
    const failedReload = vi.fn().mockRejectedValue(new Error('Source access revoked'));
    await update({ ...host, route: { ...host.route, tab: 'Details' }, onLoadSource: failedReload });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload saved results' })));
    expect((screen.getByLabelText('Editor draft') as HTMLInputElement).value).toBe('Unsaved dashboard');
    expect(screen.getByText('No source results')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Source access revoked');
    expect(host.onLoad).toHaveBeenCalledTimes(1);
    expect(host.onLoadSource).toHaveBeenCalledTimes(1);
    expect(failedReload).toHaveBeenCalledTimes(1);
  });

  it('does not remount a draft when the initial source finishes after route and callback updates', async () => {
    const pending = Promise.withResolvers<DashboardSourceNote>();
    const host = props({
      route: { kind: 'document', id: 'a', edit: true },
      onLoadSource: vi.fn().mockReturnValue(pending.promise)
    });
    await start(host);
    fireEvent.change(screen.getByLabelText('Editor draft'), { target: { value: 'Draft before source' } });
    const replacementLoad = vi.fn().mockResolvedValue(note('unexpected'));
    const replacementSource = vi.fn().mockResolvedValue(source('unexpected'));
    await update({
      ...host,
      route: { ...host.route, q: 'Sales', tab: 'Details', edit: false },
      onLoad: replacementLoad,
      onLoadSource: replacementSource
    });
    await act(async () => pending.resolve(source('initial')));
    expect((screen.getByLabelText('Editor draft') as HTMLInputElement).value).toBe('Draft before source');
    expect(screen.getByText('Source initial')).toBeTruthy();
    expect(replacementLoad).not.toHaveBeenCalled();
    expect(replacementSource).not.toHaveBeenCalled();
    expect(host.onLoad).toHaveBeenCalledTimes(1);
    expect(host.onLoadSource).toHaveBeenCalledTimes(1);
  });

  it('does not let an older source reload overwrite a native input update', async () => {
    const pending = Promise.withResolvers<DashboardSourceNote>();
    const onLoadSource = vi.fn().mockResolvedValueOnce(source('initial')).mockReturnValueOnce(pending.promise);
    await start(props({ route: { kind: 'document', id: 'a', edit: true }, onLoadSource }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved results' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receive source update' }));
    await act(async () => pending.resolve(source('outdated')));
    expect(screen.getByText('Updated source results')).toBeTruthy();
    expect(screen.queryByText('Source outdated')).toBeNull();
  });

  it('preserves the list query through dashboard selection and source creation without refetching on search', async () => {
    const host = props();
    await start(host);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search dashboards' }), { target: { value: 'Sales' } });
    await update({ ...host, route: { kind: 'list', edit: false, q: 'Sales' } });
    fireEvent.click(screen.getByRole('button', { name: /Sales.*Reports/ }));
    expect(host.onNavigate).toHaveBeenLastCalledWith({ kind: 'document', id: 'a', edit: false, q: 'Sales' });
    expect(host.onList).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Dashboard$/ }));
    const picker = await screen.findByRole('dialog', { name: 'Choose a source notebook' });
    const option = await within(picker).findByRole('button', { name: /Source notebook.*Reports/ });
    fireEvent.click(option);
    expect(option.getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(within(picker).getByRole('searchbox'), { target: { value: 'missing' } });
    expect(within(picker).getByText('No matching notebooks')).toBeTruthy();
    fireEvent.change(within(picker).getByRole('searchbox'), { target: { value: '' } });
    expect(
      within(picker)
        .getByRole('button', { name: /Source notebook.*Reports/ })
        .getAttribute('aria-pressed')
    ).toBe('true');
    fireEvent.click(within(picker).getByRole('button', { name: 'Create dashboard' }));
    expect(host.onNavigate).toHaveBeenLastCalledWith({
      kind: 'create',
      sourceNoteId: 'source-a',
      edit: false,
      q: 'Sales'
    });
  });

  it('shows local search immediately while synchronizing external list navigation', async () => {
    const host = props();
    await start(host);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search dashboards' }), { target: { value: 'missing' } });
    expect((screen.getByRole('searchbox', { name: 'Search dashboards' }) as HTMLInputElement).value).toBe('missing');
    expect(screen.getByText('No matching dashboards')).toBeTruthy();
    await update({ ...host, onNavigate: vi.fn() });
    expect((screen.getByRole('searchbox', { name: 'Search dashboards' }) as HTMLInputElement).value).toBe('missing');
    await update({ ...host, route: { ...host.route, q: 'Sales' } });
    expect((screen.getByRole('searchbox', { name: 'Search dashboards' }) as HTMLInputElement).value).toBe('Sales');
    expect(screen.getByRole('heading', { name: 'Sales' })).toBeTruthy();
    expect(host.onList).toHaveBeenCalledTimes(1);
  });

  it('gives a reopened source picker a fresh request and ignores the previous response', async () => {
    const stale = Promise.withResolvers<{ id: string; path: string }[]>();
    const current = Promise.withResolvers<{ id: string; path: string }[]>();
    const host = props({
      onListSources: vi.fn().mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise)
    });
    await start(host);
    expect(host.onListSources).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Dashboard$/ }));
    let picker = await screen.findByRole('dialog', { name: 'Choose a source notebook' });
    fireEvent.change(within(picker).getByRole('searchbox'), { target: { value: 'discarded query' } });
    fireEvent.click(within(picker).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Choose a source notebook' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Dashboard$/ }));
    picker = await screen.findByRole('dialog', { name: 'Choose a source notebook' });
    expect((within(picker).getByRole('searchbox') as HTMLInputElement).value).toBe('');
    await act(async () => current.resolve([{ id: 'fresh', path: '/Reports/Current notebook' }]));
    expect(within(picker).getByRole('button', { name: /Current notebook.*Reports/ })).toBeTruthy();
    await act(async () => stale.resolve([{ id: 'stale', path: '/Reports/Stale notebook' }]));
    expect(within(picker).queryByRole('button', { name: /Stale notebook/ })).toBeNull();
    expect(within(picker).getByRole('button', { name: /Current notebook.*Reports/ })).toBeTruthy();
    expect(host.onListSources).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed source picker open and retries its own request', async () => {
    const host = props({
      onListSources: vi
        .fn()
        .mockRejectedValueOnce(new Error('Source notebooks unavailable'))
        .mockResolvedValueOnce([{ id: 'recovered', path: '/Reports/Recovered notebook' }])
    });
    await start(host);
    fireEvent.click(screen.getByRole('button', { name: /Dashboard$/ }));
    const picker = await screen.findByRole('dialog', { name: 'Choose a source notebook' });
    expect((await within(picker).findByRole('alert')).textContent).toContain('Source notebooks unavailable');
    expect((within(picker).getByRole('button', { name: 'Create dashboard' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => fireEvent.click(within(picker).getByRole('button', { name: 'Retry' })));
    fireEvent.click(within(picker).getByRole('button', { name: /Recovered notebook.*Reports/ }));
    fireEvent.click(within(picker).getByRole('button', { name: 'Create dashboard' }));
    expect(host.onNavigate).toHaveBeenLastCalledWith({
      kind: 'create',
      sourceNoteId: 'recovered',
      edit: false,
      q: undefined
    });
  });

  it('requires confirmation, retains a failed deletion and removes the entry after retry', async () => {
    const deletion = Promise.withResolvers<void>();
    const host = props({ onDelete: vi.fn().mockReturnValueOnce(deletion.promise).mockResolvedValueOnce(undefined) });
    await start(host);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Sales' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete$/ }));
    let dialog = await screen.findByRole('dialog', { name: 'Delete dashboard' });
    expect(host.onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Sales' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Sales' }));
    const sourceLink = await screen.findByRole('link', { name: 'Source notebook' });
    expect(sourceLink.getAttribute('href')).toBe('#/notebook/source-a');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete$/ }));
    dialog = await screen.findByRole('dialog', { name: 'Delete dashboard' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await act(async () => deletion.reject(new Error('Only dashboard owners can delete this dashboard.')));
    expect(within(dialog).getByRole('alert').textContent).toContain('Only dashboard owners');
    expect(screen.getByRole('heading', { name: 'Sales' })).toBeTruthy();
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' })));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sales' })).toBeNull());
    expect(vi.mocked(host.onDelete).mock.calls).toEqual([['a'], ['a']]);
    expect(screen.getByText('No dashboards yet')).toBeTruthy();
  });

  it('ignores a pending deletion after its list and dialog unmount', async () => {
    const deletion = Promise.withResolvers<void>();
    const host = props({ onDelete: vi.fn().mockReturnValue(deletion.promise) });
    await start(host);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Sales' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete dashboard' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await update({ ...host, route: { kind: 'document', id: 'a', edit: false } });
    await update(host);
    await act(async () => deletion.resolve());
    expect(screen.getByRole('heading', { name: 'Sales' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Delete dashboard' })).toBeNull();
    expect(host.onDelete).toHaveBeenCalledExactlyOnceWith('a');
  });
});
