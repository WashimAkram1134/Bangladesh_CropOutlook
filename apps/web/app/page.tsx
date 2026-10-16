'use client';

import { useState, useCallback } from 'react';
import { getPlanningSeasons, getCropsForSeason } from '@/lib/season';
import type { Season, SeasonName, CropName } from '@/lib/season';
import { getDistrictById } from '@/lib/districts';
import { SeasonSelector } from '@/components/dashboard/SeasonSelector';
import { DistrictSelector } from '@/components/dashboard/DistrictSelector';
import { CropSelector } from '@/components/dashboard/CropSelector';
import { ForecastMetricCard, AreaCalculatorCard } from '@/components/dashboard/ForecastCards';
import { EnvPanelGrid } from '@/components/dashboard/EnvPanels';
import { MapComponent } from '@/components/map/MapComponent';
import { AlertTriangle, Info, RefreshCw, Layers, BarChart2 } from 'lucide-react';

const NOW = new Date('2026-10-16T16:15:51+06:00'); // use current time from metadata

export default function DashboardPage() {
  const { planningSeasons, currentSeason, rolledOver } = getPlanningSeasons(NOW);

  const [selectedSeason, setSelectedSeason] = useState<Season>(planningSeasons[0]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<CropName | null>(null);

  // When season changes, reset crop if not valid for new season
  const handleSeasonChange = useCallback((season: Season) => {
    setSelectedSeason(season);
    const validCrops = getCropsForSeason(season.name as SeasonName);
    if (selectedCrop && !validCrops.includes(selectedCrop)) {
      setSelectedCrop(null);
    }
  }, [selectedCrop]);

  const district = selectedDistrictId ? getDistrictById(selectedDistrictId) : null;
  const hasFullSelection = selectedDistrictId && selectedCrop;

  return (
    <div className="page-container py-6">
      {/* ── Page header ── */}
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-neutral-900)' }}>
              Agricultural Forecast Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              District-level crop yield and production forecasts · EXP_36 model release
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-amber">
              <AlertTriangle size={10} />
              Development Mode
            </span>
            <span className="badge badge-gray">Phase 1</span>
          </div>
        </div>
      </div>

      {/* ── Dev state notice ── */}
      <div className="alert-dev-state mb-5 flex items-start gap-2">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">EXP_36 model data not yet connected.</span>{' '}
          This is the Phase 1 frontend scaffold. Forecast values will populate once the FastAPI
          backend (Phase 2) is integrated. All selectors, season logic and layout are fully functional.
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* ── Left sidebar: selectors ── */}
        <div className="flex flex-col gap-5">
          {/* Season selector */}
          <div
            className="card p-5"
            style={{ background: 'var(--color-surface)' }}
          >
            <SeasonSelector
              seasons={planningSeasons}
              selectedSeason={selectedSeason}
              onSeasonChange={handleSeasonChange}
              rolledOver={rolledOver}
              currentSeason={currentSeason}
            />
          </div>

          {/* District selector */}
          <div className="card p-5">
            <DistrictSelector
              selectedDistrictId={selectedDistrictId}
              onDistrictChange={setSelectedDistrictId}
            />
            {district && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--color-neutral-700)' }}>
                    {district.name}
                  </span>{' '}
                  · {district.division} Division · {district.areaKm2.toLocaleString()} km²
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {district.nameBn}
                </p>
              </div>
            )}
          </div>

          {/* Crop selector */}
          <div className="card p-5">
            <CropSelector
              seasonName={selectedSeason.name as SeasonName}
              selectedCrop={selectedCrop}
              onCropChange={setSelectedCrop}
            />
          </div>

          {/* Data freshness / context */}
          <div
            className="card p-4 flex flex-col gap-2"
            style={{ background: 'var(--color-primary-50)', borderColor: 'var(--color-primary-100)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--color-primary-700)' }}>
              Forecast Context
            </p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--color-primary-800)' }}>
              <li>· Model release: <strong>EXP_36</strong> (not yet loaded)</li>
              <li>· Districts: 64 · Crops: 6 · Seasons: 3</li>
              <li>· Total forecasts: 384</li>
              <li>
                · Current season:{' '}
                <strong>{currentSeason?.label ?? 'Unknown'}</strong>
              </li>
              {rolledOver && (
                <li style={{ color: 'var(--color-primary-700)' }}>
                  · 70% elapsed — planning season rolled over
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* ── Right content ── */}
        <div className="flex flex-col gap-5">
          {/* Metric cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <ForecastMetricCard
              id="card-predicted-yield"
              title="Predicted Yield"
              value={hasFullSelection ? null : null}
              unit="tonnes / hectare"
              decimals={3}
              source="NOT_AVAILABLE"
              icon={<BarChart2 size={14} />}
              subtitle={
                hasFullSelection
                  ? `${selectedCrop} · ${selectedSeason.name} ${selectedSeason.startYear}`
                  : undefined
              }
            />
            <ForecastMetricCard
              id="card-estimated-production"
              title="Estimated Production"
              value={hasFullSelection ? null : null}
              unit="tonnes"
              decimals={0}
              source="NOT_AVAILABLE"
              subtitle="Based on recorded BBS area"
            />
            <ForecastMetricCard
              id="card-recorded-area"
              title="Latest Recorded Area"
              value={null}
              unit="hectares (BBS)"
              decimals={0}
              source="NOT_AVAILABLE"
              subtitle="Last recorded season crop area"
            />
          </div>

          {/* Area calculator */}
          <AreaCalculatorCard
            recordedAreaHa={null}
            yieldTHa={null}
          />

          {/* GIS map */}
          <div className="card overflow-hidden" style={{ height: 420, padding: 0 }}>
            <MapComponent
              selectedDistrictId={selectedDistrictId}
              onDistrictClick={setSelectedDistrictId}
            />
          </div>

          {/* Environmental indicators */}
          <EnvPanelGrid districtId={selectedDistrictId} />
        </div>
      </div>
    </div>
  );
}
