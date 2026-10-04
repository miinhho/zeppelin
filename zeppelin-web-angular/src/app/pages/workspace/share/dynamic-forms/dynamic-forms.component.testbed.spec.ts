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

import { NO_ERRORS_SCHEMA, provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DynamicForms, DynamicFormsType, FormValue } from '@zeppelin/sdk';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { describe, expect, it } from 'vitest';

import { NotebookParagraphDynamicFormsComponent } from './dynamic-forms.component';
import template from './dynamic-forms.component.html?raw';

describe('Select form hydration (TestBed)', () => {
  it.each([
    { kind: 'object', value: { id: 'a' } },
    { kind: 'array', value: ['a', 42] }
  ])('displays an independently decoded $kind option', async ({ value }) => {
    await TestBed.configureTestingModule({
      declarations: [NotebookParagraphDynamicFormsComponent],
      imports: [FormsModule, NzSelectModule],
      providers: [provideZoneChangeDetection()],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(NotebookParagraphDynamicFormsComponent, {
        set: { template, templateUrl: undefined, styles: [], styleUrls: [] }
      })
      .compileComponents();

    const fixture = TestBed.createComponent(NotebookParagraphDynamicFormsComponent);
    const formDefs: DynamicForms = {
      field: {
        name: 'field',
        type: DynamicFormsType.Select,
        hidden: false,
        defaultValue: value,
        options: [{ value, displayName: 'Option A' }]
      }
    };
    const wire = JSON.parse(JSON.stringify({ forms: formDefs, params: { field: value } })) as {
      forms: DynamicForms;
      params: { field: FormValue };
    };
    expect(wire.params.field).not.toBe(wire.forms.field.options![0].value);
    fixture.componentInstance.formDefs = wire.forms;
    fixture.componentInstance.paramDefs = wire.params;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const selected = fixture.nativeElement.querySelector('.ant-select-selection-item') as HTMLElement | null;
    expect(selected).not.toBeNull();
    expect(selected?.textContent).toContain('Option A');
    expect(fixture.componentInstance.paramDefs.field).toEqual(value);
  });
});
