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

import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const cardFrame = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  padding: 12,
  border: `1px solid ${vars.border}`,
  borderRadius: vars.radius,
  background: vars.surface,
  color: vars.text,
  overflow: 'hidden'
});
export const selectedFrame = style({ outline: `2px solid ${vars.accent}`, outlineOffset: 1 });
export const dropIndicator = style({ borderTop: `3px solid ${vars.accent}` });
export const cardHeading = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24, flexShrink: 0 });
export const widgetTitle = style({
  margin: 0,
  minWidth: 0,
  flex: 1,
  fontSize: 13,
  fontWeight: 600,
  overflowWrap: 'anywhere'
});
export const moveHandle = style({
  border: 0,
  padding: 0,
  background: 'transparent',
  color: vars.muted,
  cursor: 'grab',
  fontSize: 16
});
export const layoutContent = style({
  display: 'flex',
  flex: '1 1 auto',
  minHeight: 0,
  flexDirection: 'column',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere'
});
export const textContent = style({ width: '100%', lineHeight: 1.6 });
export const headingContent = style({ margin: 0, width: '100%', color: vars.text, fontSize: 22, fontWeight: 600 });
export const emptyText = style({ color: vars.muted });
export const divider = style({ width: '100%', margin: '8px 0', border: 0, borderTop: `1px solid ${vars.border}` });
const resizeGrip = style({
  position: 'absolute',
  zIndex: 2,
  padding: 0,
  border: 0,
  background: 'transparent',
  touchAction: 'none',
  selectors: { '&:focus-visible': { outline: `2px solid ${vars.focus}` } }
});
export const resizeGrips = styleVariants(
  {
    horizontal: { top: 0, right: 0, width: 8, height: '100%', cursor: 'ew-resize' },
    vertical: { bottom: 0, left: 0, height: 8, width: '100%', cursor: 'ns-resize' },
    both: { right: 0, bottom: 0, width: 16, height: 16, cursor: 'nwse-resize' }
  },
  value => [resizeGrip, value]
);
