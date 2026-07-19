import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, Boxes, Check, ChevronRight, Gauge, LoaderCircle, PackagePlus, Plus, RefreshCw, Save, Scale, Sparkles, Trash2, Truck, Weight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { LoadScene } from '../components/LoadScene'
import { useAuth } from '../context/AuthContext'
import { optimizeLoad } from '../lib/api'
import { fetchProducts, fetchVehicles, saveLoadPlan } from '../lib/data'
import { demoItems, demoOptimizationResult, demoVehicles } from '../lib/demo'
import type { LoadItem, OptimizationResult, Vehicle } from '../types'

const colors = ['#ff8a1f','#f4c542','#6e8798','#d65b3a','#b7bdc3','#ca7b2c']
const DEMO_VEHICLES_KEY = 'loadwise-demo-vehicles'
const DEMO_PRODUCTS_KEY = 'loadwise-demo-products'
const SETTINGS_KEY = 'loadwise-workspace-preferences'

type Objective = 'balanced_utilization' | 'maximum_volume' | 'maximum_payload'

function readStoredArray<T>(key: string, fallback: T[]): T[] {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T[] : fallback
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

export function OptimizerPage() {
  const { demoMode } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedVehicle = searchParams.get('vehicle')
  const requestedProduct = searchParams.get('product')
  const initialDemoVehicles = readStoredArray(DEMO_VEHICLES_KEY, demoVehicles)
  const initialDemoItems = readStoredArray(DEMO_PRODUCTS_KEY, demoItems)
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialDemoVehicles)
  const [vehicle, setVehicle] = useState<Vehicle>(initialDemoVehicles[2] || initialDemoVehicles[0] || demoVehicles[2])
  const [items, setItems] = useState<LoadItem[]>(initialDemoItems)
  const [objective, setObjective] = useState<Objective>(readDefaultObjective)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let active = true

    if (demoMode) {
      const savedVehicles = readStoredArray(DEMO_VEHICLES_KEY, demoVehicles)
      const savedProducts = readStoredArray(DEMO_PRODUCTS_KEY, demoItems)
      const selectedVehicle = requestedVehicle
        ? savedVehicles.find((entry) => (entry.id || entry.name) === requestedVehicle)
        : undefined
      const selectedProduct = requestedProduct
        ? savedProducts.find((entry) => entry.id === requestedProduct)
        : undefined
      setVehicles(savedVehicles)
      setVehicle(selectedVehicle || savedVehicles[2] || savedVehicles[0] || demoVehicles[2])
      setItems(selectedProduct ? [{ ...selectedProduct, quantity: 1 }] : savedProducts)
      return
    }

    Promise.all([fetchVehicles(), fetchProducts()]).then(([savedVehicles, savedProducts]) => {
      if (!active) return
      if (savedVehicles.length) {
        const selectedVehicle = requestedVehicle
          ? savedVehicles.find((entry) => (entry.id || entry.name) === requestedVehicle)
          : undefined
        setVehicles(savedVehicles)
        setVehicle(selectedVehicle || savedVehicles[0])
      }
      if (savedProducts.length) {
        const selectedProduct = requestedProduct
          ? savedProducts.find((entry) => entry.id === requestedProduct)
          : undefined
        setItems(selectedProduct ? [{ ...selectedProduct, quantity: 1 }] : savedProducts.map((item) => ({ ...item, quantity: 1 })))
      }
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Could not load workspace data')
    })

    return () => { active = false }
  }, [demoMode, requestedProduct, requestedVehicle])

  const totalUnits = useMemo(() => items.reduce((sum,item) => sum + item.quantity, 0), [items])
  const totalWeight = useMemo(() => items.reduce((sum,item) => sum + item.quantity * item.weight, 0), [items])
  const exceedsUnitLimit = totalUnits > 60

  async function runOptimization() {
    if (exceedsUnitLimit) {
      setError('A maximum of 60 physical units can be optimized in one request.')
      return
    }
    setBusy(true)
    setError('')
    setSavedMessage('')
    try {
      if (demoMode) {
        setVehicle(demoVehicles[2])
        setVehicles(readStoredArray(DEMO_VEHICLES_KEY, demoVehicles))
        setItems(demoItems.map((item) => ({ ...item })))
        setObjective('balanced_utilization')
        setResult(demoOptimizationResult)
        setSavedMessage('Showing a precomputed sample. Sign in to optimize custom loads.')
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
    if (!result) return
    setSaving(true)
    setError('')
    try {
      if (demoMode) {
        let current: unknown[] = []
        try { current = JSON.parse(localStorage.getItem('loadwise-demo-plans') || '[]') } catch { current = [] }
        current.unshift({ id: crypto.randomUUID(), name: `${vehicle.name} load plan`, created_at: new Date().toISOString(), plan_data: { vehicle, items, result } })
        localStorage.setItem('loadwise-demo-plans', JSON.stringify(current.slice(0, 20)))
      } else {
        await saveLoadPlan(vehicle, items, result, objective)
      }
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
    setItems([...items, next])
    setResult(null)
    setShowAdd(false)
    event.currentTarget.reset()
  }

  return (
    <AppShell title="Load optimizer" subtitle="Build a balanced, space-efficient plan with real cargo constraints.">
      <div className="optimizer-toolbar panel">
        <div className="progress-steps"><span className="done"><i><Check /></i> Vehicle</span><ChevronRight /><span className="done"><i><Check /></i> Cargo</span><ChevronRight /><span className={result ? 'done' : 'active'}><i>{result ? <Check /> : 3}</i> Optimize</span></div>
        <div className="optimizer-actions"><select aria-label="Optimization objective" value={objective} onChange={(e) => { setObjective(e.target.value as Objective); setResult(null) }} disabled={demoMode}><option value="balanced_utilization">Balanced utilization</option><option value="maximum_volume">Maximum volume</option><option value="maximum_payload">Maximum payload</option></select><button className="button" onClick={runOptimization} disabled={busy || exceedsUnitLimit || (!demoMode && items.length===0)}>{busy ? <><LoaderCircle className="spin" size={17} /> Optimizing…</> : <><Sparkles size={17} /> {demoMode ? 'Load demo plan' : 'Optimize load'}</>}</button></div>
      </div>

      {exceedsUnitLimit && <div className="error-banner"><AlertCircle size={18} /><div><strong>Too many cargo units</strong><span>Reduce the manifest to 60 physical units or fewer.</span></div></div>}
      {error && <div className="error-banner"><AlertCircle size={18} /><div><strong>Action failed</strong><span>{error}</span></div></div>}
      {savedMessage && <div className="success-banner"><Check size={18}/><strong>{savedMessage}</strong></div>}

      <div className="optimizer-layout">
        <div className="optimizer-left">
          <section className="panel config-panel"><div className="panel-head"><div><span className="section-index">01</span><h3>Select vehicle</h3></div><Link className="text-button" to="/app/vehicles"><Plus size={15} /> Add vehicle</Link></div>
            <div className="vehicle-selector">
              {vehicles.map(v => <button key={v.id || v.name} onClick={() => { setVehicle(v); setResult(null); setSavedMessage('') }} className={vehicle.id===v.id && vehicle.name===v.name ? 'vehicle-card selected' : 'vehicle-card'}><span className="vehicle-icon"><Truck /></span><strong>{v.name}</strong><small>{v.length} × {v.width} × {v.height} cm</small><em>{v.max_payload.toLocaleString()} kg payload</em>{vehicle.id===v.id && vehicle.name===v.name && <i><Check /></i>}</button>)}
            </div>
          </section>

          <section className="panel cargo-panel"><div className="panel-head"><div><span className="section-index">02</span><h3>Add cargo</h3><p>{totalUnits} units · {totalWeight.toLocaleString()} kg total</p></div><button className="button button-outline button-sm" onClick={() => setShowAdd(!showAdd)}><PackagePlus size={16} /> Add product</button></div>
            {showAdd && <form className="add-item-form" onSubmit={addItem}><div className="field-grid"><label className="wide">Product name<input name="name" required maxLength={120} placeholder="e.g. Ceramic tiles" /></label><label>SKU<input name="sku" maxLength={100} placeholder="Optional" /></label><label>Quantity<input name="quantity" type="number" min="1" max="60" defaultValue="1" required /></label><label>Length (cm)<input name="length" type="number" min="1" max="5000" required /></label><label>Width (cm)<input name="width" type="number" min="1" max="1000" required /></label><label>Height (cm)<input name="height" type="number" min="1" max="1000" required /></label><label>Weight / unit (kg)<input name="weight" type="number" min="0.1" max="100000" step="0.1" required /></label></div><div className="constraint-row"><label><input name="allow_rotation" type="checkbox" defaultChecked /> Allow rotation</label><label><input name="stackable" type="checkbox" defaultChecked /> Stackable</label><label><input name="fragile" type="checkbox" /> Fragile</label><div className="form-actions"><button type="button" className="text-button" onClick={() => setShowAdd(false)}>Cancel</button><button className="button button-sm">Add to load</button></div></div></form>}
            <div className="cargo-table-wrap"><table className="cargo-table"><thead><tr><th>Product</th><th>Dimensions</th><th>Weight</th><th>Qty</th><th>Constraints</th><th></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><div className="product-cell"><span style={{background:item.color}} /><div><strong>{item.name}</strong><small>{item.sku || 'No SKU'}</small></div></div></td><td>{item.length} × {item.width} × {item.height} cm</td><td>{item.weight} kg</td><td><input className="qty-input" type="number" min="1" max="60" value={item.quantity} onChange={e => { const quantity = Number(e.target.value); setItems(items.map(x => x.id===item.id ? {...x, quantity:Number.isFinite(quantity) ? Math.max(1, Math.min(60, quantity)) : 1} : x)); setResult(null) }}/></td><td><div className="tag-row">{item.fragile && <span className="tag warn">Fragile</span>}{item.stackable && <span className="tag">Stackable</span>}{item.allow_rotation && <span className="tag">Rotate</span>}</div></td><td><button type="button" className="icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => { setItems(items.filter(x => x.id!==item.id)); setResult(null) }}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
          </section>
        </div>

        <aside className="optimizer-right">
          <section className="panel visualization-panel"><div className="panel-head"><div><span className="section-index">03</span><h3>3D load plan</h3></div>{result && <button className="text-button" onClick={runOptimization}><RefreshCw size={15}/> Re-run</button>}</div><LoadScene vehicle={vehicle} result={result}/>{!result && <div className="scene-empty"><span><Boxes /></span><strong>Your optimized layout will appear here</strong><p>{demoMode ? 'Load the secure sample plan to explore the 3D viewer.' : 'Click “Optimize load” to generate the 3D plan.'}</p></div>}</section>
          <section className="panel results-panel"><div className="panel-head"><div><h3>Plan performance</h3><p>{result ? `${result.algorithm} · ${result.runtime_ms} ms` : 'Waiting for optimization'}</p></div></div>
            <div className="result-metrics">
              <div className="result-primary"><div className="ring" style={{'--progress': `${result?.volume_utilization || 0}%`} as React.CSSProperties}><div><strong>{Math.round(result?.volume_utilization || 0)}%</strong><span>Space used</span></div></div></div>
              <div className="result-secondary"><div><span><Weight size={16}/> Payload</span><strong>{Math.round(result?.payload_utilization || 0)}%</strong><i><b style={{width:`${result?.payload_utilization || 0}%`}}/></i></div><div><span><Scale size={16}/> Load balance</span><strong>{Math.round(result?.balance_score || 0)}%</strong><i><b style={{width:`${result?.balance_score || 0}%`}}/></i></div><div><span><Gauge size={16}/> Items placed</span><strong>{result ? `${result.placed_count}/${result.total_count}` : '—'}</strong></div></div>
            </div>
            {result ? <><div className="recommendations"><strong>Optimizer recommendations</strong>{result.recommendations.map(r => <p key={r}><Check size={15}/>{r}</p>)}</div>{result.unplaced.length>0 && <div className="unplaced"><AlertCircle size={17}/><div><strong>{result.unplaced.length} item(s) could not be placed</strong><span>Review payload and item constraints.</span></div></div>}<div className="loading-sequence"><strong>Loading sequence</strong><div>{result.placements.slice().sort((a,b) => a.loading_order-b.loading_order).slice(0,6).map((placement) => <span key={placement.unit_id}><i>{placement.loading_order}</i>{placement.name}</span>)}</div></div><button className="button full-width" onClick={savePlan} disabled={saving}>{saving ? <><LoaderCircle className="spin" size={17}/> Saving…</> : <><Save size={17}/> Save load plan <ArrowRight size={17}/></>}</button></> : <div className="results-placeholder"><Sparkles/><p>Run the optimizer to see utilization, weight distribution, loading order, and actionable recommendations.</p></div>}
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
