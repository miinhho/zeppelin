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

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  padding: '18px 24px',
  borderBottom: `1px solid ${vars.border}`,
  background: vars.surface,
  '@media': {
    '(max-width: 1100px)': { flexWrap: 'wrap', gap: 14 },
    '(max-width: 800px)': { padding: 16 }
  }
});

export const heading = style({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  minWidth: 0,
  flex: 1,
  '@media': { '(max-width: 1100px)': { flexBasis: '100%' } }
});

export const documentHeading = style({ minWidth: 0, flex: 1 });

export const context = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: vars.muted,
  fontSize: 11,
  marginBottom: 3
});

export const folder = style({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

export const documentType = style({ borderLeft: `1px solid ${vars.border}`, paddingLeft: 8 });

export const title = style({
  margin: 0,
  fontSize: 21,
  lineHeight: 1.4,
  fontWeight: 600,
  overflowWrap: 'anywhere',
  color: vars.text
});

export const metadata = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '6px 16px',
  marginTop: 4,
  fontSize: 11,
  color: vars.muted
});

export const sourceLink = style({ color: vars.accent, fontSize: 11 });

export const actions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  marginLeft: 'auto',
  '@media': { '(max-width: 800px)': { flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 } }
});

export const shareError = style({
  padding: '10px 24px',
  color: vars.danger,
  background: vars.surface,
  fontSize: 13
});
