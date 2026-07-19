import type { LoadItem, OptimizationResult, Vehicle } from '../types'
import { supabase } from './supabase'

export async function optimizeLoad(vehicle: Vehicle, items: LoadItem[], objective = 'balanced_utilization'): Promise<OptimizationResult> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null
  const response = await fetch('/api/optimize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ vehicle, items, objective }),
  })
  if (!response.ok) {
    let detail = 'Optimization failed'
    try {
      const body = await response.json()
      detail = body.detail || detail
    } catch {
      detail = await response.text() || detail
    }
    throw new Error(detail)
  }
  return response.json()
}
