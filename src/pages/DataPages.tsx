import { FormEvent, useEffect, useState } from 'react'
import { Boxes, CalendarClock, Check, LoaderCircle, PackageOpen, Plus, Route, Settings, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import {
  createProduct,
  createVehicle,
  fetchPlans,
  fetchProducts,
  fetchVehicles,
  fetchWorkspace,
  updateWorkspaceName,
  type SavedPlan,
} from '../lib/data'
import { demoItems, demoVehicles } from '../lib/demo'
import type { LoadItem, Vehicle } from '../types'

const productColors = ['#ff8a1f', '#f4c542', '#6e8798', '#d65b3a', '#b7bdc3', '#ca7b2c']
const DEMO_VEHICLES_KEY = 'loadwise-demo-vehicles'
const DEMO_PRODUCTS_KEY = 'loadwise-demo-products'
const DEMO_PLANS_KEY = 'loadwise-demo-plans'
const SETTINGS_KEY = 'loadwise-workspace-preferences'
const DEMO_WORKSPACE_KEY = 'loadwise-demo-workspace-name'

type Preferences = {
  objective: 'balanced_utilization' | 'maximum_volume' | 'maximum_payload'
}

function readStoredArray<T>(key: string, fallback: T[]): T[] {
  try {
    const stored = localStorage.getItem(key)
    const parsed = stored ? JSON.parse(stored) : fallback
    return Array.isArray(parsed) ? parsed as T[] : fallback
  } catch {
    return fallback
  }
}

function writeStoredArray<T>(key: string, value: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage may be unavailable */ }
}

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<Preferences>
    return {
      objective: ['balanced_utilization', 'maximum_volume', 'maximum_payload'].includes(stored.objective || '')
        ? stored.objective as Preferences['objective']
        : 'balanced_utilization',
    }
  } catch {
    return { objective: 'balanced_utilization' }
  }
}

export function VehiclesPage() {
  const { demoMode } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => demoMode ? readStoredArray(DEMO_VEHICLES_KEY, demoVehicles) : [])
  const [loading, setLoading] = useState(!demoMode)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (demoMode) {
      setVehicles(readStoredArray(DEMO_VEHICLES_KEY, demoVehicles))
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    fetchVehicles()
      .then((value) => { if (active) setVehicles(value) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load fleet') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [demoMode])

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const vehicle: Vehicle = {
      name: String(data.get('name')).trim(),
      type: String(data.get('type') || 'Custom vehicle').trim(),
      length: Number(data.get('length')),
      width: Number(data.get('width')),
      height: Number(data.get('height')),
      max_payload: Number(data.get('max_payload')),
    }
    setSaving(true)
    setError('')
    try {
      const saved = demoMode ? { ...vehicle, id: crypto.randomUUID() } : await createVehicle(vehicle)
      setVehicles((current) => {
        const next = [...current, saved]
        if (demoMode) writeStoredArray(DEMO_VEHICLES_KEY, next)
        return next
      })
      setShowForm(false)
      form.reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save vehicle')
    } finally {
      setSaving(false)
    }
  }

  return <AppShell title="Vehicles" subtitle="Manage dimensions and payload limits for your fleet.">
    <div className="panel data-page">
      <div className="panel-head"><div><h3>Vehicle library</h3><p>{vehicles.length} saved vehicle types</p></div><button className="button" onClick={() => setShowForm(!showForm)}><Plus size={16}/> Add vehicle</button></div>
      {error && <div className="form-error page-error">{error}</div>}
      {showForm && <form className="inline-entity-form" onSubmit={add}>
        <div className="field-grid">
          <label className="wide">Vehicle name<input name="name" required maxLength={120} placeholder="e.g. 32 ft multi-axle truck"/></label>
          <label>Type<input name="type" maxLength={80} placeholder="Box truck"/></label>
          <label>Length (cm)<input name="length" type="number" min="1" max="5000" required/></label>
          <label>Width (cm)<input name="width" type="number" min="1" max="1000" required/></label>
          <label>Height (cm)<input name="height" type="number" min="1" max="1000" required/></label>
          <label>Payload (kg)<input name="max_payload" type="number" min="1" max="100000" required/></label>
        </div>
        <div className="form-actions"><button type="button" className="text-button" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-sm" disabled={saving}>{saving ? 'Saving…' : 'Save vehicle'}</button></div>
      </form>}
      {loading ? <div className="data-loader"><LoaderCircle className="spin"/> Loading fleet…</div> : vehicles.length === 0 ? <div className="empty-data"><span><Truck/></span><h2>No vehicles yet</h2><p>Add a vehicle to begin planning real loads.</p></div> : <div className="data-card-grid">{vehicles.map(v => <article className="entity-card" key={v.id || v.name}><span className="entity-icon"><Truck/></span><div><h3>{v.name}</h3><p>{v.type}</p></div><dl><div><dt>Cargo bay</dt><dd>{v.length} × {v.width} × {v.height} cm</dd></div><div><dt>Max payload</dt><dd>{v.max_payload.toLocaleString()} kg</dd></div></dl><Link className="button button-outline full-width" to={`/app/optimizer?vehicle=${encodeURIComponent(v.id || v.name)}`}>Use in optimizer</Link></article>)}</div>}
    </div>
  </AppShell>
}

export function ProductsPage() {
  const { demoMode } = useAuth()
  const [items, setItems] = useState<LoadItem[]>(() => demoMode ? readStoredArray(DEMO_PRODUCTS_KEY, demoItems) : [])
  const [loading, setLoading] = useState(!demoMode)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (demoMode) {
      setItems(readStoredArray(DEMO_PRODUCTS_KEY, demoItems))
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    fetchProducts()
      .then((value) => { if (active) setItems(value) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load catalog') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [demoMode])

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const item: LoadItem = {
      id: crypto.randomUUID(),
      name: String(data.get('name')).trim(),
      sku: String(data.get('sku') || '').trim(),
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
    setSaving(true)
    setError('')
    try {
      const saved = demoMode ? item : await createProduct(item)
      setItems((current) => {
        const next = [...current, saved]
        if (demoMode) writeStoredArray(DEMO_PRODUCTS_KEY, next)
        return next
      })
      setShowForm(false)
      form.reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save product')
    } finally {
      setSaving(false)
    }
  }

  return <AppShell title="Products" subtitle="Create a reusable cargo catalog with loading constraints.">
    <div className="panel data-page">
      <div className="panel-head"><div><h3>Product catalog</h3><p>{items.length} saved product types</p></div><button className="button" onClick={() => setShowForm(!showForm)}><Plus size={16}/> Add product</button></div>
      {error && <div className="form-error page-error">{error}</div>}
      {showForm && <form className="inline-entity-form" onSubmit={add}>
        <div className="field-grid">
          <label className="wide">Product name<input name="name" required maxLength={120} placeholder="e.g. Ceramic tile carton"/></label>
          <label>SKU<input name="sku" maxLength={100} placeholder="Optional"/></label>
          <label>Length (cm)<input name="length" type="number" min="1" max="5000" required/></label>
          <label>Width (cm)<input name="width" type="number" min="1" max="1000" required/></label>
          <label>Height (cm)<input name="height" type="number" min="1" max="1000" required/></label>
          <label>Weight (kg)<input name="weight" type="number" min="0.1" max="100000" step="0.1" required/></label>
        </div>
        <div className="constraint-row"><label><input name="allow_rotation" type="checkbox" defaultChecked/> Allow rotation</label><label><input name="stackable" type="checkbox" defaultChecked/> Stackable</label><label><input name="fragile" type="checkbox"/> Fragile</label><div className="form-actions"><button type="button" className="text-button" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-sm" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button></div></div>
      </form>}
      {loading ? <div className="data-loader"><LoaderCircle className="spin"/> Loading catalog…</div> : items.length === 0 ? <div className="empty-data"><span><PackageOpen/></span><h2>No products yet</h2><p>Add a product to build your reusable cargo catalog.</p></div> : <div className="product-library">{items.map(i => <div className="product-library-row" key={i.id}><span className="product-swatch" style={{background:i.color}}><PackageOpen/></span><div className="product-library-main"><strong>{i.name}</strong><span>{i.sku || 'No SKU'}</span></div><div><small>Dimensions</small><b>{i.length} × {i.width} × {i.height} cm</b></div><div><small>Unit weight</small><b>{i.weight} kg</b></div><div className="tag-row">{i.fragile&&<span className="tag warn">Fragile</span>}{i.stackable&&<span className="tag">Stackable</span>}{i.allow_rotation&&<span className="tag">Rotate</span>}</div><Link className="icon-button" to={`/app/optimizer?product=${encodeURIComponent(i.id)}`} aria-label={`Use ${i.name} in optimizer`}>→</Link></div>)}</div>}
    </div>
  </AppShell>
}

export function PlansPage() {
  const { demoMode } = useAuth()
  const [plans, setPlans] = useState<SavedPlan[]>(() => demoMode ? readStoredArray<SavedPlan>(DEMO_PLANS_KEY, []) : [])
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (demoMode) {
      setPlans(readStoredArray<SavedPlan>(DEMO_PLANS_KEY, []))
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    fetchPlans()
      .then((value) => { if (active) setPlans(value) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load plans') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [demoMode])

  return <AppShell title="Saved plans" subtitle="Review, share, and reuse completed loading plans.">
    {error && <div className="form-error page-error">{error}</div>}
    {loading ? <div className="panel data-loader"><LoaderCircle className="spin"/> Loading plans…</div> : plans.length === 0 ? <div className="panel empty-data"><span><Route/></span><h2>Your saved plans will live here</h2><p>Run an optimization and save the result to build your reusable plan library.</p><Link className="button" to="/app/optimizer"><Boxes size={17}/> Create first plan</Link></div> : <div className="panel data-page"><div className="panel-head"><div><h3>Plan library</h3><p>{plans.length} optimized load plans</p></div><Link className="button" to="/app/optimizer"><Plus size={16}/> New plan</Link></div><div className="saved-plan-grid">{plans.map((plan) => {
      const result = plan.plan_data?.result
      return <article className="saved-plan-card" key={plan.id}><div className="saved-plan-top"><span><Boxes/></span><small>{plan.reference_code || 'Saved plan'}</small></div><h3>{plan.name || 'Untitled load plan'}</h3><p>{plan.plan_data?.vehicle?.name || 'Unknown vehicle'}</p><div className="saved-plan-metrics"><div><b>{Math.round(Number(result?.volume_utilization || 0))}%</b><span>Space</span></div><div><b>{Math.round(Number(result?.payload_utilization || 0))}%</b><span>Payload</span></div><div><b>{Number(result?.placed_count || 0)}</b><span>Items</span></div></div><footer><CalendarClock size={14}/>{Number.isNaN(new Date(plan.created_at).getTime()) ? 'Unknown date' : new Date(plan.created_at).toLocaleString()}</footer><Link className="button button-outline full-width" to={`/app/optimizer?plan=${encodeURIComponent(plan.id)}`}>Open plan</Link></article>
    })}</div></div>}
  </AppShell>
}

export function SettingsPage() {
  const { demoMode } = useAuth()
  const [activeTab, setActiveTab] = useState<'general' | 'optimization' | 'connection'>('general')
  const [workspaceName, setWorkspaceName] = useState('Main workspace')
  const [preferences, setPreferences] = useState<Preferences>(readPreferences)
  const [loading, setLoading] = useState(!demoMode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (demoMode) {
      try { setWorkspaceName(localStorage.getItem(DEMO_WORKSPACE_KEY) || 'Demo workspace') } catch { setWorkspaceName('Demo workspace') }
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    fetchWorkspace()
      .then((workspace) => { if (active) setWorkspaceName(workspace.name) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load workspace') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [demoMode])

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (activeTab === 'general') {
        const normalizedName = workspaceName.trim()
        if (!normalizedName) throw new Error('Workspace name is required')
        if (demoMode) {
          localStorage.setItem(DEMO_WORKSPACE_KEY, normalizedName)
        } else {
          const workspace = await updateWorkspaceName(normalizedName)
          setWorkspaceName(workspace.name)
        }
      }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences))
      setMessage('Settings saved successfully')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return <AppShell title="Settings" subtitle="Manage workspace preferences and integrations.">
    <div className="settings-grid">
      <div className="panel settings-nav">
        <button className={activeTab === 'general' ? 'active' : ''} onClick={() => { setActiveTab('general'); setMessage(''); setError('') }}><Settings/> General</button>
        <button className={activeTab === 'optimization' ? 'active' : ''} onClick={() => { setActiveTab('optimization'); setMessage(''); setError('') }}><Truck/> Optimization defaults</button>
        <button className={activeTab === 'connection' ? 'active' : ''} onClick={() => { setActiveTab('connection'); setMessage(''); setError('') }}><PackageOpen/> Supabase connection</button>
      </div>
      <form className="panel settings-form" onSubmit={saveSettings}>
        {loading ? <div className="data-loader"><LoaderCircle className="spin"/> Loading settings…</div> : <>
          {activeTab === 'general' && <><h3>Workspace details</h3><p>These settings identify your organization across saved plans.</p><label>Workspace name<input value={workspaceName} maxLength={120} onChange={(event) => setWorkspaceName(event.target.value)}/></label></>}
          {activeTab === 'optimization' && <><h3>Optimization defaults</h3><p>These browser preferences are used when opening a new load plan.</p><label>Unit system<input value="Metric (cm, kg)" readOnly aria-readonly="true"/></label><p>Imperial conversion is not available yet, so all dimensions and weights remain metric.</p><label>Default optimization objective<select value={preferences.objective} onChange={(event) => setPreferences({...preferences, objective: event.target.value as Preferences['objective']})}><option value="balanced_utilization">Balanced utilization</option><option value="maximum_volume">Maximum volume</option><option value="maximum_payload">Maximum payload</option></select></label></>}
          {activeTab === 'connection' && <><h3>Supabase connection</h3><p>{demoMode ? 'Demo mode stores sample data in this browser and does not call protected optimizer compute.' : 'Your account is connected through Supabase Auth. Database access is restricted by organization-level Row Level Security.'}</p><div className="success-banner"><Check size={18}/><strong>{demoMode ? 'Secure demo mode active' : 'Authenticated connection active'}</strong></div></>}
          {error && <div className="form-error page-error">{error}</div>}
          {message && <div className="success-banner"><Check size={18}/><strong>{message}</strong></div>}
          {activeTab !== 'connection' && <button className="button" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>}
        </>}
      </form>
    </div>
  </AppShell>
}
