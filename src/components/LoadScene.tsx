import { Canvas } from '@react-three/fiber'
import { Edges, Grid, Html, OrbitControls } from '@react-three/drei'
import { Suspense, useState } from 'react'
import type { OptimizationResult, Vehicle } from '../types'

function CargoBox({ placement, scale }: { placement: OptimizationResult['placements'][number]; scale: number }) {
  const [hovered, setHovered] = useState(false)
  const [x, y, z] = placement.position
  const [l, w, h] = placement.dimensions
  return (
    <mesh
      position={[(x + l / 2) * scale, (z + h / 2) * scale, (y + w / 2) * scale]}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
      castShadow receiveShadow
    >
      <boxGeometry args={[l * scale * 0.98, h * scale * 0.98, w * scale * 0.98]} />
      <meshStandardMaterial color={placement.color || '#ff8a1f'} transparent opacity={hovered ? 1 : 0.86} roughness={0.55} />
      <Edges color={hovered ? '#ffffff' : '#4b2a16'} threshold={15} />
      {hovered && (
        <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <div className="scene-tooltip">
            <strong>#{placement.loading_order} {placement.name}</strong>
            <span>{placement.dimensions.join(' × ')} cm · {placement.weight} kg</span>
          </div>
        </Html>
      )}
    </mesh>
  )
}

function VehicleFrame({ vehicle, scale }: { vehicle: Vehicle; scale: number }) {
  return (
    <mesh position={[vehicle.length * scale / 2, vehicle.height * scale / 2, vehicle.width * scale / 2]}>
      <boxGeometry args={[vehicle.length * scale, vehicle.height * scale, vehicle.width * scale]} />
      <meshBasicMaterial transparent opacity={0.025} color="#ffb06d" />
      <Edges color="#737e86" />
    </mesh>
  )
}

export function LoadScene({ vehicle, result }: { vehicle: Vehicle; result: OptimizationResult | null }) {
  const longest = Math.max(vehicle.length, vehicle.width, vehicle.height)
  const scale = 6 / longest
  return (
    <div className="scene-wrap">
      <Canvas camera={{ position: [7.8, 5.8, 8.6], fov: 42 }} shadows dpr={[1, 1.6]}>
        <color attach="background" args={['#15191d']} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[8, 11, 5]} intensity={2.6} castShadow />
        <Suspense fallback={null}>
          <group position={[-vehicle.length * scale / 2, 0, -vehicle.width * scale / 2]}>
            <VehicleFrame vehicle={vehicle} scale={scale} />
            {result?.placements.map((p) => <CargoBox key={p.unit_id} placement={p} scale={scale} />)}
          </group>
          <Grid position={[0, -0.02, 0]} args={[16, 16]} cellSize={0.5} cellThickness={0.5} sectionSize={2} sectionThickness={1} fadeDistance={18} fadeStrength={1} />
          <OrbitControls makeDefault minDistance={4} maxDistance={17} maxPolarAngle={Math.PI / 2.05} />
        </Suspense>
      </Canvas>
      <div className="scene-badge">Drag to orbit · Scroll to zoom</div>
    </div>
  )
}
