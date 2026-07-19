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

export type Workspace = {
  id: string
  name: string
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

async function requireUserId(): Promise<string> {
  const client = requireClient()
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('You must be signed in')
  return data.user.id
}

export async function getCurrentOrganizationId(): Promise<string> {
  const client = requireClient()
  const userId = await requireUserId()
  const { data, error } = await client
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data?.organization_id) throw new Error('No workspace was found for this account. Sign out and register again, or contact support.')
  return data.organization_id
}

export async function fetchWorkspace(): Promise<Workspace> {
  const client = requireClient()
  const organizationId = await getCurrentOrganizationId()
  const { data, error } = await client.from('organizations').select('id, name').eq('id', organizationId).single()
  if (error) throw error
  return data as Workspace
}

export async function updateWorkspaceName(name: string): Promise<Workspace> {
  const client = requireClient()
  const organizationId = await getCurrentOrganizationId()
  const normalizedName = name.trim()
  if (!normalizedName) throw new Error('Workspace name is required')
  const { data, error } = await client.from('organizations').update({ name: normalizedName }).eq('id', organizationId).select('id, name').single()
  if (error) throw error
  return data as Workspace
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const client = requireClient()
  const organizationId = await getCurrentOrganizationId()
  const { data, error } = await client.from('vehicles').select('*').eq('organization_id', organizationId).order('created_at')
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
  const [organizationId, userId] = await Promise.all([getCurrentOrganizationId(), requireUserId()])
  const { data, error } = await client.from('vehicles').insert({
    organization_id: organizationId,
    name: vehicle.name.trim(),
    vehicle_type: vehicle.type.trim(),
    length_cm: vehicle.length,
    width_cm: vehicle.width,
    height_cm: vehicle.height,
    max_payload_kg: vehicle.max_payload,
    created_by: userId,
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
  const organizationId = await getCurrentOrganizationId()
  const { data, error } = await client.from('products').select('*').eq('organization_id', organizationId).order('created_at')
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
  const [organizationId, userId] = await Promise.all([getCurrentOrganizationId(), requireUserId()])
  const { data, error } = await client.from('products').insert({
    organization_id: organizationId,
    name: item.name.trim(),
    sku: item.sku?.trim() || null,
    length_cm: item.length,
    width_cm: item.width,
    height_cm: item.height,
    weight_kg: item.weight,
    allow_rotation: item.allow_rotation,
    stackable: item.stackable,
    fragile: item.fragile,
    color: item.color,
    created_by: userId,
  }).select().single()
  if (error) throw error
  return { ...item, id: data.id, name: data.name, sku: data.sku || '' }
}

export async function saveLoadPlan(vehicle: Vehicle, items: LoadItem[], result: OptimizationResult, objective = 'balanced_utilization', name?: string): Promise<SavedPlan> {
  const client = requireClient()
  const [organizationId, userId] = await Promise.all([getCurrentOrganizationId(), requireUserId()])
  const referenceCode = `LW-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`
  const inputData = { vehicle, items, objective }
  const vehicleId = vehicle.id && /^[0-9a-f-]{36}$/i.test(vehicle.id) ? vehicle.id : null
  const { data: job, error: jobError } = await client.from('optimization_jobs').insert({
    organization_id: organizationId,
    vehicle_id: vehicleId,
    status: 'completed',
    objective,
    input_data: inputData,
    result_data: result,
    runtime_ms: result.runtime_ms,
    created_by: userId,
  }).select('id').single()
  if (jobError) throw jobError

  const planData = { vehicle, items, objective, result }
  const { data, error } = await client.from('load_plans').insert({
    organization_id: organizationId,
    optimization_job_id: job.id,
    name: name?.trim() || `${vehicle.name} load plan`,
    reference_code: referenceCode,
    plan_data: planData,
    created_by: userId,
  }).select('*').single()
  if (error) throw error
  return data as SavedPlan
}

export async function fetchPlans(): Promise<SavedPlan[]> {
  const client = requireClient()
  const organizationId = await getCurrentOrganizationId()
  const { data, error } = await client.from('load_plans').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SavedPlan[]
}
