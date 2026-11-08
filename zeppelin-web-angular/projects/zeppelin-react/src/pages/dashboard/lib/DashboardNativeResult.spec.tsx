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

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetType, GraphConfig, type DashboardNativeResultProps } from '@zeppelin/sdk';
import { DashboardNativeResult } from './DashboardNativeResult';

afterEach(cleanup);

describe('dashboard native result ownership', () => {
  it('preserves native table state across unchanged data and dimension updates, replacing it for another result type', () => {
    const destroy = vi.fn();
    const update = vi.fn();
    const mount = vi.fn((element: HTMLElement, props: DashboardNativeResultProps) => {
      expect(element.childNodes).toHaveLength(0);
      const native = document.createElement('div');
      native.textContent = props.result.data;
      native.dataset.filter = 'native filter';
      element.appendChild(native);
      return {
        update,
        destroy: () => {
          destroy(element.isConnected);
          native.remove();
        }
      };
    });
    const initial: DashboardNativeResultProps = {
      id: 'dashboard-card',
      result: { type: DatasetType.TABLE, data: 'a\n1' },
      config: { graph: new GraphConfig() },
      currentCol: 6,
      height: 284,
      published: true,
      isPending: false
    };
    const view = render(<DashboardNativeResult mountResult={mount} presentation={initial} />);
    const native = view.container.querySelector('[data-filter]');
    view.rerender(<DashboardNativeResult mountResult={mount} presentation={structuredClone(initial)} />);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    view.rerender(
      <DashboardNativeResult mountResult={mount} presentation={{ ...initial, currentCol: 8, height: 420 }} />
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('[data-filter]')).toBe(native);
    view.rerender(
      <DashboardNativeResult
        mountResult={mount}
        presentation={{ ...initial, result: { type: DatasetType.TEXT, data: 'Text output' } }}
      />
    );
    expect(destroy).toHaveBeenCalledWith(true);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(view.container.querySelector('[data-filter]')).not.toBe(native);
    view.unmount();
    expect(destroy).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenNthCalledWith(2, true);
  });

  it('never lends document configuration or source output objects to the native renderer', () => {
    const config = { graph: new GraphConfig() };
    const result = { type: DatasetType.TABLE, data: 'a\n1' };
    const mutate = (props: DashboardNativeResultProps) => {
      props.config.graph.mode = 'pieChart';
      props.result.data = 'native mutation';
    };
    const mount = (_element: HTMLElement, props: DashboardNativeResultProps) => {
      mutate(props);
      return { update: mutate, destroy: vi.fn() };
    };
    const initial: DashboardNativeResultProps = {
      id: 'dashboard-card',
      result,
      config,
      currentCol: 6,
      height: 284,
      published: true,
      isPending: false
    };
    const view = render(<DashboardNativeResult mountResult={mount} presentation={initial} />);
    expect(config.graph.mode).toBe('table');
    expect(result.data).toBe('a\n1');
    view.rerender(<DashboardNativeResult mountResult={mount} presentation={{ ...initial, height: 440 }} />);
    expect(config.graph.mode).toBe('table');
    expect(result.data).toBe('a\n1');
  });
});
