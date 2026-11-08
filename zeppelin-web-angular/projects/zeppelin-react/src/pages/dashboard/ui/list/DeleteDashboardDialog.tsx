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

import { useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import type { DashboardReactProps, DashboardSummary } from '@zeppelin/sdk';
import { dashboardRequestError } from '../../lib/dashboardErrors';

type DeleteDashboardDialogProps = {
  target: Pick<DashboardSummary, 'id' | 'name'>;
  onDelete: DashboardReactProps['onDelete'];
  onDeleted: (id: string) => void;
  onCancel: () => void;
};

type DeleteState = { status: 'idle' | 'pending' } | { status: 'error'; error: string };

export const DeleteDashboardDialog = ({ target, onDelete, onDeleted, onCancel }: DeleteDashboardDialogProps) => {
  const [state, setState] = useState<DeleteState>({ status: 'idle' });
  const request = useRef<Promise<void> | undefined>(undefined);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const confirmDelete = async () => {
    if (request.current) return;

    const pending = Promise.resolve().then(() => onDelete(target.id));
    request.current = pending;
    setState({ status: 'pending' });

    try {
      await pending;
      if (mounted.current) onDeleted(target.id);
    } catch (reason) {
      if (mounted.current) {
        setState({ status: 'error', error: dashboardRequestError(reason, 'Unable to delete dashboard.') });
      }
    } finally {
      request.current = undefined;
    }
  };

  const cancelDelete = () => {
    if (!request.current) onCancel();
  };

  const pending = state.status === 'pending';

  return (
    <Modal
      title="Delete dashboard"
      open
      okText={state.status === 'error' ? 'Retry' : 'Delete'}
      okButtonProps={{ danger: true }}
      confirmLoading={pending}
      cancelButtonProps={{ disabled: pending }}
      closable={!pending}
      mask={{ closable: !pending }}
      keyboard={!pending}
      onOk={confirmDelete}
      onCancel={cancelDelete}
    >
      <p>
        Delete <strong>{target.name}</strong>?
      </p>
      <p>This permanently deletes the dashboard. The source notebook is kept.</p>
      {state.status === 'error' && <p role="alert">{state.error}</p>}
    </Modal>
  );
};
