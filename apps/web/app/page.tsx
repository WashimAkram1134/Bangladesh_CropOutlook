'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { DISTRICTS } from '@/lib/districts';
import { getPlanningSeasons as getLocalPlanningSeasons } from '@/lib/season';
import type { District } from '@/lib/types';
import type { SeasonItem, ForecastRecordResponse, HealthResponse } from '@/lib/api';
import { api } from '@/lib/api';
import { CenterVisualMap } from '@/components/map/CenterVisualMap';
import { BottomOutlookTable } from '@/components/dashboard/BottomOutlookTable';
import { RightAnalyticsPanel } from '@/components/dashboard/RightAnalyticsPanel';
import { Info, AlertCircle, RefreshCw, Layers } from 'lucide-react';

const NOW = new Date('2026-10-17T09:23:33+06:00');

export default function DashboardPage() {
  // Local fallback seasons while loading API
  const localSeasonInfo = useMemo(() => getLocalPlanningSeasons(NOW), []);
  const initialSeasons: SeasonItem[] = useMemo(() => {
    return localSeasonInfo.planningSeasons.map((s, idx) => ({
      planning_order: idx + 1,
      season: s.name,
      target_year_start: s.startYear,
      season_label: s.label,
      window_start: `${s.startYear}-${String(s.startMonth).padStart(2, '0')}-${String(s.startDay).padStart(2, '0')}`,
      window_end_exclusive: `${s.endYear}-${String(s.endMonth).padStart(2, '0')}-${String(s.endDay).padStart(2, '0')}`,
      crops: s.name === 'Rabi' ? ['Boro Rice', 'Potato', 'Wheat'] : s.name === 'Kharif-I' ? ['Aus Rice', 'Jute'] : ['Aman Rice'],
      is_active: idx === 0,
      rollover_active: localSeasonInfo.rolledOver && idx === 0,
    }));
  }, [localSeasonInfo]);

  // Synchronized Application State
  const [planningSeasons, setPlanningSeasons] = useState<SeasonItem[]>(initialSeasons);
  const [selectedSeason, setSelectedSeason] = useState<SeasonItem>(initialSeasons[0]);
  const [selectedDistrict, setSelectedDistrict] = useState<District>(
    DISTRICTS.find((d) => d.id === 'dinajpur') || DISTRICTS[0]
  );
  // Default to first crop of active season (Boro Rice for Rabi)
  const [selectedCrop, setSelectedCrop] = useState<string>('Boro Rice');
  const [userAreaHa, setUserAreaHa] = useState<number | null>(2.5);
  const [selectedMapMetric, setSelectedMapMetric] = useState<'yield' | 'production'>('yield');

  // Backend Data
  const [forecast, setForecast] = useState<ForecastRecordResponse | null>(null);
  const [allForecasts, setAllForecasts] = useState<ForecastRecordResponse[]>([]);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // 1. Initial Load: Seasons & Health
  useEffect(() => {
    let isCancelled = false;
    api
      .getSeasons()
      .then((seasons) => {
        if (!isCancelled && seasons.length > 0) {
          setPlanningSeasons(seasons);

          let targetSeason = seasons[0];
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const paramSeason = params.get('season');
            if (paramSeason) {
              const matched = seasons.find(
                (s) =>
                  s.season.toLowerCase() === paramSeason.toLowerCase() ||
                  s.season_label.toLowerCase().includes(paramSeason.toLowerCase())
              );
              if (matched) targetSeason = matched;
            }
          }

          setSelectedSeason(targetSeason);
          if (targetSeason.crops.length > 0 && !targetSeason.crops.includes(selectedCrop)) {
            setSelectedCrop(targetSeason.crops[0]);
          }
        }
      })
      .catch((err) => {
        console.warn('Using local season calendar rules:', err);
      });

    api
      .getHealth()
      .then((health) => {
        if (!isCancelled) setHealthData(health);
      })
      .catch((err) => {
        console.warn('Health check error:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Load All 64 Forecasts for current crop & season
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setApiError(null);

    api
      .getAllForecasts(selectedCrop, selectedSeason.season)
      .then((records) => {
        if (!isCancelled) {
          setAllForecasts(Array.isArray(records) ? records : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load all forecasts:', err);
          setApiError(err.message || 'Failed to load district forecasts');
          setAllForecasts([]);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedCrop, selectedSeason]);

  // 3. Load Single Forecast Record for selected district & crop
  useEffect(() => {
    let isCancelled = false;

    api
      .getForecast(selectedDistrict.name, selectedCrop, userAreaHa, true)
      .then((rec) => {
        if (!isCancelled) setForecast(rec);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load district forecast:', err);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedDistrict, selectedCrop, userAreaHa]);

  // Handle Season Change: filter available crops dynamically
  const handleSeasonChange = useCallback(
    (newSeason: SeasonItem) => {
      setSelectedSeason(newSeason);
      if (!newSeason.crops.includes(selectedCrop)) {
        setSelectedCrop(newSeason.crops[0] || 'Boro Rice');
      }
    },
    [selectedCrop]
  );

  return (
    <div className="w-full flex flex-col gap-3.5 select-none">
      {/* ── Guidance Banner for Planning Seasons & Dynamic Crops ──── */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-[#edf2ee] shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#134e35]" />
          <span className="font-bold text-[#141c17]">Active Planning Window:</span>
          <span className="font-semibold text-[#15803d] px-2.5 py-0.5 rounded-full bg-[#eafaf1] border border-[#c9eed7]">
            {selectedSeason.season_label} ({selectedSeason.window_start.slice(5)} to {selectedSeason.window_end_exclusive.slice(5)})
          </span>
          {selectedSeason.rollover_active && (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              70% Rollover Active
            </span>
          )}
        </div>

        {/* Season Selector Radio / Pills */}
        <div className="flex items-center gap-1 bg-[#f1f5f2] rounded-full p-0.5">
          {planningSeasons.map((s) => (
            <button
              key={s.season_label}
              type="button"
              onClick={() => handleSeasonChange(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                selectedSeason.season_label === s.season_label
                  ? 'bg-[#134e35] text-[#4ade80] shadow-sm'
                  : 'text-[#64746b] hover:text-[#134e35]'
              }`}
            >
              {s.season}
            </button>
          ))}
        </div>

        {/* Dynamic Crop Selector Filter for the active season */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#64746b] font-semibold">Crop:</span>
          <div className="flex items-center gap-1 bg-[#f8faf8] border border-[#e5ebe6] rounded-full p-0.5">
            {selectedSeason.crops.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCrop(c)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                  selectedCrop === c
                    ? 'bg-[#15803d] text-white shadow-xs'
                    : 'text-[#64746b] hover:text-[#141c17]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Long-range Forecast Guidance Tip */}
        {selectedSeason.planning_order > 1 && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#854d0e] bg-[#fefce8] px-2.5 py-1 rounded-md border border-[#fef08a]">
            <Info size={12} className="shrink-0" />
            <span>Long-range horizon: please recheck approx. 2 weeks prior to season onset.</span>
          </div>
        )}
      </div>

      {/* API Health Alert Banner if snapshot needs update */}
      {healthData && healthData.refresh_required && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-xl px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <span>
              <strong>Forecast Snapshot Status:</strong> Stored models are from snapshot date {healthData.forecast_planning_date}. A seasonal refresh is recommended.
            </span>
          </div>
        </div>
      )}

      {/* Main Option A Grid Blueprint Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px] gap-3.5 items-start">
        {/* ── Center Column: GIS Map (Top) + Analytical Table (Bottom) ───── */}
        <div className="flex flex-col gap-3.5 min-w-0">
          {/* Large Center Visual: Bangladesh MapLibre GIS Map with Floating Dark Card */}
          <CenterVisualMap
            districts={DISTRICTS}
            selectedDistrict={selectedDistrict}
            onDistrictSelect={setSelectedDistrict}
            crop={selectedCrop}
            season={selectedSeason}
            forecast={forecast}
            allForecasts={allForecasts ?? []}
            selectedMetric={selectedMapMetric}
            onMetricChange={setSelectedMapMetric}
            userAreaHa={userAreaHa}
            onUserAreaChange={setUserAreaHa}
          />

          {/* Bottom Analytical Table: District Forecast Overview (All 64 Verified Districts) */}
          <BottomOutlookTable
            districts={DISTRICTS}
            selectedDistrict={selectedDistrict}
            onDistrictSelect={setSelectedDistrict}
            crop={selectedCrop}
            season={selectedSeason}
            allForecasts={allForecasts ?? []}
            userAreaHa={userAreaHa}
            onUserAreaChange={setUserAreaHa}
          />
        </div>

        {/* ── Right Column: Stacked Analytics Panels ─────────────── */}
        <div className="w-full">
          <RightAnalyticsPanel
            districts={DISTRICTS}
            selectedDistrict={selectedDistrict}
            onDistrictSelect={setSelectedDistrict}
            crop={selectedCrop}
            onCropSelect={setSelectedCrop}
            season={selectedSeason}
            planningSeasons={planningSeasons}
            onSeasonSelect={handleSeasonChange}
          />
        </div>
      </div>
    </div>
  );
}
