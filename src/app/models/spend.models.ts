// ── Core data models for the Spend Intelligence Dashboard ──

export interface SpendTransaction {
  transaction_id: string;
  po_number: string | null;
  transaction_date: string;
  fiscal_quarter: string;
  vendor_id: string;
  vendor_name: string;
  vendor_tier: VendorTier;
  category_l1: string;
  category_l2: string;
  category_l3: string;
  cost_center: string;
  department: string;
  region: Region;
  country: string;
  currency: string;
  amount_local: number;
  amount_usd: number;
  contract_id: string | null;
  contract_status: ContractStatus;
  payment_terms: string;
  compliance_flag: boolean;
  maverick_flag: boolean;
  budget_code: string;
  approver: string;
  source_system: SourceSystem;
}

export type VendorTier = 'Strategic' | 'Preferred' | 'Tactical' | 'Tail';
export type Region = 'North America' | 'EMEA' | 'APAC' | 'LATAM';
export type ContractStatus = 'Active' | 'Expiring' | 'Expired' | 'None';
export type SourceSystem = 'ERP' | 'P2P' | 'PCard' | 'Manual';

export interface AggregateSummary {
  total_annual_spend_usd: number;
  vendor_count: number;
  transaction_count: number;
  spend_by_category_l1: Record<string, number>;
  spend_by_region: Record<string, number>;
  spend_by_vendor_tier: Record<string, number>;
  compliance_rate: number;
  maverick_spend_rate: number;
  contracts_expiring_next_90_days: number;
  contracts_expiring_value_usd: number;
  avg_payment_cycle_days: number;
  pcard_unclassified_spend_usd: number;
  null_po_transactions_pct: number;
  duplicate_invoice_risk_pct: number;
}

export interface SpendDataset {
  company_profile: CompanyProfile;
  transactions: SpendTransaction[];
  aggregate_summary: AggregateSummary;
}

export interface CompanyProfile {
  name: string;
  industry: string;
  annual_revenue: string;
  headcount: number;
  regions: string[];
  fiscal_year: string;
}

// ── View Models ──

export interface BBNCard {
  id: string;
  label: string;
  value: string;
  delta: string;
  deltaDirection: 'up' | 'down' | 'neutral';
  severity: 'on-track' | 'warning' | 'critical';
  context: string;
}

export interface NarrativeInsight {
  id: number;
  headline: string;
  implication: string;
}

export interface SankeyNode {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  column: 'region' | 'category' | 'tier';
  colorClass: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  isMaverick: boolean;
}

export interface HeatmapCell {
  category: string;
  region: string;
  value: number;
  formattedValue: string;
  intensity: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface ContractExpiration {
  month: string;
  value: number;
  formattedValue: string;
  count: number;
  severity: 'critical' | 'warning' | 'ok';
  widthPct: number;
}

export interface DrilldownContext {
  breadcrumb: string;
  title: string;
  totalAmount: number;
  transactionCount: number;
  compliancePct: number;
  rootCauses: RootCauseChip[];
  transactions: SpendTransaction[];
  actions: RecommendedAction[];
}

export interface RootCauseChip {
  label: string;
  color: 'red' | 'amber' | 'purple';
}

export interface RecommendedAction {
  number: number;
  text: string;
}

export interface NLQueryResponse {
  query: string;
  type: 'waterfall' | 'table' | 'text';
  waterfallRows?: WaterfallRow[];
  tableRows?: Record<string, string>[];
  explanation: string;
}

export interface WaterfallRow {
  label: string;
  value: string;
  widthPct: number;
  type: 'baseline' | 'negative' | 'positive';
}

export interface DirtyDataAlert {
  risk: string;
  prevalence: string;
  impact: string;
  value?: number;
}

// ── Data Source Configuration ──

export interface DataSourceConfig {
  type: 'local' | 'rest' | 'graphql' | 'file-upload';
  baseUrl?: string;
  authToken?: string;
  headers?: Record<string, string>;
  refreshIntervalMs?: number;
}
