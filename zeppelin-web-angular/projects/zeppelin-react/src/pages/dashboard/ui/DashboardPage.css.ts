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

import { style } from '@vanilla-extract/css';
import { vars } from './theme.css';

export const page = style({
  minHeight: 'calc(100vh - 50px)',
  background: vars.background,
  color: vars.text,
  fontFamily: vars.font,
  fontSize: 13
});
export const workspace = style({ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', alignItems: 'start' });
export const workspaceWithSettings = style({
  gridTemplateColumns: 'minmax(0,1fr) 300px',
  '@media': { '(max-width: 900px)': { gridTemplateColumns: 'minmax(0,1fr) 260px' } }
});
export const dashboardContent = style({
  minWidth: 0,
  padding: '0 24px 32px',
  '@media': { '(max-width: 800px)': { padding: '0 16px 24px' } }
});
export const settingsPanel = style({
  position: 'sticky',
  top: 0,
  minHeight: 'calc(100vh - 180px)',
  maxHeight: 'calc(100vh - 50px)',
  overflow: 'auto',
  borderLeft: `1px solid ${vars.border}`,
  background: vars.surface
});
export const panelTabs = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 12,
  borderBottom: `1px solid ${vars.border}`
});
export const panelContent = style({ display: 'grid', gap: 20, padding: 16 });
export const errorNotice = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 24px',
  color: vars.danger,
  background: vars.surface
});
export const emptyPage = style({
  display: 'grid',
  justifyItems: 'center',
  gap: 12,
  padding: '60px 24px',
  color: vars.muted,
  textAlign: 'center'
});
