'use client';

import { getCropsForSeason, type SeasonName, type CropName } from '@/lib/season';
import { Wheat } from 'lucide-react';

const CROP_ICONS: Record<string, string> = {
  'Aman Rice': '🌾',
  'Aus Rice': '🌾',
  'Boro Rice': '🌾',
  'Potato': '🥔',
  'Wheat': '🌿',
  'Jute': '🪢',
};

interface CropSelectorProps {
  seasonName: SeasonName;
  selectedCrop: CropName | null;
  onCropChange: (crop: CropName) => void;
}

export function CropSelector({ seasonName, selectedCrop, onCropChange }: CropSelectorProps) {
  const crops = getCropsForSeason(seasonName);

  return (
    <div>
      <label className="label">Crop</label>
      <div className="flex flex-wrap gap-2 mt-1">
        {crops.map((crop) => {
          const isSelected = crop === selectedCrop;
          return (
            <button
              key={crop}
              id={`crop-btn-${crop.toLowerCase().replace(/\s+/g, '-')}`}
              type="button"
              onClick={() => onCropChange(crop)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                isSelected
                  ? {
                      background: 'var(--color-primary-600)',
                      color: '#fff',
                      border: '1px solid var(--color-primary-600)',
                    }
                  : {
                      background: 'var(--color-surface)',
                      color: 'var(--color-neutral-700)',
                      border: '1px solid var(--color-border)',
                    }
              }
              aria-pressed={isSelected}
            >
              <span role="img" aria-label={crop} style={{ fontSize: '0.9rem' }}>
                {CROP_ICONS[crop]}
              </span>
              {crop}
            </button>
          );
        })}
      </div>
      {crops.length === 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          No crops available for this season.
        </p>
      )}
    </div>
  );
}
