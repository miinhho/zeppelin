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

export const listPage = style({ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', color: vars.text });
export const listHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 20,
  marginBottom: 24
});
export const listHeading = style({ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20 });
export const pageTitle = style({ margin: 0, fontSize: 24, fontWeight: 600 });
export const dashboardCount = style({ color: vars.muted, fontSize: 13 });
export const listActions = style({ display: 'flex', gap: 8 });
export const searchToolbar = style({ maxWidth: 420, marginBottom: 24 });
export const dashboardCards = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
  gap: 18
});
export const requestState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  padding: '60px 24px',
  color: vars.muted,
  textAlign: 'center'
});
export const requestTitle = style({ margin: 0, fontSize: 16, fontWeight: 500 });
