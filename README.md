# LoadWise AI

A startup-ready MVP for intelligent vehicle load planning. Users can register, manage vehicles and products, run a hybrid 3D packing optimizer, inspect an interactive Three.js load plan, and save results to Supabase.

## Stack

- **Frontend:** React, TypeScript, Vite, React Three Fiber
- **Backend:** Python, FastAPI
- **Optimization:** Genetic search + extreme-point 3D bin packing + support, payload, fragility and balance constraints
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
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

The Vite dev server proxies `/api` to port `8000`.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Add the frontend URL and anon key to `.env.local`.
4. Add the service-role key only to Vercel server environment variables. Never expose it with a `VITE_` prefix.
5. In Supabase Auth URL configuration, add your local and Vercel callback URLs.

## Vercel deployment

1. Import the repository into Vercel.
2. Keep the project root as the repository root.
3. Add all variables from `.env.example` in Project Settings → Environment Variables.
4. Deploy. `vercel.json` routes the React SPA and Python API.

## API

### `POST /api/optimize`

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

## Why a hybrid optimizer instead of “pure ML”

3D loading is a constrained combinatorial optimization problem. The MVP uses a genetic algorithm to search item orderings and an extreme-point heuristic to create feasible placements. This guarantees explicit handling of dimensions, collisions, payload, support, fragility, and center of mass. A learned ranking model can later improve candidate selection using historical accepted plans without replacing hard safety constraints.

## Roadmap

- Organization invitations and role management
- Async optimization queue for very large loads
- Axle-specific load limits and route restrictions
- Barcode/CSV import
- PDF loading manifests and driver sharing
- Learned candidate-ranking model from accepted plans
