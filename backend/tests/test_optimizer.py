from backend.app.models import LoadItem, OptimizationRequest, Vehicle
from backend.app.optimizer import optimize


def test_optimizer_places_simple_load():
    request = OptimizationRequest(
        vehicle=Vehicle(name="Test van", length=300, width=180, height=180, max_payload=1000),
        items=[LoadItem(id="box", name="Box", quantity=6, length=60, width=50, height=40, weight=25)],
        population_size=6,
        generations=3,
    )
    result = optimize(request)
    assert result.placed_count == 6
    assert result.unplaced == []
    assert 0 < result.volume_utilization <= 100
    assert result.payload_utilization == 15


def test_payload_limit_is_respected():
    request = OptimizationRequest(
        vehicle=Vehicle(name="Small van", length=300, width=180, height=180, max_payload=100),
        items=[LoadItem(id="heavy", name="Heavy box", quantity=4, length=50, width=50, height=50, weight=40)],
        population_size=4,
        generations=2,
    )
    result = optimize(request)
    assert result.placed_weight <= 100
    assert result.placed_count == 2
    assert len(result.unplaced) == 2


def test_boxes_do_not_overlap():
    request = OptimizationRequest(
        vehicle=Vehicle(name="Cube", length=200, width=200, height=200, max_payload=1000),
        items=[LoadItem(id="cube", name="Cube", quantity=12, length=50, width=50, height=50, weight=10)],
        population_size=5,
        generations=2,
    )
    result = optimize(request)
    for index, a in enumerate(result.placements):
        ax, ay, az = a.position
        al, aw, ah = a.dimensions
        for b in result.placements[index + 1:]:
            bx, by, bz = b.position
            bl, bw, bh = b.dimensions
            separated = ax + al <= bx or bx + bl <= ax or ay + aw <= by or by + bw <= ay or az + ah <= bz or bz + bh <= az
            assert separated


def test_objective_changes_which_item_is_selected():
    vehicle = Vehicle(name="Choice cube", length=100, width=100, height=100, max_payload=100)
    items = [
        LoadItem(id="bulky", name="Bulky light", quantity=1, length=100, width=100, height=100, weight=10),
        LoadItem(id="dense", name="Dense compact", quantity=1, length=50, width=50, height=50, weight=90),
    ]

    volume_result = optimize(OptimizationRequest(vehicle=vehicle, items=items, objective="maximum_volume", population_size=6, generations=3))
    payload_result = optimize(OptimizationRequest(vehicle=vehicle, items=items, objective="maximum_payload", population_size=6, generations=3))

    assert volume_result.placements[0].source_item_id == "bulky"
    assert payload_result.placements[0].source_item_id == "dense"
    assert volume_result.volume_utilization > payload_result.volume_utilization
    assert payload_result.payload_utilization > volume_result.payload_utilization


def test_stability_score_rewards_lower_center_of_mass():
    from backend.app.optimizer import balance_score

    dimensions = (500.0, 200.0, 200.0)
    low = balance_score((240.0, 100.0, 20.0), dimensions)
    high = balance_score((240.0, 100.0, 150.0), dimensions)

    assert low > high


def test_invalid_optimizer_environment_values_fall_back(monkeypatch):
    monkeypatch.setenv("OPTIMIZER_POPULATION", "not-a-number")
    monkeypatch.setenv("OPTIMIZER_GENERATIONS", "not-a-number")
    monkeypatch.setenv("OPTIMIZER_TIME_BUDGET_SECONDS", "nan")
    request = OptimizationRequest(
        vehicle=Vehicle(name="Test van", length=300, width=180, height=180, max_payload=1000),
        items=[LoadItem(id="box", name="Box", quantity=2, length=60, width=50, height=40, weight=25)],
    )

    result = optimize(request)

    assert result.placed_count == 2
