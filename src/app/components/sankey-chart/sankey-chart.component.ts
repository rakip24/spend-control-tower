import { Component, input, output, computed, ElementRef, viewChild, afterNextRender } from '@angular/core';
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

      <div class="sankey-container" [style.display]="activeTab === 'sankey' ? 'flex' : 'none'">
        <svg class="sankey-flows" viewBox="0 0 800 300" preserveAspectRatio="none">
          @for (link of svgPaths(); track link.source + link.target) {
            <path [attr.d]="link.path"
                  [attr.stroke]="link.isMaverick ? 'rgba(248,113,113,0.25)' : link.color"
                  [attr.stroke-width]="link.width"
                  fill="none"
                  [attr.stroke-dasharray]="link.isMaverick ? '8 4' : 'none'"
                  class="flow-path"
                  (click)="nodeClicked.emit(link.source)" />
          }
        </svg>

        <div class="sankey-column">
          @for (node of regionNodes(); track node.id) {
            <div class="sankey-node" [class]="node.colorClass" (click)="nodeClicked.emit(node.id)">
              {{ node.label }}
              <div class="node-value">{{ node.formattedValue }}</div>
            </div>
          }
        </div>

        <div class="sankey-column center-col">
          @for (node of categoryNodes(); track node.id) {
            <div class="sankey-node" [class]="node.colorClass" (click)="nodeClicked.emit(node.id)">
              {{ node.label }}
              <div class="node-value">{{ node.formattedValue }}</div>
            </div>
          }
        </div>

        <div class="sankey-column">
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

  svgPaths = computed(() => {
    // Pre-computed simplified SVG paths for the Sankey flows
    const pathData: { source: string; target: string; path: string; width: number; color: string; isMaverick: boolean }[] = [
      { source: 'r-North America', target: 'c-Lab Consumables', path: 'M 160 40 C 300 40, 300 30, 440 30', width: 40, color: 'rgba(78,140,255,0.2)', isMaverick: false },
      { source: 'r-North America', target: 'c-Capital Equipment', path: 'M 160 90 C 300 90, 300 95, 440 95', width: 20, color: 'rgba(78,140,255,0.15)', isMaverick: false },
      { source: 'r-North America', target: 'c-IT & Cloud', path: 'M 160 120 C 300 120, 300 155, 440 155', width: 14, color: 'rgba(78,140,255,0.12)', isMaverick: false },
      { source: 'r-EMEA', target: 'c-Lab Consumables', path: 'M 160 160 C 300 160, 300 45, 440 45', width: 18, color: 'rgba(52,211,153,0.15)', isMaverick: false },
      { source: 'r-EMEA', target: 'c-Facilities & Real Estate', path: 'M 160 180 C 300 180, 300 210, 440 210', width: 10, color: 'rgba(52,211,153,0.1)', isMaverick: false },
      { source: 'r-APAC', target: 'c-Lab Consumables', path: 'M 160 220 C 300 220, 300 55, 440 55', width: 12, color: 'rgba(167,139,250,0.12)', isMaverick: false },
      { source: 'r-LATAM', target: 'c-Lab Consumables', path: 'M 160 270 C 300 270, 300 60, 440 60', width: 5, color: 'rgba(251,191,36,0.08)', isMaverick: false },
      { source: 'c-Lab Consumables', target: 't-strategic', path: 'M 580 45 C 650 45, 650 40, 720 40', width: 28, color: 'rgba(52,211,153,0.2)', isMaverick: false },
      { source: 'c-Lab Consumables', target: 't-preferred', path: 'M 580 55 C 650 55, 650 100, 720 100', width: 18, color: 'rgba(78,140,255,0.15)', isMaverick: false },
      { source: 'c-Lab Consumables', target: 't-tail', path: 'M 580 65 C 650 65, 650 220, 720 220', width: 8, color: 'rgba(248,113,113,0.25)', isMaverick: true },
      { source: 'c-Capital Equipment', target: 't-strategic', path: 'M 580 95 C 650 95, 650 48, 720 48', width: 16, color: 'rgba(52,211,153,0.15)', isMaverick: false },
      { source: 'c-IT & Cloud', target: 't-strategic', path: 'M 580 155 C 650 155, 650 55, 720 55', width: 12, color: 'rgba(52,211,153,0.12)', isMaverick: false },
      { source: 'c-Facilities & Real Estate', target: 't-tactical', path: 'M 580 210 C 650 210, 650 170, 720 170', width: 8, color: 'rgba(251,191,36,0.12)', isMaverick: false },
    ];
    return pathData;
  });
}
