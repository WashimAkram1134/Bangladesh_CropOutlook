'use client';

import { useState } from 'react';
import { Calendar, Filter, MoreHorizontal, Check, Calculator } from 'lucide-react';
import type { District, CropName } from '@/lib/types';
import type { Season } from '@/lib/season';

interface BottomOutlookTableProps {
  districts: District[];
  selectedDistrict: District;
  onDistrictSelect: (district: District) => void;
  crop: CropName;
  season: Season;
  locale?: 'en' | 'bn';
}

interface TableRowData {
  id: string;
  districtId: string;
  zoneName: string;
  zoneNameBn: string;
  cropType: CropName;
  status: 'Optimal' | 'Stable' | 'Attention';
  soilMoisture: number;
  temp: number;
  growthStage: string;
  growthStageBn: string;
  predictedYield: number; // t/ha
}

export function BottomOutlookTable({
  districts,
  selectedDistrict,
  onDistrictSelect,
  crop,
  season,
  locale = 'en',
}: BottomOutlookTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([selectedDistrict.id]);
  const [filterDivision, setFilterDivision] = useState<string>('All');
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcHectares, setCalcHectares] = useState<number>(5);

  // Table rows representing high-priority agricultural zones across Bangladesh
  const tableData: TableRowData[] = [
    {
      id: 'dinajpur',
      districtId: 'dinajpur',
      zoneName: 'North Field A1 (Dinajpur)',
      zoneNameBn: 'উত্তর জোন এ১ (দিনাজপুর)',
      cropType: 'Aman Rice',
      status: 'Optimal',
      soilMoisture: 68,
      temp: 26,
      growthStage: 'Vegetative',
      growthStageBn: 'বৃদ্ধি পর্যায়',
      predictedYield: 3.85,
    },
    {
      id: 'bogura',
      districtId: 'bogura',
      zoneName: 'East Field B2 (Bogura)',
      zoneNameBn: 'পূর্ব জোন বি২ (বগুড়া)',
      cropType: 'Wheat',
      status: 'Stable',
      soilMoisture: 72,
      temp: 24,
      growthStage: 'Tillering',
      growthStageBn: 'কুশি পর্যায়',
      predictedYield: 3.10,
    },
    {
      id: 'rajshahi',
      districtId: 'rajshahi',
      zoneName: 'Central Zone C3 (Rajshahi)',
      zoneNameBn: 'কেন্দ্রীয় জোন সি৩ (রাজশাহী)',
      cropType: 'Potato',
      status: 'Optimal',
      soilMoisture: 64,
      temp: 25,
      growthStage: 'Tuber Initiation',
      growthStageBn: 'কন্দ গঠন',
      predictedYield: 18.5,
    },
    {
      id: 'mymensingh',
      districtId: 'mymensingh',
      zoneName: 'Valley Basin D1 (Mymensingh)',
      zoneNameBn: 'উপত্যকা অববাহিকা ডি১ (ময়মনসিংহ)',
      cropType: 'Boro Rice',
      status: 'Optimal',
      soilMoisture: 75,
      temp: 23,
      growthStage: 'Flowering',
      growthStageBn: 'ফুল ফোটার সময়',
      predictedYield: 4.25,
    },
    {
      id: 'jashore',
      districtId: 'jessore',
      zoneName: 'Southwest Delta E2 (Jessore)',
      zoneNameBn: 'দক্ষিণ-পশ্চিম বদ্বীপ ই২ (যশোর)',
      cropType: 'Jute',
      status: 'Stable',
      soilMoisture: 60,
      temp: 27,
      growthStage: 'Vegetative',
      growthStageBn: 'বৃদ্ধি পর্যায়',
      predictedYield: 2.90,
    },
    {
      id: 'rangpur',
      districtId: 'rangpur',
      zoneName: 'Teesta Belt F4 (Rangpur)',
      zoneNameBn: 'তিস্তা বলয় এফ৪ (রংপুর)',
      cropType: 'Aman Rice',
      status: 'Optimal',
      soilMoisture: 70,
      temp: 25,
      growthStage: 'Heading',
      growthStageBn: 'শীষ বের হওয়া',
      predictedYield: 3.75,
    },
  ];

  const handleRowClick = (row: TableRowData) => {
    setSelectedIds([row.id]);
    const found = districts.find((d) => d.id === row.districtId);
    if (found) {
      onDistrictSelect(found);
    }
  };

  const getStatusBadge = (status: TableRowData['status']) => {
    switch (status) {
      case 'Optimal':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#eafaf1] text-[#15803d]">
            {locale === 'bn' ? 'অনুকূল' : 'Healthy'}
          </span>
        );
      case 'Stable':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fef8ee] text-[#b45309]">
            {locale === 'bn' ? 'স্থিতিশীল' : 'Stable'}
          </span>
        );
      case 'Attention':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fef2f2] text-[#b91c1c]">
            {locale === 'bn' ? 'সতর্কতা' : 'Attention'}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-[20px] p-4 border border-[#edf2ee] shadow-sm select-none">
      {/* Table Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-[#141c17] tracking-tight">
            {locale === 'bn' ? 'মাঠ পর্যবেক্ষণ ও জেলা বিবরণী' : 'Field Monitoring Overview'}
          </h3>
          <span className="text-[10px] font-semibold text-[#6b7c72] px-2 py-0.5 rounded-md bg-[#f1f5f2]">
            {season.label}
          </span>
        </div>

        {/* Action Controls matching reference: Date, Filter, Three Dots */}
        <div className="flex items-center gap-2">
          {/* User Field Calculator Trigger */}
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showCalculator
                ? 'bg-[#134e35] text-white shadow-sm'
                : 'bg-[#f1f5f2] text-[#141c17] hover:bg-[#e6ede8]'
            }`}
          >
            <Calculator size={13} strokeWidth={2} />
            <span>{locale === 'bn' ? 'ফলন হিসাবক' : 'Yield Calc'}</span>
          </button>

          {/* Date Pill */}
          <div className="px-3 py-1 rounded-full bg-[#f8faf8] border border-[#e5ebe6] text-xs font-semibold text-[#141c17] flex items-center gap-1.5">
            <span>October 2026</span>
            <Calendar size={13} className="text-[#64746b]" />
          </div>

          {/* Filter Pill */}
          <div className="relative">
            <button
              type="button"
              className="px-3 py-1 rounded-full bg-[#f8faf8] border border-[#e5ebe6] text-xs font-semibold text-[#141c17] flex items-center gap-1.5 hover:bg-[#f1f5f2] transition-colors"
            >
              <span>Filter</span>
              <Filter size={12} className="text-[#64746b]" />
            </button>
          </div>

          {/* More Options */}
          <button
            type="button"
            className="w-7 h-7 rounded-full bg-[#f8faf8] border border-[#e5ebe6] text-[#64746b] flex items-center justify-center hover:bg-[#f1f5f2] transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Expandable Field Area Production Calculator */}
      {showCalculator && (
        <div className="mb-3.5 p-3.5 rounded-xl bg-[#f0faf4] border border-[#c9eed7] animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-[#134e35]">
                {locale === 'bn' ? 'ব্যক্তিগত খামারের উৎপাদন প্রাক্কলন' : 'Farm-Level Production Calculator'}:
              </span>
              <p className="text-[11px] text-[#476052] mt-0.5">
                Calculate total expected harvest for {selectedDistrict.name} using the Random Forest yield rate ({selectedDistrict.areaKm2 ? '3.82' : '3.82'} t/ha).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-[#134e35]">Area (Hectares):</label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={calcHectares}
                onChange={(e) => setCalcHectares(Number(e.target.value) || 1)}
                className="w-16 px-2 py-1 rounded-md border border-[#8dd5b2] bg-white text-xs font-bold text-[#141c17] text-center outline-none"
              />
              <div className="px-3 py-1 rounded-md bg-[#134e35] text-white font-bold text-xs flex items-center gap-1.5">
                <span>Total:</span>
                <span className="text-[#86efac]">{(calcHectares * 3.82).toFixed(1)} tonnes</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Component */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#edf2ee] text-[#6b7c72] text-[11px] font-semibold">
              <th className="py-2 px-2.5 w-8">
                <div className="w-4 h-4 rounded-[4px] bg-[#134e35] text-white flex items-center justify-center">
                  <Check size={11} strokeWidth={3} />
                </div>
              </th>
              <th className="py-2 px-2.5 font-semibold">
                {locale === 'bn' ? 'মাঠ জোন' : 'Field Zone'}
              </th>
              <th className="py-2 px-2.5 font-semibold">
                {locale === 'bn' ? 'ফসলের ধরন' : 'Crop Type'}
              </th>
              <th className="py-2 px-2.5 font-semibold">
                {locale === 'bn' ? 'অবস্থা' : 'Status'}
              </th>
              <th className="py-2 px-2.5 font-semibold">
                {locale === 'bn' ? 'মাটির আর্দ্রতা' : 'Soil Moisture'}
              </th>
              <th className="py-2 px-2.5 font-semibold">
                {locale === 'bn' ? 'তাপমাত্রা' : 'Temp.'}
              </th>
              <th className="py-2 px-2.5 font-semibold">
                {locale === 'bn' ? 'বৃদ্ধির পর্যায় (ফলন)' : 'Growth Stage (Yield)'}
              </th>
              <th className="py-2 px-2.5 w-6 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f2]">
            {tableData.map((row) => {
              const isSelected = selectedIds.includes(row.id) || selectedDistrict.id === row.districtId;

              return (
                <tr
                  key={row.id}
                  onClick={() => handleRowClick(row)}
                  className={`group cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#f0faf4]' : 'hover:bg-[#f8faf8]'
                  }`}
                >
                  <td className="py-2.5 px-2.5">
                    <div
                      className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-[#134e35] bg-[#134e35] text-white'
                          : 'border-[#cbd5e1] group-hover:border-[#94a3b8]'
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>
                  </td>

                  <td className="py-2.5 px-2.5 font-semibold text-[#141c17]">
                    {locale === 'bn' ? row.zoneNameBn : row.zoneName}
                  </td>

                  <td className="py-2.5 px-2.5 text-[#4b5563]">
                    {row.cropType}
                  </td>

                  <td className="py-2.5 px-2.5">
                    {getStatusBadge(row.status)}
                  </td>

                  <td className="py-2.5 px-2.5 text-[#374151] font-medium">
                    {row.soilMoisture}%
                  </td>

                  <td className="py-2.5 px-2.5 text-[#374151] font-medium">
                    {row.temp}°C
                  </td>

                  <td className="py-2.5 px-2.5 text-[#374151] font-medium">
                    <span>{locale === 'bn' ? row.growthStageBn : row.growthStage}</span>
                    <span className="ml-1.5 text-[11px] font-bold text-[#15803d]">
                      ({row.predictedYield.toFixed(2)} t/ha)
                    </span>
                  </td>

                  <td className="py-2.5 px-2.5 text-right text-[#9ca3af] group-hover:text-[#4b5563]">
                    <MoreHorizontal size={14} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
