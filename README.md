# Bangladesh Crop Outlook

**GIS and AI-Based Crop Yield and Production Forecasting for Agricultural Decision Support in Bangladesh**

A production-quality web application serving the research outputs of the EXP_36 model release — district-level crop yield and production forecasts for Bangladesh.

---

## Project Structure

```
Bangladesh_CropOutlook/
├── apps/
│   └── web/                  # Next.js 16 frontend (App Router + TypeScript + Tailwind)
│       ├── app/              # Next.js pages
│       │   ├── page.tsx                     # Dashboard
│       │   ├── district-explorer/page.tsx   # District Explorer
│       │   ├── forecast-comparison/page.tsx # Forecast Comparison
│       │   └── methodology/page.tsx         # Data & Methodology
│       ├── components/
│       │   ├── layout/       # Navbar
│       │   ├── ui/           # Card, Badge, Skeleton, EmptyState
│       │   ├── dashboard/    # SeasonSelector, DistrictSelector, CropSelector, ForecastCards, EnvPanels
│       │   └── map/          # MapLibre GL JS MapComponent
│       ├── lib/
│       │   ├── season.ts     # Season calculation + 70% rollover rule
│       │   ├── districts.ts  # 64 Bangladesh districts reference data
│       │   ├── types.ts      # Shared TypeScript interfaces
│       │   └── utils.ts      # cn(), formatNumber(), calcProduction()
│       └── __tests__/        # Vitest unit tests
└── services/
    └── api/                  # FastAPI backend (Phase 2)
```

---

## Local Development

### Prerequisites

- Node.js 18+ (tested on Node 26)
- npm 10+

### 1. Install dependencies

```bash
cd apps/web
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

### 3. Run unit tests

```bash
npm run test
```

### 4. Type checking

```bash
npm run typecheck
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + custom design tokens |
| GIS | MapLibre GL JS + OpenFreeMap tiles |
| Charts | Recharts |
| Testing | Vitest + Testing Library |
| Backend (Phase 2) | Python FastAPI |

---

## Forecasting System

| | |
|---|---|
| **Model release** | EXP_36 |
| **Yield model** | Random Forest Regressor |
| **Environmental forecast** | SARIMA |
| **Districts** | 64 |
| **Crops** | Aman Rice, Aus Rice, Boro Rice, Potato, Wheat, Jute |
| **Total forecasts** | 384 (64 × 6) |
| **Environmental features** | Rainfall, Temperature, NDVI, EVI, Soil moisture (7–28 cm) |

### Season windows

| Season | Window |
|---|---|
| Rabi | Oct 15 – Mar 14 (following year) |
| Kharif-I | Mar 15 – Jul 14 |
| Kharif-II | Jul 15 – Oct 14 |

The system uses a **70% elapsed-season rollover rule**: when ≥70% of the current season has elapsed, the planning interface automatically advances to the next season as the default.

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| **Phase 1** | ✅ Complete | Frontend scaffold, season logic, components, map architecture |
| **Phase 2** | ⏳ Planned | FastAPI backend, EXP_36 integration, district GeoJSON, choropleth |
| **Phase 3** | ⏳ Planned | District Explorer table, Forecast Comparison charts, CSV export |

---

## Data Sources

- **Bangladesh Bureau of Statistics (BBS)** — agricultural census records
- **ERA5-Land (ECMWF)** — monthly rainfall, temperature, soil moisture
- **MODIS MOD13A3 (NASA)** — monthly NDVI and EVI
- **GIS boundaries** — 64 Bangladesh district polygons

---

## Important Notes

- This application displays outputs from the **EXP_36 verified model release only**.
- Do not train, modify, replace, or recreate the forecasting models from within this application.
- Zero recorded crop area is displayed as-is and does not imply missing data.
- Forecasts for seasons not covered by EXP_36 are not shown.
