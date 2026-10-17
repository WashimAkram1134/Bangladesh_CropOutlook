"""FastAPI Backend Service — Bangladesh Crop Outlook (EXP_38 Phase 2)

Connects to the verified EXP_36 research model release:
- 384 district-crop yield and production forecast records
- 320 converged SARIMA operational models across 5 environmental indicators
- 64 Bangladesh districts across 8 divisions
- 3 planning seasons (Rabi, Kharif-I, Kharif-II) with 70% calendar rollover
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import date, datetime, timedelta
from math import ceil
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── Locate EXP_36 Release Directory ─────────────────────────────────────────

def resolve_release_dir() -> Path:
    env_dir = os.environ.get("EXP36_RELEASE_DIR")
    if env_dir and Path(env_dir).exists():
        return Path(env_dir).resolve()

    # Search common candidate locations relative to repository
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "private" / "exp36_release",
        Path(__file__).resolve().parent.parent.parent / "private" / "exp_36_release" / "EXP36_20261016T035235Z_5543b2fe",
        Path.cwd() / "private" / "exp36_release",
        Path.cwd() / "private" / "exp_36_release" / "EXP36_20261016T035235Z_5543b2fe",
    ]

    for cand in candidates:
        if (cand / "deployment_contract.json").exists() and (cand / "forecasts" / "national_384_predictions.csv").exists():
            return cand.resolve()

    raise RuntimeError(
        "Could not locate EXP_36 release directory. "
        "Please set the EXP36_RELEASE_DIR environment variable."
    )

RELEASE_DIR = resolve_release_dir()

# Add release directory to path to allow importing original helpers if needed
if str(RELEASE_DIR) not in sys.path:
    sys.path.insert(0, str(RELEASE_DIR))

# ─── Normalization & Season Rules ───────────────────────────────────────────

CROP_SEASON = {
    "Aus Rice": "Kharif-I",
    "Jute": "Kharif-I",
    "Aman Rice": "Kharif-II",
    "Boro Rice": "Rabi",
    "Potato": "Rabi",
    "Wheat": "Rabi",
}

SEASON_CROPS = {
    "Kharif-I": ["Aus Rice", "Jute"],
    "Kharif-II": ["Aman Rice"],
    "Rabi": ["Boro Rice", "Potato", "Wheat"],
}

ALIASES = {
    "barisal": "barishal",
    "bogra": "bogura",
    "chittagong": "chattogram",
    "comilla": "cumilla",
    "jessore": "jashore",
    "jhalokati": "jhalakathi",
    "jhalokathi": "jhalakathi",
    "khagrachhari": "khagrachari",
    "maulvibazar": "moulvibazar",
    "netrakona": "netrokona",
    "nawabganj": "chapainawabganj",
    "brahamanbaria": "brahmanbaria",
    "coxsbazar": "coxsbazar",
}

VARIABLE_UNITS = {
    "rainfall_mm": "mm",
    "temperature_c": "°C",
    "ndvi": "unitless (-1 to 1)",
    "evi": "unitless (-1 to 1)",
    "soil_moisture_7_28cm": "m³/m³",
}

VARIABLE_LABELS = {
    "rainfall_mm": "Monthly Rainfall",
    "temperature_c": "Mean Temperature",
    "ndvi": "Vegetation Index (NDVI)",
    "evi": "Enhanced Veg. Index (EVI)",
    "soil_moisture_7_28cm": "Soil Moisture (7–28 cm)",
}

def norm_name(value: Any) -> str:
    text = str(value).strip().lower()
    text = re.sub(r"\b(district|zila|zilla)\b", "", text)
    key = re.sub(r"[^a-z0-9]", "", text)
    return ALIASES.get(key, key)

def get_planning_seasons(day: Optional[date] = None) -> List[Dict[str, Any]]:
    """Three consecutive planning seasons using 70% elapsed-season rollover rule."""
    if day is None:
        try:
            day = datetime.now(ZoneInfo("Asia/Dhaka")).date()
        except Exception:
            day = date.today()

    windows = []
    for year in range(day.year - 2, day.year + 4):
        windows.extend([
            ("Kharif-I", year, date(year, 3, 15), date(year, 7, 15)),
            ("Kharif-II", year, date(year, 7, 15), date(year, 10, 15)),
            ("Rabi", year, date(year, 10, 15), date(year + 1, 3, 15)),
        ])
    windows.sort(key=lambda x: x[2])

    current_idx = None
    for i, (_, _, start, end) in enumerate(windows):
        if start <= day < end:
            current_idx = i
            break

    if current_idx is None:
        current_idx = 0

    _, _, cur_start, cur_end = windows[current_idx]
    total_days = (cur_end - cur_start).days
    elapsed_days = (day - cur_start).days
    rollover_threshold_days = ceil(0.70 * total_days)
    is_rolled_over = elapsed_days >= rollover_threshold_days

    active_idx = current_idx + 1 if is_rolled_over else current_idx
    selected = windows[active_idx : active_idx + 3]

    output = []
    for rank, (season, year, start, end) in enumerate(selected, 1):
        label = (
            f"Rabi {year}–{str(year + 1)[-2:]}"
            if season == "Rabi"
            else f"{season} {year}"
        )
        output.append({
            "planning_order": rank,
            "season": season,
            "target_year_start": year,
            "season_label": label,
            "window_start": str(start),
            "window_end_exclusive": str(end),
            "crops": SEASON_CROPS.get(season, []),
            "is_active": rank == 1,
            "rollover_active": is_rolled_over and rank == 1,
        })
    return output

# ─── Load Release Assets ───────────────────────────────────────────────────

class ReleaseDataStore:
    def __init__(self, path: Path):
        self.path = path
        contract_file = path / "deployment_contract.json"
        manifest_file = path / "release_manifest.json"
        predictions_file = path / "forecasts" / "national_384_predictions.csv"
        sarima_audit_file = path / "audits" / "sarima_operational_320_fit_status.csv"
        monthly_sources_file = path / "audits" / "monthly_environment_forecast_sources.csv"

        if not contract_file.exists():
            raise FileNotFoundError(f"Missing deployment_contract.json in {path}")
        if not predictions_file.exists():
            raise FileNotFoundError(f"Missing national_384_predictions.csv in {path}")

        self.contract: Dict[str, Any] = json.loads(contract_file.read_text(encoding="utf-8"))
        self.manifest: Dict[str, Any] = json.loads(manifest_file.read_text(encoding="utf-8")) if manifest_file.exists() else {}

        # 384 Predictions
        self.df_predictions = pd.read_csv(predictions_file)
        if len(self.df_predictions) != 384:
            raise ValueError(f"Expected exactly 384 rows, got {len(self.df_predictions)}")

        self.districts: List[str] = sorted(self.df_predictions["District"].unique().tolist())
        self.district_norm_map: Dict[str, str] = {norm_name(d): d for d in self.districts}

        # 320 SARIMA status
        self.sarima_status: Dict[str, Dict[str, Any]] = {}
        if sarima_audit_file.exists():
            df_sarima = pd.read_csv(sarima_audit_file)
            for _, row in df_sarima.iterrows():
                key = (norm_name(row["District"]), str(row["Variable"]))
                self.sarima_status[key] = {
                    "converged": bool(row.get("Model_Converged", True)),
                    "optimizer": str(row.get("Model_Optimizer", "")),
                    "aic": float(row["SARIMA_AIC"]) if pd.notna(row.get("SARIMA_AIC")) else None,
                }

        # Monthly Environmental Sources (observed + SARIMA)
        self.df_monthly_sources: Optional[pd.DataFrame] = None
        if monthly_sources_file.exists():
            self.df_monthly_sources = pd.read_csv(monthly_sources_file)

        # Historical monthly environmental inputs
        self.historical_env: Dict[str, pd.DataFrame] = {}
        hist_dir = path / "inputs" / "Forcast"
        if hist_dir.exists():
            file_map = {
                "rainfall_mm": "Monthly_Rainfall_2000_2026.csv",
                "temperature_c": "Monthly_Temperature_2000_2026.csv",
                "ndvi": "Monthly_NDVI_2000_2026.csv",
                "evi": "Monthly_EVI_2000_2026.csv",
                "soil_moisture_7_28cm": "Monthly_Soil_Moisture_7_28cm_2000_2026.csv",
            }
            for var_key, fname in file_map.items():
                p = hist_dir / fname
                if p.exists():
                    df = pd.read_csv(p)
                    # Standardize district col
                    dist_col = "district_name" if "district_name" in df.columns else "District"
                    df["norm_district"] = df[dist_col].apply(norm_name)
                    self.historical_env[var_key] = df

data_store = ReleaseDataStore(RELEASE_DIR)

# ─── FastAPI Application ───────────────────────────────────────────────────

app = FastAPI(
    title="Bangladesh Crop Outlook API",
    description="Operational forecasting API serving verified EXP_36 Random Forest yield and SARIMA environmental models.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Response Schemas ─────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    release_id: str
    built_utc: str
    forecast_planning_date: str
    forecast_as_of_month: str
    snapshot_seasons: List[str]
    current_planning_seasons: List[str]
    matches_current_season_window: bool
    refresh_required: bool
    total_records: int
    converged_sarima_models: int

class DistrictItem(BaseModel):
    id: str
    name: str
    name_bn: Optional[str] = None
    division: Optional[str] = None
    area_km2: Optional[float] = None

class SeasonItem(BaseModel):
    planning_order: int
    season: str
    target_year_start: int
    season_label: str
    window_start: str
    window_end_exclusive: str
    crops: List[str]
    is_active: bool
    rollover_active: bool

class ForecastRecordResponse(BaseModel):
    district: str
    crop: str
    season: str
    predicted_yield_t_ha: float
    assumed_district_area_ha: float
    estimated_district_production_tonnes: float
    user_area_ha: Optional[float] = None
    estimated_user_production_tonnes: Optional[float] = None
    forecast_as_of_month: str
    max_sarima_lead_months: int
    recheck_recommendation: str
    warnings: List[str]
    district_area_status: str
    planning_status: str
    display_season: str

class EnvironmentalPoint(BaseModel):
    date: str  # YYYY-MM
    value: float
    is_forecast: bool
    horizon_months: Optional[int] = None
    source: str
    unit: str

class EnvironmentalSeriesResponse(BaseModel):
    district: str
    variable: str
    label: str
    unit: str
    latest_observation_date: str
    points: List[EnvironmentalPoint]

class MetadataResponse(BaseModel):
    release_id: str
    release_status: str
    built_utc: str
    forecast_planning_date: str
    forecast_as_of_month: str
    districts_count: int
    crops: List[str]
    seasons: List[str]
    rf_feature_columns: List[str]
    sarima_specification: Dict[str, Any]
    operational_sarima_converged: int
    season_policy: str
    district_production_rule: str
    user_area_rule: str
    limitations: List[str]

# ─── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def get_health():
    """Verify backend health, snapshot fresh status, and model convergence count."""
    seasons = get_planning_seasons()
    current_labels = sorted(s["season_label"] for s in seasons)
    snapshot_labels = sorted(data_store.contract.get("snapshot_season_labels", []))
    matches_window = current_labels == snapshot_labels

    return HealthResponse(
        status="healthy",
        release_id=data_store.contract["release_id"],
        built_utc=data_store.contract["built_utc"],
        forecast_planning_date=data_store.contract["forecast_planning_date"],
        forecast_as_of_month=data_store.contract["forecast_as_of_month"],
        snapshot_seasons=snapshot_labels,
        current_planning_seasons=current_labels,
        matches_current_season_window=matches_window,
        refresh_required=not matches_window,
        total_records=len(data_store.df_predictions),
        converged_sarima_models=data_store.contract.get("operational_sarima_converged", 320),
    )

@app.get("/api/seasons", response_model=List[SeasonItem])
def list_seasons():
    """Returns the three consecutive planning seasons with the strict 70% rollover calculation."""
    return get_planning_seasons()

@app.get("/api/districts", response_model=List[DistrictItem])
def list_districts():
    """Returns all 64 verified Bangladesh districts."""
    return [DistrictItem(id=norm_name(d), name=d) for d in data_store.districts]

@app.get("/api/crops")
def list_crops(season: Optional[str] = Query(None, description="Optional season name (Rabi, Kharif-I, Kharif-II)")):
    """Returns available crops filtered dynamically by planning season."""
    if season:
        clean_s = season.strip()
        matched = None
        for k in sorted(SEASON_CROPS.keys(), key=len, reverse=True):
            if k.lower() in clean_s.lower():
                matched = k
                break
        if not matched:
            raise HTTPException(status_code=400, detail=f"Invalid season '{season}'. Must be Rabi, Kharif-I, or Kharif-II.")
        return {"season": matched, "crops": SEASON_CROPS[matched]}
    return {"crops": data_store.contract.get("crops", list(CROP_SEASON.keys()))}

@app.get("/api/forecast", response_model=ForecastRecordResponse)
def get_forecast(
    district: str = Query(..., description="District name (e.g. Dinajpur)"),
    crop: str = Query(..., description="Crop name (e.g. Boro Rice, Aman Rice, Potato)"),
    user_area_ha: Optional[float] = Query(None, gt=0, description="Optional farmer field size in hectares"),
    allow_historical_snapshot: bool = Query(False, description="Flag to permit historical snapshot reads"),
):
    """Query a single verified district x crop forecast record."""
    norm_dist = norm_name(district)
    if norm_dist not in data_store.district_norm_map:
        raise HTTPException(status_code=404, detail=f"Unknown district: '{district}'. Available districts: 64.")

    canonical_dist = data_store.district_norm_map[norm_dist]
    if crop not in CROP_SEASON:
        raise HTTPException(status_code=400, detail=f"Unknown crop: '{crop}'. Available crops: {list(CROP_SEASON.keys())}")

    # Check season freshness safety rule
    current_planning = sorted(s["season_label"] for s in get_planning_seasons())
    snapshot_labels = sorted(data_store.contract.get("snapshot_season_labels", []))
    if not allow_historical_snapshot and current_planning != snapshot_labels:
        raise HTTPException(
            status_code=409,
            detail=(
                "The stored forecast season is no longer the active planning season. "
                "Regenerate EXP_34/35 or pass allow_historical_snapshot=true."
            ),
        )

    row = data_store.df_predictions.loc[
        (data_store.df_predictions["District"] == canonical_dist) &
        (data_store.df_predictions["Crop"] == crop)
    ]

    if len(row) != 1:
        raise HTTPException(status_code=404, detail=f"Missing unique forecast for {district}/{crop}")

    r = row.iloc[0]
    yield_val = float(r["Predicted_Yield_t_ha"])
    area_val = float(r["Latest_District_Area_Hectares"])

    warnings: List[str] = []
    if str(r.get("Reported_Zero_District_Area", "")).lower() in ("true", "1"):
        warnings.append("No reported district crop area; yield is conditional on cultivation.")
    if str(r.get("Provisional_Stale_Lag", "")).lower() in ("true", "1"):
        warnings.append("Latest available BBS crop-yield lag is older than one year.")
    if str(r.get("Long_Horizon_Warning", "")).lower() in ("true", "1"):
        warnings.append("Long lead time: recheck when new monthly observations arrive.")

    user_prod = (yield_val * user_area_ha) if user_area_ha is not None else None

    return ForecastRecordResponse(
        district=canonical_dist,
        crop=crop,
        season=str(r["Crop_Season"]),
        predicted_yield_t_ha=yield_val,
        assumed_district_area_ha=area_val,
        estimated_district_production_tonnes=float(r["District_Production_tonnes"]),
        user_area_ha=user_area_ha,
        estimated_user_production_tonnes=user_prod,
        forecast_as_of_month=str(r.get("Forecast_As_Of_Month", "2026-09-01")),
        max_sarima_lead_months=int(r.get("Max_Monthly_Forecast_Horizon", 7)),
        recheck_recommendation=str(r.get("Recheck_Recommendation", "Refresh after new monthly observations")),
        warnings=warnings,
        district_area_status=str(r.get("District_Area_Status", "POSITIVE_REPORTED_AREA")),
        planning_status=str(r.get("Planning_Status", "In progress")),
        display_season=str(r.get("Display_Season", "Rabi 2026–27")),
    )

@app.get("/api/forecasts", response_model=List[ForecastRecordResponse])
def get_all_forecasts(
    crop: str = Query("Boro Rice", description="Crop name to query across all 64 districts"),
    season: Optional[str] = Query(None, description="Optional season name or label"),
):
    """Returns the verified forecasts for all 64 districts for the given crop and season."""
    if crop not in CROP_SEASON:
        raise HTTPException(status_code=400, detail=f"Unknown crop: '{crop}'. Available: {list(CROP_SEASON.keys())}")

    df = data_store.df_predictions[data_store.df_predictions["Crop"] == crop]
    if season:
        clean_s = season.strip()
        df = df[
            df["Display_Season"].str.contains(clean_s, case=False, na=False) |
            df["Crop_Season"].str.contains(clean_s, case=False, na=False)
        ]

    results: List[ForecastRecordResponse] = []
    for _, r in df.iterrows():
        yield_val = float(r["Predicted_Yield_t_ha"])
        area_val = float(r["Latest_District_Area_Hectares"])

        warnings = []
        if str(r.get("Reported_Zero_District_Area", "")).lower() in ("true", "1"):
            warnings.append("Zero reported area in BBS.")
        if str(r.get("Long_Horizon_Warning", "")).lower() in ("true", "1"):
            warnings.append("Provisional long lead time.")

        results.append(
            ForecastRecordResponse(
                district=str(r["District"]),
                crop=str(r["Crop"]),
                season=str(r["Crop_Season"]),
                predicted_yield_t_ha=yield_val,
                assumed_district_area_ha=area_val,
                estimated_district_production_tonnes=float(r["District_Production_tonnes"]),
                user_area_ha=None,
                estimated_user_production_tonnes=None,
                forecast_as_of_month=str(r.get("Forecast_As_Of_Month", "2026-09-01")),
                max_sarima_lead_months=int(r.get("Max_Monthly_Forecast_Horizon", 7)),
                recheck_recommendation=str(r.get("Recheck_Recommendation", "Refresh after new monthly observations")),
                warnings=warnings,
                district_area_status=str(r.get("District_Area_Status", "POSITIVE_REPORTED_AREA")),
                planning_status=str(r.get("Planning_Status", "In progress")),
                display_season=str(r.get("Display_Season", "Rabi 2026–27")),
            )
        )

    return results

@app.get("/api/environmental", response_model=EnvironmentalSeriesResponse)
def get_environmental_series(
    district: str = Query("Dinajpur", description="District name"),
    variable: str = Query("rainfall_mm", description="One of: rainfall_mm, temperature_c, ndvi, evi, soil_moisture_7_28cm"),
    history_months: int = Query(24, ge=6, le=120, description="Number of observed historical months to include"),
):
    """Returns continuous observed historical measurements + forward SARIMA forecasts for charting."""
    norm_dist = norm_name(district)
    if norm_dist not in data_store.district_norm_map:
        raise HTTPException(status_code=404, detail=f"Unknown district: '{district}'")

    canonical_dist = data_store.district_norm_map[norm_dist]
    if variable not in VARIABLE_UNITS:
        raise HTTPException(status_code=400, detail=f"Unknown variable: '{variable}'. Available: {list(VARIABLE_UNITS.keys())}")

    points: List[EnvironmentalPoint] = []
    latest_observed_date = "2026-09-01"

    # 1. Historical Observed Points
    if variable in data_store.historical_env:
        df_hist = data_store.historical_env[variable]
        sub = df_hist[df_hist["norm_district"] == norm_dist].copy()
        if not sub.empty:
            sub["date_str"] = sub.apply(lambda r: f"{int(r['year']):04d}-{int(r['month']):02d}", axis=1)
            # Filter up through 2026-09 (observed window)
            sub = sub[sub["date_str"] <= "2026-09"].sort_values("date_str")
            sub_recent = sub.tail(history_months)
            for _, r in sub_recent.iterrows():
                val_col = variable
                if val_col not in r and "Value" in r:
                    val_col = "Value"
                val = float(r[val_col]) if pd.notna(r.get(val_col)) else 0.0
                points.append(
                    EnvironmentalPoint(
                        date=r["date_str"],
                        value=round(val, 3),
                        is_forecast=False,
                        horizon_months=0,
                        source="Observed (ERA5/MODIS)",
                        unit=VARIABLE_UNITS[variable],
                    )
                )

    # 2. SARIMA Forecast Points (from monthly audit)
    if data_store.df_monthly_sources is not None:
        df_audit = data_store.df_monthly_sources[
            (data_store.df_monthly_sources["District"] == canonical_dist) &
            (data_store.df_monthly_sources["Variable"] == variable)
        ].copy()

        if not df_audit.empty:
            df_audit = df_audit.sort_values("Month")
            for _, r in df_audit.iterrows():
                # Format Month as YYYY-MM
                m_date = str(r["Month"])[:7]
                points.append(
                    EnvironmentalPoint(
                        date=m_date,
                        value=round(float(r["Value"]), 3),
                        is_forecast=True,
                        horizon_months=int(r.get("Forecast_Horizon_Months", 1)),
                        source="SARIMA Forecast",
                        unit=VARIABLE_UNITS[variable],
                    )
                )

    return EnvironmentalSeriesResponse(
        district=canonical_dist,
        variable=variable,
        label=VARIABLE_LABELS.get(variable, variable),
        unit=VARIABLE_UNITS[variable],
        latest_observation_date=latest_observed_date,
        points=points,
    )

@app.get("/api/environmental/summary")
def get_environmental_summary(district: str = Query("Dinajpur")):
    """Returns the latest observed and immediate forecast values for all 5 environmental variables."""
    norm_dist = norm_name(district)
    if norm_dist not in data_store.district_norm_map:
        raise HTTPException(status_code=404, detail=f"Unknown district: '{district}'")

    canonical_dist = data_store.district_norm_map[norm_dist]
    summary = {}

    for var in VARIABLE_UNITS.keys():
        series = get_environmental_series(district=canonical_dist, variable=var, history_months=2)
        obs_points = [p for p in series.points if not p.is_forecast]
        fc_points = [p for p in series.points if p.is_forecast]

        latest_obs = obs_points[-1] if obs_points else None
        next_fc = fc_points[0] if fc_points else None

        summary[var] = {
            "label": VARIABLE_LABELS.get(var, var),
            "unit": VARIABLE_UNITS[var],
            "latest_observed": {
                "date": latest_obs.date if latest_obs else None,
                "value": latest_obs.value if latest_obs else None,
            },
            "immediate_forecast": {
                "date": next_fc.date if next_fc else None,
                "value": next_fc.value if next_fc else None,
            },
        }

    return {"district": canonical_dist, "variables": summary}

@app.get("/api/metadata", response_model=MetadataResponse)
def get_metadata():
    """Returns deployment contract, models specification, and research limitations."""
    c = data_store.contract
    return MetadataResponse(
        release_id=c.get("release_id", "EXP36"),
        release_status=c.get("release_status", "candidate"),
        built_utc=c.get("built_utc", ""),
        forecast_planning_date=c.get("forecast_planning_date", ""),
        forecast_as_of_month=c.get("forecast_as_of_month", ""),
        districts_count=c.get("districts", 64),
        crops=c.get("crops", []),
        seasons=c.get("snapshot_season_labels", []),
        rf_feature_columns=c.get("rf_feature_columns", []),
        sarima_specification=c.get("sarima_specification", {}),
        operational_sarima_converged=c.get("operational_sarima_converged", 320),
        season_policy=c.get("season_policy", ""),
        district_production_rule=c.get("district_production", ""),
        user_area_rule=c.get("user_area", ""),
        limitations=c.get("limitations", []),
    )
