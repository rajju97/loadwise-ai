from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .models import OptimizationRequest, OptimizationResult
from .optimizer import OptimizationBudgetExceeded, optimize

app = FastAPI(
    title="LoadWise AI Optimizer API",
    version="0.2.0",
    description="Authenticated, constraint-aware 3D vehicle load optimization service.",
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

bearer_scheme = HTTPBearer(auto_error=False)


def _supabase_backend_config() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    publishable_key = (
        os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
    )
    if not url or not publishable_key:
        raise HTTPException(status_code=503, detail="Authentication service is not configured")
    return url.rstrip("/"), publishable_key


def _authenticate_and_consume_quota(access_token: str) -> str:
    supabase_url, publishable_key = _supabase_backend_config()
    request = Request(
        f"{supabase_url}/rest/v1/rpc/consume_optimizer_quota",
        data=b"{}",
        method="POST",
        headers={
            "apikey": publishable_key,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "loadwise-optimizer/0.2",
        },
    )

    try:
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(
                status_code=401,
                detail="A valid Supabase session is required",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        raise HTTPException(status_code=503, detail="Authentication service is unavailable") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="Authentication service is unavailable") from exc

    if isinstance(payload, list):
        payload = payload[0] if payload else None
    if not isinstance(payload, dict) or not payload.get("user_id"):
        raise HTTPException(status_code=503, detail="Authentication service returned an invalid response")

    if not payload.get("allowed"):
        retry_after = max(1, int(payload.get("retry_after_seconds", 60)))
        raise HTTPException(
            status_code=429,
            detail="Optimizer request limit reached. Try again shortly.",
            headers={"Retry-After": str(retry_after)},
        )

    return str(payload["user_id"])


def require_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="A valid Supabase session is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _authenticate_and_consume_quota(credentials.credentials)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "loadwise-optimizer"}


@app.post("/api/optimize", response_model=OptimizationResult)
def optimize_load(
    request: OptimizationRequest,
    _user_id: str = Depends(require_authenticated_user),
) -> OptimizationResult:
    try:
        return optimize(request)
    except OptimizationBudgetExceeded as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        # Keep internal implementation details out of the public response.
        raise HTTPException(status_code=500, detail="The optimizer could not produce a load plan") from exc
