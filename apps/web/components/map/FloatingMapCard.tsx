'use client';

import { useState, useMemo } from 'react';
import { X, AlertTriangle, Calculator, Clock, ChevronDown, ChevronUp, ShieldCheck, Info } from 'lucide-react';
import { ArcGauge } from '@/components/dashboard/ArcGauge';
import type { District } from '@/lib/types';
import type { SeasonItem, ForecastRecordResponse } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface FloatingMapCardProps {
  district: District;
  crop: string;
  season: SeasonItem;
  forecast?: ForecastRecordResponse | null;
  userAreaHa: number | null;
  onUserAreaChange: (val: number | null) => void;
  onClose?: () => void;
  locale?: 'en' | 'bn';
}

function calculateRecheckDate(windowStartStr?: string): string {
  if (!windowStartStr) return '2 weeks prior to onset';
  try {
    const parts = windowStartStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const start = new Date(year, month, day);
      // Subtract 14 days (2 weeks before season onset)
      const recheck = new Date(start.getTime() - 14 * 86400000);
      return recheck.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  } catch {
    // fallback
  }
  return '2 weeks prior to onset';
}

export function FloatingMapCard({
  district,
  crop,
  season,
  forecast,
  userAreaHa,
  onUserAreaChange,
  onClose,
  locale = 'en',
}: FloatingMapCardProps) {
  const [areaInput, setAreaInput] = useState<string>(
    userAreaHa !== null && userAreaHa !== undefined ? String(userAreaHa) : '2.5'
  );
  const [areaError, setAreaError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Real verified values from EXP_36 API
  const predictedYield = forecast?.predicted_yield_t_ha ?? 0;
  // Maximum crop yield scale for arc gauge
  const maxYieldScale = crop === 'Potato' ? 30.0 : crop === 'Boro Rice' ? 6.0 : 5.0;
  const yieldPct = Math.min(100, Math.max(5, Math.round((predictedYield / maxYieldScale) * 100)));

  const recordedArea = forecast?.assumed_district_area_ha ?? 0;
  const districtProduction = forecast?.estimated_district_production_tonnes ?? 0;
  const leadMonths = forecast?.max_sarima_lead_months ?? 7;

  // Handle user area input validation
  const handleAreaChange = (valStr: string) => {
    setAreaInput(valStr);
    if (!valStr.trim()) {
      setAreaError(null);
      onUserAreaChange(null);
      return;
    }
    const num = parseFloat(valStr);
    if (isNaN(num) || num < 0) {
      setAreaError('Area >= 0');
      return;
    }
    setAreaError(null);
    onUserAreaChange(num);
  };

  const parsedUserArea = userAreaHa ?? (parseFloat(areaInput) > 0 ? parseFloat(areaInput) : null);
  const userProductionTonnes =
    parsedUserArea !== null && !isNaN(parsedUserArea)
      ? Number((predictedYield * parsedUserArea).toFixed(2))
      : null;

  // Planning season classification (1 = current active, 2 = next planning, 3 = third planning)
  const planningOrder = season.planning_order ?? 1;
  const recheckDate = useMemo(() => calculateRecheckDate(season.window_start), [season.window_start]);

  return (
    <div
      className="absolute top-3.5 right-3.5 z-20 w-[275px] sm:w-[285px] rounded-[20px] p-3 text-white shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 pointer-events-auto"
      style={{
        background: 'rgba(16, 24, 19, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* ── 1. Compact Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between pb-0.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h3
              className="text-sm font-bold tracking-tight leading-tight text-white"
              style={{ color: '#ffffff' }}
            >
              {locale === 'bn' ? district.nameBn : district.name} District
            </h3>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-[#86efac] font-semibold">
              {district.division}
            </span>
          </div>
          <p className="text-[10px] text-[#94a39b] font-medium">
            {crop} • {season.season_label}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[#94a39b] hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close card"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── 2. Compact Yield Semicircular Gauge ───────────────────────── */}
      <div className="my-0.5 flex justify-center">
        <ArcGauge
          score={yieldPct}
          valueText={`${predictedYield.toFixed(2)}`}
          unitText="t/ha"
          labelText={locale === 'bn' ? 'পূর্বাভাস ফলন' : 'Predicted Yield'}
          size={140}
        />
      </div>

      {/* ── 3. Compact 3-Column Metrics ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1 py-1.5 my-0.5 border-t border-b border-white/10 text-center text-xs">
        <div>
          <div className="font-bold text-white text-[11px] truncate">
            {recordedArea === 0
              ? '0 ha'
              : recordedArea >= 1000
              ? `${(recordedArea / 1000).toFixed(1)}k`
              : recordedArea}
          </div>
          <div className="text-[9px] text-[#94a39b] leading-tight mt-0.5">
            {recordedArea === 0 ? 'Zero BBS Area' : 'Recorded Area'}
          </div>
        </div>

        <div className="border-x border-white/10 px-0.5">
          <div className="font-bold text-white text-[11px] truncate">
            {districtProduction >= 1000
              ? `${(districtProduction / 1000).toFixed(1)}k t`
              : `${Math.round(districtProduction)} t`}
          </div>
          <div className="text-[9px] text-[#94a39b] leading-tight mt-0.5">
            District Prod.
          </div>
        </div>

        <div>
          <div className="font-bold text-[#4ade80] text-[11px]">
            {leadMonths}m
          </div>
          <div className="text-[9px] text-[#94a39b] leading-tight mt-0.5">
            SARIMA Lead
          </div>
        </div>
      </div>

      {/* ── 4. Farmer Area Calculator ─────────────────────────────────── */}
      <div className="pt-1 pb-1.5 border-b border-white/10">
        <div className="flex items-center justify-between text-[10px] font-semibold text-[#86efac] mb-1">
          <span className="flex items-center gap-1">
            <Calculator size={11} />
            Field Calculator:
          </span>
          {userProductionTonnes !== null ? (
            <span className="text-white font-bold">
              {formatNumber(userProductionTonnes)} t
            </span>
          ) : (
            <span className="text-white/40 font-normal">—</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 flex items-center bg-white/10 border border-white/20 rounded-md px-1.5 py-0.5">
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="ha"
              value={areaInput}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="w-full bg-transparent text-white placeholder-white/30 text-[11px] outline-none"
            />
            <span className="text-[9px] text-white/50 ml-1">ha</span>
          </div>
          <button
            type="button"
            onClick={() => handleAreaChange('2.5')}
            className="shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
          >
            2.5 ha
          </button>
        </div>
        {areaError && (
          <p className="text-[9px] text-red-400 mt-0.5">{areaError}</p>
        )}
      </div>

      {/* ── 5. Season-Aware Warnings (ONLY FOR UPCOMING SEASONS) ─────── */}
      {planningOrder === 2 && (
        <div className="mt-1.5 px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-200 flex items-center gap-1.5">
          <Clock size={12} className="shrink-0 text-amber-400" />
          <span className="leading-tight">
            <strong>Advance forecast:</strong> recheck ~{recheckDate} (2 weeks before season onset).
          </span>
        </div>
      )}

      {planningOrder === 3 && (
        <div className="mt-1.5 px-2 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/35 text-[10px] text-amber-200 flex items-center gap-1.5">
          <AlertTriangle size={12} className="shrink-0 text-amber-400" />
          <span className="leading-tight">
            <strong>Long-range outlook:</strong> conditions may change. Recheck ~{recheckDate}.
          </span>
        </div>
      )}

      {/* Zero BBS area indicator (Clean, non-disruptive) */}
      {recordedArea === 0 && (
        <div className="mt-1 px-1.5 py-0.5 text-[9px] text-amber-300/90 flex items-center gap-1">
          <Info size={10} className="shrink-0 text-amber-400" />
          <span>Yield is conditional (zero reported BBS area).</span>
        </div>
      )}

      {/* ── 6. Compact Footer & Expandable "Forecast Details" ─────────── */}
      <div className="pt-1.5 text-[9px] flex items-center justify-between text-[#94a39b]">
        <span className="flex items-center gap-1 text-white/70">
          <ShieldCheck size={11} className="text-[#4ade80]" />
          EXP_36 • Sep 2026
        </span>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-0.5 text-[#86efac] hover:text-white transition-colors cursor-pointer"
        >
          <span>Details</span>
          {showDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Expandable Forecast Details Drawer */}
      {showDetails && (
        <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[9px] text-white/80 space-y-1 animate-in fade-in">
          <div className="flex justify-between">
            <span className="text-[#94a39b]">Model:</span>
            <span>Random Forest (RF) + SARIMA</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94a39b]">Horizon:</span>
            <span>{leadMonths} months lead</span>
          </div>
          {forecast?.warnings && forecast.warnings.length > 0 && (
            <div className="pt-0.5 text-[#fde047] space-y-0.5">
              {forecast.warnings.map((w, i) => (
                <p key={i}>• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
