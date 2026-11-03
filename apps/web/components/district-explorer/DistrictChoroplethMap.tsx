'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { DistrictExplorerRecord } from '@/lib/api';

interface Props {
  records: DistrictExplorerRecord[];
  selectedDistrict: string | null;
  onDistrictClick: (district: string) => void;
  tierColors: string[];
}

// Normalise district names to match GeoJSON "District" property
function normDistrict(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * DistrictChoroplethMap — MapLibre GL JS choropleth for the District Explorer.
 * Renders Bangladesh GeoJSON polygons colored by yield_tier (0–4).
 * Highlights selected district and emits click events.
 */
export default function DistrictChoroplethMap({ records, selectedDistrict, onDistrictClick, tierColors }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Build lookup: normalised name → record
  const lookup = new Map<string, DistrictExplorerRecord>();
  for (const r of records) {
    lookup.set(normDistrict(r.district), r);
  }

  const onDistrictClickRef = useRef(onDistrictClick);
  onDistrictClickRef.current = onDistrictClick;

  const recordsRef = useRef(records);
  recordsRef.current = records;

  // Initialise map once
  useEffect(() => {
    let map: import('maplibre-gl').Map | null = null;
    let popup: import('maplibre-gl').Popup | null = null;
    let destroyed = false;

    (async () => {
      try {
        const ml = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (!containerRef.current || destroyed) return;

        const MapClass = ml.Map ?? (ml as any).default?.Map ?? (ml as any).default;
        const NavControl = ml.NavigationControl ?? (ml as any).default?.NavigationControl;
        const PopupClass = ml.Popup ?? (ml as any).default?.Popup;
        const mapCfg = ml.config ?? (ml as any).default?.config;
        if (mapCfg) mapCfg.WORKER_URL = '/maplibre-gl-worker.mjs';

        map = new MapClass({
          container: containerRef.current,
          style: 'https://tiles.openfreemap.org/styles/positron',
          center: [90.3563, 23.685] as [number, number],
          zoom: 6.0,
          minZoom: 5,
          maxZoom: 12,
          attributionControl: false,
        });

        if (NavControl) {
          map.addControl(new NavControl({ showCompass: false }), 'bottom-right');
        }

        popup = new PopupClass({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          className: 'district-map-popup',
        });

        mapRef.current = map;

        map.on('load', async () => {
          if (destroyed) return;

          // Load GeoJSON
          let geojson: any;
          try {
            const resp = await fetch('/geo/bangladesh_districts.geojson');
            geojson = await resp.json();
          } catch {
            return;
          }

          if (!map || destroyed) return;

          // Add source
          map.addSource('districts', { type: 'geojson', data: geojson });

          // Add fill layer
          map.addLayer({
            id: 'district-fill',
            type: 'fill',
            source: 'districts',
            paint: {
              'fill-color': [
                'case',
                ['==', ['get', 'District'], ''], '#e8f5e9',
                '#b2dfdb',
              ],
              'fill-opacity': 0.78,
            },
          });

          // Add border layer
          map.addLayer({
            id: 'district-border',
            type: 'line',
            source: 'districts',
            paint: {
              'line-color': '#ffffff',
              'line-width': 0.8,
            },
          });

          // Add highlight layer (selected district)
          map.addLayer({
            id: 'district-highlight',
            type: 'line',
            source: 'districts',
            filter: ['==', ['get', 'District'], ''],
            paint: {
              'line-color': '#155338',
              'line-width': 2.8,
            },
          });

          // Click handler
          map.on('click', 'district-fill', (e: any) => {
            const feat = e.features?.[0];
            if (!feat) return;
            const districtName = feat.properties?.District as string;
            if (districtName) onDistrictClickRef.current(districtName);
          });

          // Hover tooltip handler
          map.on('mousemove', 'district-fill', (e: any) => {
            if (!map || !popup) return;
            map.getCanvas().style.cursor = 'pointer';
            const feat = e.features?.[0];
            if (!feat) return;
            const districtName = feat.properties?.District as string;
            const rec = recordsRef.current.find(
              (r) => r.district.toLowerCase() === (districtName || '').toLowerCase()
            );

            const yieldStr = rec ? `${rec.predicted_yield_t_ha.toFixed(2)} t/ha` : '—';
            const rankStr = rec ? `#${rec.national_rank}` : '—';
            const divStr = rec ? `${rec.division} Div.` : '';

            popup
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family: inherit; font-size: 12px; line-height: 1.35; padding: 2px 4px;">
                  <div style="font-weight: 700; color: #141c17; display: flex; justify-content: space-between; gap: 8px;">
                    <span>${districtName}</span>
                    <span style="font-size: 10px; color: #155338; font-weight: 600;">${rankStr}</span>
                  </div>
                  <div style="font-size: 11px; color: #6b7c72;">${divStr}</div>
                  <div style="margin-top: 4px; font-weight: 700; color: #155338;">${yieldStr}</div>
                </div>`
              )
              .addTo(map);
          });

          map.on('mouseleave', 'district-fill', () => {
            if (!map) return;
            map.getCanvas().style.cursor = '';
            if (popup) popup.remove();
          });

          setMapLoaded(true);
        });
      } catch (err) {
        console.error('Map init error:', err);
      }
    })();

    return () => {
      destroyed = true;
      if (popup) popup.remove();
      if (map) { map.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update fill colours when records change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!map.getLayer('district-fill')) return;

    if (!records || records.length === 0) {
      map.setPaintProperty('district-fill', 'fill-color', '#e0e0e0');
      return;
    }

    // Build MapLibre expression for fill-color:
    // ['match', ['get', 'District'], district1, color1, district2, color2, ..., fallback]
    // Requires at least 4 arguments: input, at least one (label, color) pair, and fallback.
    const expr: any[] = ['match', ['get', 'District']];
    const seen = new Set<string>();

    for (const r of records) {
      if (!r?.district || seen.has(r.district)) continue;
      seen.add(r.district);
      const color = tierColors[r.yield_tier] ?? tierColors[2] ?? '#66bb6a';
      expr.push(r.district, color);
    }

    if (seen.size === 0) {
      map.setPaintProperty('district-fill', 'fill-color', '#e0e0e0');
      return;
    }

    expr.push('#e0e0e0'); // default for unmatched districts

    try {
      map.setPaintProperty('district-fill', 'fill-color', expr as any);
    } catch (err) {
      console.warn('Failed to set district choropleth fill-color expression:', err);
      map.setPaintProperty('district-fill', 'fill-color', '#e0e0e0');
    }
  }, [records, tierColors, mapLoaded]);

  // Update highlight when selected district changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!map.getLayer('district-highlight')) return;

    map.setFilter('district-highlight', [
      '==', ['get', 'District'], selectedDistrict ?? '',
    ]);
  }, [selectedDistrict, mapLoaded]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      className="rounded-b-xl overflow-hidden"
    />
  );
}
