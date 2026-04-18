import { Component, input, output, computed } from '@angular/core';
import { SankeyNode, SankeyLink } from '../../models';

@Component({
  selector: 'app-sankey-chart',
  standalone: true,
  template: `
    <div class="viz-card full-width">
      <div class="viz-header">
        <div>
          <div class="viz-title">Spend Flow: Region → Category → Vendor Tier</div>
          <div class="viz-subtitle">Click any node or stream to drill into transactions</div>
        </div>
        <div class="viz-tabs">
          <button class="viz-tab" [class.active]="activeTab === 'sankey'" (click)="activeTab = 'sankey'">Sankey</button>
          <button class="viz-tab" [class.active]="activeTab === 'treemap'" (click)="activeTab = 'treemap'">Treemap</button>
          <button class="viz-tab" [class.active]="activeTab === 'table'" (click)="activeTab = 'table'">Table</button>
        </div>
      </div>

      <div class="sankey-wrapper" [style.display]="activeTab === 'sankey' ? 'block' : 'none'">
        <div class="sankey-row">
          <!-- Region column -->
          <div class="sankey-column col-left">
            <div class="col-header">Region</div>
            @for (node of regionNodes(); track node.id) {
              <div class="sankey-node" [class]="node.colorClass" (click)="nodeClicked.emit(node.id)">
                {{ node.label }}
                <div class="node-value">{{ node.formattedValue }}</div>
              </div>
            }
          </div>

          <!-- Left flow SVG (Region → Category) -->
          <div class="flow-area">
            <svg class="flow-svg" viewBox="0 0 200 320" preserveAspectRatio="none">
              @for (link of leftPaths(); track link.source + link.target) {
                <path [attr.d]="link.path"
                      [attr.stroke]="link.isMaverick ? 'rgba(248,113,113,0.3)' : link.color"
                      [attr.stroke-width]="link.width"
                      fill="none"
                      [attr.stroke-dasharray]="link.isMaverick ? '8 4' : 'none'"
                      class="flow-path"
                      (click)="nodeClicked.emit(link.source)" />
              }
            </svg>
          </div>

          <!-- Category column -->
          <div class="sankey-column col-center">
            <div class="col-header">Category</div>
            @for (node of categoryNodes(); track node.id) {
              <div class="sankey-node" [class]="node.colorClass" (click)="nodeClicked.emit(node.id)">
                {{ node.label }}
                <div class="node-value">{{ node.formattedValue }}</div>
              </div>
            }
          </div>

          <!-- Right flow SVG (Category → Tier) -->
          <div class="flow-area">
            <svg class="flow-svg" viewBox="0 0 200 320" preserveAspectRatio="none">
              @for (link of rightPaths(); track link.source + link.target) {
                <path [attr.d]="link.path"
                      [attr.stroke]="link.isMaverick ? 'rgba(248,113,113,0.3)' : link.color"
                      [attr.stroke-width]="link.width"
                      fill="none"
                      [attr.stroke-dasharray]="link.isMaverick ? '8 4' : 'none'"
                      class="flow-path"
                      (click)="nodeClicked.emit(link.source)" />
              }
            </svg>
          </div>

          <!-- Tier column -->
          <div class="sankey-column col-right">
            <div class="col-header">Vendor Tier</div>
            @for (node of tierNodes(); track node.id) {
              <div class="sankey-node" [class]="node.colorClass"
                   [class.pulse-tail]="node.id === 't-tail'"
                   (click)="nodeClicked.emit(node.id)">
                {{ node.label }}
                <div class="node-value">{{ node.formattedValue }}</div>
              </div>
            }
          </div>
        </div>
      </div>

      @if (activeTab === 'treemap') {
        <div class="treemap-view">
          @for (node of allNodes(); track node.id) {
            <div class="treemap-cell" [class]="node.colorClass"
                 [style.flex-grow]="node.value / 100000000"
                 (click)="nodeClicked.emit(node.id)">
              <div class="treemap-label">{{ node.label }}</div>
              <div class="treemap-value">{{ node.formattedValue }}</div>
            </div>
          }
        </div>
      }

      @if (activeTab === 'table') {
        <div class="table-view">
          <table>
            <thead>
              <tr><th>Node</th><th>Type</th><th>Value</th><th>Share</th></tr>
            </thead>
            <tbody>
              @for (node of allNodes(); track node.id) {
                <tr (click)="nodeClicked.emit(node.id)">
                  <td>{{ node.label }}</td>
                  <td>{{ node.column }}</td>
                  <td>{{ node.formattedValue }}</td>
                  <td>{{ ((node.value / totalSpend()) * 100).toFixed(1) }}%</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styleUrl: './sankey-chart.component.scss',
})
export class SankeyChartComponent {
  nodes = input.required<SankeyNode[]>();
  links = input.required<SankeyLink[]>();
  nodeClicked = output<string>();
  activeTab: 'sankey' | 'treemap' | 'table' = 'sankey';

  regionNodes = computed(() => this.nodes().filter(n => n.column === 'region'));
  categoryNodes = computed(() => this.nodes().filter(n => n.column === 'category'));
  tierNodes = computed(() => this.nodes().filter(n => n.column === 'tier'));
  allNodes = computed(() => this.nodes());
  totalSpend = computed(() => Math.max(1, ...this.regionNodes().map(n => n.value)));

  /** SVG paths for Region → Category flows (in a 200×320 viewBox) */
  leftPaths = computed(() => {
    const regions = this.regionNodes();
    const categories = this.categoryNodes();
    const links = this.links().filter(l => l.source.startsWith('r-'));
    return this.buildPaths(regions, categories, links, 200);
  });

  /** SVG paths for Category → Tier flows (in a 200×320 viewBox) */
  rightPaths = computed(() => {
    const categories = this.categoryNodes();
    const tiers = this.tierNodes();
    const links = this.links().filter(l => l.source.startsWith('c-'));
    return this.buildPaths(categories, tiers, links, 200);
  });

  private buildPaths(
    sourceNodes: SankeyNode[],
    targetNodes: SankeyNode[],
    links: { source: string; target: string; value: number; isMaverick: boolean }[],
    width: number
  ) {
    const padding = 30;
    const usableH = 320 - padding * 2;
    const totalSourceVal = Math.max(1, sourceNodes.reduce((s, n) => s + n.value, 0));
    const totalTargetVal = Math.max(1, targetNodes.reduce((s, n) => s + n.value, 0));
    const gap = 12;

    // Compute y-center for each source node
    const sourceYMap = new Map<string, number>();
    let sy = padding;
    const sourceGapTotal = Math.max(0, (sourceNodes.length - 1) * gap);
    const sourceScale = (usableH - sourceGapTotal) / totalSourceVal;
    for (const node of sourceNodes) {
      const h = Math.max(14, node.value * sourceScale);
      sourceYMap.set(node.id, sy + h / 2);
      sy += h + gap;
    }

    // Compute y-center for each target node
    const targetYMap = new Map<string, number>();
    let ty = padding;
    const targetGapTotal = Math.max(0, (targetNodes.length - 1) * gap);
    const targetScale = (usableH - targetGapTotal) / totalTargetVal;
    for (const node of targetNodes) {
      const h = Math.max(14, node.value * targetScale);
      targetYMap.set(node.id, ty + h / 2);
      ty += h + gap;
    }

    const maxLinkVal = Math.max(1, ...links.map(l => l.value));
    const colors = [
      'rgba(78,140,255,0.2)', 'rgba(52,211,153,0.18)', 'rgba(167,139,250,0.18)',
      'rgba(251,191,36,0.15)', 'rgba(96,165,250,0.15)', 'rgba(244,114,182,0.15)',
    ];

    return links.map((link, i) => {
      const y1 = sourceYMap.get(link.source) ?? 160;
      const y2 = targetYMap.get(link.target) ?? 160;
      const cx = width / 2;
      return {
        source: link.source,
        target: link.target,
        path: `M 0 ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${width} ${y2}`,
        width: Math.max(2, (link.value / maxLinkVal) * 36),
        color: colors[i % colors.length],
        isMaverick: link.isMaverick,
      };
    });
  }
}
