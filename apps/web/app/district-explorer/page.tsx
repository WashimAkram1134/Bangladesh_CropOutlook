'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Download, Filter, TrendingUp, TrendingDown, Minus,
  ChevronUp, ChevronDown, ChevronsUpDown, X, MapPin, Wheat,
  BarChart2, AlertCircle, Info, ChevronRight, ArrowUpRight, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { api, DistrictExplorerRecord, DistrictExplorerSummary } from '@/lib/api';
import { HistoricalTrendsPanel } from '@/components/district-explorer/HistoricalTrendsPanel';
import { getForecastAdvisory } from '@/lib/forecastAdvisory';

// ─── Types ───────────────────────────────────────────────────────────────────

type SortField =
  | 'district'
  | 'division'
  | 'predicted_yield_t_ha'
  | 'yield_vs_median_t_ha'
  | 'estimated_district_production_tonnes'
  | 'assumed_district_area_ha'
  | 'national_rank';
type SortDir = 'asc' | 'desc';

const CROPS = ['Boro Rice', 'Aman Rice', 'Aus Rice', 'Wheat', 'Potato', 'Jute'] as const;
const DIVISIONS = ['All Divisions', 'Barishal', 'Chattogram', 'Dhaka', 'Khulna', 'Mymensingh', 'Rajshahi', 'Rangpur', 'Sylhet'] as const;

// Choropleth tiers → colors (matches Option A palette)
const TIER_COLORS = ['#e8f5e9', '#a5d6a7', '#66bb6a', '#2e7d32', '#1b5e20'] as const;
const TIER_LABELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'] as const;

// ─── Choropleth SVG Map Component ────────────────────────────────────────────

const DistrictChoroplethMap = dynamic(
  () => import('@/components/district-explorer/DistrictChoroplethMap'),
  { ssr: false, loading: () => <div className="flex-1 h-full rounded-xl bg-[#f0faf4] animate-pulse" /> }
);

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, unit, icon, color, sub }: {
  label: string; value: string; unit?: string; icon: React.ReactNode;
  color: string; sub?: string;
}) {
  return (
    <div className="card p-4 flex items-start gap-3 min-w-0">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: color + '22', color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7c72] mb-0.5 truncate">{label}</p>
        <p className="text-xl font-bold text-[#141c17] leading-none">
          {value}<span className="text-sm font-normal text-[#6b7c72] ml-1">{unit}</span>
        </p>
        {sub && <p className="text-xs text-[#6b7c72] mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Sortable TH ─────────────────────────────────────────────────────────────

function SortTh({ field, label, current, dir, onSort, tooltip }: {
  field: SortField; label: string; current: SortField; dir: SortDir;
  onSort: (f: SortField) => void;
  tooltip?: string;
}) {
  const active = current === field;
  return (
    <th
      className={`px-4 py-3 text-left text-xs uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-all duration-150 ${
        active
          ? 'font-bold text-[#155338] bg-[#eef8f2] border-b-2 border-[#155338]'
          : 'font-semibold text-[#6b7c72] hover:text-[#155338] hover:bg-[#f9fbf9]'
      }`}
      onClick={() => onSort(field)}
      title={tooltip || `Click to sort by ${label}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span>{label}</span>
        {tooltip && (
          <span
            className="inline-flex items-center text-[#9ca3af] hover:text-[#155338]"
            onClick={e => e.stopPropagation()}
            title={tooltip}
          >
            <Info size={11} />
          </span>
        )}
        {active ? (
          <span className="inline-flex items-center px-1 py-0.5 rounded bg-[#155338]/10 text-[#155338]">
            {dir === 'asc' ? <ChevronUp size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}
          </span>
        ) : (
          <ChevronsUpDown size={12} className="opacity-35 hover:opacity-75 transition-opacity" />
        )}
      </span>
    </th>
  );
}

// ─── Yield Bar ────────────────────────────────────────────────────────────────

function YieldBar({ value, max, tier, isHighlighted }: { value: number; max: number; tier: number; isHighlighted?: boolean }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm tabular-nums w-[52px] text-right ${isHighlighted ? 'font-bold text-[#155338]' : 'font-semibold text-[#141c17]'}`}>
        {value.toFixed(2)}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-[#e8efe9] overflow-hidden min-w-[60px]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: TIER_COLORS[tier] ?? TIER_COLORS[2] }}
        />
      </div>
    </div>
  );
}

// ─── District Detail Drawer ───────────────────────────────────────────────────

function DistrictDrawer({ record, summary, onClose }: {
  record: DistrictExplorerRecord;
  summary: DistrictExplorerSummary;
  onClose: () => void;
}) {
  const yieldVsAvg = record.predicted_yield_t_ha - summary.national_avg_yield_t_ha;
  const aboveAvg = yieldVsAvg > 0.05;
  const belowAvg = yieldVsAvg < -0.05;

  const drawerAdvisory = useMemo(() => {
    const targetYear = record.display_season.includes('2027') ? 2027 : 2026;
    const pOrder = record.season === 'Rabi' ? 1 : record.season === 'Kharif-I' ? 2 : 3;
    return getForecastAdvisory({
      seasonName: record.season,
      targetYearStart: targetYear,
      planningOrder: pOrder,
    });
  }, [record.season, record.display_season]);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ backdropFilter: 'blur(2px)', background: 'rgba(20,28,23,0.32)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ml-auto w-full max-w-[420px] h-full bg-white shadow-2xl overflow-y-auto flex flex-col"
        style={{ animation: 'slideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#e8efe9] px-6 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-[#155338]" />
              <span className="text-xs font-semibold text-[#155338] uppercase tracking-wider">{record.division} Division</span>
            </div>
            <h2 className="text-xl font-bold text-[#141c17]">{record.district}</h2>
            <p className="text-sm text-[#6b7c72] mt-0.5">{record.display_season} · {record.crop}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-1 w-8 h-8 rounded-full flex items-center justify-center text-[#6b7c72] hover:bg-[#f0faf4] hover:text-[#155338] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 flex flex-col gap-5">

          {/* National rank badge */}
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-white shadow-sm"
              style={{ background: TIER_COLORS[record.yield_tier] ?? '#66bb6a' }}
            >
              <span className="text-lg leading-none">#{record.national_rank}</span>
              <span className="text-[9px] opacity-80 uppercase tracking-wide">Rank</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#141c17]">
                {aboveAvg ? 'Above-average yield district' : belowAvg ? 'Below-average yield district' : 'Average yield district'}
              </p>
              <p className="text-xs text-[#6b7c72]">
                {Math.abs(yieldVsAvg).toFixed(2)} t/ha {aboveAvg ? 'above' : belowAvg ? 'below' : 'near'} national average
              </p>
            </div>
          </div>

          {/* Key numbers */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Estimated Yield', value: `${record.predicted_yield_t_ha.toFixed(2)} t/ha`, color: '#155338' },
              {
                label: 'Yield vs Median',
                value: record.yield_comparison_label ?? '—',
                color: (record.yield_vs_median_t_ha ?? 0) > 0 ? '#155338' : (record.yield_vs_median_t_ha ?? 0) < 0 ? '#47554f' : '#6b7c72',
              },
              { label: 'Typical Difference', value: `≈${record.crop_historical_mae_t_ha.toFixed(2)} t/ha`, color: '#b45309' },
              { label: 'Recorded Area', value: `${(record.assumed_district_area_ha / 1000).toFixed(1)}k ha`, color: '#1e40af' },
              { label: 'Est. Production', value: `${(record.estimated_district_production_tonnes / 1000).toFixed(0)}k t`, color: '#7c3aed' },
              { label: 'Reference Median', value: `${summary.national_median_yield_t_ha?.toFixed(2) ?? '—'} t/ha`, color: '#6b7c72' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-[#e8efe9] p-3">
                <p className="text-xs text-[#6b7c72] mb-0.5">{label}</p>
                <p className="text-base font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Plain-language explanation */}
          <div className="rounded-xl bg-[#f0faf4] border border-[#c6e8d0] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={13} className="text-[#155338]" />
              <span className="text-xs font-semibold text-[#155338] uppercase tracking-wider">What does this mean?</span>
            </div>
            <p className="text-sm text-[#2d4a3a] leading-relaxed">
              {record.zero_area
                ? `No crop area was officially recorded for ${record.crop} in ${record.district}. The yield estimate applies only if the crop is actually grown here.`
                : aboveAvg
                  ? `${record.district} is forecasted to produce ${record.predicted_yield_t_ha.toFixed(2)} tonnes per hectare of ${record.crop} — higher than the national average of ${summary.national_avg_yield_t_ha.toFixed(2)} t/ha. This is a favourable outlook for the ${record.display_season} season.`
                  : belowAvg
                    ? `${record.district} is forecasted to produce ${record.predicted_yield_t_ha.toFixed(2)} tonnes per hectare of ${record.crop} — below the national average of ${summary.national_avg_yield_t_ha.toFixed(2)} t/ha. Farmers may want to check soil and water conditions.`
                    : `${record.district} is forecasted to produce ${record.predicted_yield_t_ha.toFixed(2)} tonnes per hectare of ${record.crop}, close to the national average for ${record.display_season}.`
              }
            </p>
          </div>

          {/* Typical difference explanation */}
          <div className="rounded-xl bg-[#fffbeb] border border-[#fde68a] p-4">
            <p className="text-xs font-semibold text-[#92400e] mb-1 uppercase tracking-wider">About this estimate</p>
            <p className="text-sm text-[#78350f] leading-relaxed">
              In past seasons, {record.crop} yield predictions for Bangladesh differed from actual harvests by about{' '}
              <strong>≈{record.crop_historical_mae_t_ha.toFixed(2)} t/ha</strong> on average.
              The actual yield for {record.district} may be higher or lower than shown.
            </p>
          </div>

          {/* Warnings */}
          {record.warnings.length > 0 && (
            <div className="rounded-xl bg-[#fef2f2] border border-[#fecaca] p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={13} className="text-[#b91c1c]" />
                <span className="text-xs font-semibold text-[#b91c1c] uppercase tracking-wider">Notes</span>
              </div>
              <ul className="space-y-1">
                {record.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-[#7f1d1d]">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recheck recommendation (EXP_38 Date-Aware Advisory) */}
          <div className="rounded-xl border border-[#c6e8d0] p-4 bg-[#f0faf4]">
            <p className="text-xs font-semibold text-[#155338] uppercase tracking-wider mb-1">When to recheck</p>
            <p className="text-sm text-[#1b4332] leading-relaxed">{drawerAdvisory.message}</p>
          </div>

          {/* Comparison bar */}
          <div>
            <p className="text-xs font-semibold text-[#6b7c72] uppercase tracking-wider mb-2">Yield vs national range</p>
            <div className="relative h-6 rounded-full bg-[#e8efe9] overflow-hidden">
              {/* avg marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#6b7c72] opacity-50"
                style={{ left: `${Math.round((summary.national_avg_yield_t_ha / summary.national_max_yield_t_ha) * 100)}%` }}
              />
              {/* district bar */}
              <div
                className="absolute left-0 top-1 bottom-1 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round((record.predicted_yield_t_ha / summary.national_max_yield_t_ha) * 100))}%`,
                  background: TIER_COLORS[record.yield_tier] ?? '#66bb6a',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#6b7c72] mt-1">
              <span>{summary.national_min_yield_t_ha.toFixed(1)} t/ha (min)</span>
              <span>avg {summary.national_avg_yield_t_ha.toFixed(1)}</span>
              <span>{summary.national_max_yield_t_ha.toFixed(1)} t/ha (max)</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Distribution Mini-Chart ──────────────────────────────────────────────────

function YieldDistributionChart({ records, selectedDistrict }: {
  records: DistrictExplorerRecord[];
  selectedDistrict?: string;
}) {
  const buckets = useMemo(() => {
    if (records.length === 0) return [];
    const yields = records.map(r => r.predicted_yield_t_ha);
    const min = Math.min(...yields);
    const max = Math.max(...yields);
    const range = max - min || 1;
    const N = 10;
    const step = range / N;
    const bins: { label: string; count: number; midpoint: number }[] = [];
    for (let i = 0; i < N; i++) {
      const lo = min + i * step;
      const hi = lo + step;
      bins.push({
        label: lo.toFixed(1),
        count: records.filter(r => r.predicted_yield_t_ha >= lo && (i === N - 1 ? r.predicted_yield_t_ha <= hi : r.predicted_yield_t_ha < hi)).length,
        midpoint: (lo + hi) / 2,
      });
    }
    return bins;
  }, [records]);

  if (buckets.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={buckets} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8efe9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7c72' }} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: '#6b7c72' }} tickLine={false} axisLine={false} />
        <ReTooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e8efe9' }}
          formatter={(v) => [`${v} districts`, 'Count']}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {buckets.map((b, i) => (
            <Cell key={i} fill="#22c55e" fillOpacity={0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Top 10 Mini-Chart ────────────────────────────────────────────────────────

function TopDistrictsChart({ records, onSelect }: {
  records: DistrictExplorerRecord[];
  onSelect: (d: string) => void;
}) {
  const top10 = useMemo(() =>
    [...records].sort((a, b) => b.predicted_yield_t_ha - a.predicted_yield_t_ha).slice(0, 10),
    [records]
  );

  if (top10.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8efe9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7c72' }} tickLine={false} unit=" t/ha" />
        <YAxis
          type="category"
          dataKey="district"
          tick={{ fontSize: 10, fill: '#141c17', cursor: 'pointer' }}
          tickLine={false}
          width={72}
          onClick={(data) => onSelect(data.value)}
        />
        <ReTooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e8efe9' }}
          formatter={(v) => [typeof v === 'number' ? `${v.toFixed(2)} t/ha` : v, 'Est. Yield']}
        />
        <Bar dataKey="predicted_yield_t_ha" radius={[0, 4, 4, 0]}>
          {top10.map((r, i) => (
            <Cell
              key={i}
              fill={TIER_COLORS[r.yield_tier] ?? '#22c55e'}
              cursor="pointer"
              onClick={() => onSelect(r.district)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DistrictExplorerPage() {
  const [crop, setCrop] = useState<string>('Boro Rice');
  const [divisionFilter, setDivisionFilter] = useState<string>('All Divisions');
  const [districtFilter, setDistrictFilter] = useState<string>('All Districts');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('national_rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [drawerDistrict, setDrawerDistrict] = useState<string | null>(null);
  const [data, setData] = useState<{ records: DistrictExplorerRecord[]; summary: DistrictExplorerSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

  // Fetch data from backend
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getDistrictExplorer(crop)
      .then(res => {
        if (!cancelled) {
          setData({ records: res.records ?? [], summary: res.summary });
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message ?? 'Could not load data');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [crop]);

  // Dynamic 3-State Sort Handler:
  // 1st click: Sort by field ascending (asc)
  // 2nd click: Sort by field descending (desc)
  // 3rd click: Disable custom order and revert to default order by ranking (national_rank asc)
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        // 3rd click on active sorted column: reset to default ranking order
        setSortField('national_rank');
        setSortDir('asc');
      }
    } else {
      // 1st click on new column: start ascending
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField, sortDir]);

  // List of districts available under the current division filter, sorted alphabetically
  const availableDistricts = useMemo(() => {
    if (!data) return [];
    let recs = data.records;
    if (divisionFilter !== 'All Divisions') {
      recs = recs.filter(r => r.division === divisionFilter);
    }
    return [...recs].sort((a, b) => a.district.localeCompare(b.district));
  }, [data, divisionFilter]);

  // Filtered + sorted records (64-district median reference is always preserved)
  const filteredRecords = useMemo(() => {
    if (!data) return [];
    let recs = data.records;
    if (divisionFilter !== 'All Divisions') recs = recs.filter(r => r.division === divisionFilter);
    if (districtFilter !== 'All Districts') recs = recs.filter(r => r.district === districtFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      recs = recs.filter(r => r.district.toLowerCase().includes(q) || r.division.toLowerCase().includes(q));
    }
    return [...recs].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      // Secondary tie-breaker: default national rank
      return a.national_rank - b.national_rank;
    });
  }, [data, divisionFilter, districtFilter, search, sortField, sortDir]);

  const selectedRecord = useMemo(
    () => data?.records.find(r => r.district === selectedDistrict) ?? null,
    [data, selectedDistrict]
  );

  const drawerRecord = useMemo(
    () => (drawerDistrict ? data?.records.find(r => r.district === drawerDistrict) ?? null : null),
    [data, drawerDistrict]
  );

  const allDistrictNames = useMemo(
    () => (data?.records ? data.records.map(r => r.district) : []),
    [data]
  );

  const csvUrl = `${API_BASE}/api/district-explorer/csv?crop=${encodeURIComponent(crop)}`;

  const displaySeason = data?.summary?.season || '—';

  const activeAdvisory = useMemo(() => {
    if (!data?.summary) return null;
    const seasonStr = data.summary.season || 'Rabi 2026–27';
    const sName = seasonStr.includes('Kharif-I') ? 'Kharif-I' : seasonStr.includes('Kharif-II') ? 'Kharif-II' : 'Rabi';
    const targetYear = seasonStr.includes('2027') ? 2027 : 2026;
    const pOrder = sName === 'Rabi' ? 1 : sName === 'Kharif-I' ? 2 : 3;
    return getForecastAdvisory({
      seasonName: sName,
      targetYearStart: targetYear,
      planningOrder: pOrder,
    });
  }, [data?.summary]);

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.3s ease both; }
      `}</style>

      <div className="page-container py-6 flex flex-col gap-5 min-h-full">

        {/* ── Page Header ── */}
        <div className="fade-up flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#141c17] mb-0.5">District Explorer</h1>
            <p className="text-sm text-[#6b7c72]">
              All 64 Bangladesh districts · {displaySeason} · EXP_36 verified forecasts
            </p>
          </div>
          <a
            href={csvUrl}
            download
            className="btn btn-secondary gap-2 text-sm shrink-0"
            id="de-csv-export"
          >
            <Download size={15} />
            Export CSV
          </a>
        </div>

        {/* ── Control Bar ── */}
        <div className="fade-up card p-3 flex flex-wrap items-center gap-3" style={{ animationDelay: '0.04s' }}>
          {/* Crop selector */}
          <div className="flex items-center gap-2 min-w-[170px]">
            <Wheat size={15} className="text-[#155338] shrink-0" />
            <select
              id="de-crop-select"
              className="select text-sm font-medium"
              value={crop}
              onChange={e => {
                setCrop(e.target.value);
                setDivisionFilter('All Divisions');
                setDistrictFilter('All Districts');
                setSelectedDistrict(null);
              }}
            >
              {CROPS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Division filter */}
          <div className="flex items-center gap-2 min-w-[160px]">
            <Filter size={14} className="text-[#6b7c72] shrink-0" />
            <select
              id="de-division-select"
              className="select text-sm font-medium"
              value={divisionFilter}
              onChange={e => {
                setDivisionFilter(e.target.value);
                setDistrictFilter('All Districts');
                setSelectedDistrict(null);
              }}
            >
              {DIVISIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          {/* District dropdown (64 districts + All Bangladesh) */}
          <div className="flex items-center gap-2 min-w-[210px]">
            <MapPin size={14} className="text-[#6b7c72] shrink-0" />
            <select
              id="de-district-select"
              className="select text-sm font-medium"
              value={selectedDistrict === 'All Bangladesh' ? 'All Bangladesh' : (selectedDistrict || districtFilter)}
              onChange={e => {
                const val = e.target.value;
                if (val === 'All Districts') {
                  setDistrictFilter('All Districts');
                  setSelectedDistrict(null);
                } else if (val === 'All Bangladesh') {
                  setDistrictFilter('All Districts');
                  setSelectedDistrict('All Bangladesh');
                } else {
                  setDistrictFilter(val);
                  setSelectedDistrict(val);
                }
              }}
            >
              <option value="All Districts">
                {divisionFilter === 'All Divisions' ? 'All Districts (64)' : `All in ${divisionFilter} (${availableDistricts.length})`}
              </option>
              <option value="All Bangladesh">All Bangladesh (National Aggregate)</option>
              {availableDistricts.map(d => (
                <option key={d.district} value={d.district}>
                  {d.district} (#{d.national_rank})
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <Search size={14} className="text-[#6b7c72] shrink-0" />
            <input
              id="de-search"
              type="text"
              className="input text-sm"
              placeholder="Search district or division…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#6b7c72] hover:text-[#141c17]">
                <X size={14} />
              </button>
            )}
          </div>

          {filteredRecords.length !== (data?.records.length ?? 0) && (
            <span className="badge badge-green text-xs shrink-0">
              {filteredRecords.length} / {data?.records.length ?? 0} districts
            </span>
          )}
        </div>

        {/* ── Loading / Error ── */}
        {loading && (
          <div className="card p-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#155338] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#6b7c72]">Loading EXP_36 forecasts…</p>
          </div>
        )}

        {error && (
          <div className="card p-6 flex items-start gap-3 bg-[#fef2f2] border-[#fecaca]">
            <AlertCircle size={18} className="text-[#b91c1c] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#b91c1c]">Could not connect to backend</p>
              <p className="text-sm text-[#7f1d1d] mt-0.5">{error}</p>
              <p className="text-xs text-[#9ca3af] mt-2">Make sure the FastAPI server is running on port 8001.</p>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* ── Summary Cards ── */}
            <div className="fade-up grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" style={{ animationDelay: '0.08s' }}>
              <SummaryCard
                label="Avg National Yield"
                value={data.summary.national_avg_yield_t_ha.toFixed(2)}
                unit="t/ha"
                icon={<BarChart2 size={16} />}
                color="#155338"
                sub={`Median: ${data.summary.national_median_yield_t_ha?.toFixed(2) ?? data.summary.national_avg_yield_t_ha.toFixed(2)} t/ha`}
              />
              <SummaryCard
                label="Total Est. Production"
                value={(data.summary.national_total_production_tonnes / 1000).toFixed(0) + 'k'}
                unit="tonnes"
                icon={<TrendingUp size={16} />}
                color="#1e40af"
                sub="Across all 64 districts"
              />
              <SummaryCard
                label="Highest Yield"
                value={data.summary.national_max_yield_t_ha.toFixed(2)}
                unit="t/ha"
                icon={<TrendingUp size={16} />}
                color="#059669"
                sub={data.records.find(r => r.predicted_yield_t_ha === data.summary.national_max_yield_t_ha)?.district}
              />
              <SummaryCard
                label="Lowest Yield"
                value={data.summary.national_min_yield_t_ha.toFixed(2)}
                unit="t/ha"
                icon={<TrendingDown size={16} />}
                color="#d97706"
                sub={data.records.find(r => r.predicted_yield_t_ha === data.summary.national_min_yield_t_ha)?.district}
              />
              <SummaryCard
                label="Typical Difference"
                value={`≈${data.summary.crop_typical_diff_t_ha.toFixed(2)}`}
                unit="t/ha"
                icon={<Minus size={16} />}
                color="#7c3aed"
                sub="Historical avg. difference"
              />
            </div>

            {/* ── Two-Column: Map + Insights ── */}
            <div className="fade-up grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ animationDelay: '0.12s' }}>
              {/* Left: Choropleth Map */}
              <div className="lg:col-span-3 card overflow-hidden" style={{ minHeight: 380 }}>
                <div className="p-4 border-b border-[#e8efe9] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#141c17]">District Yield Map</h3>
                    <p className="text-xs text-[#6b7c72]">{crop} · {displaySeason}</p>
                  </div>
                  {/* Legend */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    {TIER_COLORS.map((c, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <div className="w-5 h-3 rounded" style={{ background: c }} />
                        <span className="text-[9px] text-[#6b7c72]">{TIER_LABELS[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative" style={{ height: 340 }}>
                  <DistrictChoroplethMap
                    records={filteredRecords}
                    selectedDistrict={selectedDistrict}
                    onDistrictClick={setSelectedDistrict}
                    tierColors={[...TIER_COLORS]}
                  />
                </div>
              </div>

              {/* Right: Top 10 districts */}
              <div className="lg:col-span-2 flex flex-col gap-3">
                <div className="card p-4 flex-1">
                  <h3 className="text-sm font-semibold text-[#141c17] mb-3">Top 10 Districts by Yield</h3>
                  <TopDistrictsChart records={data.records} onSelect={setSelectedDistrict} />
                </div>
              </div>
            </div>

            {/* ── Two-Tab Panel: Tab A Historical Trends (Default) & Tab B Yield Distribution ── */}
            <HistoricalTrendsPanel
              selectedDistrict={selectedDistrict}
              onSelectDistrict={setSelectedDistrict}
              crop={crop}
              season={data.summary.season}
              displaySeason={displaySeason}
              allDistricts={allDistrictNames}
              records={data.records}
            />

            {/* ── Dynamic Early Forecast Season Advisory (EXP_38) ── */}
            {activeAdvisory && (
              <div className="fade-up rounded-xl bg-[#f0faf4] border border-[#c6e8d0] px-4 py-3 flex items-center gap-3 text-xs text-[#155338]" style={{ animationDelay: '0.14s' }}>
                <Calendar size={15} className="shrink-0 text-[#155338]" />
                <span className="font-medium text-[#155338] leading-relaxed">
                  {activeAdvisory.message}
                </span>
              </div>
            )}

            {/* ── Full Sortable Table with Yield Comparison ── */}
            <div className="fade-up card overflow-hidden" style={{ animationDelay: '0.16s' }}>
              <div className="p-4 border-b border-[#e8efe9] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-sm font-semibold text-[#141c17]">
                    All Districts
                    <span className="ml-2 text-xs font-normal text-[#6b7c72]">({filteredRecords.length} shown)</span>
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eef8f2] text-[#155338] border border-[#c6e8d0]">
                    <Info size={12} className="shrink-0 text-[#155338]" />
                    Ranking is based on estimated yield (t/ha)
                  </span>
                  {selectedDistrict && selectedDistrict !== 'All Bangladesh' && (
                    <button
                      onClick={() => setDrawerDistrict(selectedDistrict)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#155338] text-white hover:bg-[#0f3d28] transition-colors shadow-2xs"
                      title={`Open detailed breakdown side panel for ${selectedDistrict}`}
                    >
                      <span>Open {selectedDistrict} Detail Panel</span>
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#6b7c72]">
                  {sortField !== 'national_rank' && (
                    <button
                      onClick={() => { setSortField('national_rank'); setSortDir('asc'); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#155338] bg-[#eef8f2] hover:bg-[#d8efe0] border border-[#c6e8d0] transition-colors"
                      title="Disable custom order and reset to default ranking"
                    >
                      <span>Reset order to Rank</span>
                      <X size={12} />
                    </button>
                  )}
                  <p className="hidden sm:block">
                    Reference median: <span className="font-semibold text-[#155338]">{data.summary.national_median_yield_t_ha?.toFixed(2)} t/ha</span> across Bangladesh
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse" id="de-district-table">
                  <thead>
                    <tr className="bg-[#f8faf8] border-b border-[#e8efe9]">
                      <SortTh
                        field="national_rank"
                        label="Rank"
                        current={sortField}
                        dir={sortDir}
                        onSort={handleSort}
                        tooltip="National rank is ordered by estimated yield (highest yield = rank #1). Click again to sort descending or reset to default."
                      />
                      <SortTh field="district" label="District" current={sortField} dir={sortDir} onSort={handleSort} tooltip="Click to sort by district name (ascending / descending / reset to rank)" />
                      <SortTh field="division" label="Division" current={sortField} dir={sortDir} onSort={handleSort} tooltip="Click to sort by division name" />
                      <SortTh field="predicted_yield_t_ha" label="Est. Yield (t/ha)" current={sortField} dir={sortDir} onSort={handleSort} tooltip="Click to sort by estimated yield (t/ha)" />
                      <SortTh
                        field="yield_vs_median_t_ha"
                        label="Yield Comparison"
                        current={sortField}
                        dir={sortDir}
                        onSort={handleSort}
                        tooltip="Shows how this district's estimated yield compares with the middle value across Bangladesh's 64 districts for the selected crop and season."
                      />
                      <SortTh field="estimated_district_production_tonnes" label="Est. Production" current={sortField} dir={sortDir} onSort={handleSort} tooltip="Click to sort by estimated production in tonnes" />
                      <SortTh field="assumed_district_area_ha" label="Recorded Area" current={sortField} dir={sortDir} onSort={handleSort} tooltip="Click to sort by recorded crop area in hectares" />
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#6b7c72]">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((rec, idx) => (
                      <tr
                        key={rec.district}
                        className={`border-b border-[#f1f5f2] cursor-pointer transition-colors hover:bg-[#eef8f2]/40 ${selectedDistrict === rec.district ? 'bg-[#f0faf4]' : idx % 2 === 0 ? '' : 'bg-[#fafcfa]'}`}
                        onClick={() => {
                          setSelectedDistrict(rec.district);
                          setDrawerDistrict(rec.district);
                        }}
                      >
                        <td className={`px-4 py-3 transition-colors ${sortField === 'national_rank' ? 'bg-[#eef8f2]/60 font-semibold' : ''}`}>
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shadow-xs"
                            style={{ background: TIER_COLORS[rec.yield_tier] ?? '#66bb6a' }}
                          >
                            {rec.national_rank}
                          </span>
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap transition-colors ${sortField === 'district' ? 'bg-[#eef8f2]/60 font-bold text-[#155338]' : 'font-medium text-[#141c17]'}`}>
                          {rec.district}
                        </td>
                        <td className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${sortField === 'division' ? 'bg-[#eef8f2]/60 font-bold text-[#155338]' : 'text-[#6b7c72]'}`}>
                          {rec.division}
                        </td>
                        <td className={`px-4 py-3 min-w-[160px] transition-colors ${sortField === 'predicted_yield_t_ha' ? 'bg-[#eef8f2]/60' : ''}`}>
                          <YieldBar
                            value={rec.predicted_yield_t_ha}
                            max={data.summary.national_max_yield_t_ha}
                            tier={rec.yield_tier}
                            isHighlighted={sortField === 'predicted_yield_t_ha'}
                          />
                        </td>
                        <td className={`px-4 py-3 text-xs whitespace-nowrap transition-colors ${sortField === 'yield_vs_median_t_ha' ? 'bg-[#eef8f2]/60 font-semibold' : ''}`}>
                          {rec.yield_vs_median_t_ha !== undefined && rec.yield_vs_median_pct !== undefined ? (
                            Math.abs(rec.yield_vs_median_t_ha) <= 0.01 ? (
                              <span className="inline-flex items-center text-[#6b7c72] font-medium">
                                Near median
                              </span>
                            ) : rec.yield_vs_median_t_ha > 0 ? (
                              <span className="inline-flex items-center gap-0.5 font-semibold text-[#155338] bg-[#eef8f2] px-2 py-0.5 rounded-md border border-[#c6e8d0]">
                                +{rec.yield_vs_median_t_ha.toFixed(2)} t/ha (+{rec.yield_vs_median_pct.toFixed(1)}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 font-medium text-[#47554f] bg-[#f4f6f4] px-2 py-0.5 rounded-md border border-[#e2e7e3]">
                                {rec.yield_vs_median_t_ha.toFixed(2)} t/ha ({rec.yield_vs_median_pct.toFixed(1)}%)
                              </span>
                            )
                          ) : (
                            <span className="text-[#9ca3af]">—</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm tabular-nums whitespace-nowrap transition-colors ${sortField === 'estimated_district_production_tonnes' ? 'bg-[#eef8f2]/60 font-bold text-[#155338]' : 'text-[#141c17]'}`}>
                          {(rec.estimated_district_production_tonnes / 1000).toFixed(1)}k t
                        </td>
                        <td className={`px-4 py-3 text-sm tabular-nums whitespace-nowrap transition-colors ${sortField === 'assumed_district_area_ha' ? 'bg-[#eef8f2]/60 font-bold text-[#155338]' : 'text-[#6b7c72]'}`}>
                          {(rec.assumed_district_area_ha / 1000).toFixed(1)}k ha
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#155338] bg-[#eef8f2] border border-[#c6e8d0] hover:bg-[#155338] hover:text-white transition-all ml-auto shadow-2xs group"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDistrict(rec.district);
                              setDrawerDistrict(rec.district);
                            }}
                            aria-label={`Open details for ${rec.district}`}
                            title={`Open detailed breakdown for ${rec.district}`}
                          >
                            <span>Detail</span>
                            <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#6b7c72]">
                          No districts match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Practical Farmer-Friendly Advisory Note ── */}
            <div className="fade-up flex items-start gap-2.5 text-xs text-[#47554f] p-4 rounded-xl bg-[#f8faf8] border border-[#e8efe9]" style={{ animationDelay: '0.2s' }}>
              <Info size={15} className="shrink-0 mt-0.5 text-[#155338]" />
              <p className="leading-relaxed">
                These yield estimates provide early seasonal guidance to support crop planning across Bangladesh ({displaySeason}).
                Actual harvest results depend on seasonal rainfall, irrigation access, temperature, and local field management.
                For on-the-ground farming decisions and local crop advice, consult your Upazila Agriculture Officer (DAE).
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── District Detail Drawer ── */}
      {drawerRecord && data?.summary && (
        <DistrictDrawer
          record={drawerRecord}
          summary={data.summary}
          onClose={() => setDrawerDistrict(null)}
        />
      )}
    </>
  );
}
