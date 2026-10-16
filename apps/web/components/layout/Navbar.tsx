'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf, Menu, X, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', labelBn: 'ড্যাশবোর্ড' },
  { href: '/district-explorer', label: 'District Explorer', labelBn: 'জেলা অন্বেষক' },
  { href: '/forecast-comparison', label: 'Forecast Comparison', labelBn: 'পূর্বাভাস তুলনা' },
  { href: '/methodology', label: 'Data & Methodology', labelBn: 'তথ্য ও পদ্ধতি' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locale, setLocale] = useState<'en' | 'bn'>('en');

  const toggleLocale = () => setLocale((l) => (l === 'en' ? 'bn' : 'en'));
  const t = (en: string, bn: string) => (locale === 'bn' ? bn : en);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      <div className="page-container w-full flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-decoration-none"
          style={{ textDecoration: 'none' }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: 'var(--color-primary-600)' }}
          >
            <Leaf size={16} color="white" />
          </div>
          <div className="flex flex-col leading-none">
            <span
              className="font-semibold text-sm"
              style={{ color: 'var(--color-primary-700)' }}
            >
              {locale === 'bn' ? 'বাংলাদেশ ফসল আউটলুক' : 'Bangladesh Crop Outlook'}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('Agricultural Forecasting System', 'কৃষি পূর্বাভাস সিস্টেম')}
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'
              )}
              style={
                pathname === link.href
                  ? {
                      background: 'var(--color-primary-50)',
                      color: 'var(--color-primary-700)',
                    }
                  : {}
              }
            >
              {locale === 'bn' ? link.labelBn : link.label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Locale toggle */}
          <button
            id="locale-toggle"
            onClick={toggleLocale}
            className="btn btn-ghost flex items-center gap-1.5"
            style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
            aria-label="Toggle language"
          >
            <Globe size={14} />
            <span>{locale === 'en' ? 'বাং' : 'EN'}</span>
          </button>

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-toggle"
            className="md:hidden btn btn-ghost"
            style={{ padding: '6px 8px' }}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="absolute top-16 left-0 right-0 md:hidden"
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            boxShadow: '0 8px 24px rgb(0 0 0 / 0.08)',
          }}
        >
          <nav className="page-container py-3 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium"
                style={
                  pathname === link.href
                    ? {
                        background: 'var(--color-primary-50)',
                        color: 'var(--color-primary-700)',
                      }
                    : { color: 'var(--color-neutral-700)' }
                }
              >
                {locale === 'bn' ? link.labelBn : link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
