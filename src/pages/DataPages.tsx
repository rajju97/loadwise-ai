import { FormEvent, useEffect, useState } from 'react'
import { Boxes, CalendarClock, LoaderCircle, PackageOpen, Plus, Route, Settings, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import { createProduct, createVehicle, fetchPlans, fetchProducts, fetchVehicles, type SavedPlan } from '../lib/data'
import { demoItems, demoVehicles } from '../lib/demo'
import type { LoadItem, Vehicle } from '../types'

const productColors = ['#ff8a1f', '#f4c542', '#6e8798', '#d65b3a', '#b7bdc3', '#ca7b2c']

export function VehiclesPage() {
  const { demoMode } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>(demoMode ? demoVehicles : [])
  const [loading, setLoading] = useState(!demoMode)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (demoMode) return
    fetchVehicles().then(setVehicles).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [demoMode])

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const vehicle: Vehicle = {
      name: String(data.get('name')),
      type: String(data.get('type') || 'Custom vehicle'),
      length: Number(data.get('length')),
      width: Number(data.get('width')),
      height: Number(data.get('height')),
      max_payload: Number(data.get('max_payload')),
    }
    try {
      const saved = demoMode ? { ...vehicle, id: crypto.randomUUID() } : await createVehicle(vehicle)
      setVehicles((current) => [...current, saved])
      setShowForm(false)
      form.reset()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save vehicle') }
  }

  return <AppShell title="Vehicles" subtitle="Manage dimensions and payload limits for your fleet.">
    <div className="panel data-page">
      <div className="panel-head"><div><h3>Vehicle library</h3><p>{vehicles.length} saved vehicle types</p></div><button className="button" onClick={() => setShowForm(!showForm)}><Plus size={16}/> Add vehicle</button></div>
      {error && <div className="form-error page-error">{error}</div>}
      {showForm && <form className="inline-entity-form" onSubmit={add}>
        <div className="field-grid">
          <label className="wide">Vehicle name<input name="name" required placeholder="e.g. 32 ft multi-axle truck"/></label>
          <label>Type<input name="type" placeholder="Box truck"/></label>
          <label>Length (cm)<input name="length" type="number" min="1" required/></label>
          <label>Width (cm)<input name="width" type="number" min="1" required/></label>
          <label>Height (cm)<input name="height" type="number" min="1" required/></label>
          <label>Payload (kg)<input name="max_payload" type="number" min="1" required/></label>
        </div>
        <div className="form-actions"><button type="button" className="text-button" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-sm">Save vehicle</button></div>
      </form>}
      {loading ? <div className="data-loader"><LoaderCircle className="spin"/> Loading fleet…</div> : <div className="data-card-grid">{vehicles.map(v => <article className="entity-card" key={v.id || v.name}><span className="entity-icon"><Truck/></span><div><h3>{v.name}</h3><p>{v.type}</p></div><dl><div><dt>Cargo bay</dt><dd>{v.length} × {v.width} × {v.height} cm</dd></div><div><dt>Max payload</dt><dd>{v.max_payload.toLocaleString()} kg</dd></div></dl><Link className="button button-outline full-width" to="/app/optimizer">Use in optimizer</Link></article>)}</div>}
    </div>
  </AppShell>
}

export function ProductsPage() {
  const { demoMode } = useAuth()
  const [items, setItems] = useState<LoadItem[]>(demoMode ? demoItems : [])
  const [loading, setLoading] = useState(!demoMode)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (demoMode) return
    fetchProducts().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [demoMode])

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const item: LoadItem = {
      id: crypto.randomUUID(),
      name: String(data.get('name')),
      sku: String(data.get('sku') || ''),
      quantity: 1,
      length: Number(data.get('length')),
      width: Number(data.get('width')),
      height: Number(data.get('height')),
      weight: Number(data.get('weight')),
      allow_rotation: data.get('allow_rotation') === 'on',
      stackable: data.get('stackable') === 'on',
      fragile: data.get('fragile') === 'on',
      color: productColors[items.length % productColors.length],
    }
    try {
      const saved = demoMode ? item : await createProduct(item)
      setItems((current) => [...current, saved])
      setShowForm(false)
      form.reset()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save product') }
  }

  return <AppShell title="Products" subtitle="Create a reusable cargo catalog with loading constraints.">
    <div className="panel data-page">
      <div className="panel-head"><div><h3>Product catalog</h3><p>{items.length} saved product types</p></div><button className="button" onClick={() => setShowForm(!showForm)}><Plus size={16}/> Add product</button></div>
      {error && <div className="form-error page-error">{error}</div>}
      {showForm && <form className="inline-entity-form" onSubmit={add}>
        <div className="field-grid">
          <label className="wide">Product name<input name="name" required placeholder="e.g. Ceramic tile carton"/></label>
          <label>SKU<input name="sku" placeholder="Optional"/></label>
          <label>Length (cm)<input name="length" type="number" min="1" required/></label>
          <label>Width (cm)<input name="width" type="number" min="1" required/></label>
          <label>Height (cm)<input name="height" type="number" min="1" required/></label>
          <label>Weight (kg)<input name="weight" type="number" min="0.1" step="0.1" required/></label>
        </div>
        <div className="constraint-row"><label><input name="allow_rotation" type="checkbox" defaultChecked/> Allow rotation</label><label><input name="stackable" type="checkbox" defaultChecked/> Stackable</label><label><input name="fragile" type="checkbox"/> Fragile</label><div className="form-actions"><button type="button" className="text-button" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-sm">Save product</button></div></div>
      </form>}
      {loading ? <div className="data-loader"><LoaderCircle className="spin"/> Loading catalog…</div> : <div className="product-library">{items.map(i => <div className="product-library-row" key={i.id}><span className="product-swatch" style={{background:i.color}}><PackageOpen/></span><div className="product-library-main"><strong>{i.name}</strong><span>{i.sku || 'No SKU'}</span></div><div><small>Dimensions</small><b>{i.length} × {i.width} × {i.height} cm</b></div><div><small>Unit weight</small><b>{i.weight} kg</b></div><div className="tag-row">{i.fragile&&<span className="tag warn">Fragile</span>}{i.stackable&&<span className="tag">Stackable</span>}{i.allow_rotation&&<span className="tag">Rotate</span>}</div><Link className="icon-button" to="/app/optimizer" aria-label="Use product">→</Link></div>)}</div>}
    </div>
  </AppShell>
}

export function PlansPage() {
  const { demoMode } = useAuth()
  const [plans, setPlans] = useState<SavedPlan[]>(() => demoMode ? JSON.parse(localStorage.getItem('loadwise-demo-plans') || '[]') : [])
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (demoMode) return
    fetchPlans().then(setPlans).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [demoMode])

  return <AppShell title="Saved plans" subtitle="Review, share, and reuse completed loading plans.">
    {error && <div className="form-error page-error">{error}</div>}
    {loading ? <div className="panel data-loader"><LoaderCircle className="spin"/> Loading plans…</div> : plans.length === 0 ? <div className="panel empty-data"><span><Route/></span><h2>Your saved plans will live here</h2><p>Run an optimization and save the result to build your reusable plan library.</p><Link className="button" to="/app/optimizer"><Boxes size={17}/> Create first plan</Link></div> : <div className="panel data-page"><div className="panel-head"><div><h3>Plan library</h3><p>{plans.length} optimized load plans</p></div><Link className="button" to="/app/optimizer"><Plus size={16}/> New plan</Link></div><div className="saved-plan-grid">{plans.map((plan) => <article className="saved-plan-card" key={plan.id}><div className="saved-plan-top"><span><Boxes/></span><small>{plan.reference_code || 'Saved plan'}</small></div><h3>{plan.name}</h3><p>{plan.plan_data.vehicle.name}</p><div className="saved-plan-metrics"><div><b>{Math.round(plan.plan_data.result.volume_utilization)}%</b><span>Space</span></div><div><b>{Math.round(plan.plan_data.result.payload_utilization)}%</b><span>Payload</span></div><div><b>{plan.plan_data.result.placed_count}</b><span>Items</span></div></div><footer><CalendarClock size={14}/>{new Date(plan.created_at).toLocaleString()}</footer></article>)}</div></div>}
  </AppShell>
}

export function SettingsPage(){return <AppShell title="Settings" subtitle="Manage workspace preferences and integrations."><div className="settings-grid"><div className="panel settings-nav"><button className="active"><Settings/> General</button><button><Truck/> Optimization defaults</button><button><PackageOpen/> Supabase connection</button></div><div className="panel settings-form"><h3>Workspace details</h3><p>These settings identify your organization across saved plans.</p><label>Workspace name<input defaultValue="Main workspace"/></label><label>Default unit system<select defaultValue="metric"><option value="metric">Metric (cm, kg)</option><option value="imperial">Imperial (in, lb)</option></select></label><label>Default optimization objective<select defaultValue="balanced"><option value="balanced">Balanced utilization</option><option value="volume">Maximum volume</option><option value="weight">Maximum payload</option></select></label><button className="button">Save settings</button></div></div></AppShell>}
