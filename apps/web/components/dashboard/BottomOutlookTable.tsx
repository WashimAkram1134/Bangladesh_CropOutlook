'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Calculator,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { District } from '@/lib/types';
import type { SeasonItem, ForecastRecordResponse } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface BottomOutlookTableProps {
  districts: District[];
  selectedDistrict: District;
  onDistrictSelect: (district: District) => void;
  crop: string;
  season: SeasonItem;
  allForecasts?: ForecastRecordResponse[];
  userAreaHa: number | null;
  onUserAreaChange: (val: number | null) => void;
  locale?: 'en' | 'bn';
}

type SortField = 'district' | 'yield' | 'production' | 'area';
type SortOrder = 'asc' | 'desc';

function normName(val: string): string {
  return val.toLowerCase().replace(/district|zila|zilla|[^a-z0-9]/g, '');
}

export function BottomOutlookTable({
  districts,
  selectedDistrict,
  onDistrictSelect,
  crop,
  season,
  allForecasts = [],
  userAreaHa,
  onUserAreaChange,
  locale = 'en',
}: BottomOutlookTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('yield');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [areaInput, setAreaInput] = useState<string>(userAreaHa !== null && userAreaHa !== undefined ? String(userAreaHa) : '2.5');

  const pageSize = 10;

  // Build lookup of district metadata (division, Bangla name)
  const districtMetaMap = useMemo(() => {
    const map: Record<string, District> = {};
    for (const d of districts) {
      map[normName(d.name)] = d;
    }
    return map;
  }, [districts]);

  // Divisions list
  const divisions = ['All', 'Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh'];

  // Ensure allForecasts is safely an array
  const safeForecasts = useMemo(() => {
    return Array.isArray(allForecasts) ? allForecasts : [];
  }, [allForecasts]);

  // Filtered & Sorted records
  const filteredRecords = useMemo(() => {
    return safeForecasts
      .filter((rec) => {
        if (!rec || !rec.district) return false;
        const meta = districtMetaMap[normName(rec.district)];
        const matchesSearch =
          rec.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (meta?.nameBn && meta.nameBn.includes(searchQuery)) ||
          (meta?.division && meta.division.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesDivision =
          selectedDivision === 'All' || (meta?.division && meta.division.toLowerCase() === selectedDivision.toLowerCase());

        return matchesSearch && matchesDivision;
      })
      .sort((a, b) => {
        let valA = 0;
        let valB = 0;
        if (sortField === 'district') {
          const comp = a.district.localeCompare(b.district);
          return sortOrder === 'asc' ? comp : -comp;
        } else if (sortField === 'yield') {
          valA = a.predicted_yield_t_ha;
          valB = b.predicted_yield_t_ha;
        } else if (sortField === 'production') {
          valA = a.estimated_district_production_tonnes;
          valB = b.estimated_district_production_tonnes;
        } else if (sortField === 'area') {
          valA = a.assumed_district_area_ha;
          valB = b.assumed_district_area_ha;
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
  }, [allForecasts, searchQuery, selectedDivision, sortField, sortOrder, districtMetaMap]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // CSV Export Function
  const handleExportCSV = () => {
    const headers = [
      'District',
      'Division',
      'Crop',
      'Season',
      'Predicted_Yield_t_ha',
      'District_Production_tonnes',
      'Latest_Recorded_Area_ha',
      'Forecast_Horizon_Months',
      'Status',
    ];
    const rows = filteredRecords.map((r) => {
      const meta = districtMetaMap[normName(r.district)];
      return [
        `"${r.district}"`,
        `"${meta?.division || ''}"`,
        `"${r.crop}"`,
        `"${r.display_season}"`,
        r.predicted_yield_t_ha.toFixed(3),
        r.estimated_district_production_tonnes.toFixed(1),
        r.assumed_district_area_ha.toFixed(1),
        r.max_sarima_lead_months,
        `"${r.district_area_status}"`,
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bangladesh_crop_forecast_${crop}_${season.season}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAreaChange = (valStr: string) => {
    setAreaInput(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      onUserAreaChange(num);
    } else if (!valStr.trim()) {
      onUserAreaChange(null);
    }
  };

  return (
    <div className="bg-white rounded-[22px] p-4 border border-[#edf2ee] shadow-sm select-none">
      {/* ── Table Top Bar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-[#edf2ee]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#141c17] tracking-tight">
              District Forecast Overview
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eafaf1] text-[#15803d] font-bold border border-[#c9eed7]">
              {filteredRecords.length} / {safeForecasts.length} Districts
            </span>
          </div>
          <p className="text-[11px] text-[#64746b] mt-0.5">
            Verified EXP_36 predictions for {crop} • {season.season_label}
          </p>
        </div>

        {/* Right Action Tools: Search, Division Filter, Calculator, CSV Export */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Quick Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a39b]" />
            <input
              type="text"
              placeholder="Search district..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#f8faf8] border border-[#e5ebe6] text-[#141c17] rounded-full pl-8 pr-3 py-1 text-xs outline-none focus:border-[#134e35] transition-all w-36 sm:w-44"
            />
          </div>

          {/* Division Select */}
          <select
            value={selectedDivision}
            onChange={(e) => {
              setSelectedDivision(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[#f8faf8] border border-[#e5ebe6] text-[#141c17] rounded-full px-3 py-1 text-xs outline-none focus:border-[#134e35] cursor-pointer"
          >
            {divisions.map((div) => (
              <option key={div} value={div}>
                {div === 'All' ? 'All Divisions' : `${div}`}
              </option>
            ))}
          </select>

          {/* User Field Calculator Toggle */}
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showCalculator
                ? 'bg-[#134e35] text-[#4ade80] shadow-sm'
                : 'bg-[#f1f5f2] text-[#64746b] hover:text-[#134e35]'
            }`}
          >
            <Calculator size={13} />
            <span>Field Calc</span>
          </button>

          {/* CSV Download */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1 rounded-full bg-[#f1f5f2] hover:bg-[#e5ebe6] text-[#141c17] text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Download 64 District Forecasts CSV"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* User Area Calculator Banner (Expanded) */}
      {showCalculator && (
        <div className="mb-3 p-3 rounded-xl bg-[#f0faf4] border border-[#c9eed7] text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-[#15803d]" />
            <div>
              <span className="font-bold text-[#141c17]">User Field Production Calculator:</span>{' '}
              <span className="text-[#64746b]">
                Enter farm area in hectares to compute estimated yield output across districts.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#141c17]">Hectares:</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={areaInput}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="w-24 bg-white border border-[#c9eed7] text-[#141c17] rounded-lg px-2 py-0.5 text-xs font-bold outline-none focus:border-[#15803d]"
            />
            <span className="text-[11px] text-[#64746b]">ha</span>
          </div>
        </div>
      )}

      {/* ── Analytical Data Table ────────────────────────────────────── */}
      <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#edf2ee] text-[#64746b] font-semibold text-[11px]">
              <th
                onClick={() => handleSort('district')}
                className="py-2.5 px-3 cursor-pointer hover:text-[#134e35] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>District</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3">Crop & Season</th>
              <th
                onClick={() => handleSort('yield')}
                className="py-2.5 px-3 cursor-pointer hover:text-[#134e35] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Predicted Yield</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th
                onClick={() => handleSort('production')}
                className="py-2.5 px-3 cursor-pointer hover:text-[#134e35] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Est. District Prod</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th
                onClick={() => handleSort('area')}
                className="py-2.5 px-3 cursor-pointer hover:text-[#134e35] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>BBS Recorded Area</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              {userAreaHa !== null && userAreaHa !== undefined && userAreaHa > 0 && (
                <th className="py-2.5 px-3 text-[#15803d]">
                  User Prod ({userAreaHa} ha)
                </th>
              )}
              <th className="py-2.5 px-3">SARIMA Horizon</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2ee]">
            {paginatedRecords.length > 0 ? (
              paginatedRecords.map((r) => {
                const normD = normName(r.district);
                const isSelected = normName(selectedDistrict.name) === normD;
                const meta = districtMetaMap[normD];
                const userProd =
                  userAreaHa && userAreaHa > 0
                    ? (r.predicted_yield_t_ha * userAreaHa).toFixed(2)
                    : null;

                return (
                  <tr
                    key={r.district}
                    onClick={() => {
                      if (meta) onDistrictSelect(meta);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#eafaf1] font-medium'
                        : 'hover:bg-[#f8faf8]'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin
                          size={12}
                          className={isSelected ? 'text-[#15803d]' : 'text-[#94a39b]'}
                        />
                        <span className="font-bold text-[#141c17]">{r.district}</span>
                        {meta?.division && (
                          <span className="text-[10px] text-[#94a39b]">({meta.division})</span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-[#64746b]">
                      <span className="font-medium text-[#141c17]">{r.crop}</span>
                      <span className="text-[10px] text-[#94a39b] ml-1.5">
                        {r.display_season}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-extrabold text-[#15803d] text-sm">
                        {r.predicted_yield_t_ha.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[#64746b] ml-1">t/ha</span>
                    </td>

                    <td className="py-2.5 px-3 font-semibold text-[#141c17]">
                      {r.estimated_district_production_tonnes >= 1000
                        ? `${(r.estimated_district_production_tonnes / 1000).toFixed(1)}k t`
                        : `${formatNumber(Math.round(r.estimated_district_production_tonnes))} t`}
                    </td>

                    <td className="py-2.5 px-3 text-[#64746b]">
                      {r.assumed_district_area_ha > 0 ? (
                        <span>{formatNumber(Math.round(r.assumed_district_area_ha))} ha</span>
                      ) : (
                        <span className="text-amber-700 font-medium">0 ha (Zero BBS)</span>
                      )}
                    </td>

                    {userProd !== null && (
                      <td className="py-2.5 px-3 font-bold text-[#15803d]">
                        {formatNumber(parseFloat(userProd))} t
                      </td>
                    )}

                    <td className="py-2.5 px-3 text-[#64746b]">
                      <span className="px-2 py-0.5 rounded-full bg-[#f1f5f2] text-[10px] font-semibold text-[#4b5563]">
                        {r.max_sarima_lead_months} Months
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      {r.assumed_district_area_ha > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#15803d] px-2 py-0.5 rounded-full bg-[#eafaf1]">
                          <CheckCircle2 size={10} />
                          Positive BBS Area
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                          <AlertTriangle size={10} />
                          Zero Area • Conditional
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#94a39b]">
                  No district forecasts matching your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Table Footer & Pagination ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-[#edf2ee] text-xs text-[#64746b]">
        <div>
          Showing{' '}
          <span className="font-bold text-[#141c17]">
            {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
          </span>{' '}
          to{' '}
          <span className="font-bold text-[#141c17]">
            {Math.min(currentPage * pageSize, filteredRecords.length)}
          </span>{' '}
          of <span className="font-bold text-[#141c17]">{filteredRecords.length}</span> district forecasts
        </div>

        {/* Pagination Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-[#e5ebe6] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8faf8] transition-colors"
            title="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 font-semibold text-[#141c17]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg border border-[#e5ebe6] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8faf8] transition-colors"
            title="Next Page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
