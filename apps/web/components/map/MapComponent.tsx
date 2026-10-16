'use client';

import { useState, useEffect, useRef } from 'react';
import { Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MapComponentProps {
  selectedDistrictId: string | null;
  onDistrictClick?: (districtId: string) => void;
}

/**
 * GIS map component using MapLibre GL JS.
 *
 * Phase 1: Renders an OpenFreeMap-based basemap of Bangladesh.
 * The district polygons, choropleth layers, and click-selection
 * will be wired in Phase 2 when the GeoJSON file is supplied.
 */
export function MapComponent({ selectedDistrictId, onDistrictClick }: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bangladesh approximate center & bounds
  const BANGLADESH_CENTER: [number, number] = [90.3563, 23.6850];
  const BANGLADESH_ZOOM = 6.2;

  useEffect(() => {
    let map: import('maplibre-gl').Map | null = null;

    const initMap = async () => {
      try {
        const ml = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');

        if (!containerRef.current) return;

        // maplibre-gl v3+ exports named symbols
        const MapClass = ml.Map ?? (ml as unknown as { default: typeof ml }).default.Map;
        const NavControl = ml.NavigationControl ?? (ml as unknown as { default: typeof ml }).default.NavigationControl;
        const mapConfig = ml.config ?? (ml as unknown as { default: typeof ml }).default.config;
        if (mapConfig) {
          mapConfig.WORKER_URL = '/maplibre-gl-worker.mjs';
        }

        map = new MapClass({
          container: containerRef.current,
          // OpenFreeMap Positron — no API key required, ODbL licensed
          style: 'https://tiles.openfreemap.org/styles/positron',
          center: BANGLADESH_CENTER,
          zoom: BANGLADESH_ZOOM,
          minZoom: 5,
          maxZoom: 14,
        });

        const m = map!;
        m.addControl(new NavControl({ showCompass: false }), 'bottom-right');

        m.on('load', () => {
          setIsLoaded(true);
          mapRef.current = m;

          // Phase 2: load bangladesh_districts.geojson here and add choropleth layer
          // m.addSource('districts', { type: 'geojson', data: '/data/bangladesh_districts.geojson' });
          // m.addLayer({ ... });
        });

        m.on('error', () => {
          setError('Map tiles failed to load. Check your internet connection.');
        });
      } catch (e) {
        setError('Failed to initialise the map component.');
        console.error(e);
      }
    };

    initMap();

    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  const handleReset = () => {
    mapRef.current?.flyTo({ center: BANGLADESH_CENTER, zoom: BANGLADESH_ZOOM });
  };

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full rounded-lg gap-3"
        style={{ background: 'var(--color-neutral-100)', color: 'var(--color-text-muted)' }}
      >
        <Layers size={28} />
        <p className="text-sm text-center px-6">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      {/* Map container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Shimmer while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 skeleton rounded-xl" style={{ zIndex: 10 }} />
      )}

      {/* Phase 1 overlay banner */}
      {isLoaded && (
        <div
          className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-neutral-600)',
          }}
        >
          <span style={{ color: 'var(--color-primary-600)', fontWeight: 600 }}>District layer</span>
          {' '}— available in Phase 2
        </div>
      )}

      {/* Reset button */}
      {isLoaded && (
        <button
          id="map-reset-btn"
          onClick={handleReset}
          className="absolute bottom-14 right-3 z-10 btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '0.75rem', gap: '4px' }}
          aria-label="Reset map to Bangladesh view"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      )}

      {/* Legend placeholder */}
      {isLoaded && (
        <div
          className="absolute bottom-3 left-3 z-10 px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          Yield choropleth legend — available in Phase 2
        </div>
      )}
    </div>
  );
}
