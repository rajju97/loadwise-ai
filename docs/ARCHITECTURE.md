# Architecture

## Request lifecycle

The Vite application authenticates with Supabase and queries organization-scoped tables directly through the Supabase Data API. RLS remains the authorization boundary. When a planner runs a load, the browser posts the vehicle and cargo manifest to the FastAPI endpoint. The optimizer returns placements and metrics. The authenticated browser then saves the input and result to Supabase as an optimization job and load plan.

## Optimization strategy

The engine expands product quantities into physical units. A genetic algorithm searches item orderings. Each ordering is evaluated by an extreme-point packer that tests orientations and candidate positions. Feasibility checks enforce bounds, payload, collision freedom, support area, fragility, and stackability. The fitness score combines volume use, payload use, placement ratio, and center-of-mass balance.

## Scaling path

The synchronous Python Function is suitable for an MVP and moderate manifests. Larger jobs should be submitted to a queue and processed by a long-running worker. The API contract can remain unchanged by returning a job ID for asynchronous requests and polling or subscribing to status updates.

## Security boundary

The frontend uses only a Supabase publishable key. Authorization data lives in database membership rows, not editable user metadata. Helper functions used by RLS live in an unexposed private schema with restricted execution. The Python optimizer is stateless and stores no credentials or customer data.
