'use client';

import { useState } from 'react';
import { ChevronDown, Calendar, Clock } from 'lucide-react';
import type { Season } from '@/lib/season';
import { cn } from '@/lib/utils';

interface SeasonSelectorProps {
  seasons: [Season, Season, Season];
  selectedSeason: Season;
  onSeasonChange: (season: Season) => void;
  rolledOver?: boolean;
  currentSeason?: Season | null;
}

export function SeasonSelector({
  seasons,
  selectedSeason,
  onSeasonChange,
  rolledOver = false,
  currentSeason,
}: SeasonSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <label className="label">Planning Season</label>

      {/* Rollover notice */}
      {rolledOver && (
        <div
          className="mb-2 text-xs px-3 py-2 rounded-md flex items-start gap-2"
          style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-700)' }}
        >
          <Clock size={12} className="mt-0.5 shrink-0" />
          <span>
            The current {currentSeason?.name} season is ≥70% complete. Showing the next planning
            window.
          </span>
        </div>
      )}

      {/* Trigger */}
      <button
        id="season-selector-trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="select text-left flex items-center justify-between"
        style={{ cursor: 'pointer' }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--color-primary-600)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {selectedSeason.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            ({selectedSeason.monthRange})
          </span>
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--color-text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg overflow-hidden"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 24px rgb(0 0 0 / 0.10)',
          }}
          role="listbox"
          aria-label="Select planning season"
        >
          {seasons.map((season, idx) => {
            const isSelected = season.label === selectedSeason.label;
            return (
              <button
                key={season.label}
                role="option"
                aria-selected={isSelected}
                id={`season-option-${idx}`}
                type="button"
                onClick={() => {
                  onSeasonChange(season);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-center justify-between transition-colors',
                  isSelected
                    ? 'bg-primary-50'
                    : 'hover:bg-neutral-50'
                )}
                style={isSelected ? { background: 'var(--color-primary-50)' } : {}}
              >
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: isSelected
                        ? 'var(--color-primary-700)'
                        : 'var(--color-neutral-800)',
                    }}
                  >
                    {season.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {season.monthRange}
                  </span>
                </div>
                {idx === 0 && (
                  <span
                    className="badge badge-green"
                    style={{ fontSize: '0.65rem' }}
                  >
                    Active
                  </span>
                )}
                {idx === 1 && (
                  <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                    Next
                  </span>
                )}
                {idx === 2 && (
                  <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                    +2
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Forecast horizon guidance */}
      {selectedSeason.label !== seasons[0].label && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--color-accent-500)' }}>
            ⚠ Longer horizon:
          </span>{' '}
          Forecasts improve as the season approaches. Recheck approximately two weeks before{' '}
          {selectedSeason.name} begins.
        </p>
      )}
    </div>
  );
}
