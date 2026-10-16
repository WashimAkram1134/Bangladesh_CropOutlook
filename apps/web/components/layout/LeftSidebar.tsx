'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Sprout,
  BarChart3,
  FileText,
  TrendingUp,
  Droplets,
  Compass,
  Settings,
  Info,
  Moon,
  ArrowLeft,
  Lock,
} from 'lucide-react';

interface LeftSidebarProps {
  onLanguageToggle?: () => void;
  locale?: 'en' | 'bn';
}

export function LeftSidebar({ onLanguageToggle, locale = 'en' }: LeftSidebarProps) {
  const pathname = usePathname();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const mainNavItems = [
    {
      id: 'dashboard',
      href: '/',
      label: 'Dashboard',
      labelBn: 'ড্যাশবোর্ড',
      icon: LayoutGrid,
      isActive: pathname === '/',
      isFuture: false,
    },
    {
      id: 'district-explorer',
      href: '/district-explorer',
      label: 'District Explorer',
      labelBn: 'জেলা অন্বেষক',
      icon: Sprout,
      isActive: pathname.startsWith('/district-explorer'),
      isFuture: false,
    },
    {
      id: 'forecast-comparison',
      href: '/forecast-comparison',
      label: 'Forecast Comparison',
      labelBn: 'পূর্বাভাস তুলনা',
      icon: BarChart3,
      isActive: pathname.startsWith('/forecast-comparison'),
      isFuture: false,
    },
    {
      id: 'methodology',
      href: '/methodology',
      label: 'Data & Methodology',
      labelBn: 'তথ্য ও পদ্ধতি',
      icon: FileText,
      isActive: pathname.startsWith('/methodology'),
      isFuture: false,
    },
  ];

  const futureNavItems = [
    {
      id: 'price-outlook',
      label: 'Price Outlook',
      labelBn: 'মূল্য পূর্বাভাস',
      icon: TrendingUp,
      isFuture: true,
      tag: 'Coming Soon',
    },
    {
      id: 'water-requirement',
      label: 'Water Requirement',
      labelBn: 'সেচ ও পানি চাহিদা',
      icon: Droplets,
      isFuture: true,
      tag: 'Coming Soon',
    },
    {
      id: 'recommendations',
      label: 'Agricultural Recommendations',
      labelBn: 'কৃষি সুপারিশমালা',
      icon: Compass,
      isFuture: true,
      tag: 'Coming Soon',
    },
  ];

  return (
    <aside
      className="w-16 md:w-[72px] shrink-0 self-stretch bg-white flex flex-col items-center py-5 border-r border-[#edf2ee] select-none z-30"
    >
      {/* Brand Monogram Logo */}
      <Link
        href="/"
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 group transition-transform hover:scale-105"
        title="Bangladesh Crop Outlook"
      >
        <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="10" fill="#f0faf4" />
          {/* Leaf / Monogram shape matching reference logo */}
          <path
            d="M10 24L18 8L26 24L18 20L10 24Z"
            fill="#155338"
          />
          <path
            d="M18 8L24 19L18 20L18 8Z"
            fill="#22c55e"
          />
          <circle cx="18" cy="18" r="2.5" fill="#ffffff" />
        </svg>
      </Link>

      {/* Main Navigation Items */}
      <nav className="flex flex-col items-center gap-2.5 w-full px-2">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isCurrent = item.isActive;

          return (
            <div key={item.id} className="relative group w-full flex justify-center">
              <Link
                href={item.href}
                className={`w-11 h-11 rounded-[14px] flex items-center justify-center transition-all duration-200 ${
                  isCurrent
                    ? 'bg-[#134e35] text-[#4ade80] shadow-sm shadow-[#134e35]/30'
                    : 'text-[#758a7e] hover:text-[#134e35] hover:bg-[#f2f7f3]'
                }`}
                title={locale === 'bn' ? item.labelBn : item.label}
              >
                <Icon size={20} strokeWidth={isCurrent ? 2.3 : 1.9} />
              </Link>

              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#141c17] text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-md">
                {locale === 'bn' ? item.labelBn : item.label}
              </div>
            </div>
          );
        })}

        {/* Future Modules (Clearly labeled Coming Soon) */}
        {futureNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="relative group w-full flex justify-center"
              onMouseEnter={() => setActiveTooltip(item.id)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <button
                type="button"
                className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[#9db0a5] hover:text-[#476052] hover:bg-[#f6f9f7] transition-colors relative"
                aria-label={item.label}
              >
                <Icon size={20} strokeWidth={1.7} />
                <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
              </button>

              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#141c17] text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-md flex items-center gap-1.5">
                <span>{locale === 'bn' ? item.labelBn : item.label}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Coming Soon
                </span>
              </div>
            </div>
          );
        })}

        {/* Separator Line */}
        <div className="w-8 h-[1px] bg-[#edf2ee] my-2" />

        {/* Settings & Info */}
        <div className="relative group w-full flex justify-center">
          <Link
            href="/methodology#system-config"
            className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[#758a7e] hover:text-[#134e35] hover:bg-[#f2f7f3] transition-colors"
            title="System Settings"
          >
            <Settings size={20} strokeWidth={1.8} />
          </Link>
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#141c17] text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
            System Settings
          </div>
        </div>

        <div className="relative group w-full flex justify-center">
          <Link
            href="/methodology"
            className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[#758a7e] hover:text-[#134e35] hover:bg-[#f2f7f3] transition-colors"
            title="System Info"
          >
            <Info size={20} strokeWidth={1.8} />
          </Link>
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#141c17] text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
            About System (EXP_36)
          </div>
        </div>
      </nav>

      {/* Bottom Icons (Theme, Red Action Button, User Avatar) */}
      <div className="mt-auto flex flex-col items-center gap-3.5 pt-4">
        {/* Dark Mode Moon Icon */}
        <button
          type="button"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#758a7e] hover:text-[#134e35] hover:bg-[#f2f7f3] transition-colors"
          title="Toggle Theme"
          aria-label="Toggle Theme"
        >
          <Moon size={18} strokeWidth={1.8} />
        </button>

        {/* Red Circle Button (Language Switcher / Back in reference) */}
        <button
          type="button"
          onClick={onLanguageToggle}
          className="w-9 h-9 rounded-full bg-[#ef4444] text-white flex items-center justify-center shadow-sm shadow-red-500/30 hover:scale-105 active:scale-95 transition-all text-xs font-bold"
          title={`Switch to ${locale === 'en' ? 'বাংলা' : 'English'}`}
          aria-label="Switch Language"
        >
          {locale === 'en' ? (
            <span className="text-[11px] font-bold">বাং</span>
          ) : (
            <ArrowLeft size={16} strokeWidth={2.4} />
          )}
        </button>

        {/* User Avatar Circle */}
        <div
          className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-[#e2e8f0] flex items-center justify-center relative cursor-pointer"
          title="Researcher: Washim Akram (EXP_36)"
        >
          {/* Avatar SVG Portrait */}
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" fill="#cbd5e1" />
            <circle cx="20" cy="15" r="7" fill="#64748b" />
            <path d="M7 36C7 28.8203 12.8203 23 20 23C27.1797 23 33 28.8203 33 36V40H7V36Z" fill="#475569" />
          </svg>
        </div>
      </div>
    </aside>
  );
}
