'use client';

import { useState } from 'react';
import { Search, MapPin, Sun, Droplets, CloudRain, Wind, ArrowUpRight } from 'lucide-react';
import type { District, CropName } from '@/lib/types';
import type { Season } from '@/lib/season';

interface RightAnalyticsPanelProps {
  districts: District[];
  selectedDistrict: District;
  onDistrictSelect: (district: District) => void;
  crop: CropName;
  onCropSelect: (crop: CropName) => void;
  season: Season;
  onSeasonSelect?: (season: Season) => void;
  locale?: 'en' | 'bn';
}

export function RightAnalyticsPanel({
  districts,
  selectedDistrict,
  onDistrictSelect,
  crop,
  onCropSelect,
  season,
  locale = 'en',
}: RightAnalyticsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'Rabi' | 'Kharif-I' | 'Kharif-II'>('Rabi');

  // Filtered districts for search
  const filteredDistricts = searchQuery.trim()
    ? districts.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.nameBn.includes(searchQuery) ||
          d.division.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Donut chart segments matching reference image (30%, 23%, 18%, 17%, 12%)
  const cropSlices = [
    { name: 'Aman Rice', pct: 30, color: '#134e35', labelBn: 'আমন ধান' },
    { name: 'Boro Rice', pct: 23, color: '#22c55e', labelBn: 'বোরো ধান' },
    { name: 'Aus Rice', pct: 18, color: '#86efac', labelBn: 'আউশ ধান' },
    { name: 'Potato', pct: 17, color: '#f59e0b', labelBn: 'আলু' },
    { name: 'Wheat & Jute', pct: 12, color: '#ef4444', labelBn: 'গম ও পাট' },
  ];

  // SVG Donut calculation
  let cumulativeAngle = 0;
  const radius = 38;
  const strokeWidth = 14;
  const center = 50;
  const circumference = 2 * Math.PI * radius;

  // Heatmap matrix data (7 days x 6 time slots)
  // Values: 0 to 4 (intensity)
  const heatmapData = [
    [0, 0, 1, 1, 1, 0, 0], // 1 pm
    [0, 2, 4, 4, 3, 0, 0], // 2 pm
    [0, 3, 4, 4, 4, 2, 0], // 3 pm
    [0, 1, 4, 4, 4, 3, 1], // 4 pm
    [0, 1, 2, 4, 4, 2, 1], // 5 pm
    [0, 0, 1, 3, 3, 1, 0], // 6 pm
  ];

  const heatColors = [
    '#f1f5f2', // 0: empty
    '#dcfce7', // 1: light
    '#86efac', // 2: med
    '#22c55e', // 3: vibrant
    '#15803d', // 4: deep
  ];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const times = ['1 pm', '2 pm', '3 pm', '4 pm', '5 pm', '6 pm'];

  return (
    <div className="flex flex-col gap-3.5 w-full select-none">
      {/* ─── CARD 1: Search & Weather / Climate Conditions ──────────────── */}
      <div className="bg-white rounded-[20px] p-4 border border-[#edf2ee] shadow-sm relative">
        {/* Search Input Bar */}
        <div className="relative mb-3.5">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a39b]" />
          <input
            type="text"
            placeholder={locale === 'bn' ? 'জেলা অনুসন্ধান করুন...' : 'Type to search district...'}
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
        <div className="flex items-center gap-1.5 text-xs text-[#141c17] font-semibold mb-1">
          <MapPin size={14} className="text-[#134e35] shrink-0" />
          <span className="truncate">
            {locale === 'bn' ? selectedDistrict.nameBn : selectedDistrict.name},{' '}
            {selectedDistrict.division} Division, Bangladesh
          </span>
        </div>

        {/* Big Temperature & Weather Display */}
        <div className="flex items-center justify-between my-2">
          <div className="flex items-baseline">
            <span className="text-4xl font-extrabold text-[#141c17] tracking-tight">26°C</span>
          </div>

          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#141c17]">
              <Sun size={15} className="text-amber-500 fill-amber-500" />
              <span>Sunny Day</span>
            </div>
            <span className="text-[11px] text-[#94a39b] font-medium mt-0.5">
              8:45 AM | Oct 16
            </span>
          </div>
        </div>

        {/* 3 Quick Stat Sub-Boxes */}
        <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[#edf2ee]">
          <div className="flex flex-col items-center p-1.5 rounded-xl bg-[#f8faf8] border border-[#eef2ef]">
            <div className="flex items-center gap-1 text-[11px] text-[#6b7c72] font-medium">
              <Droplets size={12} className="text-blue-500" />
              <span>Humidity</span>
            </div>
            <span className="text-xs font-bold text-[#141c17] mt-0.5">35%</span>
          </div>

          <div className="flex flex-col items-center p-1.5 rounded-xl bg-[#f8faf8] border border-[#eef2ef]">
            <div className="flex items-center gap-1 text-[11px] text-[#6b7c72] font-medium">
              <CloudRain size={12} className="text-indigo-500" />
              <span>Rainfall</span>
            </div>
            <span className="text-xs font-bold text-[#141c17] mt-0.5">12 mm</span>
          </div>

          <div className="flex flex-col items-center p-1.5 rounded-xl bg-[#f8faf8] border border-[#eef2ef]">
            <div className="flex items-center gap-1 text-[11px] text-[#6b7c72] font-medium">
              <Wind size={12} className="text-emerald-600" />
              <span>Soil Moist.</span>
            </div>
            <span className="text-xs font-bold text-[#141c17] mt-0.5">68%</span>
          </div>
        </div>
      </div>

      {/* ─── CARD 2: Resource Monitoring / Crop Distribution (Donut) ─── */}
      <div className="bg-white rounded-[20px] p-4 border border-[#edf2ee] shadow-sm">
        {/* Header with Filter Tabs */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-[#141c17] tracking-tight">
            Resource Monitoring
          </h4>

          {/* Timeframe Tabs matching reference */}
          <div className="flex items-center bg-[#f1f5f2] rounded-full p-0.5">
            {(['Rabi', 'Kharif-I', 'Kharif-II'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-white text-[#134e35] shadow-sm'
                    : 'text-[#758a7e] hover:text-[#134e35]'
                }`}
              >
                {tab === 'Rabi' ? 'Rabi' : tab === 'Kharif-I' ? 'Kh-I' : 'Kh-II'}
              </button>
            ))}
          </div>
        </div>

        {/* Legend + Donut Chart side by side */}
        <div className="flex items-center justify-between pt-1">
          {/* Legend Items */}
          <div className="flex flex-col gap-1.5 text-[11px] font-medium text-[#4b5563]">
            {cropSlices.map((item) => (
              <div
                key={item.name}
                onClick={() => {
                  if (item.name.includes('Aman')) onCropSelect('Aman Rice');
                  else if (item.name.includes('Boro')) onCropSelect('Boro Rice');
                  else if (item.name.includes('Aus')) onCropSelect('Aus Rice');
                  else if (item.name.includes('Potato')) onCropSelect('Potato');
                  else onCropSelect('Wheat');
                }}
                className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                  crop.includes(item.name.split(' ')[0]) ? 'opacity-100 font-bold' : 'opacity-85 hover:opacity-100'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[#374151] truncate max-w-[110px]">
                  {locale === 'bn' ? item.labelBn : item.name}
                </span>
                <span className="text-[10px] text-[#9ca3af] font-bold ml-auto">
                  {item.pct}%
                </span>
              </div>
            ))}
          </div>

          {/* SVG Donut Chart with % callouts */}
          <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {cropSlices.map((slice) => {
                const strokeDasharray = `${(slice.pct / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -cumulativeAngle;
                cumulativeAngle += (slice.pct / 100) * circumference;

                return (
                  <circle
                    key={slice.name}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all hover:opacity-85"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-extrabold text-[#141c17]">100%</span>
              <span className="text-[9px] text-[#9ca3af] uppercase font-bold tracking-wider">
                Acreage
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── CARD 3: Weekly Performance Heatmap Matrix ──────────────── */}
      <div className="bg-white rounded-[20px] p-4 border border-[#edf2ee] shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-bold text-[#141c17] tracking-tight">
            Weekly Performance
          </h4>
          <ArrowUpRight size={14} className="text-[#94a39b] hover:text-[#134e35] cursor-pointer" />
        </div>

        {/* Heatmap Grid */}
        <div className="flex flex-col gap-1">
          {/* Days Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#9ca3af] font-medium pb-0.5">
            {days.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Matrix Rows */}
          {heatmapData.map((row, rIdx) => (
            <div key={times[rIdx]} className="grid grid-cols-7 gap-1 items-center">
              {row.map((val, cIdx) => (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className="w-full h-4 rounded-[4px] transition-all hover:scale-110 cursor-pointer"
                  style={{ backgroundColor: heatColors[val] }}
                  title={`${days[cIdx]} ${times[rIdx]}: Activity Level ${val}`}
                />
              ))}
            </div>
          ))}

          {/* Heatmap Footer Legend */}
          <div className="flex items-center justify-end gap-1.5 text-[9px] text-[#9ca3af] font-medium pt-2">
            <span>Less</span>
            {heatColors.map((c, i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-[2px]"
                style={{ backgroundColor: c }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      {/* ─── CARD 4: Analytics Performance & Model Summary ──────────── */}
      <div className="bg-white rounded-[20px] p-4 border border-[#edf2ee] shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-[#141c17] tracking-tight">
            Analytics Performance
          </h4>
          <ArrowUpRight size={14} className="text-[#94a39b] hover:text-[#134e35] cursor-pointer" />
        </div>

        <div className="flex items-center justify-between">
          {/* Tag Pills */}
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[#15803d]">
              <span className="w-2 h-2 rounded-full bg-[#134e35]" />
              Random Forest
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[#16a34a]">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              SARIMA
            </span>
          </div>

          {/* Value Display */}
          <div className="text-right">
            <span className="text-xs font-extrabold text-[#141c17] tracking-tight">
              94.2% Acc.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
