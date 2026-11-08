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

export const card = style({
  position: 'relative',
  border: `1px solid ${vars.border}`,
  borderRadius: vars.radius,
  background: vars.surface,
  selectors: { '&:hover': { borderColor: vars.accent } }
});

export const openDashboard = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 12,
  width: '100%',
  minHeight: 168,
  padding: 20,
  border: 0,
  borderRadius: vars.radius,
  background: 'transparent',
  color: vars.text,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: { '&:focus-visible': { outline: `2px solid ${vars.focus}`, outlineOffset: 2 } }
});

export const icon = style({ color: vars.accent, fontSize: 24 });

export const title = style({
  margin: 0,
  paddingRight: 24,
  color: vars.text,
  fontSize: 16,
  fontWeight: 600,
  overflowWrap: 'anywhere'
});

export const folder = style({
  display: 'block',
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: vars.muted,
  fontSize: 12
});

export const moreActions = style({ position: 'absolute', top: 12, right: 12 });
