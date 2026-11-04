"""FastAPI Backend Service — Bangladesh Crop Outlook (EXP_38 Phase 2)

Connects to the verified EXP_36 research model release:
- 384 district-crop yield and production forecast records
- 320 converged SARIMA operational models across 5 environmental indicators
- 64 Bangladesh districts across 8 divisions
- 3 planning seasons (Rabi, Kharif-I, Kharif-II) with 70% calendar rollover
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
import re
import sys
from datetime import date, datetime, timedelta
from math import ceil
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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

def calculate_forecast_advisory(
    season_name: str,
    target_year_start: int,
    planning_order: int = 1,
    current_day: Optional[date] = None,
    is_supported: bool = True,
) -> Dict[str, Any]:
    """Calculates date-aware forecast advisory adhering to EXP_38 specifications."""
    if current_day is None:
        try:
            current_day = datetime.now(ZoneInfo("Asia/Dhaka")).date()
        except Exception:
            current_day = date.today()

    if not is_supported or target_year_start < 2026 or target_year_start > 2027:
        return {
            "case": "E",
            "message": "An updated forecast is needed for this season.",
            "badge_label": "Update needed",
            "recheck_date_str": "",
            "season_start_date_str": "",
            "season_end_date_str": "",
            "is_past_recheck": True,
            "is_season_started": False,
            "is_season_ended": True,
        }

    # Season calendar boundaries (EXP_36 specification)
    if season_name == "Kharif-I":
        s_start = date(target_year_start, 3, 15)
        s_end = date(target_year_start, 7, 15)
    elif season_name == "Kharif-II":
        s_start = date(target_year_start, 7, 15)
        s_end = date(target_year_start, 10, 15)
    else:  # Rabi
        s_start = date(target_year_start, 10, 15)
        s_end = date(target_year_start + 1, 3, 15)

    recheck_dt = s_start - timedelta(days=14)
    recheck_str = f"{recheck_dt.strftime('%B')} {recheck_dt.day}, {recheck_dt.year}"
    start_str = f"{s_start.strftime('%B')} {s_start.day}, {s_start.year}"
    end_str = f"{s_end.strftime('%B')} {s_end.day}, {s_end.year}"

    is_season_started = current_day >= s_start
    is_season_ended = current_day >= s_end
    is_past_recheck = current_day >= recheck_dt

    if is_season_ended:
        return {
            "case": "E",
            "message": "An updated forecast is needed for this season.",
            "badge_label": "Season concluded",
            "recheck_date_str": recheck_str,
            "season_start_date_str": start_str,
            "season_end_date_str": end_str,
            "is_past_recheck": True,
            "is_season_started": True,
            "is_season_ended": True,
        }

    if is_season_started:
        return {
            "case": "A",
            "message": "This growing season has started. Check for the latest forecast update when new information becomes available.",
            "badge_label": "Season in progress",
            "recheck_date_str": recheck_str,
            "season_start_date_str": start_str,
            "season_end_date_str": end_str,
            "is_past_recheck": True,
            "is_season_started": True,
            "is_season_ended": False,
        }

    if is_past_recheck and not is_season_started:
        return {
            "case": "D",
            "message": "The suggested review date has passed. Check whether a newer forecast is available before planning.",
            "badge_label": "Review suggested",
            "recheck_date_str": recheck_str,
            "season_start_date_str": start_str,
            "season_end_date_str": end_str,
            "is_past_recheck": True,
            "is_season_started": False,
            "is_season_ended": False,
        }

    if planning_order == 3:
        return {
            "case": "C",
            "message": f"Advance forecast — check again on {recheck_str} as the growing season approaches.",
            "badge_label": f"Check on {recheck_str}",
            "recheck_date_str": recheck_str,
            "season_start_date_str": start_str,
            "season_end_date_str": end_str,
            "is_past_recheck": False,
            "is_season_started": False,
            "is_season_ended": False,
        }

    return {
        "case": "B",
        "message": f"Early forecast — check again on {recheck_str} for the latest available estimate.",
        "badge_label": f"Check on {recheck_str}",
        "recheck_date_str": recheck_str,
        "season_start_date_str": start_str,
        "season_end_date_str": end_str,
        "is_past_recheck": False,
        "is_season_started": False,
        "is_season_ended": False,
    }

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

        # Crop-specific Historical Evaluation Test Errors (MAE in t/ha)
        crop_mae_file = path / "evaluation" / "rf_holdout_cropwise_mae.csv"
        self.crop_mae_map: Dict[str, float] = {
            "Aman Rice": 0.144,
            "Aus Rice": 0.165,
            "Boro Rice": 0.214,
            "Jute": 0.103,
            "Potato": 1.379,
            "Wheat": 0.294,
        }
        if crop_mae_file.exists():
            try:
                df_mae = pd.read_csv(crop_mae_file)
                computed = df_mae.groupby("Crop")["MAE_t_ha"].mean().to_dict()
                for c, val in computed.items():
                    self.crop_mae_map[str(c)] = float(val)
            except Exception:
                pass

        # Crop evaluation metrics summary dictionary
        self.crop_evaluation_metrics: Dict[str, Dict[str, Any]] = {}
        for c_name, mae_val in self.crop_mae_map.items():
            self.crop_evaluation_metrics[c_name] = {
                "crop": c_name,
                "mae_t_ha": round(mae_val, 3),
                "typical_diff_display": f"≈{mae_val:.2f} t/ha",
                "evaluation_basis": "Historical chronological holdout testing",
            }

        # Overall RF holdout metrics
        self.rf_overall_metrics: List[Dict[str, Any]] = []
        rf_metric_file = path / "evaluation" / "rf_chronological_observed_inputs_holdout_metrics.csv"
        if rf_metric_file.exists():
            try:
                rf_m_df = pd.read_csv(rf_metric_file)
                for _, r in rf_m_df.iterrows():
                    self.rf_overall_metrics.append({
                        "test_year": int(r["Test_Agri_Start_Year"]),
                        "mode": str(r["Mode"]),
                        "n": int(r["N"]),
                        "crops_count": int(r["Crops"]),
                        "mae_t_ha": round(float(r["MAE_t_ha"]), 3),
                        "rmse_t_ha": round(float(r["RMSE_t_ha"]), 3),
                        "r2": round(float(r["R2"]), 4),
                    })
            except Exception:
                pass
        if not self.rf_overall_metrics:
            self.rf_overall_metrics = [
                {"test_year": 2024, "mode": "Observed Environment", "n": 384, "crops_count": 6, "mae_t_ha": 0.343, "rmse_t_ha": 0.656, "r2": 0.9909},
                {"test_year": 2025, "mode": "Observed Environment", "n": 320, "crops_count": 5, "mae_t_ha": 0.465, "rmse_t_ha": 1.067, "r2": 0.9800},
            ]

        # Variable-specific data freshness (audits/source_monthly_coverage.csv)
        self.variable_freshness: Dict[str, Dict[str, Any]] = {}
        cov_file = path / "audits" / "source_monthly_coverage.csv"
        if cov_file.exists():
            try:
                cov_df = pd.read_csv(cov_file)
                for _, r in cov_df.iterrows():
                    var = str(r["Variable"])
                    to_date = str(r["To"])
                    human_month = to_date
                    try:
                        human_month = pd.to_datetime(to_date).strftime("%B %Y")
                    except Exception:
                        pass
                    src = "ERA5-Land (ECMWF)" if var in ("rainfall_mm", "temperature_c", "soil_moisture_7_28cm") else "MODIS MOD13A3 (NASA)"
                    self.variable_freshness[var] = {
                        "variable": var,
                        "label": VARIABLE_LABELS.get(var, var),
                        "unit": VARIABLE_UNITS.get(var, ""),
                        "source": src,
                        "from_date": str(r["From"]),
                        "to_date": to_date,
                        "latest_month": human_month,
                        "missing_count": int(r["Missing"]) if pd.notna(r.get("Missing")) else 0,
                    }
            except Exception:
                pass
        if not self.variable_freshness:
            self.variable_freshness = {
                "rainfall_mm": {"variable": "rainfall_mm", "label": "Total Rainfall", "unit": "mm", "source": "ERA5-Land (ECMWF)", "from_date": "2000-01-01", "to_date": "2026-09-01", "latest_month": "September 2026", "missing_count": 0},
                "temperature_c": {"variable": "temperature_c", "label": "2m Air Temperature", "unit": "°C", "source": "ERA5-Land (ECMWF)", "from_date": "2000-01-01", "to_date": "2026-09-01", "latest_month": "September 2026", "missing_count": 0},
                "soil_moisture_7_28cm": {"variable": "soil_moisture_7_28cm", "label": "Soil Moisture (7–28cm)", "unit": "m³/m³", "source": "ERA5-Land (ECMWF)", "from_date": "2000-02-01", "to_date": "2026-09-01", "latest_month": "September 2026", "missing_count": 64},
                "ndvi": {"variable": "ndvi", "label": "NDVI Vegetation Index", "unit": "index", "source": "MODIS MOD13A3 (NASA)", "from_date": "2000-02-01", "to_date": "2026-08-01", "latest_month": "August 2026", "missing_count": 128},
                "evi": {"variable": "evi", "label": "EVI Vegetation Index", "unit": "index", "source": "MODIS MOD13A3 (NASA)", "from_date": "2000-02-01", "to_date": "2026-08-01", "latest_month": "August 2026", "missing_count": 131},
            }

        # Historical Agriculture & Environmental records (2006-2026)
        hist_agri_file = path / "inputs" / "Historical_Agriculture_Weather_RS_GIS_2006_2026.csv"
        self.df_historical: Optional[pd.DataFrame] = None
        if hist_agri_file.exists():
            try:
                self.df_historical = pd.read_csv(hist_agri_file)
                self.df_historical["norm_district"] = self.df_historical["District"].apply(norm_name)
            except Exception:
                self.df_historical = None

        # Precompute Seasonal EVI (MODIS MOD13A3) for Historical Series
        self.evi_seasonal_lookup: Dict[Tuple[str, str, str], float] = {}
        evi_file = path / "inputs" / "Forcast" / "Monthly_EVI_2000_2026.csv"
        if evi_file.exists():
            try:
                df_evi = pd.read_csv(evi_file)
                dist_col = "District" if "District" in df_evi.columns else "district_name"
                evi_month_map: Dict[Tuple[str, int, int], float] = {}
                for r in df_evi.itertuples():
                    d_val = getattr(r, dist_col, None)
                    y_val = getattr(r, "year", None)
                    m_val = getattr(r, "month", None)
                    e_val = getattr(r, "evi", None)
                    if d_val is not None and pd.notna(y_val) and pd.notna(m_val) and pd.notna(e_val):
                        evi_month_map[(norm_name(str(d_val)), int(y_val), int(m_val))] = float(e_val)

                unique_norm_districts = set(norm_name(str(d)) for d in df_evi[dist_col].dropna().unique())
                for nd in unique_norm_districts:
                    for y in range(2005, 2027):
                        ay = f"{y}-{y+1}"
                        # Kharif-I: Mar-Jul of y
                        k1 = [evi_month_map[(nd, y, m)] for m in (3, 4, 5, 6, 7) if (nd, y, m) in evi_month_map]
                        if k1:
                            self.evi_seasonal_lookup[(nd, "Kharif-I", ay)] = round(sum(k1) / len(k1), 4)
                        # Kharif-II: Jul-Oct of y
                        k2 = [evi_month_map[(nd, y, m)] for m in (7, 8, 9, 10) if (nd, y, m) in evi_month_map]
                        if k2:
                            self.evi_seasonal_lookup[(nd, "Kharif-II", ay)] = round(sum(k2) / len(k2), 4)
                        # Rabi: Oct-Dec of y and Jan-Mar of y+1
                        rb = [evi_month_map[(nd, y, m)] for m in (10, 11, 12) if (nd, y, m) in evi_month_map] + \
                             [evi_month_map[(nd, y + 1, m)] for m in (1, 2, 3) if (nd, y + 1, m) in evi_month_map]
                        if rb:
                            self.evi_seasonal_lookup[(nd, "Rabi", ay)] = round(sum(rb) / len(rb), 4)
            except Exception:
                self.evi_seasonal_lookup = {}

    def generate_explanation(
        self,
        district: str,
        crop: str,
        display_season: str,
        predicted_yield: float,
        zero_area: bool,
    ) -> Dict[str, Any]:
        norm_d = norm_name(district)
        recent_avg: Optional[float] = None
        hist_rain: Optional[float] = None
        hist_temp: Optional[float] = None
        soil_ph: Optional[float] = None
        elevation: Optional[float] = None

        if self.df_historical is not None:
            sub = self.df_historical[
                (self.df_historical["norm_district"] == norm_d) &
                (self.df_historical["Crop"] == crop)
            ].sort_values("agri_year")

            if not sub.empty:
                recent_yields = [float(y) for y in sub["Yield_Hectare"].dropna().tail(3).tolist() if float(y) > 0]
                if recent_yields:
                    recent_avg = sum(recent_yields) / len(recent_yields)
                if pd.notna(sub["rainfall_mm"].mean()):
                    hist_rain = float(sub["rainfall_mm"].mean())
                if pd.notna(sub["temperature_c"].mean()):
                    hist_temp = float(sub["temperature_c"].mean())
                if pd.notna(sub["soil_ph_10cm"].iloc[-1]):
                    soil_ph = float(sub["soil_ph_10cm"].iloc[-1])
                if pd.notna(sub["elevation"].iloc[-1]):
                    elevation = float(sub["elevation"].iloc[-1])

        # Monthly forecast sources for seasonal totals
        forecast_rain: Optional[float] = None
        forecast_temp: Optional[float] = None
        forecast_sm: Optional[float] = None
        forecast_ndvi: Optional[float] = None

        if self.df_monthly_sources is not None:
            s_sub = self.df_monthly_sources[
                (self.df_monthly_sources["District"].apply(norm_name) == norm_d) &
                (self.df_monthly_sources["Display_Season"] == display_season) &
                (self.df_monthly_sources["Crop"] == crop)
            ]
            if not s_sub.empty:
                r_rows = s_sub[s_sub["Variable"] == "rainfall_mm"]["Value"]
                if not r_rows.empty:
                    forecast_rain = float(r_rows.sum())
                t_rows = s_sub[s_sub["Variable"] == "temperature_c"]["Value"]
                if not t_rows.empty:
                    forecast_temp = float(t_rows.mean())
                sm_rows = s_sub[s_sub["Variable"] == "soil_moisture_7_28cm"]["Value"]
                if not sm_rows.empty:
                    forecast_sm = float(sm_rows.mean())
                ndvi_rows = s_sub[s_sub["Variable"] == "ndvi"]["Value"]
                if not ndvi_rows.empty:
                    forecast_ndvi = float(ndvi_rows.mean())

        crop_mae = float(self.crop_mae_map.get(crop, 0.20))

        # Build 2-3 deterministic, natural, data-grounded sentences
        sentences: List[str] = []
        if zero_area:
            sentences.append(
                f"No commercial {crop} area has been recorded in {district} in recent BBS agricultural censuses. "
                f"The forecast of {predicted_yield:.2f} t/ha is a conditional estimate if cultivated under local agro-ecological conditions."
            )
        elif recent_avg is not None and soil_ph is not None and elevation is not None:
            sentences.append(
                f"This estimate considers {district}'s recent historical {crop} yields (averaging {recent_avg:.2f} t/ha), "
                f"local soil pH ({soil_ph:.1f}), and terrain elevation ({elevation:.0f} m)."
            )
        else:
            sentences.append(
                f"This estimate considers {district}'s historical agricultural patterns, local land characteristics, "
                f"and soil profile conditions."
            )

        if forecast_rain is not None and hist_rain is not None and forecast_temp is not None:
            diff_pct = ((forecast_rain - hist_rain) / hist_rain) * 100 if hist_rain > 0 else 0
            if abs(diff_pct) <= 12:
                rain_comp = "near historical seasonal average"
            elif diff_pct > 12:
                rain_comp = f"{abs(diff_pct):.0f}% above historical seasonal normal"
            else:
                rain_comp = f"{abs(diff_pct):.0f}% below historical seasonal normal"
            sentences.append(
                f"The model incorporates anticipated seasonal rainfall of ~{forecast_rain:.0f} mm ({rain_comp} of ~{hist_rain:.0f} mm), "
                f"average temperature of ~{forecast_temp:.1f}°C, and soil moisture levels."
            )
        elif forecast_temp is not None:
            sentences.append(
                f"The forecast accounts for anticipated seasonal temperatures averaging ~{forecast_temp:.1f}°C "
                f"alongside seasonal vegetation and soil moisture indices."
            )

        sentences.append(
            "Actual harvest results may differ as in-season weather events, irrigation, and local farming practices evolve."
        )

        return {
            "title": "Why this forecast?",
            "summary": " ".join(sentences),
            "sentences": sentences,
            "recent_avg_yield": round(recent_avg, 2) if recent_avg is not None else None,
            "predicted_yield": round(predicted_yield, 2),
            "crop_mae": round(crop_mae, 3),
            "soil_ph": round(soil_ph, 2) if soil_ph is not None else None,
            "elevation": round(elevation, 1) if elevation is not None else None,
            "forecast_rain": round(forecast_rain, 1) if forecast_rain is not None else None,
            "hist_rain": round(hist_rain, 1) if hist_rain is not None else None,
            "forecast_temp": round(forecast_temp, 1) if forecast_temp is not None else None,
            "forecast_sm": round(forecast_sm, 3) if forecast_sm is not None else None,
            "forecast_ndvi": round(forecast_ndvi, 3) if forecast_ndvi is not None else None,
            "zero_area": zero_area,
            "disclaimer": "Environmental and historical conditions are considered by the forecasting model as inputs. They do not constitute an independent causal claim or plot-level guarantee.",
            "calibrated_interval_status": "Yield range not yet verified. A statistically calibrated operational prediction interval requires historical backtesting with forecasted rather than observed weather inputs.",
        }

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
    # Scientific prediction error & human-readable explanation
    crop_historical_mae_t_ha: Optional[float] = 0.214
    prediction_error_label: str = "Typical Yield Difference"
    prediction_error_tooltip: str = (
        "This is an estimate, so the actual harvest may be higher or lower. "
        "In past tests, predictions differed from actual yields by about 0.21 tonnes per hectare on average."
    )
    calibrated_interval_available: bool = False
    explanation: Optional[Dict[str, Any]] = None

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
    variable_freshness: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    crop_evaluation_metrics: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    rf_overall_metrics: List[Dict[str, Any]] = Field(default_factory=list)

class HistoricalRecordItem(BaseModel):
    crop_year: str
    short_year: str
    district: str
    crop: str
    season: str
    yield_t_ha: Optional[float] = None
    rainfall_mm: Optional[float] = None
    temperature_c: Optional[float] = None
    ndvi: Optional[float] = None
    evi: Optional[float] = None
    soil_moisture_7_28cm: Optional[float] = None
    area_hectares: Optional[float] = None
    production_tonnes: Optional[float] = None
    is_forecast: bool = False

class ForecastMarkerItem(BaseModel):
    crop_year: str
    display_season: str
    predicted_yield_t_ha: float
    district: str
    crop: str
    season: str
    label: str = "EXP_36 Forecast"

class HistoricalSummary(BaseModel):
    total_records: int
    valid_yield_count: int
    avg_yield_t_ha: Optional[float] = None
    highest_yield_t_ha: Optional[float] = None
    highest_year: Optional[str] = None
    lowest_yield_t_ha: Optional[float] = None
    lowest_year: Optional[str] = None
    latest_yield_t_ha: Optional[float] = None
    latest_year: Optional[str] = None
    earliest_yield_t_ha: Optional[float] = None
    earliest_year: Optional[str] = None
    change_t_ha: Optional[float] = None
    change_pct: Optional[float] = None
    has_insufficient_records: bool = False
    note: str = ""

class HistoricalTrendsResponse(BaseModel):
    district: str
    crop: str
    season: str
    selected_range: str
    available_years: List[str]
    records: List[HistoricalRecordItem]
    forecast_marker: Optional[ForecastMarkerItem] = None
    summary: HistoricalSummary
    environmental_variables: Dict[str, Dict[str, str]]
    provenance: Dict[str, str]

# ─── Smart Crop & Season Planner Data ────────────────────────────────────────

# BBS statistical rice-to-paddy conversion factor (BBS Yearbook of Agricultural Statistics 2016,
# Chapter 1, Sample Crop Cutting Method of Rice).
# Rice = Paddy × 2/3  →  Paddy-equivalent = Rice-equivalent × 3/2
RICE_EQUIVALENT_FACTOR: float = 2.0 / 3.0  # rice per unit paddy

# Demo prices (historical reference — NOT actual or future selling prices)
# Source & reference dates are included in the response for transparency.
DEMO_PRICES = {
    "Boro Rice": {
        "market_unit": "kg",
        "price_bdt": 36.0,  # BDT per kg paddy equivalent (Boro paddy, May 2026)
        "price_ref_date": "May 5, 2026",
        "price_source": "DAM Wholesale Paddy Reference Price (Bangladesh)",
        "is_paddy_equivalent": True,  # price is per kg paddy; yield must be converted
        "disclaimer": "Demo Prices — Not Actual Selling Prices",
    },
    "Aman Rice": {
        "market_unit": "kg",
        "price_bdt": 34.0,  # BDT per kg paddy equivalent (Aman paddy, Nov 2025)
        "price_ref_date": "November 9, 2025",
        "price_source": "DAM Wholesale Paddy Reference Price (Bangladesh)",
        "is_paddy_equivalent": True,
        "disclaimer": "Demo Prices — Not Actual Selling Prices",
    },
    "Aus Rice": {
        "market_unit": "kg",
        "price_bdt": 32.0,  # BDT per kg paddy equivalent (approximate)
        "price_ref_date": "July 2026 (approximate reference)",
        "price_source": "DAM Wholesale Paddy Reference Price (Bangladesh)",
        "is_paddy_equivalent": True,
        "disclaimer": "Demo Prices — Not Actual Selling Prices",
    },
    "Potato": {
        "market_unit": "kg",
        "price_bdt": 17.5,  # midpoint of BDT 15–20/kg
        "price_ref_date": "March–April 2026 (approximate reference)",
        "price_source": "DAM Wholesale Potato Reference Price (Bangladesh)",
        "is_paddy_equivalent": False,
        "disclaimer": "Demo Prices — Not Actual Selling Prices",
    },
    "Wheat": {
        "market_unit": "kg",
        "price_bdt": 36.0,  # BDT per kg
        "price_ref_date": "April 2026 (approximate reference)",
        "price_source": "DAM Wholesale Wheat Reference Price (Bangladesh)",
        "is_paddy_equivalent": False,
        "disclaimer": "Demo Prices — Not Actual Selling Prices",
    },
    "Jute": {
        "market_unit": "kg",  # stored per kg after maund conversion
        "price_bdt": 103.5,  # midpoint: BDT 3,950/maund ÷ 37.3242 kg/maund ≈ 105.8 ~ 103.5 (use 3,862.5 avg)
        "price_ref_date": "October 2026 (approximate reference)",
        "price_source": "DAM Wholesale Raw Jute Reference Price (Bangladesh) — 1 maund = 37.3242 kg",
        "is_paddy_equivalent": False,
        "price_per_maund_bdt": 3862.5,  # midpoint of BDT 3,800–4,100/maund (reference range)
        "maund_to_kg": 37.3242,
        "disclaimer": "Demo Prices — Not Actual Selling Prices",
    },
}

# Soil & climate suitability notes per crop (qualitative, grounded in BD agricultural science)
CROP_SUITABILITY_NOTES = {
    "Boro Rice":  "Requires heavy irrigation; thrives in flat, low-lying areas with clay-loam soils. Best suited for river-delta and floodplain districts.",
    "Aman Rice":  "Rainfed; suited to seasonal flooding areas. Performs well in districts with reliable July–October monsoon rainfall.",
    "Aus Rice":   "Short-duration pre-monsoon crop; favoured in well-drained upland soils with moderate rainfall.",
    "Potato":     "Cool-season crop; best in well-drained sandy loam soils at moderate elevations. Northern districts (Rangpur, Mymensingh) are traditional producers.",
    "Wheat":      "Cool, dry conditions required; best in fertile alluvial soils. Suited to Rajshahi and northern river-plain districts.",
    "Jute":       "Demands warm, humid climate and loamy/silty soils near rivers. Classic crop of Dhaka, Mymensingh, and Faridpur regions.",
}

# Approximate cultivation cost reference (BDT per hectare) — illustrative only
APPROX_CULTIVATION_COST_BDT_HA = {
    "Boro Rice":  70_000,
    "Aman Rice":  45_000,
    "Aus Rice":   40_000,
    "Potato":     150_000,
    "Wheat":      40_000,
    "Jute":       35_000,
}


def compute_paddy_equivalent_yield(crop: str, yield_t_ha: float) -> float:
    """
    For rice crops, convert rice-equivalent yield (EXP_36 output) to paddy-equivalent
    using the BBS statistical conversion: paddy = rice × 3/2.
    For non-rice crops, return yield unchanged.
    """
    if crop in ("Boro Rice", "Aman Rice", "Aus Rice"):
        return round(yield_t_ha / RICE_EQUIVALENT_FACTOR, 4)  # = yield × 1.5
    return yield_t_ha


def compute_jute_price_per_kg(price_info: dict) -> float:
    """Return BDT per kg for jute using the maund conversion."""
    ppm = price_info.get("price_per_maund_bdt", 3862.5)
    m2k = price_info.get("maund_to_kg", 37.3242)
    return round(ppm / m2k, 4)


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
    zero_area = str(r.get("Reported_Zero_District_Area", "")).lower() in ("true", "1")
    crop_mae = float(data_store.crop_mae_map.get(crop, 0.214))
    if crop_mae:
        mae_rounded = round(crop_mae, 2)
        error_tooltip = (
            "This is an estimate, so the actual harvest may be higher or lower. "
            f"In past tests, predictions differed from actual yields by about {mae_rounded:.2f} tonnes per hectare on average."
        )
    else:
        error_tooltip = "Historical error not available."

    explanation = data_store.generate_explanation(
        canonical_dist,
        crop,
        str(r.get("Display_Season", "Rabi 2026–27")),
        yield_val,
        zero_area,
    )

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
        crop_historical_mae_t_ha=round(crop_mae, 3),
        prediction_error_label="Typical Yield Difference",
        prediction_error_tooltip=error_tooltip,
        calibrated_interval_available=False,
        explanation=explanation,
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

        zero_area = str(r.get("Reported_Zero_District_Area", "")).lower() in ("true", "1")
        crop_mae = float(data_store.crop_mae_map.get(str(r["Crop"]), 0.214))
        if crop_mae:
            mae_rounded = round(crop_mae, 2)
            all_error_tooltip = (
                "This is an estimate, so the actual harvest may be higher or lower. "
                f"In past tests, predictions differed from actual yields by about {mae_rounded:.2f} tonnes per hectare on average."
            )
        else:
            all_error_tooltip = "Historical error not available."

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
                crop_historical_mae_t_ha=round(crop_mae, 3),
                prediction_error_label="Typical Yield Difference",
                prediction_error_tooltip=all_error_tooltip,
                calibrated_interval_available=False,
                explanation=None,
            )
        )

    return results

@app.get("/api/district-explorer")
def get_district_explorer(
    crop: str = Query("Boro Rice", description="Crop name"),
    season: Optional[str] = Query(None, description="Season label or name filter"),
):
    """Returns district-explorer enriched records: all 64 districts for the given crop, with
    division metadata, rank, and normalised yield tier for choropleth colouring."""
    if crop not in CROP_SEASON:
        raise HTTPException(status_code=400, detail=f"Unknown crop: '{crop}'. Available: {list(CROP_SEASON.keys())}")

    df = data_store.df_predictions[data_store.df_predictions["Crop"] == crop].copy()
    if season:
        clean_s = season.strip()
        df = df[
            df["Display_Season"].str.contains(clean_s, case=False, na=False) |
            df["Crop_Season"].str.contains(clean_s, case=False, na=False)
        ]

    if df.empty:
        return {"crop": crop, "season": season, "records": [], "summary": {}}

    # Verified Bangladesh District-to-Division mapping (covers all 64 districts + common spelling aliases)
    NORMALIZED_DIVISION_MAP: Dict[str, str] = {
        # Barishal Division (6)
        "barguna": "Barishal", "barishal": "Barishal", "barisal": "Barishal",
        "bhola": "Barishal", "jhalakathi": "Barishal", "jhalokati": "Barishal",
        "jhalokathi": "Barishal", "patuakhali": "Barishal", "pirojpur": "Barishal",

        # Chattogram Division (11)
        "bandarban": "Chattogram", "brahmanbaria": "Chattogram", "brahamanbaria": "Chattogram",
        "chandpur": "Chattogram", "chattogram": "Chattogram", "chittagong": "Chattogram",
        "cumilla": "Chattogram", "comilla": "Chattogram", "coxsbazar": "Chattogram",
        "coxsbazar": "Chattogram", "feni": "Chattogram", "khagrachari": "Chattogram",
        "khagrachhari": "Chattogram", "lakshmipur": "Chattogram", "laxmipur": "Chattogram",
        "noakhali": "Chattogram", "rangamati": "Chattogram",

        # Dhaka Division (13)
        "dhaka": "Dhaka", "faridpur": "Dhaka", "gazipur": "Dhaka",
        "gopalganj": "Dhaka", "kishoreganj": "Dhaka", "kishoregonj": "Dhaka",
        "madaripur": "Dhaka", "manikganj": "Dhaka", "manikgonj": "Dhaka",
        "munshiganj": "Dhaka", "munshigonj": "Dhaka", "narayanganj": "Dhaka",
        "narayangonj": "Dhaka", "narsingdi": "Dhaka", "rajbari": "Dhaka",
        "shariatpur": "Dhaka", "tangail": "Dhaka",

        # Khulna Division (10)
        "bagerhat": "Khulna", "chuadanga": "Khulna", "jashore": "Khulna",
        "jessore": "Khulna", "jhenaidah": "Khulna", "khulna": "Khulna",
        "kushtia": "Khulna", "magura": "Khulna", "meherpur": "Khulna",
        "narail": "Khulna", "satkhira": "Khulna",

        # Mymensingh Division (4)
        "jamalpur": "Mymensingh", "mymensingh": "Mymensingh",
        "netrokona": "Mymensingh", "netrakona": "Mymensingh", "sherpur": "Mymensingh",

        # Rajshahi Division (8)
        "bogura": "Rajshahi", "bogra": "Rajshahi", "chapainawabganj": "Rajshahi",
        "nawabganj": "Rajshahi", "joypurhat": "Rajshahi", "naogaon": "Rajshahi",
        "natore": "Rajshahi", "pabna": "Rajshahi", "rajshahi": "Rajshahi",
        "sirajganj": "Rajshahi", "sirajgonj": "Rajshahi",

        # Rangpur Division (8)
        "dinajpur": "Rangpur", "gaibandha": "Rangpur", "kurigram": "Rangpur",
        "lalmonirhat": "Rangpur", "nilphamari": "Rangpur", "panchagarh": "Rangpur",
        "rangpur": "Rangpur", "thakurgaon": "Rangpur",

        # Sylhet Division (4)
        "habiganj": "Sylhet", "habigonj": "Sylhet", "moulvibazar": "Sylhet",
        "maulvibazar": "Sylhet", "sunamganj": "Sylhet", "sunamgonj": "Sylhet",
        "sylhet": "Sylhet",
    }

    crop_mae = float(data_store.crop_mae_map.get(crop, 0.214))
    raw_records = []

    for _, r in df.iterrows():
        district_name = str(r["District"])
        norm_key = norm_name(district_name)
        division = NORMALIZED_DIVISION_MAP.get(norm_key, "Unknown")

        yield_val = float(r["Predicted_Yield_t_ha"])
        area_val = float(r["Latest_District_Area_Hectares"])
        prod_val = float(r["District_Production_tonnes"])
        zero_area = str(r.get("Reported_Zero_District_Area", "")).lower() in ("true", "1")

        warnings = []
        if zero_area:
            warnings.append("No reported district crop area.")
        if str(r.get("Long_Horizon_Warning", "")).lower() in ("true", "1"):
            warnings.append("Long lead time.")

        raw_records.append({
            "district": district_name,
            "division": division,
            "crop": str(r["Crop"]),
            "season": str(r["Crop_Season"]),
            "display_season": str(r.get("Display_Season", "")),
            "predicted_yield_t_ha": round(yield_val, 3),
            "assumed_district_area_ha": round(area_val, 1),
            "estimated_district_production_tonnes": round(prod_val, 1),
            "crop_historical_mae_t_ha": round(crop_mae, 3),
            "district_area_status": str(r.get("District_Area_Status", "POSITIVE_REPORTED_AREA")),
            "zero_area": zero_area,
            "warnings": warnings,
            "recheck_recommendation": str(r.get("Recheck_Recommendation", "")),
            "forecast_as_of_month": str(r.get("Forecast_As_Of_Month", "2026-09-01")),
        })

    if not raw_records:
        return {"crop": crop, "season": season, "records": [], "summary": {}}

    # 1. Deterministic sequential ranking across all 64 districts:
    # Primary: predicted_yield_t_ha desc
    # Secondary (tie-breaker): estimated_district_production_tonnes desc
    # Tertiary (tie-breaker): district name asc
    sorted_for_ranking = sorted(
        raw_records,
        key=lambda x: (-x["predicted_yield_t_ha"], -x["estimated_district_production_tonnes"], x["district"]),
    )

    all_yields = [r["predicted_yield_t_ha"] for r in sorted_for_ranking]
    min_y = min(all_yields)
    max_y = max(all_yields)
    yield_range = max_y - min_y if max_y != min_y else 1.0

    # 2. National 64-district median yield reference (consistent regardless of user filters)
    import statistics as _stats
    median_yield = round(float(_stats.median(all_yields)), 3) if all_yields else 0.0

    records = []
    for rank_idx, rec in enumerate(sorted_for_ranking, start=1):
        y = rec["predicted_yield_t_ha"]
        rec["national_rank"] = rank_idx
        rec["yield_tier"] = min(4, int(4 * (y - min_y) / yield_range))

        diff = round(y - median_yield, 3)
        pct = round((diff / median_yield) * 100, 1) if median_yield > 0 else 0.0
        rec["median_yield_t_ha"] = median_yield
        rec["yield_vs_median_t_ha"] = diff
        rec["yield_vs_median_pct"] = pct
        if abs(diff) <= 0.01:
            rec["yield_comparison_label"] = "Near median"
        elif diff > 0:
            rec["yield_comparison_label"] = f"+{diff:.2f} t/ha (+{pct:.1f}%)"
        else:
            rec["yield_comparison_label"] = f"{diff:.2f} t/ha ({pct:.1f}%)"

        records.append(rec)

    # 3. Dynamic Date-Aware Forecast Advisory (EXP_38)
    season_name = records[0]["season"] if records else "Rabi"
    target_year = int(df["Target_Year_Start"].iloc[0]) if not df.empty and "Target_Year_Start" in df.columns else (2027 if season_name in ("Kharif-I", "Kharif-II") else 2026)
    order_val = int(df["Planning_Order"].iloc[0]) if not df.empty and "Planning_Order" in df.columns else (1 if season_name == "Rabi" else 2 if season_name == "Kharif-I" else 3)

    advisory_info = calculate_forecast_advisory(
        season_name=season_name,
        target_year_start=target_year,
        planning_order=order_val,
    )

    # 4. Summary statistics
    summary = {
        "crop": crop,
        "total_districts": len(records),
        "season": records[0]["display_season"] if records else "",
        "national_avg_yield_t_ha": round(sum(all_yields) / len(all_yields), 3) if all_yields else 0,
        "national_median_yield_t_ha": median_yield,
        "national_max_yield_t_ha": round(max_y, 3),
        "national_min_yield_t_ha": round(min_y, 3),
        "national_total_production_tonnes": round(sum(r["estimated_district_production_tonnes"] for r in records), 1),
        "national_total_area_ha": round(sum(r["assumed_district_area_ha"] for r in records), 1),
        "districts_with_zero_area": sum(1 for r in records if r["zero_area"]),
        "crop_typical_diff_t_ha": round(crop_mae, 3),
        "divisions": sorted(set(r["division"] for r in records if r["division"] != "Unknown")),
        "early_forecast_advisory": advisory_info["message"],
        "advisory_case": advisory_info["case"],
        "recheck_recommended_date": advisory_info["recheck_date_str"],
        "season_start_date": advisory_info["season_start_date_str"],
    }

    return {"crop": crop, "season": season, "records": records, "summary": summary}


@app.get("/api/district-explorer/csv")
def get_district_explorer_csv(
    crop: str = Query("Boro Rice"),
    season: Optional[str] = Query(None),
):
    """Returns district-explorer data as a downloadable CSV with yield comparison and 64-district median."""
    from fastapi.responses import StreamingResponse
    import io, csv

    data = get_district_explorer(crop=crop, season=season)
    records = data.get("records", [])
    summary = data.get("summary", {})

    output = io.StringIO()
    if records:
        fieldnames = [
            "national_rank", "district", "division", "crop", "display_season",
            "predicted_yield_t_ha", "median_yield_t_ha", "yield_vs_median_t_ha",
            "yield_vs_median_pct", "yield_comparison_label",
            "estimated_district_production_tonnes", "assumed_district_area_ha",
            "crop_historical_mae_t_ha", "district_area_status",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for rec in sorted(records, key=lambda x: x.get("national_rank", 99)):
            writer.writerow(dict(rec))

    output.seek(0)
    safe_season = str(summary.get("season", "forecast")).replace("–", "-").replace("—", "-").replace(" ", "_")
    safe_crop = crop.replace(" ", "_")
    filename = f"bangladesh_crop_outlook_{safe_crop}_{safe_season}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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

    return {
        "district": canonical_dist,
        "variables": summary,
        "variable_freshness": data_store.variable_freshness,
    }

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
        variable_freshness=data_store.variable_freshness,
        crop_evaluation_metrics=data_store.crop_evaluation_metrics,
        rf_overall_metrics=data_store.rf_overall_metrics,
    )


@app.get("/api/history", response_model=HistoricalTrendsResponse)
def get_historical_trends(
    district: str = Query("Tangail", description="District name"),
    crop: str = Query("Aman Rice", description="Crop name"),
    years: Optional[int] = Query(19, ge=1, le=50, description="Latest N crop-year records (default 19)"),
    start_year: Optional[str] = Query(None, description="Optional start crop-year e.g. 2006-2007"),
    end_year: Optional[str] = Query(None, description="Optional end crop-year e.g. 2025-2026"),
):
    """Returns verified historical crop yield and season-aligned environmental observations for a district and crop."""
    norm_d = norm_name(district)
    is_national = norm_d in (
        "bangladesh", "allbangladesh", "national", "allbangladeshnational", "bangladeshnational"
    )
    if is_national:
        canonical_dist = "All Bangladesh (National)"
        norm_dist = "all bangladesh"
    else:
        norm_dist = norm_d
        if norm_dist not in data_store.district_norm_map:
            raise HTTPException(status_code=404, detail=f"Unknown district: '{district}'")
        canonical_dist = data_store.district_norm_map[norm_dist]

    if crop not in CROP_SEASON:
        raise HTTPException(status_code=400, detail=f"Unknown crop: '{crop}'. Available: {list(CROP_SEASON.keys())}")
    season = CROP_SEASON[crop]

    if data_store.df_historical is None:
        raise HTTPException(status_code=500, detail="Historical agriculture data unavailable on server.")

    if is_national:
        sub_crop = data_store.df_historical[data_store.df_historical["Crop"] == crop].copy()
        sub = sub_crop.groupby("agri_year").agg({
            "Production": "sum",
            "Area_Hectares": "sum",
            "rainfall_mm": "mean",
            "temperature_c": "mean",
            "ndvi": "mean",
            "soil_moisture_7_28cm": "mean",
        }).reset_index().sort_values("agri_year")
        sub["Yield_Hectare"] = sub["Production"] / sub["Area_Hectares"]
    else:
        sub = data_store.df_historical[
            (data_store.df_historical["norm_district"] == norm_dist) &
            (data_store.df_historical["Crop"] == crop)
        ].sort_values("agri_year").copy()

    all_available_years = sub["agri_year"].dropna().tolist()

    range_label = f"Latest {years} Years" if years else "All Available"
    if start_year and end_year:
        range_label = f"{start_year} to {end_year}"
        sub = sub[(sub["agri_year"] >= start_year) & (sub["agri_year"] <= end_year)]
    elif start_year:
        range_label = f"From {start_year}"
        sub = sub[sub["agri_year"] >= start_year]
    elif end_year:
        range_label = f"Up to {end_year}"
        sub = sub[sub["agri_year"] <= end_year]
    elif years is not None and years > 0:
        sub = sub.tail(years)

    records: List[HistoricalRecordItem] = []
    for _, r in sub.iterrows():
        ay = str(r["agri_year"])
        parts = ay.split("-")
        short_y = f"{parts[0]}–{parts[1][-2:]}" if len(parts) == 2 else ay

        raw_yield = r.get("Yield_Hectare")
        yield_val: Optional[float] = None
        if pd.notna(raw_yield) and float(raw_yield) > 0:
            yield_val = round(float(raw_yield), 3)

        raw_rain = r.get("rainfall_mm")
        rain_val = round(float(raw_rain), 2) if pd.notna(raw_rain) else None

        raw_temp = r.get("temperature_c")
        temp_val = round(float(raw_temp), 2) if pd.notna(raw_temp) else None

        raw_ndvi = r.get("ndvi")
        ndvi_val = round(float(raw_ndvi), 4) if pd.notna(raw_ndvi) else None

        raw_sm = r.get("soil_moisture_7_28cm")
        sm_val = round(float(raw_sm), 4) if pd.notna(raw_sm) else None

        # EVI lookup
        if is_national:
            evi_vals = [
                data_store.evi_seasonal_lookup.get((d, season, ay))
                for d in data_store.district_norm_map.keys()
                if (d, season, ay) in data_store.evi_seasonal_lookup
            ]
            evi_val = round(sum(evi_vals) / len(evi_vals), 4) if evi_vals else None
        else:
            evi_val = data_store.evi_seasonal_lookup.get((norm_dist, season, ay))

        raw_area = r.get("Area_Hectares")
        area_val = round(float(raw_area), 1) if pd.notna(raw_area) and float(raw_area) > 0 else None

        raw_prod = r.get("Production")
        prod_val = round(float(raw_prod), 1) if pd.notna(raw_prod) and float(raw_prod) > 0 else None

        records.append(
            HistoricalRecordItem(
                crop_year=ay,
                short_year=short_y,
                district=canonical_dist,
                crop=crop,
                season=season,
                yield_t_ha=yield_val,
                rainfall_mm=rain_val,
                temperature_c=temp_val,
                ndvi=ndvi_val,
                evi=evi_val,
                soil_moisture_7_28cm=sm_val,
                area_hectares=area_val,
                production_tonnes=prod_val,
                is_forecast=False,
            )
        )

    # Summary metrics calculation
    valid_yields = [(rec.yield_t_ha, rec.crop_year) for rec in records if rec.yield_t_ha is not None]
    if valid_yields:
        y_vals = [y for y, _ in valid_yields]
        avg_y = round(sum(y_vals) / len(y_vals), 3)
        max_y = max(y_vals)
        max_yr = next(yr for y, yr in valid_yields if y == max_y)
        min_y = min(y_vals)
        min_yr = next(yr for y, yr in valid_yields if y == min_y)
        earliest_y, earliest_yr = valid_yields[0]
        latest_y, latest_yr = valid_yields[-1]
        chg_t = round(latest_y - earliest_y, 3) if len(valid_yields) > 1 else 0.0
        chg_pct = round(((latest_y - earliest_y) / earliest_y) * 100, 1) if earliest_y > 0 and len(valid_yields) > 1 else 0.0

        summary = HistoricalSummary(
            total_records=len(records),
            valid_yield_count=len(valid_yields),
            avg_yield_t_ha=avg_y,
            highest_yield_t_ha=max_y,
            highest_year=max_yr,
            lowest_yield_t_ha=min_y,
            lowest_year=min_yr,
            latest_yield_t_ha=latest_y,
            latest_year=latest_yr,
            earliest_yield_t_ha=earliest_y,
            earliest_year=earliest_yr,
            change_t_ha=chg_t,
            change_pct=chg_pct,
            has_insufficient_records=len(valid_yields) < 2,
            note="Historical summary derived from verified BBS agricultural records." if len(valid_yields) >= 2 else "Limited historical records for selected range.",
        )
    else:
        summary = HistoricalSummary(
            total_records=len(records),
            valid_yield_count=0,
            has_insufficient_records=True,
            note="No valid positive yield records available for this selection.",
        )

    # Forecast Marker from verified EXP_36 predictions
    forecast_marker: Optional[ForecastMarkerItem] = None
    if is_national:
        pred_sub = data_store.df_predictions[data_store.df_predictions["Crop"] == crop]
        if not pred_sub.empty:
            pr = pred_sub.iloc[0]
            t_yr = int(pr["Target_Year_Start"])
            fc_crop_year = f"{t_yr}–{t_yr + 1} (Forecast)"
            tot_prod = pred_sub["District_Production_tonnes"].sum()
            tot_area = pred_sub["Latest_District_Area_Hectares"].sum()
            national_yield = round(tot_prod / tot_area, 2) if tot_area > 0 else round(float(pred_sub["Predicted_Yield_t_ha"].mean()), 2)
            forecast_marker = ForecastMarkerItem(
                crop_year=fc_crop_year,
                display_season=str(pr["Display_Season"]),
                predicted_yield_t_ha=national_yield,
                district="All Bangladesh (National)",
                crop=crop,
                season=season,
                label="EXP_36 National Forecast",
            )
    else:
        pred_sub = data_store.df_predictions[
            (data_store.df_predictions["District"] == canonical_dist) &
            (data_store.df_predictions["Crop"] == crop)
        ]
        if not pred_sub.empty:
            pr = pred_sub.iloc[0]
            t_yr = int(pr["Target_Year_Start"])
            fc_crop_year = f"{t_yr}–{t_yr + 1} (Forecast)"
            forecast_marker = ForecastMarkerItem(
                crop_year=fc_crop_year,
                display_season=str(pr["Display_Season"]),
                predicted_yield_t_ha=round(float(pr["Predicted_Yield_t_ha"]), 3),
                district=canonical_dist,
                crop=crop,
                season=season,
                label="EXP_36 Forecast",
            )

    env_vars = {
        "rainfall_mm": {"label": "Seasonal Rainfall", "unit": "mm", "source": "ERA5-Land (ECMWF)"},
        "temperature_c": {"label": "Mean Temperature", "unit": "°C", "source": "ERA5-Land (ECMWF)"},
        "ndvi": {"label": "NDVI Vegetation Index", "unit": "index", "source": "MODIS MOD13A3 (NASA)"},
        "evi": {"label": "EVI Vegetation Index", "unit": "index", "source": "MODIS MOD13A3 (NASA)"},
        "soil_moisture_7_28cm": {"label": "Soil Moisture (7–28 cm)", "unit": "m³/m³", "source": "ERA5-Land (ECMWF)"},
    }

    provenance = {
        "agriculture": "Bangladesh Bureau of Statistics (BBS) 2006–2026",
        "rainfall": "ERA5-Land Total Precipitation (ECMWF)",
        "temperature": "ERA5-Land 2m Temperature (ECMWF)",
        "ndvi": "NASA MODIS MOD13A3 Monthly NDVI (1 km)",
        "evi": "NASA MODIS MOD13A3 Monthly EVI (1 km)",
        "soil_moisture": "ERA5-Land Volumetric Soil Water Layer 2 (7–28 cm)",
        "forecast": "EXP_36 Operational Random Forest & SARIMA Model Release",
        "season_alignment": f"{crop} historical records aligned to {season} modeling window ({'March–July' if season=='Kharif-I' else 'July–October' if season=='Kharif-II' else 'October–March of following year'})",
    }

    return HistoricalTrendsResponse(
        district=canonical_dist,
        crop=crop,
        season=season,
        selected_range=range_label,
        available_years=all_available_years,
        records=records,
        forecast_marker=forecast_marker,
        summary=summary,
        environmental_variables=env_vars,
        provenance=provenance,
    )


@app.get("/api/history/csv")
def export_historical_csv(
    district: str = Query("Tangail", description="District name"),
    crop: str = Query("Aman Rice", description="Crop name"),
    years: Optional[int] = Query(19, ge=1, le=50),
    start_year: Optional[str] = Query(None),
    end_year: Optional[str] = Query(None),
):
    """Exports actual unrounded historical records and environmental variables as a downloadable CSV."""
    norm_d = norm_name(district)
    is_national = norm_d in (
        "bangladesh", "allbangladesh", "national", "allbangladeshnational", "bangladeshnational"
    )
    if is_national:
        canonical_dist = "All Bangladesh (National)"
        norm_dist = "all bangladesh"
    else:
        norm_dist = norm_d
        if norm_dist not in data_store.district_norm_map:
            raise HTTPException(status_code=404, detail=f"Unknown district: '{district}'")
        canonical_dist = data_store.district_norm_map[norm_dist]

    if crop not in CROP_SEASON:
        raise HTTPException(status_code=400, detail=f"Unknown crop: '{crop}'")
    season = CROP_SEASON[crop]

    if data_store.df_historical is None:
        raise HTTPException(status_code=500, detail="Historical agriculture data unavailable.")

    if is_national:
        sub_crop = data_store.df_historical[data_store.df_historical["Crop"] == crop].copy()
        sub = sub_crop.groupby("agri_year").agg({
            "Production": "sum",
            "Area_Hectares": "sum",
            "rainfall_mm": "mean",
            "temperature_c": "mean",
            "ndvi": "mean",
            "soil_moisture_7_28cm": "mean",
        }).reset_index().sort_values("agri_year")
        sub["Yield_Hectare"] = sub["Production"] / sub["Area_Hectares"]
    else:
        sub = data_store.df_historical[
            (data_store.df_historical["norm_district"] == norm_dist) &
            (data_store.df_historical["Crop"] == crop)
        ].sort_values("agri_year").copy()

    if start_year and end_year:
        sub = sub[(sub["agri_year"] >= start_year) & (sub["agri_year"] <= end_year)]
    elif start_year:
        sub = sub[sub["agri_year"] >= start_year]
    elif end_year:
        sub = sub[sub["agri_year"] <= end_year]
    elif years is not None and years > 0:
        sub = sub.tail(years)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Crop_Year",
        "District",
        "Crop",
        "Season",
        "Actual_Yield_t_ha",
        "Seasonal_Rainfall_mm",
        "Mean_Temperature_C",
        "NDVI_Index",
        "EVI_Index",
        "Soil_Moisture_7_28cm_m3_m3",
        "Cultivated_Area_ha",
        "Actual_Production_tonnes",
        "Record_Provenance",
    ])

    for _, r in sub.iterrows():
        ay = str(r["agri_year"])
        raw_y = r.get("Yield_Hectare")
        y_str = f"{float(raw_y):.4f}" if pd.notna(raw_y) and float(raw_y) > 0 else ""

        raw_rain = r.get("rainfall_mm")
        rain_str = f"{float(raw_rain):.2f}" if pd.notna(raw_rain) else ""

        raw_temp = r.get("temperature_c")
        temp_str = f"{float(raw_temp):.2f}" if pd.notna(raw_temp) else ""

        raw_ndvi = r.get("ndvi")
        ndvi_str = f"{float(raw_ndvi):.4f}" if pd.notna(raw_ndvi) else ""

        if is_national:
            evi_vals = [
                data_store.evi_seasonal_lookup.get((d, season, ay))
                for d in data_store.district_norm_map.keys()
                if (d, season, ay) in data_store.evi_seasonal_lookup
            ]
            evi_val = sum(evi_vals) / len(evi_vals) if evi_vals else None
        else:
            evi_val = data_store.evi_seasonal_lookup.get((norm_dist, season, ay))
        evi_str = f"{evi_val:.4f}" if evi_val is not None else ""

        raw_sm = r.get("soil_moisture_7_28cm")
        sm_str = f"{float(raw_sm):.4f}" if pd.notna(raw_sm) else ""

        raw_area = r.get("Area_Hectares")
        area_str = f"{float(raw_area):.2f}" if pd.notna(raw_area) and float(raw_area) > 0 else ""

        raw_prod = r.get("Production")
        prod_str = f"{float(raw_prod):.2f}" if pd.notna(raw_prod) and float(raw_prod) > 0 else ""

        writer.writerow([
            ay,
            canonical_dist,
            crop,
            season,
            y_str,
            rain_str,
            temp_str,
            ndvi_str,
            evi_str,
            sm_str,
            area_str,
            prod_str,
            "Observed Historical (BBS/ERA5/MODIS)",
        ])

    output.seek(0)
    safe_dist = canonical_dist.replace(" ", "_").replace("(", "").replace(")", "").replace("'", "")
    safe_crop = crop.replace(" ", "_")
    filename = f"historical_trends_{safe_dist}_{safe_crop}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Smart Crop & Season Planner Endpoint ─────────────────────────────────────

@app.get("/api/planner")
def get_planner(
    district: str = Query("Dinajpur", description="District name (or 'Bangladesh' for national average)"),
    area_ha: float = Query(1.0, gt=0, le=100_000, description="Field area in hectares"),
    cultivation_cost_bdt_ha: Optional[float] = Query(
        None, ge=0, description="Optional user-entered cultivation cost in BDT per hectare"
    ),
):
    """
    Smart Crop & Season Planner.
    Returns all 6 EXP_36 crops available for the given district with verified yield forecasts,
    BBS paddy-equivalent conversion for rice crops, demo prices, and illustrative economics.
    """
    norm_dist = norm_name(district)
    is_national = norm_dist in (
        "bangladesh", "allbangladesh", "national", "allbangladeshnational", "bangladeshnational"
    )

    if is_national:
        canonical_dist = "All Bangladesh (National Average)"
    else:
        if norm_dist not in data_store.district_norm_map:
            raise HTTPException(status_code=404, detail=f"Unknown district: '{district}'. Available: 64 Bangladesh districts.")
        canonical_dist = data_store.district_norm_map[norm_dist]

    crop_results = []

    for crop, season in CROP_SEASON.items():
        # 1. Get EXP_36 yield forecast
        if is_national:
            pred_sub = data_store.df_predictions[data_store.df_predictions["Crop"] == crop]
            if pred_sub.empty:
                continue
            tot_prod = float(pred_sub["District_Production_tonnes"].sum())
            tot_area = float(pred_sub["Latest_District_Area_Hectares"].sum())
            yield_t_ha = round(tot_prod / tot_area, 3) if tot_area > 0 else round(float(pred_sub["Predicted_Yield_t_ha"].mean()), 3)
            display_season_val = str(pred_sub.iloc[0].get("Display_Season", ""))
            target_yr = int(pred_sub.iloc[0].get("Target_Year_Start", 2026))
            zero_area = False
            warnings_list: List[str] = []
        else:
            pred_row = data_store.df_predictions[
                (data_store.df_predictions["District"] == canonical_dist) &
                (data_store.df_predictions["Crop"] == crop)
            ]
            if pred_row.empty:
                continue
            pr = pred_row.iloc[0]
            yield_t_ha = round(float(pr["Predicted_Yield_t_ha"]), 3)
            display_season_val = str(pr.get("Display_Season", ""))
            target_yr = int(pr.get("Target_Year_Start", 2026))
            zero_area = str(pr.get("Reported_Zero_District_Area", "")).lower() in ("true", "1")
            warnings_list = []
            if zero_area:
                warnings_list.append("No reported district crop area — yield is a conditional estimate.")
            if str(pr.get("Long_Horizon_Warning", "")).lower() in ("true", "1"):
                warnings_list.append("Long lead time — recheck when new observations arrive.")

        # 2. BBS paddy-equivalent conversion for rice crops
        is_rice = crop in ("Boro Rice", "Aman Rice", "Aus Rice")
        paddy_equiv_yield_t_ha: Optional[float] = None
        conversion_note = ""
        if is_rice:
            paddy_equiv_yield_t_ha = compute_paddy_equivalent_yield(crop, yield_t_ha)
            conversion_note = (
                f"EXP_36 yield ({yield_t_ha:.3f} t/ha) is rice-equivalent. "
                f"BBS statistical conversion applied: Paddy = Rice x 3/2 = {paddy_equiv_yield_t_ha:.3f} t/ha. "
                f"Source: BBS Yearbook of Agricultural Statistics 2016, Ch.1."
            )

        # 3. Field production
        economic_yield_t_ha = paddy_equiv_yield_t_ha if is_rice else yield_t_ha
        field_production_tonnes = round(economic_yield_t_ha * area_ha, 3)
        field_production_kg = round(field_production_tonnes * 1000, 1)

        field_production_maunds: Optional[float] = None
        if crop == "Jute":
            maund_to_kg = DEMO_PRICES["Jute"].get("maund_to_kg", 37.3242)
            field_production_maunds = round(field_production_kg / maund_to_kg, 2)

        # 4. Demo price & estimated sales value
        price_info = DEMO_PRICES.get(crop, {})
        price_per_kg_bdt: float = 0.0
        if crop == "Jute":
            price_per_kg_bdt = compute_jute_price_per_kg(price_info)
        else:
            price_per_kg_bdt = float(price_info.get("price_bdt", 0.0))

        estimated_sales_bdt = round(field_production_kg * price_per_kg_bdt)
        estimated_sales_per_ha_bdt = round(estimated_sales_bdt / area_ha) if area_ha > 0 else 0

        # 5. Cultivation cost & net return
        approx_ref_cost_bdt_ha = APPROX_CULTIVATION_COST_BDT_HA.get(crop, 50_000)
        if cultivation_cost_bdt_ha is not None and cultivation_cost_bdt_ha >= 0:
            total_cost_bdt = round(cultivation_cost_bdt_ha * area_ha)
            net_return_bdt_val: Optional[int] = round(estimated_sales_bdt - total_cost_bdt)
            net_return_per_ha_bdt_val: Optional[int] = round(net_return_bdt_val / area_ha) if area_ha > 0 else 0
            net_return_label = "Illustrative Net Return"
            net_return_note = "Net return = Estimated Sales Value minus entered cultivation cost. Does not include selling or marketing expenses."
        else:
            total_cost_bdt = None
            net_return_bdt_val = None
            net_return_per_ha_bdt_val = None
            net_return_label = None
            net_return_note = None

        # 6. Historical recent average yield (last 3 years)
        recent_avg_yield: Optional[float] = None
        if data_store.df_historical is not None and not is_national:
            hist_sub = data_store.df_historical[
                (data_store.df_historical["norm_district"] == norm_dist) &
                (data_store.df_historical["Crop"] == crop)
            ].sort_values("agri_year")
            if not hist_sub.empty:
                recent_vals = [
                    float(y) for y in hist_sub["Yield_Hectare"].dropna().tail(3).tolist()
                    if float(y) > 0
                ]
                if recent_vals:
                    recent_avg_yield = round(sum(recent_vals) / len(recent_vals), 3)

        # 7. MAE
        crop_mae = round(float(data_store.crop_mae_map.get(crop, 0.214)), 3)

        crop_results.append({
            "crop": crop,
            "season": season,
            "display_season": display_season_val,
            "target_year_start": target_yr,
            "predicted_yield_t_ha": yield_t_ha,
            "is_rice_crop": is_rice,
            "paddy_equiv_yield_t_ha": paddy_equiv_yield_t_ha,
            "conversion_note": conversion_note,
            "area_ha": area_ha,
            "field_production_tonnes": field_production_tonnes,
            "field_production_kg": field_production_kg,
            "field_production_maunds": field_production_maunds,
            "price_per_kg_bdt": round(price_per_kg_bdt, 4),
            "price_ref_date": price_info.get("price_ref_date", ""),
            "price_source": price_info.get("price_source", ""),
            "price_disclaimer": "Demo Prices — Not Actual Selling Prices",
            "price_per_maund_bdt": price_info.get("price_per_maund_bdt") if crop == "Jute" else None,
            "maund_to_kg": price_info.get("maund_to_kg") if crop == "Jute" else None,
            "estimated_sales_bdt": estimated_sales_bdt,
            "estimated_sales_per_ha_bdt": estimated_sales_per_ha_bdt,
            "estimated_sales_label": "Estimated Sales Value",
            "estimated_sales_note": "Before cultivation and selling expenses.",
            "approx_ref_cost_bdt_ha": approx_ref_cost_bdt_ha,
            "user_cost_bdt_ha": cultivation_cost_bdt_ha,
            "total_cost_bdt": total_cost_bdt,
            "net_return_bdt": net_return_bdt_val,
            "net_return_per_ha_bdt": net_return_per_ha_bdt_val,
            "net_return_label": net_return_label,
            "net_return_note": net_return_note,
            "recent_avg_yield_t_ha": recent_avg_yield,
            "suitability_note": CROP_SUITABILITY_NOTES.get(crop, ""),
            "crop_mae_t_ha": crop_mae,
            "zero_area": zero_area,
            "warnings": warnings_list,
        })

    # 8. Smart ranking by estimated sales value (descending)
    crop_results.sort(key=lambda x: -x["estimated_sales_bdt"])
    for i, item in enumerate(crop_results):
        item["planner_rank"] = i + 1

    seasons_present = sorted(set(r["season"] for r in crop_results))

    methodology = {
        "rice_conversion": "EXP_36 rice crop yields are expressed as rice-equivalent output. BBS statistical conversion (Paddy = Rice x 3/2) is applied. Source: BBS Yearbook of Agricultural Statistics 2016, Ch.1.",
        "jute_maund_conversion": "Jute prices are quoted per maund (1 maund = 37.3242 kg). Price per kg = per-maund price / 37.3242.",
        "pricing": "All prices shown are historical demonstration references only. They do not represent actual or future market selling prices.",
        "sales_vs_net_return": "Estimated Sales Value = forecasted production x demo price. This is BEFORE expenses. Illustrative Net Return = Sales - user cultivation cost (only computed when cost is supplied).",
        "forecast_basis": "All yield values are from verified EXP_36 Random Forest forecasts. No model retraining or modification has been performed.",
        "ranking_basis": "Planner ranking is based on Estimated Sales Value for the given area, using demo prices and BBS conversion. Illustrative only.",
    }

    return {
        "district": canonical_dist,
        "area_ha": area_ha,
        "cultivation_cost_bdt_ha_provided": cultivation_cost_bdt_ha is not None,
        "seasons": seasons_present,
        "crops": crop_results,
        "total_crops": len(crop_results),
        "top_crop": crop_results[0]["crop"] if crop_results else None,
        "top_crop_sales_bdt": crop_results[0]["estimated_sales_bdt"] if crop_results else None,
        "global_disclaimer": "This planner uses verified EXP_36 forecasts, BBS statistical conversion factors, and historical demonstration prices. It is for educational and planning purposes only. It does not constitute financial, agronomic, or investment advice.",
        "methodology": methodology,
        "price_data_as_of": "Demo prices from DAM reference records (various dates 2025-2026)",
        "rice_equivalent_factor": RICE_EQUIVALENT_FACTOR,
        "paddy_conversion_factor": round(1.0 / RICE_EQUIVALENT_FACTOR, 6),
    }
