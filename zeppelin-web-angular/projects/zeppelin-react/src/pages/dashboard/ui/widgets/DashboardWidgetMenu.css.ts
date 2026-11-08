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

export const menuTrigger = style({
  flexShrink: 0,
  width: 28,
  height: 28,
  padding: 3,
  color: vars.muted,
  selectors: {
    '&:hover:not(:disabled)': { color: vars.accent },
    '&:focus-visible': { outline: `2px solid ${vars.focus}`, outlineOffset: 1 }
  }
});
