import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app import main
from backend.app.models import LoadItem, OptimizationRequest, Vehicle


class FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def request_payload(quantity: int = 2) -> dict:
    return {
        "vehicle": {
            "name": "Test van",
            "type": "Van",
            "length": 300,
            "width": 180,
            "height": 180,
            "max_payload": 1000,
        },
        "items": [
            {
                "id": "box",
                "name": "Box",
                "quantity": quantity,
                "length": 60,
                "width": 50,
                "height": 40,
                "weight": 25,
                "allow_rotation": True,
                "stackable": True,
                "fragile": False,
            }
        ],
    }


def test_optimizer_api_rejects_anonymous_requests():
    response = TestClient(main.app).post("/api/optimize", json=request_payload())
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_optimizer_api_accepts_verified_session(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key")
    monkeypatch.setattr(
        main,
        "urlopen",
        lambda request, timeout: FakeResponse(
            {
                "allowed": True,
                "request_count": 1,
                "limit": 6,
                "retry_after_seconds": 30,
                "user_id": "00000000-0000-0000-0000-000000000001",
            }
        ),
    )

    response = TestClient(main.app).post(
        "/api/optimize",
        json=request_payload(),
        headers={"Authorization": "Bearer valid-test-token"},
    )
    assert response.status_code == 200
    assert response.json()["placed_count"] == 2


def test_optimizer_api_returns_429_when_quota_is_exhausted(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key")
    monkeypatch.setattr(
        main,
        "urlopen",
        lambda request, timeout: FakeResponse(
            {
                "allowed": False,
                "request_count": 7,
                "limit": 6,
                "retry_after_seconds": 17,
                "user_id": "00000000-0000-0000-0000-000000000001",
            }
        ),
    )

    response = TestClient(main.app).post(
        "/api/optimize",
        json=request_payload(),
        headers={"Authorization": "Bearer valid-test-token"},
    )
    assert response.status_code == 429
    assert response.headers["retry-after"] == "17"


def test_request_rejects_more_than_sixty_units():
    with pytest.raises(ValidationError, match="maximum of 60 physical units"):
        OptimizationRequest(
            vehicle=Vehicle(name="Test van", length=300, width=180, height=180, max_payload=1000),
            items=[
                LoadItem(id="box", name="Box", quantity=60, length=60, width=50, height=40, weight=25),
                LoadItem(id="box-2", name="Box 2", quantity=1, length=60, width=50, height=40, weight=25),
            ],
        )
