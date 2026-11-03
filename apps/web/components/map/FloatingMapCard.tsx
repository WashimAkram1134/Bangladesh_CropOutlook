'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  X,
  AlertTriangle,
  Calculator,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Info,
  Sparkles,
  Database,
  ExternalLink,
} from 'lucide-react';
import { ArcGauge } from '@/components/dashboard/ArcGauge';
import type { District } from '@/lib/types';
import type { SeasonItem, ForecastRecordResponse } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { getSeasonItemAdvisory } from '@/lib/forecastAdvisory';
import {
  LAND_UNITS,
  type LandUnitKey,
  convertToHectares,
  convertFromHectares,
  formatUnitValue,
} from '@/lib/landUnits';

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
  const [unit, setUnit] = useState<LandUnitKey>('hectare');
  const [areaInput, setAreaInput] = useState<string>(
    userAreaHa !== null && userAreaHa !== undefined ? String(userAreaHa) : '2.5'
  );
  const [areaError, setAreaError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('details') === 'true';
    }
    return false;
  });
  const [showDataBehind, setShowDataBehind] = useState<boolean>(false);

  // Real verified values from EXP_36 API
  const predictedYield = forecast?.predicted_yield_t_ha ?? 0;
  // Maximum crop yield scale for arc gauge
  const maxYieldScale = crop === 'Potato' ? 30.0 : crop === 'Boro Rice' ? 6.0 : 5.0;
  const yieldPct = Math.min(100, Math.max(5, Math.round((predictedYield / maxYieldScale) * 100)));

  const recordedArea = forecast?.assumed_district_area_ha ?? 0;
  const districtProduction = forecast?.estimated_district_production_tonnes ?? 0;

  // Verified crop-specific historical test error (MAE)
  const defaultMae =
    crop === 'Potato'
      ? 1.38
      : crop === 'Wheat'
      ? 0.29
      : crop === 'Boro Rice'
      ? 0.21
      : crop === 'Aus Rice'
      ? 0.17
      : 0.14;
  const historicalMae = forecast?.crop_historical_mae_t_ha ?? defaultMae;

  // Handle user area input validation
  const handleAreaChange = (valStr: string) => {
    setAreaInput(valStr);
    if (!valStr.trim()) {
      setAreaError(null);
      onUserAreaChange(null);
      return;
    }
    const num = parseFloat(valStr);
    if (isNaN(num) || num <= 0) {
      setAreaError('Area > 0');
      onUserAreaChange(null);
      return;
    }
    setAreaError(null);
    const ha = convertToHectares(num, unit);
    onUserAreaChange(ha);
  };

  const handleUnitChange = (newUnit: LandUnitKey) => {
    setUnit(newUnit);
    if (!areaInput.trim()) return;
    const num = parseFloat(areaInput);
    if (isNaN(num) || num <= 0) return;
    const currentHa = userAreaHa ?? convertToHectares(num, unit);
    const converted = convertFromHectares(currentHa, newUnit);
    setAreaInput(formatUnitValue(converted));
    onUserAreaChange(currentHa);
  };

  const parsedUserArea =
    userAreaHa ??
    (parseFloat(areaInput) > 0 ? convertToHectares(parseFloat(areaInput), unit) : null);
  const userProductionTonnes =
    parsedUserArea !== null && !isNaN(parsedUserArea) && parsedUserArea > 0
      ? Number((predictedYield * parsedUserArea).toFixed(2))
      : null;

  // Planning season classification (1 = current active, 2 = next planning, 3 = third planning)
  const planningOrder = season.planning_order ?? 1;
  const cardAdvisory = useMemo(() => getSeasonItemAdvisory(season), [season]);

  // Dynamic, data-grounded explanation sentences
  const explanationSentences = useMemo(() => {
    if (forecast?.explanation?.sentences && forecast.explanation.sentences.length > 0) {
      return forecast.explanation.sentences;
    }
    return [
      `This estimate considers ${district.name}'s previous ${crop} yields, local weather patterns, and terrain characteristics.`,
      `The forecast incorporates expected seasonal rainfall, temperature, vegetation conditions, and soil moisture for ${season.season_label}.`,
      'Actual harvest results may differ as in-season weather and farm management practices change.',
    ];
  }, [forecast?.explanation, district.name, crop, season.season_label]);

  const explanationFactors = forecast?.explanation;

  return (
    <div
      className="absolute top-3.5 right-3.5 z-20 w-[275px] sm:w-[290px] rounded-[20px] p-3 text-white shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 pointer-events-auto"
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
            className="w-5 h-5 rounded-full flex items-center justify-center text-[#94a39b] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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

      {/* ── 3. Compact 3-Column Metrics (Prediction Error Integration) ── */}
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

        <div
          className="cursor-help"
          title={
            forecast?.prediction_error_tooltip ||
            (historicalMae
              ? `This is an estimate, so the actual harvest may be higher or lower. In past tests, predictions differed from actual yields by about ${historicalMae.toFixed(2)} tonnes per hectare on average.`
              : 'Historical error not available.')
          }
        >
          <div className="font-bold text-[#4ade80] text-[11px] truncate">
            {historicalMae ? `≈${historicalMae.toFixed(2)} t/ha` : 'N/A'}
          </div>
          <div className="text-[9px] text-[#94a39b] leading-tight mt-0.5 flex items-center justify-center gap-0.5">
            <span>Typical Yield Diff</span>
            <Info size={8} className="text-[#94a39b]" />
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
              step="any"
              placeholder="Area"
              value={areaInput}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="w-full bg-transparent text-white placeholder-white/30 text-[11px] outline-none"
            />
          </div>
          <select
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value as LandUnitKey)}
            className="shrink-0 text-[10px] font-semibold px-1 py-1 rounded bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors cursor-pointer outline-none max-w-[130px]"
            title="Select land measurement unit"
          >
            {LAND_UNITS.map((u) => (
              <option key={u.key} value={u.key} className="bg-[#101813] text-white">
                {u.label}
              </option>
            ))}
          </select>
        </div>
        {areaError && (
          <p className="text-[9px] text-red-400 mt-0.5">{areaError}</p>
        )}
      </div>

      {/* ── 5. Friendly Season Advisories (EXP_38) ─────── */}
      {!cardAdvisory.isSeasonStarted && (
        <div className="mt-1.5 px-2 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[10px] text-emerald-200 flex items-center gap-1.5">
          <Clock size={12} className="shrink-0 text-[#4ade80]" />
          <span className="leading-tight">
            {cardAdvisory.message}
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

      {/* ── 6. Compact Footer & "Details" Action ──────────────────────── */}
      <div className="pt-1.5 text-[9px] flex items-center justify-between text-[#94a39b]">
        <span className="flex items-center gap-1 text-white/70">
          <ShieldCheck size={11} className="text-[#4ade80]" />
          Verified Forecast
        </span>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-[#86efac] hover:text-white transition-colors cursor-pointer font-medium px-1.5 py-0.5 rounded hover:bg-white/10"
        >
          <span>Details</span>
          {showDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Expandable "About Your Forecast" Compact Drawer */}
      {showDetails && (
        <div className="mt-1.5 pt-2 border-t border-white/10 text-[9px] text-white/85 space-y-2 animate-in fade-in max-h-[280px] overflow-y-auto custom-scrollbar pr-0.5">
          <div className="flex items-center justify-between pb-1 border-b border-white/10">
            <span className="font-bold text-white text-[10.5px] flex items-center gap-1">
              <Sparkles size={11} className="text-[#4ade80]" />
              About Your Forecast
            </span>
            <span className="text-[8px] text-[#86efac] uppercase tracking-wider font-semibold">
              Guidance
            </span>
          </div>

          {/* 1. Why this forecast was estimated */}
          <div className="space-y-1 text-[9px] text-white/90 leading-relaxed">
            <p className="font-semibold text-white/95">Why was this estimated?</p>
            {explanationSentences.map((sentence, idx) => (
              <p key={idx} className="text-[#cbd5e1]">{sentence}</p>
            ))}
          </div>

          {/* 2. Historical context and relevant environmental conditions */}
          <div className="p-2 rounded-lg bg-black/40 border border-white/10 space-y-1 text-[8.5px] text-white/80">
            <div className="font-semibold text-white text-[9px] mb-1">Historical & Environmental Context</div>
            <div className="flex justify-between">
              <span className="text-[#94a39b]">Estimated Yield:</span>
              <span className="font-bold text-white">{predictedYield.toFixed(2)} t/ha</span>
            </div>
            {explanationFactors?.recent_avg_yield && (
              <div className="flex justify-between">
                <span className="text-[#94a39b]">Recent 3-Yr BBS Avg:</span>
                <span>{explanationFactors.recent_avg_yield.toFixed(2)} t/ha</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#94a39b]">Typical Yield Difference:</span>
              <span className="text-[#86efac]">≈{historicalMae.toFixed(2)} t/ha</span>
            </div>
            {explanationFactors?.forecast_rain && (
              <div className="flex justify-between">
                <span className="text-[#94a39b]">Expected Seasonal Rain:</span>
                <span>~{Math.round(explanationFactors.forecast_rain)} mm</span>
              </div>
            )}
            {explanationFactors?.forecast_temp && (
              <div className="flex justify-between">
                <span className="text-[#94a39b]">Expected Seasonal Temp:</span>
                <span>~{explanationFactors.forecast_temp.toFixed(1)}°C</span>
              </div>
            )}
            {explanationFactors?.soil_ph && (
              <div className="flex justify-between">
                <span className="text-[#94a39b]">Soil pH & Elevation:</span>
                <span>{explanationFactors.soil_ph} pH • {explanationFactors.elevation ? Math.round(explanationFactors.elevation) : '—'}m</span>
              </div>
            )}
          </div>

          {/* 3. Meaning of the typical yield difference */}
          <div className="p-2 rounded-lg bg-white/5 border border-white/10 space-y-1 text-[8.5px] leading-relaxed text-[#cbd5e1]">
            <p className="font-semibold text-white">Meaning of Typical Yield Difference</p>
            <p>
              This is an estimate, so your actual harvest may be higher or lower. In past tests, predictions differed from actual harvest yields by about <strong>≈{historicalMae.toFixed(2)} tonnes per hectare</strong> on average.
            </p>
            <p className="text-[8px] text-[#94a39b]">
              This indicates average historical difference, not a guaranteed yield range.
            </p>
          </div>

          {/* 4. Practical seasonal advice on when to recheck (EXP_38) */}
          <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[8.5px] text-emerald-200 leading-relaxed">
            <p className="font-semibold text-white mb-0.5">When to recheck:</p>
            <p>{cardAdvisory.message}</p>
          </div>

          {/* 5. Direct Link to Data & Methodology */}
          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[8px] text-[#94a39b]">Scientific documentation</span>
            <Link
              href="/methodology"
              className="inline-flex items-center gap-1 text-[#86efac] hover:text-[#4ade80] font-semibold text-[9px] transition-colors"
            >
              <span>Explore Data & Methodology</span>
              <ExternalLink size={9} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
