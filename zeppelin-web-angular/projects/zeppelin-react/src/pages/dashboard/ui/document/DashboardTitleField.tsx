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

import type { ChangeEvent } from 'react';
import { Input } from 'antd';
import { useDashboardCommands, useDashboardDocument } from '../../model/DashboardDocumentProvider';
import * as styles from './DashboardTitleField.css';

export const DashboardTitleField = ({ disabled }: { disabled: boolean }) => {
  const { definition } = useDashboardDocument();
  const { setTitle, finishEdit } = useDashboardCommands();

  const changeTitle = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };

  return (
    <Input
      className={styles.titleField}
      aria-label="Dashboard title"
      value={definition.title}
      disabled={disabled}
      onChange={changeTitle}
      onBlur={finishEdit}
    />
  );
};
