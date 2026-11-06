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
  AfterViewInit,
  ChangeDetectorRef,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Self
} from '@angular/core';
import { DatasetType, GraphConfig, ParagraphConfigResult, ParagraphIResultsMsgItem } from '@zeppelin/sdk';
import { isEqual, omit } from 'lodash';

import { NotebookParagraphResultComponent } from '../share/result/result.component';

type GraphSettings = Omit<GraphConfig, 'height' | 'optionOpen'>;

@Directive({
  selector: '[zeppelin-dashboard-result]',
  standalone: false
})
export class DashboardResultDirective implements OnChanges, AfterViewInit, OnDestroy {
  @Input() dashboardResult!: ParagraphIResultsMsgItem;
  @Input() dashboardConfig!: ParagraphConfigResult;
  @Input() dashboardHeight!: number;

  private ready = false;
  private destroyed = false;
  private frame: number | null = null;
  private observer?: ResizeObserver;
  private width = 0;
  private hidden = false;
  private rawGraph?: GraphSettings;
  private resultType?: DatasetType;
  private resultData?: string;
  private height = 0;
  private failed = false;

  constructor(
    @Self() private renderer: NotebookParagraphResultComponent,
    private host: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(): void {
    if (this.destroyed) return;
    if (!this.ready) {
      // The native component owns its initial draw in ngAfterViewInit.
      this.renderer.result = this.dashboardResult;
      this.renderer.config = this.presentationConfig();
      this.rememberInputs();
      return;
    }
    const resultChanged =
      this.resultType !== this.dashboardResult.type || this.resultData !== this.dashboardResult.data;
    if (resultChanged || this.graphChanged() || this.dashboardHeight !== this.height) {
      this.schedule();
    } else {
      // Native chart controls render before emitting configChange. Accept that
      // configuration without echoing another parse/transform/render back to it.
      this.rememberInputs();
    }
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.width = this.host.nativeElement.clientWidth;
    this.hidden = this.width === 0;
    this.observer = new ResizeObserver(() => {
      if (this.destroyed) return;
      const width = this.host.nativeElement.clientWidth;
      if (width === 0) {
        this.hidden = true;
      } else if (width !== this.width || this.hidden) {
        this.schedule();
      }
    });
    this.observer.observe(this.host.nativeElement);
  }

  private schedule(): void {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (!this.destroyed) this.render();
    });
  }

  private render(): void {
    const width = this.host.nativeElement.clientWidth;
    if (width === 0) {
      this.hidden = true;
      return;
    }
    const graphChanged = this.graphChanged();
    const table = this.dashboardResult.type === DatasetType.TABLE;
    const resultChanged =
      this.resultType !== this.dashboardResult.type || this.resultData !== this.dashboardResult.data;
    this.failed = true;
    if (resultChanged || (table && graphChanged)) {
      // Preserve renderer-populated defaults and local table state when only
      // output data changes; never lend the source/definition graph to it.
      const config = graphChanged ? this.presentationConfig() : this.renderer.config!;
      config.graph.height = this.dashboardHeight;
      this.renderer.updateResult(config, this.dashboardResult);
    } else {
      if (graphChanged) {
        this.renderer.config = this.presentationConfig();
        this.cdr.markForCheck();
      }
      if (
        table &&
        this.renderer.getCurrentVisualization().id !== 'table' &&
        (width !== this.width || this.hidden || this.dashboardHeight !== this.height)
      ) {
        this.renderer.onResize({ height: this.dashboardHeight });
      } else {
        this.renderer.config!.graph.height = this.dashboardHeight;
      }
    }
    // Do not acknowledge failed native renders: errors must remain visible and
    // a subsequent real input/size change must still be able to invalidate them.
    this.width = width;
    this.hidden = false;
    this.failed = false;
    this.rememberInputs();
  }

  private graphChanged(): boolean {
    const graph = this.settings(this.dashboardConfig.graph);
    return (
      !isEqual(graph, this.rawGraph) && (this.failed || !isEqual(graph, this.settings(this.renderer.config!.graph)))
    );
  }

  private settings(graph: GraphConfig): GraphSettings {
    // Native defaults use class instances; persisted settings are plain objects.
    return structuredClone(omit(graph, ['height', 'optionOpen']));
  }

  private presentationConfig(): ParagraphConfigResult {
    const config = structuredClone(this.dashboardConfig);
    config.graph.height = this.dashboardHeight;
    config.graph.optionOpen = this.ready ? this.renderer.config!.graph.optionOpen : false;
    return config;
  }

  private rememberInputs(): void {
    const graph = this.settings(this.dashboardConfig.graph);
    if (!isEqual(graph, this.rawGraph)) this.rawGraph = graph;
    this.resultType = this.dashboardResult.type;
    this.resultData = this.dashboardResult.data;
    this.height = this.dashboardHeight;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
