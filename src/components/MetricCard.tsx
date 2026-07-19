import type { ReactNode } from 'react'

export function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <div className="metric-card panel">
      <div className="metric-icon">{icon}</div>
      <div>
        <span className="metric-label">{label}</span>
        <strong className="metric-value">{value}</strong>
        <p>{detail}</p>
      </div>
    </div>
  )
}
