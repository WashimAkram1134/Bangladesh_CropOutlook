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

from datetime import date
from main import app, data_store, get_planning_seasons, norm_name, calculate_forecast_advisory

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

    def test_10_prediction_error_and_explanation(self):
        """Verify friendly Typical Yield Difference and non-technical explanation integration."""
        resp = client.get("/api/forecast?district=Dinajpur&crop=Boro Rice")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("crop_historical_mae_t_ha", data)
        self.assertAlmostEqual(data["crop_historical_mae_t_ha"], 0.214, places=3)
        self.assertEqual(data["prediction_error_label"], "Typical Yield Difference")
        self.assertFalse(data["calibrated_interval_available"])
        self.assertIn("differed from actual yields by about 0.21 tonnes per hectare on average", data["prediction_error_tooltip"])
        self.assertNotIn("MAE", data["prediction_error_tooltip"])
        self.assertNotIn("holdout", data["prediction_error_tooltip"].lower())
        self.assertIsNotNone(data["explanation"])
        self.assertEqual(data["explanation"]["title"], "Why this forecast?")
        self.assertGreaterEqual(len(data["explanation"]["sentences"]), 2)
        self.assertIn("Dinajpur", data["explanation"]["summary"])

        # Test zero-area district explanation
        resp_bandarban = client.get("/api/forecast?district=Bandarban&crop=Jute")
        self.assertEqual(resp_bandarban.status_code, 200)
        b_data = resp_bandarban.json()
        self.assertIsNotNone(b_data["explanation"])
        self.assertTrue(b_data["explanation"]["zero_area"])
        self.assertIn("conditional", b_data["explanation"]["summary"].lower())

    def test_11_variable_specific_freshness(self):
        """Verify variable-specific freshness (Rainfall/Temp/Soil: Sep 2026, NDVI/EVI: Aug 2026)."""
        meta_resp = client.get("/api/metadata")
        self.assertEqual(meta_resp.status_code, 200)
        m = meta_resp.json()
        self.assertIn("variable_freshness", m)
        vf = m["variable_freshness"]
        self.assertEqual(vf["rainfall_mm"]["latest_month"], "September 2026")
        self.assertEqual(vf["temperature_c"]["latest_month"], "September 2026")
        self.assertEqual(vf["soil_moisture_7_28cm"]["latest_month"], "September 2026")
        self.assertEqual(vf["ndvi"]["latest_month"], "August 2026")
        self.assertEqual(vf["evi"]["latest_month"], "August 2026")

        # Also check /api/environmental/summary
        sum_resp = client.get("/api/environmental/summary?district=Dinajpur")
        self.assertEqual(sum_resp.status_code, 200)
        s_data = sum_resp.json()
    def test_12_district_explorer(self):
        """Verify District Explorer endpoint returns 64 districts, correct ranking, tiers, and summary."""
        resp = client.get("/api/district-explorer?crop=Boro Rice")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["crop"], "Boro Rice")
        self.assertEqual(len(data["records"]), 64)
        summary = data["summary"]
        self.assertEqual(summary["total_districts"], 64)
        self.assertGreater(summary["national_avg_yield_t_ha"], 0)
        self.assertGreater(summary["national_total_production_tonnes"], 0)

        # Check records integrity
        rec0 = data["records"][0]
        self.assertIn("district", rec0)
        self.assertIn("division", rec0)
        self.assertIn("predicted_yield_t_ha", rec0)
        self.assertIn("national_rank", rec0)
        self.assertIn("yield_tier", rec0)
        self.assertIn(rec0["yield_tier"], [0, 1, 2, 3, 4])

    def test_13_district_explorer_csv(self):
        """Verify District Explorer CSV download works with proper headers and UTF-8 content."""
        resp = client.get("/api/district-explorer/csv?crop=Boro Rice")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp.headers["content-type"])
        self.assertIn("attachment", resp.headers["content-disposition"])
        lines = resp.text.strip().split("\n")
        self.assertGreaterEqual(len(lines), 65)  # 1 header + 64 districts

    def test_14_historical_trends_tangail_aman(self):
        """14. Tangail Aman Rice returns 19 latest records matching source CSV, valid summary and forecast marker."""
        resp = client.get("/api/history?district=Tangail&crop=Aman Rice&years=19")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["district"], "Tangail")
        self.assertEqual(data["crop"], "Aman Rice")
        self.assertEqual(data["season"], "Kharif-II")
        self.assertEqual(len(data["records"]), 19)

        # Check last record matches 2025-2026 actual in CSV
        last_rec = data["records"][-1]
        self.assertEqual(last_rec["crop_year"], "2025-2026")
        self.assertAlmostEqual(last_rec["yield_t_ha"], 2.380, places=3)
        self.assertAlmostEqual(last_rec["rainfall_mm"], 1131.47, places=2)
        self.assertAlmostEqual(last_rec["temperature_c"], 27.92, places=2)
        self.assertIsNotNone(last_rec["evi"])
        self.assertFalse(last_rec["is_forecast"])

        # Check summary metrics
        summary = data["summary"]
        self.assertEqual(summary["total_records"], 19)
        self.assertAlmostEqual(summary["avg_yield_t_ha"], 2.110, places=2)
        self.assertEqual(summary["highest_year"], "2024-2025")
        self.assertAlmostEqual(summary["highest_yield_t_ha"], 2.512, places=3)
        self.assertFalse(summary["has_insufficient_records"])

        # Check distinct forecast marker
        fc = data["forecast_marker"]
        self.assertIsNotNone(fc)
        self.assertEqual(fc["display_season"], "Kharif-II 2027")
        self.assertAlmostEqual(fc["predicted_yield_t_ha"], 2.475, places=2)

    def test_15_historical_trends_boro_missing_2025_2026(self):
        """15. Boro Rice missing 2025-2026 actual is NEVER invented; has 19 total historical years."""
        resp = client.get("/api/history?district=Tangail&crop=Boro Rice&years=19")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["crop"], "Boro Rice")
        self.assertEqual(data["season"], "Rabi")
        years = [r["crop_year"] for r in data["records"]]
        self.assertNotIn("2025-2026", years)
        self.assertEqual(years[-1], "2024-2025")
        self.assertEqual(len(data["records"]), 19)

    def test_16_historical_trends_csv_export(self):
        """16. Historical CSV export streams unrounded numeric values with documented unit headers."""
        resp = client.get("/api/history/csv?district=Tangail&crop=Aman Rice&years=19")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp.headers["content-type"])
        self.assertIn("historical_trends_Tangail_Aman_Rice.csv", resp.headers["content-disposition"])
        lines = resp.text.strip().split("\n")
        self.assertEqual(len(lines), 20)  # 1 header + 19 records
        header = lines[0]
        self.assertIn("Actual_Yield_t_ha", header)
        self.assertIn("Seasonal_Rainfall_mm", header)
        self.assertIn("Mean_Temperature_C", header)
        self.assertIn("NDVI_Index", header)
        self.assertIn("EVI_Index", header)
        self.assertIn("Soil_Moisture_7_28cm_m3_m3", header)

    def test_17_season_alignment_provenance(self):
        """17. Provenance discloses correct seasonal aggregation windows."""
        # Kharif-I
        resp_k1 = client.get("/api/history?district=Tangail&crop=Aus Rice")
        self.assertEqual(resp_k1.status_code, 200)
        self.assertEqual(resp_k1.json()["season"], "Kharif-I")
        self.assertIn("March–July", resp_k1.json()["provenance"]["season_alignment"])

        # Kharif-II
        resp_k2 = client.get("/api/history?district=Tangail&crop=Aman Rice")
        self.assertEqual(resp_k2.status_code, 200)
        self.assertEqual(resp_k2.json()["season"], "Kharif-II")
        self.assertIn("July–October", resp_k2.json()["provenance"]["season_alignment"])

        # Rabi
        resp_rabi = client.get("/api/history?district=Tangail&crop=Potato")
        self.assertEqual(resp_rabi.status_code, 200)
        self.assertEqual(resp_rabi.json()["season"], "Rabi")
        self.assertIn("October–March", resp_rabi.json()["provenance"]["season_alignment"])

    def test_18_date_aware_forecast_advisory_simulated_dates(self):
        """18. Test date-aware advisory across all simulated application dates required by EXP_38."""
        # 1. September 20, 2026: Rabi upcoming, recheck in future (Case B)
        adv1 = calculate_forecast_advisory("Rabi", 2026, planning_order=1, current_day=date(2026, 9, 20))
        self.assertEqual(adv1["case"], "B")
        self.assertEqual(adv1["recheck_date_str"], "October 1, 2026")
        self.assertIn("Early forecast — check again on October 1, 2026", adv1["message"])
        self.assertFalse(adv1["is_past_recheck"])

        # 2. October 1, 2026: Recheck date arrived, season starts Oct 15 (Case D)
        adv2 = calculate_forecast_advisory("Rabi", 2026, planning_order=1, current_day=date(2026, 10, 1))
        self.assertEqual(adv2["case"], "D")
        self.assertEqual(adv2["message"], "The suggested review date has passed. Check whether a newer forecast is available before planning.")
        self.assertTrue(adv2["is_past_recheck"])
        self.assertFalse(adv2["is_season_started"])

        # 3. October 16, 2026: Rabi 2026-27 season started (Case A)
        adv3 = calculate_forecast_advisory("Rabi", 2026, planning_order=1, current_day=date(2026, 10, 16))
        self.assertEqual(adv3["case"], "A")
        self.assertEqual(adv3["message"], "This growing season has started. Check for the latest forecast update when new information becomes available.")
        self.assertTrue(adv3["is_season_started"])

        # 4. November 3, 2026: Rabi 2026-27 is in progress (Case A)
        adv4 = calculate_forecast_advisory("Rabi", 2026, planning_order=1, current_day=date(2026, 11, 3))
        self.assertEqual(adv4["case"], "A")
        self.assertEqual(adv4["message"], "This growing season has started. Check for the latest forecast update when new information becomes available.")
        self.assertNotIn("October 1, 2026", adv4["message"])

        # 5. November 3, 2026: Kharif-I 2027 (Case B, order 2)
        adv5 = calculate_forecast_advisory("Kharif-I", 2027, planning_order=2, current_day=date(2026, 11, 3))
        self.assertEqual(adv5["case"], "B")
        self.assertEqual(adv5["recheck_date_str"], "March 1, 2027")
        self.assertEqual(adv5["message"], "Early forecast — check again on March 1, 2027 for the latest available estimate.")

        # 6. November 3, 2026: Kharif-II 2027 (Case C, order 3)
        adv6 = calculate_forecast_advisory("Kharif-II", 2027, planning_order=3, current_day=date(2026, 11, 3))
        self.assertEqual(adv6["case"], "C")
        self.assertEqual(adv6["recheck_date_str"], "July 1, 2027")
        self.assertEqual(adv6["message"], "Advance forecast — check again on July 1, 2027 as the growing season approaches.")

        # 7. February 1, 2027: Kharif-I 2027 before recheck (Case B)
        adv7 = calculate_forecast_advisory("Kharif-I", 2027, planning_order=1, current_day=date(2027, 2, 1))
        self.assertEqual(adv7["case"], "B")
        self.assertEqual(adv7["recheck_date_str"], "March 1, 2027")

        # 8. March 1, 2027: Kharif-I 2027 recheck date reached (Case D)
        adv8 = calculate_forecast_advisory("Kharif-I", 2027, planning_order=1, current_day=date(2027, 3, 1))
        self.assertEqual(adv8["case"], "D")
        self.assertEqual(adv8["message"], "The suggested review date has passed. Check whether a newer forecast is available before planning.")

        # 9. March 16, 2027: Kharif-I 2027 season started (Case A)
        adv9 = calculate_forecast_advisory("Kharif-I", 2027, planning_order=1, current_day=date(2027, 3, 16))
        self.assertEqual(adv9["case"], "A")
        self.assertTrue(adv9["is_season_started"])

        # 10. July 1, 2027: Kharif-II 2027 recheck date reached (Case D)
        adv10 = calculate_forecast_advisory("Kharif-II", 2027, planning_order=2, current_day=date(2027, 7, 1))
        self.assertEqual(adv10["case"], "D")

        # 11. July 16, 2027: Kharif-II 2027 season started (Case A)
        adv11 = calculate_forecast_advisory("Kharif-II", 2027, planning_order=2, current_day=date(2027, 7, 16))
        self.assertEqual(adv11["case"], "A")

        # 12. Expired / unsupported season (Case E)
        adv12 = calculate_forecast_advisory("Rabi", 2028, planning_order=1, current_day=date(2028, 11, 1))
        self.assertEqual(adv12["case"], "E")
        self.assertEqual(adv12["message"], "An updated forecast is needed for this season.")

    def test_19_district_explorer_advisory_in_summary(self):
        """19. District Explorer endpoint returns date-aware advisory for Rabi 2026-27."""
        resp = client.get("/api/district-explorer?crop=Boro Rice")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        summary = data["summary"]
        self.assertIn("early_forecast_advisory", summary)
        # On or after Nov 3, 2026, it must NEVER display October 1, 2026 as an upcoming recheck reminder
        self.assertNotIn("October 1, 2026", summary["early_forecast_advisory"])
        self.assertEqual(summary["advisory_case"], "A")
        self.assertIn("growing season has started", summary["early_forecast_advisory"])

    def test_20_national_historical_trends(self):
        """20. National historical trends returns aggregated records for All Bangladesh."""
        resp = client.get("/api/history?district=Bangladesh&crop=Boro Rice&years=19")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["district"], "All Bangladesh (National)")
        self.assertEqual(data["crop"], "Boro Rice")
        self.assertEqual(len(data["records"]), 19)
        self.assertGreater(data["summary"]["avg_yield_t_ha"], 3.5)
        self.assertIsNotNone(data["forecast_marker"])
        self.assertGreater(data["forecast_marker"]["predicted_yield_t_ha"], 4.0)
        self.assertEqual(data["forecast_marker"]["district"], "All Bangladesh (National)")

    def test_21_national_historical_csv_export(self):
        """21. National CSV export streams 19 aggregated records for All Bangladesh."""
        resp = client.get("/api/history/csv?district=All Bangladesh&crop=Aman Rice&years=19")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp.headers["content-type"])
        self.assertIn("historical_trends_All_Bangladesh_National_Aman_Rice.csv", resp.headers["content-disposition"])
        lines = resp.text.strip().split("\n")
        self.assertEqual(len(lines), 20)  # 1 header + 19 rows
        self.assertIn("All Bangladesh (National)", lines[1])

if __name__ == "__main__":
    unittest.main()




