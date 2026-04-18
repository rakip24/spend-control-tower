import { Component, input } from '@angular/core';
import { BBNCard } from '../../models';

@Component({
  selector: 'app-bbn-card',
  standalone: true,
  template: `
    @let c = card();
    <div class="bbn-card" [class]="'bbn-card severity-' + c.severity" (click)="onClick()">
      <div class="glow" [class]="'glow-' + c.severity"></div>
      <span class="badge" [class]="'badge-' + c.severity">
        {{ c.severity === 'on-track' ? 'On Track' : c.severity === 'warning' ? 'Warning' : 'Critical' }}
      </span>
      <div class="metric-label">{{ c.label }}</div>
      <div class="metric-value" [class]="'value-' + c.severity">{{ c.value }}</div>
      <div class="metric-delta" [class]="'delta-' + c.deltaDirection">{{ c.delta }}</div>
      <div class="metric-context">{{ c.context }}</div>
    </div>
  `,
  styleUrl: './bbn-card.component.scss',
})
export class BbnCardComponent {
  card = input.required<BBNCard>();
  onClick() {}
}
