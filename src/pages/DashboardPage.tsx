import { ArrowRight, Boxes, Clock3, Gauge, PackageCheck, Sparkles, Truck, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { MetricCard } from '../components/MetricCard'

export function DashboardPage() {
  return (
    <AppShell title="Overview" subtitle="Your logistics optimization workspace at a glance.">
      <div className="welcome-panel panel">
        <div><span className="welcome-kicker"><Sparkles size={15} /> Smart planning starts here</span><h2>Ready to improve your next load?</h2><p>Select a vehicle, add your cargo, and generate an optimized 3D loading plan.</p><Link to="/app/optimizer" className="button">Create load plan <ArrowRight size={17} /></Link></div>
        <div className="welcome-art"><Truck size={104} /><span className="art-box a" /><span className="art-box b" /><span className="art-box c" /></div>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Average utilization" value="86.4%" detail="+8.2% vs manual planning" icon={<Gauge />} />
        <MetricCard label="Plans this month" value="24" detail="6 created this week" icon={<Boxes />} />
        <MetricCard label="Vehicle capacity saved" value="3.2×" detail="Equivalent vehicle trips" icon={<TrendingUp />} />
        <MetricCard label="Cargo planned" value="18.7 t" detail="Across all saved plans" icon={<PackageCheck />} />
      </div>
      <div className="dashboard-grid">
        <section className="panel recent-panel"><div className="panel-head"><div><h3>Recent load plans</h3><p>Latest optimization activity</p></div><Link to="/app/plans">View all <ArrowRight size={15} /></Link></div>
          <div className="plan-list">
            {[['NW-204','17 ft Box Truck','87%','2 min ago'],['RT-119','Cargo Van','81%','Yesterday'],['DL-885','20 ft Container','92%','Jul 17']].map(([id,vehicle,util,time],i)=><div className="plan-row" key={id}><span className={`plan-icon tone-${i+1}`}><Boxes /></span><div className="plan-main"><strong>{id}</strong><span>{vehicle}</span></div><div className="util-bar"><span><i style={{width:util}} /></span><b>{util}</b></div><small><Clock3 size={14} /> {time}</small><button className="icon-button"><ArrowRight size={16} /></button></div>)}
          </div>
        </section>
        <section className="panel insight-panel"><div className="panel-head"><div><h3>Utilization insight</h3><p>Last 30 days</p></div></div><div className="insight-chart">{[54,67,62,74,70,82,77,86,80,91,87,94].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div><div className="chart-caption"><span>Jun 20</span><span>Jul 20</span></div><div className="insight-summary"><span><b>+12.6%</b> improvement</span><small>compared with previous 30 days</small></div></section>
      </div>
    </AppShell>
  )
}
