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

import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createDashboardResultWidget,
  dashboardResultKey,
  dashboardSourceOutputs,
  replaceDashboardWidgetResult,
  type DashboardOutput,
  type DashboardReactProps,
  type DashboardResultReference,
  type DashboardSourceNote,
  type DashboardWidget
} from '@zeppelin/sdk';
import { useDashboardCommands } from './DashboardDocumentProvider';
import { dashboardRequestError } from '../lib/dashboardErrors';

type ParagraphDialogPhase =
  | { kind: 'idle' }
  | { kind: 'settings' }
  | { kind: 'replacement'; widget: DashboardWidget }
  | { kind: 'inputs'; running: boolean };

interface DashboardSourceSnapshot {
  source?: DashboardSourceNote;
  outputs: DashboardOutput[];
  sourceHref: string;
  loadedAt?: Date;
  error?: string;
  loading: boolean;
  outputByKey: ReadonlyMap<string, DashboardOutput>;
  paragraphById: ReadonlyMap<string, DashboardSourceNote['paragraphs'][number]>;
  mountResult: DashboardReactProps['onMountResult'];
}

interface ParagraphActions {
  phase: ParagraphDialogPhase;
  error: string;
  configure: (widget: DashboardWidget) => void;
  run: (widget: DashboardWidget) => void;
  chooseReplacement: (reference: DashboardResultReference) => void;
  cancelReplacement: () => void;
  insertResult: (reference: DashboardResultReference, tab: string, beforeId?: string) => string | undefined;
}

const SourceContext = createContext<DashboardSourceSnapshot | null>(null);
const ActionsContext = createContext<ParagraphActions | null>(null);

export const useDashboardSource = (): DashboardSourceSnapshot => {
  const source = useContext(SourceContext);
  if (!source) throw new Error('Dashboard source provider is required');
  return source;
};

export const useDashboardParagraphActions = (): ParagraphActions => {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('Dashboard source provider is required');
  return actions;
};

interface DashboardSourceProviderProps {
  dashboardId: string;
  source?: DashboardSourceNote;
  loadedAt?: Date;
  sourceError?: string;
  sourceHref: string;
  mountResult: DashboardReactProps['onMountResult'];
  openSettings: DashboardReactProps['onOpenSettings'];
  openInputs: DashboardReactProps['onOpenInputs'];
  onSourceChange: (source: DashboardSourceNote | undefined, error?: string) => void;
  children: ReactNode;
}

export const DashboardSourceProvider = ({
  dashboardId,
  source,
  loadedAt,
  sourceError,
  sourceHref,
  mountResult,
  openSettings,
  openInputs,
  onSourceChange,
  children
}: DashboardSourceProviderProps) => {
  const commands = useDashboardCommands();
  const [phase, setPhase] = useState<ParagraphDialogPhase>({ kind: 'idle' });
  const [error, setError] = useState('');
  const alive = useRef(false);
  const request = useRef(0);

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const snapshot = useMemo<DashboardSourceSnapshot>(() => {
    const outputs = source ? dashboardSourceOutputs(source) : [];
    return {
      source,
      outputs,
      sourceHref,
      loadedAt,
      error: sourceError,
      loading: !source && !sourceError,
      mountResult,
      outputByKey: new Map(outputs.map(output => [dashboardResultKey(output), output])),
      paragraphById: new Map(source?.paragraphs.map(paragraph => [paragraph.id, paragraph]) ?? [])
    };
  }, [source, sourceHref, loadedAt, sourceError, mountResult]);

  const configure = async (widget: DashboardWidget) => {
    if (!source || (phase.kind !== 'idle' && phase.kind !== 'replacement')) return;
    const identity = ++request.current;
    setPhase({ kind: 'settings' });
    setError('');

    try {
      const result = await openSettings({
        dashboardId,
        widget: structuredClone(widget),
        source: structuredClone(source)
      });
      if (!alive.current || request.current !== identity) return;

      if (result?.kind === 'replace') {
        setPhase({ kind: 'replacement', widget: structuredClone(result.widget) });
      } else {
        if (result?.kind === 'apply') {
          const applied = structuredClone(result.widget);
          if (applied.config) applied.config.graph.optionOpen = false;
          commands.replaceWidget(applied);
        }
        setPhase({ kind: 'idle' });
      }
    } catch (reason) {
      if (!alive.current || request.current !== identity) return;
      setError(dashboardRequestError(reason, 'Unable to open display settings.'));
      setPhase({ kind: 'idle' });
    }
  };

  const run = async (widget: DashboardWidget) => {
    if (!source || phase.kind !== 'idle') return;
    const identity = ++request.current;
    const current = () => alive.current && request.current === identity;
    setPhase({ kind: 'inputs', running: false });
    setError('');

    try {
      const updated = await openInputs({
        widget: structuredClone(widget),
        source: structuredClone(source),
        onSourceChange: value => {
          if (current()) onSourceChange(value);
        },
        onBusyChange: running => {
          if (current()) setPhase({ kind: 'inputs', running });
        }
      });
      if (current() && updated) onSourceChange(updated);
    } catch (reason) {
      if (current()) setError(dashboardRequestError(reason, 'Unable to update source inputs.'));
    } finally {
      if (current()) {
        request.current++;
        setPhase({ kind: 'idle' });
      }
    }
  };

  const chooseReplacement = (reference: DashboardResultReference) => {
    if (!source || phase.kind !== 'replacement') return;
    const widget = replaceDashboardWidgetResult(phase.widget, source, reference);
    if (widget) void configure(widget);
  };

  const cancelReplacement = () => {
    if (phase.kind !== 'replacement') return;
    if (source) void configure(phase.widget);
    else setPhase({ kind: 'idle' });
  };

  const insertResult = (reference: DashboardResultReference, tab: string, beforeId?: string) => {
    if (!source || phase.kind !== 'idle') return;
    const widget = createDashboardResultWidget(source, reference, tab);
    if (!widget) return;
    commands.insertWidget(widget, beforeId);
    return widget.id;
  };

  const actions = { phase, error, configure, run, chooseReplacement, cancelReplacement, insertResult };
  return (
    <SourceContext.Provider value={snapshot}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </SourceContext.Provider>
  );
};
