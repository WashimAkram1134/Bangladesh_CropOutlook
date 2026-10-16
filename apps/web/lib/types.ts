/**
 * Shared TypeScript types and interfaces — Bangladesh Crop Outlook
 * All types are derived from the EXP_36 verified model release schema.
 */

import type { CropName, SeasonName } from './season';
export type { CropName, SeasonName };

// ─── District ────────────────────────────────────────────────────────────────

/** One of the 64 Bangladesh districts tracked by the system */
export interface District {
  id: string; // e.g. "dhaka", "chittagong"
  name: string; // English name
  nameBn: string; // Bangla name
  division: string;
  areaKm2: number;
}

// ─── Forecast Record ─────────────────────────────────────────────────────────

/** Data provenance tag */
export type DataSource = 'EXP_36' | 'PENDING' | 'NOT_AVAILABLE';

/** A single district × crop forecast from the EXP_36 model release */
export interface ForecastRecord {
  districtId: string;
  crop: CropName;
  season: SeasonName;
  seasonYear: number; // the start year of the season
  /** Predicted yield in tonnes per hectare */
  predictedYield_t_ha: number;
  /** Latest recorded crop area (ha) — from BBS statistics */
  recordedArea_ha: number | null;
  /** Estimated production using recorded area (tonnes) */
  estimatedProduction_t: number | null;
  source: DataSource;
  modelRelease: string; // e.g. "EXP_36"
  generatedAt: string; // ISO timestamp of when model was run
}

// ─── Environmental Variables ──────────────────────────────────────────────────

export type EnvVariableType =
  | 'rainfall'
  | 'temperature'
  | 'ndvi'
  | 'evi'
  | 'soil_moisture_7_28cm';

export interface EnvDataPoint {
  date: string; // YYYY-MM
  value: number;
  unit: string;
  isForecasted: boolean; // true = SARIMA forecast; false = ERA5/MODIS observed
}

export interface EnvPanel {
  variable: EnvVariableType;
  label: string;
  unit: string;
  districtId: string;
  data: EnvDataPoint[];
  source: 'ERA5-Land' | 'MODIS MOD13A3' | 'SARIMA Forecast';
}

// ─── Area Calculator ──────────────────────────────────────────────────────────

export type AreaSource = 'recorded' | 'user_entered';

export interface AreaCalculation {
  areaHa: number;
  source: AreaSource;
  estimatedProduction_t: number | null;
  yieldUsed_t_ha: number | null;
}

// ─── Snapshot Metadata ────────────────────────────────────────────────────────

export interface ModelSnapshot {
  release: string; // e.g. "EXP_36"
  generatedAt: string; // ISO timestamp
  totalForecasts: number; // should be 384
  crops: CropName[];
  districts: number;
  seasons: SeasonName[];
  verified: boolean;
}

// ─── Application State ───────────────────────────────────────────────────────

export type AppLocale = 'en' | 'bn';

export interface AppState {
  locale: AppLocale;
  selectedDistrictId: string | null;
  selectedSeasonName: SeasonName | null;
  selectedSeasonYear: number | null;
  selectedCrop: CropName | null;
  userAreaHa: number | null;
}

// ─── API Response Shapes (for Phase 2 integration) ───────────────────────────

export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
}

export type ForecastApiResponse = ApiResponse<ForecastRecord>;
export type SnapshotApiResponse = ApiResponse<ModelSnapshot>;
