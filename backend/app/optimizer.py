from __future__ import annotations

from dataclasses import dataclass, replace
from itertools import permutations
import os
from math import prod
from random import Random
from time import perf_counter
from typing import Iterable

from .models import LoadItem, OptimizationRequest, OptimizationResult, Placement, UnplacedItem

EPSILON = 1e-7
MAX_COMPLEXITY_BUDGET = 2_500_000
MAX_SEARCH_EVALUATIONS = 120
MAX_TIME_BUDGET_SECONDS = 8.0


class OptimizationBudgetExceeded(RuntimeError):
    """Raised when an optimization request reaches its safe CPU budget."""


def _check_deadline(deadline: float) -> None:
    if perf_counter() >= deadline:
        raise OptimizationBudgetExceeded(
            "The request exceeded the safe optimization runtime. Reduce cargo units and try again."
        )


@dataclass(frozen=True)
class Unit:
    unit_id: str
    source_item_id: str
    name: str
    dimensions: tuple[float, float, float]
    weight: float
    allow_rotation: bool
    stackable: bool
    fragile: bool
    color: str | None

    @property
    def volume(self) -> float:
        return prod(self.dimensions)


@dataclass(frozen=True)
class Packed:
    unit: Unit
    position: tuple[float, float, float]
    dimensions: tuple[float, float, float]

    @property
    def x2(self) -> float:
        return self.position[0] + self.dimensions[0]

    @property
    def y2(self) -> float:
        return self.position[1] + self.dimensions[1]

    @property
    def z2(self) -> float:
        return self.position[2] + self.dimensions[2]


@dataclass
class PackOutcome:
    packed: list[Packed]
    unplaced: list[Unit]
    score: float
    volume_utilization: float
    payload_utilization: float
    balance_score: float
    center_of_mass: tuple[float, float, float]


def expand_units(items: Iterable[LoadItem]) -> list[Unit]:
    units: list[Unit] = []
    for item in items:
        for index in range(item.quantity):
            units.append(Unit(
                unit_id=f"{item.id}-{index + 1}",
                source_item_id=item.id,
                name=item.name,
                dimensions=(item.length, item.width, item.height),
                weight=item.weight,
                allow_rotation=item.allow_rotation,
                stackable=item.stackable,
                fragile=item.fragile,
                color=item.color,
            ))
    return units


def orientations(unit: Unit) -> list[tuple[float, float, float]]:
    if not unit.allow_rotation:
        return [unit.dimensions]
    return sorted(set(permutations(unit.dimensions, 3)), key=lambda d: (d[2], -(d[0] * d[1])))


def overlaps(a_pos: tuple[float, float, float], a_dim: tuple[float, float, float], b: Packed) -> bool:
    return not (
        a_pos[0] + a_dim[0] <= b.position[0] + EPSILON
        or b.x2 <= a_pos[0] + EPSILON
        or a_pos[1] + a_dim[1] <= b.position[1] + EPSILON
        or b.y2 <= a_pos[1] + EPSILON
        or a_pos[2] + a_dim[2] <= b.position[2] + EPSILON
        or b.z2 <= a_pos[2] + EPSILON
    )


def support_ratio(position: tuple[float, float, float], dimensions: tuple[float, float, float], packed: list[Packed]) -> tuple[float, bool]:
    x, y, z = position
    length, width, _ = dimensions
    if z <= EPSILON:
        return 1.0, True

    support_area = 0.0
    structurally_safe = True
    for base in packed:
        if abs(base.z2 - z) > EPSILON:
            continue
        overlap_x = max(0.0, min(x + length, base.x2) - max(x, base.position[0]))
        overlap_y = max(0.0, min(y + width, base.y2) - max(y, base.position[1]))
        overlap_area = overlap_x * overlap_y
        if overlap_area > EPSILON:
            support_area += overlap_area
            if base.unit.fragile or not base.unit.stackable:
                structurally_safe = False
    ratio = min(1.0, support_area / (length * width))
    return ratio, structurally_safe


def feasible(
    unit: Unit,
    position: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    packed: list[Packed],
    vehicle_dims: tuple[float, float, float],
) -> tuple[bool, float]:
    x, y, z = position
    length, width, height = dimensions
    vehicle_length, vehicle_width, vehicle_height = vehicle_dims
    if x + length > vehicle_length + EPSILON or y + width > vehicle_width + EPSILON or z + height > vehicle_height + EPSILON:
        return False, 0.0
    if any(overlaps(position, dimensions, other) for other in packed):
        return False, 0.0
    support, safe_support = support_ratio(position, dimensions, packed)
    if support < 0.70 or not safe_support:
        return False, support
    if unit.fragile and z > EPSILON and support < 0.92:
        return False, support
    return True, support


def candidate_points(packed: list[Packed], vehicle_dims: tuple[float, float, float]) -> list[tuple[float, float, float]]:
    points = {(0.0, 0.0, 0.0)}
    for box in packed:
        points.add((box.x2, box.position[1], box.position[2]))
        points.add((box.position[0], box.y2, box.position[2]))
        if box.unit.stackable and not box.unit.fragile:
            points.add((box.position[0], box.position[1], box.z2))
    length, width, height = vehicle_dims
    valid = [p for p in points if p[0] < length - EPSILON and p[1] < width - EPSILON and p[2] < height - EPSILON]
    return sorted(valid, key=lambda p: (p[2], p[0], p[1]))


def compute_center_of_mass(packed: list[Packed], vehicle_dims: tuple[float, float, float]) -> tuple[float, float, float]:
    total_weight = sum(box.unit.weight for box in packed)
    if total_weight <= EPSILON:
        return tuple(value / 2 for value in vehicle_dims)
    return tuple(
        sum((box.position[axis] + box.dimensions[axis] / 2) * box.unit.weight for box in packed) / total_weight
        for axis in range(3)
    )


def balance_score(center: tuple[float, float, float], vehicle_dims: tuple[float, float, float]) -> float:
    target = (vehicle_dims[0] * 0.48, vehicle_dims[1] * 0.5, vehicle_dims[2] * 0.42)
    normalized = sum(abs(center[i] - target[i]) / max(vehicle_dims[i], EPSILON) for i in range(3)) / 3
    return max(0.0, min(100.0, (1.0 - normalized * 2.1) * 100))


def candidate_cost(
    unit: Unit,
    position: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    support: float,
    packed: list[Packed],
    vehicle_dims: tuple[float, float, float],
    objective: str,
) -> float:
    tentative = packed + [Packed(unit=unit, position=position, dimensions=dimensions)]
    com = compute_center_of_mass(tentative, vehicle_dims)
    balance_penalty = 100 - balance_score(com, vehicle_dims)
    x, y, z = position
    l, w, h = dimensions
    compactness = (x + l) / vehicle_dims[0] + (y + w) / vehicle_dims[1] + (z + h) / vehicle_dims[2]
    floor_bias = z / vehicle_dims[2]
    support_penalty = (1 - support) * 8
    orientation_penalty = h / max(l, w, 1)
    if objective == "maximum_volume":
        return compactness * 2.5 + floor_bias * 2 + support_penalty + balance_penalty * 0.02
    if objective == "maximum_payload":
        return compactness * 1.6 + floor_bias * 3 + support_penalty + balance_penalty * 0.05
    return compactness * 1.8 + floor_bias * 2.8 + support_penalty + balance_penalty * 0.11 + orientation_penalty * 0.15


def pack_order(order: list[Unit], request: OptimizationRequest, deadline: float) -> PackOutcome:
    vehicle = request.vehicle
    vehicle_dims = (vehicle.length, vehicle.width, vehicle.height)
    vehicle_volume = prod(vehicle_dims)
    packed: list[Packed] = []
    unplaced: list[Unit] = []
    current_weight = 0.0

    for unit in order:
        _check_deadline(deadline)
        if current_weight + unit.weight > vehicle.max_payload + EPSILON:
            unplaced.append(unit)
            continue
        best: tuple[float, tuple[float, float, float], tuple[float, float, float]] | None = None
        for point in candidate_points(packed, vehicle_dims):
            _check_deadline(deadline)
            for dims in orientations(unit):
                ok, support = feasible(unit, point, dims, packed, vehicle_dims)
                if not ok:
                    continue
                cost = candidate_cost(unit, point, dims, support, packed, vehicle_dims, request.objective)
                if best is None or cost < best[0]:
                    best = (cost, point, dims)
        if best is None:
            unplaced.append(unit)
        else:
            _, point, dims = best
            packed.append(Packed(unit=unit, position=point, dimensions=dims))
            current_weight += unit.weight

    placed_volume = sum(box.unit.volume for box in packed)
    volume_utilization = placed_volume / vehicle_volume * 100
    payload_utilization = current_weight / vehicle.max_payload * 100
    center = compute_center_of_mass(packed, vehicle_dims)
    balance = balance_score(center, vehicle_dims)
    placement_ratio = len(packed) / max(len(order), 1) * 100
    fragile_penalty = sum(1 for box in packed if box.unit.fragile and box.position[2] > vehicle.height * 0.55) * 0.3
    score = (
        volume_utilization * 0.50
        + payload_utilization * 0.14
        + balance * 0.18
        + placement_ratio * 0.18
        - fragile_penalty
    )
    return PackOutcome(packed, unplaced, score, volume_utilization, payload_utilization, balance, center)


def order_crossover(a: list[Unit], b: list[Unit], random: Random) -> list[Unit]:
    if len(a) < 3:
        return list(a)
    left, right = sorted(random.sample(range(len(a)), 2))
    segment_ids = {unit.unit_id for unit in a[left:right]}
    remainder = [unit for unit in b if unit.unit_id not in segment_ids]
    return remainder[:left] + a[left:right] + remainder[left:]


def mutate(order: list[Unit], random: Random) -> list[Unit]:
    result = list(order)
    if len(result) < 2:
        return result
    if random.random() < 0.65:
        i, j = random.sample(range(len(result)), 2)
        result[i], result[j] = result[j], result[i]
    else:
        i, j = sorted(random.sample(range(len(result)), 2))
        result[i:j] = reversed(result[i:j])
    return result


def initial_population(units: list[Unit], size: int, random: Random) -> list[list[Unit]]:
    strategies = [
        sorted(units, key=lambda u: (-u.volume, -u.weight)),
        sorted(units, key=lambda u: (-u.weight, -u.volume)),
        sorted(units, key=lambda u: (u.fragile, -u.volume)),
        sorted(units, key=lambda u: (not u.stackable, u.fragile, -u.weight)),
        sorted(units, key=lambda u: (-(u.dimensions[0] * u.dimensions[1]), -u.weight)),
    ]
    population = [list(order) for order in strategies]
    while len(population) < size:
        candidate = list(units)
        random.shuffle(candidate)
        population.append(candidate)
    return population[:size]


def recommendations(outcome: PackOutcome, request: OptimizationRequest, search_limited: bool = False) -> list[str]:
    notes: list[str] = []
    if search_limited:
        notes.append("Search stopped at the safe runtime limit; reduce cargo units for a deeper search.")
    if outcome.volume_utilization >= 85:
        notes.append("Excellent space utilization; the selected vehicle is a strong fit for this load.")
    elif outcome.volume_utilization >= 65:
        notes.append("Good fit. Smaller voids remain near the top and rear of the cargo bay.")
    else:
        notes.append("Consider a smaller vehicle or combine this shipment with another compatible load.")
    if outcome.balance_score >= 90:
        notes.append("The center of mass is well balanced across the cargo bay.")
    elif outcome.center_of_mass[0] > request.vehicle.length * 0.60:
        notes.append("Shift dense cargo toward the front half to improve longitudinal balance.")
    else:
        notes.append("Review the highlighted loading order to preserve the planned balance.")
    if outcome.unplaced:
        notes.append(f"{len(outcome.unplaced)} unit(s) remain unplaced; review payload, dimensions, or stacking constraints.")
    else:
        notes.append("All cargo units fit within payload and dimensional limits.")
    return notes[:3]


def optimize(request: OptimizationRequest) -> OptimizationResult:
    started = perf_counter()
    units = expand_units(request.items)
    random = Random(42)

    try:
        configured_time_budget = float(os.getenv("OPTIMIZER_TIME_BUDGET_SECONDS", "8"))
    except ValueError:
        configured_time_budget = MAX_TIME_BUDGET_SECONDS
    time_budget = max(1.0, min(configured_time_budget, MAX_TIME_BUDGET_SECONDS))
    deadline = started + time_budget

    requested_population = request.population_size or int(os.getenv("OPTIMIZER_POPULATION", "8"))
    requested_generations = request.generations or int(os.getenv("OPTIMIZER_GENERATIONS", "6"))
    unit_complexity = max(len(units) ** 3, 1)
    max_evaluations = max(4, min(MAX_SEARCH_EVALUATIONS, MAX_COMPLEXITY_BUDGET // unit_complexity))
    population_size = max(4, min(requested_population, 12, max_evaluations))
    generations = max(1, min(requested_generations, 10, max_evaluations // population_size))

    population = initial_population(units, population_size, random)
    best_outcome: PackOutcome | None = None
    search_limited = False

    for _ in range(generations):
        evaluated: list[tuple[PackOutcome, list[Unit]]] = []
        for order in population:
            try:
                evaluated.append((pack_order(order, request, deadline), order))
            except OptimizationBudgetExceeded:
                search_limited = True
                break

        if not evaluated:
            break

        evaluated.sort(key=lambda pair: pair[0].score, reverse=True)
        if best_outcome is None or evaluated[0][0].score > best_outcome.score:
            best_outcome = evaluated[0][0]

        if search_limited:
            break

        elite_count = max(2, min(len(evaluated), population_size // 4))
        elites = [list(order) for _, order in evaluated[:elite_count]]
        next_population = elites.copy()
        while len(next_population) < population_size:
            parent_a = random.choice(elites)
            parent_b = random.choice(evaluated[: max(elite_count * 2, 2)])[1]
            child = order_crossover(parent_a, parent_b, random)
            if random.random() < 0.72:
                child = mutate(child, random)
            next_population.append(child)
        population = next_population

    if best_outcome is None:
        raise OptimizationBudgetExceeded(
            "The request exceeded the safe optimization runtime before a plan could be produced. "
            "Reduce cargo units and try again."
        )

    loading_sorted = sorted(
        best_outcome.packed,
        key=lambda box: (box.position[2], -box.unit.weight, box.position[0], box.position[1]),
    )
    order_by_id = {box.unit.unit_id: index + 1 for index, box in enumerate(loading_sorted)}
    placements = [
        Placement(
            unit_id=box.unit.unit_id,
            source_item_id=box.unit.source_item_id,
            name=box.unit.name,
            position=tuple(round(value, 2) for value in box.position),
            dimensions=tuple(round(value, 2) for value in box.dimensions),
            weight=box.unit.weight,
            color=box.unit.color,
            loading_order=order_by_id[box.unit.unit_id],
        )
        for box in best_outcome.packed
    ]
    unplaced = [
        UnplacedItem(
            unit_id=unit.unit_id,
            name=unit.name,
            reason="No feasible position within payload and loading constraints",
        )
        for unit in best_outcome.unplaced
    ]
    runtime_ms = int((perf_counter() - started) * 1000)
    placed_volume = sum(box.unit.volume for box in best_outcome.packed)
    placed_weight = sum(box.unit.weight for box in best_outcome.packed)

    return OptimizationResult(
        status="optimized",
        algorithm=f"Budgeted Hybrid GA + extreme-point 3D packing ({population_size}×{generations})",
        score=round(best_outcome.score, 2),
        volume_utilization=round(best_outcome.volume_utilization, 2),
        payload_utilization=round(best_outcome.payload_utilization, 2),
        balance_score=round(best_outcome.balance_score, 2),
        center_of_mass=tuple(round(value, 2) for value in best_outcome.center_of_mass),
        placed_count=len(best_outcome.packed),
        total_count=len(units),
        placed_weight=round(placed_weight, 2),
        placed_volume=round(placed_volume, 2),
        placements=placements,
        unplaced=unplaced,
        recommendations=recommendations(best_outcome, request, search_limited),
        runtime_ms=runtime_ms,
    )
