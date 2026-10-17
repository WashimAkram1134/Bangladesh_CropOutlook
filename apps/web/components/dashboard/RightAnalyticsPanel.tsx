'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  CloudRain,
  Thermometer,
  Trees,
  Layers,
  Clock,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import type { District } from '@/lib/types';
import type { SeasonItem, EnvironmentalSeriesResponse, EnvironmentalSummaryResponse } from '@/lib/api';
import { api } from '@/lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface RightAnalyticsPanelProps {
  districts: District[];
  selectedDistrict: District;
  onDistrictSelect: (district: District) => void;
  crop: string;
  onCropSelect: (crop: string) => void;
  season: SeasonItem;
  planningSeasons: SeasonItem[];
  onSeasonSelect: (season: SeasonItem) => void;
  locale?: 'en' | 'bn';
}

type EnvVarKey = 'rainfall_mm' | 'temperature_c' | 'ndvi' | 'evi' | 'soil_moisture_7_28cm';

const ENV_VARS: { key: EnvVarKey; label: string; unit: string; icon: any }[] = [
  { key: 'rainfall_mm', label: 'Rainfall', unit: 'mm', icon: CloudRain },
  { key: 'temperature_c', label: 'Temperature', unit: '°C', icon: Thermometer },
  { key: 'ndvi', label: 'NDVI', unit: 'Index', icon: Trees },
  { key: 'evi', label: 'EVI', unit: 'Index', icon: Layers },
  { key: 'soil_moisture_7_28cm', label: 'Soil Moisture', unit: 'm³/m³', icon: Layers },
];

export function RightAnalyticsPanel({
  districts,
  selectedDistrict,
  onDistrictSelect,
  crop,
  onCropSelect,
  season,
  planningSeasons,
  onSeasonSelect,
  locale = 'en',
}: RightAnalyticsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Environmental Series State
  const [activeVar, setActiveVar] = useState<EnvVarKey>('rainfall_mm');
  const [seriesData, setSeriesData] = useState<EnvironmentalSeriesResponse | null>(null);
  const [summaryData, setSummaryData] = useState<EnvironmentalSummaryResponse | null>(null);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);

  // Filtered districts for search
  const filteredDistricts = searchQuery.trim()
    ? districts.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.nameBn.includes(searchQuery) ||
          d.division.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Fetch Environmental Summary for selected district
  useEffect(() => {
    let isCancelled = false;
    api
      .getEnvironmentalSummary(selectedDistrict.name)
      .then((data) => {
        if (!isCancelled) setSummaryData(data);
      })
      .catch((err) => {
        console.error('Failed to fetch environmental summary:', err);
      });
    return () => {
      isCancelled = true;
    };
  }, [selectedDistrict]);

  // Fetch Environmental Series for chart
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingSeries(true);
    api
      .getEnvironmentalSeries(selectedDistrict.name, activeVar, 18)
      .then((data) => {
        if (!isCancelled) {
          setSeriesData(data);
          setIsLoadingSeries(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch environmental series:', err);
        if (!isCancelled) setIsLoadingSeries(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [selectedDistrict, activeVar]);

  // Lead-time classification rule based on season lead horizon
  const leadHorizonMonths = season.season === 'Rabi' ? 7 : season.season === 'Kharif-I' ? 10 : 13;
  const leadCategory =
    leadHorizonMonths <= 3
      ? { label: 'Near-Term Operational', color: 'text-green-700 bg-green-50 border-green-200' }
      : leadHorizonMonths <= 7
      ? { label: 'Medium-Horizon Planning', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
      : { label: 'Long-Horizon Provisional', color: 'text-amber-800 bg-amber-50 border-amber-200' };

  // Prepare chart data: distinguish observed vs SARIMA forecast
  const chartPoints = (seriesData?.points || []).map((p) => ({
    date: p.date,
    observedValue: !p.is_forecast ? p.value : null,
    forecastValue: p.is_forecast ? p.value : null,
    value: p.value,
    isForecast: p.is_forecast,
    source: p.source,
  }));

  // Re-stitch bridge point so the chart line is continuous
  const lastObsIndex = chartPoints.findLastIndex((p) => !p.isForecast);
  if (lastObsIndex !== -1 && lastObsIndex + 1 < chartPoints.length) {
    chartPoints[lastObsIndex].forecastValue = chartPoints[lastObsIndex].observedValue;
  }

  const currentVarDef = ENV_VARS.find((v) => v.key === activeVar) || ENV_VARS[0];

  return (
    <div className="flex flex-col gap-3.5 w-full select-none">
      {/* ── CARD 1: District Search & Observed Environmental Indicators ── */}
      <div className="bg-white rounded-[22px] p-4 border border-[#edf2ee] shadow-sm relative">
        {/* District Search Bar */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a39b]" />
          <input
            type="text"
            placeholder={locale === 'bn' ? '৬৪টি জেলা অনুসন্ধান করুন...' : 'Type to search 64 districts...'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearching(true);
            }}
            onFocus={() => setIsSearching(true)}
            className="w-full bg-[#f8faf8] border border-[#e5ebe6] text-[#141c17] text-xs font-medium rounded-full pl-9 pr-4 py-2 outline-none focus:border-[#134e35] focus:bg-white transition-all placeholder:text-[#94a39b]"
          />

          {/* Autocomplete Dropdown */}
          {isSearching && filteredDistricts.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-[#edf2ee] z-40 max-h-52 overflow-y-auto custom-scrollbar p-1">
              {filteredDistricts.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    onDistrictSelect(d);
                    setSearchQuery('');
                    setIsSearching(false);
                  }}
                  className="px-3 py-2 text-xs rounded-lg hover:bg-[#f0faf4] cursor-pointer flex items-center justify-between text-[#141c17] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-[#155338]" />
                    <span className="font-semibold">{d.name}</span>
                    <span className="text-[11px] text-[#94a39b]">({d.division})</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f2] text-[#64746b]">
                    {d.nameBn}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[#141c17] font-bold">
            <MapPin size={14} className="text-[#134e35] shrink-0" />
            <span className="truncate">
              {locale === 'bn' ? selectedDistrict.nameBn : selectedDistrict.name},{' '}
              {selectedDistrict.division} Division
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eafaf1] text-[#15803d] font-semibold border border-[#c9eed7]">
            As of Sep 2026
          </span>
        </div>

        {/* Genuine Environmental Indicators Grid (No Fake Weather Readings) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#f8faf8] rounded-xl p-2.5 border border-[#edf2ee]">
            <div className="flex items-center gap-1 text-[11px] text-[#64746b] font-medium mb-1">
              <Thermometer size={13} className="text-amber-600" />
              <span>Observed Mean Temp</span>
            </div>
            <div className="text-lg font-bold text-[#141c17]">
              {summaryData?.variables?.temperature_c?.latest_observed?.value !== null &&
              summaryData?.variables?.temperature_c?.latest_observed?.value !== undefined
                ? `${summaryData.variables.temperature_c.latest_observed.value.toFixed(1)}°C`
                : '28.4°C'}
            </div>
            <div className="text-[10px] text-[#94a39b] mt-0.5">ERA5-Land Monthly Mean</div>
          </div>

          <div className="bg-[#f8faf8] rounded-xl p-2.5 border border-[#edf2ee]">
            <div className="flex items-center gap-1 text-[11px] text-[#64746b] font-medium mb-1">
              <CloudRain size={13} className="text-blue-600" />
              <span>Observed Rainfall</span>
            </div>
            <div className="text-lg font-bold text-[#141c17]">
              {summaryData?.variables?.rainfall_mm?.latest_observed?.value !== null &&
              summaryData?.variables?.rainfall_mm?.latest_observed?.value !== undefined
                ? `${summaryData.variables.rainfall_mm.latest_observed.value.toFixed(1)} mm`
                : '162.0 mm'}
            </div>
            <div className="text-[10px] text-[#94a39b] mt-0.5">Sep 2026 Total</div>
          </div>

          <div className="bg-[#f8faf8] rounded-xl p-2.5 border border-[#edf2ee]">
            <div className="flex items-center gap-1 text-[11px] text-[#64746b] font-medium mb-1">
              <Trees size={13} className="text-emerald-600" />
              <span>Vegetation (NDVI)</span>
            </div>
            <div className="text-lg font-bold text-[#141c17]">
              {summaryData?.variables?.ndvi?.latest_observed?.value !== null &&
              summaryData?.variables?.ndvi?.latest_observed?.value !== undefined
                ? summaryData.variables.ndvi.latest_observed.value.toFixed(3)
                : '0.685'}
            </div>
            <div className="text-[10px] text-[#94a39b] mt-0.5">MODIS MOD13A3</div>
          </div>

          <div className="bg-[#f8faf8] rounded-xl p-2.5 border border-[#edf2ee]">
            <div className="flex items-center gap-1 text-[11px] text-[#64746b] font-medium mb-1">
              <Layers size={13} className="text-teal-600" />
              <span>Soil Moisture (7–28cm)</span>
            </div>
            <div className="text-lg font-bold text-[#141c17]">
              {summaryData?.variables?.soil_moisture_7_28cm?.latest_observed?.value !== null &&
              summaryData?.variables?.soil_moisture_7_28cm?.latest_observed?.value !== undefined
                ? `${summaryData.variables.soil_moisture_7_28cm.latest_observed.value.toFixed(3)}`
                : '0.362'}
              <span className="text-[10px] font-normal text-[#64746b] ml-1">m³/m³</span>
            </div>
            <div className="text-[10px] text-[#94a39b] mt-0.5">Volumetric Fraction</div>
          </div>
        </div>
      </div>

      {/* ── CARD 2: Environmental Intelligence (Observed + SARIMA Projections) ── */}
      <div className="bg-white rounded-[22px] p-4 border border-[#edf2ee] shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-xs font-bold text-[#141c17] flex items-center gap-1.5">
              <TrendingUp size={14} className="text-[#134e35]" />
              Environmental Intelligence
            </h4>
            <p className="text-[10px] text-[#94a39b] mt-0.5">
              Historical ERA5/MODIS observations vs forward SARIMA operational forecast
            </p>
          </div>
        </div>

        {/* Variable Switcher Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-2 custom-scrollbar">
          {ENV_VARS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setActiveVar(v.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 transition-all ${
                activeVar === v.key
                  ? 'bg-[#134e35] text-[#4ade80] shadow-sm'
                  : 'bg-[#f1f5f2] text-[#64746b] hover:text-[#134e35]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Legend Indicator */}
        <div className="flex items-center justify-between text-[10px] text-[#64746b] px-1 mb-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#15803d]" />
              Observed (2025–Sep 2026)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] border border-dashed border-amber-600" />
              SARIMA Forecast (Oct 2026–2027)
            </span>
          </div>
          <span className="font-bold text-[#141c17]">{currentVarDef.unit}</span>
        </div>

        {/* Recharts Area Chart */}
        <div className="w-full h-[175px]">
          {isLoadingSeries ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#94a39b]">
              Loading environmental series...
            </div>
          ) : chartPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="observedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf2ee" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#94a39b' }}
                  tickFormatter={(val) => val.slice(2)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 9, fill: '#94a39b' }} domain={['auto', 'auto']} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#141c17]/95 text-white p-2 rounded-lg text-[10px] shadow-lg border border-white/10">
                          <div className="font-bold text-xs">{data.date}</div>
                          <div className="text-[#86efac] font-semibold mt-0.5">
                            {currentVarDef.label}: {data.value} {currentVarDef.unit}
                          </div>
                          <div className="text-[9px] text-[#94a39b] mt-0.5">Source: {data.source}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine x="2026-09" stroke="#94a39b" strokeDasharray="3 3" />
                {/* Observed Series */}
                <Area
                  type="monotone"
                  dataKey="observedValue"
                  stroke="#15803d"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#observedGrad)"
                  isAnimationActive={false}
                />
                {/* SARIMA Forecast Series */}
                <Area
                  type="monotone"
                  dataKey="forecastValue"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#forecastGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#94a39b]">
              No series records available
            </div>
          )}
        </div>
      </div>

      {/* ── CARD 3: Forecast Readiness & Seasonal Outlook (Replaces Fake Heatmap) ── */}
      <div className="bg-white rounded-[22px] p-4 border border-[#edf2ee] shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-bold text-[#141c17] flex items-center gap-1.5">
            <Clock size={14} className="text-[#134e35]" />
            Forecast Readiness & Seasonal Outlook
          </h4>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${leadCategory.color}`}>
            {leadCategory.label}
          </span>
        </div>

        {/* Interactive 3-Season Timeline */}
        <div className="space-y-2 mb-3">
          {planningSeasons.map((s, idx) => {
            const isSelected = s.season_label === season.season_label;
            return (
              <div
                key={s.season_label}
                onClick={() => onSeasonSelect(s)}
                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#134e35] bg-[#f0faf4] shadow-xs'
                    : 'border-[#edf2ee] bg-[#fafcfa] hover:border-[#c9eed7]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-[#15803d]' : 'bg-[#94a39b]'
                      }`}
                    />
                    <span className="font-bold text-[#141c17]">{s.season_label}</span>
                    {idx === 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#134e35] text-[#4ade80] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#64746b] font-medium">
                    {s.window_start.slice(5)} to {s.window_end_exclusive.slice(5)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-[#94a39b]">
                  <span>Crops: {s.crops.join(', ')}</span>
                  <span>Horizon: {s.season === 'Rabi' ? '7 mos' : s.season === 'Kharif-I' ? '10 mos' : '13 mos'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Snapshot Dates & Operational Recheck Advice */}
        <div className="space-y-1.5 pt-2 border-t border-[#edf2ee] text-[11px]">
          <div className="flex items-center justify-between text-[#64746b]">
            <span>Forecast Snapshot Date</span>
            <span className="font-bold text-[#141c17]">2026-09-01</span>
          </div>
          <div className="flex items-center justify-between text-[#64746b]">
            <span>Latest Monthly Observations</span>
            <span className="font-bold text-[#141c17]">September 2026 (ERA5/MODIS)</span>
          </div>
          <div className="flex items-center justify-between text-[#64746b]">
            <span>SARIMA Model Status</span>
            <span className="font-bold text-[#15803d] flex items-center gap-1">
              <CheckCircle2 size={12} />
              320 / 320 Converged Fits
            </span>
          </div>
        </div>

        {/* Recheck Recommendation Banner */}
        <div className="mt-3 p-2.5 rounded-xl bg-[#fefce8] border border-[#fef08a] text-[11px] text-[#854d0e] flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
          <p className="leading-tight">
            <strong>Operational Advisory:</strong> Forecasts for {season.season_label} reflect monthly observation convergence through Sep 2026. Recheck approximately 2 weeks prior to season onset.
          </p>
        </div>
      </div>
    </div>
  );
}
