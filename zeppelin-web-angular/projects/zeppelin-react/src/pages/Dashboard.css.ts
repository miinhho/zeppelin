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
import { vars } from './dashboard/ui/theme.css';

export const root = style({
  minHeight: 'calc(100vh - 50px)',
  color: vars.text,
  background: vars.background,
  fontFamily: vars.font,
  fontSize: 13
});
export const requestState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  padding: '64px 24px',
  color: vars.muted,
  textAlign: 'center'
});
export const requestActions = style({ display: 'flex', gap: 8 });
