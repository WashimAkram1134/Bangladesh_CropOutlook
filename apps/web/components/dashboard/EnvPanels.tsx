'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { EnvPanel as EnvPanelType, EnvVariableType } from '@/lib/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';

const ENV_META: Record<EnvVariableType, { label: string; color: string; unit: string }> = {
  rainfall: { label: 'Rainfall', color: '#0369a1', unit: 'mm' },
  temperature: { label: 'Temperature', color: '#d97706', unit: '°C' },
  ndvi: { label: 'NDVI', color: '#2d6a4f', unit: '' },
  evi: { label: 'EVI', color: '#16a34a', unit: '' },
  soil_moisture_7_28cm: { label: 'Soil Moisture (7–28 cm)', color: '#7c3aed', unit: 'm³/m³' },
};

interface EnvPanelProps {
  panel: EnvPanelType | null;
  loading?: boolean;
  variableType: EnvVariableType;
}

export function EnvPanelCard({ panel, loading = false, variableType }: EnvPanelProps) {
  const meta = ENV_META[variableType];

  if (loading) {
    return (
      <div className="card p-5">
        <div className="skeleton h-4 w-32 mb-3" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{meta.label}</CardTitle>
        {panel ? (
          <Badge variant="blue" style={{ fontSize: '0.6rem' }}>
            {panel.data.some(d => d.isForecasted) ? 'SARIMA Forecast' : panel.source}
          </Badge>
        ) : (
          <Badge variant="gray">No data</Badge>
        )}
      </CardHeader>

      {panel && panel.data.length > 0 ? (
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={panel.data} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${variableType}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="10%" stopColor={meta.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={meta.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-card)',
              }}
              formatter={(value) => {
                const v = typeof value === 'number' ? value : Number(value);
                return [`${v.toFixed(2)} ${meta.unit}`, meta.label];
              }}
              labelStyle={{ fontWeight: 600, color: 'var(--color-neutral-700)' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={meta.color}
              strokeWidth={1.5}
              fill={`url(#grad-${variableType})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-xs italic py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Environmental data available in Phase 2
        </p>
      )}
    </Card>
  );
}

/** Grid of all 5 environmental panels */
export function EnvPanelGrid({ districtId }: { districtId: string | null }) {
  const variables: EnvVariableType[] = [
    'rainfall',
    'temperature',
    'ndvi',
    'evi',
    'soil_moisture_7_28cm',
  ];

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-neutral-700)' }}>
        Environmental Indicators
        {!districtId && (
          <span className="ml-2 font-normal text-xs" style={{ color: 'var(--color-text-muted)' }}>
            — select a district
          </span>
        )}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {variables.map((v) => (
          <EnvPanelCard key={v} variableType={v} panel={null} />
        ))}
      </div>
    </div>
  );
}
