import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  ExtrudeGeometry,
  MathUtils,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three'
import type { Points } from 'three'
import { SERIF } from './cardArt'
import { TABLE_SCALE, metricsFor } from './layout'
import type { Metrics } from './layout'
import { usePortrait } from './viewport'

export type View = 'menu' | 'match'

function roundedRectShape(w: number, h: number, r: number): Shape {
  const x = -w / 2
  const y = -h / 2
  const s = new Shape()
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function paintFelt(m: Metrics): { color: CanvasTexture; bump: CanvasTexture } {
  const { w: TABLE_W, h: TABLE_H, cz: TABLE_CZ } = m.table
  const cw = 2048
  const ch = Math.round((cw * TABLE_H) / TABLE_W)
  const px = (x: number) => ((x + TABLE_W / 2) / TABLE_W) * cw
  const pz = (z: number) => ((z - (TABLE_CZ - TABLE_H / 2)) / TABLE_H) * ch
  const unit = cw / TABLE_W

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!

  const base = ctx.createRadialGradient(cw / 2, ch * 0.5, 80, cw / 2, ch * 0.5, cw * 0.62)
  base.addColorStop(0, '#2b8059')
  base.addColorStop(0.55, '#1c6244')
  base.addColorStop(1, '#0e3a28')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, cw, ch)

  // Felt fibres.
  for (let i = 0; i < 90000; i += 1) {
    const light = Math.random() > 0.5
    ctx.fillStyle = light ? `rgba(160, 255, 200, ${Math.random() * 0.035})` : `rgba(0, 20, 10, ${Math.random() * 0.06})`
    ctx.fillRect(Math.random() * cw, Math.random() * ch, 1 + Math.random() * 2.5, 1)
  }

  // Inset gilt border.
  ctx.strokeStyle = 'rgba(232, 196, 110, 0.38)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.roundRect(46, 46, cw - 92, ch - 92, 46)
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(66, 66, cw - 132, ch - 132, 32)
  ctx.stroke()

  // Faint central emblem.
  ctx.save()
  ctx.fillStyle = 'rgba(232, 196, 110, 0.06)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${unit * 4.2}px ${SERIF}`
  ctx.fillText('500', px(0), pz(0.55))
  ctx.restore()

  const slot = (x: number, z: number, w: number, h: number, label: string) => {
    ctx.save()
    ctx.strokeStyle = 'rgba(232, 196, 110, 0.4)'
    ctx.setLineDash([14, 10])
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(px(x - w / 2), pz(z - h / 2), w * unit, h * unit, 22)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(232, 196, 110, 0.5)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${unit * 0.2}px ${SERIF}`
    ctx.letterSpacing = `${unit * 0.05}px`
    ctx.fillText(label, px(x), pz(z + h / 2 + 0.28))
    ctx.restore()
  }
  const cardW = TABLE_SCALE + 0.3
  const cardH = TABLE_SCALE * 1.4 + 0.3
  slot(m.stock[0], m.stock[2], cardW, cardH, 'STOCK')
  slot(m.slot.cx, m.slot.z, m.slot.w, cardH, m.table.w < 14 ? 'DISCARD' : 'DISCARD  ·  REACH IN, BUT COMMIT')

  const color = new CanvasTexture(canvas)
  color.colorSpace = SRGBColorSpace
  color.anisotropy = 8

  // Woven bump.
  const bc = document.createElement('canvas')
  bc.width = 512
  bc.height = 512
  const b = bc.getContext('2d')!
  b.fillStyle = '#808080'
  b.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 40000; i += 1) {
    const v = 90 + Math.random() * 90
    b.fillStyle = `rgb(${v},${v},${v})`
    b.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
  }
  const bump = new CanvasTexture(bc)
  bump.wrapS = bump.wrapT = RepeatWrapping
  bump.repeat.set(10, 7)
  return { color, bump }
}

function Table() {
  const m = metricsFor(usePortrait())
  const { w: TABLE_W, h: TABLE_H, cz: TABLE_CZ } = m.table
  const { feltGeometry, bodyGeometry, textures } = useMemo(() => {
    const textures = paintFelt(m)
    const feltShape = roundedRectShape(TABLE_W, TABLE_H, 1.2)
    const feltGeometry = new ShapeGeometry(feltShape, 12)
    const pos = feltGeometry.attributes.position
    const uv = feltGeometry.attributes.uv
    for (let i = 0; i < pos.count; i += 1) {
      uv.setXY(i, pos.getX(i) / TABLE_W + 0.5, pos.getY(i) / TABLE_H + 0.5)
    }
    const bodyGeometry = new ExtrudeGeometry(roundedRectShape(TABLE_W + 1.3, TABLE_H + 1.3, 1.8), {
      depth: 0.6,
      bevelEnabled: true,
      bevelSize: 0.22,
      bevelThickness: 0.22,
      bevelSegments: 6,
      curveSegments: 16,
    })
    return { feltGeometry, bodyGeometry, textures }
  }, [m, TABLE_W, TABLE_H])

  return (
    <group position={[0, 0, TABLE_CZ]}>
      <mesh geometry={bodyGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]} receiveShadow>
        <meshStandardMaterial color="#4a2a18" roughness={0.38} metalness={0.15} />
      </mesh>
      <mesh geometry={feltGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial map={textures.color} bumpMap={textures.bump} bumpScale={1.6} roughness={1} />
      </mesh>
    </group>
  )
}

function makeDust() {
  const count = 90
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 22
    positions[i * 3 + 1] = Math.random() * 9
    positions[i * 3 + 2] = (Math.random() - 0.5) * 14
    speeds[i] = 0.05 + Math.random() * 0.12
  }
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,240,200,1)')
  grad.addColorStop(1, 'rgba(255,240,200,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return { positions, speeds, sprite: new CanvasTexture(c) }
}

function Dust() {
  const ref = useRef<Points>(null)
  const [{ positions, speeds, sprite }] = useState(makeDust)

  useFrame((_, dt) => {
    const attr = ref.current?.geometry.attributes.position as BufferAttribute | undefined
    if (!attr) return
    for (let i = 0; i < speeds.length; i += 1) {
      let y = attr.getY(i) + speeds[i] * dt
      if (y > 9) y = 0.3
      attr.setY(i, y)
      attr.setX(i, attr.getX(i) + Math.sin(y * 1.3 + i) * dt * 0.05)
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={0.12}
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

const lookAt = new Vector3()
const camGoal = new Vector3()

function CameraRig({ view }: { view: View }) {
  const { camera, size, pointer } = useThree()
  const rig = useRef({ dist: 18, elev: 0.95, ty: 0, tz: 0.6, started: false })

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const aspect = size.width / size.height
    const vfov = MathUtils.degToRad(34)
    const s = rig.current
    let wantDist: number
    let wantElev: number
    let wantTy: number
    let wantTz: number
    const portrait = aspect < 0.95
    if (view === 'match') {
      // Fit the table width, but never sit closer than the depth of the layout needs.
      wantDist = Math.max((portrait ? 5.0 : 8.9) / (Math.tan(vfov / 2) * aspect), portrait ? 14 : 19.5)
      wantElev = portrait ? 1.08 : 0.93
      wantTy = 0
      wantTz = portrait ? -0.7 : 1.2
    } else {
      wantDist = Math.max((portrait ? 3.8 : 7.5) / (Math.tan(vfov / 2) * aspect), portrait ? 9 : 11)
      wantElev = 0.52
      wantTy = 0.9
      wantTz = 0
    }
    if (!s.started) {
      s.dist = wantDist + 6
      s.elev = wantElev + 0.25
      s.started = true
    }
    const k = 1 - Math.exp(-2.4 * dt)
    s.dist += (wantDist - s.dist) * k
    s.elev += (wantElev - s.elev) * k
    s.ty += (wantTy - s.ty) * k
    s.tz += (wantTz - s.tz) * k

    const sway = view === 'menu' ? Math.sin(clock.elapsedTime * 0.25) * 0.9 : pointer.x * 0.5
    camGoal.set(sway, s.ty + Math.sin(s.elev) * s.dist + (view === 'menu' ? 0 : pointer.y * 0.25), s.tz + Math.cos(s.elev) * s.dist)
    camera.position.lerp(camGoal, 1 - Math.exp(-6 * dt))
    camera.lookAt(lookAt.set(0, s.ty, s.tz))
  })
  return null
}

export function Stage({ view, children }: { view: View; children: ReactNode }) {
  useEffect(() => () => {
    document.body.style.cursor = ''
  }, [])

  return (
    <Canvas
      className="stage"
      shadows
      dpr={[1, 2]}
      camera={{ fov: 34, near: 0.5, far: 80, position: [0, 18, 20] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#06100c']} />
      <fog attach="fog" args={['#06100c', 28, 60]} />
      <hemisphereLight args={['#fff4de', '#10261b', 0.45]} />
      <spotLight
        position={[1, 17, 5]}
        angle={0.78}
        penumbra={1}
        intensity={1500}
        decay={2}
        color="#ffe9c4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={6}
        shadow-camera-far={32}
      />
      <directionalLight position={[-6, 6, -12]} intensity={0.7} color="#8fb8ff" />
      <CameraRig view={view} />
      <Table />
      <Dust />
      {children}
    </Canvas>
  )
}
