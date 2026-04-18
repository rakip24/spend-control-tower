import { Component, input } from '@angular/core';
import { DirtyDataAlert } from '../../models';

@Component({
  selector: 'app-dirty-data-banner',
  standalone: true,
  template: `
    <div class="dirty-data-banner">
      <span class="ddb-icon">⚠</span>
      <span class="ddb-text">
        <strong>Data quality notice:</strong>
        @for (alert of alerts(); track alert.risk) {
          {{ alert.risk }} ({{ alert.prevalence }}, {{ alert.impact }}).
        }
      </span>
      <button class="ddb-toggle" (click)="expanded = !expanded">
        {{ expanded ? 'Hide' : 'Show Details' }}
      </button>
    </div>

    @if (expanded) {
      <div class="dirty-data-detail">
        <table>
          <thead>
            <tr><th>Risk</th><th>Prevalence</th><th>Impact</th></tr>
          </thead>
          <tbody>
            @for (alert of alerts(); track alert.risk) {
              <tr>
                <td>{{ alert.risk }}</td>
                <td>{{ alert.prevalence }}</td>
                <td>{{ alert.impact }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styleUrl: './dirty-data-banner.component.scss',
})
export class DirtyDataBannerComponent {
  alerts = input.required<DirtyDataAlert[]>();
  expanded = false;
}
