import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Boxes, ChevronDown, LayoutDashboard, LogOut, Menu, PackageOpen, Route, Settings, Truck, X } from 'lucide-react'
import { Logo } from './Logo'
import { useAuth } from '../context/AuthContext'

const nav = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/optimizer', label: 'Load optimizer', icon: Boxes },
  { to: '/app/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/app/products', label: 'Products', icon: PackageOpen },
  { to: '/app/plans', label: 'Saved plans', icon: Route },
]

export function AppShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, demoMode, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Demo operator'

  const doSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(false)}><X size={19} /></button>
        </div>
        <nav className="sidebar-nav">
          <span className="nav-section-label">Workspace</span>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={19} /> <span>{label}</span>
            </NavLink>
          ))}
          <span className="nav-section-label nav-gap">Account</span>
          <NavLink to="/app/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <Settings size={19} /> <span>Settings</span>
          </NavLink>
        </nav>
        <div className="sidebar-profile">
          <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
          <div className="profile-copy">
            <strong>{displayName}</strong>
            <span>{demoMode ? 'Demo workspace' : 'Administrator'}</span>
          </div>
          <button className="icon-button" onClick={doSignOut} title="Sign out"><LogOut size={18} /></button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="app-main">
        <header className="app-topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
          <div className="page-heading">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-actions">
            <div className="status-pill"><span className="status-dot" /> Optimizer online</div>
            <button className="workspace-switcher">Main workspace <ChevronDown size={15} /></button>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}
