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

import { useId } from 'react';
import { useDashboardDocument } from '../../model/DashboardDocumentProvider';
import { WidgetAlignmentFields } from './widget-settings/WidgetAlignmentFields';
import { WidgetSizeFields } from './widget-settings/WidgetSizeFields';
import { WidgetTextField } from './widget-settings/WidgetTextField';
import * as styles from './DashboardWidgetSettings.css';

interface DashboardWidgetSettingsProps {
  id: string;
  disabled: boolean;
}

export const DashboardWidgetSettings = ({ id, disabled }: DashboardWidgetSettingsProps) => {
  const { definition } = useDashboardDocument();
  const headingId = useId();
  const widget = definition.widgets.find(item => item.id === id);

  if (!widget) return null;

  return (
    <section id={`dashboard-settings-${id}`} className={styles.settings} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.title}>
        {widget.title || widget.kind}
      </h3>
      <WidgetTextField key={`text-${id}`} id={id} disabled={disabled} />
      <WidgetSizeFields key={`size-${id}`} id={id} disabled={disabled} />
      <WidgetAlignmentFields id={id} disabled={disabled} />
    </section>
  );
};
