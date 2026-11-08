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

import type { DashboardLayoutKind, DashboardResultReference } from '@zeppelin/sdk';

export const dashboardDragType = 'application/zeppelin-dashboard';

export type DashboardDragPayload =
  | { type: 'result'; reference: DashboardResultReference }
  | { type: 'layout'; kind: DashboardLayoutKind }
  | { type: 'widget'; id: string };

export const encodeDashboardDrag = (payload: DashboardDragPayload): string => JSON.stringify(payload);

export const decodeDashboardDrag = (value: string): DashboardDragPayload | undefined => {
  try {
    const payload: unknown = JSON.parse(value);
    if (!payload || typeof payload !== 'object' || !('type' in payload)) return;

    if (payload.type === 'widget' && 'id' in payload && typeof payload.id === 'string' && payload.id) {
      return { type: 'widget', id: payload.id };
    }

    if (
      payload.type === 'layout' &&
      'kind' in payload &&
      (payload.kind === 'heading' || payload.kind === 'text' || payload.kind === 'divider')
    ) {
      return { type: 'layout', kind: payload.kind };
    }

    if (payload.type !== 'result' || !('reference' in payload)) return;
    const reference = payload.reference;
    if (
      !reference ||
      typeof reference !== 'object' ||
      !('paragraphId' in reference) ||
      typeof reference.paragraphId !== 'string' ||
      !reference.paragraphId ||
      !('outputIndex' in reference) ||
      typeof reference.outputIndex !== 'number' ||
      !Number.isInteger(reference.outputIndex) ||
      reference.outputIndex < 0
    )
      return;

    return { type: 'result', reference: { paragraphId: reference.paragraphId, outputIndex: reference.outputIndex } };
  } catch {
    return undefined;
  }
};
