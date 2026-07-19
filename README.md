# LoadWise AI

A startup-ready MVP for intelligent vehicle load planning. Users can register, manage vehicles and products, run a hybrid 3D packing optimizer, inspect an interactive Three.js load plan, and save results to Supabase.

## Stack

- **Frontend:** React, TypeScript, Vite, React Three Fiber
- **Backend:** Python, FastAPI
- **Optimization:** Budgeted genetic search + extreme-point 3D bin packing + support, payload, fragility and balance constraints
- **Database/Auth:** Supabase Postgres, Auth and Row Level Security
- **Deployment:** Vercel

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Run the API in a second terminal:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn backend.app.main:app --reload --port 8000
```

The Vite dev server proxies `/api` to port `8000`.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Apply every SQL file in `supabase/migrations/` in filename order. The optimizer quota migration is required before `/api/optimize` can accept authenticated requests.
4. Add the Supabase URL and publishable key to both the frontend and backend variables shown in `.env.example`.
5. Do **not** configure a service-role key for this application. The optimizer validates the user's bearer token and calls a narrowly scoped authenticated RPC.
6. In Supabase Auth URL configuration, add your local and Vercel callback URLs.

## Vercel deployment

1. Import the repository into Vercel.
2. Keep the project root as the repository root.
3. Add all variables from `.env.example` in Project Settings → Environment Variables.
4. Deploy. `vercel.json` routes the React SPA and Python API.

## Optimizer security controls

`POST /api/optimize` is not a public endpoint. It requires a valid Supabase access token in the `Authorization: Bearer <token>` header.

Before CPU work begins, the API calls the Supabase `consume_optimizer_quota` RPC. The database validates the token and enforces a distributed per-user quota of six optimizer requests per minute. Anonymous and expired sessions are rejected.

The optimizer also enforces defense-in-depth execution bounds:

- maximum 60 physical cargo units per request
- maximum population size 12 and 10 generations
- dynamic search-evaluation budget based on cargo complexity
- maximum eight-second optimizer wall-clock budget
- 20-second Vercel function timeout

The anonymous demo uses a precomputed sample plan, so it does not expose optimizer compute.

## API

### `POST /api/optimize`

```bash
curl -X POST http://localhost:8000/api/optimize \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN' \
  -d @request.json
```

Example `request.json`:

```json
{
  "vehicle": {
    "name": "17 ft Box Truck",
    "length": 520,
    "width": 220,
    "height": 225,
    "max_payload": 4500
  },
  "items": [
    {
      "id": "pallet-1",
      "name": "Retail pallet",
      "quantity": 2,
      "length": 120,
      "width": 100,
      "height": 110,
      "weight": 420,
      "allow_rotation": false,
      "stackable": true,
      "fragile": false
    }
  ],
  "objective": "balanced_utilization"
}
```

Expected security responses:

- `401` — missing, invalid or expired Supabase bearer token
- `429` — per-user request quota exhausted; inspect `Retry-After`
- `422` — request exceeds safe cargo or execution limits
- `503` — authentication/quota service is unavailable; the API fails closed

## Tests

```bash
python -m pytest backend/tests -q
npm run build
```

The backend suite includes regression tests for anonymous rejection, authenticated requests, quota exhaustion and the 60-unit limit.

## Why a hybrid optimizer instead of “pure ML”

3D loading is a constrained combinatorial optimization problem. The MVP uses a genetic algorithm to search item orderings and an extreme-point heuristic to create feasible placements. This guarantees explicit handling of dimensions, collisions, payload, support, fragility, and center of mass. A learned ranking model can later improve candidate selection using historical accepted plans without replacing hard safety constraints.

## Roadmap

- Organization invitations and role management
- Async optimization queue for very large loads
- Axle-specific load limits and route restrictions
- Barcode/CSV import
- PDF loading manifests and driver sharing
- Learned candidate-ranking model from accepted plans
