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

import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { isEqual } from 'lodash';
import { EMPTY, Subject, catchError, finalize, map, merge, switchMap, takeUntil, tap } from 'rxjs';

import { GraphConfig, ParagraphConfigResult, ParagraphIResultsMsgItem, ParagraphItem } from '@zeppelin/sdk';
import { MessageService } from '@zeppelin/services';

import { DashboardDefinition, DashboardOutput, DashboardWidget, SourceNote, sourceOutputs } from './dashboard-model';
import { DashboardService } from './dashboard.service';

interface WidgetDisplay {
  widget: DashboardWidget;
  result?: ParagraphIResultsMsgItem;
  config: ParagraphConfigResult;
  rendererId: string;
  height: number;
  error?: string;
  errorDetails?: string;
  status?: string;
  updatedAt?: string;
  autoHeight: boolean;
  flowContent: boolean;
}

interface ParagraphChoice {
  key: string;
  paragraphId: string;
  outputIndex: number;
  title: string;
  label: string;
  failed: boolean;
  position: number;
}
interface ResizeState {
  widget: DashboardWidget;
  pointerId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  columnWidth: number;
  axis: 'both' | 'horizontal' | 'vertical';
  originalWidth: number;
  originalHeight: number;
  originalMode?: DashboardWidget['heightMode'];
}

@Component({
  selector: 'zeppelin-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class DashboardComponent implements OnInit, OnDestroy {
  definition?: DashboardDefinition;
  source?: SourceNote;
  outputs: DashboardOutput[] = [];
  paragraphChoices: ParagraphChoice[] = [];
  pickerQuery = '';
  onlyUnused = false;
  sidebar: 'results' | 'layout' | null = null;
  panel: 'widget' | 'inputs' | null = null;
  editorWidget?: DashboardWidget;
  editorDisplay?: WidgetDisplay;
  sourceBusy = false;
  replacingParagraph = false;
  addingTab = false;
  renamingTab = false;
  displays: WidgetDisplay[] = [];
  id = '';
  activeTab = '';
  selectedId = '';
  editing = false;
  loading = true;
  creating = false;
  refreshing = false;
  saving = false;
  dirty = false;
  error = '';
  sourceError = '';
  saveError = '';
  newTabName = '';
  folder = '';
  loadedAt?: Date;
  history: DashboardDefinition[] = [];
  future: DashboardDefinition[] = [];
  paletteDragging = false;
  dropBeforeId?: string;
  linkCopied = false;
  shareError = '';
  resizingId = '';
  private checkpoint?: DashboardDefinition;
  private changeGroup?: string;
  private originalTitle = '';
  private saved?: DashboardDefinition;
  private defaultConfig: ParagraphConfigResult = { graph: new GraphConfig() };
  private destroy$ = new Subject<void>();
  private routeChanged$ = new Subject<void>();
  private retry$ = new Subject<void>();
  private resize?: ResizeState;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: DashboardService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private title: Title
  ) {}

  get sourceParagraph(): ParagraphItem | undefined {
    return this.source?.paragraphs.find(paragraph => paragraph.id === this.editorWidget?.paragraphId);
  }

  get visibleParagraphChoices(): ParagraphChoice[] {
    const query = this.pickerQuery.trim().toLowerCase();
    return this.paragraphChoices.filter(
      choice => choice.title.toLowerCase().includes(query) && (!this.onlyUnused || !this.isIncluded(choice))
    );
  }

  get selectedWidget(): DashboardWidget | undefined {
    return this.definition?.widgets.find(widget => widget.id === this.selectedId);
  }

  get activeTabIndex(): number {
    return this.definition?.tabs.indexOf(this.activeTab) ?? 0;
  }
  ngOnInit(): void {
    this.originalTitle = this.title.getTitle();
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const editing = params.get('edit') === 'true';
      if (this.editing && !editing && this.dirty && this.saved) {
        this.definition = structuredClone(this.saved);
        this.dirty = false;
        this.checkpoint = structuredClone(this.definition);
        this.history = [];
        this.future = [];
        this.title.setTitle(`${this.definition.title} - Zeppelin`);
        this.activeTab = this.definition.tabs.includes(this.activeTab) ? this.activeTab : this.definition.tabs[0] || '';
      }
      this.editing = editing;
      if (this.definition) {
        const tab = params.get('tab');
        if (tab && this.definition.tabs.includes(tab)) {
          this.activeTab = tab;
        }
      }
      if (!this.editing) {
        this.selectedId = '';
        this.sidebar = null;
      }
      this.rebuildDisplays();
    });
    merge(this.route.paramMap, this.retry$.pipe(map(() => this.route.snapshot.paramMap)))
      .pipe(
        map(params => ({ id: params.get('id'), sourceId: params.get('sourceNoteId') })),
        tap(() => this.resetRoute()),
        switchMap(params => {
          if (params.sourceId) {
            this.creating = true;
            return this.service.source(params.sourceId).pipe(
              switchMap(source => this.service.create(source)),
              tap(id => {
                this.messageService.listNodes();
                void this.router.navigate(['/dashboard', id], {
                  queryParams: { edit: true },
                  queryParamsHandling: 'merge',
                  replaceUrl: true
                });
              }),
              catchError(error => {
                this.error = this.errorMessage(error, 'Unable to create dashboard.');
                this.loading = false;
                this.cdr.markForCheck();
                return EMPTY;
              })
            );
          }
          if (!params.id) {
            this.loading = false;
            this.error = 'Dashboard not found.';
            return EMPTY;
          }
          this.id = params.id;
          return this.service.load(params.id).pipe(
            tap(note => {
              if (!note.config.dashboard) {
                throw new Error('This document is not a dashboard.');
              }
              const definition = note.config.dashboard;
              this.definition = {
                version: 1,
                title: definition.title,
                sourceNoteId: definition.sourceNoteId,
                widgets: structuredClone(definition.widgets),
                tabs: [...definition.tabs]
              };
              this.saved = structuredClone(this.definition);
              this.checkpoint = structuredClone(this.definition);
              this.history = [];
              this.future = [];
              this.folder = note.path.substring(0, note.path.lastIndexOf('/')) || '/';
              const tab = this.route.snapshot.queryParamMap.get('tab');
              this.activeTab = tab && this.definition.tabs.includes(tab) ? tab : this.definition.tabs[0] || '';
              this.sidebar = this.editing ? 'results' : null;
              this.title.setTitle(`${this.definition.title} - Zeppelin`);
            }),
            switchMap(() =>
              this.service.source(this.definition!.sourceNoteId).pipe(
                tap(source => this.setSource(source)),
                catchError(error => {
                  this.sourceError = this.errorMessage(error, 'Source notebook is unavailable.');
                  return EMPTY;
                }),
                finalize(() => {
                  if (this.id === params.id) {
                    this.loading = false;
                    this.rebuildDisplays();
                  }
                })
              )
            ),
            catchError(error => {
              this.error = this.errorMessage(error, 'Unable to load dashboard.');
              this.loading = false;
              this.cdr.markForCheck();
              return EMPTY;
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private resetRoute(): void {
    this.routeChanged$.next();
    this.id = '';
    this.definition = undefined;
    this.saved = undefined;
    this.source = undefined;
    this.outputs = [];
    this.paragraphChoices = [];
    this.panel = null;
    this.editorWidget = undefined;
    this.editorDisplay = undefined;
    this.sidebar = null;
    this.history = [];
    this.future = [];
    this.checkpoint = undefined;
    this.changeGroup = undefined;
    this.loadedAt = undefined;
    this.sourceBusy = false;
    this.displays = [];
    this.selectedId = '';
    this.loading = true;
    this.creating = false;
    this.refreshing = false;
    this.saving = false;
    this.dirty = false;
    this.error = '';
    this.sourceError = '';
    this.saveError = '';
    this.resize = undefined;
    this.cdr.markForCheck();
  }

  private setSource(source: SourceNote): void {
    this.source = source;
    this.loadedAt = new Date();
    this.outputs = sourceOutputs(source);
    const labels: Record<string, string> = {
      table: 'Table',
      lineChart: 'Line chart',
      multiBarChart: 'Bar chart',
      pieChart: 'Pie chart',
      stackedAreaChart: 'Area chart',
      scatterChart: 'Scatter plot'
    };
    this.paragraphChoices = [];
    source.paragraphs.forEach((paragraph, index) => {
      const outputs = this.outputs.filter(output => output.paragraphId === paragraph.id);
      const candidates = outputs.length ? outputs : [undefined];
      candidates.forEach(output => {
        const outputIndex = output?.outputIndex ?? 0;
        const config = structuredClone(output?.config ?? { graph: new GraphConfig() });
        config.graph.height = 240;
        config.graph.optionOpen = false;
        this.paragraphChoices.push({
          key: `${paragraph.id}:${outputIndex}`,
          paragraphId: paragraph.id,
          outputIndex,
          title: paragraph.title || `Paragraph ${index + 1}`,
          label: output
            ? `${labels[config.graph.mode] || 'Result'}${outputs.length > 1 ? ` · Output ${outputIndex + 1}` : ''}`
            : 'No saved result',
          failed: paragraph.status === 'ERROR' || paragraph.results?.code === 'ERROR',
          position: index + 1
        });
      });
    });
    this.sourceError = '';
  }

  refreshSource(): void {
    if (!this.definition || this.refreshing) {
      return;
    }
    this.refreshing = true;
    this.sourceError = '';
    this.service
      .source(this.definition.sourceNoteId)
      .pipe(
        takeUntil(this.routeChanged$),
        takeUntil(this.destroy$),
        finalize(() => {
          this.refreshing = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: source => {
          this.setSource(source);
          this.rebuildDisplays();
        },
        error: error => {
          this.source = undefined;
          this.outputs = [];
          this.paragraphChoices = [];
          this.sourceError = this.errorMessage(error, 'Source notebook is unavailable.');
          this.rebuildDisplays();
        }
      });
  }

  edit(): void {
    void this.router.navigate([], {
      // Query state belongs to the same document; keep the reader's place.
      relativeTo: this.route,
      queryParams: { edit: true },
      queryParamsHandling: 'merge'
    });
    this.sidebar = 'results';
  }

  cancel(): void {
    if (!this.saved || (this.dirty && !window.confirm('Discard unsaved changes?'))) {
      return;
    }
    this.definition = structuredClone(this.saved);
    this.dirty = false;
    this.history = [];
    this.future = [];
    this.checkpoint = structuredClone(this.definition);
    this.title.setTitle(`${this.definition.title} - Zeppelin`);
    this.saveError = '';
    this.activeTab = this.definition.tabs.includes(this.activeTab) ? this.activeTab : this.definition.tabs[0] || '';
    this.selectedId = '';
    this.rebuildDisplays();
    this.leaveEditor();
  }

  save(): void {
    if (!this.definition || !this.dirty || this.saving || this.sourceBusy || this.panel || this.replacingParagraph) {
      return;
    }
    if (!this.definition.title.trim()) {
      this.saveError = 'Enter a dashboard title.';
      return;
    }
    const emptyText = this.definition.widgets.find(
      widget => (widget.kind === 'text' || widget.kind === 'heading') && !widget.text?.trim()
    );
    if (emptyText) {
      this.select(emptyText);
      this.saveError = 'Enter text for this block before saving.';
      requestAnimationFrame(() => document.getElementById('widget-text')?.focus());
      return;
    }
    const snapshot = structuredClone(this.definition);
    snapshot.title = snapshot.title.trim();
    this.saving = true;
    this.saveError = '';
    this.service
      .save(this.id, snapshot)
      .pipe(
        takeUntil(this.routeChanged$),
        takeUntil(this.destroy$),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.definition = snapshot;
          this.saved = structuredClone(snapshot);
          this.dirty = false;
          this.checkpoint = structuredClone(snapshot);
          this.history = [];
          this.future = [];
          this.title.setTitle(`${snapshot.title} - Zeppelin`);
          this.saving = false;
          this.selectedId = '';
          this.rebuildDisplays();
          this.leaveEditor();
        },
        error: error => {
          this.saveError = this.errorMessage(error, 'Unable to save dashboard.');
          this.cdr.markForCheck();
        }
      });
  }

  private leaveEditor(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: null },
      queryParamsHandling: 'merge'
    });
  }

  change(group?: string): void {
    if (!this.definition) {
      return;
    }
    if (this.checkpoint && !isEqual(this.checkpoint, this.definition)) {
      if (!group || this.changeGroup !== group) {
        this.history.push(this.checkpoint);
        if (this.history.length > 50) {
          this.history.shift();
        }
      }
      this.future = [];
      this.checkpoint = structuredClone(this.definition);
    }
    this.changeGroup = group;
    this.dirty = !isEqual(this.definition, this.saved);
    this.saveError = '';
    this.title.setTitle(`${this.definition.title} - Zeppelin`);
  }

  finishChange(): void {
    this.changeGroup = undefined;
  }

  undo(): void {
    if (!this.history.length || this.saving || this.sourceBusy || this.panel) {
      return;
    }
    this.future.push(this.checkpoint!);
    this.restoreDefinition(this.history.pop()!);
  }

  redo(): void {
    if (!this.future.length || this.saving || this.sourceBusy || this.panel) {
      return;
    }
    this.history.push(this.checkpoint!);
    this.restoreDefinition(this.future.pop()!);
  }

  private restoreDefinition(snapshot: DashboardDefinition): void {
    this.definition = structuredClone(snapshot);
    this.checkpoint = snapshot;
    this.changeGroup = undefined;
    this.dirty = !isEqual(this.definition, this.saved);
    this.activeTab = snapshot.tabs.includes(this.activeTab) ? this.activeTab : snapshot.tabs[0];
    this.selectedId = '';
    this.title.setTitle(`${snapshot.title} - Zeppelin`);
    this.activateTab(this.activeTab);
  }

  select(widget: DashboardWidget, showProperties = true): void {
    if (!this.editing || this.saving || this.sourceBusy || this.replacingParagraph) return;
    this.selectedId = widget.id;
    if (showProperties) this.sidebar = 'layout';
    this.cdr.markForCheck();
  }

  activateTab(tab: string): void {
    this.activeTab = tab;
    this.linkCopied = false;
    this.renamingTab = false;
    this.addingTab = false;
    this.selectedId = '';
    this.rebuildDisplays();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  tabKey(event: KeyboardEvent, index: number): void {
    const tabs = this.definition?.tabs || [];
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    this.activateTab(tabs[next]);
    requestAnimationFrame(() => document.getElementById(`dashboard-tab-${next}`)?.focus());
  }

  setSidebar(sidebar: 'results' | 'layout' | null): void {
    this.sidebar = sidebar;
  }

  beginTab(): void {
    this.addingTab = true;
    this.newTabName = '';
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[aria-label="New tab name"]')?.focus());
  }

  async copyLink(): Promise<void> {
    if (!this.definition) return;
    const url = new URL(window.location.href);
    url.hash = this.router.createUrlTree(['/dashboard', this.id], { queryParams: { tab: this.activeTab } }).toString();
    this.shareError = '';
    try {
      await navigator.clipboard.writeText(url.href);
      this.linkCopied = true;
    } catch {
      this.shareError = 'Unable to copy the link. Copy the address from your browser.';
    }
    this.cdr.markForCheck();
  }

  addTab(): void {
    const name = this.newTabName.trim();
    if (!name || !this.definition || this.definition.tabs.includes(name)) {
      return;
    }
    this.definition.tabs.push(name);
    this.newTabName = '';
    this.addingTab = false;
    this.activeTab = name;
    this.selectedId = '';
    this.change();
    this.activateTab(name);
  }

  renameTab(rawName: string): void {
    const name = rawName.trim();
    if (!this.definition || !name || name === this.activeTab || this.definition.tabs.includes(name)) {
      return;
    }
    const old = this.activeTab;
    this.definition.tabs = this.definition.tabs.map(tab => (tab === old ? name : tab));
    this.definition.widgets.forEach(widget => {
      if (widget.tab === old) {
        widget.tab = name;
      }
    });
    this.activeTab = name;
    this.change();
    this.activateTab(name);
  }

  removeTab(): void {
    if (!this.definition || this.definition.tabs.length < 2 || !window.confirm('Delete this tab and its widgets?')) {
      return;
    }
    this.definition.widgets = this.definition.widgets.filter(widget => widget.tab !== this.activeTab);
    this.definition.tabs = this.definition.tabs.filter(tab => tab !== this.activeTab);
    this.activeTab = this.definition.tabs[0];
    this.selectedId = '';
    this.change();
    this.activateTab(this.activeTab);
  }

  openParagraphPicker(replace = false): void {
    if (!this.editing || this.saving || this.sourceBusy) {
      return;
    }
    this.replacingParagraph = replace;
    this.pickerQuery = '';
    this.onlyUnused = false;
    this.sidebar = 'results';
    this.panel = null;
    this.cdr.markForCheck();
  }

  isIncluded(choice: ParagraphChoice): boolean {
    return (
      !this.replacingParagraph &&
      !!this.definition?.widgets.some(
        widget =>
          widget.tab === this.activeTab &&
          widget.paragraphId === choice.paragraphId &&
          widget.outputIndex === choice.outputIndex
      )
    );
  }

  addParagraph(choice: ParagraphChoice, beforeId?: string): void {
    if (!this.definition || this.saving || this.sourceBusy || this.isIncluded(choice)) {
      return;
    }
    if (this.replacingParagraph && this.editorWidget) {
      this.editorWidget.paragraphId = choice.paragraphId;
      this.editorWidget.outputIndex = choice.outputIndex;
      this.editorWidget.title = choice.title;
      this.editorWidget.config = this.choiceConfig(choice);
      this.replacingParagraph = false;
      this.panel = 'widget';
      this.rebuildEditorDisplay();
      return;
    }
    const widget: DashboardWidget = {
      id: crypto.randomUUID(),
      kind: 'chart',
      title: choice.title,
      paragraphId: choice.paragraphId,
      outputIndex: choice.outputIndex,
      config: this.choiceConfig(choice),
      width: 6,
      height: 360,
      tab: this.activeTab
    };
    const index = beforeId ? this.definition.widgets.findIndex(item => item.id === beforeId) : -1;
    this.definition.widgets.splice(index < 0 ? this.definition.widgets.length : index, 0, widget);
    this.selectedId = widget.id;
    this.change();
    this.rebuildDisplays();
  }

  cancelReplacement(): void {
    this.replacingParagraph = false;
    this.panel = 'widget';
    this.rebuildEditorDisplay();
  }

  dragResult(event: DragEvent, choice: ParagraphChoice): void {
    if (this.isIncluded(choice) || this.replacingParagraph) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData('application/zeppelin-dashboard', `result:${choice.key}`);
    this.paletteDragging = true;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  dragLayout(event: DragEvent, kind: DashboardWidget['kind']): void {
    event.dataTransfer?.setData('application/zeppelin-dashboard', `layout:${kind}`);
    this.paletteDragging = true;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  allowDrop(event: DragEvent): void {
    if (this.editing && event.dataTransfer?.types.includes('application/zeppelin-dashboard')) {
      event.preventDefault();
      this.paletteDragging = true;
      this.dropBeforeId = (event.target as HTMLElement).closest<HTMLElement>('[data-widget-id]')?.dataset['widgetId'];
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  dropPalette(event: DragEvent): void {
    const data = event.dataTransfer?.getData('application/zeppelin-dashboard') || '';
    if (!this.editing || !data) return;
    event.preventDefault();
    this.endPaletteDrag();
    const beforeId = (event.target as HTMLElement).closest<HTMLElement>('[data-widget-id]')?.dataset['widgetId'];
    if (data.startsWith('result:')) {
      const choice = this.paragraphChoices.find(item => item.key === data.slice(7));
      if (choice) this.addParagraph(choice, beforeId);
    } else if (data === 'layout:text' || data === 'layout:heading' || data === 'layout:divider') {
      this.addLayout(data.slice(7) as 'text' | 'heading' | 'divider', beforeId);
    }
  }

  @HostListener('document:dragend')
  endPaletteDrag(): void {
    this.paletteDragging = false;
    this.dropBeforeId = undefined;
  }

  private choiceConfig(choice: ParagraphChoice): ParagraphConfigResult {
    const output = this.outputs.find(
      item => item.paragraphId === choice.paragraphId && item.outputIndex === choice.outputIndex
    );
    return structuredClone(output?.config ?? { graph: new GraphConfig() });
  }

  openWidget(widget: DashboardWidget): void {
    if (!this.editing || this.saving || this.sourceBusy) {
      return;
    }
    this.selectedId = widget.id;
    if (widget.kind !== 'chart') {
      this.sidebar = 'layout';
      requestAnimationFrame(() => document.getElementById('widget-text')?.focus());
      return;
    }
    this.editorWidget = structuredClone(widget);
    this.panel = 'widget';
    this.rebuildEditorDisplay();
  }

  addLayout(kind: 'text' | 'heading' | 'divider', beforeId?: string): void {
    if (!this.definition || this.saving || this.sourceBusy) return;
    const widget: DashboardWidget = {
      id: crypto.randomUUID(),
      kind,
      title: '',
      text: '',
      width: kind === 'text' ? 4 : 12,
      height: kind === 'divider' ? 24 : 64,
      heightMode: 'auto',
      textAlign: 'center',
      verticalAlign: 'center',
      tab: this.activeTab
    };
    const index = beforeId ? this.definition.widgets.findIndex(item => item.id === beforeId) : -1;
    this.definition.widgets.splice(index < 0 ? this.definition.widgets.length : index, 0, widget);
    this.selectedId = widget.id;
    this.sidebar = 'layout';
    this.change();
    this.rebuildDisplays();
    if (kind !== 'divider') {
      requestAnimationFrame(() => document.getElementById('widget-text')?.focus());
    }
  }

  openInputs(widget: DashboardWidget): void {
    if (this.saving || this.sourceBusy || !this.source) return;
    this.editorWidget = structuredClone(widget);
    this.panel = 'inputs';
  }

  applyWidget(): void {
    if (!this.editorWidget || !this.definition || this.sourceBusy) {
      return;
    }
    const existing = this.definition.widgets.find(item => item.id === this.editorWidget!.id);
    if (!existing) return;
    const widget = structuredClone(this.editorWidget);
    if (widget.config) {
      widget.config.graph.optionOpen = false;
      widget.config.graph.height = this.chartHeight(widget);
    }
    Object.assign(existing, widget);
    this.change();
    this.closePanel();
  }

  closePanel(): void {
    if (this.sourceBusy) {
      return;
    }
    this.replacingParagraph = false;
    this.panel = null;
    this.editorWidget = undefined;
    this.editorDisplay = undefined;
    this.selectedId = '';
    this.rebuildDisplays();
  }

  sourceChanged(source: SourceNote): void {
    this.setSource(source);
    this.rebuildDisplays();
  }

  setSourceBusy(busy: boolean): void {
    this.sourceBusy = busy;
    this.cdr.markForCheck();
  }

  private rebuildEditorDisplay(): void {
    const widget = this.editorWidget;
    this.editorDisplay = widget?.kind === 'chart' ? this.displayFor(widget, true) : undefined;
    this.cdr.markForCheck();
  }

  private displayFor(widget: DashboardWidget, preview = false): WidgetDisplay {
    const output = this.outputs.find(
      item => item.paragraphId === widget.paragraphId && item.outputIndex === widget.outputIndex
    );
    const paragraph = this.source?.paragraphs.find(item => item.id === widget.paragraphId);
    const failed = paragraph?.status === 'ERROR' || paragraph?.results?.code === 'ERROR';
    const config = widget.config ?? output?.config ?? this.defaultConfig;
    return {
      widget,
      config,
      rendererId: `${preview ? 'editor' : 'dashboard'}-${this.id}-${widget.id}`,
      height: preview ? 360 : this.chartHeight(widget),
      result: failed ? undefined : output?.result,
      status: paragraph?.status,
      updatedAt: paragraph?.dateFinished || paragraph?.dateUpdated,
      error:
        widget.kind !== 'chart'
          ? undefined
          : failed
            ? 'Source execution failed'
            : output
              ? undefined
              : this.sourceError || 'Source result is unavailable',
      errorDetails: failed ? paragraph?.errorMessage || output?.result.data : undefined,
      autoHeight: this.isAutoHeight(widget),
      flowContent: widget.kind !== 'chart' || output?.result.type === 'TEXT' || config.graph.mode === 'table'
    };
  }

  isAutoHeight(widget: DashboardWidget): boolean {
    if (widget.heightMode) return widget.heightMode === 'auto';
    const output = this.outputs.find(
      item => item.paragraphId === widget.paragraphId && item.outputIndex === widget.outputIndex
    );
    return (
      widget.kind !== 'chart' ||
      output?.result.type === 'TEXT' ||
      (widget.config?.graph.mode ?? output?.config.graph.mode ?? 'table') === 'table'
    );
  }

  setText(widget: DashboardWidget, text: string): void {
    widget.text = text;
    this.change(`text-${widget.id}`);
  }

  setAlignment(widget: DashboardWidget, alignment: DashboardWidget['textAlign']): void {
    widget.textAlign = alignment;
    this.change();
  }

  setVerticalAlignment(widget: DashboardWidget, alignment: DashboardWidget['verticalAlign']): void {
    widget.verticalAlign = alignment;
    this.change();
  }

  setWidth(widget: DashboardWidget, width: number): void {
    widget.width = Math.max(1, Math.min(12, Math.round(Number(width) || 1)));
    this.change();
    this.rebuildDisplays();
  }

  setHeightMode(widget: DashboardWidget, mode: 'auto' | 'fixed'): void {
    if (mode === 'fixed') {
      this.setSize(widget, widget.width, this.renderedHeight(widget));
    } else {
      widget.heightMode = 'auto';
      this.change();
      this.rebuildDisplays();
    }
  }

  private renderedHeight(widget: DashboardWidget): number {
    return document.getElementById(`dashboard-widget-${widget.id}`)?.getBoundingClientRect().height || widget.height;
  }

  private minimumHeight(widget: DashboardWidget): number {
    return widget.kind === 'chart' ? 160 : widget.kind === 'divider' ? 24 : 48;
  }

  moveWidget(widget: DashboardWidget, direction: number): void {
    const index = this.displays.findIndex(item => item.widget.id === widget.id);
    const next = index + direction;
    if (next >= 0 && next < this.displays.length) {
      this.drop({ previousIndex: index, currentIndex: next } as CdkDragDrop<WidgetDisplay[]>);
    }
  }

  removeWidget(widget: DashboardWidget): void {
    if (!this.definition) {
      return;
    }
    this.definition.widgets = this.definition.widgets.filter(item => item.id !== widget.id);
    this.selectedId = '';
    this.change();
    this.rebuildDisplays();
  }

  drop(event: CdkDragDrop<WidgetDisplay[]>): void {
    if (!this.definition || event.previousIndex === event.currentIndex) {
      return;
    }
    const widgets = this.displays.map(display => display.widget);
    moveItemInArray(widgets, event.previousIndex, event.currentIndex);
    let index = 0;
    this.definition.widgets = this.definition.widgets.map(widget =>
      widget.tab === this.activeTab ? widgets[index++] : widget
    );
    this.change();
    this.rebuildDisplays();
  }

  setSize(widget: DashboardWidget, width: number, height: number): void {
    widget.width = Math.max(1, Math.min(12, Math.round(Number(width) || 1)));
    widget.height = Math.max(
      this.minimumHeight(widget),
      Math.min(1600, Math.round(Number(height) || this.minimumHeight(widget)))
    );
    widget.heightMode = 'fixed';
    if (widget.config?.graph) {
      widget.config.graph.height = this.chartHeight(widget);
    }
    this.change();
    this.rebuildDisplays();
  }

  startResize(event: PointerEvent, widget: DashboardWidget, axis: 'both' | 'horizontal' | 'vertical' = 'both'): void {
    if (!this.editing || this.saving || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.select(widget, false);
    const card = (event.currentTarget as HTMLElement).closest('.widget') as HTMLElement;
    const grid = card.parentElement!;
    const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 16;
    this.resize = {
      widget,
      pointerId: event.pointerId,
      axis,
      originalWidth: widget.width,
      originalHeight: widget.height,
      originalMode: widget.heightMode,
      x: event.clientX,
      y: event.clientY,
      width: widget.width,
      height: card.getBoundingClientRect().height,
      columnWidth: (grid.clientWidth + gap) / 12
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.resizingId = widget.id;
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    const resize = this.resize;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }
    if (resize.axis !== 'vertical') {
      resize.widget.width = Math.max(
        1,
        Math.min(12, resize.width + Math.round((event.clientX - resize.x) / resize.columnWidth))
      );
    }
    if (resize.axis !== 'horizontal') {
      resize.widget.height = Math.max(
        this.minimumHeight(resize.widget),
        Math.min(1600, resize.height + event.clientY - resize.y)
      );
      resize.widget.heightMode = 'fixed';
      const display = this.displays.find(item => item.widget.id === resize.widget.id);
      if (display) {
        display.autoHeight = false;
        display.height = this.chartHeight(resize.widget);
      }
    }
    this.cdr.markForCheck();
  }

  @HostListener('document:pointerup', ['$event'])
  @HostListener('document:pointercancel', ['$event'])
  onPointerUp(event: PointerEvent): void {
    const resize = this.resize;
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (event.type === 'pointercancel') {
      resize.widget.width = resize.originalWidth;
      resize.widget.height = resize.originalHeight;
      if (resize.originalMode === undefined) {
        delete resize.widget.heightMode;
      } else {
        resize.widget.heightMode = resize.originalMode;
      }
    } else {
      if (resize.widget.config?.graph && resize.axis !== 'horizontal') {
        resize.widget.config.graph.height = this.chartHeight(resize.widget);
      }
      this.change();
    }
    this.resize = undefined;
    this.resizingId = '';
    this.rebuildDisplays();
  }

  resizeKey(event: KeyboardEvent, widget: DashboardWidget): void {
    if (!event.key.startsWith('Arrow')) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      this.setWidth(widget, widget.width + (event.key === 'ArrowLeft' ? -1 : 1));
    } else {
      this.setSize(widget, widget.width, this.renderedHeight(widget) + (event.key === 'ArrowUp' ? -20 : 20));
    }
  }

  configChange(widget: DashboardWidget, config: ParagraphConfigResult): void {
    if (this.panel !== 'widget' || this.sourceBusy || this.editorWidget?.id !== widget.id) {
      return;
    }
    this.editorWidget.config = structuredClone(config);
    if (this.editorDisplay?.widget.id === widget.id) {
      this.editorDisplay.config = this.editorWidget.config;
    }
  }

  private rebuildDisplays(): void {
    this.displays = (this.definition?.widgets || [])
      .filter(widget => widget.tab === this.activeTab)
      .map(widget => this.displayFor(widget));
    this.rebuildEditorDisplay();
    this.cdr.markForCheck();
  }

  private chartHeight(widget: DashboardWidget): number {
    return Math.max(100, widget.height - 76);
  }

  canLeave(): boolean {
    return !this.saving && !this.sourceBusy && (!this.dirty || window.confirm('Discard unsaved changes?'));
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty || this.saving || this.sourceBusy) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  retry(): void {
    this.retry$.next();
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const response = error as { status?: number; message?: string; error?: { message?: string } | string };
      if (response.status === 404) {
        return 'Document not found.';
      }
      if (response.status === 401 || response.status === 403) {
        return 'You do not have access to this document.';
      }
      if (typeof response.error === 'string' && response.error) {
        return response.error;
      }
      if (response.error && typeof response.error === 'object' && response.error.message) {
        return response.error.message;
      }
      if (response.message && !response.status) {
        return response.message;
      }
    }
    return fallback;
  }

  ngOnDestroy(): void {
    this.routeChanged$.next();
    this.title.setTitle(this.originalTitle || 'Zeppelin');
    this.routeChanged$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
