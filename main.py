from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import OptimizationRequest, OptimizationResult
from .optimizer import optimize

app = FastAPI(
    title="LoadWise AI Optimizer API",
    version="0.1.0",
    description="Constraint-aware 3D vehicle load optimization service.",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "loadwise-optimizer"}


@app.post("/api/optimize", response_model=OptimizationResult)
def optimize_load(request: OptimizationRequest) -> OptimizationResult:
    try:
        return optimize(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        # Keep internal implementation details out of the public response.
        raise HTTPException(status_code=500, detail="The optimizer could not produce a load plan") from exc
