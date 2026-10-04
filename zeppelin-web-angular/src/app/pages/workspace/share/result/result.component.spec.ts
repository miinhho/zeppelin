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

import { ChangeDetectorRef, Injector, ViewContainerRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DatasetType } from '@zeppelin/sdk';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@zeppelin/services', () => ({
  ClassicVisualizationService: class {},
  HeliumService: class {},
  NgZService: class {},
  RuntimeCompilerService: class {}
}));
vi.mock('@zeppelin/visualizations', () => ({
  AreaChartVisualization: class {},
  BarChartVisualization: class {},
  LineChartVisualization: class {},
  PieChartVisualization: class {},
  ScatterChartVisualization: class {},
  TableVisualization: class {}
}));

import {
  ClassicVisualizationService,
  DynamicTemplate,
  HeliumService,
  NgZService,
  RuntimeCompilerService
} from '@zeppelin/services';
import { NotebookParagraphResultComponent } from './result.component';

const component = () =>
  new NotebookParagraphResultComponent(
    {} as Injector,
    {} as ViewContainerRef,
    { detectChanges: vi.fn() } as unknown as ChangeDetectorRef,
    {} as RuntimeCompilerService,
    {} as DomSanitizer,
    {} as NgZService,
    {} as HeliumService,
    {} as ClassicVisualizationService
  );

describe('finite dataset rendering', () => {
  it('encodes SVG output as an image URL', () => {
    const result = component();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>한글 # &</text></svg>';
    result.result = { type: DatasetType.SVG, data: svg };
    result.angularComponent = {} as DynamicTemplate;
    result.renderDefaultDisplay();
    expect(result.imgData).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    expect(result.angularComponent).toBeNull();
  });

  it('clears a previous Angular display for NULL output', () => {
    const result = component();
    result.result = { type: DatasetType.NULL, data: '' };
    result.angularComponent = {} as DynamicTemplate;
    result.renderDefaultDisplay();
    expect(result.angularComponent).toBeNull();
  });

  it.each([DatasetType.NULL, DatasetType.NETWORK])('leaves %s without a display renderer', type => {
    const result = component();
    result.result = { type, data: '' };
    const renderHTML = vi.spyOn(result, 'renderHTML');
    const renderAngular = vi.spyOn(result, 'renderAngular');
    result.renderDefaultDisplay();
    expect(renderHTML).not.toHaveBeenCalled();
    expect(renderAngular).not.toHaveBeenCalled();
    expect(result.frontEndError).toBe('');
  });
});
