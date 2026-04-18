import { Component, input } from '@angular/core';
import { NarrativeInsight } from '../../models';

@Component({
  selector: 'app-narrative-card',
  standalone: true,
  template: `
    @let n = narrative();
    <div class="narrative-card">
      <span class="n-number">{{ n.id }}</span>
      <div class="n-text">"{{ n.headline }}"</div>
      <div class="n-implication">{{ n.implication }}</div>
    </div>
  `,
  styleUrl: './narrative-card.component.scss',
})
export class NarrativeCardComponent {
  narrative = input.required<NarrativeInsight>();
}
