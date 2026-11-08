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

export const tabs = style({
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  borderBottom: `1px solid ${vars.border}`,
  marginBottom: 20,
  minHeight: 54,
  overflowX: 'auto'
});

export const tabItem = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  gap: 2,
  borderBottom: '2px solid transparent',
  color: vars.text
});

export const selectedTab = style({ color: vars.accent, borderBottomColor: vars.accent });

export const tabLabel = style({
  height: 'auto',
  padding: '15px 2px 13px',
  color: 'inherit',
  whiteSpace: 'nowrap'
});

export const tabAction = style({
  opacity: 0,
  selectors: {
    [`${tabItem}:hover &, ${tabItem}:focus-within &`]: { opacity: 1 }
  },
  '@media': { '(max-width: 800px)': { opacity: 0.7 } }
});

export const newTab = style({ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 4 });

export const addContent = style({ marginLeft: 'auto', flexShrink: 0 });
