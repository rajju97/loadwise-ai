import { ArrowRight, Boxes, Clock3, Gauge, LoaderCircle, PackageCheck, Sparkles, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../context/AuthContext'
import { fetchPlans, fetchProducts, fetchVehicles, type SavedPlan } from '../lib/data'
import { demoItems, demoVehicles } from '../lib/demo'
import type { LoadItem, Vehicle } from '../types'

function readStoredArray<T>(key: string, fallback: T[]): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return Array.isArray(value) ? value as T[] : fallback
  } catch {
    return fallback
  }
}

export function DashboardPage() {
  const { demoMode } = useAuth()
  const [plans, setPlans] = useState<SavedPlan[]>([])
  const [vehicleCount, setVehicleCount] = useState(0)
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        if (demoMode) {
          if (!active) return
          setPlans(readStoredArray<SavedPlan>('loadwise-demo-plans', []))
          setVehicleCount(readStoredArray<Vehicle>('loadwise-demo-vehicles', demoVehicles).length)
          setProductCount(readStoredArray<LoadItem>('loadwise-demo-products', demoItems).length)
          return
        }
        const [savedPlans, vehicles, products] = await Promise.all([fetchPlans(), fetchVehicles(), fetchProducts()])
        if (!active) return
        setPlans(savedPlans)
        setVehicleCount(vehicles.length)
        setProductCount(products.length)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load workspace metrics')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [demoMode])

  const metrics = useMemo(() => {
    const averageUtilization = plans.length
      ? plans.reduce((sum, plan) => sum + Number(plan.plan_data?.result?.volume_utilization || 0), 0) / plans.length
      : 0
    const cargoTonnes = plans.reduce((sum, plan) => sum + Number(plan.plan_data?.result?.placed_weight || 0), 0) / 1000
    return { averageUtilization, cargoTonnes }
  }, [plans])

  const chartValues = useMemo(() => {
    const values = plans.slice(0, 12).reverse().map(plan => Math.max(4, Math.min(100, Number(plan.plan_data?.result?.volume_utilization || 0))))
    return values.length ? values : [4]
  }, [plans])

  return (
    <AppShell title="Overview" subtitle="Your logistics optimization workspace at a glance.">
      <div className="welcome-panel panel">
        <div><span className="welcome-kicker"><Sparkles size={15} /> Smart planning starts here</span><h2>Ready to improve your next load?</h2><p>Select a vehicle, add your cargo, and generate an optimized 3D loading plan.</p><Link to="/app/optimizer" className="button">Create load plan <ArrowRight size={17} /></Link></div>
        <div className="welcome-art"><Truck size={104} /><span className="art-box a" /><span className="art-box b" /><span className="art-box c" /></div>
      </div>

      {error && <div className="form-error page-error">{error}</div>}
      {loading ? <div className="panel data-loader"><LoaderCircle className="spin" /> Loading workspace…</div> : <>
        <div className="metrics-grid">
          <MetricCard label="Average utilization" value={`${metrics.averageUtilization.toFixed(1)}%`} detail={plans.length ? `Across ${plans.length} saved plan${plans.length === 1 ? '' : 's'}` : 'Create a plan to start tracking'} icon={<Gauge />} />
          <MetricCard label="Saved plans" value={String(plans.length)} detail="Real plans in this workspace" icon={<Boxes />} />
          <MetricCard label="Fleet vehicles" value={String(vehicleCount)} detail="Available to the optimizer" icon={<Truck />} />
          <MetricCard label="Cargo planned" value={`${metrics.cargoTonnes.toFixed(1)} t`} detail={`${productCount} catalog product${productCount === 1 ? '' : 's'}`} icon={<PackageCheck />} />
        </div>
        <div className="dashboard-grid">
          <section className="panel recent-panel"><div className="panel-head"><div><h3>Recent load plans</h3><p>Latest optimization activity</p></div><Link to="/app/plans">View all <ArrowRight size={15} /></Link></div>
            {plans.length === 0 ? <div className="empty-data"><span><Boxes /></span><h2>No saved plans yet</h2><p>Run the optimizer and save your first real plan.</p><Link className="button button-sm" to="/app/optimizer">Create first plan</Link></div> : <div className="plan-list">
              {plans.slice(0, 5).map((plan, index) => {
                const utilization = Math.round(Number(plan.plan_data?.result?.volume_utilization || 0))
                return <div className="plan-row" key={plan.id}><span className={`plan-icon tone-${index % 3 + 1}`}><Boxes /></span><div className="plan-main"><strong>{plan.reference_code || plan.name}</strong><span>{plan.plan_data?.vehicle?.name || 'Saved vehicle'}</span></div><div className="util-bar"><span><i style={{ width: `${utilization}%` }} /></span><b>{utilization}%</b></div><small><Clock3 size={14} /> {new Date(plan.created_at).toLocaleString()}</small><Link className="icon-button" to={`/app/optimizer?plan=${encodeURIComponent(plan.id)}`} aria-label={`Open ${plan.name || 'saved plan'}`}><ArrowRight size={16} /></Link></div>
              })}
            </div>}
          </section>
          <section className="panel insight-panel"><div className="panel-head"><div><h3>Utilization history</h3><p>{plans.length ? `Last ${Math.min(12, plans.length)} plans` : 'No plan history yet'}</p></div></div><div className="insight-chart">{chartValues.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><div className="chart-caption"><span>Older</span><span>Latest</span></div><div className="insight-summary"><span><b>{metrics.averageUtilization.toFixed(1)}%</b> average utilization</span><small>calculated from saved optimization results</small></div></section>
        </div>
      </>}
    </AppShell>
  )
}
