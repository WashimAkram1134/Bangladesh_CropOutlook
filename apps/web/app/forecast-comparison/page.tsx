import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forecast Comparison | Bangladesh Crop Outlook',
  description: 'Compare crop yield forecasts across districts, seasons, and crops.',
};

export default function ForecastComparisonPage() {
  return (
    <div className="page-container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-neutral-900)' }}>
          Forecast Comparison
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Side-by-side yield and production comparisons across districts, seasons and crops
        </p>
      </div>

      <div
        className="card p-10 flex flex-col items-center text-center gap-4"
        style={{ borderStyle: 'dashed', borderColor: 'var(--color-neutral-300)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-primary-50)' }}
        >
          <span style={{ fontSize: '1.75rem' }}>📊</span>
        </div>
        <div>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-neutral-800)' }}>
            Forecast Comparison — Phase 2
          </h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--color-text-muted)' }}>
            Multi-district and multi-crop bar and line charts comparing predicted yields and
            production across the three planning seasons. Requires EXP_36 backend (Phase 2).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {['Multi-District', 'Season Overlay', 'Bar Charts', 'Line Trends', 'Download PNG'].map((f) => (
            <span key={f} className="badge badge-gray">{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
