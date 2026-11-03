'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowLeft,
  Database,
  Satellite,
  Map,
  BarChart2,
  AlertCircle,
  ExternalLink,
  Layers,
  Thermometer,
  CloudRain,
  Trees,
  Info,
  Sliders,
  FileText,
  Calculator,
} from 'lucide-react';
import { api, type MetadataResponse } from '@/lib/api';

const FALLBACK_METADATA: MetadataResponse = {
  release_id: 'EXP36_20261016T035235Z_5543b2fe',
  release_status: 'verified_final_research_candidate',
  built_utc: '2026-10-16T03:52:35Z',
  forecast_planning_date: '2026-10-15',
  forecast_as_of_month: '2026-09-01',
  districts_count: 64,
  crops: ['Aman Rice', 'Aus Rice', 'Boro Rice', 'Potato', 'Wheat', 'Jute'],
  seasons: ['Rabi 2026–27', 'Kharif-I 2027', 'Kharif-II 2027'],
  rf_feature_columns: [
    'Crop',
    'Yield_lag1',
    'Yield_lag2',
    'Yield_3yr_avg_prior',
    'Area_Hectares',
    'soil_ph_10cm',
    'elevation',
    'slope',
    'rainfall_mm',
    'temperature_c',
    'ndvi',
    'soil_moisture_7_28cm',
    'seasonal_evi',
  ],
  sarima_specification: {
    order: [1, 0, 0],
    seasonal_order: [1, 0, 0, 12],
    retry_protocol: 'adaptive_convergence_v2',
  },
  operational_sarima_converged: 320,
  season_policy: 'Kharif-I Mar15-Jul14, Kharif-II Jul15-Oct14, Rabi Oct15-Mar14; rollover at 70% elapsed',
  district_production_rule: 'RF predicted yield × latest available BBS district-crop area',
  user_area_rule: 'User-entered hectares multiply predicted yield AFTER inference',
  limitations: [
    'Operational future-season yield error has not been established by a fully as-of-safe end-to-end historical backtest.',
    'Long lead times of 7, 10, and 13 months remain provisional and should be rechecked closer to season onset.',
    'District production estimates assume the latest reported BBS crop area; actual planted area may vary.',
    'Published BBS history for several target crops has lag age greater than one year.',
    'Three missing historical July EVI observations were interpolated and explicitly audited.',
    'Forecasts represent district agro-ecological averages, not parcel-level guarantees.',
    'System does not account for acute mid-season extreme events (cyclones, flash floods, sudden pest outbreaks).',
  ],
  variable_freshness: {
    rainfall_mm: {
      variable: 'rainfall_mm',
      label: 'Monthly Rainfall',
      unit: 'mm',
      source: 'ERA5-Land (ECMWF)',
      from_date: '2000-01-01',
      to_date: '2026-09-01',
      latest_month: 'September 2026',
      missing_count: 0,
    },
    temperature_c: {
      variable: 'temperature_c',
      label: '2m Air Temperature',
      unit: '°C',
      source: 'ERA5-Land (ECMWF)',
      from_date: '2000-01-01',
      to_date: '2026-09-01',
      latest_month: 'September 2026',
      missing_count: 0,
    },
    soil_moisture_7_28cm: {
      variable: 'soil_moisture_7_28cm',
      label: 'Soil Moisture (7–28 cm)',
      unit: 'm³/m³',
      source: 'ERA5-Land (ECMWF)',
      from_date: '2000-02-01',
      to_date: '2026-09-01',
      latest_month: 'September 2026',
      missing_count: 64,
    },
    ndvi: {
      variable: 'ndvi',
      label: 'Vegetation Greenness (NDVI)',
      unit: 'index (-1 to 1)',
      source: 'MODIS MOD13A3 (NASA)',
      from_date: '2000-02-01',
      to_date: '2026-08-01',
      latest_month: 'August 2026',
      missing_count: 128,
    },
    evi: {
      variable: 'evi',
      label: 'Enhanced Veg. Index (EVI)',
      unit: 'index (-1 to 1)',
      source: 'MODIS MOD13A3 (NASA)',
      from_date: '2000-02-01',
      to_date: '2026-08-01',
      latest_month: 'August 2026',
      missing_count: 131,
    },
  },
  crop_evaluation_metrics: {
    'Aman Rice': { crop: 'Aman Rice', mae_t_ha: 0.144, typical_diff_display: '≈0.14 t/ha', evaluation_basis: '2024–2025 chronological holdouts' },
    'Aus Rice': { crop: 'Aus Rice', mae_t_ha: 0.165, typical_diff_display: '≈0.17 t/ha', evaluation_basis: '2024–2025 chronological holdouts' },
    'Boro Rice': { crop: 'Boro Rice', mae_t_ha: 0.214, typical_diff_display: '≈0.21 t/ha', evaluation_basis: '2024 chronological holdout' },
    'Jute': { crop: 'Jute', mae_t_ha: 0.103, typical_diff_display: '≈0.10 t/ha', evaluation_basis: '2024–2025 chronological holdouts' },
    'Potato': { crop: 'Potato', mae_t_ha: 1.379, typical_diff_display: '≈1.38 t/ha', evaluation_basis: '2024–2025 chronological holdouts' },
    'Wheat': { crop: 'Wheat', mae_t_ha: 0.294, typical_diff_display: '≈0.29 t/ha', evaluation_basis: '2024–2025 chronological holdouts' },
  },
  rf_overall_metrics: [
    { test_year: 2024, mode: 'Observed Environment (N=384)', n: 384, crops_count: 6, mae_t_ha: 0.343, rmse_t_ha: 0.656, r2: 0.9909 },
    { test_year: 2025, mode: 'Observed Environment (N=320)', n: 320, crops_count: 5, mae_t_ha: 0.465, rmse_t_ha: 1.067, r2: 0.9800 },
  ],
};

export function MethodologyContent() {
  const [meta, setMeta] = useState<MetadataResponse>(FALLBACK_METADATA);
  const [showTechnical, setShowTechnical] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('tech') === 'true';
    }
    return false;
  });

  useEffect(() => {
    api
      .getMetadata()
      .then((data) => {
        if (data) setMeta(data);
      })
      .catch((err) => {
        console.warn('Using local fallback metadata:', err);
      });
  }, []);

  const variableFreshness = meta.variable_freshness || FALLBACK_METADATA.variable_freshness!;
  const cropMetrics = meta.crop_evaluation_metrics || FALLBACK_METADATA.crop_evaluation_metrics!;
  const rfMetrics = meta.rf_overall_metrics || FALLBACK_METADATA.rf_overall_metrics!;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12 select-none">
      {/* ── Top Navigation Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#15803d] hover:text-[#134e35] transition-colors bg-white px-3 py-1.5 rounded-full border border-[#edf2ee] shadow-xs"
        >
          <ArrowLeft size={14} />
          <span>Back to Forecast Dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#eafaf1] text-[#15803d] font-bold border border-[#c9eed7] flex items-center gap-1.5">
            <ShieldCheck size={12} />
            Verified Research Release EXP_36
          </span>
        </div>
      </div>

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-[#edf2ee] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#134e35] text-[#4ade80] font-bold uppercase tracking-wider">
                Research Documentation
              </span>
              <span className="text-xs text-[#94a39b]">•</span>
              <span className="text-xs text-[#64746b] font-medium">Updated October 2026</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#141c17] tracking-tight">
              Data & Methodology
            </h1>
            <p className="text-sm text-[#64746b] mt-1 max-w-2xl leading-relaxed">
              GIS and AI-Based Crop Yield and Production Forecasting for Agricultural Decision Support in Bangladesh
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-[#fafcfa] p-2 rounded-2xl border border-[#edf2ee]">
            <div className="text-right px-2">
              <div className="text-[10px] text-[#94a39b] font-semibold uppercase">Coverage</div>
              <div className="text-sm font-bold text-[#141c17]">64 Districts</div>
            </div>
            <div className="h-6 w-px bg-[#edf2ee]" />
            <div className="text-right px-2">
              <div className="text-[10px] text-[#94a39b] font-semibold uppercase">Forecast Records</div>
              <div className="text-sm font-bold text-[#15803d]">384 Fits</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: ABOUT THIS FORECAST (Change 3)
          Organized into Level A (Simple Explanation) & Level B (Technical)
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-3xl p-6 border border-[#edf2ee] shadow-sm space-y-6">
        <div className="flex items-start justify-between border-b border-[#edf2ee] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#15803d]" />
              <h2 className="text-lg md:text-xl font-bold text-[#141c17]">
                About This Forecast
              </h2>
            </div>
            <p className="text-xs text-[#64746b] mt-0.5">
              Clear, practical guidance on how predictions are created, how accurate they are, and when to check for updates.
            </p>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#f0faf4] text-[#15803d] font-semibold border border-[#c9eed7] shrink-0">
            Plain Language
          </span>
        </div>

        {/* ── LEVEL A: SIMPLE EXPLANATION (Farmer & Nontechnical Users) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: How is this forecast prepared? */}
          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <div className="flex items-center gap-2 text-[#134e35]">
              <div className="w-7 h-7 rounded-lg bg-[#eafaf1] flex items-center justify-center text-[#15803d]">
                <FileText size={15} />
              </div>
              <h3 className="font-bold text-sm text-[#141c17]">How is this forecast prepared?</h3>
            </div>
            <p className="text-xs text-[#374151] leading-relaxed">
              We use previous crop yields, local weather patterns, vegetation conditions, soil moisture, and land characteristics to estimate future crop yields.
            </p>
            <div className="pt-2 border-t border-[#e5ebe6] flex flex-wrap gap-1 text-[10px]">
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#e5ebe6] text-[#64746b]">Historical BBS Yields</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#e5ebe6] text-[#64746b]">Seasonal Rainfall</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#e5ebe6] text-[#64746b]">Air Temperature</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#e5ebe6] text-[#64746b]">Soil Profile & pH</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#e5ebe6] text-[#64746b]">Satellite Greenness</span>
            </div>
          </div>

          {/* Card 2: When was this forecast prepared and updated? */}
          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <div className="flex items-center gap-2 text-[#134e35]">
              <div className="w-7 h-7 rounded-lg bg-[#eafaf1] flex items-center justify-center text-[#15803d]">
                <Calendar size={15} />
              </div>
              <h3 className="font-bold text-sm text-[#141c17]">When was it prepared and updated?</h3>
            </div>
            <p className="text-xs text-[#374151] leading-relaxed">
              This operational snapshot was prepared on <strong>September 1, 2026</strong> for the 2026–2027 agricultural calendar. Supporting satellite and meteorological datasets extend through:
            </p>
            <div className="pt-1.5 grid grid-cols-2 gap-1.5 text-[10.5px]">
              <div className="bg-white p-1.5 rounded-lg border border-[#e5ebe6] flex justify-between items-center">
                <span className="text-[#64746b]">Rainfall:</span>
                <span className="font-bold text-[#141c17]">Sep 2026</span>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-[#e5ebe6] flex justify-between items-center">
                <span className="text-[#64746b]">Temperature:</span>
                <span className="font-bold text-[#141c17]">Sep 2026</span>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-[#e5ebe6] flex justify-between items-center">
                <span className="text-[#64746b]">Soil Moisture:</span>
                <span className="font-bold text-[#141c17]">Sep 2026</span>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-[#e5ebe6] flex justify-between items-center">
                <span className="text-[#64746b]">Vegetation (NDVI/EVI):</span>
                <span className="font-bold text-[#141c17]">Aug 2026</span>
              </div>
            </div>
          </div>

          {/* Card 3: Why are forecasts estimates rather than exact harvest values? */}
          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <div className="flex items-center gap-2 text-[#134e35]">
              <div className="w-7 h-7 rounded-lg bg-[#eafaf1] flex items-center justify-center text-[#15803d]">
                <AlertCircle size={15} />
              </div>
              <h3 className="font-bold text-sm text-[#141c17]">Why are forecasts estimates?</h3>
            </div>
            <p className="text-xs text-[#374151] leading-relaxed">
              Agricultural forecasts are estimates rather than guaranteed harvest values because farm conditions evolve over the season. Actual harvest yields may be higher or lower depending on in-season rainfall distribution, irrigation availability, local pest management, and post-planting field care.
            </p>
            <p className="text-[11px] text-[#64746b] italic">
              Use forecasts as a benchmark for planning seed, fertilizer, and crop selection ahead of the season.
            </p>
          </div>

          {/* Card 4: When should you check for updated information? */}
          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <div className="flex items-center gap-2 text-[#134e35]">
              <div className="w-7 h-7 rounded-lg bg-[#eafaf1] flex items-center justify-center text-[#15803d]">
                <Clock size={15} />
              </div>
              <h3 className="font-bold text-sm text-[#141c17]">When should you check for updates?</h3>
            </div>
            <p className="text-xs text-[#374151] leading-relaxed">
              We recommend rechecking the forecast approximately <strong>14 days before season onset</strong> when the latest monthly satellite and climate updates become available:
            </p>
            <div className="pt-1.5 space-y-1 text-[11px]">
              <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-[#e5ebe6]">
                <span className="text-[#64746b]">Kharif-I 2027 (Aus Rice, Jute):</span>
                <span className="font-bold text-[#15803d]">March 1, 2027</span>
              </div>
              <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-[#e5ebe6]">
                <span className="text-[#64746b]">Kharif-II 2027 (Aman Rice):</span>
                <span className="font-bold text-[#15803d]">July 1, 2027</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: How accurate are past estimates? (Typical Yield Difference) */}
        <div className="bg-[#f0faf4] rounded-2xl p-5 border border-[#c9eed7] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-[#14532d]">
                How accurate are past estimates? (Typical Yield Difference)
              </h3>
              <p className="text-xs text-[#166534] mt-0.5">
                In previous tests across Bangladesh, model predictions differed from actual harvest yields by about the following amounts on average:
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#15803d] font-bold border border-[#c9eed7] self-start sm:self-auto">
              Verified Holdouts
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {Object.entries(cropMetrics).map(([cName, info]) => (
              <div key={cName} className="bg-white rounded-xl p-2.5 border border-[#c9eed7] text-center shadow-xs">
                <div className="text-[11px] font-bold text-[#141c17] truncate">{cName}</div>
                <div className="text-sm font-extrabold text-[#15803d] my-0.5">
                  {info.typical_diff_display}
                </div>
                <div className="text-[9px] text-[#64746b] leading-tight">Average test difference</div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-[#14532d] bg-white/70 p-2.5 rounded-xl border border-[#c9eed7] leading-relaxed">
            <strong>Important Scientific Principle:</strong> Typical Yield Difference measures the historical average size of prediction differences in holdout tests. It is <em>not</em> a guaranteed maximum boundary or a calibrated prediction interval. Actual yields may be above or below the forecast.
          </div>
        </div>

        {/* ── LEVEL B: EXPANDABLE TECHNICAL DETAILS (For Researchers & Agronomists) ── */}
        <div className="pt-2 border-t border-[#edf2ee]">
          <button
            type="button"
            onClick={() => setShowTechnical(!showTechnical)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#fafcfa] hover:bg-[#f1f5f2] border border-[#edf2ee] transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#134e35] flex items-center justify-center text-[#4ade80]">
                <Sliders size={14} />
              </div>
              <div>
                <span className="font-bold text-sm text-[#141c17]">View Technical Details</span>
                <p className="text-[11px] text-[#64746b]">
                  Model architectures, SARIMA convergence, feature columns, holdout evaluation metrics, and provenance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#15803d]">
              <span>{showTechnical ? 'Hide Technical' : 'Expand'}</span>
              {showTechnical ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {showTechnical && (
            <div className="mt-4 p-5 rounded-2xl bg-[#fafcfa] border border-[#edf2ee] space-y-6 animate-in fade-in">
              {/* Technical Section 1: Yield & Environmental Modeling */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[#edf2ee] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#141c17]">Random Forest Yield Architecture</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#eafaf1] text-[#15803d] font-semibold">EXP_36</span>
                  </div>
                  <p className="text-xs text-[#64746b] leading-relaxed">
                    District-level crop yields are modeled using an ensemble Random Forest regressor trained on historical BBS records (2006–2023) combined with environmental and terrain features.
                  </p>
                  <div className="text-[11px] space-y-1 pt-1">
                    <div className="flex justify-between text-[#64746b]">
                      <span>Feature Count:</span>
                      <span className="font-semibold text-[#141c17]">13 Engineered Predictors</span>
                    </div>
                    <div className="flex justify-between text-[#64746b]">
                      <span>Target Variable:</span>
                      <span className="font-semibold text-[#141c17]">Yield (Metric Tonnes / Hectare)</span>
                    </div>
                    <div className="flex justify-between text-[#64746b]">
                      <span>District Area Rule:</span>
                      <span className="font-semibold text-[#141c17]">Latest reported BBS census area</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#edf2ee] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#141c17]">SARIMA Environmental Forecasting</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#eafaf1] text-[#15803d] font-semibold">320 Fits</span>
                  </div>
                  <p className="text-xs text-[#64746b] leading-relaxed">
                    Upcoming environmental conditions are projected using district-specific Seasonal ARIMA models with monthly periodicity across 5 key climate indices.
                  </p>
                  <div className="text-[11px] space-y-1 pt-1">
                    <div className="flex justify-between text-[#64746b]">
                      <span>Model Specification:</span>
                      <span className="font-semibold text-[#141c17]">SARIMA(1,0,0) × (1,0,0,12)</span>
                    </div>
                    <div className="flex justify-between text-[#64746b]">
                      <span>Operational Convergence:</span>
                      <span className="font-bold text-[#15803d]">320 / 320 Converged (100%)</span>
                    </div>
                    <div className="flex justify-between text-[#64746b]">
                      <span>Lead Time Horizons:</span>
                      <span className="font-semibold text-[#141c17]">7, 10, and 13 Months</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Section 2: Historical Chronological Holdout Metrics */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-[#141c17] flex items-center gap-1.5">
                  <BarChart2 size={14} className="text-[#134e35]" />
                  Historical Chronological Holdout Evaluation
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden border border-[#edf2ee]">
                    <thead>
                      <tr className="bg-[#f1f5f2] text-[#4b5563] text-[11px]">
                        <th className="p-2.5">Holdout Test Year</th>
                        <th className="p-2.5">Validation Mode</th>
                        <th className="p-2.5 text-center">N Samples</th>
                        <th className="p-2.5 text-center">Crops</th>
                        <th className="p-2.5 text-right">MAE (t/ha)</th>
                        <th className="p-2.5 text-right">RMSE (t/ha)</th>
                        <th className="p-2.5 text-right">R²</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2ee]">
                      {rfMetrics.map((row) => (
                        <tr key={row.test_year} className="hover:bg-[#fafcfa]">
                          <td className="p-2.5 font-bold text-[#141c17]">{row.test_year} Agri Year</td>
                          <td className="p-2.5 text-[#64746b]">Observed Environment (Holdout)</td>
                          <td className="p-2.5 text-center text-[#64746b]">{row.n}</td>
                          <td className="p-2.5 text-center text-[#64746b]">{row.crops_count}</td>
                          <td className="p-2.5 text-right font-bold text-[#15803d]">{row.mae_t_ha.toFixed(3)}</td>
                          <td className="p-2.5 text-right text-[#64746b]">{row.rmse_t_ha.toFixed(3)}</td>
                          <td className="p-2.5 text-right font-bold text-[#141c17]">{row.r2.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-[#94a39b] leading-tight">
                  Evaluated on chronological holdout testing with observed environmental inputs and previous year district area. Not a guaranteed confidence interval for operational forecasting.
                </p>
              </div>

              {/* Technical Section 3: Variable-Specific Freshness & Provenance Matrix */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-[#141c17] flex items-center gap-1.5">
                  <Database size={14} className="text-[#134e35]" />
                  Dataset Provenance & Variable-Specific Freshness Matrix (Change 4)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden border border-[#edf2ee]">
                    <thead>
                      <tr className="bg-[#f1f5f2] text-[#4b5563] text-[11px]">
                        <th className="p-2.5">Variable</th>
                        <th className="p-2.5">Primary Source</th>
                        <th className="p-2.5">Observation Range</th>
                        <th className="p-2.5">Verified Freshness</th>
                        <th className="p-2.5 text-center">Missing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2ee]">
                      {Object.entries(variableFreshness).map(([k, v]) => (
                        <tr key={k} className="hover:bg-[#fafcfa]">
                          <td className="p-2.5 font-bold text-[#141c17] flex items-center gap-1.5">
                            {k.includes('rain') ? (
                              <CloudRain size={13} className="text-blue-600" />
                            ) : k.includes('temp') ? (
                              <Thermometer size={13} className="text-amber-600" />
                            ) : k.includes('soil') ? (
                              <Layers size={13} className="text-teal-600" />
                            ) : (
                              <Trees size={13} className="text-emerald-600" />
                            )}
                            {v.label}
                          </td>
                          <td className="p-2.5 text-[#64746b]">{v.source}</td>
                          <td className="p-2.5 text-[#64746b]">{v.from_date.slice(0, 7)} to {v.to_date.slice(0, 7)}</td>
                          <td className="p-2.5 font-bold text-[#15803d]">{v.latest_month}</td>
                          <td className="p-2.5 text-center text-[#64746b]">{v.missing_count === 0 ? 'None' : `${v.missing_count} rows`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Technical Section 4: Operational Limitations & Governance */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-[#141c17] flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-600" />
                  Model Assumptions and Limitations
                </h4>
                <div className="bg-white p-4 rounded-xl border border-[#edf2ee] space-y-1.5 text-xs text-[#4b5563]">
                  {meta.limitations.map((lim, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-amber-600 shrink-0 font-bold">•</span>
                      <span>{lim}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION: DATA SOURCES ───────────────────────────────────────── */}
      <section className="bg-white rounded-3xl p-6 border border-[#edf2ee] shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#141c17] flex items-center gap-2">
            <Database size={18} className="text-[#134e35]" />
            External Data Sources
          </h2>
          <p className="text-xs text-[#64746b] mt-0.5">
            Public statistical records, satellite Earth observations, and reanalysis products ingested by the pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#141c17]">
              <Database size={16} className="text-[#15803d]" />
              Bangladesh Bureau of Statistics (BBS)
            </div>
            <p className="text-[#64746b] leading-relaxed">
              District-level agricultural statistics: crop-wise cultivated area, harvested production, and historical yields. Used as target variable training data and baseline district area.
            </p>
            <div className="flex flex-wrap gap-1 text-[10px] text-[#64746b]">
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">Planted Area (ha)</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">Production (tonnes)</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">Yield (t/ha)</span>
            </div>
          </div>

          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#141c17]">
              <Satellite size={16} className="text-[#15803d]" />
              ECMWF ERA5-Land Reanalysis
            </div>
            <p className="text-[#64746b] leading-relaxed">
              Monthly gridded climate reanalysis at 0.1° resolution (~9 km), aggregated to district level. Ingested from January 2000 through September 2026.
            </p>
            <div className="flex flex-wrap gap-1 text-[10px] text-[#64746b]">
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">Total Precipitation (mm)</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">2m Mean Temperature (°C)</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">Soil Water Layer 2 (m³/m³)</span>
            </div>
          </div>

          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#141c17]">
              <Satellite size={16} className="text-[#15803d]" />
              NASA MODIS Terra (MOD13A3)
            </div>
            <p className="text-[#64746b] leading-relaxed">
              Monthly 1 km resolution satellite vegetation index product aggregated to district administrative centroids. Observations extend from February 2000 through August 2026.
            </p>
            <div className="flex flex-wrap gap-1 text-[10px] text-[#64746b]">
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">NDVI (Greenness)</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">EVI (Atmospheric Corrected)</span>
            </div>
          </div>

          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#141c17]">
              <Map size={16} className="text-[#15803d]" />
              GIS Administrative Boundaries
            </div>
            <p className="text-[#64746b] leading-relaxed">
              Corrected administrative polygons for all 64 Bangladesh districts across 8 divisions. Used for MapLibre choropleth visualization and district spatial aggregation.
            </p>
            <div className="flex flex-wrap gap-1 text-[10px] text-[#64746b]">
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">64 District Polygons</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5ebe6]">8 Administrative Divisions</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION: BANGLADESH CROP CALENDAR ───────────────────────────── */}
      <section className="bg-white rounded-3xl p-6 border border-[#edf2ee] shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#141c17] flex items-center gap-2">
            <Calendar size={18} className="text-[#134e35]" />
            Bangladesh Agricultural Calendar
          </h2>
          <p className="text-xs text-[#64746b] mt-0.5">
            Seasonal planning windows and crop mappings implemented with the strict 70% elapsed-season rollover protocol.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden border border-[#edf2ee]">
            <thead>
              <tr className="bg-[#f1f5f2] text-[#4b5563] text-[11px]">
                <th className="p-3">Season</th>
                <th className="p-3">Standard Calendar Window</th>
                <th className="p-3">Target Crops Included</th>
                <th className="p-3">Agricultural Characteristics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2ee]">
              <tr className="hover:bg-[#fafcfa]">
                <td className="p-3 font-bold text-[#15803d]">Rabi</td>
                <td className="p-3 text-[#141c17]">October 15 – March 14</td>
                <td className="p-3 font-semibold text-[#141c17]">Boro Rice, Potato, Wheat</td>
                <td className="p-3 text-[#64746b]">Dry winter season, heavily dependent on groundwater and surface irrigation.</td>
              </tr>
              <tr className="hover:bg-[#fafcfa]">
                <td className="p-3 font-bold text-[#15803d]">Kharif-I</td>
                <td className="p-3 text-[#141c17]">March 15 – July 14</td>
                <td className="p-3 font-semibold text-[#141c17]">Aus Rice, Jute</td>
                <td className="p-3 text-[#64746b]">Early monsoon and pre-monsoon summer season with increasing precipitation.</td>
              </tr>
              <tr className="hover:bg-[#fafcfa]">
                <td className="p-3 font-bold text-[#15803d]">Kharif-II</td>
                <td className="p-3 text-[#141c17]">July 15 – October 14</td>
                <td className="p-3 font-semibold text-[#141c17]">Aman Rice</td>
                <td className="p-3 text-[#64746b]">Main monsoon rainfed season, representing major national rice acreage.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── SECTION: BANGLADESH LAND MEASUREMENT & CONVERSION STANDARDS ──── */}
      <section className="bg-white rounded-3xl p-6 border border-[#edf2ee] shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#141c17] flex items-center gap-2">
            <Calculator size={18} className="text-[#134e35]" />
            Bangladesh Land Measurement & Conversion Standards
          </h2>
          <p className="text-xs text-[#64746b] mt-0.5">
            Standard land unit conversions implemented across all user field calculators, derived from official Bangladesh government documentation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2">
            <h3 className="font-bold text-sm text-[#141c17]">Standard Conversion Factors (Full Precision)</h3>
            <ul className="space-y-1.5 text-[#47554f]">
              <li>• <strong>Hectare (হেক্টর):</strong> 1 hectare = 10,000 m² (canonical modeling base)</li>
              <li>• <strong>Acre (একর):</strong> 1 acre = 0.40468564224 hectare (4,046.8564224 m²)</li>
              <li>• <strong>Decimal / Shotok (শতক / শতাংশ):</strong> 1 decimal = 1/100 acre = 0.0040468564224 ha</li>
              <li>• <strong>Standard Katha (কাঠা):</strong> 720 sq ft = 66.8901888 m² = 0.00668901888 ha</li>
              <li>• <strong>Standard Bigha (বিঘা):</strong> 20 katha = 14,400 sq ft = 1,337.803776 m² = 0.1337803776 ha</li>
              <li>• <strong>Square Feet (বর্গফুট):</strong> 1 sq ft = 0.09290304 m² = 0.000009290304 ha</li>
              <li>• <strong>Square Metre (বর্গমিটার):</strong> 1 m² = 0.0001 hectare</li>
            </ul>
            <p className="text-[11px] text-[#6b7c72] pt-1 leading-relaxed">
              <em>Note on regional land units:</em> Katha and Bigha conventions exhibit historical variations across different districts in Bangladesh. The application explicitly implements the widely documented standard convention of 720 square feet per Katha and 20 Katha (14,400 sq ft) per Bigha, without approximating Bigha as 33 decimals.
            </p>
          </div>

          <div className="bg-[#f8faf8] rounded-2xl p-4 border border-[#edf2ee] space-y-2.5">
            <h3 className="font-bold text-sm text-[#141c17]">Government Survey & Land Documentation Citations</h3>
            <p className="text-[#64746b] leading-relaxed">
              These conversion factors adhere directly to official guidelines published by the Ministry of Land and district land administration portals:
            </p>
            <div className="space-y-2 pt-1">
              <a
                href="https://bhumipedia.land.gov.bd/uploads/ebook/File/9_.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-[#e2e7e3] hover:border-[#15803d] transition-colors group"
              >
                <ExternalLink size={13} className="text-[#15803d] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                <div>
                  <p className="font-semibold text-[#141c17]">Ministry of Land — Survey & Land Measurement Documentation</p>
                  <p className="text-[10px] text-[#6b7c72]">bhumipedia.land.gov.bd · Official measurement guidelines and conversion records</p>
                </div>
              </a>
              <a
                href="https://shibnagorup.dinajpur.gov.bd/pages/static-pages/69776150c4774958d7c216e4"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-[#e2e7e3] hover:border-[#15803d] transition-colors group"
              >
                <ExternalLink size={13} className="text-[#15803d] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                <div>
                  <p className="font-semibold text-[#141c17]">Bangladesh Government — Land Measurement Information (Dinajpur)</p>
                  <p className="text-[10px] text-[#6b7c72]">dinajpur.gov.bd · Upazila Land Information and Standard Conventions</p>
                </div>
              </a>
              <a
                href="https://amdiaup.narsingdi.gov.bd/pages/static-pages/6995de7f35ce18e1c07ae7a2"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-[#e2e7e3] hover:border-[#15803d] transition-colors group"
              >
                <ExternalLink size={13} className="text-[#15803d] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                <div>
                  <p className="font-semibold text-[#141c17]">Bangladesh Government — Land Information (Narsingdi)</p>
                  <p className="text-[10px] text-[#6b7c72]">narsingdi.gov.bd · Standard measurement tables and land survey notes</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
