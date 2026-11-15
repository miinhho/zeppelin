<!--
  ~ Licensed under the Apache License, Version 2.0 (the "License");
  ~ you may not use this file except in compliance with the License.
  ~ You may obtain a copy of the License at
  ~     http://www.apache.org/licenses/LICENSE-2.0
  ~ Unless required by applicable law or agreed to in writing, software
  ~ distributed under the License is distributed on an "AS IS" BASIS,
  ~ WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  ~ See the License for the specific language governing permissions and
  ~ limitations under the License.
  -->
  
# ZeppelinVisualization

This library was generated with [Angular CLI](https://github.com/angular/angular-cli) version 8.2.8.

## Shared paragraph ECharts proof

The notebook and published Angular paragraph result renderer use ECharts for bar,
line, area, pie and scatter charts. The existing `PivotTransformation`, saved
`GraphConfig`, chart settings panels and non-chart result renderers are unchanged.
`echarts-option.ts` maps transformed rows and ordered source columns to options
without Angular runtime imports, so the mapping can be reused by another UI.
The Angular adapter owns the chart instance, container resize observation and disposal.
This does not migrate the separate React published-paragraph Chart.js renderer.

From `zeppelin-web-angular/`, start the isolated shared-result fixture:

```sh
npm exec -- ng serve --project echarts-proof --port 4310
```

Open http://localhost:4310/. The fixture mounts the production
`NotebookParagraphResultComponent`; it does not duplicate rendering or aggregation.

1. Switch through all five chart modes using the paragraph toolbar.
2. In bar settings, change Grouped/Stacked and Default/Rotate/Hide.
   The duplicate first-day North Revenue rows aggregate to 15.
3. In line settings, enable Force Y to 0, Date Format (`YYYY-MM-DD HH:mm`) and Zoom.
   Drag a range to zoom; double-click to reset.
4. In area settings, compare Stacked, Expanded and Stream. Expanded values sum
   to one per category. Choose Mixed-sign measures to inspect stream bands centered
   around zero, including negative Cost values.
5. In scatter settings, clear Size. Markers become uniform without changing
   their positions, group colors or Y values. X/Y/Group/Size still use the existing
   field-selection controls.
6. Change container width and graph height. Save config in memory, unmount, then
   remount saved JSON. Inspect captured `configChange` and `sizeChange` events.

This is a backend-free renderer proof. In-memory JSON remounting does not verify
server persistence, WebSocket delivery or interpreter execution. Refreshing the
page clears its saved fixture configuration.


## Code scaffolding

Run `ng generate component component-name --project zeppelin-visualization` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module --project zeppelin-visualization`.
> Note: Don't forget to add `--project zeppelin-visualization` or else it will be added to the default project in your `angular.json` file. 

## Build

Run `ng build zeppelin-visualization` to build the project. The build artifacts will be stored in the `dist/` directory.

## Publishing

After building your library with `ng build zeppelin-visualization`, go to the dist folder `cd dist/zeppelin-visualization` and run `npm publish`.

## Running unit tests

From `zeppelin-web-angular/`, run the focused real-pivot and SVG chart contracts:

```sh
npm run test:shell -- projects/zeppelin-visualization/src/echarts-option.spec.ts src/app/visualizations/scatter-chart/scatter-chart-visualization.component.spec.ts
```

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
