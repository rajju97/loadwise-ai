import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { LandingPage } from './pages/LandingPage'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { OptimizerPage } from './pages/OptimizerPage'
import { PlansPage, ProductsPage, SettingsPage, VehiclesPage } from './pages/DataPages'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, demoMode, loading } = useAuth()
  if (loading) return <div className="global-loader"><span/><p>Loading workspace…</p></div>
  return user || demoMode ? children : <Navigate to="/login" replace />
}

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/app" element={<Protected><DashboardPage /></Protected>} />
    <Route path="/app/optimizer" element={<Protected><OptimizerPage /></Protected>} />
    <Route path="/app/vehicles" element={<Protected><VehiclesPage /></Protected>} />
    <Route path="/app/products" element={<Protected><ProductsPage /></Protected>} />
    <Route path="/app/plans" element={<Protected><PlansPage /></Protected>} />
    <Route path="/app/settings" element={<Protected><SettingsPage /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
