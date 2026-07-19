import { ArrowRight, BarChart3, Boxes, Check, Container, Gauge, HardHat, Layers3, Menu, PackageCheck, Play, Route, ShieldCheck, Truck, Warehouse, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

const features = [
  { icon: Boxes, title: 'Constraint-aware 3D packing', text: 'Plan around exact dimensions, rotations, payload, support area, fragility, and stacking rules.' },
  { icon: BarChart3, title: 'Capacity intelligence', text: 'Track volume, payload, balance, unplaced cargo, and the operational impact of every plan.' },
  { icon: ShieldCheck, title: 'Safer loading decisions', text: 'Keep heavy cargo supported and the center of mass closer to the vehicle’s safe target.' },
]

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 1200)
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{shown}{suffix}</>
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="landing-page industrial-landing">
      <nav className="landing-nav container">
        <Link to="/"><Logo /></Link>
        <div className={`landing-links ${menuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMenuOpen(false)}>Platform</a>
          <a href="#how" onClick={() => setMenuOpen(false)}>Workflow</a>
          <a href="#solutions" onClick={() => setMenuOpen(false)}>Industries</a>
          <Link className="nav-login" to="/login">Log in</Link>
          <Link className="button button-sm" to="/register">Start optimizing <ArrowRight size={16} /></Link>
        </div>
        <button className="icon-button landing-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
      </nav>

      <main>
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow"><HardHat size={15} /> Industrial-grade load planning</div>
            <h1>Load every vehicle<br /><span>like it matters.</span></h1>
            <p>LoadWise AI converts vehicle and cargo constraints into a balanced, explainable 3D loading plan—built for warehouses, fleets, and high-volume logistics teams.</p>
            <div className="hero-actions">
              <Link to="/register" className="button button-lg">Build your first load plan <ArrowRight size={18} /></Link>
              <a href="#how" className="button button-ghost button-lg"><Play size={17} fill="currentColor" /> Watch the workflow</a>
            </div>
            <div className="hero-trust">
              <span><Check size={15} /> No credit card</span>
              <span><Check size={15} /> Interactive 3D plan</span>
              <span><Check size={15} /> Supabase secured</span>
            </div>
            <div className="industrial-proof">
              <div><strong><CountUp value={18} suffix="%" /></strong><span>average capacity gain</span></div>
              <div><strong><CountUp value={96} suffix="%" /></strong><span>load balance score</span></div>
              <div><strong><CountUp value={42} suffix="s" /></strong><span>planning time</span></div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Animated cargo optimization preview">
            <div className="industrial-grid" />
            <div className="route-beam"><span /><span /><span /></div>
            <div className="mock-window">
              <div className="mock-top"><span /><span /><span /><div>CONTROL ROOM · LOAD PLAN LW-204</div></div>
              <div className="mock-body">
                <div className="mock-sidebar"><div className="mock-logo" />{[1,2,3,4,5].map(i => <div className={`mock-nav ${i===2 ? 'active' : ''}`} key={i} />)}</div>
                <div className="mock-content">
                  <div className="mock-heading"><div><b>17 ft Box Truck</b><span>HYBRID 3D OPTIMIZATION</span></div><button>PLAN READY</button></div>
                  <div className="mock-grid">
                    <div className="mock-scene">
                      <div className="truck-frame">
                        {[['a','wide'],['b','tall'],['c',''],['d','wide'],['e',''],['f','tall'],['g','']].map(([id,cls], index) => <i key={id} className={`${cls} cargo-${index + 1}`} />)}
                      </div>
                      <div className="mock-floor" />
                      <div className="scanner-line" />
                    </div>
                    <div className="mock-stats">
                      <div className="util-ring"><strong>87%</strong><span>SPACE USED</span></div>
                      <div className="stat-line"><span>Payload</span><b>74%</b></div>
                      <div className="stat-line"><span>Balance</span><b>96%</b></div>
                      <div className="mock-recommendation">✓ SAFE LOAD PROFILE</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="forklift-animation" aria-hidden="true"><span className="fork-body"><i /><i /></span><span className="fork-mast" /><span className="fork-pallet"><b /><b /></span></div>
            <div className="float-card float-one"><span className="float-icon"><Layers3 size={18} /></span><div><strong>+18.4%</strong><small>capacity recovered</small></div></div>
            <div className="float-card float-two"><span className="float-icon"><Truck size={18} /></span><div><strong>1 fewer vehicle</strong><small>needed for this load</small></div></div>
          </div>
        </section>

        <section className="logo-strip">
          <div className="container logo-strip-inner"><span>BUILT FOR</span><b><Warehouse size={17}/> Warehouses</b><b><Truck size={17}/> Fleet operators</b><b><Container size={17}/> 3PL teams</b><b><PackageCheck size={17}/> Manufacturers</b></div>
        </section>

        <section id="features" className="section container">
          <div className="section-heading centered"><div className="eyebrow">Operational intelligence</div><h2>From cargo manifest to confident loading plan</h2><p>Replace manual trial and error with a repeatable workflow your planners, loaders, and managers can understand.</p></div>
          <div className="feature-grid">{features.map(({icon:Icon,title,text}, index) => <article className="feature-card" key={title}><span className="feature-number">0{index + 1}</span><span className="feature-icon"><Icon /></span><h3>{title}</h3><p>{text}</p><a href="#how">Explore capability <ArrowRight size={15} /></a></article>)}</div>
        </section>

        <section className="industrial-band">
          <div className="container industrial-band-grid">
            <div><span><Gauge/></span><strong>87%</strong><p>space utilization in the sample plan</p></div>
            <div><span><Route/></span><strong>1 trip</strong><p>saved through better consolidation</p></div>
            <div><span><PackageCheck/></span><strong>16 / 16</strong><p>items placed with constraints respected</p></div>
            <div><span><ShieldCheck/></span><strong>96%</strong><p>center-of-mass balance score</p></div>
          </div>
        </section>

        <section id="how" className="section workflow-section">
          <div className="container workflow-grid">
            <div className="section-heading"><div className="eyebrow">Built for the loading floor</div><h2>A complete plan in three controlled steps</h2><p>No specialist CAD skills and no spreadsheet guessing. Enter the constraints your team already knows and generate a plan they can execute.</p><Link to="/register" className="button">Open the workspace <ArrowRight size={17} /></Link></div>
            <div className="steps">
              <div className="step"><span>01</span><div><h3>Select the vehicle</h3><p>Choose a saved truck, van, or container with exact internal dimensions and payload.</p></div></div>
              <div className="step"><span>02</span><div><h3>Build the cargo manifest</h3><p>Add quantities, dimensions, weights, rotation, fragility, and stacking constraints.</p></div></div>
              <div className="step"><span>03</span><div><h3>Optimize, inspect, and save</h3><p>Orbit the 3D layout, review the loading order, and save the plan for your team.</p></div></div>
            </div>
          </div>
        </section>

        <section id="solutions" className="section container">
          <div className="cta-panel"><div><div className="eyebrow light">The next load starts here</div><h2>Turn unused cargo space into operating margin.</h2><p>Register your workspace, add the real dimensions, and see what your fleet can carry.</p></div><Link to="/register" className="button button-light button-lg">Create your workspace <ArrowRight size={18} /></Link></div>
        </section>
      </main>
      <footer className="landing-footer container"><Logo /><span>© 2026 LoadWise AI. Industrial load intelligence.</span><div><a href="#features">Product</a><a href="#">Privacy</a><a href="#">Terms</a></div></footer>
    </div>
  )
}
