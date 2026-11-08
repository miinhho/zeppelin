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

export const resultContent = style({ flex: '1 1 auto', minWidth: 0, minHeight: 0, overflow: 'auto' });
export const resultStatus = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexShrink: 0,
  marginTop: 8,
  color: vars.muted,
  fontSize: 10
});
export const resultUnavailable = style({ display: 'grid', gap: 8, padding: '18px 0', color: vars.muted, fontSize: 12 });
export const errorDetails = style({ maxHeight: 180, whiteSpace: 'pre-wrap', overflow: 'auto', color: vars.danger });
export const sourceLink = style({ color: vars.accent });
