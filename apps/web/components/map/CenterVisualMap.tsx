'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Maximize2, Plus, Minus, RotateCcw, Eye, Layers } from 'lucide-react';
import { FloatingMapCard } from './FloatingMapCard';
import type { District } from '@/lib/types';
import type { SeasonItem, ForecastRecordResponse } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import districtSvgData from '@/lib/districtSvgPaths.json';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface CenterVisualMapProps {
  districts: District[];
  selectedDistrict: District;
  onDistrictSelect: (district: District) => void;
  crop: string;
  season: SeasonItem;
  forecast?: ForecastRecordResponse | null;
  allForecasts?: ForecastRecordResponse[];
  selectedMetric: 'yield' | 'production';
  onMetricChange: (metric: 'yield' | 'production') => void;
  userAreaHa: number | null;
  onUserAreaChange: (val: number | null) => void;
  locale?: 'en' | 'bn';
}

interface SvgDistrictItem {
  id: string;
  name: string;
  division: string;
  d: string;
}

interface HoveredDistrictInfo {
  x: number;
  y: number;
  name: string;
  division: string;
  yieldVal: number;
  productionVal: number;
  areaVal: number;
}

// ─── Required Official EXP_38 Choropleth Palette ─────────────────────────────
const CHOROPLETH_PALETTE = {
  low: '#E8E4AE',
  lowerMiddle: '#B7D4CE',
  medium: '#70B5BB',
  upperMiddle: '#348F9C',
  high: '#185D77',
  selectedBorder: '#FFA726',
};

function normName(val: string): string {
  return val.toLowerCase().replace(/district|zila|zilla|[^a-z0-9]/g, '');
}

export function CenterVisualMap({
  districts,
  selectedDistrict,
  onDistrictSelect,
  crop,
  season,
  forecast,
  allForecasts = [],
  selectedMetric,
  onMetricChange,
  userAreaHa,
  onUserAreaChange,
  locale = 'en',
}: CenterVisualMapProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredInfo, setHoveredInfo] = useState<HoveredDistrictInfo | null>(null);
  const [hoveredNormId, setHoveredNormId] = useState<string | null>(null);
  const [showFloatingCard, setShowFloatingCard] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'choropleth' | 'hybrid'>('choropleth');

  const districtPaths = districtSvgData as Record<string, SvgDistrictItem>;

  // Ensure allForecasts is always safely an array
  const safeForecasts = useMemo(() => {
    return Array.isArray(allForecasts) ? allForecasts : [];
  }, [allForecasts]);

  // Build quick map of normalized district -> forecast record
  const forecastLookup = useMemo(() => {
    const map: Record<string, ForecastRecordResponse> = {};
    for (const f of safeForecasts) {
      if (f && f.district) {
        map[normName(f.district)] = f;
      }
    }
    return map;
  }, [safeForecasts]);

  // Compute 5-bin quantiles for the active metric across 64 districts
  const legendThresholds = useMemo(() => {
    if (!safeForecasts || safeForecasts.length === 0) {
      return [1, 2, 3, 4];
    }
    const values = safeForecasts
      .map((f) => (selectedMetric === 'yield' ? f.predicted_yield_t_ha : f.estimated_district_production_tonnes))
      .filter((v) => typeof v === 'number' && !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return [1, 2, 3, 4];
    }

    const step1 = values[Math.floor(values.length * 0.2)] ?? 1;
    const step2 = values[Math.floor(values.length * 0.4)] ?? 2;
    const step3 = values[Math.floor(values.length * 0.6)] ?? 3;
    const step4 = values[Math.floor(values.length * 0.8)] ?? 4;

    return [step1, step2, step3, step4];
  }, [safeForecasts, selectedMetric]);

  // Compute color for a district
  const getDistrictColor = useCallback(
    (normId: string) => {
      const fc = forecastLookup[normId];
      if (!fc) return CHOROPLETH_PALETTE.low;
      const val = selectedMetric === 'yield' ? fc.predicted_yield_t_ha : fc.estimated_district_production_tonnes;
      const [s1, s2, s3, s4] = legendThresholds;
      if (val < s1) return CHOROPLETH_PALETTE.low;
      if (val < s2) return CHOROPLETH_PALETTE.lowerMiddle;
      if (val < s3) return CHOROPLETH_PALETTE.medium;
      if (val < s4) return CHOROPLETH_PALETTE.upperMiddle;
      return CHOROPLETH_PALETTE.high;
    },
    [forecastLookup, selectedMetric, legendThresholds]
  );

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.2, Number((z + 0.18).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.85, Number((z - 0.18).toFixed(2))));
  const handleReset = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const selectedNorm = normName(selectedDistrict.name);

  return (
    <div
      className="relative w-full h-[450px] md:h-[490px] lg:h-[520px] rounded-[24px] overflow-hidden select-none border border-[#e2ebe4] shadow-md group"
      style={{
        backgroundImage: "url('/images/agri_background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Photographic darkening and softening overlay so choropleth colors and district borders stand out crisply */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      {/* SVG Bangladesh 64 Districts GIS Vector Choropleth Layer */}
      <div
        className="w-full h-full flex items-center justify-center p-3 transition-transform duration-300 ease-out"
        style={{
          transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
        }}
      >
        <svg
          viewBox="0 0 600 700"
          className="w-full h-full max-h-[96%] drop-shadow-lg"
        >
          <defs>
            <filter id="hotspotGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FFA726" floodOpacity="0.85" />
            </filter>
            <radialGradient id="selectedDistrictHighlight" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFA726" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.75" />
            </radialGradient>
          </defs>

          {/* District Polygons */}
          {Object.entries(districtPaths).map(([dId, item]) => {
            const currentNorm = normName(item.name);
            const isSelected = selectedNorm === currentNorm;
            const isHovered = hoveredNormId === currentNorm;
            const choroplethFill = getDistrictColor(currentNorm);
            const fc = forecastLookup[currentNorm];

            return (
              <g key={dId} className="cursor-pointer">
                {/* District Fill */}
                <path
                  d={item.d}
                  fill={isSelected ? '#FFA726' : choroplethFill}
                  fillOpacity={isSelected ? 0.95 : isHovered ? 0.9 : 0.82}
                  stroke={isSelected ? '#ffffff' : isHovered ? '#ffffff' : '#ffffff'}
                  strokeWidth={isSelected ? 3.2 : isHovered ? 1.8 : 0.85}
                  strokeDasharray={isSelected ? '6 3' : undefined}
                  filter={isSelected ? 'url(#hotspotGlow)' : undefined}
                  className="transition-all duration-150"
                  onMouseEnter={(e) => {
                    setHoveredNormId(currentNorm);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const matched = districts.find((d) => normName(d.name) === currentNorm);
                    setHoveredInfo({
                      x: rect.left,
                      y: rect.top,
                      name: matched?.name || item.name,
                      division: matched?.division || item.division,
                      yieldVal: fc ? fc.predicted_yield_t_ha : 0,
                      productionVal: fc ? fc.estimated_district_production_tonnes : 0,
                      areaVal: fc ? fc.assumed_district_area_ha : 0,
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredNormId(null);
                    setHoveredInfo(null);
                  }}
                  onClick={() => {
                    const matched = districts.find((d) => normName(d.name) === currentNorm);
                    if (matched) {
                      onDistrictSelect(matched);
                      setShowFloatingCard(true);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Top Left Title & Active Metric Badge */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#e2ebe4] shadow-sm flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#155338]" />
          <span className="text-xs font-bold text-[#141c17] tracking-tight">
            {locale === 'bn' ? 'বাংলাদেশ জিআইএস পূর্বাভাস' : 'Bangladesh GIS Crop Forecast'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eafaf1] text-[#15803d] font-bold">
            64 Districts
          </span>
        </div>

        {/* Metric Selector Toggle (Yield vs Production) */}
        <div className="bg-white/95 backdrop-blur-md rounded-full p-0.5 border border-[#e2ebe4] shadow-sm flex items-center">
          <button
            type="button"
            onClick={() => onMetricChange('yield')}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
              selectedMetric === 'yield'
                ? 'bg-[#134e35] text-[#4ade80] shadow-sm'
                : 'text-[#64746b] hover:text-[#134e35]'
            }`}
          >
            Yield (t/ha)
          </button>
          <button
            type="button"
            onClick={() => onMetricChange('production')}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
              selectedMetric === 'production'
                ? 'bg-[#134e35] text-[#4ade80] shadow-sm'
                : 'text-[#64746b] hover:text-[#134e35]'
            }`}
          >
            Production (t)
          </button>
        </div>
      </div>

      {/* Hover Tooltip Overlay */}
      {hoveredInfo && (
        <div className="absolute top-16 left-4 z-30 pointer-events-none rounded-xl p-2.5 text-xs text-white shadow-xl bg-[#141c17]/95 backdrop-blur-md border border-white/15 animate-in fade-in">
          <div className="font-bold flex items-center justify-between gap-3 text-sm">
            <span>{hoveredInfo.name}</span>
            <span className="text-[10px] text-[#86efac] font-medium">{hoveredInfo.division}</span>
          </div>
          <div className="mt-1 space-y-0.5 text-[11px] text-white/90">
            <div>
              Predicted Yield:{' '}
              <span className="font-bold text-[#4ade80]">{hoveredInfo.yieldVal.toFixed(2)} t/ha</span>
            </div>
            <div>
              Est. Production:{' '}
              <span className="font-bold">{formatNumber(Math.round(hoveredInfo.productionVal))} tonnes</span>
            </div>
            {hoveredInfo.areaVal > 0 ? (
              <div className="text-white/70">
                BBS Recorded Area: {formatNumber(Math.round(hoveredInfo.areaVal))} ha
              </div>
            ) : (
              <div className="text-amber-300 font-semibold">Zero BBS reported area</div>
            )}
          </div>
        </div>
      )}

      {/* Floating Dark Forecast Card (Option A Component) */}
      {showFloatingCard && (
        <FloatingMapCard
          district={selectedDistrict}
          crop={crop}
          season={season}
          forecast={forecast}
          userAreaHa={userAreaHa}
          onUserAreaChange={onUserAreaChange}
          onClose={() => setShowFloatingCard(false)}
          locale={locale}
        />
      )}

      {/* Reopen Floating Card Button if Closed */}
      {!showFloatingCard && (
        <button
          type="button"
          onClick={() => setShowFloatingCard(true)}
          className="absolute top-16 right-4 z-10 px-3.5 py-1.5 rounded-full bg-[#134e35] text-[#4ade80] text-xs font-semibold shadow-lg hover:scale-105 transition-all flex items-center gap-1.5"
        >
          <Eye size={13} />
          Show Forecast Card
        </button>
      )}

      {/* Bottom Left Legend (Distinct Official EXP_38 Palette) */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 border border-[#e2ebe4] shadow-md pointer-events-auto text-[10px] font-medium text-[#141c17] max-w-[280px]">
        <div className="font-bold text-[11px] mb-1.5 flex items-center justify-between">
          <span>{selectedMetric === 'yield' ? 'Predicted Yield (t/ha)' : 'Estimated Production (tonnes)'}</span>
          <span className="text-[10px] text-[#15803d] font-semibold">{crop}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex-1 flex flex-col items-center">
            <span className="w-full h-3 rounded-sm" style={{ backgroundColor: CHOROPLETH_PALETTE.low }} />
            <span className="mt-1 text-[9px] text-[#64746b]">&lt;{selectedMetric === 'yield' ? legendThresholds[0].toFixed(1) : formatNumber(Math.round(legendThresholds[0]))}</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="w-full h-3 rounded-sm" style={{ backgroundColor: CHOROPLETH_PALETTE.lowerMiddle }} />
            <span className="mt-1 text-[9px] text-[#64746b]">{selectedMetric === 'yield' ? legendThresholds[1].toFixed(1) : formatNumber(Math.round(legendThresholds[1]))}</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="w-full h-3 rounded-sm" style={{ backgroundColor: CHOROPLETH_PALETTE.medium }} />
            <span className="mt-1 text-[9px] text-[#64746b]">{selectedMetric === 'yield' ? legendThresholds[2].toFixed(1) : formatNumber(Math.round(legendThresholds[2]))}</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="w-full h-3 rounded-sm" style={{ backgroundColor: CHOROPLETH_PALETTE.upperMiddle }} />
            <span className="mt-1 text-[9px] text-[#64746b]">{selectedMetric === 'yield' ? legendThresholds[3].toFixed(1) : formatNumber(Math.round(legendThresholds[3]))}</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="w-full h-3 rounded-sm" style={{ backgroundColor: CHOROPLETH_PALETTE.high }} />
            <span className="mt-1 text-[9px] text-[#64746b]">High</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-1 border-t border-[#edf2ee] text-[9px] text-[#64746b]">
          <span className="inline-block w-3 h-1.5 rounded-full" style={{ backgroundColor: CHOROPLETH_PALETTE.selectedBorder }} />
          <span>Orange boundary = Selected district</span>
        </div>
      </div>

      {/* Right Edge Vertical Pill Map Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center bg-white/95 backdrop-blur-md rounded-xl p-1 shadow-md border border-[#e2ebe4] gap-0.5 text-[#374151] pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector('.floating-app-shell');
            if (!document.fullscreenElement) {
              el?.requestFullscreen?.();
            } else {
              document.exitFullscreen?.();
            }
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f1f5f2] transition-colors"
          title="Toggle Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
        <div className="w-5 h-[1px] bg-[#e5e7eb]" />
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f1f5f2] transition-colors font-bold text-sm"
          title="Zoom In"
        >
          <Plus size={14} />
        </button>
        <div className="w-5 h-[1px] bg-[#e5e7eb]" />
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f1f5f2] transition-colors font-bold text-sm"
          title="Zoom Out"
        >
          <Minus size={14} />
        </button>
        <div className="w-5 h-[1px] bg-[#e5e7eb]" />
        <button
          type="button"
          onClick={handleReset}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f1f5f2] transition-colors"
          title="Reset to Bangladesh National View"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}
