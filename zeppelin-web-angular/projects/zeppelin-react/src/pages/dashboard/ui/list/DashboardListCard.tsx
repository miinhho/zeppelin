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

import {
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  FileTextOutlined,
  FolderOutlined,
  LayoutOutlined
} from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import type { DashboardSummary } from '@zeppelin/sdk';
import * as styles from './DashboardListCard.css';

type DashboardListCardProps = {
  dashboard: DashboardSummary;
  sourceHref: string;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (dashboard: DashboardSummary) => void;
};

export const DashboardListCard = ({ dashboard, sourceHref, onOpen, onEdit, onDelete }: DashboardListCardProps) => {
  const separator = dashboard.path.lastIndexOf('/');
  const folder = separator > 0 ? dashboard.path.slice(0, separator) : '/';
  const actions = [
    { key: 'source', icon: <FileTextOutlined />, label: <a href={sourceHref}>Source notebook</a> },
    { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => onEdit(dashboard.id) },
    { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: () => onDelete(dashboard) }
  ];

  return (
    <article className={styles.card}>
      <button type="button" className={styles.openDashboard} onClick={() => onOpen(dashboard.id)}>
        <span className={styles.icon}>
          <LayoutOutlined />
        </span>
        <h2 className={styles.title}>{dashboard.name}</h2>
        <span className={styles.folder} title={folder}>
          <FolderOutlined /> {folder}
        </span>
      </button>

      <Dropdown trigger={['click']} menu={{ items: actions }}>
        <Button
          type="text"
          className={styles.moreActions}
          icon={<EllipsisOutlined />}
          aria-label={`More actions for ${dashboard.name}`}
        />
      </Dropdown>
    </article>
  );
};
