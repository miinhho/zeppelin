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

import { act } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DatasetType,
  GraphConfig,
  type DashboardDefinition,
  type DashboardInputsRequest,
  type DashboardNativeResultProps,
  type DashboardNote,
  type DashboardReactProps,
  type DashboardSettingsRequest,
  type DashboardSettingsResult,
  type DashboardSourceNote
} from '@zeppelin/sdk';
import { DashboardPage, type DashboardPageProps } from './DashboardPage';
import { dashboardDragType, encodeDashboardDrag } from '../lib/dashboardDrag';

const deferred = <T,>() => Promise.withResolvers<T>();

const setup = (overrides: Partial<DashboardPageProps> = {}) => {
  const source = {
    id: 'source',
    name: 'Sales',
    path: '/Reports/Sales',
    noteParams: {},
    paragraphs: ['revenue', 'orders'].map(id => ({
      id,
      title: id,
      config: {},
      settings: { forms: {}, params: {} },
      status: 'FINISHED',
      results: { code: 'SUCCESS', msg: [{ type: DatasetType.TABLE, data: 'Month\tValue\nJan\t10' }] }
    }))
  } as unknown as DashboardSourceNote;
  const definition: DashboardDefinition = {
    version: 1,
    title: 'Sales dashboard',
    sourceNoteId: 'source',
    tabs: ['Overview', 'Details'],
    widgets: [
      {
        id: 'card',
        kind: 'chart',
        title: 'Revenue',
        paragraphId: 'revenue',
        outputIndex: 0,
        width: 6,
        height: 360,
        tab: 'Overview',
        config: { graph: new GraphConfig() }
      },
      { id: 'text', kind: 'text', title: 'Notes', text: 'Details text', width: 12, height: 180, tab: 'Details' }
    ]
  };
  const note = {
    ...source,
    id: 'dashboard',
    name: definition.title,
    path: '/Reports/Sales dashboard',
    config: { dashboard: definition }
  } as DashboardNote;
  let guard!: () => boolean;
  const unregister = vi.fn();
  const updates = vi.fn();
  const destroys = vi.fn();
  const host = {
    route: { kind: 'document', id: 'dashboard', edit: true, tab: 'Overview', q: 'Sales' },
    onNavigate: vi.fn(),
    onSourceHref: (id: string) => `#/notebook/${id}`,
    onTitleChange: vi.fn(),
    onSave: vi.fn(async () => 'dashboard'),
    onOpenSettings: vi.fn(async () => undefined),
    onOpenInputs: vi.fn(async () => undefined),
    onRegisterCanLeave: vi.fn((value: () => boolean) => {
      guard = value;
      return unregister;
    }),
    onMountResult: vi.fn((element: HTMLElement, presentation: DashboardNativeResultProps) => {
      const child = document.createElement('div');
      child.dataset.native = presentation.id;
      child.textContent = presentation.result.data;
      element.appendChild(child);
      return {
        update: (next: DashboardNativeResultProps) => {
          updates(next);
          child.textContent = next.result.data;
        },
        destroy: () => {
          destroys(element.isConnected);
          child.remove();
        }
      };
    })
  } as unknown as DashboardReactProps;
  let props: DashboardPageProps = {
    note,
    source,
    route: host.route,
    host,
    onSourceChange: vi.fn(),
    onReloadSource: vi.fn(async () => {}),
    ...overrides
  };
  const view = render(<DashboardPage {...props} />);
  const update = (changes: Partial<DashboardPageProps>) => {
    props = { ...props, ...changes };
    view.rerender(<DashboardPage {...props} />);
  };
  return {
    ...view,
    source,
    definition,
    host,
    updates,
    destroys,
    unregister,
    update,
    get props() {
      return props;
    },
    canLeave: () => guard()
  };
};

const openCardAction = (name: string) => {
  fireEvent.click(screen.getByLabelText('Actions for Revenue'));
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name }));
};

beforeEach(() => vi.stubGlobal('requestAnimationFrame', () => 1));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('React dashboard editor', () => {
  it('keeps one native table across selection, title edits, unchanged source reload and keyboard resize', () => {
    const view = setup();
    const native = view.container.querySelector('[data-native]')! as HTMLElement;
    native.dataset.sort = 'descending';
    const mounts = vi.mocked(view.host.onMountResult);
    expect(mounts).toHaveBeenCalledTimes(1);
    fireEvent.click(view.container.querySelector('[data-widget-id="card"]')!);
    fireEvent.change(screen.getByLabelText('Dashboard title'), { target: { value: 'Draft title' } });
    view.update({ source: structuredClone(view.source) });
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(view.updates).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getAllByLabelText('Resize width')[0], { key: 'ArrowRight' });
    expect(view.updates).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('[data-native]')).toBe(native);
    expect(native.dataset.sort).toBe('descending');
    expect(native.parentElement!.closest('article')!.style.gridColumn).toBe('span 7');
    view.unmount();
    expect(view.destroys).toHaveBeenCalledWith(true);
  });

  it('coalesces title typing and preserves the draft across page and query updates', () => {
    const view = setup();
    fireEvent.change(screen.getByLabelText('Dashboard title'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Dashboard title'), { target: { value: 'New title' } });
    fireEvent.blur(screen.getByLabelText('Dashboard title'));
    view.update({ route: { ...view.props.route, tab: 'Details', q: 'Changed search' } });
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'New title');
    expect(screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'Sales dashboard');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'New title');
  });

  it('restores removed cards with the latest source results rather than history snapshots', () => {
    const view = setup();
    openCardAction('Remove from dashboard');
    expect(view.container.querySelector('[data-widget-id="card"]')).toBeNull();
    const latest = structuredClone(view.source);
    latest.noteParams = { region: 'West' };
    latest.paragraphs[0].results!.msg![0].data = 'Month\tValue\nJan\t99';
    view.update({ source: latest });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(view.container.querySelector('[data-native]')!.textContent).toContain('99');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
  });

  it('preserves the native settings draft through replacement and picker cancel until Apply', async () => {
    const view = setup();
    const first = deferred<DashboardSettingsResult>();
    const second = deferred<DashboardSettingsResult>();
    const third = deferred<DashboardSettingsResult>();
    vi.mocked(view.host.onOpenSettings)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
      .mockImplementationOnce(() => third.promise);
    openCardAction('Display settings');
    const originalSource = structuredClone(view.source);
    const draft = structuredClone(vi.mocked(view.host.onOpenSettings).mock.calls[0][0].widget);
    draft.title = 'Edited settings title';
    draft.config!.graph.mode = 'pieChart';
    await act(async () => first.resolve({ kind: 'replace', widget: draft }));
    expect(screen.getByText('Replace Edited settings title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const cancelRequest = vi.mocked(view.host.onOpenSettings).mock.calls[1][0];
    expect(cancelRequest.widget.title).toBe('Edited settings title');
    expect(cancelRequest.widget.config!.graph.mode).toBe('pieChart');
    expect(
      within(view.container.querySelector('[data-widget-id="card"]')!).getByRole('heading', { level: 2 }).textContent
    ).toBe('Revenue');
    await act(async () => second.resolve({ kind: 'replace', widget: cancelRequest.widget }));
    fireEvent.click(screen.getByRole('button', { name: 'Use orders' }));
    const replaced = vi.mocked(view.host.onOpenSettings).mock.calls[2][0].widget;
    expect(replaced.paragraphId).toBe('orders');
    expect(
      within(view.container.querySelector('[data-widget-id="card"]')!).getByRole('heading', { level: 2 }).textContent
    ).toBe('Revenue');
    await act(async () => third.resolve({ kind: 'apply', widget: replaced }));
    expect(
      within(view.container.querySelector('[data-widget-id="card"]')!).getByRole('heading', { level: 2 }).textContent
    ).toBe('orders');
    expect(view.source).toEqual(originalSource);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      within(view.container.querySelector('[data-widget-id="card"]')!).getByRole('heading', { level: 2 }).textContent
    ).toBe('Revenue');
  });

  it('leaves replacement mode when source access is lost before picker cancellation', async () => {
    const view = setup();
    const pending = deferred<DashboardSettingsResult>();
    vi.mocked(view.host.onOpenSettings).mockReturnValue(pending.promise);
    openCardAction('Display settings');
    const widget = structuredClone(vi.mocked(view.host.onOpenSettings).mock.calls[0][0].widget);
    widget.title = 'Native draft';
    await act(async () => pending.resolve({ kind: 'replace', widget }));
    view.update({ source: undefined, sourceError: 'Source access denied' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(view.host.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(view.canLeave()).toBe(true);
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveProperty('disabled', true);
    expect(
      within(view.container.querySelector('[data-widget-id="card"]')!).getByRole('heading', { level: 2 }).textContent
    ).toBe('Revenue');
  });

  it('does not change the document when native settings are cancelled, including mutated native clones', async () => {
    const view = setup();
    vi.mocked(view.host.onOpenSettings).mockImplementation(async (request: DashboardSettingsRequest) => {
      request.widget.title = 'Cancelled title';
      request.widget.config!.graph.mode = 'pieChart';
      request.source.paragraphs[0].title = 'Native mutation';
      return undefined;
    });
    await act(async () => openCardAction('Display settings'));
    expect(
      within(view.container.querySelector('[data-widget-id="card"]')!).getByRole('heading', { level: 2 }).textContent
    ).toBe('Revenue');
    expect(view.source.paragraphs[0].title).toBe('revenue');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    expect(view.host.onSave).not.toHaveBeenCalled();
  });

  it('keeps a failed save retryable and saves corrected empty text without source execution', async () => {
    const view = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter text');
    expect(view.host.onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Revenue summary' } });
    vi.mocked(view.host.onSave).mockRejectedValueOnce({ status: 403, error: { message: 'Dashboard is read-only' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('Dashboard is read-only');
    expect(screen.getByLabelText('Heading')).toHaveProperty('value', 'Revenue summary');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(view.host.onSave).toHaveBeenCalledTimes(2);
    expect(view.host.onNavigate).toHaveBeenLastCalledWith(expect.objectContaining({ edit: false }));
    expect(view.host.onOpenInputs).not.toHaveBeenCalled();
    expect(view.props.onReloadSource).not.toHaveBeenCalled();
  });

  it('forwards live source changes and committed busy state without replacing a dirty document', async () => {
    const view = setup();
    const pending = deferred<DashboardSourceNote | undefined>();
    let inputs!: DashboardInputsRequest;
    vi.mocked(view.host.onOpenInputs).mockImplementation(request => {
      inputs = request;
      return pending.promise;
    });
    fireEvent.change(screen.getByLabelText('Dashboard title'), { target: { value: 'Unsaved title' } });
    openCardAction('Inputs & run');
    const latest = structuredClone(view.source);
    latest.noteParams = { region: 'West' };
    act(() => {
      inputs.onBusyChange(true);
      inputs.onSourceChange(latest);
    });
    expect(view.canLeave()).toBe(false);
    expect(view.props.onSourceChange).toHaveBeenCalledWith(latest);
    view.update({ source: latest });
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'Unsaved title');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    await act(async () => {
      inputs.onBusyChange(false);
      pending.resolve(latest);
    });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
    expect(view.host.onSave).not.toHaveBeenCalled();
  });

  it('guards dirty state without using confirm for beforeunload, then discards on accepted leave', () => {
    const view = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.change(screen.getByLabelText('Dashboard title'), { target: { value: 'Unsaved title' } });
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(view.canLeave()).toBe(false);
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'Unsaved title');
    confirm.mockReturnValue(true);
    act(() => {
      expect(view.canLeave()).toBe(true);
    });
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'Sales dashboard');
    expect(view.canLeave()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(view.unregister).toHaveBeenCalledTimes(vi.mocked(view.host.onRegisterCanLeave).mock.calls.length);
  });

  it('blocks departure and beforeunload during the committed saving state', async () => {
    const view = setup();
    const saving = deferred<string>();
    vi.mocked(view.host.onSave).mockReturnValue(saving.promise);
    fireEvent.change(screen.getByLabelText('Dashboard title'), { target: { value: 'Unsaved title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(view.canLeave()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await act(async () => saving.resolve('dashboard'));
    expect(view.canLeave()).toBe(true);
  });

  it('distinguishes initial source loading from an unavailable saved result without resetting the draft', () => {
    const view = setup({ source: undefined });
    expect(view.container.querySelector('[data-native]')).toBeNull();
    expect(screen.queryByText('Source result is unavailable')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(screen.getByLabelText('Dashboard title'), { target: { value: 'Draft during load' } });
    view.update({ source: view.source });
    expect(view.container.querySelector('[data-native]')).toBeTruthy();
    expect(screen.queryByText('Loading saved results…')).toBeNull();
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'Draft during load');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'Sales dashboard');
  });

  it('clears stale source renderers on unavailable source, retaining layout and undo history', () => {
    const view = setup();
    fireEvent.change(screen.getByLabelText('Dashboard title'), { target: { value: 'Unsaved title' } });
    view.update({ source: undefined, sourceError: 'Source access denied by owner' });
    expect(view.container.querySelector('[data-native]')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Source access denied by owner');
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'Unsaved title');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Dashboard title')).toHaveProperty('value', 'Sales dashboard');
  });

  it('cancels pointer resize without dirty state or phantom undo and commits one whole drag', () => {
    const view = setup();
    const card = view.container.querySelector('[data-widget-id="card"]')! as HTMLElement;
    const handle = within(card).getByRole('button', { name: 'Resize height' });
    handle.setPointerCapture = vi.fn();
    handle.hasPointerCapture = vi.fn(() => true);
    handle.releasePointerCapture = vi.fn();
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ height: 200 } as DOMRect);
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        pointerId = 1;
      }
    );
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 120 });
    expect(card.style.height).toBe('320px');
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(card.style.height).toBe('');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 40 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 80 });
    expect(view.canLeave()).toBe(false);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 0, clientY: 100 });
    expect(card.style.height).toBe('300px');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(card.style.height).toBe('');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveProperty('disabled', true);
  });

  it('filters unused results, adds a palette drop in position, and undoes drag reordering once', () => {
    const view = setup();
    fireEvent.click(screen.getByLabelText('Not on this page'));
    expect(screen.queryByRole('button', { name: 'Add revenue' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Search results'), { target: { value: 'orders' } });
    expect(screen.getByRole('button', { name: 'Add orders' })).toBeTruthy();
    const card = view.container.querySelector('[data-widget-id="card"]')!;
    const dataTransfer = {
      types: [dashboardDragType],
      getData: () => encodeDashboardDrag({ type: 'result', reference: { paragraphId: 'orders', outputIndex: 0 } })
    };
    fireEvent.drop(card, { dataTransfer });
    const order = () =>
      Array.from(view.container.querySelectorAll<HTMLElement>('[data-widget-id]'))
        .filter(item => item.style.display !== 'none')
        .map(item => item.querySelector('h2')!.textContent);
    expect(order()).toEqual(['orders', 'Revenue']);
    const newCard = view.container.querySelector('[data-widget-id]')!;
    fireEvent.drop(newCard, {
      dataTransfer: { ...dataTransfer, getData: () => encodeDashboardDrag({ type: 'widget', id: 'card' }) }
    });
    expect(order()).toEqual(['Revenue', 'orders']);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(order()).toEqual(['orders', 'Revenue']);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(order()).toEqual(['Revenue']);
  });

  it('adds, renames and deletes pages with their widgets while retaining undoable document state', () => {
    const view = setup();
    fireEvent.click(screen.getByLabelText('Add tab'));
    fireEvent.change(screen.getByLabelText('New tab name'), { target: { value: 'Summary' } });
    fireEvent.click(screen.getByLabelText('Confirm new tab'));
    expect(screen.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Divider' }));
    fireEvent.click(screen.getByLabelText('Rename tab'));
    fireEvent.change(screen.getByLabelText('Tab name'), { target: { value: 'Executive summary' } });
    fireEvent.keyDown(screen.getByLabelText('Tab name'), { key: 'Enter' });
    expect(screen.getByRole('tab', { name: 'Executive summary' })).toBeTruthy();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByLabelText('Delete tab'));
    expect(screen.queryByRole('tab', { name: 'Executive summary' })).toBeNull();
    expect(view.container.querySelector('hr')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('tab', { name: 'Executive summary' })).toBeTruthy();
    expect(view.container.querySelector('hr')).not.toBeNull();
  });

  it('guards a clean document during explicit source execution without confirmation', async () => {
    const view = setup();
    const pending = deferred<DashboardSourceNote | undefined>();
    let inputs!: DashboardInputsRequest;
    vi.mocked(view.host.onOpenInputs).mockImplementation(request => {
      inputs = request;
      return pending.promise;
    });
    const confirm = vi.spyOn(window, 'confirm');
    openCardAction('Inputs & run');
    act(() => inputs.onBusyChange(true));
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(view.canLeave()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => pending.resolve(undefined));
    expect(view.canLeave()).toBe(true);
  });

  it('does not let a late settings response mutate an unmounted document', async () => {
    const view = setup();
    const pending = deferred<DashboardSettingsResult>();
    vi.mocked(view.host.onOpenSettings).mockReturnValue(pending.promise);
    openCardAction('Display settings');
    const widget = structuredClone(vi.mocked(view.host.onOpenSettings).mock.calls[0][0].widget);
    widget.title = 'Too late';
    view.unmount();
    await act(async () => pending.resolve({ kind: 'apply', widget }));
    expect(view.definition.widgets[0].title).toBe('Revenue');
    expect(view.host.onSave).not.toHaveBeenCalled();
    expect(view.host.onNavigate).not.toHaveBeenCalled();
  });

  it('ignores pending modal and input callbacks after unmount', async () => {
    const view = setup();
    const pending = deferred<DashboardSourceNote | undefined>();
    let inputs!: DashboardInputsRequest;
    vi.mocked(view.host.onOpenInputs).mockImplementation(request => {
      inputs = request;
      return pending.promise;
    });
    openCardAction('Inputs & run');
    view.unmount();
    await act(async () => {
      inputs.onSourceChange(view.source);
      inputs.onBusyChange(true);
      pending.resolve(view.source);
    });
    expect(view.props.onSourceChange).not.toHaveBeenCalled();
  });
});
