import { supabase } from './supabase'
import type { LoadItem, OptimizationResult, Vehicle } from '../types'

export type SavedPlan = {
  id: string
  name: string
  reference_code?: string
  created_at: string
  plan_data: {
    vehicle: Vehicle
    items: LoadItem[]
    result: OptimizationResult
  }
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function getCurrentOrganizationId(): Promise<string> {
  const client = requireClient()
  const { data, error } = await client
    .from('organization_members')
    .select('organization_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (error) throw error
  return data.organization_id
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const client = requireClient()
  const { data, error } = await client.from('vehicles').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.vehicle_type || 'Custom vehicle',
    length: Number(row.length_cm),
    width: Number(row.width_cm),
    height: Number(row.height_cm),
    max_payload: Number(row.max_payload_kg),
  }))
}

export async function createVehicle(vehicle: Vehicle): Promise<Vehicle> {
  const client = requireClient()
  const [organizationId, auth] = await Promise.all([getCurrentOrganizationId(), client.auth.getUser()])
  if (!auth.data.user) throw new Error('You must be signed in')
  const { data, error } = await client.from('vehicles').insert({
    organization_id: organizationId,
    name: vehicle.name,
    vehicle_type: vehicle.type,
    length_cm: vehicle.length,
    width_cm: vehicle.width,
    height_cm: vehicle.height,
    max_payload_kg: vehicle.max_payload,
    created_by: auth.data.user.id,
  }).select().single()
  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    type: data.vehicle_type || 'Custom vehicle',
    length: Number(data.length_cm),
    width: Number(data.width_cm),
    height: Number(data.height_cm),
    max_payload: Number(data.max_payload_kg),
  }
}

export async function fetchProducts(): Promise<LoadItem[]> {
  const client = requireClient()
  const { data, error } = await client.from('products').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku || '',
    quantity: 1,
    length: Number(row.length_cm),
    width: Number(row.width_cm),
    height: Number(row.height_cm),
    weight: Number(row.weight_kg),
    allow_rotation: row.allow_rotation,
    stackable: row.stackable,
    fragile: row.fragile,
    color: row.color || '#ff8a1f',
  }))
}

export async function createProduct(item: LoadItem): Promise<LoadItem> {
  const client = requireClient()
  const [organizationId, auth] = await Promise.all([getCurrentOrganizationId(), client.auth.getUser()])
  if (!auth.data.user) throw new Error('You must be signed in')
  const { data, error } = await client.from('products').insert({
    organization_id: organizationId,
    name: item.name,
    sku: item.sku || null,
    length_cm: item.length,
    width_cm: item.width,
    height_cm: item.height,
    weight_kg: item.weight,
    allow_rotation: item.allow_rotation,
    stackable: item.stackable,
    fragile: item.fragile,
    color: item.color,
    created_by: auth.data.user.id,
  }).select().single()
  if (error) throw error
  return { ...item, id: data.id }
}

export async function saveLoadPlan(vehicle: Vehicle, items: LoadItem[], result: OptimizationResult, objective = 'balanced_utilization', name?: string): Promise<SavedPlan> {
  const client = requireClient()
  const [organizationId, auth] = await Promise.all([getCurrentOrganizationId(), client.auth.getUser()])
  if (!auth.data.user) throw new Error('You must be signed in')
  const referenceCode = `LW-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`
  const inputData = { vehicle, items, objective }
  const { data: job, error: jobError } = await client.from('optimization_jobs').insert({
    organization_id: organizationId,
    vehicle_id: vehicle.id || null,
    status: 'completed',
    objective,
    input_data: inputData,
    result_data: result,
    runtime_ms: result.runtime_ms,
    created_by: auth.data.user.id,
  }).select('id').single()
  if (jobError) throw jobError

  const planData = { vehicle, items, objective, result }
  const { data, error } = await client.from('load_plans').insert({
    organization_id: organizationId,
    optimization_job_id: job.id,
    name: name || `${vehicle.name} load plan`,
    reference_code: referenceCode,
    plan_data: planData,
    created_by: auth.data.user.id,
  }).select('*').single()
  if (error) throw error
  return data as SavedPlan
}

export async function fetchPlans(): Promise<SavedPlan[]> {
  const client = requireClient()
  const { data, error } = await client.from('load_plans').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SavedPlan[]
}
