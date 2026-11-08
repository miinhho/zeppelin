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

export const panel = style({
  minWidth: 0,
  selectors: {
    '&:focus-visible': { outline: `2px solid ${vars.focus}`, outlineOffset: 4 }
  }
});

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
  gap: 16,
  alignItems: 'start',
  minHeight: 30
});

export const dropArea = style({
  outline: `1px dashed ${vars.accent}`,
  outlineOffset: 6,
  minHeight: 140
});
