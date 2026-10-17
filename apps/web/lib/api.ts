/**
 * Bangladesh Crop Outlook — Typed API Client (EXP_38 Phase 2)
 * Connects Next.js frontend to FastAPI backend serving verified EXP_36 research models.
 */

export interface HealthResponse {
  status: string;
  release_id: string;
  built_utc: string;
  forecast_planning_date: string;
  forecast_as_of_month: string;
  snapshot_seasons: string[];
  current_planning_seasons: string[];
  matches_current_season_window: boolean;
  refresh_required: boolean;
  total_records: number;
  converged_sarima_models: number;
}

export interface SeasonItem {
  planning_order: number;
  season: 'Rabi' | 'Kharif-I' | 'Kharif-II';
  target_year_start: number;
  season_label: string;
  window_start: string;
  window_end_exclusive: string;
  crops: string[];
  is_active: boolean;
  rollover_active: boolean;
}

export interface DistrictItem {
  id: string;
  name: string;
  name_bn?: string;
  division?: string;
  area_km2?: number;
}

export interface ForecastRecordResponse {
  district: string;
  crop: string;
  season: string;
  predicted_yield_t_ha: number;
  assumed_district_area_ha: number;
  estimated_district_production_tonnes: number;
  user_area_ha: number | null;
  estimated_user_production_tonnes: number | null;
  forecast_as_of_month: string;
  max_sarima_lead_months: number;
  recheck_recommendation: string;
  warnings: string[];
  district_area_status: string;
  planning_status: string;
  display_season: string;
}

export interface EnvironmentalPoint {
  date: string; // YYYY-MM
  value: number;
  is_forecast: boolean;
  horizon_months: number;
  source: string;
  unit: string;
}

export interface EnvironmentalSeriesResponse {
  district: string;
  variable: string;
  label: string;
  unit: string;
  latest_observation_date: string;
  points: EnvironmentalPoint[];
}

export interface VariableSummary {
  label: string;
  unit: string;
  latest_observed: {
    date: string | null;
    value: number | null;
  };
  immediate_forecast: {
    date: string | null;
    value: number | null;
  };
}

export interface EnvironmentalSummaryResponse {
  district: string;
  variables: Record<string, VariableSummary>;
}

export interface MetadataResponse {
  release_id: string;
  release_status: string;
  built_utc: string;
  forecast_planning_date: string;
  forecast_as_of_month: string;
  districts_count: number;
  crops: string[];
  seasons: string[];
  rf_feature_columns: string[];
  sarima_specification: Record<string, any>;
  operational_sarima_converged: number;
  season_policy: string;
  district_production_rule: string;
  user_area_rule: string;
  limitations: string[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options?.headers,
    },
    // Next.js caching strategy: revalidate or fresh fetch
    cache: 'no-store',
  });

  if (!res.ok) {
    let errorDetail = `API error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail);
  }

  return (await res.json()) as T;
}

export const api = {
  getHealth: () => fetchJson<HealthResponse>('/health'),
  getSeasons: () => fetchJson<SeasonItem[]>('/api/seasons'),
  getDistricts: () => fetchJson<DistrictItem[]>('/api/districts'),
  getCrops: (season?: string) =>
    fetchJson<{ season?: string; crops: string[] }>(season ? `/api/crops?season=${encodeURIComponent(season)}` : '/api/crops'),
  getForecast: (
    district: string,
    crop: string,
    userAreaHa?: number | null,
    allowHistoricalSnapshot: boolean = false
  ) => {
    let q = `/api/forecast?district=${encodeURIComponent(district)}&crop=${encodeURIComponent(crop)}`;
    if (userAreaHa !== undefined && userAreaHa !== null && userAreaHa > 0) {
      q += `&user_area_ha=${encodeURIComponent(userAreaHa.toString())}`;
    }
    if (allowHistoricalSnapshot) {
      q += '&allow_historical_snapshot=true';
    }
    return fetchJson<ForecastRecordResponse>(q);
  },
  getAllForecasts: (crop: string, season?: string) => {
    let q = `/api/forecasts?crop=${encodeURIComponent(crop)}`;
    if (season) {
      q += `&season=${encodeURIComponent(season)}`;
    }
    return fetchJson<ForecastRecordResponse[]>(q);
  },
  getEnvironmentalSeries: (district: string, variable: string, historyMonths: number = 24) => {
    const q = `/api/environmental?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}&history_months=${historyMonths}`;
    return fetchJson<EnvironmentalSeriesResponse>(q);
  },
  getEnvironmentalSummary: (district: string) => {
    const q = `/api/environmental/summary?district=${encodeURIComponent(district)}`;
    return fetchJson<EnvironmentalSummaryResponse>(q);
  },
  getMetadata: () => fetchJson<MetadataResponse>('/api/metadata'),
};
