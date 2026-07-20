import type { LoadItem, OptimizationResult, Vehicle } from '../types'
import { supabase } from './supabase'

function formatApiDetail(detail: unknown): string {
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return ''
        const record = entry as { msg?: unknown; loc?: unknown }
        const location = Array.isArray(record.loc) ? record.loc.slice(1).join('.') : ''
        const message = typeof record.msg === 'string' ? record.msg : ''
        return location && message ? `${location}: ${message}` : message
      })
      .filter(Boolean)
    if (messages.length) return messages.join('; ')
  }
  return 'Optimization failed'
}

export async function optimizeLoad(vehicle: Vehicle, items: LoadItem[], objective = 'balanced_utilization'): Promise<OptimizationResult> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('Your session has expired. Sign in again to optimize this load.')

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 16_000)

  try {
    const response = await fetch('/api/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ vehicle, items, objective }),
      signal: controller.signal,
    })

    const responseText = await response.text()
    let responseBody: unknown = null
    if (responseText) {
      try { responseBody = JSON.parse(responseText) } catch { responseBody = responseText }
    }

    if (!response.ok) {
      if (typeof responseBody === 'string' && responseBody.trim()) throw new Error(responseBody)
      const detail = responseBody && typeof responseBody === 'object'
        ? (responseBody as { detail?: unknown }).detail
        : null
      throw new Error(formatApiDetail(detail))
    }

    if (!responseBody || typeof responseBody !== 'object') {
      throw new Error('The optimizer returned an invalid response.')
    }
    return responseBody as OptimizationResult
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The optimizer took too long to respond. Reduce the cargo manifest and try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
