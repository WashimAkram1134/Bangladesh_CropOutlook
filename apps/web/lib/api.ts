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

export interface ForecastExplanation {
  title: string;
  summary: string;
  sentences: string[];
  recent_avg_yield: number | null;
  predicted_yield: number;
  crop_mae: number;
  soil_ph: number | null;
  elevation: number | null;
  forecast_rain: number | null;
  hist_rain: number | null;
  forecast_temp: number | null;
  forecast_sm: number | null;
  forecast_ndvi: number | null;
  zero_area: boolean;
  disclaimer: string;
  calibrated_interval_status: string;
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
  crop_historical_mae_t_ha?: number;
  prediction_error_label?: string;
  prediction_error_tooltip?: string;
  calibrated_interval_available?: boolean;
  explanation?: ForecastExplanation | null;
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

export interface VariableFreshnessInfo {
  variable: string;
  label: string;
  unit: string;
  source: string;
  from_date: string;
  to_date: string;
  latest_month: string;
  missing_count: number;
}

export interface CropEvaluationMetric {
  crop: string;
  mae_t_ha: number;
  typical_diff_display: string;
  evaluation_basis: string;
}

export interface RfOverallMetric {
  test_year: number;
  mode: string;
  n: number;
  crops_count: number;
  mae_t_ha: number;
  rmse_t_ha: number;
  r2: number;
}

export interface EnvironmentalSummaryResponse {
  district: string;
  variables: Record<string, VariableSummary>;
  variable_freshness?: Record<string, VariableFreshnessInfo>;
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
  variable_freshness?: Record<string, VariableFreshnessInfo>;
  crop_evaluation_metrics?: Record<string, CropEvaluationMetric>;
  rf_overall_metrics?: RfOverallMetric[];
}

export interface DistrictExplorerRecord {
  district: string;
  division: string;
  crop: string;
  season: string;
  display_season: string;
  predicted_yield_t_ha: number;
  assumed_district_area_ha: number;
  estimated_district_production_tonnes: number;
  crop_historical_mae_t_ha: number;
  district_area_status: string;
  zero_area: boolean;
  warnings: string[];
  recheck_recommendation: string;
  forecast_as_of_month: string;
  national_rank: number;
  yield_tier: number;
  median_yield_t_ha?: number;
  yield_vs_median_t_ha?: number;
  yield_vs_median_pct?: number;
  yield_comparison_label?: string;
}

export interface DistrictExplorerSummary {
  crop: string;
  total_districts: number;
  season: string;
  national_avg_yield_t_ha: number;
  national_median_yield_t_ha?: number;
  national_max_yield_t_ha: number;
  national_min_yield_t_ha: number;
  national_total_production_tonnes: number;
  national_total_area_ha: number;
  districts_with_zero_area: number;
  crop_typical_diff_t_ha: number;
  divisions: string[];
  early_forecast_advisory?: string;
  recheck_recommended_date?: string;
  season_start_date?: string;
}

export interface DistrictExplorerResponse {
  crop: string;
  season: string | null;
  records: DistrictExplorerRecord[];
  summary: DistrictExplorerSummary;
}

export interface HistoricalRecord {
  crop_year: string;
  short_year: string;
  district: string;
  crop: string;
  season: string;
  yield_t_ha: number | null;
  rainfall_mm: number | null;
  temperature_c: number | null;
  ndvi: number | null;
  evi: number | null;
  soil_moisture_7_28cm: number | null;
  area_hectares: number | null;
  production_tonnes: number | null;
  is_forecast: boolean;
}

export interface ForecastMarker {
  crop_year: string;
  display_season: string;
  predicted_yield_t_ha: number;
  district: string;
  crop: string;
  season: string;
  label: string;
}

export interface HistoricalSummary {
  total_records: number;
  valid_yield_count: number;
  avg_yield_t_ha: number | null;
  highest_yield_t_ha: number | null;
  highest_year: string | null;
  lowest_yield_t_ha: number | null;
  lowest_year: string | null;
  latest_yield_t_ha: number | null;
  latest_year: string | null;
  earliest_yield_t_ha: number | null;
  earliest_year: string | null;
  change_t_ha: number | null;
  change_pct: number | null;
  has_insufficient_records: boolean;
  note: string;
}

export interface EnvironmentalVariableMeta {
  label: string;
  unit: string;
  source: string;
}

export interface HistoricalTrendsResponse {
  district: string;
  crop: string;
  season: string;
  selected_range: string;
  available_years: string[];
  records: HistoricalRecord[];
  forecast_marker: ForecastMarker | null;
  summary: HistoricalSummary;
  environmental_variables: Record<string, EnvironmentalVariableMeta>;
  provenance: Record<string, string>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

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
  getDistrictExplorer: (crop: string, season?: string) => {
    let q = `/api/district-explorer?crop=${encodeURIComponent(crop)}`;
    if (season) q += `&season=${encodeURIComponent(season)}`;
    return fetchJson<DistrictExplorerResponse>(q);
  },
  getDistrictExplorerCsvUrl: (crop: string, season?: string) => {
    let q = `${API_BASE_URL}/api/district-explorer/csv?crop=${encodeURIComponent(crop)}`;
    if (season) q += `&season=${encodeURIComponent(season)}`;
    return q;
  },
  getHistoricalTrends: (
    district: string,
    crop: string,
    years?: number | null,
    startYear?: string | null,
    endYear?: string | null
  ) => {
    let q = `/api/history?district=${encodeURIComponent(district)}&crop=${encodeURIComponent(crop)}`;
    if (years !== undefined && years !== null && years > 0) {
      q += `&years=${years}`;
    }
    if (startYear) q += `&start_year=${encodeURIComponent(startYear)}`;
    if (endYear) q += `&end_year=${encodeURIComponent(endYear)}`;
    return fetchJson<HistoricalTrendsResponse>(q);
  },
  getHistoricalCsvUrl: (
    district: string,
    crop: string,
    years?: number | null,
    startYear?: string | null,
    endYear?: string | null
  ) => {
    let q = `${API_BASE_URL}/api/history/csv?district=${encodeURIComponent(district)}&crop=${encodeURIComponent(crop)}`;
    if (years !== undefined && years !== null && years > 0) {
      q += `&years=${years}`;
    }
    if (startYear) q += `&start_year=${encodeURIComponent(startYear)}`;
    if (endYear) q += `&end_year=${encodeURIComponent(endYear)}`;
    return q;
  },
};

