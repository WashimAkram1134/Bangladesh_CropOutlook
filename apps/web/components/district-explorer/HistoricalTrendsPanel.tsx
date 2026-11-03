'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  CloudRain,
  Thermometer,
  Layers,
  Droplets,
  Download,
  AlertCircle,
  HelpCircle,
  Eye,
  BarChart2,
  Sliders,
  ChevronDown,
  Check,
  Info,
} from 'lucide-react';
import {
  api,
  HistoricalRecord,
  HistoricalTrendsResponse,
  DistrictExplorerRecord,
} from '@/lib/api';

// ─── Constants & Meta ─────────────────────────────────────────────────────────

export type EnvVarKey = 'rainfall_mm' | 'temperature_c' | 'ndvi' | 'evi' | 'soil_moisture_7_28cm';

const ENV_VAR_META: Record<EnvVarKey, { label: string; unit: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  rainfall_mm: {
    label: 'Rainfall',
    unit: 'mm',
    icon: <CloudRain size={14} />,
    color: '#0284c7', // Sky-600
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  temperature_c: {
    label: 'Temperature',
    unit: '°C',
    icon: <Thermometer size={14} />,
    color: '#ea580c', // Orange-600
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  ndvi: {
    label: 'NDVI (Veg. Index)',
    unit: 'index',
    icon: <Layers size={14} />,
    color: '#16a34a', // Green-600
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  evi: {
    label: 'EVI (Enhanced Veg.)',
    unit: 'index',
    icon: <Layers size={14} />,
    color: '#0d9488', // Teal-600
    bg: '#f0fdfa',
    border: '#99f6e4',
  },
  soil_moisture_7_28cm: {
    label: 'Soil Moisture',
    unit: 'm³/m³',
    icon: <Droplets size={14} />,
    color: '#6366f1', // Indigo-500
    bg: '#eef2ff',
    border: '#c7d2fe',
  },
};

type DateRangeOption = 'last5' | 'last10' | 'last19' | 'all' | 'custom';
type ChartViewMode = 'split' | 'overlay' | 'yield_only';

interface HistoricalTrendsPanelProps {
  selectedDistrict: string | null;
  onSelectDistrict: (d: string) => void;
  crop: string;
  season: string | null;
  displaySeason: string;
  allDistricts: string[];
  records: DistrictExplorerRecord[]; // for Tab B (Yield Distribution)
}

export function HistoricalTrendsPanel({
  selectedDistrict,
  onSelectDistrict,
  crop,
  season,
  displaySeason,
  allDistricts,
  records,
}: HistoricalTrendsPanelProps) {
  // ── Tab state: A = Historical Trends (default), B = Yield Distribution
  const [activeTab, setActiveTab] = useState<'historical' | 'distribution'>('historical');

  // District to query (defaults to selectedDistrict, or falls back to All Bangladesh)
  const effectiveDistrict = selectedDistrict || 'All Bangladesh';

  const isNational = useMemo(() => {
    const norm = effectiveDistrict.toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm.includes('bangladesh') || norm === 'national';
  }, [effectiveDistrict]);

  const displayLabel = useMemo(() => {
    return isNational ? 'All Bangladesh (National)' : effectiveDistrict;
  }, [isNational, effectiveDistrict]);

  const shortLabel = useMemo(() => {
    return isNational ? 'All Bangladesh' : effectiveDistrict;
  }, [isNational, effectiveDistrict]);

  // ── Controls State
  const [selectedVar, setSelectedVar] = useState<EnvVarKey>('rainfall_mm');
  const [dateRange, setDateRange] = useState<DateRangeOption>('last19');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [chartView, setChartView] = useState<ChartViewMode>('split');
  const [showForecastPoint, setShowForecastPoint] = useState<boolean>(true);
  const [compareWithNational, setCompareWithNational] = useState<boolean>(true);

  // ── Data State
  const [historyData, setHistoryData] = useState<HistoricalTrendsResponse | null>(null);
  const [nationalData, setNationalData] = useState<HistoricalTrendsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);


  // Fetch historical records whenever district, crop, or date range changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let yearsParam: number | null = 19;
    let sYear: string | null = null;
    let eYear: string | null = null;

    if (dateRange === 'last5') yearsParam = 5;
    else if (dateRange === 'last10') yearsParam = 10;
    else if (dateRange === 'last19') yearsParam = 19;
    else if (dateRange === 'all') yearsParam = null;
    else if (dateRange === 'custom') {
      yearsParam = null;
      sYear = customStart || null;
      eYear = customEnd || null;
    }

    const fetchDistrict = api.getHistoricalTrends(effectiveDistrict, crop, yearsParam, sYear, eYear);
    const fetchNational = !isNational
      ? api.getHistoricalTrends('All Bangladesh', crop, yearsParam, sYear, eYear).catch(() => null)
      : Promise.resolve(null);

    Promise.all([fetchDistrict, fetchNational])
      .then(([distRes, natRes]) => {
        if (!cancelled) {
          setHistoryData(distRes);
          setNationalData(natRes);
          // Set initial custom bounds if not yet chosen
          if (distRes.available_years.length > 0 && !customStart) {
            setCustomStart(distRes.available_years[0]);
            setCustomEnd(distRes.available_years[distRes.available_years.length - 1]);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load historical data');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveDistrict, crop, dateRange, customStart, customEnd, isNational]);

  // ── National Benchmark Lookup Map
  const nationalMap = useMemo(() => {
    const map = new Map<string, HistoricalRecord>();
    if (nationalData?.records) {
      for (const r of nationalData.records) {
        map.set(r.crop_year, r);
      }
    }
    return map;
  }, [nationalData]);

  // ── Combined Chart Series Data
  const chartData = useMemo(() => {
    if (!historyData || !historyData.records) return [];

    const items = historyData.records.map((r) => {
      const natRec = nationalMap.get(r.crop_year);
      const natYield = natRec?.yield_t_ha ?? null;
      const diff = r.yield_t_ha !== null && natYield !== null ? r.yield_t_ha - natYield : null;

      return {
        crop_year: r.crop_year,
        short_year: r.short_year,
        actual_yield: r.yield_t_ha,
        national_yield: natYield,
        yield_diff: diff,
        env_value: r[selectedVar] as number | null,
        area_ha: r.area_hectares,
        production_t: r.production_tonnes,
        is_forecast: false,
      };
    });

    // Optionally append verified EXP_36 forecast marker
    if (showForecastPoint && historyData.forecast_marker) {
      const fc = historyData.forecast_marker;
      const natFc = nationalData?.forecast_marker;
      items.push({
        crop_year: fc.crop_year,
        short_year: fc.crop_year.replace(' (Forecast)', '*'),
        actual_yield: null, // do not plot actual
        national_yield: null,
        forecast_yield: fc.predicted_yield_t_ha, // plot as distinct forecast series
        national_forecast_yield: natFc?.predicted_yield_t_ha ?? null,
        env_value: null,
        area_ha: null,
        production_t: null,
        is_forecast: true,
      } as any);
    }

    return items;
  }, [historyData, nationalData, nationalMap, selectedVar, showForecastPoint]);


  // CSV URL constructor
  const csvDownloadUrl = useMemo(() => {
    let y: number | null = 19;
    if (dateRange === 'last5') y = 5;
    else if (dateRange === 'last10') y = 10;
    else if (dateRange === 'last19') y = 19;
    else if (dateRange === 'all') y = null;
    else if (dateRange === 'custom') y = null;

    return api.getHistoricalCsvUrl(
      effectiveDistrict,
      crop,
      y,
      dateRange === 'custom' ? customStart : null,
      dateRange === 'custom' ? customEnd : null
    );
  }, [effectiveDistrict, crop, dateRange, customStart, customEnd]);

  // Current environmental variable metadata
  const currentEnv = ENV_VAR_META[selectedVar];

  return (
    <div className="fade-up card overflow-hidden border border-[#d8e6dc] shadow-sm rounded-2xl bg-white" style={{ animationDelay: '0.14s' }}>
      {/* ── Two-Tab Navigation Header ── */}
      <div className="bg-[#f8faf8] border-b border-[#e8efe9] px-4 pt-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 -mb-px">
          <button
            id="tab-historical-trends"
            onClick={() => setActiveTab('historical')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'historical'
                ? 'bg-white border-[#155338] text-[#155338] shadow-sm'
                : 'border-transparent text-[#6b7c72] hover:text-[#141c17] hover:bg-[#eef5f0]'
            }`}
          >
            <TrendingUp size={15} className={activeTab === 'historical' ? 'text-[#155338]' : 'text-[#6b7c72]'} />
            <span>Tab A — Historical Trends & Environmental Comparison</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#eef8f2] text-[#155338] border border-[#c6e8d0]">
              {shortLabel}
            </span>
          </button>

          <button
            id="tab-yield-distribution"
            onClick={() => setActiveTab('distribution')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'distribution'
                ? 'bg-white border-[#155338] text-[#155338] shadow-sm'
                : 'border-transparent text-[#6b7c72] hover:text-[#141c17] hover:bg-[#eef5f0]'
            }`}
          >
            <BarChart2 size={15} className={activeTab === 'distribution' ? 'text-[#155338]' : 'text-[#6b7c72]'} />
            <span>Tab B — National Yield Distribution</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f4f6f4] text-[#6b7c72] border border-[#e2e7e3]">
              64 Districts
            </span>
          </button>
        </div>

        {/* District Synced Indicator */}
        <div className="flex items-center gap-2 pb-2 text-xs text-[#6b7c72]">
          <span className="hidden sm:inline">Active Scope:</span>
          <select
            value={effectiveDistrict}
            onChange={(e) => onSelectDistrict(e.target.value)}
            className="text-xs font-semibold text-[#155338] bg-white border border-[#c6e8d0] rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#155338]"
          >
            <option value="All Bangladesh">All Bangladesh (National Aggregate)</option>
            <optgroup label="Districts (64)">
              {allDistricts.filter((d) => d !== 'All Bangladesh').map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB A: HISTORICAL TRENDS & ENVIRONMENTAL COMPARISON
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'historical' && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* ── Sub-header: Season & Variable Switcher Controls ── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl bg-[#f8faf8] border border-[#e8efe9]">
            {/* Left: District & Season Alignment Disclosure */}
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <span className="font-semibold text-[#141c17] text-sm flex items-center gap-1.5">
                {displayLabel} · {crop}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#eef8f2] text-[#155338] border border-[#c6e8d0] font-medium text-[11px]">
                Season: {historyData?.season || season || 'Rabi'}
              </span>
              <span className="text-[#6b7c72] text-[11px] hidden md:inline">
                ({crop} historical records for {shortLabel} aligned to {historyData?.season || season || 'growing'} modeling window)
              </span>
            </div>

            {/* Right: Date Range Selector */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-xs text-[#6b7c72] mr-1 hidden sm:inline">Historical Range:</span>
              {(['last5', 'last10', 'last19', 'all', 'custom'] as DateRangeOption[]).map((opt) => {
                const labels: Record<DateRangeOption, string> = {
                  last5: 'Last 5Y',
                  last10: 'Last 10Y',
                  last19: 'Last 19Y (Default)',
                  all: 'All Available',
                  custom: 'Custom',
                };
                return (
                  <button
                    key={opt}
                    onClick={() => setDateRange(opt)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                      dateRange === opt
                        ? 'bg-[#155338] text-white shadow-xs'
                        : 'bg-white text-[#47554f] border border-[#e2e7e3] hover:bg-[#f0faf4]'
                    }`}
                  >
                    {labels[opt]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Range Picker (if Custom selected) */}
          {dateRange === 'custom' && historyData?.available_years && (
            <div className="flex items-center gap-3 p-3 bg-[#eef8f2] border border-[#c6e8d0] rounded-xl text-xs">
              <Calendar size={14} className="text-[#155338]" />
              <span className="font-semibold text-[#155338]">Select Crop-Year Range:</span>
              <div className="flex items-center gap-2">
                <select
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-white border border-[#c6e8d0] rounded px-2 py-1 text-xs text-[#141c17]"
                >
                  {historyData.available_years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <span className="text-[#6b7c72]">to</span>
                <select
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-white border border-[#c6e8d0] rounded px-2 py-1 text-xs text-[#141c17]"
                >
                  {historyData.available_years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── Environmental Variable Switcher Pills ── */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-xs font-semibold text-[#141c17] mr-1">Environmental Comparison:</span>
              {(Object.keys(ENV_VAR_META) as EnvVarKey[]).map((k) => {
                const meta = ENV_VAR_META[k];
                const active = selectedVar === k;
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedVar(k)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'text-white shadow-xs'
                        : 'bg-white text-[#47554f] border border-[#e2e7e3] hover:bg-[#f8faf8]'
                    }`}
                    style={{
                      backgroundColor: active ? meta.color : undefined,
                      borderColor: active ? meta.color : undefined,
                    }}
                  >
                    {meta.icon}
                    <span>{meta.label}</span>
                    <span className={`text-[10px] ${active ? 'text-white/80' : 'text-[#6b7c72]'}`}>({meta.unit})</span>
                  </button>
                );
              })}
            </div>

            {/* Chart View Modes & Forecast Toggle */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Chart Mode */}
              <div className="inline-flex rounded-lg border border-[#e2e7e3] bg-white p-0.5 text-xs">
                <button
                  onClick={() => setChartView('split')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    chartView === 'split' ? 'bg-[#155338] text-white' : 'text-[#6b7c72] hover:text-[#141c17]'
                  }`}
                  title="Synchronized dual charts sharing crop-year timeline"
                >
                  Dual Charts
                </button>
                <button
                  onClick={() => setChartView('overlay')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    chartView === 'overlay' ? 'bg-[#155338] text-white' : 'text-[#6b7c72] hover:text-[#141c17]'
                  }`}
                  title="Dual axis combined overlay chart"
                >
                  Overlay
                </button>
                <button
                  onClick={() => setChartView('yield_only')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    chartView === 'yield_only' ? 'bg-[#155338] text-white' : 'text-[#6b7c72] hover:text-[#141c17]'
                  }`}
                  title="Yield only series"
                >
                  Yield Only
                </button>
              </div>

              {/* Forecast Marker Toggle */}
              <label className="inline-flex items-center gap-1.5 text-xs text-[#47554f] cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-[#e2e7e3]">
                <input
                  type="checkbox"
                  checked={showForecastPoint}
                  onChange={(e) => setShowForecastPoint(e.target.checked)}
                  className="rounded text-[#155338] focus:ring-[#155338]"
                />
                <span className="font-medium">EXP_36 Forecast</span>
              </label>

              {/* Compare with All Bangladesh Toggle */}
              {!isNational ? (
                <label
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    compareWithNational
                      ? 'bg-[#e0f2fe] border-[#7dd3fc] text-[#0369a1]'
                      : 'bg-white border-[#e2e7e3] text-[#47554f] hover:bg-[#f8faf8]'
                  }`}
                  title="Overlay All Bangladesh national benchmark line and comparisons"
                >
                  <input
                    type="checkbox"
                    checked={compareWithNational}
                    onChange={(e) => setCompareWithNational(e.target.checked)}
                    className="rounded text-[#0284c7] focus:ring-[#0284c7]"
                  />
                  <span className="font-medium flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-[#0284c7] inline-block rounded" />
                    Compare with All Bangladesh
                  </span>
                </label>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[#eef8f2] border border-[#c6e8d0] text-[#155338] font-medium">
                  <Check size={12} className="text-[#155338]" />
                  National Aggregate Scope
                </span>
              )}

              {/* CSV Export Button */}
              <a
                href={csvDownloadUrl}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-[#155338] bg-[#eef8f2] hover:bg-[#dcf2e4] border border-[#c6e8d0] transition-colors"
                title={`Download verified numerical observations for ${shortLabel}`}
              >
                <Download size={13} />
                <span>Export CSV ({shortLabel})</span>
              </a>
            </div>
          </div>

          {/* ── Loading / Error State ── */}
          {loading && (
            <div className="p-12 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-[#155338] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[#6b7c72]">Loading verified historical records for {displayLabel}…</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-[#fef2f2] border border-[#fecaca] flex items-center gap-3 text-xs text-[#b91c1c]">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && historyData && (
            <>
              {/* ── 5 Historical Insights Metric Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. Avg Historical Yield */}
                <div className="p-3.5 rounded-xl bg-white border border-[#e8efe9] shadow-xs">
                  <p className="text-[11px] font-medium text-[#6b7c72]">Avg Historical Yield ({shortLabel})</p>
                  <p className="text-lg font-bold text-[#141c17] mt-0.5">
                    {historyData.summary.avg_yield_t_ha !== null ? `${historyData.summary.avg_yield_t_ha.toFixed(2)} t/ha` : '—'}
                  </p>
                  <p className="text-[10px] text-[#6b7c72] mt-0.5">
                    {compareWithNational && !isNational && nationalData?.summary?.avg_yield_t_ha != null
                      ? `vs ${nationalData.summary.avg_yield_t_ha.toFixed(2)} t/ha National (${(historyData.summary.avg_yield_t_ha! - nationalData.summary.avg_yield_t_ha) >= 0 ? '+' : ''}${(historyData.summary.avg_yield_t_ha! - nationalData.summary.avg_yield_t_ha).toFixed(2)} t/ha)`
                      : `Over ${historyData.summary.valid_yield_count} recorded crop-years`}
                  </p>
                </div>

                {/* 2. Highest Recorded */}
                <div className="p-3.5 rounded-xl bg-white border border-[#e8efe9] shadow-xs">
                  <p className="text-[11px] font-medium text-[#6b7c72]">Highest Recorded Yield ({shortLabel})</p>
                  <p className="text-lg font-bold text-[#059669] mt-0.5">
                    {historyData.summary.highest_yield_t_ha !== null ? `${historyData.summary.highest_yield_t_ha.toFixed(2)} t/ha` : '—'}
                  </p>
                  <p className="text-[10px] text-[#6b7c72] mt-0.5">
                    In {historyData.summary.highest_year || '—'} ({shortLabel})
                  </p>
                </div>

                {/* 3. Lowest Recorded */}
                <div className="p-3.5 rounded-xl bg-white border border-[#e8efe9] shadow-xs">
                  <p className="text-[11px] font-medium text-[#6b7c72]">Lowest Recorded Yield ({shortLabel})</p>
                  <p className="text-lg font-bold text-[#d97706] mt-0.5">
                    {historyData.summary.lowest_yield_t_ha !== null ? `${historyData.summary.lowest_yield_t_ha.toFixed(2)} t/ha` : '—'}
                  </p>
                  <p className="text-[10px] text-[#6b7c72] mt-0.5">
                    In {historyData.summary.lowest_year || '—'} ({shortLabel})
                  </p>
                </div>

                {/* 4. Latest Available */}
                <div className="p-3.5 rounded-xl bg-white border border-[#e8efe9] shadow-xs">
                  <p className="text-[11px] font-medium text-[#6b7c72]">Latest Available Yield ({shortLabel})</p>
                  <p className="text-lg font-bold text-[#155338] mt-0.5">
                    {historyData.summary.latest_yield_t_ha !== null ? `${historyData.summary.latest_yield_t_ha.toFixed(2)} t/ha` : '—'}
                  </p>
                  <p className="text-[10px] text-[#6b7c72] mt-0.5">
                    {compareWithNational && !isNational && nationalData?.summary?.latest_yield_t_ha != null
                      ? `In ${historyData.summary.latest_year || '—'} (vs ${nationalData.summary.latest_yield_t_ha.toFixed(2)} t/ha Nat.)`
                      : `In ${historyData.summary.latest_year || '—'} (${shortLabel})`}
                  </p>
                </div>

                {/* 5. Historical Trend / Change */}
                <div className="p-3.5 rounded-xl bg-white border border-[#e8efe9] shadow-xs">
                  <p className="text-[11px] font-medium text-[#6b7c72]">Long-term Change ({shortLabel})</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {historyData.summary.change_t_ha !== null ? (
                      historyData.summary.change_t_ha >= 0 ? (
                        <>
                          <TrendingUp size={16} className="text-[#059669]" />
                          <span className="text-lg font-bold text-[#059669]">
                            +{historyData.summary.change_t_ha.toFixed(2)} t/ha
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown size={16} className="text-[#b91c1c]" />
                          <span className="text-lg font-bold text-[#b91c1c]">
                            {historyData.summary.change_t_ha.toFixed(2)} t/ha
                          </span>
                        </>
                      )
                    ) : (
                      <span className="text-lg font-bold text-[#6b7c72]">—</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#6b7c72] mt-0.5">
                    {historyData.summary.change_pct !== null && historyData.summary.change_pct !== 0
                      ? `${historyData.summary.change_pct > 0 ? '+' : ''}${historyData.summary.change_pct.toFixed(1)}% since ${historyData.summary.earliest_year || 'baseline'} for ${shortLabel}`
                      : 'Baseline observation'}
                  </p>
                </div>
              </div>

              {/* ── Interactive Recharts Time-Series ── */}
              <div className="p-4 rounded-xl bg-[#fafbfa] border border-[#e8efe9] space-y-4">
                {/* Mode 1: Split View (Synchronized Dual Charts sharing X-axis) */}
                {chartView === 'split' && (
                  <div className="space-y-3">
                    {/* Primary Chart: Historical Yield */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 px-1">
                        <span className="text-xs font-semibold text-[#141c17] flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#155338]" />
                          Actual Historical Yield — {displayLabel} (t/ha)
                          {showForecastPoint && historyData.forecast_marker && (
                            <span className="ml-2 text-[10px] text-[#7c3aed] font-medium px-2 py-0.5 bg-[#f5f3ff] rounded-full border border-[#ddd6fe]">
                              ★ Forecast: {historyData.forecast_marker.display_season} ({historyData.forecast_marker.predicted_yield_t_ha.toFixed(2)} t/ha) [{shortLabel}]
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-[#6b7c72]">Source: BBS {isNational ? 'National Censuses' : 'District Surveys'}</span>
                      </div>
                      <div style={{ width: '100%', height: 190 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} syncId="cropHistorySync" margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8efe9" />
                            <XAxis dataKey="short_year" tick={{ fontSize: 10, fill: '#6b7c72' }} tickLine={false} />
                            <YAxis
                              domain={['dataMin - 0.2', 'dataMax + 0.2']}
                              tick={{ fontSize: 10, fill: '#6b7c72' }}
                              tickLine={false}
                              axisLine={false}
                              unit=" t"
                            />
                            <ReTooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload || !payload.length) return null;
                                const dataItem = payload[0].payload;
                                return (
                                  <div className="bg-white p-2.5 rounded-xl border border-[#c6e8d0] shadow-md text-xs space-y-1">
                                    <p className="font-bold text-[#141c17] border-b border-[#e8efe9] pb-1">
                                      Crop Year: {dataItem.crop_year}
                                    </p>
                                    {dataItem.is_forecast ? (
                                      <div className="space-y-0.5">
                                        <p className="text-[#7c3aed] font-semibold">
                                          {shortLabel} EXP_36 ML Forecast:{' '}
                                          <span className="text-sm font-bold">{dataItem.forecast_yield?.toFixed(3)} t/ha</span>
                                        </p>
                                        {compareWithNational && !isNational && dataItem.national_forecast_yield && (
                                          <p className="text-[#0284c7] font-medium text-[11px]">
                                            All Bangladesh Forecast:{' '}
                                            <span className="font-semibold">{dataItem.national_forecast_yield.toFixed(3)} t/ha</span>
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-[#155338] font-semibold flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-[#155338]" />
                                            {shortLabel} Observed Yield:
                                          </span>
                                          <span className="text-sm font-bold text-[#155338]">
                                            {dataItem.actual_yield !== null ? `${dataItem.actual_yield.toFixed(3)} t/ha` : 'Not Reported'}
                                          </span>
                                        </div>
                                        {compareWithNational && !isNational && dataItem.national_yield !== null && (
                                          <>
                                            <div className="flex items-center justify-between gap-3 text-[11px] text-[#0284c7]">
                                              <span className="font-medium flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
                                                All Bangladesh Benchmark:
                                              </span>
                                              <span className="font-semibold">{dataItem.national_yield.toFixed(3)} t/ha</span>
                                            </div>
                                            {dataItem.yield_diff !== null && (
                                              <div className="flex items-center justify-between gap-3 text-[10px] pt-0.5 border-t border-[#eef5f0]">
                                                <span className="text-[#6b7c72]">Variance vs National:</span>
                                                <span className={`font-bold ${dataItem.yield_diff >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'}`}>
                                                  {dataItem.yield_diff >= 0 ? '+' : ''}{dataItem.yield_diff.toFixed(3)} t/ha ({((dataItem.yield_diff / (dataItem.national_yield || 1)) * 100).toFixed(1)}%)
                                                </span>
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {dataItem.area_ha && (
                                          <p className="text-[#6b7c72] text-[11px]">
                                            {isNational ? 'Total Cultivated Area' : 'Cultivated Area'}: {Math.round(dataItem.area_ha).toLocaleString()} ha
                                          </p>
                                        )}
                                        {dataItem.production_t && (
                                          <p className="text-[#6b7c72] text-[11px]">
                                            {isNational ? 'Total National Harvest' : 'Actual Harvest'}: {Math.round(dataItem.production_t).toLocaleString()} tonnes
                                          </p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="actual_yield"
                              name={`${shortLabel} Observed Yield`}
                              stroke="#155338"
                              strokeWidth={2.5}
                              dot={{ r: 3.5, fill: '#155338' }}
                              activeDot={{ r: 6 }}
                              connectNulls={false}
                            />
                            {compareWithNational && !isNational && (
                              <Line
                                type="monotone"
                                dataKey="national_yield"
                                name="All Bangladesh Benchmark"
                                stroke="#0284c7"
                                strokeWidth={2}
                                strokeDasharray="4 3"
                                dot={{ r: 3, fill: '#0284c7' }}
                                activeDot={{ r: 5 }}
                                connectNulls={false}
                              />
                            )}
                            {showForecastPoint && (
                              <Line
                                type="monotone"
                                dataKey="forecast_yield"
                                name={`${shortLabel} Forecast`}
                                stroke="#7c3aed"
                                strokeWidth={2.5}
                                strokeDasharray="4 4"
                                dot={{ r: 5, fill: '#7c3aed', strokeWidth: 2, stroke: '#fff' }}
                              />
                            )}
                            {showForecastPoint && compareWithNational && !isNational && (
                              <Line
                                type="monotone"
                                dataKey="national_forecast_yield"
                                name="National Forecast"
                                stroke="#0284c7"
                                strokeWidth={2}
                                strokeDasharray="2 2"
                                dot={{ r: 4, fill: '#0284c7', strokeWidth: 1.5, stroke: '#fff' }}
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Secondary Chart: Selected Environmental Variable */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 px-1 pt-2 border-t border-[#e8efe9]">
                        <span className="text-xs font-semibold text-[#141c17] flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentEnv.color }} />
                          {currentEnv.label} ({currentEnv.unit})
                        </span>
                        <span className="text-[10px] text-[#6b7c72]">
                          Source: {historyData.environmental_variables[selectedVar]?.source || 'ERA5-Land / MODIS'}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} syncId="cropHistorySync" margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8efe9" />
                            <XAxis dataKey="short_year" tick={{ fontSize: 10, fill: '#6b7c72' }} tickLine={false} />
                            <YAxis
                              domain={['auto', 'auto']}
                              tick={{ fontSize: 10, fill: '#6b7c72' }}
                              tickLine={false}
                              axisLine={false}
                              unit={` ${currentEnv.unit}`}
                            />
                            <ReTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const d = payload[0].payload;
                                if (d.is_forecast) {
                                  return (
                                    <div className="bg-white p-2 rounded-lg border border-[#e8efe9] text-xs">
                                      <p className="font-semibold text-[#6b7c72]">{d.crop_year}</p>
                                      <p className="text-[#6b7c72]">Forecast season ahead (observed RS window ends Aug–Sep 2026)</p>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="bg-white p-2.5 rounded-xl border border-[#e8efe9] shadow-md text-xs space-y-1">
                                    <p className="font-bold text-[#141c17] border-b border-[#e8efe9] pb-0.5">
                                      {d.crop_year}
                                    </p>
                                    <p style={{ color: currentEnv.color }} className="font-semibold">
                                      {currentEnv.label}:{' '}
                                      <span className="text-sm font-bold">
                                        {d.env_value !== null ? `${d.env_value} ${currentEnv.unit}` : 'Missing / Unavailable'}
                                      </span>
                                    </p>
                                    <p className="text-[10px] text-[#6b7c72]">
                                      Window: {historyData.provenance.season_alignment}
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="env_value"
                              name={currentEnv.label}
                              stroke={currentEnv.color}
                              strokeWidth={2}
                              dot={{ r: 3, fill: currentEnv.color }}
                              activeDot={{ r: 5 }}
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mode 2: Combined Overlay with Dual Y-Axes */}
                {chartView === 'overlay' && (
                  <div>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-semibold text-[#141c17]">
                        Dual-Axis Comparison ({shortLabel}): Yield (Left, Green) vs {currentEnv.label} (Right, Colored)
                      </span>
                      <span className="text-[10px] text-[#6b7c72]">Shared Crop-Year Timeline</span>
                    </div>
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e8efe9" />
                          <XAxis dataKey="short_year" tick={{ fontSize: 10, fill: '#6b7c72' }} tickLine={false} />
                          <YAxis
                            yAxisId="left"
                            domain={['dataMin - 0.2', 'dataMax + 0.2']}
                            tick={{ fontSize: 10, fill: '#155338' }}
                            tickLine={false}
                            axisLine={false}
                            unit=" t"
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 10, fill: currentEnv.color }}
                            tickLine={false}
                            axisLine={false}
                            unit={` ${currentEnv.unit}`}
                          />
                          <ReTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white p-2.5 rounded-xl border border-[#c6e8d0] shadow-md text-xs space-y-1">
                                  <p className="font-bold text-[#141c17] border-b border-[#e8efe9] pb-0.5">
                                    {d.crop_year}
                                  </p>
                                  {d.actual_yield !== null && (
                                    <p className="text-[#155338] font-medium">
                                      {shortLabel} Yield: <b>{d.actual_yield} t/ha</b>
                                    </p>
                                  )}
                                  {compareWithNational && !isNational && d.national_yield !== null && (
                                    <p className="text-[#0284c7] font-medium">
                                      All Bangladesh Benchmark: <b>{d.national_yield} t/ha</b>
                                    </p>
                                  )}
                                  {d.forecast_yield && (
                                    <p className="text-[#7c3aed] font-medium">
                                      {shortLabel} EXP_36 Forecast: <b>{d.forecast_yield} t/ha</b>
                                    </p>
                                  )}
                                  {d.env_value !== null && (
                                    <p style={{ color: currentEnv.color }} className="font-medium">
                                      {currentEnv.label}: <b>{d.env_value} {currentEnv.unit}</b>
                                    </p>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="actual_yield"
                            name={`${shortLabel} Yield (t/ha)`}
                            stroke="#155338"
                            strokeWidth={2.5}
                            dot={{ r: 3.5, fill: '#155338' }}
                          />
                          {compareWithNational && !isNational && (
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="national_yield"
                              name="All Bangladesh Benchmark (t/ha)"
                              stroke="#0284c7"
                              strokeWidth={2}
                              strokeDasharray="4 3"
                              dot={{ r: 3, fill: '#0284c7' }}
                            />
                          )}
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="env_value"
                            name={`${currentEnv.label} (${currentEnv.unit})`}
                            stroke={currentEnv.color}
                            strokeWidth={2}
                            dot={{ r: 3, fill: currentEnv.color }}
                          />
                          {showForecastPoint && (
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="forecast_yield"
                              name={`${shortLabel} Forecast (t/ha)`}
                              stroke="#7c3aed"
                              strokeWidth={2.5}
                              strokeDasharray="4 4"
                              dot={{ r: 5, fill: '#7c3aed' }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Mode 3: Yield Only */}
                {chartView === 'yield_only' && (
                  <div>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-semibold text-[#141c17]">
                        Verified Historical Yield Profile — {displayLabel} ({crop})
                      </span>
                      <span className="text-[10px] text-[#6b7c72]">Source: BBS {isNational ? 'National Censuses' : 'Agricultural Censuses'}</span>
                    </div>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e8efe9" />
                          <XAxis dataKey="short_year" tick={{ fontSize: 10, fill: '#6b7c72' }} tickLine={false} />
                          <YAxis
                            domain={['dataMin - 0.2', 'dataMax + 0.2']}
                            tick={{ fontSize: 10, fill: '#155338' }}
                            tickLine={false}
                            axisLine={false}
                            unit=" t/ha"
                          />
                          <ReTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white p-2.5 rounded-xl border border-[#c6e8d0] shadow-md text-xs space-y-1">
                                  <p className="font-bold text-[#141c17] border-b border-[#e8efe9] pb-0.5">
                                    {d.crop_year}
                                  </p>
                                  {d.is_forecast ? (
                                    <p className="text-[#7c3aed] font-bold">
                                      {shortLabel} EXP_36 Forecast: {d.forecast_yield?.toFixed(3)} t/ha
                                    </p>
                                  ) : (
                                    <>
                                      <p className="text-[#155338] font-bold">
                                        {shortLabel} Observed Yield: {d.actual_yield !== null ? `${d.actual_yield?.toFixed(3)} t/ha` : 'Not Reported'}
                                      </p>
                                      {compareWithNational && !isNational && d.national_yield !== null && (
                                        <p className="text-[#0284c7] font-semibold text-[11px]">
                                          All Bangladesh Benchmark: {d.national_yield.toFixed(3)} t/ha
                                        </p>
                                      )}
                                      {d.area_ha && <p className="text-[#6b7c72]">{isNational ? 'Total Area' : 'Area'}: {Math.round(d.area_ha).toLocaleString()} ha</p>}
                                      {d.production_t && <p className="text-[#6b7c72]">{isNational ? 'Total Harvest' : 'Production'}: {Math.round(d.production_t).toLocaleString()} t</p>}
                                    </>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="actual_yield"
                            fill="#eef8f2"
                            stroke="#155338"
                            strokeWidth={2.5}
                            name={`${shortLabel} Actual Yield`}
                            dot={{ r: 3.5, fill: '#155338' }}
                          />
                          {compareWithNational && !isNational && (
                            <Line
                              type="monotone"
                              dataKey="national_yield"
                              name="All Bangladesh Benchmark"
                              stroke="#0284c7"
                              strokeWidth={2}
                              strokeDasharray="4 3"
                              dot={{ r: 3, fill: '#0284c7' }}
                            />
                          )}
                          {showForecastPoint && (
                            <Line
                              type="monotone"
                              dataKey="forecast_yield"
                              name={`${shortLabel} Forecast`}
                              stroke="#7c3aed"
                              strokeWidth={2.5}
                              strokeDasharray="4 4"
                              dot={{ r: 5, fill: '#7c3aed' }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>


              {/* ── Scientific Provenance & Correlation Disclaimer ── */}
              <div className="p-3.5 rounded-xl bg-[#f4f7f5] border border-[#e2e7e3] flex items-start gap-2.5 text-xs text-[#526359] leading-relaxed">
                <Info size={16} className="text-[#155338] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#141c17]">Data Provenance & Scientific Methodology</p>
                  <p className="mt-0.5">
                    Historical yields are verified from Bangladesh Bureau of Statistics (BBS) district crop surveys (2006–2026).
                    Seasonal weather and satellite vegetation aggregates are computed across standardized modeling windows
                    (Kharif-I: Mar–Jul; Kharif-II: Jul–Oct; Rabi: Oct–Mar) matching the EXP_36 Random Forest feature definitions.
                    Observed trends demonstrate historical environmental relationships; statistical correlation does not imply direct causation.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB B: NATIONAL YIELD DISTRIBUTION
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'distribution' && (
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#141c17]">
                National Yield Distribution: {crop} ({displaySeason})
              </h3>
              <p className="text-xs text-[#6b7c72]">
                Distribution spread and quintile density across all {records.length} Bangladesh districts
              </p>
            </div>
            {selectedDistrict && (
              <span className="text-xs font-medium px-3 py-1 bg-[#eef8f2] text-[#155338] rounded-full border border-[#c6e8d0]">
                Highlighted: <b>{selectedDistrict}</b>
              </span>
            )}
          </div>

          {/* Full Distribution Chart */}
          <div className="p-4 rounded-xl bg-[#f8faf8] border border-[#e8efe9]">
            <YieldDistributionFullChart records={records} selectedDistrict={selectedDistrict ?? undefined} />
          </div>

          {/* Quintile Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            {computeQuintiles(records).map((q, i) => (
              <div key={i} className="p-3 rounded-xl border border-[#e8efe9] bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-[#141c17]">{q.label}</span>
                  <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: q.color }} />
                </div>
                <p className="text-sm font-bold text-[#141c17]">{q.count} districts</p>
                <p className="text-[10px] text-[#6b7c72] mt-0.5">{q.range}</p>
              </div>
            ))}
          </div>

          {/* Context note */}
          <p className="text-xs text-[#6b7c72] italic">
            This distribution illustrates regional yield variation nationwide. Districts in the upper quintiles benefit
            from high irrigation coverage and favorable agro-ecological soil zones.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab B Full Distribution Helper Chart ──────────────────────────────────────

function YieldDistributionFullChart({
  records,
  selectedDistrict,
}: {
  records: DistrictExplorerRecord[];
  selectedDistrict?: string;
}) {
  const buckets = useMemo(() => {
    if (records.length === 0) return [];
    const yields = records.map((r) => r.predicted_yield_t_ha);
    const min = Math.min(...yields);
    const max = Math.max(...yields);
    const range = max - min || 1;
    const N = 12;
    const step = range / N;
    const bins: { label: string; count: number; districts: string[]; hasSelected: boolean }[] = [];

    for (let i = 0; i < N; i++) {
      const lo = min + i * step;
      const hi = lo + step;
      const matched = records.filter((r) =>
        r.predicted_yield_t_ha >= lo && (i === N - 1 ? r.predicted_yield_t_ha <= hi : r.predicted_yield_t_ha < hi)
      );
      bins.push({
        label: `${lo.toFixed(2)}–${hi.toFixed(2)}`,
        count: matched.length,
        districts: matched.map((m) => m.district),
        hasSelected: selectedDistrict ? matched.some((m) => m.district.toLowerCase() === selectedDistrict.toLowerCase()) : false,
      });
    }
    return bins;
  }, [records, selectedDistrict]);

  if (buckets.length === 0) return null;

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8efe9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7c72' }} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#6b7c72' }} tickLine={false} axisLine={false} unit=" dist." />
          <ReTooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const b = payload[0].payload;
              return (
                <div className="bg-white p-2.5 rounded-xl border border-[#c6e8d0] shadow-md text-xs space-y-1 max-w-xs">
                  <p className="font-bold text-[#141c17] border-b border-[#e8efe9] pb-0.5">
                    Yield Range: {b.label} t/ha
                  </p>
                  <p className="text-[#155338] font-semibold">
                    {b.count} districts ({((b.count / records.length) * 100).toFixed(0)}%)
                  </p>
                  <p className="text-[10px] text-[#6b7c72] leading-tight">
                    {b.districts.slice(0, 8).join(', ')}
                    {b.districts.length > 8 ? ` +${b.districts.length - 8} more` : ''}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell
                key={i}
                fill={b.hasSelected ? '#155338' : '#22c55e'}
                fillOpacity={b.hasSelected ? 1 : 0.65}
                stroke={b.hasSelected ? '#0b3d26' : undefined}
                strokeWidth={b.hasSelected ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function computeQuintiles(records: DistrictExplorerRecord[]) {
  if (records.length === 0) return [];
  const sorted = [...records].sort((a, b) => a.predicted_yield_t_ha - b.predicted_yield_t_ha);
  const quintileSize = Math.ceil(sorted.length / 5);

  const colors = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#15803d'];
  const labels = ['Tier 1 (Lowest)', 'Tier 2 (Low)', 'Tier 3 (Moderate)', 'Tier 4 (High)', 'Tier 5 (Top)'];

  return [0, 1, 2, 3, 4].map((i) => {
    const chunk = sorted.slice(i * quintileSize, (i + 1) * quintileSize);
    const min = chunk[0]?.predicted_yield_t_ha?.toFixed(2) || '0';
    const max = chunk[chunk.length - 1]?.predicted_yield_t_ha?.toFixed(2) || '0';
    return {
      label: labels[i],
      count: chunk.length,
      range: `${min} – ${max} t/ha`,
      color: colors[i],
    };
  });
}
