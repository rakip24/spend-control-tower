import { Component, input, output, computed } from '@angular/core';
import { DrilldownContext } from '../../models';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-drilldown-panel',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="drilldown-overlay" [class.active]="visible()" (click)="closed.emit()"></div>
    <div class="drilldown-panel" [class.active]="visible()">
      <button class="dd-close" (click)="closed.emit()">✕</button>

      @if (context(); as ctx) {
        <div class="dd-header">
          <div class="dd-breadcrumb">{{ ctx.breadcrumb }}</div>
          <h2>{{ ctx.title }}</h2>
          <div class="dd-stats">
            <div class="dd-stat"><strong>{{ ctx.totalAmount | currency:'USD':'symbol':'1.0-0' }}</strong> total</div>
            <div class="dd-stat"><strong>{{ ctx.transactionCount }}</strong> transactions</div>
            <div class="dd-stat dd-stat-red"><strong>{{ 100 - ctx.compliancePct }}%</strong> non-compliant</div>
          </div>
        </div>

        <div class="dd-section">
          <div class="dd-section-title">Root Cause Analysis</div>
          <div class="root-cause-chips">
            @for (chip of ctx.rootCauses; track chip.label) {
              <div class="rc-chip" [class]="'rc-' + chip.color">{{ chip.label }}</div>
            }
          </div>
        </div>

        <div class="dd-section">
          <div class="dd-section-title">Transaction Detail</div>
          <table class="dd-table">
            <thead>
              <tr><th>Date</th><th>Vendor</th><th>Amount</th><th>PO</th><th>Compliant</th></tr>
            </thead>
            <tbody>
              @for (txn of ctx.transactions; track txn.transaction_id) {
                <tr>
                  <td>{{ txn.transaction_date }}</td>
                  <td>{{ txn.vendor_name }}</td>
                  <td>{{ txn.amount_usd | currency:'USD':'symbol':'1.0-0' }}</td>
                  <td [class.no-po]="!txn.po_number">{{ txn.po_number || '——' }}</td>
                  <td>
                    @if (txn.compliance_flag) {
                      <span class="compliance-yes">✓</span>
                    } @else {
                      <span class="compliance-no">✗</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="dd-section">
          <div class="dd-section-title">Recommended Actions</div>
          @for (action of ctx.actions; track action.number) {
            <div class="action-card">
              <div class="action-number">{{ action.number }}</div>
              <div class="action-text" [innerHTML]="action.text"></div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './drilldown-panel.component.scss',
})
export class DrilldownPanelComponent {
  visible = input.required<boolean>();
  context = input.required<DrilldownContext | null>();
  closed = output<void>();
}
