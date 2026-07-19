from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field, model_validator


class Vehicle(BaseModel):
    id: str | None = None
    name: str
    type: str = "Custom vehicle"
    length: float = Field(gt=0, description="Cargo bay length in centimeters")
    width: float = Field(gt=0, description="Cargo bay width in centimeters")
    height: float = Field(gt=0, description="Cargo bay height in centimeters")
    max_payload: float = Field(gt=0, description="Maximum payload in kilograms")


class LoadItem(BaseModel):
    id: str
    name: str
    sku: str | None = None
    quantity: int = Field(default=1, ge=1, le=250)
    length: float = Field(gt=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    weight: float = Field(gt=0)
    allow_rotation: bool = True
    stackable: bool = True
    fragile: bool = False
    color: str | None = None


class OptimizationRequest(BaseModel):
    vehicle: Vehicle
    items: list[LoadItem] = Field(min_length=1)
    objective: Literal["balanced_utilization", "maximum_volume", "maximum_payload"] = "balanced_utilization"
    population_size: int | None = Field(default=None, ge=4, le=40)
    generations: int | None = Field(default=None, ge=1, le=40)

    @model_validator(mode="after")
    def validate_unit_count(self) -> "OptimizationRequest":
        if sum(item.quantity for item in self.items) > 250:
            raise ValueError("A maximum of 250 physical units can be optimized in one request")
        return self


class Placement(BaseModel):
    unit_id: str
    source_item_id: str
    name: str
    position: tuple[float, float, float]
    dimensions: tuple[float, float, float]
    weight: float
    color: str | None = None
    loading_order: int = 0


class UnplacedItem(BaseModel):
    unit_id: str
    name: str
    reason: str


class OptimizationResult(BaseModel):
    status: str
    algorithm: str
    score: float
    volume_utilization: float
    payload_utilization: float
    balance_score: float
    center_of_mass: tuple[float, float, float]
    placed_count: int
    total_count: int
    placed_weight: float
    placed_volume: float
    placements: list[Placement]
    unplaced: list[UnplacedItem]
    recommendations: list[str]
    runtime_ms: int
