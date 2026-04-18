import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-nl-search',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text"
             [(ngModel)]="queryText"
             (focus)="showSuggestions.set(true)"
             (blur)="hideSuggestionsDelayed()"
             (keydown.enter)="submitQuery()"
             placeholder="Ask your data a question… e.g. &quot;Why did compliance drop last quarter?&quot;"
             autocomplete="off" />

      @if (showSuggestions()) {
        <div class="search-suggestions">
          @for (s of suggestions; track s.query) {
            <div class="search-suggestion" (mousedown)="selectSuggestion(s)">
              <span class="query-icon">💬</span> {{ s.text }}
            </div>
          }
        </div>
      }
    </div>

    @if (activeResponse()) {
      <div class="nl-response" @fadeIn>
        <div class="nl-query">💬 "{{ activeResponse()!.query }}"</div>

        @if (activeResponse()!.type === 'waterfall' && activeResponse()!.waterfallRows) {
          <div class="waterfall">
            @for (row of activeResponse()!.waterfallRows; track row.label) {
              <div class="waterfall-row">
                <div class="wf-label" [class.wf-label-bold]="row.type === 'baseline' && $last">{{ row.label }}</div>
                <div class="wf-bar-container">
                  <div class="wf-bar" [class]="'wf-' + row.type" [style.width.%]="row.widthPct">
                    {{ row.value }}
                  </div>
                </div>
              </div>
            }
          </div>
        }

        @if (activeResponse()!.type === 'table' && activeResponse()!.tableRows) {
          <table class="nl-table">
            <thead>
              <tr>
                @for (key of getTableKeys(); track key) {
                  @if (key !== 'Detail') {
                    <th>{{ key }}</th>
                  }
                }
              </tr>
            </thead>
            <tbody>
              @for (row of activeResponse()!.tableRows; track row['#']) {
                <tr>
                  @for (key of getTableKeys(); track key) {
                    @if (key !== 'Detail') {
                      <td [innerHTML]="row[key]"></td>
                    }
                  }
                </tr>
                @if (row['Detail']) {
                  <tr class="detail-row">
                    <td [attr.colspan]="getTableKeys().length - 1">
                      <span class="detail-arrow">→</span> {{ row['Detail'] }}
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        }

        <div class="nl-explanation" [innerHTML]="activeResponse()!.explanation"></div>
        <button class="nl-close-btn" (click)="activeResponse.set(null)">Dismiss</button>
      </div>
    }
  `,
  styleUrl: './nl-search.component.scss',
})
export class NlSearchComponent {
  querySubmitted = output<string>();
  queryText = '';
  showSuggestions = signal(false);
  activeResponse = signal<any>(null);

  suggestions = [
    { query: 'compliance', text: 'Why did my compliance drop last quarter?' },
    { query: 'contracts', text: 'Which contracts should I prioritize for renewal this month?' },
    { query: 'tail', text: 'Show me all tail-spend vendors in APAC' },
    { query: 'cloud', text: "What's driving cloud infrastructure cost growth?" },
  ];

  hideSuggestionsDelayed() {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  selectSuggestion(s: { query: string; text: string }) {
    this.queryText = s.text;
    this.showSuggestions.set(false);
    this.querySubmitted.emit(this.queryText);
  }

  submitQuery() {
    if (this.queryText.trim()) {
      this.showSuggestions.set(false);
      this.querySubmitted.emit(this.queryText);
    }
  }

  getTableKeys(): string[] {
    const rows = this.activeResponse()?.tableRows;
    return rows?.length ? Object.keys(rows[0]) : [];
  }
}
