/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const picker = style({
  display: 'grid',
  gap: 14,
  color: vars.text,
  fontFamily: vars.font
});

export const replacementHeading = style({
  display: 'grid',
  gap: 10,
  paddingBottom: 2
});

export const cancelButton = style({ justifySelf: 'start' });

export const sourceLink = style({
  color: vars.accent,
  overflowWrap: 'anywhere',
  selectors: {
    '&:focus-visible': { outline: `2px solid ${vars.focus}`, outlineOffset: 2 }
  }
});

export const unusedFilter = style({ color: vars.muted, fontSize: 12 });

export const choices = style({ display: 'grid', gap: 10 });

export const choice = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  padding: '13px 10px',
  border: `1px solid ${vars.border}`,
  borderRadius: vars.radius,
  background: vars.surface,
  selectors: {
    '&[draggable="true"]': { cursor: 'grab' },
    '&:hover': { borderColor: vars.accent },
    '&[data-included="true"]': { cursor: 'default' }
  }
});

export const description = style({ flex: 1, minWidth: 0 });

export const resultTitle = style({
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  overflowWrap: 'anywhere'
});

export const resultMetadata = style({
  display: 'block',
  marginTop: 3,
  fontSize: 11,
  color: vars.muted
});

export const executionError = style({
  display: 'block',
  marginTop: 3,
  fontSize: 11,
  color: vars.danger
});

export const chooseButton = style({ marginLeft: 'auto', flexShrink: 0 });

export const sourceError = style({
  margin: 0,
  color: vars.danger,
  fontSize: 12,
  overflowWrap: 'anywhere'
});

export const emptyResults = style({
  padding: '24px 0',
  color: vars.muted,
  fontSize: 12,
  textAlign: 'center'
});
