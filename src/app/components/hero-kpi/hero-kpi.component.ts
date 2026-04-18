import { Component, input } from '@angular/core';
import { HeroKpi } from '../../models';

@Component({
  selector: 'app-hero-kpi',
  standalone: true,
  template: `
    <div class="hero-card" [style.--accent]="kpi().accent">
      <div class="hero-icon">{{ kpi().icon }}</div>
      <div class="hero-body">
        <div class="hero-label">{{ kpi().label }}</div>
        <div class="hero-value">{{ kpi().value }}</div>
        <div class="hero-subtitle">{{ kpi().subtitle }}</div>
      </div>
      <div class="hero-accent-bar"></div>
    </div>
  `,
  styleUrl: './hero-kpi.component.scss',
})
export class HeroKpiComponent {
  kpi = input.required<HeroKpi>();
}
