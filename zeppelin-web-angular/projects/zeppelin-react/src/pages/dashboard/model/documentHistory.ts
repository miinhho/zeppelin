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

import { dashboardDefinitionsEqual, type DashboardDefinition } from '@zeppelin/sdk';

export interface DashboardHistory {
  current: DashboardDefinition;
  saved: DashboardDefinition;
  past: DashboardDefinition[];
  future: DashboardDefinition[];
  group?: string;
}

export const createDocumentHistory = (definition: DashboardDefinition): DashboardHistory => ({
  current: definition,
  saved: definition,
  past: [],
  future: []
});

export const changeDocumentHistory = (
  history: DashboardHistory,
  update: (definition: DashboardDefinition) => DashboardDefinition,
  group?: string
): DashboardHistory => {
  const next = update(history.current);
  if (next === history.current || dashboardDefinitionsEqual(next, history.current)) return history;
  return {
    ...history,
    current: dashboardDefinitionsEqual(next, history.saved) ? history.saved : next,
    past: group && group === history.group ? history.past : [...history.past.slice(-49), history.current],
    future: [],
    group
  };
};

export const undoDocumentHistory = (history: DashboardHistory): DashboardHistory => {
  const previous = history.past[history.past.length - 1];
  return previous
    ? {
        ...history,
        current: previous,
        past: history.past.slice(0, -1),
        future: [...history.future, history.current],
        group: undefined
      }
    : history;
};

export const redoDocumentHistory = (history: DashboardHistory): DashboardHistory => {
  const next = history.future[history.future.length - 1];
  return next
    ? {
        ...history,
        current: next,
        past: [...history.past.slice(-49), history.current],
        future: history.future.slice(0, -1),
        group: undefined
      }
    : history;
};
