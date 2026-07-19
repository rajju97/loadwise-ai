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
