import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataSourceConfig } from '../../models';

@Component({
  selector: 'app-data-source-config',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="config-overlay" [class.active]="visible()" (click)="closed.emit()"></div>
    <div class="config-panel" [class.active]="visible()">
      <button class="config-close" (click)="closed.emit()">✕</button>

      <h2>Data Source Configuration</h2>
      <p class="config-desc">Connect this dashboard to any data source. Upload a JSON file, connect to a REST API, or use GraphQL.</p>

      <div class="config-tabs">
        <button [class.active]="activeTab === 'local'" (click)="activeTab = 'local'">Sample Data</button>
        <button [class.active]="activeTab === 'upload'" (click)="activeTab = 'upload'">File Upload</button>
        <button [class.active]="activeTab === 'rest'" (click)="activeTab = 'rest'">REST API</button>
        <button [class.active]="activeTab === 'graphql'" (click)="activeTab = 'graphql'">GraphQL</button>
      </div>

      @if (activeTab === 'local') {
        <div class="config-section">
          <p>Use the built-in sample dataset (GenoVis Sciences genomics spend data).</p>
          <button class="config-btn primary" (click)="applyConfig({ type: 'local' })">Load Sample Data</button>
        </div>
      }

      @if (activeTab === 'upload') {
        <div class="config-section">
          <p>Upload a JSON file matching the spend data schema.</p>
          <div class="file-drop"
               (dragover)="onDragOver($event)"
               (drop)="onDrop($event)"
               (click)="fileInput.click()">
            <span class="drop-icon">📁</span>
            <span>Drop JSON file here or click to browse</span>
          </div>
          <input type="file" #fileInput accept=".json" (change)="onFileSelected($event)" style="display:none" />
        </div>
      }

      @if (activeTab === 'rest') {
        <div class="config-section">
          <label>API Base URL</label>
          <input type="text" [(ngModel)]="restUrl" placeholder="https://api.example.com" />
          <label>Auth Token (optional)</label>
          <input type="password" [(ngModel)]="authToken" placeholder="Bearer token" />
          <label>Refresh Interval (seconds)</label>
          <input type="number" [(ngModel)]="refreshInterval" placeholder="300" />
          <button class="config-btn primary" (click)="applyConfig({ type: 'rest', baseUrl: restUrl, authToken: authToken, refreshIntervalMs: refreshInterval * 1000 })">
            Connect
          </button>
        </div>
      }

      @if (activeTab === 'graphql') {
        <div class="config-section">
          <label>GraphQL Endpoint</label>
          <input type="text" [(ngModel)]="graphqlUrl" placeholder="https://api.example.com/graphql" />
          <label>Auth Token (optional)</label>
          <input type="password" [(ngModel)]="authToken" placeholder="Bearer token" />
          <button class="config-btn primary" (click)="applyConfig({ type: 'graphql', baseUrl: graphqlUrl, authToken: authToken })">
            Connect
          </button>
        </div>
      }

      <div class="schema-info">
        <h3>Expected Schema</h3>
        <pre>{{ schemaHint }}</pre>
      </div>
    </div>
  `,
  styleUrl: './data-source-config.component.scss',
})
export class DataSourceConfigComponent {
  visible = signal(false);
  closed = output<void>();
  configApplied = output<DataSourceConfig>();
  fileUploaded = output<File>();

  activeTab: 'local' | 'upload' | 'rest' | 'graphql' = 'local';
  restUrl = '';
  graphqlUrl = '';
  authToken = '';
  refreshInterval = 300;

  schemaHint = `{
  "company_profile": { "name": "...", ... },
  "transactions": [
    {
      "transaction_id": "...",
      "vendor_name": "...",
      "amount_usd": 12345.00,
      "region": "North America",
      "vendor_tier": "Strategic",
      ...
    }
  ],
  "aggregate_summary": {
    "total_annual_spend_usd": 1820000000,
    "compliance_rate": 0.82,
    ...
  }
}`;

  applyConfig(config: DataSourceConfig): void {
    this.configApplied.emit(config);
    this.closed.emit();
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files?.length) {
      this.fileUploaded.emit(files[0]);
      this.closed.emit();
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) {
      this.fileUploaded.emit(input.files[0]);
      this.closed.emit();
    }
  }
}
