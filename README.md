# Spend Intelligence Dashboard

> **Single Pane of Truth** — A procurement spend analytics dashboard designed for life-sciences / genomics companies (Illumina-like), built with Angular 20.

![Angular](https://img.shields.io/badge/Angular-20-DD0031?logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What It Does

This dashboard gives procurement and finance leaders a **complete, interactive view** of their organisation's spend data — from billion-dollar totals down to individual tail-vendor transactions — in a single screen. It answers the questions executives actually ask:

- **Where is the money going?** (by region, category, and vendor tier)
- **What's off-contract or non-compliant?** (maverick spend, missing POs)
- **Which contracts are about to expire?** (90-day renewal pipeline)
- **Where is the data dirty?** (duplicate invoices, null POs, FX mismatches)

Every number, chart, and card is **clickable** — drilling down into context-specific root causes, sample transactions, and AI-generated recommended actions.

---

## Key Features

| Feature | Description |
|---|---|
| **Big Bold Numbers (BBN)** | Three headline KPI cards — Total Spend, Compliance Rate, Contracts Expiring — with trend deltas and severity badges |
| **Insight Narratives** | Five auto-generated executive storylines that surface the most impactful findings in plain English |
| **Sankey Flow Chart** | Region → Category → Vendor Tier flow visualisation with treemap and table toggle views |
| **Category × Region Heatmap** | Intensity grid showing spend concentration; click any cell for a targeted drilldown |
| **Contract Timeline** | Horizontal bar chart of contract expirations over the next 6 months |
| **Context-Aware Drilldown** | Slide-over panel with breadcrumb path, root-cause chips, filtered transactions, and action recommendations — unique content for every click target |
| **Natural-Language Search** | Type questions like *"Who are my top APAC vendors?"* and get waterfall charts, tables, or narrative answers |
| **Dirty Data Banner** | Amber alert banner highlighting data-quality issues (duplicates, missing fields, FX anomalies) |
| **Pluggable Data Sources** | Switch between local sample data, REST API, GraphQL endpoint, or CSV/JSON file upload — no code changes required |

---

## Architecture

```
src/app/
├── models/              # TypeScript interfaces (SpendTransaction, BBNCard, DrilldownContext, etc.)
├── services/
│   ├── data-adapter      # Pluggable data ingestion (local / REST / GraphQL / file-upload)
│   ├── analytics          # All dashboard computations as Angular computed() signals
│   └── sample-data        # Built-in demo dataset ($1.82B genomics spend envelope)
└── components/
    ├── dashboard          # Main orchestrator — wires all child components
    ├── bbn-card           # KPI headline cards
    ├── narrative-card     # Executive insight cards
    ├── sankey-chart       # Region → Category → Tier flow visualisation
    ├── heatmap            # Category × Region intensity grid
    ├── contract-timeline  # Expiration timeline bar chart
    ├── drilldown-panel    # Context-aware slide-over detail panel
    ├── nl-search          # Natural-language query bar with response rendering
    ├── dirty-data-banner  # Data-quality alert strip
    └── data-source-config # Data source configuration modal
```

**Tech stack:** Angular 20 (zoneless, standalone components, signals API) · TypeScript · SCSS with CSS custom properties (dark theme)

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10

### Install & Run

```bash
cd spend-dashboard
npm install
npx ng serve
```

Open [http://localhost:4200](http://localhost:4200). The app loads with built-in sample data — no backend required.

### Build for Production

```bash
npx ng build
```

Output goes to `dist/spend-dashboard/browser/`.

---

## Deployment

Pre-configured for three deployment targets:

### Azure Static Web Apps

A GitHub Actions workflow is included at `.github/workflows/azure-static-web-apps.yml`. Set the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret in your repo and push to `main`.

### AWS S3 + CloudFront

A GitHub Actions workflow is included at `.github/workflows/aws-s3-cloudfront.yml`. Configure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, and `CLOUDFRONT_DISTRIBUTION_ID` as repo secrets.

### Docker

```bash
docker build -t spend-dashboard .
docker run -p 80:80 spend-dashboard
```

Uses a multi-stage build (Node → nginx) for a minimal production image.

---

## Connecting Your Own Data

Click **⚙ Data Source** in the header to switch data sources at runtime:

| Mode | How |
|---|---|
| **Local** | Uses the built-in sample dataset |
| **File Upload** | Drag-and-drop a JSON or CSV file matching the `SpendDataset` schema |
| **REST API** | Point to any endpoint that returns `{ company, transactions, aggregate }` |
| **GraphQL** | Provide an endpoint URL and optional auth headers |

The `DataAdapterService` normalises all sources into the same signal-based data model, so every component works identically regardless of where the data comes from.

---

## Sample Data

The demo dataset simulates a **$1.82 billion** annual spend envelope for a genomics company across:

- **4 regions** — North America, EMEA, APAC, LATAM
- **4 major categories** — Lab Consumables, Capital Equipment, IT & Cloud, Facilities & Real Estate
- **4 vendor tiers** — Strategic, Preferred, Tactical, Tail
- **2,847 vendors** · **14,200 transactions**
- Compliance metrics, contract expirations, maverick spend flags, and data-quality issues

---

## License

MIT
