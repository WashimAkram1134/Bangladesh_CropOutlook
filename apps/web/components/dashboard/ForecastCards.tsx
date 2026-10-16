'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNumber } from '@/lib/utils';

interface ForecastMetricCardProps {
  /** Card title */
  title: string;
  /** Primary value to display */
  value: number | null;
  /** Unit string e.g. "t/ha" or "tonnes" */
  unit: string;
  /** Optional secondary label shown below value */
  subtitle?: string;
  /** Optional trend vs reference */
  trend?: 'up' | 'down' | 'neutral';
  /** Number of decimal places for value display */
  decimals?: number;
  /** True = data is loading */
  loading?: boolean;
  /** Source badge label */
  source?: 'EXP_36' | 'NOT_AVAILABLE' | 'PENDING';
  icon?: React.ReactNode;
  id?: string;
}

const SOURCE_BADGE: Record<string, { label: string; variant: 'green' | 'amber' | 'gray' }> = {
  EXP_36: { label: 'EXP_36', variant: 'green' },
  NOT_AVAILABLE: { label: 'Not loaded', variant: 'amber' },
  PENDING: { label: 'Pending', variant: 'gray' },
};

export function ForecastMetricCard({
  title,
  value,
  unit,
  subtitle,
  trend,
  decimals = 2,
  loading = false,
  source = 'NOT_AVAILABLE',
  icon,
  id,
}: ForecastMetricCardProps) {
  const badgeCfg = SOURCE_BADGE[source];

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-36 mt-1" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}
            {title}
          </span>
        </CardTitle>
        <Badge variant={badgeCfg.variant}>{badgeCfg.label}</Badge>
      </CardHeader>

      {value === null ? (
        <div className="py-3">
          <p
            className="text-sm italic"
            style={{ color: 'var(--color-text-muted)' }}
          >
            — Select district, season and crop to view forecast
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-end gap-2">
            <span className="metric-value">{formatNumber(value, decimals)}</span>
            {trend && (
              <span className="mb-1.5">
                {trend === 'up' && <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />}
                {trend === 'down' && <TrendingDown size={16} style={{ color: 'var(--color-error)' }} />}
                {trend === 'neutral' && <Minus size={16} style={{ color: 'var(--color-text-muted)' }} />}
              </span>
            )}
          </div>
          <p className="metric-unit">{unit}</p>
          {subtitle && (
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Area Calculator Card ─────────────────────────────────────────────────────

interface AreaCalculatorCardProps {
  recordedAreaHa: number | null;
  yieldTHa: number | null;
  onUserAreaChange?: (ha: number | null) => void;
}

export function AreaCalculatorCard({
  recordedAreaHa,
  yieldTHa,
  onUserAreaChange,
}: AreaCalculatorCardProps) {
  const [userArea, setUserArea] = useState<string>('');

  const parsedArea = userArea !== '' ? parseFloat(userArea) : null;
  const effectiveArea = parsedArea ?? recordedAreaHa;
  const areaSource: 'user_entered' | 'recorded' | 'unknown' =
    parsedArea !== null ? 'user_entered' : recordedAreaHa !== null ? 'recorded' : 'unknown';

  const production =
    effectiveArea != null && yieldTHa != null && effectiveArea > 0
      ? effectiveArea * yieldTHa
      : null;

  return (
    <Card id="area-calculator-card">
      <CardHeader>
        <CardTitle>Area & Production Estimate</CardTitle>
        <Badge variant="gray">Calculator</Badge>
      </CardHeader>

      <div className="space-y-4">
        {/* Recorded area */}
        <div>
          <p className="label">Latest Recorded Area (BBS)</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-neutral-800)' }}>
            {recordedAreaHa != null
              ? `${formatNumber(recordedAreaHa, 0)} ha`
              : <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not available</span>}
          </p>
          {recordedAreaHa === 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-warning)' }}>
              Zero area recorded for this district–crop combination.
            </p>
          )}
        </div>

        {/* User override */}
        <div>
          <label htmlFor="user-area-input" className="label">
            Enter Cultivated Area (optional override)
          </label>
          <div className="flex gap-2">
            <input
              id="user-area-input"
              type="number"
              min={0}
              step={1}
              className="input flex-1"
              placeholder="e.g. 12000"
              value={userArea}
              onChange={(e) => {
                setUserArea(e.target.value);
                const v = parseFloat(e.target.value);
                onUserAreaChange?.(isNaN(v) ? null : v);
              }}
            />
            <span
              className="flex items-center px-3 rounded-lg text-sm"
              style={{
                background: 'var(--color-neutral-100)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              ha
            </span>
          </div>
          {userArea !== '' && (
            <button
              className="text-xs mt-1"
              style={{ color: 'var(--color-primary-600)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => {
                setUserArea('');
                onUserAreaChange?.(null);
              }}
            >
              Clear — revert to recorded area
            </button>
          )}
        </div>

        {/* Calculated production */}
        <div
          className="rounded-lg p-3"
          style={{ background: 'var(--color-neutral-50)', border: '1px solid var(--color-border-subtle)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Estimated Production
          </p>
          {production != null ? (
            <>
              <p className="text-xl font-bold" style={{ color: 'var(--color-neutral-900)', letterSpacing: '-0.02em' }}>
                {formatNumber(production, 0)}
                <span className="text-sm font-medium ml-1.5" style={{ color: 'var(--color-text-muted)' }}>tonnes</span>
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Using{' '}
                <span className="font-medium">
                  {formatNumber(effectiveArea!, 0)} ha
                </span>{' '}
                {areaSource === 'user_entered' ? '(user-entered area)' : '(recorded BBS area)'}
                {' × '}
                <span className="font-medium">{formatNumber(yieldTHa!, 3)} t/ha</span>
              </p>
            </>
          ) : (
            <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
              Enter yield and area to compute production.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}


