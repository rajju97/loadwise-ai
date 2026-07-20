import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AlertCircle, ArrowRight, Boxes, Check, ChevronRight, Gauge, LoaderCircle, PackagePlus, Plus, RefreshCw, Save, Scale, Sparkles, Trash2, Truck, Weight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { LoadScene } from '../components/LoadScene'
import { useAuth } from '../context/AuthContext'
import { optimizeLoad } from '../lib/api'
import { fetchPlans, fetchProducts, fetchVehicles, saveLoadPlan } from '../lib/data'
import { demoItems, demoOptimizationResult, demoVehicles } from '../lib/demo'
import type { LoadItem, OptimizationResult, Vehicle } from '../types'

const colors = ['#ff8a1f','#f4c542','#6e8798','#d65b3a','#b7bdc3','#ca7b2c']
const DEMO_VEHICLES_KEY = 'loadwise-demo-vehicles'
const DEMO_PRODUCTS_KEY = 'loadwise-demo-products'
const DEMO_PLANS_KEY = 'loadwise-demo-plans'
const SETTINGS_KEY = 'loadwise-workspace-preferences'

type Objective = 'balanced_utilization' | 'maximum_volume' | 'maximum_payload'

function readStoredArray<T>(key: string, fallback: T[]): T[] {
  try {
    const stored = localStorage.getItem(key)
    const parsed = stored ? JSON.parse(stored) : fallback
    return Array.isArray(parsed) ? parsed as T[] : fallback
  } catch {
    return fallback
  }
}

function readDefaultObjective(): Objective {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')?.objective
    return ['balanced_utilization', 'maximum_volume', 'maximum_payload'].includes(value)
      ? value as Objective
      : 'balanced_utilization'
  } catch {
    return 'balanced_utilization'
  }
}

function isObjective(value: unknown): value is Objective {
  return value === 'balanced_utilization' || value === 'maximum_volume' || value === 'maximum_payload'
}

export function OptimizerPage() {
  const { demoMode } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedVehicle = searchParams.get('vehicle')
  const requestedProduct = searchParams.get('product')
  const requestedPlan = searchParams.get('plan')
  const initialDemoVehicles = demoMode ? readStoredArray(DEMO_VEHICLES_KEY, demoVehicles) : []
  const initialDemoItems = demoMode ? readStoredArray(DEMO_PRODUCTS_KEY, demoItems) : []
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialDemoVehicles)
  const [vehicle, setVehicle] = useState<Vehicle | null>(initialDemoVehicles[2] || initialDemoVehicles[0] || null)
  const [items, setItems] = useState<LoadItem[]>(initialDemoItems)
  const [objective, setObjective] = useState<Objective>(readDefaultObjective)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [loadingWorkspace, setLoadingWorkspace] = useState(!demoMode)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  function invalidateResult() {
    setResult(null)
    setPlanSaved(false)
    setSavedMessage('')
  }

  useEffect(() => {
    let active = true
    setError('')

    if (demoMode) {
      const savedVehicles = readStoredArray(DEMO_VEHICLES_KEY, demoVehicles)
      const savedProducts = readStoredArray(DEMO_PRODUCTS_KEY, demoItems)
      const savedPlans = readStoredArray<Array<{ id: string; plan_data?: { vehicle?: Vehicle; items?: LoadItem[]; result?: OptimizationResult; objective?: Objective } }>[number]>(DEMO_PLANS_KEY, [])
      const selectedPlan = requestedPlan ? savedPlans.find((entry) => entry.id === requestedPlan) : undefined
      const selectedVehicle = requestedVehicle
        ? savedVehicles.find((entry) => (entry.id || entry.name) === requestedVehicle)
        : undefined
      const selectedProduct = requestedProduct
        ? savedProducts.find((entry) => entry.id === requestedProduct)
        : undefined

      setVehicles(savedVehicles)
      setVehicle(selectedPlan?.plan_data?.vehicle || selectedVehicle || savedVehicles[2] || savedVehicles[0] || null)
      setItems(selectedPlan?.plan_data?.items || (selectedProduct ? [{ ...selectedProduct, quantity: 1 }] : savedProducts))
      setResult(selectedPlan?.plan_data?.result || null)
      if (isObjective(selectedPlan?.plan_data?.objective)) setObjective(selectedPlan.plan_data.objective)
      setPlanSaved(Boolean(selectedPlan))
      setLoadingWorkspace(false)
      return
    }

    setLoadingWorkspace(true)
    setVehicles([])
    setVehicle(null)
    setItems([])
    setResult(null)
    setPlanSaved(false)

    Promise.all([fetchVehicles(), fetchProducts(), requestedPlan ? fetchPlans() : Promise.resolve([])]).then(([savedVehicles, savedProducts, savedPlans]) => {
      if (!active) return
      const selectedPlan = requestedPlan ? savedPlans.find((entry) => entry.id === requestedPlan) : undefined
      const selectedVehicle = requestedVehicle
        ? savedVehicles.find((entry) => (entry.id || entry.name) === requestedVehicle)
        : undefined
      const selectedProduct = requestedProduct
        ? savedProducts.find((entry) => entry.id === requestedProduct)
        : undefined

      setVehicles(savedVehicles)
      setVehicle(selectedPlan?.plan_data?.vehicle || selectedVehicle || savedVehicles[0] || null)
      setItems(selectedPlan?.plan_data?.items || (selectedProduct ? [{ ...selectedProduct, quantity: 1 }] : savedProducts.map((item) => ({ ...item, quantity: 1 }))))
      setResult(selectedPlan?.plan_data?.result || null)
      if (isObjective(selectedPlan?.plan_data?.objective)) setObjective(selectedPlan.plan_data.objective)
      setPlanSaved(Boolean(selectedPlan))
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Could not load workspace data')
    }).finally(() => {
      if (active) setLoadingWorkspace(false)
    })

    return () => { active = false }
  }, [demoMode, requestedPlan, requestedProduct, requestedVehicle])

  const totalUnits = useMemo(() => items.reduce((sum,item) => sum + item.quantity, 0), [items])
  const totalWeight = useMemo(() => items.reduce((sum,item) => sum + item.quantity * item.weight, 0), [items])
  const exceedsUnitLimit = totalUnits > 60
  const canOptimize = Boolean(vehicle && items.length && !exceedsUnitLimit && !loadingWorkspace && !busy)

  async function runOptimization() {
    if (busy || loadingWorkspace) return
    if (!vehicle) {
      setError('Add or select a vehicle before running the optimizer.')
      return
    }
    if (!items.length) {
      setError('Add at least one cargo item before running the optimizer.')
      return
    }
    if (exceedsUnitLimit) {
      setError('A maximum of 60 physical units can be optimized in one request.')
      return
    }

    setBusy(true)
    setError('')
    setSavedMessage('')
    setPlanSaved(false)
    try {
      if (demoMode) {
        const sampleVehicle = demoVehicles.find((entry) => entry.id === 'box-truck') || demoVehicles[0]
        setVehicle(sampleVehicle)
        setItems(demoItems.map((item) => ({ ...item })))
        setObjective('balanced_utilization')
        setResult(demoOptimizationResult)
        setSavedMessage('Loaded the precomputed demo sample. Sign in to optimize a custom manifest.')
      } else {
        setResult(await optimizeLoad(vehicle, items, objective))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not optimize this load')
    } finally {
      setBusy(false)
    }
  }

  async function savePlan() {
    if (!result || !vehicle || busy || saving || planSaved) return
    setSaving(true)
    setError('')
    try {
      if (demoMode) {
        const current = readStoredArray<Record<string, unknown>>(DEMO_PLANS_KEY, [])
        current.unshift({ id: crypto.randomUUID(), name: `${vehicle.name} load plan`, created_at: new Date().toISOString(), plan_data: { vehicle, items, objective, result } })
        localStorage.setItem(DEMO_PLANS_KEY, JSON.stringify(current.slice(0, 20)))
      } else {
        await saveLoadPlan(vehicle, items, result, objective)
      }
      setPlanSaved(true)
      setSavedMessage('Load plan saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this plan')
    } finally {
      setSaving(false)
    }
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next: LoadItem = {
      id: crypto.randomUUID(), name: String(data.get('name')).trim(), sku: String(data.get('sku') || '').trim(), quantity: Number(data.get('quantity')),
      length: Number(data.get('length')), width: Number(data.get('width')), height: Number(data.get('height')), weight: Number(data.get('weight')),
      allow_rotation: data.get('allow_rotation') === 'on', stackable: data.get('stackable') === 'on', fragile: data.get('fragile') === 'on', color: colors[items.length % colors.length],
    }
    setItems((current) => [...current, next])
    invalidateResult()
    setShowAdd(false)
    event.currentTarget.reset()
  }

  return (
    <AppShell title="Load optimizer" subtitle="Build a balanced, space-efficient plan with real cargo constraints.">
      <div className="optimizer-toolbar panel">
        <div className="progress-steps"><span className={vehicle ? 'done' : 'active'}><i>{vehicle ? <Check /> : 1}</i> Vehicle</span><ChevronRight /><span className={items.length ? 'done' : 'active'}><i>{items.length ? <Check /> : 2}</i> Cargo</span><ChevronRight /><span className={result ? 'done' : 'active'}><i>{result ? <Check /> : 3}</i> Optimize</span></div>
        <div className="optimizer-actions"><select aria-label="Optimization objective" value={objective} onChange={(e) => { setObjective(e.target.value as Objective); invalidateResult() }} disabled={demoMode || loadingWorkspace || busy}><option value="balanced_utilization">Balanced utilization</option><option value="maximum_volume">Maximum volume</option><option value="maximum_payload">Maximum payload</option></select><button className="button" onClick={runOptimization} disabled={!canOptimize}>{busy ? <><LoaderCircle className="spin" size={17} /> Optimizing…</> : <><Sparkles size={17} /> {demoMode ? 'Load precomputed sample' : 'Optimize load'}</>}</button></div>
      </div>

      {loadingWorkspace && <div className="panel data-loader"><LoaderCircle className="spin"/> Loading vehicles and products…</div>}
      {exceedsUnitLimit && <div className="error-banner"><AlertCircle size={18} /><div><strong>Too many cargo units</strong><span>Reduce the manifest to 60 physical units or fewer.</span></div></div>}
      {error && <div className="error-banner"><AlertCircle size={18} /><div><strong>Action failed</strong><span>{error}</span></div></div>}
      {savedMessage && <div className="success-banner"><Check size={18}/><strong>{savedMessage}</strong></div>}

      <div className="optimizer-layout">
        <div className="optimizer-left">
          <section className="panel config-panel"><div className="panel-head"><div><span className="section-index">01</span><h3>Select vehicle</h3></div><Link className="text-button" to="/app/vehicles"><Plus size={15} /> Add vehicle</Link></div>
            {vehicles.length ? <div className="vehicle-selector">
              {vehicles.map(v => <button type="button" key={v.id || v.name} disabled={busy} onClick={() => { setVehicle(v); invalidateResult() }} className={vehicle?.id===v.id && vehicle?.name===v.name ? 'vehicle-card selected' : 'vehicle-card'}><span className="vehicle-icon"><Truck /></span><strong>{v.name}</strong><small>{v.length} × {v.width} × {v.height} cm</small><em>{v.max_payload.toLocaleString()} kg payload</em>{vehicle?.id===v.id && vehicle?.name===v.name && <i><Check /></i>}</button>)}
            </div> : !loadingWorkspace && <div className="empty-data"><span><Truck/></span><h2>No vehicles available</h2><p>Add a vehicle before creating a real load plan.</p><Link className="button button-sm" to="/app/vehicles">Add vehicle</Link></div>}
          </section>

          <section className="panel cargo-panel"><div className="panel-head"><div><span className="section-index">02</span><h3>Add cargo</h3><p>{totalUnits} units · {totalWeight.toLocaleString()} kg total</p></div><button type="button" className="button button-outline button-sm" disabled={busy} onClick={() => setShowAdd(!showAdd)}><PackagePlus size={16} /> Add product</button></div>
            {showAdd && <form className="add-item-form" onSubmit={addItem}><div className="field-grid"><label className="wide">Product name<input name="name" required maxLength={120} placeholder="e.g. Ceramic tiles" /></label><label>SKU<input name="sku" maxLength={100} placeholder="Optional" /></label><label>Quantity<input name="quantity" type="number" min="1" max="60" defaultValue="1" required /></label><label>Length (cm)<input name="length" type="number" min="1" max="5000" required /></label><label>Width (cm)<input name="width" type="number" min="1" max="1000" required /></label><label>Height (cm)<input name="height" type="number" min="1" max="1000" required /></label><label>Weight / unit (kg)<input name="weight" type="number" min="0.1" max="100000" step="0.1" required /></label></div><div className="constraint-row"><label><input name="allow_rotation" type="checkbox" defaultChecked /> Allow rotation</label><label><input name="stackable" type="checkbox" defaultChecked /> Stackable</label><label><input name="fragile" type="checkbox" /> Fragile</label><div className="form-actions"><button type="button" className="text-button" onClick={() => setShowAdd(false)}>Cancel</button><button className="button button-sm">Add to load</button></div></div></form>}
            {items.length ? <div className="cargo-table-wrap"><table className="cargo-table"><thead><tr><th>Product</th><th>Dimensions</th><th>Weight</th><th>Qty</th><th>Constraints</th><th></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><div className="product-cell"><span style={{background:item.color}} /><div><strong>{item.name}</strong><small>{item.sku || 'No SKU'}</small></div></div></td><td>{item.length} × {item.width} × {item.height} cm</td><td>{item.weight} kg</td><td><input className="qty-input" type="number" min="1" max="60" disabled={busy} value={item.quantity} onChange={e => { const quantity = Number(e.target.value); setItems(current => current.map(x => x.id===item.id ? {...x, quantity:Number.isFinite(quantity) ? Math.max(1, Math.min(60, quantity)) : 1} : x)); invalidateResult() }}/></td><td><div className="tag-row">{item.fragile && <span className="tag warn">Fragile</span>}{item.stackable && <span className="tag">Stackable</span>}{item.allow_rotation && <span className="tag">Rotate</span>}</div></td><td><button type="button" className="icon-button danger" disabled={busy} aria-label={`Remove ${item.name}`} onClick={() => { setItems(current => current.filter(x => x.id!==item.id)); invalidateResult() }}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div> : !loadingWorkspace && <div className="empty-data"><span><Boxes/></span><h2>No cargo in this manifest</h2><p>Add an item here or select one from the product catalog.</p></div>}
          </section>
        </div>

        <aside className="optimizer-right">
          <section className="panel visualization-panel"><div className="panel-head"><div><span className="section-index">03</span><h3>3D load plan</h3></div>{result && <button type="button" className="text-button" disabled={busy} onClick={runOptimization}>{busy ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} Re-run</button>}</div>{vehicle ? <LoadScene vehicle={vehicle} result={result}/> : <div className="scene-empty"><span><Truck /></span><strong>Select a vehicle to begin</strong><p>The 3D cargo bay will appear after a vehicle is available.</p></div>}{vehicle && !result && <div className="scene-empty"><span><Boxes /></span><strong>Your optimized layout will appear here</strong><p>{demoMode ? 'Load the precomputed sample to explore the 3D viewer.' : 'Click “Optimize load” to generate the 3D plan.'}</p></div>}</section>
          <section className="panel results-panel"><div className="panel-head"><div><h3>Plan performance</h3><p>{result ? `${result.algorithm} · ${result.runtime_ms} ms` : 'Waiting for optimization'}</p></div></div>
            <div className="result-metrics">
              <div className="result-primary"><div className="ring" style={{'--progress': `${result?.volume_utilization || 0}%`} as CSSProperties}><div><strong>{Math.round(result?.volume_utilization || 0)}%</strong><span>Space used</span></div></div></div>
              <div className="result-secondary"><div><span><Weight size={16}/> Payload</span><strong>{Math.round(result?.payload_utilization || 0)}%</strong><i><b style={{width:`${result?.payload_utilization || 0}%`}}/></i></div><div><span><Scale size={16}/> Load stability</span><strong>{Math.round(result?.balance_score || 0)}%</strong><i><b style={{width:`${result?.balance_score || 0}%`}}/></i></div><div><span><Gauge size={16}/> Items placed</span><strong>{result ? `${result.placed_count}/${result.total_count}` : '—'}</strong></div></div>
            </div>
            {result ? <><div className="recommendations"><strong>Optimizer recommendations</strong>{result.recommendations.map(r => <p key={r}><Check size={15}/>{r}</p>)}</div>{result.unplaced.length>0 && <div className="unplaced"><AlertCircle size={17}/><div><strong>{result.unplaced.length} item(s) could not be placed</strong><span>Review payload and item constraints.</span></div></div>}<div className="loading-sequence"><strong>Loading sequence</strong><div>{result.placements.slice().sort((a,b) => a.loading_order-b.loading_order).slice(0,6).map((placement) => <span key={placement.unit_id}><i>{placement.loading_order}</i>{placement.name}</span>)}</div></div><button className="button full-width" onClick={savePlan} disabled={saving || busy || planSaved}>{saving ? <><LoaderCircle className="spin" size={17}/> Saving…</> : planSaved ? <><Check size={17}/> Plan saved</> : <><Save size={17}/> Save load plan <ArrowRight size={17}/></>}</button></> : <div className="results-placeholder"><Sparkles/><p>Run the optimizer to see utilization, weight distribution, loading order, and actionable recommendations.</p></div>}
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
