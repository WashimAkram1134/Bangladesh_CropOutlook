'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  BarChart3,
  Layers,
  Calendar,
  MapPin,
  Sparkles,
  Download,
  AlertTriangle,
  Info,
  RotateCcw,
  Edit3,
  Check,
  ChevronDown,
  Sliders,
  HelpCircle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Wheat,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  Legend,
} from 'recharts';
import { api, DistrictItem, PlannerResponse, PlannerCropItem } from '@/lib/api';
import {
  LAND_UNITS,
  LAND_UNITS_MAP,
  LandUnitKey,
  convertToHectares,
  convertFromHectares,
  formatUnitValue,
} from '@/lib/landUnits';

// ─── Default Demo Prices ──────────────────────────────────────────────────────
const DEFAULT_DEMO_PRICES: Record<string, { price: number; unit: string; source: string; date: string }> = {
  'Boro Rice': { price: 36.0, unit: 'BDT / kg paddy', source: 'DAM Wholesale Paddy Reference Price', date: 'May 5, 2026' },
  'Aman Rice': { price: 34.0, unit: 'BDT / kg paddy', source: 'DAM Wholesale Paddy Reference Price', date: 'Nov 9, 2025' },
  'Aus Rice': { price: 32.0, unit: 'BDT / kg paddy', source: 'DAM Wholesale Paddy Reference Price (Approx)', date: 'July 2026' },
  'Wheat': { price: 36.0, unit: 'BDT / kg', source: 'DAM Wholesale Wheat Reference Price', date: 'April 2026' },
  'Potato': { price: 22.0, unit: 'BDT / kg', source: 'DAM Wholesale Potato Reference Price', date: '2025-2026' },
  'Jute': { price: 3862.5, unit: 'BDT / maund', source: 'DAM Wholesale Raw Jute (1 maund = 37.3242 kg)', date: 'Oct 2026' },
};

const MAUND_TO_KG = 37.3242;

// ─── Number Formatters ────────────────────────────────────────────────────────
function formatBDT(amount: number): string {
  if (isNaN(amount) || amount === null) return '৳ 0';
  const isNeg = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const s = abs.toString();
  let res = '';
  if (s.length <= 3) {
    res = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    const parts = [];
    let rem = rest;
    while (rem.length > 2) {
      parts.unshift(rem.slice(-2));
      rem = rem.slice(0, -2);
    }
    if (rem.length > 0) parts.unshift(rem);
    res = parts.join(',') + ',' + last3;
  }
  return `${isNeg ? '-' : ''}৳ ${res}`;
}

function formatLakh(amount: number): string {
  if (isNaN(amount) || amount === null) return '0 Lakh';
  const val = amount / 100_000;
  if (Math.abs(val) >= 100) {
    return `${(amount / 10_000_000).toFixed(2)} Cr`;
  }
  return `${val.toFixed(2)} Lakh`;
}

// ─── Season Colors & Emojis ──────────────────────────────────────────────────
const CROP_ICONS: Record<string, string> = {
  'Boro Rice': '🌾',
  'Aman Rice': '🌾',
  'Aus Rice': '🌾',
  'Wheat': '🌾',
  'Potato': '🥔',
  'Jute': '🧵',
};

const CROP_COLORS: Record<string, string> = {
  'Boro Rice': '#059669',
  'Aman Rice': '#10b981',
  'Aus Rice': '#34d399',
  'Wheat': '#d97706',
  'Potato': '#8b5cf6',
  'Jute': '#0284c7',
};

const SEASON_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  'Rabi': { bg: 'rgba(5, 150, 105, 0.12)', text: '#059669', label: 'Rabi' },
  'Kharif-I': { bg: 'rgba(2, 132, 199, 0.12)', text: '#0284c7', label: 'Kharif-I' },
  'Kharif-II': { bg: 'rgba(217, 119, 6, 0.12)', text: '#d97706', label: 'Kharif-II' },
};

export function SmartCropPlanner() {
  // ─── State ──────────────────────────────────────────────────────────────────
  const [district, setDistrict] = useState<string>('Dinajpur');
  const [districtsList, setDistrictsList] = useState<DistrictItem[]>([]);
  const [landAreaInput, setLandAreaInput] = useState<string>('2.5');
  const [selectedUnit, setSelectedUnit] = useState<LandUnitKey>('hectare');
  const [cultivationCostInput, setCultivationCostInput] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'charts'>('cards');

  // Custom prices override: crop -> price per kg (or maund for Jute)
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [isEditingPrices, setIsEditingPrices] = useState<boolean>(false);
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);

  // API Data
  const [plannerData, setPlannerData] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Load Districts ────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    api.getDistricts()
      .then((data) => {
        if (mounted && data) {
          setDistrictsList(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load districts list:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // ─── Area in Hectares ──────────────────────────────────────────────────────
  const areaHa = useMemo(() => {
    const val = parseFloat(landAreaInput);
    if (isNaN(val) || val <= 0) return 1.0;
    return convertToHectares(val, selectedUnit);
  }, [landAreaInput, selectedUnit]);

  // ─── Cultivation Cost per Ha ───────────────────────────────────────────────
  const cultivationCostPerHa = useMemo(() => {
    const val = parseFloat(cultivationCostInput);
    return !isNaN(val) && val >= 0 ? val : null;
  }, [cultivationCostInput]);

  // ─── Fetch Planner Data ────────────────────────────────────────────────────
  const fetchPlanner = useCallback(async (dist: string, ha: number, cost: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPlanner(dist, ha, cost);
      setPlannerData(res);
    } catch (err: any) {
      console.error('Failed to fetch planner:', err);
      setError(err?.message || 'Failed to load planner data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanner(district, areaHa, cultivationCostPerHa);
  }, [district, areaHa, cultivationCostPerHa, fetchPlanner]);

  // ─── Client Dynamic Re-computation with Custom Prices ──────────────────────
  const evaluatedCrops = useMemo(() => {
    if (!plannerData?.crops) return [];

    const computed = plannerData.crops.map((c) => {
      const isRice = c.is_rice_crop;
      const economicYield = isRice && c.paddy_equiv_yield_t_ha ? c.paddy_equiv_yield_t_ha : c.predicted_yield_t_ha;
      const prodTonnes = Number((economicYield * areaHa).toFixed(3));
      const prodKg = Number((prodTonnes * 1000).toFixed(1));

      // Check if price is customized
      let effectivePricePerKg = c.price_per_kg_bdt;
      let effectivePricePerMaund = c.price_per_maund_bdt;

      if (customPrices[c.crop] !== undefined) {
        if (c.crop === 'Jute') {
          effectivePricePerMaund = customPrices[c.crop];
          effectivePricePerKg = Number((effectivePricePerMaund / MAUND_TO_KG).toFixed(4));
        } else {
          effectivePricePerKg = customPrices[c.crop];
        }
      }

      const salesBDT = Math.round(prodKg * effectivePricePerKg);
      const salesPerHaBDT = areaHa > 0 ? Math.round(salesBDT / areaHa) : 0;

      let netReturnBDT: number | null = null;
      let netReturnPerHaBDT: number | null = null;
      let totalCostBDT: number | null = null;

      if (cultivationCostPerHa !== null) {
        totalCostBDT = Math.round(cultivationCostPerHa * areaHa);
        netReturnBDT = salesBDT - totalCostBDT;
        netReturnPerHaBDT = areaHa > 0 ? Math.round(netReturnBDT / areaHa) : 0;
      }

      return {
        ...c,
        area_ha: areaHa,
        field_production_tonnes: prodTonnes,
        field_production_kg: prodKg,
        price_per_kg_bdt: effectivePricePerKg,
        price_per_maund_bdt: effectivePricePerMaund,
        estimated_sales_bdt: salesBDT,
        estimated_sales_per_ha_bdt: salesPerHaBDT,
        total_cost_bdt: totalCostBDT,
        net_return_bdt: netReturnBDT,
        net_return_per_ha_bdt: netReturnPerHaBDT,
      };
    });

    // Re-rank by sales descending (or net return if cost entered)
    computed.sort((a, b) => {
      if (cultivationCostPerHa !== null && a.net_return_bdt !== null && b.net_return_bdt !== null) {
        return b.net_return_bdt - a.net_return_bdt;
      }
      return b.estimated_sales_bdt - a.estimated_sales_bdt;
    });

    return computed.map((item, idx) => ({
      ...item,
      planner_rank: idx + 1,
    }));
  }, [plannerData, areaHa, customPrices, cultivationCostPerHa]);

  // Filter by season
  const filteredCrops = useMemo(() => {
    if (selectedSeason === 'All') return evaluatedCrops;
    return evaluatedCrops.filter((c) => c.season === selectedSeason);
  }, [evaluatedCrops, selectedSeason]);

  // Top recommended crop
  const topCrop = evaluatedCrops[0] || null;

  // Highest physical yield crop
  const highestYieldCrop = useMemo(() => {
    if (!evaluatedCrops.length) return null;
    return [...evaluatedCrops].sort((a, b) => {
      const yA = a.paddy_equiv_yield_t_ha || a.predicted_yield_t_ha;
      const yB = b.paddy_equiv_yield_t_ha || b.predicted_yield_t_ha;
      return yB - yA;
    })[0];
  }, [evaluatedCrops]);

  // Min and max sales range
  const salesRange = useMemo(() => {
    if (!evaluatedCrops.length) return { min: 0, max: 0 };
    const sales = evaluatedCrops.map((c) => c.estimated_sales_bdt);
    return { min: Math.min(...sales), max: Math.max(...sales) };
  }, [evaluatedCrops]);

  // ─── Custom Price Change Handler ──────────────────────────────────────────
  const handlePriceChange = (crop: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    if (!isNaN(val) && val >= 0) {
      setCustomPrices((prev) => ({ ...prev, [crop]: val }));
    }
  };

  const resetPrices = () => {
    setCustomPrices({});
    setIsEditingPrices(false);
  };

  // ─── Land Unit Change with Value Conversion ───────────────────────────────
  const handleUnitChange = (newUnit: LandUnitKey) => {
    if (newUnit === selectedUnit) return;
    const currentVal = parseFloat(landAreaInput);
    if (!isNaN(currentVal) && currentVal > 0) {
      const ha = convertToHectares(currentVal, selectedUnit);
      const converted = convertFromHectares(ha, newUnit);
      setLandAreaInput(formatUnitValue(converted));
    }
    setSelectedUnit(newUnit);
  };

  // ─── Export CSV ───────────────────────────────────────────────────────────
  const exportPlannerCsv = () => {
    if (!evaluatedCrops.length) return;
    const headers = [
      'Rank',
      'Crop',
      'Season',
      'District',
      'Cultivated_Area_Ha',
      'EXP36_Predicted_Yield_t_ha',
      'Is_Rice_Crop',
      'BBS_Paddy_Equiv_Yield_t_ha',
      'Field_Production_Tonnes',
      'Field_Production_Kg',
      'Demo_Price_BDT_kg',
      'Estimated_Sales_Value_BDT',
      'Estimated_Sales_per_Ha_BDT',
      'Cultivation_Cost_BDT_ha',
      'Total_Cost_BDT',
      'Illustrative_Net_Return_BDT',
      'Price_Source_and_Date',
      'Disclaimer',
    ];

    const rows = evaluatedCrops.map((c) => [
      c.planner_rank,
      c.crop,
      c.display_season,
      district,
      c.area_ha.toFixed(3),
      c.predicted_yield_t_ha.toFixed(3),
      c.is_rice_crop ? 'YES' : 'NO',
      c.paddy_equiv_yield_t_ha ? c.paddy_equiv_yield_t_ha.toFixed(3) : 'N/A',
      c.field_production_tonnes.toFixed(3),
      c.field_production_kg.toFixed(1),
      c.price_per_kg_bdt.toFixed(2),
      c.estimated_sales_bdt,
      c.estimated_sales_per_ha_bdt,
      cultivationCostPerHa !== null ? cultivationCostPerHa : 'Not Entered',
      c.total_cost_bdt !== null ? c.total_cost_bdt : 'Not Entered',
      c.net_return_bdt !== null ? c.net_return_bdt : 'Not Entered',
      `"${c.price_source} (${c.price_ref_date})"`,
      '"Demo Prices — Not Actual Selling Prices. Educational planning only."',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smart_crop_planner_${district}_${areaHa.toFixed(2)}ha.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Chart Data ───────────────────────────────────────────────────────────
  const salesChartData = useMemo(() => {
    return evaluatedCrops.map((c) => ({
      crop: c.crop,
      season: c.season,
      sales: c.estimated_sales_bdt,
      cost: c.total_cost_bdt || 0,
      netReturn: c.net_return_bdt !== null ? c.net_return_bdt : 0,
      yieldTh: c.paddy_equiv_yield_t_ha || c.predicted_yield_t_ha,
      isRice: c.is_rice_crop,
    }));
  }, [evaluatedCrops]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Hero Header ───────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 md:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
          boxShadow: '0 10px 30px -10px rgba(6, 78, 59, 0.4)',
        }}
      >
        {/* Decorative background glow */}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #34d399 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1.5 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                EXP_38 Decision Support System
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-emerald-100 border border-white/15 backdrop-blur-sm">
                BBS Rice-to-Paddy Conversion Active (3/2)
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Smart Crop & Season Planner
            </h1>
            <p className="text-sm md:text-base text-emerald-100/90 mt-2 leading-relaxed">
              Compare all 6 verified EXP_36 forecast crops for any district in Bangladesh. Evaluate predicted
              yields, official BBS paddy-equivalent harvests, demonstration market pricing, and gross sales for
              your cultivated land.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowMethodologyModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all flex items-center gap-2 backdrop-blur-sm shadow-sm"
              title="View BBS Conversion & Pricing Details"
            >
              <Info className="w-4 h-4 text-emerald-200" />
              BBS & Price Methodology
            </button>
            <button
              onClick={exportPlannerCsv}
              disabled={loading || !evaluatedCrops.length}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Planner CSV
            </button>
          </div>
        </div>

        {/* ─── Prominent Disclaimers Banner ─────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-emerald-400/20 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-200 block mb-0.5">Demo Prices — Not Actual Selling Prices</strong>
              <span>
                All selling prices shown are historical demonstration references from Department of Agricultural Marketing (DAM) records. You can customize them below for your scenario.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-900/40 border border-emerald-400/30 text-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-200 block mb-0.5">BBS 2/3 Rice-to-Paddy Conversion Standard</strong>
              <span>
                EXP_36 rice forecasts represent husked-rice. Paddy quantities are calculated using official BBS statistical conversion:{' '}
                <code className="text-emerald-200 bg-emerald-950/60 px-1 py-0.5 rounded font-mono">Paddy = Rice × 3/2</code>.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Planner Configuration Card (Floating Controls) ───────────────── */}
      <div
        className="rounded-2xl p-5 md:p-6 border shadow-sm transition-all"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-[var(--color-neutral-900)]">
              Cultivation & Land Configuration
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {Object.keys(customPrices).length > 0 && (
              <button
                onClick={resetPrices}
                className="text-xs px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Custom Prices ({Object.keys(customPrices).length})
              </button>
            )}
            <button
              onClick={() => setIsEditingPrices(!isEditingPrices)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-neutral-800)] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingPrices ? 'Done Editing Prices' : 'Adjust Crop Prices'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. District Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Select District (জেলা)
            </label>
            <div className="relative">
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full h-11 pl-3.5 pr-9 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none cursor-pointer"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-neutral-900)',
                }}
              >
                <option value="All Bangladesh">All Bangladesh (National Average)</option>
                {districtsList.map((d) => (
                  <option key={d.id || d.name} value={d.name}>
                    {d.name} {d.name_bn ? `(${d.name_bn})` : ''} {d.division ? `— ${d.division}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] absolute right-3 top-3.5 pointer-events-none" />
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-600" />
              64 districts with verified EXP_36 predictions
            </p>
          </div>

          {/* 2. Land Area Input with Unit Dropdown */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Cultivated Land Area (জমির পরিমাণ)
            </label>
            <div className="flex items-center rounded-xl border overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 transition-all"
                 style={{ borderColor: 'var(--color-border)' }}>
              <input
                type="number"
                min="0.01"
                step="any"
                value={landAreaInput}
                onChange={(e) => setLandAreaInput(e.target.value)}
                className="w-full h-11 px-3.5 text-sm font-semibold focus:outline-none bg-transparent"
                style={{ color: 'var(--color-neutral-900)' }}
                placeholder="1.0"
              />
              <div className="h-6 w-[1px] bg-[var(--color-border)] shrink-0" />
              <div className="relative shrink-0">
                <select
                  value={selectedUnit}
                  onChange={(e) => handleUnitChange(e.target.value as LandUnitKey)}
                  className="h-11 pl-3 pr-8 text-xs font-semibold bg-transparent cursor-pointer focus:outline-none appearance-none"
                  style={{ color: 'var(--color-neutral-800)' }}
                >
                  {LAND_UNITS.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.shortLabel} ({u.bengali})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute right-2.5 top-4 pointer-events-none" />
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
              = <strong className="text-emerald-700 font-semibold">{areaHa.toFixed(3)} ha</strong>{' '}
              ({(convertFromHectares(areaHa, 'acre')).toFixed(2)} acres / {(convertFromHectares(areaHa, 'bigha')).toFixed(2)} bigha)
            </p>
          </div>

          {/* 3. Optional Cultivation Cost Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Cultivation Cost (ঐচ্ছিক খরচ)
              </label>
              <span className="text-[11px] text-emerald-700 font-medium">BDT / hectare</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={cultivationCostInput}
                onChange={(e) => setCultivationCostInput(e.target.value)}
                placeholder="e.g. 50000 (Optional)"
                className="w-full h-11 px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-neutral-900)',
                }}
              />
              {cultivationCostInput && (
                <button
                  onClick={() => setCultivationCostInput('')}
                  className="absolute right-3 top-3.5 text-[var(--color-text-muted)] hover:text-red-500"
                  title="Clear cost"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] text-[var(--color-text-muted)]">Presets:</span>
              <button
                type="button"
                onClick={() => setCultivationCostInput('35000')}
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              >
                Low (35k)
              </button>
              <button
                type="button"
                onClick={() => setCultivationCostInput('50000')}
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              >
                Avg (50k)
              </button>
              <button
                type="button"
                onClick={() => setCultivationCostInput('75000')}
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              >
                High (75k)
              </button>
            </div>
          </div>
        </div>

        {/* ─── Inline Price Customization Panel (Accordion) ───────────────── */}
        {isEditingPrices && (
          <div className="mt-5 pt-4 border-t border-[var(--color-border)] bg-amber-50/50 -mx-5 -mb-5 p-5 rounded-b-2xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                  Customize Selling Prices for Simulation (বাজার মূল্য পরিবর্তন)
                </h3>
                <p className="text-xs text-amber-700">
                  Adjust selling prices to simulate local market conditions. Changes re-calculate and re-rank crops instantaneously.
                </p>
              </div>
              <button
                onClick={resetPrices}
                className="text-xs text-amber-800 underline hover:text-amber-950 font-medium"
              >
                Reset to default DAM prices
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {['Boro Rice', 'Aman Rice', 'Aus Rice', 'Wheat', 'Potato', 'Jute'].map((cropName) => {
                const defaultDef = DEFAULT_DEMO_PRICES[cropName];
                const currentPrice =
                  customPrices[cropName] !== undefined
                    ? customPrices[cropName]
                    : defaultDef?.price || 0;

                return (
                  <div key={cropName} className="p-2.5 rounded-xl bg-white border border-amber-200 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-neutral-800 truncate">{cropName}</span>
                      <span className="text-xs">{CROP_ICONS[cropName]}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-neutral-500 font-semibold">৳</span>
                      <input
                        type="number"
                        step={cropName === 'Jute' ? '50' : '0.5'}
                        value={currentPrice}
                        onChange={(e) => handlePriceChange(cropName, e.target.value)}
                        className="w-full text-xs font-bold px-1.5 py-1 rounded border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-amber-500 text-neutral-900"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-500 block mt-1 truncate">
                      {defaultDef?.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Highlights Summary KPIs (4 Cards) ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Top Recommended Crop */}
        <div
          className="rounded-2xl p-4.5 border relative overflow-hidden transition-all shadow-xs"
          style={{
            background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)',
            borderColor: 'rgba(5, 150, 105, 0.3)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                #1 Recommended Crop
              </span>
              <h3 className="text-xl font-extrabold text-[var(--color-neutral-900)] mt-1 flex items-center gap-1.5">
                <span>{topCrop?.crop || '—'}</span>
                <span className="text-lg">{topCrop ? CROP_ICONS[topCrop.crop] : ''}</span>
              </h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-600 text-white shadow-2xs">
              Rank 1
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-emerald-200/50 flex items-baseline justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">
              {cultivationCostPerHa !== null ? 'Est. Net Return' : 'Est. Gross Sales'}:
            </span>
            <span className="text-base font-extrabold text-emerald-700">
              {topCrop
                ? formatBDT(cultivationCostPerHa !== null && topCrop.net_return_bdt !== null ? topCrop.net_return_bdt : topCrop.estimated_sales_bdt)
                : '—'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-800/80 mt-1">
            {topCrop?.display_season || ''} • {topCrop ? (topCrop.paddy_equiv_yield_t_ha || topCrop.predicted_yield_t_ha).toFixed(2) : 0} t/ha
          </p>
        </div>

        {/* Card 2: Highest Physical Harvest Volume */}
        <div className="card p-4.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Highest Physical Yield
              </span>
              <h3 className="text-xl font-extrabold text-[var(--color-neutral-900)] mt-1 flex items-center gap-1.5">
                <span>{highestYieldCrop?.crop || '—'}</span>
                <span className="text-lg">{highestYieldCrop ? CROP_ICONS[highestYieldCrop.crop] : ''}</span>
              </h3>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wheat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-baseline justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Harvest volume:</span>
            <span className="text-base font-extrabold text-[var(--color-neutral-900)]">
              {highestYieldCrop?.field_production_tonnes.toFixed(2) || '0'} <span className="text-xs font-normal">tonnes</span>
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Yield rate: {highestYieldCrop ? (highestYieldCrop.paddy_equiv_yield_t_ha || highestYieldCrop.predicted_yield_t_ha).toFixed(2) : 0} t/ha
          </p>
        </div>

        {/* Card 3: Gross Sales Range */}
        <div className="card p-4.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Gross Sales Potential
              </span>
              <h3 className="text-xl font-extrabold text-[var(--color-neutral-900)] mt-1">
                {formatLakh(salesRange.max)}
              </h3>
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-baseline justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Range across crops:</span>
            <span className="text-xs font-bold text-[var(--color-neutral-800)]">
              {formatLakh(salesRange.min)} – {formatLakh(salesRange.max)}
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            For {areaHa.toFixed(2)} ha in {district}
          </p>
        </div>

        {/* Card 4: Cultivated Land Equivalent */}
        <div className="card p-4.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Land Area Selected
              </span>
              <h3 className="text-xl font-extrabold text-[var(--color-neutral-900)] mt-1">
                {landAreaInput} <span className="text-xs font-medium text-[var(--color-text-muted)]">{LAND_UNITS_MAP[selectedUnit]?.shortLabel}</span>
              </h3>
            </div>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-baseline justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Metric equivalent:</span>
            <span className="text-sm font-bold text-emerald-700">
              {areaHa.toFixed(3)} ha
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            {(areaHa * 10_000).toLocaleString()} m² • {(convertFromHectares(areaHa, 'bigha')).toFixed(1)} bigha
          </p>
        </div>
      </div>

      {/* ─── Season Filter & View Mode Controls ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Season Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] overflow-x-auto">
          {[
            { id: 'All', label: 'All Crops (6)' },
            { id: 'Rabi', label: 'Rabi (Boro, Wheat, Potato)' },
            { id: 'Kharif-I', label: 'Kharif-I (Aus, Jute)' },
            { id: 'Kharif-II', label: 'Kharif-II (Aman)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedSeason(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedSeason === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-[var(--color-neutral-700)] hover:text-emerald-700 hover:bg-white/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'cards'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-[var(--color-neutral-700)] hover:text-emerald-700'
            }`}
          >
            Decision Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-[var(--color-neutral-700)] hover:text-emerald-700'
            }`}
          >
            Detailed Table
          </button>
          <button
            onClick={() => setViewMode('charts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'charts'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-[var(--color-neutral-700)] hover:text-emerald-700'
            }`}
          >
            Comparative Charts
          </button>
        </div>
      </div>

      {/* ─── Loading / Error State ─────────────────────────────────────────── */}
      {loading && (
        <div className="card p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-[var(--color-neutral-800)]">
            Loading verified EXP_36 forecasts and economic model for {district}...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="card p-6 border-red-200 bg-red-50 text-red-800 text-center flex flex-col items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => fetchPlanner(district, areaHa, cultivationCostPerHa)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors mt-2"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ─── MAIN VIEW 1: Cards View ───────────────────────────────────────── */}
      {!loading && !error && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCrops.map((c) => {
            const isTop = c.planner_rank === 1;
            const seasonBadge = SEASON_BADGES[c.season] || SEASON_BADGES['Rabi'];
            const cropColor = CROP_COLORS[c.crop] || '#059669';

            return (
              <div
                key={c.crop}
                className={`rounded-2xl border p-5 transition-all flex flex-col justify-between relative shadow-xs hover:shadow-md ${
                  isTop ? 'ring-2 ring-emerald-500/50' : ''
                }`}
                style={{
                  background: 'var(--color-surface)',
                  borderColor: isTop ? 'rgba(5, 150, 105, 0.4)' : 'var(--color-border)',
                }}
              >
                {/* Top Badge for #1 */}
                {isTop && (
                  <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-200" />
                    Top Recommendation
                  </div>
                )}

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{CROP_ICONS[c.crop]}</span>
                        <h3 className="text-lg font-bold text-[var(--color-neutral-900)]">
                          {c.crop}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                          style={{ background: seasonBadge.bg, color: seasonBadge.text }}
                        >
                          {c.display_season}
                        </span>
                        {c.is_rice_crop && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            BBS Paddy 1.5x
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0"
                         style={{ background: isTop ? '#059669' : 'var(--color-surface-hover)', color: isTop ? '#fff' : 'var(--color-neutral-700)' }}>
                      #{c.planner_rank}
                    </div>
                  </div>

                  {/* Yield & Harvest Metrics */}
                  <div className="p-3.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-2 mb-4">
                    {/* EXP_36 Yield */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-text-muted)]">
                        {c.is_rice_crop ? 'EXP_36 Rice Forecast:' : 'Predicted Yield:'}
                      </span>
                      <span className="font-semibold text-[var(--color-neutral-900)]">
                        {c.predicted_yield_t_ha.toFixed(3)} t/ha
                      </span>
                    </div>

                    {/* BBS Paddy Yield for Rice */}
                    {c.is_rice_crop && c.paddy_equiv_yield_t_ha && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--color-border)]">
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          🌾 BBS Paddy-Equivalent:
                        </span>
                        <span className="font-extrabold text-emerald-800 text-sm">
                          {c.paddy_equiv_yield_t_ha.toFixed(3)} t/ha
                        </span>
                      </div>
                    )}

                    {/* Estimated Total Harvest */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--color-border)]">
                      <span className="text-[var(--color-text-muted)]">
                        Harvest ({areaHa.toFixed(2)} ha):
                      </span>
                      <span className="font-bold text-[var(--color-neutral-900)]">
                        {c.field_production_tonnes.toFixed(2)} tonnes{' '}
                        <span className="text-[11px] font-normal text-[var(--color-text-muted)]">
                          ({c.field_production_kg.toLocaleString()} kg
                          {c.crop === 'Jute' && c.field_production_maunds
                            ? ` / ${c.field_production_maunds.toFixed(1)} maunds`
                            : ''}
                          )
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Pricing Row */}
                  <div className="flex items-center justify-between text-xs mb-3 px-1">
                    <span className="text-[var(--color-text-muted)] flex items-center gap-1">
                      Selling Price:
                      <span className="text-[10px] px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Demo
                      </span>
                    </span>
                    <span className="font-bold text-[var(--color-neutral-900)]">
                      ৳ {c.price_per_kg_bdt.toFixed(2)} / kg
                      {c.crop === 'Jute' && c.price_per_maund_bdt && (
                        <span className="text-[11px] font-normal text-[var(--color-text-muted)] ml-1">
                          (৳ {c.price_per_maund_bdt.toLocaleString()}/md)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Financial Gross / Net Card */}
                  <div
                    className="p-3.5 rounded-xl border mb-3"
                    style={{
                      background: isTop ? 'rgba(5, 150, 105, 0.06)' : 'var(--color-surface)',
                      borderColor: isTop ? 'rgba(5, 150, 105, 0.25)' : 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                        Estimated Sales Value:
                      </span>
                      <span className="text-lg font-extrabold text-emerald-700">
                        {formatBDT(c.estimated_sales_bdt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>Per Hectare:</span>
                      <span className="font-semibold text-[var(--color-neutral-800)]">
                        {formatBDT(c.estimated_sales_per_ha_bdt)} / ha
                      </span>
                    </div>

                    {/* Net Return if Cost Provided */}
                    {cultivationCostPerHa !== null && c.net_return_bdt !== null && (
                      <div className="mt-2.5 pt-2 border-t border-[var(--color-border)]">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-bold text-[var(--color-neutral-900)]">
                            Illustrative Net Return:
                          </span>
                          <span
                            className={`text-base font-extrabold ${
                              c.net_return_bdt >= 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {formatBDT(c.net_return_bdt)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          After subtracting ৳ {cultivationCostPerHa.toLocaleString()} / ha cultivation expense.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Suitability & Agronomics */}
                  <div className="text-xs text-[var(--color-text-muted)] leading-relaxed space-y-1 mb-2">
                    <p className="line-clamp-2" title={c.suitability_note}>
                      <strong className="text-[var(--color-neutral-800)] font-semibold">Suitability: </strong>
                      {c.suitability_note}
                    </p>
                    {c.recent_avg_yield_t_ha && (
                      <p className="text-[11px]">
                        Historical 3-yr avg: <strong>{c.recent_avg_yield_t_ha.toFixed(2)} t/ha</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer Badges */}
                <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                  <span>Model MAE: ±{c.crop_mae_t_ha?.toFixed(2) || '0.21'} t/ha</span>
                  {c.zero_area && (
                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Zero Area District
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MAIN VIEW 2: Detailed Table ───────────────────────────────────── */}
      {!loading && !error && viewMode === 'table' && (
        <div className="card overflow-hidden border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-[var(--color-neutral-800)] font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Crop & Season</th>
                  <th className="py-3 px-4">EXP_36 Yield</th>
                  <th className="py-3 px-4">BBS Paddy Yield</th>
                  <th className="py-3 px-4">Harvest Volume</th>
                  <th className="py-3 px-4">Demo Price</th>
                  <th className="py-3 px-4 text-right">Est. Gross Sales</th>
                  {cultivationCostPerHa !== null && (
                    <th className="py-3 px-4 text-right">Illustrative Net Return</th>
                  )}
                  <th className="py-3 px-4">Suitability Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredCrops.map((c) => (
                  <tr
                    key={c.crop}
                    className={`hover:bg-[var(--color-surface-hover)] transition-colors ${
                      c.planner_rank === 1 ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                        c.planner_rank === 1 ? 'bg-emerald-600 text-white font-extrabold' : 'bg-neutral-100 text-neutral-700'
                      }`}>
                        {c.planner_rank}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[var(--color-neutral-900)] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{CROP_ICONS[c.crop]}</span>
                        <div>
                          <div>{c.crop}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)] font-normal">{c.display_season}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold">{c.predicted_yield_t_ha.toFixed(3)}</span> t/ha
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {c.is_rice_crop && c.paddy_equiv_yield_t_ha ? (
                        <span className="font-bold text-emerald-700">
                          {c.paddy_equiv_yield_t_ha.toFixed(3)} t/ha
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <strong>{c.field_production_tonnes.toFixed(2)}</strong> t{' '}
                      <span className="text-[10px] text-[var(--color-text-muted)]">({c.field_production_kg.toLocaleString()} kg)</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      ৳ {c.price_per_kg_bdt.toFixed(2)}/kg
                      {c.crop === 'Jute' && c.price_per_maund_bdt && (
                        <div className="text-[10px] text-[var(--color-text-muted)]">৳ {c.price_per_maund_bdt}/md</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-extrabold text-emerald-700 text-sm">
                      {formatBDT(c.estimated_sales_bdt)}
                    </td>
                    {cultivationCostPerHa !== null && (
                      <td className={`py-3 px-4 text-right whitespace-nowrap font-extrabold text-sm ${
                        (c.net_return_bdt ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {c.net_return_bdt !== null ? formatBDT(c.net_return_bdt) : '—'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-xs text-[var(--color-text-muted)] max-w-xs truncate" title={c.suitability_note}>
                      {c.suitability_note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MAIN VIEW 3: Comparative Charts ───────────────────────────────── */}
      {!loading && !error && viewMode === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Sales / Economics Comparison */}
          <div className="card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-[var(--color-neutral-900)] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Estimated Sales Value by Crop (৳ BDT)
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Gross sales for {areaHa.toFixed(2)} hectares in {district} using demo reference prices
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} margin={{ top: 10, right: 20, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="crop"
                    tick={{ fill: 'var(--color-neutral-700)', fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-neutral-700)', fontSize: 11 }}
                    tickFormatter={(v) => `৳ ${(v / 100000).toFixed(1)}L`}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [
                      formatBDT(Number(val)),
                      name === 'sales' ? 'Gross Sales' : 'Net Return',
                    ]}
                    labelFormatter={(label) => `Crop: ${label}`}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="sales" name="Gross Sales" radius={[6, 6, 0, 0]}>
                    {salesChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CROP_COLORS[entry.crop] || '#059669'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Predicted Yield Comparison */}
          <div className="card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-[var(--color-neutral-900)] flex items-center gap-2">
                <Wheat className="w-4 h-4 text-amber-600" />
                Yield Comparison: EXP_36 vs BBS Paddy-Equiv (t/ha)
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Physical crop output rate in tonnes per hectare (Paddy = Rice × 1.5)
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="crop"
                    tick={{ fill: 'var(--color-neutral-700)', fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-neutral-700)', fontSize: 11 }}
                    tickFormatter={(v) => `${v.toFixed(1)} t/ha`}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: any, item: any) => [
                      `${Number(val).toFixed(3)} t/ha ${item.payload.isRice ? '(BBS Paddy)' : ''}`,
                      'Yield Rate',
                    ]}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="yieldTh" name="Yield (t/ha)" fill="#059669" radius={[6, 6, 0, 0]}>
                    {salesChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isRice ? '#059669' : '#d97706'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── BBS Conversion & Lineage Details Accordion ─────────────────────── */}
      <div className="card p-6 border shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-[var(--color-neutral-900)]">
            How This Decision Support System Calculates Forecasts & Economics
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Card 1: Random Forest Lineage */}
          <div className="p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-1.5">
            <h4 className="font-bold text-[var(--color-neutral-900)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              1. Verified EXP_36 Forecasts
            </h4>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              Every crop yield prediction is directly retrieved from the validated EXP_36 Random Forest ensemble models. No models are retrained, modified, or altered.
            </p>
          </div>

          {/* Card 2: BBS Rice-to-Paddy Conversion */}
          <div className="p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-1.5">
            <h4 className="font-bold text-[var(--color-neutral-900)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              2. BBS Rice-to-Paddy Conversion (3/2)
            </h4>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              EXP_36 rice data represents clean/husked rice output. Because farmers sell rough paddy, official BBS statistical conversion is applied:
              <span className="block font-mono font-bold text-emerald-800 mt-1 bg-white p-1 rounded border border-emerald-200">
                Paddy-equiv = Rice × 3/2 = 1.5x
              </span>
            </p>
          </div>

          {/* Card 3: DAM Demo Prices */}
          <div className="p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-1.5">
            <h4 className="font-bold text-[var(--color-neutral-900)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              3. Demonstration Selling Prices
            </h4>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              Selling prices are historical wholesale reference benchmarks from Department of Agricultural Marketing (DAM) records. You can customize prices to test market scenarios.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Methodology Modal ──────────────────────────────────────────────── */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl border space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-[var(--color-neutral-900)]">
                  Data Lineage & BBS Statistical Methodology
                </h3>
              </div>
              <button
                onClick={() => setShowMethodologyModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-[var(--color-neutral-800)] leading-relaxed">
              <div>
                <h4 className="font-bold text-sm text-[var(--color-neutral-900)] mb-1">
                  1. The Rice-to-Paddy Conversion Factor
                </h4>
                <p>
                  In the BBS agricultural statistics framework (Chapter 1: <em>Sample Crop Cutting Method of Rice</em>),
                  all official rice production figures are reported in terms of clean/husked rice:
                </p>
                <div className="p-3 my-2 rounded-xl bg-emerald-50 border border-emerald-200 font-mono text-emerald-900">
                  Clean Rice = Paddy × 2/3 (0.6667)
                  <br />
                  <strong>Therefore: Paddy = Clean Rice × 3/2 (1.5000)</strong>
                </div>
                <p>
                  Official Citation: <em>Bangladesh Bureau of Statistics (BBS), Yearbook of Agricultural Statistics 2016, Chapter 1.</em>
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[var(--color-neutral-900)] mb-1">
                  2. Demonstration Reference Prices & Sources
                </h4>
                <div className="border border-[var(--color-border)] rounded-xl overflow-hidden my-2">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--color-surface-hover)] font-bold">
                      <tr>
                        <th className="p-2">Crop</th>
                        <th className="p-2">Demo Price</th>
                        <th className="p-2">Reference Source & Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      <tr>
                        <td className="p-2 font-semibold">Boro Rice</td>
                        <td className="p-2">৳ 36.00 / kg</td>
                        <td className="p-2 text-[var(--color-text-muted)]">DAM Wholesale Paddy Reference (May 5, 2026)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold">Aman Rice</td>
                        <td className="p-2">৳ 34.00 / kg</td>
                        <td className="p-2 text-[var(--color-text-muted)]">DAM Wholesale Paddy Reference (Nov 9, 2025)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold">Aus Rice</td>
                        <td className="p-2">৳ 32.00 / kg</td>
                        <td className="p-2 text-[var(--color-text-muted)]">DAM Wholesale Paddy Approx (July 2026)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold">Wheat</td>
                        <td className="p-2">৳ 36.00 / kg</td>
                        <td className="p-2 text-[var(--color-text-muted)]">DAM Wholesale Wheat Reference (April 2026)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold">Potato</td>
                        <td className="p-2">৳ 22.00 / kg</td>
                        <td className="p-2 text-[var(--color-text-muted)]">DAM Wholesale Potato Reference (2025-2026)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold">Jute</td>
                        <td className="p-2">৳ 3,862.50 / md</td>
                        <td className="p-2 text-[var(--color-text-muted)]">DAM Wholesale Raw Jute (1 maund = 37.3242 kg, Oct 2026)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[var(--color-neutral-900)] mb-1">
                  3. Gross Sales vs. Illustrative Net Return
                </h4>
                <p>
                  <strong>Estimated Sales Value</strong> is the gross financial output before deducting input expenses (seed, fertilizer, diesel, irrigation, labor).
                  When a cultivation cost is supplied by the user, the system calculates <strong>Illustrative Net Return</strong>:
                </p>
                <div className="p-2 my-1.5 rounded-lg bg-neutral-100 font-mono">
                  Illustrative Net Return = Estimated Sales Value − Total Cultivation Cost
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[var(--color-border)]">
              <button
                onClick={() => setShowMethodologyModal(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                Close Methodology
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
