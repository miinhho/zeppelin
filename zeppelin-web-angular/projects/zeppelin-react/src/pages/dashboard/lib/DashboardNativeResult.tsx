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

import { useLayoutEffect, useRef } from 'react';
import type { DashboardNativeResultHandle, DashboardNativeResultProps, DashboardReactProps } from '@zeppelin/sdk';
import * as styles from './DashboardNativeResult.css';

export interface DashboardNativeResultAdapterProps {
  mountResult: DashboardReactProps['onMountResult'];
  presentation: DashboardNativeResultProps;
}

/** React never owns children of this div. Layout cleanup precedes its DOM removal. */
export const DashboardNativeResult = ({ mountResult, presentation }: DashboardNativeResultAdapterProps) => {
  const element = useRef<HTMLDivElement>(null);
  const handle = useRef<DashboardNativeResultHandle | undefined>(undefined);
  const previous = useRef<DashboardNativeResultProps | undefined>(undefined);

  useLayoutEffect(() => {
    const last = previous.current;
    if (
      last &&
      last.id === presentation.id &&
      last.result.type === presentation.result.type &&
      last.result.data === presentation.result.data &&
      last.height === presentation.height &&
      last.currentCol === presentation.currentCol &&
      last.isPending === presentation.isPending &&
      last.published === presentation.published &&
      last.onConfigChange === presentation.onConfigChange &&
      (last.config === presentation.config || JSON.stringify(last.config) === JSON.stringify(presentation.config))
    )
      return;
    const isolated = {
      ...presentation,
      result: structuredClone(presentation.result),
      config: structuredClone(presentation.config)
    };
    if (!last || last.id !== presentation.id || last.result.type !== presentation.result.type) {
      handle.current?.destroy();
      handle.current = undefined;
      handle.current = mountResult(element.current!, isolated);
    } else {
      handle.current?.update(isolated);
    }
    previous.current = presentation;
  });

  useLayoutEffect(
    () => () => {
      const mounted = handle.current;
      handle.current = undefined;
      previous.current = undefined;
      mounted?.destroy();
    },
    []
  );

  return <div className={styles.nativeResultHost} ref={element} />;
};
