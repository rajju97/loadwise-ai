from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field, model_validator

MAX_OPTIMIZATION_UNITS = 60
MAX_POPULATION_SIZE = 12
MAX_GENERATIONS = 10


class Vehicle(BaseModel):
    id: str | None = Field(default=None, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(default="Custom vehicle", max_length=80)
    length: float = Field(gt=0, le=5000, description="Cargo bay length in centimeters")
    width: float = Field(gt=0, le=1000, description="Cargo bay width in centimeters")
    height: float = Field(gt=0, le=1000, description="Cargo bay height in centimeters")
    max_payload: float = Field(gt=0, le=100000, description="Maximum payload in kilograms")


class LoadItem(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    sku: str | None = Field(default=None, max_length=100)
    quantity: int = Field(default=1, ge=1, le=MAX_OPTIMIZATION_UNITS)
    length: float = Field(gt=0, le=5000)
    width: float = Field(gt=0, le=1000)
    height: float = Field(gt=0, le=1000)
    weight: float = Field(gt=0, le=100000)
    allow_rotation: bool = True
    stackable: bool = True
    fragile: bool = False
    color: str | None = Field(default=None, max_length=32)


class OptimizationRequest(BaseModel):
    vehicle: Vehicle
    items: list[LoadItem] = Field(min_length=1, max_length=60)
    objective: Literal["balanced_utilization", "maximum_volume", "maximum_payload"] = "balanced_utilization"
    population_size: int | None = Field(default=None, ge=4, le=MAX_POPULATION_SIZE)
    generations: int | None = Field(default=None, ge=1, le=MAX_GENERATIONS)

    @model_validator(mode="after")
    def validate_unit_count(self) -> "OptimizationRequest":
        unit_count = sum(item.quantity for item in self.items)
        if unit_count > MAX_OPTIMIZATION_UNITS:
            raise ValueError(
                f"A maximum of {MAX_OPTIMIZATION_UNITS} physical units can be optimized in one request"
            )
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
