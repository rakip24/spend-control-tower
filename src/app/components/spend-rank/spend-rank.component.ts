import { Component, input, output } from '@angular/core';
import { SpendRankItem } from '../../models';

@Component({
  selector: 'app-spend-rank',
  standalone: true,
  template: `
    <div class="rank-card">
      <div class="rank-header">
        <div class="rank-icon">{{ icon() }}</div>
        <div>
          <div class="rank-title">{{ title() }}</div>
          <div class="rank-subtitle">{{ subtitle() }}</div>
        </div>
      </div>
      <div class="rank-list">
        @for (item of items(); track item.rank) {
          <div class="rank-row" (click)="itemClicked.emit(item.label)">
            <div class="rank-num">{{ item.rank }}</div>
            <div class="rank-body">
              <div class="rank-label-row">
                <span class="rank-label">{{ item.label }}</span>
                <span class="rank-value">{{ item.formattedValue }} · {{ item.pct }}%</span>
              </div>
              <div class="rank-bar-track">
                <div class="rank-bar-fill"
                     [style.width.%]="item.pct"
                     [style.background]="item.barColor">
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './spend-rank.component.scss',
})
export class SpendRankComponent {
  title = input.required<string>();
  subtitle = input<string>('');
  icon = input<string>('📊');
  items = input.required<SpendRankItem[]>();
  itemClicked = output<string>();
}
