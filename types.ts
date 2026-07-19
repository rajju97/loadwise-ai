export type Vehicle = {
  id?: string
  name: string
  type: string
  length: number
  width: number
  height: number
  max_payload: number
}

export type LoadItem = {
  id: string
  name: string
  sku?: string
  quantity: number
  length: number
  width: number
  height: number
  weight: number
  allow_rotation: boolean
  stackable: boolean
  fragile: boolean
  color?: string
}

export type Placement = {
  unit_id: string
  source_item_id: string
  name: string
  position: [number, number, number]
  dimensions: [number, number, number]
  weight: number
  color?: string
  loading_order: number
}

export type OptimizationResult = {
  status: string
  algorithm: string
  score: number
  volume_utilization: number
  payload_utilization: number
  balance_score: number
  center_of_mass: [number, number, number]
  placed_count: number
  total_count: number
  placed_weight: number
  placed_volume: number
  placements: Placement[]
  unplaced: Array<{ unit_id: string; name: string; reason: string }>
  recommendations: string[]
  runtime_ms: number
}
