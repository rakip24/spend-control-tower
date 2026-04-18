import { Component, input, output } from '@angular/core';
import { HeatmapCell } from '../../models';

@Component({
  selector: 'app-heatmap',
  standalone: true,
  template: `
    <div class="viz-card">
      <div class="viz-header">
        <div>
          <div class="viz-title">Spend Intensity: Category × Region</div>
          <div class="viz-subtitle">Color = relative spend density. Click to drill down.</div>
        </div>
      </div>
      <div class="heatmap-grid">
        <!-- Header row -->
        <div class="heatmap-label"></div>
        @for (r of regions(); track r) {
          <div class="heatmap-header">{{ r }}</div>
        }

        <!-- Data rows -->
        @for (cat of categories(); track cat) {
          <div class="heatmap-label">{{ cat }}</div>
          @for (r of regions(); track r) {
            @let cell = getCell(cat, r);
            <div class="heatmap-cell"
                 [class]="'heat-' + cell.intensity"
                 (click)="cellClicked.emit(cell)">
              {{ cell.formattedValue }}
            </div>
          }
        }
      </div>
    </div>
  `,
  styleUrl: './heatmap.component.scss',
})
export class HeatmapComponent {
  cells = input.required<HeatmapCell[]>();
  categories = input.required<string[]>();
  regions = input.required<string[]>();
  cellClicked = output<HeatmapCell>();

  getCell(category: string, region: string): HeatmapCell {
    return this.cells().find(c => c.category === category && c.region === region)
      || { category, region, value: 0, formattedValue: '—', intensity: 0 };
  }
}
