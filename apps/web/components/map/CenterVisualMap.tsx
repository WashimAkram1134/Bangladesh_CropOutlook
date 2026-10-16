'use client';

import { useState, useMemo } from 'react';
import { Maximize2, Plus, Minus, Compass, Download, MoreHorizontal, Layers } from 'lucide-react';
import { FloatingMapCard } from './FloatingMapCard';
import type { District, CropName, ForecastRecord } from '@/lib/types';
import type { Season } from '@/lib/season';
import districtSvgData from '@/lib/districtSvgPaths.json';

interface CenterVisualMapProps {
  districts: District[];
  selectedDistrict: District;
  onDistrictSelect: (district: District) => void;
  crop: CropName;
  season: Season;
  forecast?: ForecastRecord | null;
  locale?: 'en' | 'bn';
}

interface SvgDistrictItem {
  id: string;
  name: string;
  division: string;
  d: string;
}

export function CenterVisualMap({
  districts,
  selectedDistrict,
  onDistrictSelect,
  crop,
  season,
  forecast,
  locale = 'en',
}: CenterVisualMapProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'drone' | 'gis'>('drone');
  const [hoveredDistrict, setHoveredDistrict] = useState<District | null>(null);
  const [showFloatingCard, setShowFloatingCard] = useState(true);

  const districtPaths = districtSvgData as Record<string, SvgDistrictItem>;

  // Choropleth division colors
  const divisionColors: Record<string, string> = {
    Rangpur: '#15803d',
    Rajshahi: '#16a34a',
    Khulna: '#22c55e',
    Dhaka: '#047857',
    Mymensingh: '#34d399',
    Chittagong: '#10b981',
    Sylhet: '#059669',
    Barisal: '#22c55e',
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(2, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.8, Number((z - 0.15).toFixed(2))));
  const handleReset = () => setZoomLevel(1);

  return (
    <div
      className="relative w-full h-[430px] md:h-[470px] lg:h-[500px] rounded-[22px] overflow-hidden select-none border border-[#e2ebe4] shadow-md group"
      style={{
        backgroundImage: "url('/images/agri_background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Subtle Dark Vignette / Aerial Overlay */}
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />

      {/* SVG Bangladesh 64 Districts GIS Vector Layer */}
      <div
        className="w-full h-full flex items-center justify-center p-2 transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <svg
          viewBox="0 0 600 700"
          className="w-full h-full max-h-[96%] drop-shadow-xl"
        >
          <defs>
            <filter id="hotspotGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f97316" floodOpacity="0.75" />
            </filter>
            <radialGradient id="selectedDistrictHeat" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ea580c" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#f97316" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0.3" />
            </radialGradient>
          </defs>

          {/* District Polygons */}
          {Object.entries(districtPaths).map(([dId, item]) => {
            const isSelected = selectedDistrict.id === dId || selectedDistrict.name.toLowerCase() === item.name.toLowerCase();
            const isHovered = hoveredDistrict?.id === dId;
            const divColor = divisionColors[item.division] || '#16a34a';

            return (
              <g key={dId} className="cursor-pointer">
                {/* District Fill */}
                <path
                  d={item.d}
                  fill={
                    isSelected
                      ? 'url(#selectedDistrictHeat)'
                      : isHovered
                      ? '#4ade80'
                      : viewMode === 'gis'
                      ? divColor
                      : 'rgba(21, 83, 56, 0.45)'
                  }
                  fillOpacity={isSelected ? 0.9 : isHovered ? 0.75 : 0.4}
                  stroke={isSelected ? '#ffffff' : isHovered ? '#ffffff' : '#134e35'}
                  strokeWidth={isSelected ? 2.8 : isHovered ? 1.8 : 0.8}
                  strokeDasharray={isSelected ? '5 3' : undefined}
                  filter={isSelected ? 'url(#hotspotGlow)' : undefined}
                  className="transition-all duration-200"
                  onMouseEnter={() => {
                    const match = districts.find(
                      (d) => d.id === dId || d.name.toLowerCase() === item.name.toLowerCase()
                    );
                    if (match) setHoveredDistrict(match);
                  }}
                  onMouseLeave={() => setHoveredDistrict(null)}
                  onClick={() => {
                    const match = districts.find(
                      (d) => d.id === dId || d.name.toLowerCase() === item.name.toLowerCase()
                    );
                    if (match) {
                      onDistrictSelect(match);
                      setShowFloatingCard(true);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Top Left Header Badge / Title */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white/60 shadow-sm flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#155338]" />
          <span className="text-xs font-semibold text-[#141c17] tracking-tight">
            {locale === 'bn' ? 'বাংলাদেশ জিআইএস পূর্বাভাস' : 'Bangladesh GIS Crop Map'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#eafaf1] text-[#15803d] font-bold">
            64 Districts
          </span>
        </div>

        {/* Hovered district tooltip indicator */}
        {hoveredDistrict && (
          <div className="px-3 py-1 rounded-full bg-[#141c17]/90 text-white text-xs font-semibold backdrop-blur-sm animate-in fade-in">
            {hoveredDistrict.name} ({hoveredDistrict.division})
          </div>
        )}
      </div>

      {/* Top Right Controls: Export & Layers */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            alert(`Exporting high-resolution agricultural report for ${selectedDistrict.name} (${season.label})...`);
          }}
          className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-[#141c17] text-xs font-semibold hover:bg-white shadow-sm border border-black/5 flex items-center gap-1.5 transition-all hover:scale-102"
        >
          <Download size={13} strokeWidth={2} />
          <span>Export</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'drone' ? 'gis' : 'drone')}
          className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md text-[#141c17] flex items-center justify-center shadow-sm border border-black/5 hover:bg-white transition-colors"
          title={`Switch view (currently ${viewMode})`}
        >
          <MoreHorizontal size={15} />
        </button>
      </div>

      {/* Floating Dark Card Overlay (Option A Reference Component) */}
      {showFloatingCard && (
        <FloatingMapCard
          district={selectedDistrict}
          crop={crop}
          season={season}
          forecast={forecast}
          onClose={() => setShowFloatingCard(false)}
          locale={locale}
        />
      )}

      {/* If floating card closed, show reopen button */}
      {!showFloatingCard && (
        <button
          type="button"
          onClick={() => setShowFloatingCard(true)}
          className="absolute top-16 right-4 z-10 px-3 py-1.5 rounded-full bg-[#134e35] text-[#4ade80] text-xs font-semibold shadow-lg hover:scale-105 transition-all"
        >
          Show District Card
        </button>
      )}

      {/* Bottom Left Inset Thumbnail Style Switcher (matching reference) */}
      <div className="absolute bottom-4 left-4 z-10">
        <div
          onClick={() => setViewMode(viewMode === 'drone' ? 'gis' : 'drone')}
          className="w-16 h-16 rounded-[14px] overflow-hidden border-2 border-white shadow-md cursor-pointer hover:scale-105 transition-transform relative group"
          title={`Click to switch to ${viewMode === 'drone' ? 'Choropleth GIS' : 'Drone Field'} mode`}
        >
          <img
            src="/images/agri_background.jpg"
            alt="Basemap Style"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/25 group-hover:bg-transparent transition-colors flex items-center justify-center">
            <Layers size={16} color="white" />
          </div>
        </div>
      </div>

      {/* Right Edge Vertical Pill Map Controls (matching reference) */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center bg-white/95 backdrop-blur-md rounded-xl p-1 shadow-md border border-black/5 gap-0.5 text-[#374151]">
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
          title="Reset Bangladesh View"
        >
          <Compass size={14} />
        </button>
      </div>
    </div>
  );
}
