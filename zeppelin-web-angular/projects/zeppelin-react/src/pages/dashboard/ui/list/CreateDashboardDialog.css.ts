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
import { vars } from '../theme.css';

export const notebookPicker = style({ display: 'grid', gap: 16, color: vars.text });
export const requestState = style({
  display: 'grid',
  justifyItems: 'center',
  gap: 12,
  padding: '28px 0',
  color: vars.muted
});
export const sourceOptions = style({ display: 'grid', gap: 8, maxHeight: '50vh', overflow: 'auto' });
export const sourceChoice = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  color: vars.text,
  background: vars.surface,
  border: `1px solid ${vars.border}`,
  borderRadius: vars.radius,
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&[data-selected="true"]': { borderColor: vars.accent },
    '&:focus-visible': { outline: `2px solid ${vars.focus}` }
  }
});
export const sourceName = style({ display: 'grid', gap: 3, minWidth: 0 });
export const sourceFolder = style({ color: vars.muted, fontSize: 12, overflowWrap: 'anywhere' });
