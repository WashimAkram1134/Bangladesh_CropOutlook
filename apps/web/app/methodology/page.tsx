import type { Metadata } from 'next';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Database, Satellite, Map, BarChart2, AlertCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Data & Methodology | Bangladesh Crop Outlook',
  description:
    'Technical methodology, data sources, model architecture and uncertainty documentation ' +
    'for the Bangladesh Crop Outlook forecasting system.',
};

const DATA_SOURCES = [
  {
    icon: <Database size={18} />,
    name: 'Bangladesh Bureau of Statistics (BBS)',
    description:
      'District-level agricultural census records: crop-wise planted area, harvested area, ' +
      'and production statistics. Used as target variable training data and for recorded area display.',
    variables: ['Crop area (ha)', 'Harvested production (t)', 'Historical yield (t/ha)'],
    note: null,
  },
  {
    icon: <Satellite size={18} />,
    name: 'ERA5-Land Reanalysis (ECMWF)',
    description:
      'Monthly gridded climate reanalysis at 0.1° resolution. Downloaded and aggregated to district level.',
    variables: ['Total precipitation (mm)', 'Mean 2m air temperature (°C)', 'Volumetric soil water layer 2 (7–28 cm, m³/m³)'],
    note: 'ERA5-Land data is reanalysis, not raw observations. Values represent model-assimilated estimates.',
  },
  {
    icon: <Satellite size={18} />,
    name: 'MODIS MOD13A3 (NASA)',
    description:
      'Monthly 1 km resolution vegetation index product. Aggregated to district centroids.',
    variables: ['NDVI (Normalized Difference Vegetation Index)', 'EVI (Enhanced Vegetation Index)'],
    note: null,
  },
  {
    icon: <Map size={18} />,
    name: 'GIS Boundaries',
    description:
      'District administrative polygons for all 64 Bangladesh districts. Used for spatial aggregation, ' +
      'choropleth rendering, and feature engineering.',
    variables: ['District centroids (lat/lon)', 'District area (km²)', 'Divisional codes'],
    note: null,
  },
];

const MODEL_INFO = [
  {
    label: 'Crop Yield Model',
    value: 'Random Forest Regressor',
    detail: 'Predicts district-crop yield (t/ha) from environmental features + historical area statistics.',
  },
  {
    label: 'Environmental Forecasting',
    value: 'SARIMA',
    detail: 'Projects future rainfall, temperature, NDVI, EVI and soil moisture for upcoming planning seasons.',
  },
  {
    label: 'Model Release',
    value: 'EXP_36',
    detail: '384 verified district × crop forecasts across 64 districts, 6 crops, 3 consecutive seasons.',
  },
  {
    label: 'Features',
    value: '5 environmental variables',
    detail: 'Rainfall, temperature, NDVI, EVI, soil moisture (7–28 cm) — all ERA5-Land / MODIS derived.',
  },
  {
    label: 'Crops',
    value: 'Aman Rice, Aus Rice, Boro Rice, Potato, Wheat, Jute',
    detail: 'Mapped to Rabi, Kharif-I, Kharif-II seasons based on Bangladesh agricultural calendar.',
  },
  {
    label: 'Districts',
    value: '64 administrative districts',
    detail: 'All districts of Bangladesh across 8 administrative divisions.',
  },
];

const LIMITATIONS = [
  'Forecasts are derived from a verified research model (EXP_36) and are not operational meteorological predictions.',
  'Uncertainty increases with forecast horizon. Upcoming-season forecasts should be rechecked approximately two weeks before the season starts.',
  'District production estimates assume the most recently reported BBS crop area; actual planted area may differ.',
  'ERA5-Land environmental data is model-derived reanalysis, not direct field observations.',
  'MODIS-derived vegetation indices are influenced by cloud contamination and compositing artifacts.',
  'The system does not account for mid-season pest, flood, drought or policy interventions.',
  'Zero recorded area for a district–crop combination is displayed as-is and does not imply an error.',
];

export default function MethodologyPage() {
  return (
    <div className="page-container py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-neutral-900)' }}>
          Data & Methodology
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Data sources, model architecture, and forecast limitations for the Bangladesh Crop Outlook system
        </p>
      </div>

      {/* Research context */}
      <div
        className="card p-5 mb-6"
        style={{ background: 'var(--color-primary-50)', borderColor: 'var(--color-primary-100)' }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-primary-700)' }}>
          Research Thesis
        </p>
        <p className="text-sm" style={{ color: 'var(--color-primary-800)' }}>
          <em>GIS and AI-Based Crop Yield and Production Forecasting for Agricultural Decision Support in Bangladesh</em>
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--color-primary-700)' }}>
          The forecasting models are developed, trained, and verified as part of this research.
          This application presents the research outputs as a decision-support tool.
          No model training is performed by this application.
        </p>
      </div>

      {/* Model summary */}
      <section className="mb-8">
        <h2 className="mb-4">Model Architecture</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODEL_INFO.map((item) => (
            <div
              key={item.label}
              className="card p-4"
            >
              <p className="label mb-1">{item.label}</p>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-neutral-800)' }}>
                {item.value}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Data sources */}
      <section className="mb-8">
        <h2 className="mb-4">Data Sources</h2>
        <div className="space-y-4">
          {DATA_SOURCES.map((ds) => (
            <Card key={ds.name}>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <span style={{ color: 'var(--color-primary-600)' }}>{ds.icon}</span>
                    {ds.name}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-3" style={{ color: 'var(--color-neutral-700)' }}>
                  {ds.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ds.variables.map((v) => (
                    <span key={v} className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                      {v}
                    </span>
                  ))}
                </div>
                {ds.note && (
                  <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    <AlertCircle size={11} className="mt-0.5 shrink-0" />
                    {ds.note}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Limitations */}
      <section className="mb-8">
        <h2 className="mb-4">Forecast Limitations & Caveats</h2>
        <div className="card p-5">
          <ul className="space-y-2.5">
            {LIMITATIONS.map((lim, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--color-primary-400)' }}
                />
                <span className="text-sm" style={{ color: 'var(--color-neutral-700)' }}>
                  {lim}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Season mapping */}
      <section className="mb-8">
        <h2 className="mb-4">Bangladesh Crop Calendar</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-4 py-3 text-left label">Season</th>
                <th className="px-4 py-3 text-left label">Window</th>
                <th className="px-4 py-3 text-left label">Crops</th>
              </tr>
            </thead>
            <tbody>
              {[
                { season: 'Rabi', window: 'Oct 15 – Mar 14', crops: 'Boro Rice, Potato, Wheat' },
                { season: 'Kharif-I', window: 'Mar 15 – Jul 14', crops: 'Aus Rice, Jute' },
                { season: 'Kharif-II', window: 'Jul 15 – Oct 14', crops: 'Aman Rice' },
              ].map((row, i) => (
                <tr
                  key={row.season}
                  style={i < 2 ? { borderBottom: '1px solid var(--color-border-subtle)' } : {}}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-primary-700)' }}>
                    {row.season}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-neutral-700)' }}>
                    {row.window}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-neutral-600)' }}>
                    {row.crops}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
