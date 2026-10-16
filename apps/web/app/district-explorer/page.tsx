import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'District Explorer | Bangladesh Crop Outlook',
  description: 'Explore agricultural forecast data by district for all 64 Bangladesh districts.',
};

export default function DistrictExplorerPage() {
  return (
    <div className="page-container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-neutral-900)' }}>
          District Explorer
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Browse yield and production forecasts across all 64 districts
        </p>
      </div>

      {/* Phase 1 placeholder */}
      <div
        className="card p-10 flex flex-col items-center text-center gap-4"
        style={{ borderStyle: 'dashed', borderColor: 'var(--color-neutral-300)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-primary-50)' }}
        >
          <span style={{ fontSize: '1.75rem' }}>🗺️</span>
        </div>
        <div>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-neutral-800)' }}>
            District Explorer — Phase 2
          </h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--color-text-muted)' }}>
            This view will display a sortable, filterable table of all 64 districts with yield and
            production forecasts, GIS boundaries, and comparative charts. Available once EXP_36
            backend is connected in Phase 2.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {['All 64 Districts', 'Sortable Table', 'Choropleth Map', 'Division Filters', 'CSV Export'].map((f) => (
            <span key={f} className="badge badge-gray">{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
