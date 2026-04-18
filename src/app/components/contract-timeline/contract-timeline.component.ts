import { Component, input } from '@angular/core';
import { ContractExpiration } from '../../models';

@Component({
  selector: 'app-contract-timeline',
  standalone: true,
  template: `
    <div class="viz-card">
      <div class="viz-header">
        <div>
          <div class="viz-title">Contract Expiration Cliff</div>
          <div class="viz-subtitle">Next 6 months · sorted by value at risk</div>
        </div>
      </div>
      <div class="timeline-bars">
        @for (item of data(); track item.month) {
          <div class="timeline-row">
            <div class="timeline-label">{{ item.month }}</div>
            <div class="timeline-bar-bg">
              <div class="timeline-bar"
                   [class]="'bar-' + item.severity"
                   [style.width.%]="item.widthPct">
                {{ item.formattedValue }} · {{ item.count }} contracts
              </div>
              <span class="timeline-indicator">
                {{ item.severity === 'critical' ? '🔴' : item.severity === 'warning' ? '🟡' : '🟢' }}
              </span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './contract-timeline.component.scss',
})
export class ContractTimelineComponent {
  data = input.required<ContractExpiration[]>();
}
