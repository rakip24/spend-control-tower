import { Injectable, computed } from '@angular/core';
import { DataAdapterService } from './data-adapter.service';
import {
  BBNCard,
  NarrativeInsight,
  SankeyNode,
  SankeyLink,
  HeatmapCell,
  ContractExpiration,
  DrilldownContext,
  NLQueryResponse,
  DirtyDataAlert,
  AggregateSummary,
  SpendRankItem,
  HeroKpi,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private data: DataAdapterService) {}

  // ── BBN Cards (Level 1) ──

  readonly bbnCards = computed<BBNCard[]>(() => {
    const agg = this.data.aggregate();
    return [
      {
        id: 'total-spend',
        label: 'Total Addressable Spend',
        value: this.formatCurrency(agg.total_annual_spend_usd),
        delta: '▲ 7.2% YoY',
        deltaDirection: 'up' as const,
        severity: 'on-track' as const,
        context: `Across ${agg.vendor_count.toLocaleString()} vendors · ${(agg.transaction_count / 1000).toFixed(0)}K transactions · ${this.data.companyProfile().regions.length} regions`,
      },
      {
        id: 'compliance',
        label: 'Compliance Rate',
        value: `${Math.round(agg.compliance_rate * 100)}%`,
        delta: '▼ 3pp vs Q1',
        deltaDirection: 'down' as const,
        severity: agg.compliance_rate >= 0.9 ? 'on-track' as const : agg.compliance_rate >= 0.8 ? 'warning' as const : 'critical' as const,
        context: `${Math.round(agg.maverick_spend_rate * 100)}% maverick · APAC compliance at 64% (lowest)`,
      },
      {
        id: 'contracts-expiring',
        label: 'Contracts Expiring (90d)',
        value: `${agg.contracts_expiring_next_90_days}`,
        delta: this.formatCurrency(agg.contracts_expiring_value_usd) + ' at risk',
        deltaDirection: 'neutral' as const,
        severity: agg.contracts_expiring_next_90_days > 30 ? 'critical' as const : agg.contracts_expiring_next_90_days > 15 ? 'warning' as const : 'on-track' as const,
        context: 'Includes 3 sole-source strategic vendors',
      },
    ];
  });

  // ── Narratives ──

  readonly narratives = computed<NarrativeInsight[]>(() => {
    const agg = this.data.aggregate();
    const txns = this.data.transactions();
    const total = agg.total_annual_spend_usd;

    // ── Narrative 1: Vendor concentration + contract risk ──
    const tierEntries = Object.entries(agg.spend_by_vendor_tier);
    const strategicEntry = tierEntries.find(([k]) => k.toLowerCase().includes('strategic'));
    const strategicPct = strategicEntry ? Math.round((strategicEntry[1] / total) * 100) : 0;
    const strategicLabel = strategicEntry ? strategicEntry[0].match(/\(([^)]+)\)/)?.[1] ?? 'top vendors' : 'top vendors';

    // ── Narrative 2: Biggest category + maverick rate ──
    const catEntries = Object.entries(agg.spend_by_category_l1).sort((a, b) => b[1] - a[1]);
    const topCat = catEntries[0];
    const topCatName = topCat?.[0] ?? 'Unknown';
    const topCatCentsPerDollar = topCat ? Math.round((topCat[1] / total) * 100) : 0;
    const maverickPct = Math.round(agg.maverick_spend_rate * 100);

    // ── Narrative 3: Fastest-growing & lowest-compliance region ──
    const regionEntries = Object.entries(agg.spend_by_region).sort((a, b) => b[1] - a[1]);
    const topRegion = regionEntries[0];
    const topRegionName = topRegion?.[0] ?? 'Unknown';
    const topRegionPct = topRegion ? Math.round((topRegion[1] / total) * 100) : 0;
    // Find smallest region (proxy for fastest-growing since we lack historical data)
    const smallestRegion = regionEntries[regionEntries.length - 1];
    const smallestRegionName = smallestRegion?.[0] ?? 'Unknown';
    // Derive per-region compliance from transactions if available
    const regionCompliance = this.computeRegionCompliance(txns, regionEntries.map(([r]) => r));
    const lowestComplianceRegion = Object.entries(regionCompliance).sort((a, b) => a[1] - b[1])[0];
    const highestComplianceRegion = Object.entries(regionCompliance).sort((a, b) => b[1] - a[1])[0];

    // ── Narrative 4: Second-largest or fastest-growing category ──
    const secondCat = catEntries.length > 1 ? catEntries[1] : catEntries[0];
    const secondCatName = secondCat?.[0] ?? 'Unknown';
    const secondCatMonthly = secondCat ? this.formatCurrency(Math.round(secondCat[1] / 12)) : '$0';

    // ── Narrative 5: Data quality signals ──
    const nullPoPct = Math.round(agg.null_po_transactions_pct * 100);
    const nullPoTxnCount = Math.round(agg.transaction_count * agg.null_po_transactions_pct).toLocaleString();
    const pcardTxns = txns.filter(t => t.source_system === 'PCard');
    const manualTxns = txns.filter(t => t.source_system === 'Manual');
    const lowVisibilityPct = txns.length > 0
      ? Math.round(((pcardTxns.length + manualTxns.length) / txns.length) * 100)
      : 78; // fallback from aggregate pattern

    return [
      {
        id: 1,
        headline: `Your ${strategicLabel} deliver ${strategicPct}% of spend — but ${this.formatCurrency(agg.contracts_expiring_value_usd)} of contracts expire within 90 days.`,
        implication: `${agg.contracts_expiring_next_90_days} contracts are in the renegotiation window NOW. Delay risks auto-renewals at stale terms while input-cost inflation compounds.`,
      },
      {
        id: 2,
        headline: `${topCatName} consumes ${topCatCentsPerDollar}¢ of every dollar, yet ${maverickPct}% of spend is maverick — no PO, no contract.`,
        implication: `Uncontrolled sourcing in your largest category (${this.formatCurrency(topCat?.[1] ?? 0)}) creates compliance risk and inflates unit costs through fragmented ordering.`,
      },
      {
        id: 3,
        headline: lowestComplianceRegion && highestComplianceRegion && lowestComplianceRegion[0] !== highestComplianceRegion[0]
          ? `${lowestComplianceRegion[0]} compliance is only ${lowestComplianceRegion[1]}% vs. ${highestComplianceRegion[1]}% in ${highestComplianceRegion[0]}.`
          : `Overall compliance rate is ${Math.round(agg.compliance_rate * 100)}% — ${regionEntries.length} regions need harmonised controls.`,
        implication: lowestComplianceRegion && lowestComplianceRegion[1] < 80
          ? `Rapid spend in ${lowestComplianceRegion[0]} (${this.formatCurrency(agg.spend_by_region[lowestComplianceRegion[0]] ?? 0)}) is outpacing procurement's ability to onboard vendors with proper documentation.`
          : `Closing the compliance gap across all ${regionEntries.length} regions would bring ${this.formatCurrency(Math.round(total * (1 - agg.compliance_rate)))} of non-compliant spend under control.`,
      },
      {
        id: 4,
        headline: `${secondCatName} runs ${secondCatMonthly}/month — the ${catEntries.indexOf(secondCat!) + 1 === 2 ? 'second' : 'next'}-largest category at ${secondCat ? Math.round((secondCat[1] / total) * 100) : 0}% of total spend.`,
        implication: `Combined with ${topCatName}, the top two categories represent ${topCat && secondCat ? Math.round(((topCat[1] + secondCat[1]) / total) * 100) : 0}% of addressable spend — strategic sourcing here has the biggest ROI.`,
      },
      {
        id: 5,
        headline: `${nullPoPct}% of transactions (≈${nullPoTxnCount}) have no PO. ${lowVisibilityPct}% originate from PCard or manual entry.`,
        implication: `Every null-PO transaction is invisible to forecasting and multiplies duplicate-invoice risk (currently ${Math.round(agg.duplicate_invoice_risk_pct * 100)}% — ${this.formatCurrency(Math.round(total * agg.duplicate_invoice_risk_pct))} exposure).`,
      },
    ];
  });

  /**
   * Compute compliance rate per region from transaction-level data.
   * Falls back to heuristic estimates if sample is too small.
   */
  private computeRegionCompliance(txns: any[], regions: string[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const region of regions) {
      const regionTxns = txns.filter((t: any) => t.region === region);
      if (regionTxns.length >= 3) {
        const compliant = regionTxns.filter((t: any) => t.compliance_flag).length;
        result[region] = Math.round((compliant / regionTxns.length) * 100);
      } else {
        // Not enough transaction-level data — derive from aggregate compliance ± regional spread
        const overall = Math.round(this.data.aggregate().compliance_rate * 100);
        const regionSpend = this.data.aggregate().spend_by_region[region] || 0;
        const total = this.data.aggregate().total_annual_spend_usd;
        const share = total > 0 ? regionSpend / total : 0.25;
        // Larger regions tend toward mean; smaller regions have more variance
        result[region] = Math.round(overall + (share > 0.3 ? 5 : share < 0.1 ? -15 : -3));
      }
    }
    return result;
  }

  // ── Hero KPIs (Prominent Totals) ──

  readonly heroKpis = computed<HeroKpi[]>(() => {
    const agg = this.data.aggregate();
    const poSpend = agg.total_po_spend_usd ?? Math.round(agg.total_annual_spend_usd * (1 - agg.null_po_transactions_pct));
    const npoSpend = agg.total_npo_spend_usd ?? Math.round(agg.total_annual_spend_usd * agg.null_po_transactions_pct);
    const poPct = Math.round((poSpend / agg.total_annual_spend_usd) * 100);
    const npoPct = 100 - poPct;
    return [
      {
        id: 'total-spend',
        label: 'Total Spend',
        value: this.formatCurrency(agg.total_annual_spend_usd),
        icon: '💰',
        accent: 'var(--accent-blue)',
        subtitle: `${agg.vendor_count.toLocaleString()} vendors · ${(agg.transaction_count / 1000).toFixed(0)}K txns`,
      },
      {
        id: 'po-spend',
        label: 'Total PO Spend',
        value: this.formatCurrency(poSpend),
        icon: '📋',
        accent: 'var(--accent-green, #34d399)',
        subtitle: `${poPct}% of total · On-contract & compliant`,
      },
      {
        id: 'npo-spend',
        label: 'Total Non-PO Spend',
        value: this.formatCurrency(npoSpend),
        icon: '⚠️',
        accent: 'var(--accent-red, #f87171)',
        subtitle: `${npoPct}% of total · PCard, manual & maverick`,
      },
    ];
  });

  // ── Spend Rank Lists ──

  readonly topCategories = computed<SpendRankItem[]>(() => {
    const agg = this.data.aggregate();
    return this.buildRankList(agg.spend_by_category_l1, agg.total_annual_spend_usd, [
      '#4e8cff', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#60a5fa', '#38bdf8',
    ]);
  });

  readonly topVendors = computed<SpendRankItem[]>(() => {
    const agg = this.data.aggregate();
    const vendorSpend = agg.spend_by_vendor ?? {};
    return this.buildRankList(vendorSpend, agg.total_annual_spend_usd, [
      '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6',
    ]);
  });

  readonly topGlAccounts = computed<SpendRankItem[]>(() => {
    const agg = this.data.aggregate();
    const glSpend = agg.spend_by_gl_account ?? {};
    return this.buildRankList(glSpend, agg.total_annual_spend_usd, [
      '#fbbf24', '#f59e0b', '#f97316', '#fb923c', '#fdba74', '#fcd34d', '#fde68a', '#fef08a', '#fef9c3',
    ]);
  });

  readonly topEltMembers = computed<SpendRankItem[]>(() => {
    const agg = this.data.aggregate();
    const eltSpend = agg.spend_by_elt_member ?? {};
    return this.buildRankList(eltSpend, agg.total_annual_spend_usd, [
      '#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#e879f9',
    ]);
  });

  private buildRankList(data: Record<string, number>, total: number, colors: string[]): SpendRankItem[] {
    return Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value], i) => ({
        rank: i + 1,
        label,
        value,
        formattedValue: this.formatCurrency(value),
        pct: Math.round((value / total) * 100),
        barColor: colors[i % colors.length],
      }));
  }

  // ── Sankey Data (Level 2) ──

  readonly sankeyNodes = computed<SankeyNode[]>(() => {
    const agg = this.data.aggregate();
    const regions = agg.spend_by_region;
    const categories = agg.spend_by_category_l1;
    const total = agg.total_annual_spend_usd;

    const regionNodes: SankeyNode[] = Object.entries(regions).map(([name, val]) => ({
      id: `r-${name}`,
      label: name,
      value: val,
      formattedValue: `${this.formatCurrency(val)} · ${Math.round((val / total) * 100)}%`,
      column: 'region' as const,
      colorClass: this.regionColorClass(name),
    }));

    const topCategories = Object.entries(categories).slice(0, 4);
    const catNodes: SankeyNode[] = topCategories.map(([name, val]) => ({
      id: `c-${name}`,
      label: name.length > 18 ? name.substring(0, 16) + '…' : name,
      value: val,
      formattedValue: `${this.formatCurrency(val)} · ${Math.round((val / total) * 100)}%`,
      column: 'category' as const,
      colorClass: this.categoryColorClass(name),
    }));

    const tierNodes: SankeyNode[] = [
      { id: 't-strategic', label: 'Strategic', value: 1001000000, formattedValue: '$1.0B · 55%', column: 'tier' as const, colorClass: 'node-strategic' },
      { id: 't-preferred', label: 'Preferred', value: 491400000, formattedValue: '$491M · 27%', column: 'tier' as const, colorClass: 'node-preferred' },
      { id: 't-tactical', label: 'Tactical', value: 218400000, formattedValue: '$218M · 12%', column: 'tier' as const, colorClass: 'node-tactical' },
      { id: 't-tail', label: 'Tail ⚠', value: 109200000, formattedValue: '$109M · 6%', column: 'tier' as const, colorClass: 'node-tail' },
    ];

    return [...regionNodes, ...catNodes, ...tierNodes];
  });

  readonly sankeyLinks = computed<SankeyLink[]>(() => [
    { source: 'r-North America', target: 'c-Lab Consumables', value: 437000000, isMaverick: false },
    { source: 'r-North America', target: 'c-Capital Equipment', value: 218000000, isMaverick: false },
    { source: 'r-North America', target: 'c-IT & Cloud', value: 191000000, isMaverick: false },
    { source: 'r-EMEA', target: 'c-Lab Consumables', value: 175000000, isMaverick: false },
    { source: 'r-EMEA', target: 'c-Facilities & Real Estate', value: 55000000, isMaverick: false },
    { source: 'r-APAC', target: 'c-Lab Consumables', value: 95000000, isMaverick: false },
    { source: 'r-LATAM', target: 'c-Lab Consumables', value: 21000000, isMaverick: false },
    { source: 'c-Lab Consumables', target: 't-strategic', value: 400000000, isMaverick: false },
    { source: 'c-Lab Consumables', target: 't-preferred', value: 220000000, isMaverick: false },
    { source: 'c-Lab Consumables', target: 't-tail', value: 60000000, isMaverick: true },
    { source: 'c-Capital Equipment', target: 't-strategic', value: 200000000, isMaverick: false },
    { source: 'c-IT & Cloud', target: 't-strategic', value: 180000000, isMaverick: false },
    { source: 'c-Facilities & Real Estate', target: 't-tactical', value: 100000000, isMaverick: false },
  ]);

  // ── Heatmap Data ──

  readonly heatmapData = computed<HeatmapCell[]>(() => {
    const cells: HeatmapCell[] = [
      { category: 'Lab Consumables', region: 'NA', value: 437000000, formattedValue: '$437M', intensity: 5 },
      { category: 'Lab Consumables', region: 'EMEA', value: 175000000, formattedValue: '$175M', intensity: 4 },
      { category: 'Lab Consumables', region: 'APAC', value: 95000000, formattedValue: '$95M', intensity: 3 },
      { category: 'Lab Consumables', region: 'LATAM', value: 21000000, formattedValue: '$21M', intensity: 1 },
      { category: 'Capital Equip', region: 'NA', value: 218000000, formattedValue: '$218M', intensity: 4 },
      { category: 'Capital Equip', region: 'EMEA', value: 87000000, formattedValue: '$87M', intensity: 2 },
      { category: 'Capital Equip', region: 'APAC', value: 44000000, formattedValue: '$44M', intensity: 1 },
      { category: 'Capital Equip', region: 'LATAM', value: 15000000, formattedValue: '$15M', intensity: 0 },
      { category: 'IT & Cloud', region: 'NA', value: 191000000, formattedValue: '$191M', intensity: 5 },
      { category: 'IT & Cloud', region: 'EMEA', value: 49000000, formattedValue: '$49M', intensity: 2 },
      { category: 'IT & Cloud', region: 'APAC', value: 27000000, formattedValue: '$27M', intensity: 2 },
      { category: 'IT & Cloud', region: 'LATAM', value: 6000000, formattedValue: '$6M', intensity: 0 },
      { category: 'Facilities', region: 'NA', value: 91000000, formattedValue: '$91M', intensity: 3 },
      { category: 'Facilities', region: 'EMEA', value: 55000000, formattedValue: '$55M', intensity: 3 },
      { category: 'Facilities', region: 'APAC', value: 27000000, formattedValue: '$27M', intensity: 1 },
      { category: 'Facilities', region: 'LATAM', value: 9000000, formattedValue: '$9M', intensity: 1 },
      { category: 'Prof. Services', region: 'NA', value: 70000000, formattedValue: '$70M', intensity: 3 },
      { category: 'Prof. Services', region: 'EMEA', value: 38000000, formattedValue: '$38M', intensity: 2 },
      { category: 'Prof. Services', region: 'APAC', value: 15000000, formattedValue: '$15M', intensity: 1 },
      { category: 'Prof. Services', region: 'LATAM', value: 4000000, formattedValue: '$4M', intensity: 0 },
    ];
    return cells;
  });

  readonly heatmapCategories = computed(() => {
    const cats = new Set(this.heatmapData().map(c => c.category));
    return [...cats];
  });

  readonly heatmapRegions = computed(() => ['NA', 'EMEA', 'APAC', 'LATAM']);

  // ── Contract Timeline ──

  readonly contractTimeline = computed<ContractExpiration[]>(() => {
    const maxVal = 87000000;
    return [
      { month: 'April 2026', value: 87000000, formattedValue: '$87M', count: 12, severity: 'critical' as const, widthPct: 100 },
      { month: 'May 2026', value: 68000000, formattedValue: '$68M', count: 9, severity: 'critical' as const, widthPct: Math.round((68 / 87) * 100) },
      { month: 'June 2026', value: 38000000, formattedValue: '$38M', count: 7, severity: 'warning' as const, widthPct: Math.round((38 / 87) * 100) },
      { month: 'July 2026', value: 18000000, formattedValue: '$18M', count: 5, severity: 'ok' as const, widthPct: Math.round((18 / 87) * 100) },
      { month: 'August 2026', value: 12000000, formattedValue: '$12M', count: 4, severity: 'ok' as const, widthPct: Math.round((12 / 87) * 100) },
      { month: 'Sep 2026', value: 11000000, formattedValue: '$11M', count: 10, severity: 'warning' as const, widthPct: Math.round((11 / 87) * 100) },
    ];
  });

  // ── Drilldown Context ──

  buildDrilldown(source: string, context?: string): DrilldownContext {
    const txns = this.data.transactions();
    const agg = this.data.aggregate();

    // Route to different drilldown views based on source
    switch (source) {
      case 'bbn-total-spend':
        return this.buildSpendOverviewDrilldown(txns, agg);
      case 'bbn-compliance':
        return this.buildComplianceDrilldown(txns, agg);
      case 'bbn-contracts-expiring':
        return this.buildContractsDrilldown(txns, agg);
      case 'narrative-1':
        return this.buildContractsDrilldown(txns, agg);
      case 'narrative-2':
        return this.buildMaverickDrilldown(txns, agg);
      case 'narrative-3':
        return this.buildApacComplianceDrilldown(txns, agg);
      case 'narrative-4':
        return this.buildCloudSpendDrilldown(txns, agg);
      case 'narrative-5':
        return this.buildNullPoDrilldown(txns, agg);
      default:
        break;
    }

    // Sankey nodes: "r-North America", "c-Lab Consumables", "t-tail", etc.
    if (source.startsWith('r-')) {
      return this.buildRegionDrilldown(source.substring(2), txns, agg);
    }
    if (source.startsWith('c-')) {
      return this.buildCategoryDrilldown(source.substring(2), txns, agg);
    }
    if (source.startsWith('t-')) {
      return this.buildTierDrilldown(source.substring(2), txns, agg);
    }

    // Heatmap: "heatmap:Category|Region"
    if (source.startsWith('heatmap:')) {
      const [cat, region] = source.substring(8).split('|');
      return this.buildHeatmapDrilldown(cat, region, txns, agg);
    }

    // Fallback: tail-spend deep dive
    return this.buildTierDrilldown('tail', txns, agg);
  }

  private buildSpendOverviewDrilldown(txns: any[], agg: AggregateSummary): DrilldownContext {
    const regionEntries = Object.entries(agg.spend_by_region);
    const topRegion = regionEntries.sort((a, b) => b[1] - a[1])[0];
    return {
      breadcrumb: 'Total Spend → All Regions → All Categories',
      title: 'Spend Overview',
      totalAmount: agg.total_annual_spend_usd,
      transactionCount: agg.transaction_count,
      compliancePct: Math.round(agg.compliance_rate * 100),
      rootCauses: [
        { label: `Top region: ${topRegion[0]}`, color: 'purple' },
        { label: `${agg.vendor_count} vendors`, color: 'purple' },
        { label: `Avg ${agg.avg_payment_cycle_days}d pay cycle`, color: 'amber' },
        { label: `${Math.round(agg.maverick_spend_rate * 100)}% maverick`, color: 'red' },
      ],
      transactions: txns.sort((a, b) => b.amount_usd - a.amount_usd),
      actions: [
        { number: 1, text: '<strong>Consolidate vendor base</strong> — 91% of vendors (Tail tier) generate only 6% of spend but create disproportionate overhead.' },
        { number: 2, text: '<strong>Accelerate contract coverage</strong> — move compliance rate from 82% to 90% to unlock $65M in renegotiation leverage.' },
        { number: 3, text: '<strong>Implement spend analytics</strong> — classify the $23.4M in PCard/unclassified spend to improve forecasting accuracy.' },
      ],
    };
  }

  private buildComplianceDrilldown(txns: any[], agg: AggregateSummary): DrilldownContext {
    const nonCompliant = txns.filter(t => !t.compliance_flag);
    const maverick = txns.filter(t => t.maverick_flag);
    return {
      breadcrumb: 'Compliance Rate → Non-Compliant Transactions',
      title: 'Compliance Deep Dive',
      totalAmount: Math.round(agg.total_annual_spend_usd * (1 - agg.compliance_rate)),
      transactionCount: Math.round(agg.transaction_count * (1 - agg.compliance_rate)),
      compliancePct: Math.round(agg.compliance_rate * 100),
      rootCauses: [
        { label: `Maverick: ${Math.round(agg.maverick_spend_rate * 100)}%`, color: 'red' },
        { label: 'APAC compliance: 64%', color: 'red' },
        { label: `Null PO: ${Math.round(agg.null_po_transactions_pct * 100)}%`, color: 'red' },
        { label: 'PCard unclassified: $23M', color: 'amber' },
        { label: 'New vendors <90d: 28%', color: 'purple' },
      ],
      transactions: [...nonCompliant, ...maverick.filter(t => t.compliance_flag)].sort((a, b) => b.amount_usd - a.amount_usd),
      actions: [
        { number: 1, text: '<strong>Enforce PO requirement</strong> for all purchases >$1K to close the 9% null-PO gap.' },
        { number: 2, text: '<strong>Implement APAC vendor onboarding gate</strong> — require QA documentation before first PO.' },
        { number: 3, text: '<strong>Auto-route PCard spend >$5K</strong> to guided buying workflow for proper classification.' },
      ],
    };
  }

  private buildContractsDrilldown(txns: any[], agg: AggregateSummary): DrilldownContext {
    const expiringTxns = txns.filter(t => t.contract_status === 'Expiring');
    return {
      breadcrumb: 'Contracts → Expiring Within 90 Days',
      title: 'Contract Renewal Queue',
      totalAmount: agg.contracts_expiring_value_usd,
      transactionCount: agg.contracts_expiring_next_90_days,
      compliancePct: 100,
      rootCauses: [
        { label: `${agg.contracts_expiring_next_90_days} contracts`, color: 'red' },
        { label: `${this.formatCurrency(agg.contracts_expiring_value_usd)} at risk`, color: 'red' },
        { label: '3 sole-source vendors', color: 'amber' },
        { label: 'Auto-renewal risk', color: 'amber' },
      ],
      transactions: [
        ...expiringTxns,
        ...txns.filter(t => t.contract_status === 'Active').slice(0, 3),
      ].sort((a, b) => b.amount_usd - a.amount_usd),
      actions: [
        { number: 1, text: '<strong>Prioritize Integrated DNA Technologies</strong> (sole-source, expires Apr 28) — no backup supplier for oligo primers.' },
        { number: 2, text: '<strong>Begin Thermo Fisher renegotiation</strong> ($2.1M, expires May 02) — 3 departments depend on this SKU set.' },
        { number: 3, text: '<strong>Evaluate QIAGEN alternatives</strong> ($198K, expires May 15) — Bio-Rad is qualified but 8% more expensive.' },
      ],
    };
  }

  private buildMaverickDrilldown(txns: any[], agg: AggregateSummary): DrilldownContext {
    const maverickTxns = txns.filter(t => t.maverick_flag);
    return {
      breadcrumb: 'Lab Consumables → Maverick Spend',
      title: 'Off-Contract / Maverick Spend',
      totalAmount: Math.round(agg.spend_by_category_l1['Lab Consumables'] * agg.maverick_spend_rate),
      transactionCount: Math.round(agg.transaction_count * agg.maverick_spend_rate),
      compliancePct: 0,
      rootCauses: [
        { label: 'No PO: 73%', color: 'red' },
        { label: 'PCard: 61%', color: 'red' },
        { label: 'No Contract: 89%', color: 'red' },
        { label: 'Urgency bypass: 34%', color: 'amber' },
      ],
      transactions: maverickTxns.sort((a, b) => b.amount_usd - a.amount_usd),
      actions: [
        { number: 1, text: '<strong>Create guided buying catalog</strong> for top 50 Lab Consumable SKUs to channel scientists to contracted suppliers.' },
        { number: 2, text: '<strong>Limit PCard for lab purchases</strong> to emergency-only and cap at $2K with manager approval.' },
        { number: 3, text: '<strong>Quarterly maverick spend review</strong> with R&D leadership to address repeat offenders.' },
      ],
    };
  }

  private buildApacComplianceDrilldown(txns: any[], agg: AggregateSummary): DrilldownContext {
    const apacTxns = txns.filter(t => t.region === 'APAC');
    const apacNonCompliant = apacTxns.filter(t => !t.compliance_flag);
    return {
      breadcrumb: 'APAC → All Categories → Compliance Gap',
      title: 'APAC Compliance Gap Analysis',
      totalAmount: agg.spend_by_region['APAC'] || 236600000,
      transactionCount: Math.round(agg.transaction_count * 0.13),
      compliancePct: 64,
      rootCauses: [
        { label: 'Compliance: 64%', color: 'red' },
        { label: 'vs NA: 89%', color: 'amber' },
        { label: 'Growth: 31% QoQ', color: 'purple' },
        { label: 'New vendors: 42%', color: 'red' },
        { label: 'Missing QA docs: 58%', color: 'red' },
      ],
      transactions: [...apacTxns, ...this.generateSyntheticTailTxns()].sort((a, b) => b.amount_usd - a.amount_usd),
      actions: [
        { number: 1, text: '<strong>Require QA qualification</strong> for all new APAC vendors before first PO — close the 42% unvetted vendor gap.' },
        { number: 2, text: '<strong>Assign regional procurement lead</strong> in Shanghai to manage the custom synthesis vendor cluster.' },
        { number: 3, text: '<strong>Implement dual-source policy</strong> — no single APAC vendor should exceed 30% of a sub-category.' },
      ],
    };
  }

  private buildCloudSpendDrilldown(txns: any[], agg: AggregateSummary): DrilldownContext {
    const cloudTxns = txns.filter(t => t.category_l1 === 'IT & Cloud');
    return {
      breadcrumb: 'IT & Cloud → Cloud Infrastructure → Growth',
      title: 'Cloud Spend Trajectory',
      totalAmount: agg.spend_by_category_l1['IT & Cloud'] || 273000000,
      transactionCount: Math.round(agg.transaction_count * 0.08),
      compliancePct: 94,
      rootCauses: [
        { label: 'Growth: 22% QoQ', color: 'amber' },
        { label: 'AWS: $890K/mo', color: 'purple' },
        { label: 'No FinOps controls', color: 'red' },
        { label: 'Data Lake: 4.2PB', color: 'purple' },
      ],
      transactions: cloudTxns.sort((a, b) => b.amount_usd - a.amount_usd),
      actions: [
        { number: 1, text: '<strong>Implement FinOps practices</strong> — reserved instances could save 35% ($3.7M annually) on predictable compute workloads.' },
        { number: 2, text: '<strong>S3 lifecycle policies</strong> for cold sequencing data — move files >90 days to Glacier for 80% storage savings.' },
        { number: 3, text: '<strong>Use spot instances</strong> for batch genomic pipelines — typical 60-70% discount vs on-demand.' },
      ],
    };
  }

  private buildNullPoDrilldown(txns: any[], agg: AggregateSummary): DrilldownContext {
    const nullPoTxns = txns.filter(t => !t.po_number);
    return {
      breadcrumb: 'Data Quality → Null PO Transactions',
      title: 'Missing Purchase Orders',
      totalAmount: agg.pcard_unclassified_spend_usd,
      transactionCount: Math.round(agg.transaction_count * agg.null_po_transactions_pct),
      compliancePct: 12,
      rootCauses: [
        { label: `${Math.round(agg.null_po_transactions_pct * 100)}% of transactions`, color: 'red' },
        { label: 'PCard source: 61%', color: 'red' },
        { label: 'Manual entry: 17%', color: 'amber' },
        { label: `Duplicate risk: ${Math.round(agg.duplicate_invoice_risk_pct * 100)}%`, color: 'amber' },
      ],
      transactions: nullPoTxns.sort((a, b) => b.amount_usd - a.amount_usd),
      actions: [
        { number: 1, text: '<strong>Mandate PO for all purchases >$1K</strong> — currently 9% of spend flows through without any PO tracking.' },
        { number: 2, text: '<strong>Auto-generate POs from PCard feeds</strong> using AI classification to reduce the manual entry burden.' },
        { number: 3, text: '<strong>Run duplicate invoice detection</strong> — fuzzy-match on (vendor, amount, date ±3 days) to recover $54.6M exposure.' },
      ],
    };
  }

  private buildRegionDrilldown(region: string, txns: any[], agg: AggregateSummary): DrilldownContext {
    const regionTxns = txns.filter(t => t.region === region);
    const regionSpend = agg.spend_by_region[region] || 0;
    const compliantCount = regionTxns.filter(t => t.compliance_flag).length;
    const compliancePct = regionTxns.length > 0 ? Math.round((compliantCount / regionTxns.length) * 100) : 82;
    const regionCompliance: Record<string, number> = { 'North America': 89, 'EMEA': 86, 'APAC': 64, 'LATAM': 78 };
    return {
      breadcrumb: `${region} → All Categories → All Tiers`,
      title: `${region} Regional Spend`,
      totalAmount: regionSpend,
      transactionCount: Math.round(agg.transaction_count * (regionSpend / agg.total_annual_spend_usd)),
      compliancePct: regionCompliance[region] || compliancePct,
      rootCauses: [
        { label: `${this.formatCurrency(regionSpend)} total`, color: 'purple' },
        { label: `${Math.round((regionSpend / agg.total_annual_spend_usd) * 100)}% of global`, color: 'purple' },
        { label: `Compliance: ${regionCompliance[region] || compliancePct}%`, color: (regionCompliance[region] || compliancePct) < 80 ? 'red' : 'amber' },
        { label: `${regionTxns.filter(t => t.maverick_flag).length > 0 ? 'Has' : 'No'} maverick spend`, color: regionTxns.some(t => t.maverick_flag) ? 'red' : 'amber' },
      ],
      transactions: regionTxns.length > 0 ? regionTxns.sort((a, b) => b.amount_usd - a.amount_usd) : txns.filter(t => true).slice(0, 3),
      actions: [
        { number: 1, text: `<strong>Review ${region} vendor consolidation</strong> opportunities — reduce tail-spend fragmentation.` },
        { number: 2, text: `<strong>Benchmark ${region} pricing</strong> against global contracts to identify regional premium leakage.` },
        { number: 3, text: `<strong>Align ${region} payment terms</strong> — standardize to Net-30 where currently Net-45/60.` },
      ],
    };
  }

  private buildCategoryDrilldown(category: string, txns: any[], agg: AggregateSummary): DrilldownContext {
    const catTxns = txns.filter(t => t.category_l1 === category);
    const catSpend = agg.spend_by_category_l1[category] || 0;
    const compliantCount = catTxns.filter(t => t.compliance_flag).length;
    const compliancePct = catTxns.length > 0 ? Math.round((compliantCount / catTxns.length) * 100) : 82;
    return {
      breadcrumb: `All Regions → ${category} → All Tiers`,
      title: `${category} Spend Analysis`,
      totalAmount: catSpend,
      transactionCount: Math.round(agg.transaction_count * (catSpend / agg.total_annual_spend_usd)),
      compliancePct,
      rootCauses: [
        { label: `${this.formatCurrency(catSpend)} total`, color: 'purple' },
        { label: `${Math.round((catSpend / agg.total_annual_spend_usd) * 100)}% of total spend`, color: 'purple' },
        { label: `${catTxns.filter(t => t.vendor_tier === 'Tail').length} tail txns`, color: catTxns.some(t => t.vendor_tier === 'Tail') ? 'red' : 'amber' },
        { label: `Compliance: ${compliancePct}%`, color: compliancePct < 80 ? 'red' : 'amber' },
      ],
      transactions: catTxns.length > 0 ? catTxns.sort((a, b) => b.amount_usd - a.amount_usd) : txns.slice(0, 3),
      actions: [
        { number: 1, text: `<strong>Consolidate ${category} suppliers</strong> — negotiate volume discounts with strategic vendors.` },
        { number: 2, text: `<strong>Review ${category} contract coverage</strong> — ensure all high-spend SKUs are under active agreements.` },
        { number: 3, text: `<strong>Benchmark ${category} pricing</strong> against industry indices to identify savings opportunities.` },
      ],
    };
  }

  private buildTierDrilldown(tier: string, txns: any[], agg: AggregateSummary): DrilldownContext {
    const tierMap: Record<string, { label: string; filter: string }> = {
      strategic: { label: 'Strategic', filter: 'Strategic' },
      preferred: { label: 'Preferred', filter: 'Preferred' },
      tactical: { label: 'Tactical', filter: 'Tactical' },
      tail: { label: 'Tail', filter: 'Tail' },
    };
    const t = tierMap[tier] || tierMap['tail'];
    const tierTxns = txns.filter(tx => tx.vendor_tier === t.filter);
    const tierKey = Object.keys(agg.spend_by_vendor_tier).find(k => k.toLowerCase().includes(tier)) || '';
    const tierSpend = agg.spend_by_vendor_tier[tierKey] || 0;
    const compliantCount = tierTxns.filter(tx => tx.compliance_flag).length;
    const compliancePct = tierTxns.length > 0 ? Math.round((compliantCount / tierTxns.length) * 100) : 82;

    const isTail = tier === 'tail';
    return {
      breadcrumb: `All Regions → All Categories → ${t.label} Vendors`,
      title: `${t.label} Vendor ${isTail ? 'Leakage' : 'Performance'}`,
      totalAmount: tierSpend,
      transactionCount: Math.round(agg.transaction_count * (tierSpend / agg.total_annual_spend_usd)),
      compliancePct: isTail ? 36 : compliancePct,
      rootCauses: isTail
        ? [
            { label: 'No PO: 73%', color: 'red' as const },
            { label: 'PCard: 61%', color: 'red' as const },
            { label: 'No Contract: 89%', color: 'red' as const },
            { label: 'Single-source: 41%', color: 'amber' as const },
            { label: 'New vendor <90d: 28%', color: 'purple' as const },
          ]
        : [
            { label: `${this.formatCurrency(tierSpend)} total`, color: 'purple' as const },
            { label: `Compliance: ${compliancePct}%`, color: compliancePct < 80 ? 'red' as const : 'amber' as const },
            { label: `${tierTxns.length} sample txns`, color: 'purple' as const },
          ],
      transactions: [
        ...tierTxns,
        ...(isTail ? this.generateSyntheticTailTxns() : []),
      ].sort((a, b) => b.amount_usd - a.amount_usd),
      actions: isTail
        ? [
            { number: 1, text: '<strong>Bundle top 5 APAC tail vendors</strong> into a single Master Service Agreement to capture volume discounts and enforce compliance.' },
            { number: 2, text: '<strong>Route PCard spend >$5K</strong> through guided buying to ensure PO creation and category classification.' },
            { number: 3, text: '<strong>Flag Shanghai GenePharma</strong> for QA documentation review — current supplier qualification status unknown.' },
          ]
        : [
            { number: 1, text: `<strong>Review ${t.label} vendor SLAs</strong> — ensure performance metrics are tracked and enforced.` },
            { number: 2, text: `<strong>Benchmark ${t.label} pricing</strong> against market rates to identify renegotiation opportunities.` },
            { number: 3, text: `<strong>Schedule Quarterly Business Reviews</strong> with top ${t.label} vendors to strengthen partnerships.` },
          ],
    };
  }

  private buildHeatmapDrilldown(category: string, region: string, txns: any[], agg: AggregateSummary): DrilldownContext {
    const matchTxns = txns.filter(t =>
      (t.category_l1.includes(category) || category.includes(t.category_l1.substring(0, 8))) &&
      (t.region.includes(region) || region === 'NA' && t.region === 'North America')
    );
    const cell = this.heatmapData().find(c => c.category === category && c.region === region);
    const cellValue = cell?.value || 0;
    const regionFull = region === 'NA' ? 'North America' : region;
    return {
      breadcrumb: `${regionFull} → ${category}`,
      title: `${category} in ${regionFull}`,
      totalAmount: cellValue,
      transactionCount: Math.round(agg.transaction_count * (cellValue / agg.total_annual_spend_usd)),
      compliancePct: region === 'APAC' ? 64 : region === 'LATAM' ? 78 : region === 'EMEA' ? 86 : 89,
      rootCauses: [
        { label: `${this.formatCurrency(cellValue)} spend`, color: 'purple' },
        { label: `${Math.round((cellValue / agg.total_annual_spend_usd) * 100)}% of total`, color: 'purple' },
        { label: `${matchTxns.length} sample txns`, color: 'amber' },
      ],
      transactions: matchTxns.length > 0 ? matchTxns.sort((a, b) => b.amount_usd - a.amount_usd) : txns.slice(0, 3),
      actions: [
        { number: 1, text: `<strong>Analyze ${category} suppliers in ${regionFull}</strong> for consolidation and volume-discount opportunities.` },
        { number: 2, text: `<strong>Cross-check regional pricing</strong> — compare ${regionFull} unit costs against other regions for arbitrage.` },
        { number: 3, text: `<strong>Ensure contract coverage</strong> for all ${category} spend in ${regionFull}.` },
      ],
    };
  }

  // ── NL Query Responses ──

  processNLQuery(query: string): NLQueryResponse | null {
    const q = query.toLowerCase();

    if (q.includes('compliance') || q.includes('drop') || q.includes('fell')) {
      return {
        query,
        type: 'waterfall',
        waterfallRows: [
          { label: 'Q1 Baseline', value: '85%', widthPct: 85, type: 'baseline' },
          { label: 'APAC tail vendor surge', value: '−3.2pp', widthPct: 32, type: 'negative' },
          { label: 'PCard policy exception batch', value: '−1.1pp', widthPct: 11, type: 'negative' },
          { label: 'New category (custom synthesis)', value: '−0.8pp', widthPct: 8, type: 'negative' },
          { label: 'NA contract renewals completed', value: '+2.1pp', widthPct: 21, type: 'positive' },
          { label: 'Q2 Actual', value: '82%', widthPct: 82, type: 'baseline' },
        ],
        explanation: 'Compliance fell <strong>3 percentage points</strong> quarter-over-quarter. The primary driver was a <strong>68% increase in APAC tail-vendor transactions</strong>, mostly Custom Synthesis orders from non-contracted Chinese suppliers. PCard policy exceptions contributed an additional 1.1pp decline. North America contract renewals partially offset the drop by 2.1pp.',
      };
    }

    if (q.includes('contract') || q.includes('renewal') || q.includes('prioritize') || q.includes('expir')) {
      return {
        query,
        type: 'table',
        tableRows: [
          { '#': '1', Vendor: 'Integrated DNA Technologies', Value: '$562K', Expires: 'Apr 28', Risk: '🔴 HIGH', Detail: 'Sole-source for oligo primers; no backup supplier' },
          { '#': '2', Vendor: 'Thermo Fisher (Reagents)', Value: '$2.1M', Expires: 'May 02', Risk: '🔴 HIGH', Detail: '3 departments depend on this SKU set; 12-week lead time' },
          { '#': '3', Vendor: 'QIAGEN N.V.', Value: '$198K', Expires: 'May 15', Risk: '🟡 MED', Detail: 'Alternative: Bio-Rad (qualified, 8% premium)' },
        ],
        explanation: '<strong>3 contracts</strong> require immediate attention. Integrated DNA Technologies is highest priority due to sole-source dependency — a lapse would halt primer production for the Sequencing division.',
      };
    }

    if (q.includes('tail') || q.includes('maverick') || q.includes('apac')) {
      return {
        query,
        type: 'text',
        explanation: `<strong>Tail-spend in APAC</strong> totals $14.2M across 312 transactions from 89 vendors. <strong>64% are non-compliant</strong> — the majority lacking purchase orders (73%) and contracts (89%). Top offenders: Shanghai GenePharma ($12.6K), Suzhou BioSci ($8.4K), Sangon Biotech ($4.2K). Recommended: consolidate into 2-3 preferred vendors with MSA coverage.`,
      };
    }

    if (q.includes('cloud') || q.includes('aws') || q.includes('infrastructure')) {
      return {
        query,
        type: 'text',
        explanation: `<strong>Cloud/IT spend</strong> is $273M (15% of total) and growing at 22% QoQ. AWS Genomic Data Lake alone is $890K/mo ($10.7M annualized). At current trajectory, IT & Cloud will surpass Capital Equipment as the #2 category by Q2 FY27. Recommend implementing FinOps practices: reserved instance commitments, spot instance usage for batch genomic pipelines, and S3 lifecycle policies for cold sequencing data.`,
      };
    }

    return {
      query,
      type: 'text',
      explanation: `I analyzed your ${this.data.aggregate().transaction_count.toLocaleString()} transactions across ${this.data.aggregate().vendor_count.toLocaleString()} vendors. Try asking about <em>"compliance trends"</em>, <em>"contract renewals"</em>, <em>"tail-spend in APAC"</em>, or <em>"cloud infrastructure costs"</em> for detailed insights.`,
    };
  }

  // ── Dirty Data Alerts ──

  readonly dirtyDataAlerts = computed<DirtyDataAlert[]>(() => {
    const agg = this.data.aggregate();
    return [
      {
        risk: 'Null PO numbers',
        prevalence: `${Math.round(agg.null_po_transactions_pct * 100)}% of transactions`,
        impact: `${this.formatCurrency(agg.pcard_unclassified_spend_usd)} unclassified`,
        value: agg.pcard_unclassified_spend_usd,
      },
      {
        risk: 'Duplicate invoice risk',
        prevalence: `${Math.round(agg.duplicate_invoice_risk_pct * 100)}% estimated`,
        impact: `${this.formatCurrency(agg.total_annual_spend_usd * agg.duplicate_invoice_risk_pct)} exposure`,
        value: agg.total_annual_spend_usd * agg.duplicate_invoice_risk_pct,
      },
    ];
  });

  // ── Helpers ──

  formatCurrency(value: number): string {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  }

  private regionColorClass(name: string): string {
    const map: Record<string, string> = {
      'North America': 'node-na',
      EMEA: 'node-emea',
      APAC: 'node-apac',
      LATAM: 'node-latam',
    };
    return map[name] || 'node-na';
  }

  private categoryColorClass(name: string): string {
    if (name.includes('Lab')) return 'node-lab';
    if (name.includes('Capital')) return 'node-cap';
    if (name.includes('IT')) return 'node-it';
    if (name.includes('Facilities')) return 'node-fac';
    return 'node-lab';
  }

  private generateSyntheticTailTxns() {
    return [
      { transaction_id: 'syn-001', po_number: null, transaction_date: '2026-01-14', fiscal_quarter: 'FY26Q2', vendor_id: 'VND-08234', vendor_name: 'Suzhou BioSci Ltd', vendor_tier: 'Tail' as const, category_l1: 'Lab Consumables', category_l2: 'Custom Synthesis', category_l3: 'Custom Peptides', cost_center: 'CC-6200', department: 'R&D – Oncology', region: 'APAC' as const, country: 'China', currency: 'CNY', amount_local: 61200.0, amount_usd: 8400.0, contract_id: null, contract_status: 'None' as const, payment_terms: 'Net-30', compliance_flag: false, maverick_flag: true, budget_code: 'BUD-RD-ONC-005', approver: 'Li Wei', source_system: 'Manual' as const },
      { transaction_id: 'syn-002', po_number: 'PO-2025-11204', transaction_date: '2025-12-03', fiscal_quarter: 'FY26Q2', vendor_id: 'VND-05612', vendor_name: 'Takara Bio (CN)', vendor_tier: 'Tail' as const, category_l1: 'Lab Consumables', category_l2: 'Enzymes', category_l3: 'Reverse Transcriptase', cost_center: 'CC-4200', department: 'R&D – Sequencing', region: 'APAC' as const, country: 'China', currency: 'CNY', amount_local: 44500.0, amount_usd: 6120.0, contract_id: 'CTR-2025-0301', contract_status: 'Active' as const, payment_terms: 'Net-30', compliance_flag: true, maverick_flag: false, budget_code: 'BUD-RD-SEQ-001', approver: 'Dr. Sarah Chen', source_system: 'ERP' as const },
    ];
  }
}
