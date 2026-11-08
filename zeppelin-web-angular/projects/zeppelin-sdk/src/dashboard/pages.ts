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

import type { DashboardDefinition } from './types';

export const setDashboardTitle = (definition: DashboardDefinition, title: string): DashboardDefinition =>
  title === definition.title ? definition : { ...definition, title };

export const addDashboardTab = (definition: DashboardDefinition, name: string): DashboardDefinition =>
  !name || definition.tabs.includes(name) ? definition : { ...definition, tabs: [...definition.tabs, name] };

export const renameDashboardTab = (definition: DashboardDefinition, tab: string, name: string): DashboardDefinition => {
  if (!name || definition.tabs.includes(name) || !definition.tabs.includes(tab)) return definition;

  return {
    ...definition,
    tabs: definition.tabs.map(item => (item === tab ? name : item)),
    widgets: definition.widgets.map(widget => (widget.tab === tab ? { ...widget, tab: name } : widget))
  };
};

export const removeDashboardTab = (definition: DashboardDefinition, tab: string): DashboardDefinition => {
  if (definition.tabs.length < 2 || !definition.tabs.includes(tab)) return definition;

  return {
    ...definition,
    tabs: definition.tabs.filter(item => item !== tab),
    widgets: definition.widgets.filter(widget => widget.tab !== tab)
  };
};
