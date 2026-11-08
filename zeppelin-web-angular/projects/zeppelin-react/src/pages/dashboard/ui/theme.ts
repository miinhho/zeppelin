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

import { assignInlineVars } from '@vanilla-extract/dynamic';
import { theme } from 'antd';
import { vars } from './theme.css';

export const useDashboardTheme = () => {
  const { token } = theme.useToken();
  return assignInlineVars(vars, {
    background: token.colorBgLayout,
    surface: token.colorBgContainer,
    text: token.colorText,
    muted: token.colorTextSecondary,
    border: token.colorBorderSecondary,
    accent: token.colorPrimary,
    focus: token.colorPrimary,
    danger: token.colorError,
    radius: `${token.borderRadius}px`,
    font: token.fontFamily
  });
};
