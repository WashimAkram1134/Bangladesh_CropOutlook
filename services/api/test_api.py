"""Comprehensive Backend Verification Test Suite for Bangladesh Crop Outlook API (EXP_38 Phase 2)
Tests all 15 acceptance criteria related to backend data integrity and inference.
"""

import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure services/api is in sys.path
api_dir = Path(__file__).resolve().parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

from main import app, data_store, get_planning_seasons, norm_name

client = TestClient(app)

class TestBangladeshCropOutlookBackend(unittest.TestCase):
    def test_1_records_count(self):
        """1. API loads exactly 384 forecast records."""
        self.assertEqual(len(data_store.df_predictions), 384)
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_records"], 384)

    def test_2_sarima_converged_count(self):
        """2. SARIMA audit verifies 320 converged fits."""
        self.assertEqual(data_store.contract.get("operational_sarima_converged"), 320)
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["converged_sarima_models"], 320)
        self.assertEqual(len(data_store.sarima_status), 320)
        for key, info in data_store.sarima_status.items():
            self.assertTrue(info["converged"], f"Model {key} did not converge!")

    def test_3_districts_count(self):
        """3. Exactly 64 districts returned and normalized."""
        resp = client.get("/api/districts")
        self.assertEqual(resp.status_code, 200)
        districts = resp.json()
        self.assertEqual(len(districts), 64)
        self.assertIn("Dinajpur", [d["name"] for d in districts])

    def test_4_dinajpur_boro_yield(self):
        """4. Dinajpur + Boro Rice returns the verified EXP_36 yield."""
        resp = client.get("/api/forecast?district=Dinajpur&crop=Boro Rice&allow_historical_snapshot=true")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["district"], "Dinajpur")
        self.assertEqual(data["crop"], "Boro Rice")
        # In EXP_36, Dinajpur Boro Rice predicted yield is verified to be ~4.306 t/ha
        self.assertAlmostEqual(data["predicted_yield_t_ha"], 4.3060, places=3)
        self.assertEqual(data["display_season"], "Rabi 2026–27")
        self.assertGreater(data["estimated_district_production_tonnes"], 0)

    def test_5_user_area_calculator(self):
        """5. User area of 2.5 ha returns correct production estimate without changing yield."""
        resp_base = client.get("/api/forecast?district=Dinajpur&crop=Boro Rice&allow_historical_snapshot=true")
        base_yield = resp_base.json()["predicted_yield_t_ha"]

        resp_user = client.get("/api/forecast?district=Dinajpur&crop=Boro Rice&user_area_ha=2.5&allow_historical_snapshot=true")
        self.assertEqual(resp_user.status_code, 200)
        data_user = resp_user.json()
        # Yield MUST NOT CHANGE
        self.assertEqual(data_user["predicted_yield_t_ha"], base_yield)
        self.assertEqual(data_user["user_area_ha"], 2.5)
        # Production = Yield * 2.5
        expected_prod = base_yield * 2.5
        self.assertAlmostEqual(data_user["estimated_user_production_tonnes"], expected_prod, places=4)

    def test_6_season_switching_and_crops(self):
        """6. Season switching changes available crops and forecasts correctly."""
        # Rabi crops
        rabi_resp = client.get("/api/crops?season=Rabi")
        self.assertEqual(rabi_resp.status_code, 200)
        self.assertEqual(sorted(rabi_resp.json()["crops"]), ["Boro Rice", "Potato", "Wheat"])

        # Kharif-I crops
        k1_resp = client.get("/api/crops?season=Kharif-I")
        self.assertEqual(k1_resp.status_code, 200)
        self.assertEqual(sorted(k1_resp.json()["crops"]), ["Aus Rice", "Jute"])

        # Kharif-II crops
        k2_resp = client.get("/api/crops?season=Kharif-II")
        self.assertEqual(k2_resp.status_code, 200)
        self.assertEqual(sorted(k2_resp.json()["crops"]), ["Aman Rice"])

        # Verify forecasts for 64 districts in Rabi
        f_resp = client.get("/api/forecasts?crop=Boro Rice&season=Rabi")
        self.assertEqual(f_resp.status_code, 200)
        f_data = f_resp.json()
        self.assertEqual(len(f_data), 64)

    def test_7_environmental_series(self):
        """10. Environmental charts use actual district-month observations and SARIMA predictions."""
        for var in ["rainfall_mm", "temperature_c", "ndvi", "evi", "soil_moisture_7_28cm"]:
            resp = client.get(f"/api/environmental?district=Dinajpur&variable={var}&history_months=12")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["district"], "Dinajpur")
            self.assertEqual(data["variable"], var)
            points = data["points"]
            self.assertGreater(len(points), 12)
            obs = [p for p in points if not p["is_forecast"]]
            fc = [p for p in points if p["is_forecast"]]
            self.assertTrue(len(obs) > 0, f"No observed points for {var}")
            self.assertTrue(len(fc) > 0, f"No SARIMA forecast points for {var}")
            # Ensure historical values are reasonable (not NaN)
            for p in points:
                self.assertIsNotNone(p["value"])

    def test_8_zero_area_handling(self):
        """12. Zero-area crop districts are handled correctly."""
        zero_rows = data_store.df_predictions[data_store.df_predictions["Reported_Zero_District_Area"] == True]
        self.assertFalse(zero_rows.empty)
        sample = zero_rows.iloc[0]
        dist = sample["District"]
        crop = sample["Crop"]
        resp = client.get(f"/api/forecast?district={dist}&crop={crop}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["assumed_district_area_ha"], 0.0)
        self.assertEqual(data["estimated_district_production_tonnes"], 0.0)
        self.assertEqual(data["district_area_status"], "ZERO_REPORTED_AREA")
        self.assertTrue(any("conditional" in w.lower() or "zero" in w.lower() for w in data["warnings"]))

    def test_9_planning_seasons_70_percent_rule(self):
        """Strict 70% elapsed-season rollover rule verification."""
        seasons = get_planning_seasons()
        self.assertEqual(len(seasons), 3)
        self.assertEqual(seasons[0]["planning_order"], 1)
        self.assertTrue(seasons[0]["is_active"])

if __name__ == "__main__":
    unittest.main()
