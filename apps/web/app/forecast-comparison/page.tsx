import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SmartCropPlanner } from '@/components/planner/SmartCropPlanner';

export const metadata: Metadata = {
  title: 'Smart Crop & Season Planner | Bangladesh Crop Outlook',
  description:
    'Compare crop yields, official BBS rice-to-paddy conversions, demonstration market prices, and farmer decision support across 64 Bangladesh districts.',
};

export default function ForecastComparisonPage() {
  return (
    <div className="page-container py-6 md:py-8">
      <Suspense
        fallback={
          <div className="card p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[var(--color-neutral-800)]">
              Loading Smart Crop & Season Planner...
            </p>
          </div>
        }
      >
        <SmartCropPlanner />
      </Suspense>
    </div>
  );
}
