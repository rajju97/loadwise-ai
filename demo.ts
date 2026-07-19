import type { LoadItem, Vehicle } from '../types'

export const demoVehicles: Vehicle[] = [
  { id: 'mini-truck', name: 'Mini Truck', type: 'Light commercial', length: 320, width: 165, height: 170, max_payload: 1500 },
  { id: 'cargo-van', name: 'Cargo Van', type: 'Urban delivery', length: 410, width: 180, height: 190, max_payload: 1800 },
  { id: 'box-truck', name: '17 ft Box Truck', type: 'Regional freight', length: 520, width: 220, height: 225, max_payload: 4500 },
  { id: 'container', name: '20 ft Container', type: 'Intermodal', length: 589, width: 235, height: 239, max_payload: 28200 },
]

export const demoItems: LoadItem[] = [
  { id: 'crate-a', name: 'Electronics crate', sku: 'EL-201', quantity: 4, length: 80, width: 60, height: 55, weight: 85, allow_rotation: true, stackable: true, fragile: true, color: '#ff8a1f' },
  { id: 'pallet-b', name: 'Retail pallet', sku: 'RT-440', quantity: 2, length: 120, width: 100, height: 110, weight: 420, allow_rotation: false, stackable: true, fragile: false, color: '#f4c542' },
  { id: 'carton-c', name: 'Apparel cartons', sku: 'AP-110', quantity: 10, length: 55, width: 40, height: 35, weight: 22, allow_rotation: true, stackable: true, fragile: false, color: '#6e8798' },
]
