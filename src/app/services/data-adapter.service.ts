import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  SpendDataset,
  SpendTransaction,
  AggregateSummary,
  CompanyProfile,
  DataSourceConfig,
} from '../models';
import { SAMPLE_COMPANY, SAMPLE_TRANSACTIONS, SAMPLE_AGGREGATE } from './sample-data';

@Injectable({ providedIn: 'root' })
export class DataAdapterService {
  private config = signal<DataSourceConfig>({ type: 'local' });

  readonly companyProfile = signal<CompanyProfile>(SAMPLE_COMPANY);
  readonly transactions = signal<SpendTransaction[]>(SAMPLE_TRANSACTIONS);
  readonly aggregate = signal<AggregateSummary>(SAMPLE_AGGREGATE);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastRefresh = signal<Date>(new Date());
  readonly dataSourceLabel = computed(() => {
    const c = this.config();
    switch (c.type) {
      case 'local':
        return 'Local Sample Data';
      case 'rest':
        return `REST API · ${c.baseUrl}`;
      case 'graphql':
        return `GraphQL · ${c.baseUrl}`;
      case 'file-upload':
        return 'Uploaded File';
      default:
        return 'Unknown';
    }
  });

  constructor(private http: HttpClient) {}

  configure(config: DataSourceConfig): void {
    this.config.set(config);
    this.loadData();
  }

  async loadData(): Promise<void> {
    const cfg = this.config();
    this.isLoading.set(true);
    this.error.set(null);

    try {
      switch (cfg.type) {
        case 'local':
          this.loadLocalData();
          break;
        case 'rest':
          await this.loadFromRest(cfg);
          break;
        case 'graphql':
          await this.loadFromGraphQL(cfg);
          break;
        case 'file-upload':
          break; // handled by loadFromFile()
      }
      this.lastRefresh.set(new Date());
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load data');
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Load from an uploaded JSON file */
  loadFromFile(file: File): void {
    this.isLoading.set(true);
    this.error.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as SpendDataset;
        this.applyDataset(data);
        this.config.set({ type: 'file-upload' });
        this.lastRefresh.set(new Date());
      } catch (e: any) {
        this.error.set('Invalid JSON format: ' + e?.message);
      } finally {
        this.isLoading.set(false);
      }
    };
    reader.onerror = () => {
      this.error.set('Failed to read file');
      this.isLoading.set(false);
    };
    reader.readAsText(file);
  }

  /** Load from raw JSON (e.g. pasted) */
  loadFromJson(json: string): void {
    try {
      const data = JSON.parse(json) as SpendDataset;
      this.applyDataset(data);
      this.config.set({ type: 'file-upload' });
      this.lastRefresh.set(new Date());
    } catch (e: any) {
      this.error.set('Invalid JSON: ' + e?.message);
    }
  }

  private loadLocalData(): void {
    this.companyProfile.set(SAMPLE_COMPANY);
    this.transactions.set(SAMPLE_TRANSACTIONS);
    this.aggregate.set(SAMPLE_AGGREGATE);
  }

  private async loadFromRest(cfg: DataSourceConfig): Promise<void> {
    const headers: Record<string, string> = { ...cfg.headers };
    if (cfg.authToken) {
      headers['Authorization'] = `Bearer ${cfg.authToken}`;
    }

    const data = await this.http
      .get<SpendDataset>(cfg.baseUrl + '/api/spend-data', { headers })
      .toPromise();

    if (data) {
      this.applyDataset(data);
    }
  }

  private async loadFromGraphQL(cfg: DataSourceConfig): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...cfg.headers,
    };
    if (cfg.authToken) {
      headers['Authorization'] = `Bearer ${cfg.authToken}`;
    }

    const query = `
      query {
        spendDataset {
          company_profile { name industry annual_revenue headcount regions fiscal_year }
          transactions { transaction_id po_number transaction_date fiscal_quarter vendor_id vendor_name vendor_tier category_l1 category_l2 category_l3 cost_center department region country currency amount_local amount_usd contract_id contract_status payment_terms compliance_flag maverick_flag budget_code approver source_system }
          aggregate_summary { total_annual_spend_usd vendor_count transaction_count compliance_rate maverick_spend_rate contracts_expiring_next_90_days contracts_expiring_value_usd avg_payment_cycle_days pcard_unclassified_spend_usd null_po_transactions_pct duplicate_invoice_risk_pct }
        }
      }
    `;

    const result = await this.http
      .post<{ data: { spendDataset: SpendDataset } }>(cfg.baseUrl!, { query }, { headers })
      .toPromise();

    if (result?.data?.spendDataset) {
      this.applyDataset(result.data.spendDataset);
    }
  }

  private applyDataset(data: SpendDataset): void {
    if (data.company_profile) this.companyProfile.set(data.company_profile);
    if (data.transactions) this.transactions.set(data.transactions);
    if (data.aggregate_summary) this.aggregate.set(data.aggregate_summary);
  }
}
