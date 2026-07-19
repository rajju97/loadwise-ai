# LoadWise AI

Industrial-grade vehicle load optimization for fleets, warehouses, manufacturers, and 3PL operators.

LoadWise AI lets a user register, create a vehicle and cargo catalog, run a constraint-aware 3D optimizer, inspect the loading plan interactively, and save the result to a secure Supabase workspace.

## Product flow

1. Public animated landing page presents the platform and its operational benefits.
2. Supabase Auth handles account registration, email confirmation, login, session refresh, and logout.
3. Authenticated users manage vehicles and reusable products in an organization workspace.
4. A Python optimization service builds a feasible 3D plan.
5. The React Three Fiber viewer shows placements, loading order, utilization, payload, and balance.
6. Optimization jobs and saved plans are persisted to Supabase Postgres with RLS.

## Stack

- **Frontend:** React 18, TypeScript, Vite, React Router
- **3D:** Three.js, React Three Fiber, Drei
- **Backend:** Python, FastAPI, Pydantic
- **Optimization:** Genetic search plus extreme-point 3D packing
- **Database and authentication:** Supabase Postgres, Auth, Row Level Security
- **Deployment:** Vercel static frontend plus Python Function

## Optimizer constraints

The optimization engine explicitly handles:

- Cargo-bay dimensions and maximum payload
- All permitted item orientations
- 3D collision detection
- Minimum support area for stacked cargo
- Fragile and non-stackable products
- Center-of-mass balance scoring
- Volume and payload utilization
- Explainable loading sequence and unplaced-item reasons

3D vehicle loading is a constrained combinatorial optimization problem, so the MVP uses hard constraints and search rather than pretending a pure ML model can guarantee safe placements. Historical accepted plans can later train a ranking model that improves candidate ordering without replacing the safety rules.

## Repository layout

```text
api/index.py                 Vercel FastAPI entrypoint
backend/app/                 Models, API, and optimization engine
backend/tests/               Optimizer tests
src/                         React application
supabase/schema.sql          Multi-tenant schema, grants, triggers, and RLS
vercel.json                  SPA and Python Function routing
```

## Local development

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Add your Supabase project URL and publishable key. The browser must never receive a Supabase secret or service-role key.

### 3. Start the Python API

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt pytest
uvicorn backend.app.main:app --reload --port 8000
```

### 4. Start the frontend

```bash
npm run dev
```

Vite proxies `/api` to `http://localhost:8000`.

## Supabase setup

1. Create a new Supabase project in the region closest to your primary users.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Run Supabase security and performance advisors after the schema is applied.
4. In **Authentication → URL Configuration**, set the production site URL and add:
   - `http://localhost:5173/**`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/**`
5. Copy the project URL and active publishable key into Vercel environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

The schema creates a profile, organization, and owner membership when a user signs up. All application tables have RLS enabled, and organization membership controls access.

## Vercel deployment

1. Import the repository into Vercel.
2. Use the repository root as the project root.
3. Add the two Supabase frontend variables for Preview and Production.
4. Add optional optimizer settings:
   - `OPTIMIZER_POPULATION=18`
   - `OPTIMIZER_GENERATIONS=14`
5. Deploy.

`vercel.json` keeps `/api/*` on the Python Function and rewrites other routes to the Vite SPA.

## Validation

```bash
npm run build
npm run test:optimizer
```

The committed GitHub Actions workflow runs both checks on pushes and pull requests.

## API example

`POST /api/optimize`

```json
{
  "vehicle": {
    "name": "17 ft Box Truck",
    "type": "Regional freight",
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

## Production roadmap

- Axle-level load limits and vehicle-specific restricted zones
- CSV, ERP, WMS, and barcode imports
- Async optimization workers for very large manifests
- Driver loading manifest and PDF export
- Team invitations, roles, and audit history
- Learned candidate ranking from accepted and edited plans
- Multi-vehicle shipment splitting and route-aware optimization

## License

MIT
