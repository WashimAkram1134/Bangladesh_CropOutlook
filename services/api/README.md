# services/api — FastAPI Backend (Phase 2)

This directory will contain the **FastAPI** backend service for the Bangladesh Crop Outlook system.

## Planned structure (Phase 2)

```
services/api/
├── main.py              # FastAPI application entry point
├── routes/
│   ├── forecasts.py     # GET /forecasts/{district}/{crop}/{season}
│   ├── districts.py     # GET /districts
│   └── health.py        # GET /health
├── models/
│   └── exp36/           # EXP_36 model artefacts (Random Forest + SARIMA)
├── data/
│   ├── exp36_forecasts.parquet
│   └── env_features.parquet
├── schemas.py           # Pydantic response models
├── requirements.txt
└── README.md
```

## Phase 2 integration notes

- The frontend calls `NEXT_PUBLIC_API_URL/api/v1/forecasts?district=dhaka&crop=boro_rice&season=rabi&year=2025`
- Response matches the `ForecastRecord` TypeScript interface in `apps/web/lib/types.ts`
- Do not retrain or replace the EXP_36 model; only serve its verified outputs.

## Status

⏳ **Not yet implemented** — Phase 2 scope.
