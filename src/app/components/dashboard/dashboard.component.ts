import { Component, inject, signal, viewChild, HostListener } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataAdapterService, AnalyticsService } from '../../services';
import { DataSourceConfig, DrilldownContext, HeatmapCell } from '../../models';
import { BbnCardComponent } from '../bbn-card/bbn-card.component';
import { NarrativeCardComponent } from '../narrative-card/narrative-card.component';
import { SankeyChartComponent } from '../sankey-chart/sankey-chart.component';
import { HeatmapComponent } from '../heatmap/heatmap.component';
import { ContractTimelineComponent } from '../contract-timeline/contract-timeline.component';
import { DrilldownPanelComponent } from '../drilldown-panel/drilldown-panel.component';
import { NlSearchComponent } from '../nl-search/nl-search.component';
import { DirtyDataBannerComponent } from '../dirty-data-banner/dirty-data-banner.component';
import { DataSourceConfigComponent } from '../data-source-config/data-source-config.component';
import { HeroKpiComponent } from '../hero-kpi/hero-kpi.component';
import { SpendRankComponent } from '../spend-rank/spend-rank.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    BbnCardComponent,
    NarrativeCardComponent,
    SankeyChartComponent,
    HeatmapComponent,
    ContractTimelineComponent,
    DrilldownPanelComponent,
    NlSearchComponent,
    DirtyDataBannerComponent,
    DataSourceConfigComponent,
    HeroKpiComponent,
    SpendRankComponent,
  ],
  template: `
    <!-- HEADER -->
    <header class="header">
      <div class="header-left">
        <div class="logo">{{ dataAdapter.companyProfile().name.charAt(0) }}</div>
        <div>
          <div class="header-title">{{ dataAdapter.companyProfile().name }} — Spend Intelligence</div>
          <div class="header-subtitle">{{ dataAdapter.companyProfile().fiscal_year }} Procurement · Single Pane of Truth</div>
        </div>
      </div>
      <div class="header-right">
        <button class="config-trigger" (click)="showDataSourceConfig()">
          ⚙ Data Source
        </button>
        <div class="data-freshness">
          <span class="dot"></span>
          Data as of {{ dataAdapter.lastRefresh() | date:'MMM d, y HH:mm' }} · {{ dataAdapter.dataSourceLabel() }}
        </div>
      </div>
    </header>

    <!-- NL SEARCH -->
    <div class="search-wrapper">
      <app-nl-search #nlSearchRef (querySubmitted)="onNLQuery($event)" />
    </div>

    <!-- DIRTY DATA BANNER -->
    <div class="section-wrapper">
      <app-dirty-data-banner [alerts]="analytics.dirtyDataAlerts()" />
    </div>

    <!-- HERO KPIs: Total / PO / NPO -->
    <div class="hero-grid">
      @for (kpi of analytics.heroKpis(); track kpi.id) {
        <app-hero-kpi [kpi]="kpi" (click)="openDrilldown('hero-' + kpi.id)" />
      }
    </div>

    <!-- SPEND ANALYSIS: 4-up grid -->
    <div class="level-label">
      <span>Spend Breakdown — Categories · Vendors · GL Accounts · ELT</span>
    </div>
    <div class="rank-grid">
      <app-spend-rank
        title="Top Spend Categories"
        subtitle="L1 category classification"
        icon="📦"
        [items]="analytics.topCategories()"
        (itemClicked)="openDrilldown('c-' + $event)" />
      <app-spend-rank
        title="Top Vendors"
        subtitle="By annual spend volume"
        icon="🏢"
        [items]="analytics.topVendors()"
        (itemClicked)="openDrilldown('vendor-' + $event)" />
      <app-spend-rank
        title="Top GL Accounts"
        subtitle="General Ledger allocation"
        icon="📒"
        [items]="analytics.topGlAccounts()"
        (itemClicked)="openDrilldown('gl-' + $event)" />
      <app-spend-rank
        title="Spend by ELT Member"
        subtitle="Executive Leadership Team"
        icon="👤"
        [items]="analytics.topEltMembers()"
        (itemClicked)="openDrilldown('elt-' + $event)" />
    </div>

    <!-- LEVEL 1: BBN -->
    <div class="level-label">
      <span>Level 1 · Glance — Big Bold Numbers</span>
    </div>
    <div class="bbn-grid">
      @for (card of analytics.bbnCards(); track card.id) {
        <app-bbn-card [card]="card" (click)="openDrilldown('bbn-' + card.id)" />
      }
    </div>

    <!-- NARRATIVES -->
    <div class="level-label">
      <span>Insight Narratives</span>
    </div>
    <div class="narratives-grid">
      @for (n of analytics.narratives(); track n.id) {
        <app-narrative-card [narrative]="n" (click)="openDrilldown('narrative-' + n.id)" />
      }
    </div>

    <!-- LEVEL 2: VISUALIZATIONS -->
    <div class="level-label">
      <span>Level 2 · Trend — Flow & Density Visualization</span>
    </div>
    <div class="viz-section">
      <app-sankey-chart
        [nodes]="analytics.sankeyNodes()"
        [links]="analytics.sankeyLinks()"
        (nodeClicked)="onSankeyNodeClick($event)" />
    </div>
    <div class="viz-grid">
      <app-heatmap
        [cells]="analytics.heatmapData()"
        [categories]="analytics.heatmapCategories()"
        [regions]="analytics.heatmapRegions()"
        (cellClicked)="onHeatmapCellClick($event)" />
      <app-contract-timeline [data]="analytics.contractTimeline()" />
    </div>

    <!-- DRILLDOWN PANEL -->
    <app-drilldown-panel
      [visible]="drilldownVisible()"
      [context]="drilldownContext()"
      (closed)="closeDrilldown()" />

    <!-- DATA SOURCE CONFIG -->
    <app-data-source-config #dataSourceConfigRef
      (closed)="hideDataSourceConfig()"
      (configApplied)="onConfigApplied($event)"
      (fileUploaded)="onFileUploaded($event)" />

    <!-- FOOTER -->
    <footer class="footer">
      <div class="footer-left">{{ dataAdapter.companyProfile().name }} · Procurement Intelligence Dashboard v1.0</div>
      <div class="footer-right">
        <a href="#" class="footer-link">Export PDF</a>
        <a href="#" class="footer-link">Share Insight</a>
        <a href="#" class="footer-link" (click)="showDataSourceConfig(); $event.preventDefault()">Settings</a>
      </div>
    </footer>
  `,
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly dataAdapter = inject(DataAdapterService);
  readonly analytics = inject(AnalyticsService);

  dataSourceConfig = viewChild<DataSourceConfigComponent>('dataSourceConfigRef');
  nlSearch = viewChild<NlSearchComponent>('nlSearchRef');

  drilldownVisible = signal(false);
  drilldownContext = signal<DrilldownContext | null>(null);

  openDrilldown(source: string): void {
    this.drilldownContext.set(this.analytics.buildDrilldown(source));
    this.drilldownVisible.set(true);
  }

  closeDrilldown(): void {
    this.drilldownVisible.set(false);
  }

  onSankeyNodeClick(nodeId: string): void {
    this.openDrilldown(nodeId);
  }

  onHeatmapCellClick(cell: HeatmapCell): void {
    this.openDrilldown('heatmap:' + cell.category + '|' + cell.region);
  }

  onNLQuery(query: string): void {
    const response = this.analytics.processNLQuery(query);
    const nlComp = this.nlSearch();
    if (nlComp && response) {
      nlComp.activeResponse.set(response);
    }
  }

  onConfigApplied(config: DataSourceConfig): void {
    this.dataAdapter.configure(config);
  }

  onFileUploaded(file: File): void {
    this.dataAdapter.loadFromFile(file);
  }

  showDataSourceConfig(): void {
    this.dataSourceConfig()?.visible.set(true);
  }

  hideDataSourceConfig(): void {
    this.dataSourceConfig()?.visible.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDrilldown();
    this.hideDataSourceConfig();
  }
}
