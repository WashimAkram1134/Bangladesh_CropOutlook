'use client';

import { useState, useEffect } from 'react';
import { DISTRICTS } from '@/lib/districts';
import { getDistrictsByDivision } from '@/lib/districts';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DistrictSelectorProps {
  selectedDistrictId: string | null;
  onDistrictChange: (districtId: string) => void;
}

export function DistrictSelector({ selectedDistrictId, onDistrictChange }: DistrictSelectorProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = DISTRICTS.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.nameBn.includes(search) ||
    d.division.toLowerCase().includes(search.toLowerCase())
  );

  const byDivision = filtered.reduce((acc, d) => {
    if (!acc[d.division]) acc[d.division] = [];
    acc[d.division].push(d);
    return acc;
  }, {} as Record<string, typeof DISTRICTS>);

  const selected = DISTRICTS.find((d) => d.id === selectedDistrictId);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#district-selector-container')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div id="district-selector-container" className="relative">
      <label className="label">District</label>

      <button
        id="district-selector-trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="select w-full text-left flex items-center gap-2"
        style={{ cursor: 'pointer' }}
        aria-expanded={open}
      >
        <MapPin size={14} style={{ color: 'var(--color-primary-600)', flexShrink: 0 }} />
        <span className="text-sm" style={{ color: selected ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
          {selected ? `${selected.name} (${selected.division})` : 'Select a district…'}
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-30 rounded-lg overflow-hidden flex flex-col"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 12px 32px rgb(0 0 0 / 0.12)',
            maxHeight: '360px',
          }}
        >
          {/* Search */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <input
              id="district-search"
              className="input text-sm"
              placeholder="Search district…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{ padding: '6px 10px' }}
            />
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: '300px' }}>
            {Object.entries(byDivision).map(([division, districts]) => (
              <div key={division}>
                <div
                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider sticky top-0"
                  style={{
                    color: 'var(--color-text-muted)',
                    background: 'var(--color-neutral-50)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {division}
                </div>
                {districts.map((d) => (
                  <button
                    key={d.id}
                    id={`district-option-${d.id}`}
                    type="button"
                    onClick={() => {
                      onDistrictChange(d.id);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors',
                      d.id === selectedDistrictId ? '' : 'hover:bg-neutral-50'
                    )}
                    style={
                      d.id === selectedDistrictId
                        ? { background: 'var(--color-primary-50)' }
                        : {}
                    }
                  >
                    <span
                      className="text-sm"
                      style={{
                        color:
                          d.id === selectedDistrictId
                            ? 'var(--color-primary-700)'
                            : 'var(--color-neutral-700)',
                        fontWeight: d.id === selectedDistrictId ? 600 : 400,
                      }}
                    >
                      {d.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                      {d.nameBn}
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {filtered.length === 0 && (
              <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                No districts found for &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
