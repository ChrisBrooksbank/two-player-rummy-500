import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  Euler,
  ExtrudeGeometry,
  MathUtils,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three'
import type { Group, MeshBasicMaterial } from 'three'
import type { Card } from '../game'
import { backFaceTexture, faceTexture, haloTexture } from './cardArt'
import { CARD_H, CARD_T, CARD_W, STOCK_POS, TABLE_SCALE } from './layout'
import type { CardTarget, Glow } from './layout'

function roundedCardShape(): Shape {
  const r = 0.075
  const x = -CARD_W / 2
  const y = -CARD_H / 2
  const shape = new Shape()
  shape.moveTo(x + r, y)
  shape.lineTo(x + CARD_W - r, y)
  shape.quadraticCurveTo(x + CARD_W, y, x + CARD_W, y + r)
  shape.lineTo(x + CARD_W, y + CARD_H - r)
  shape.quadraticCurveTo(x + CARD_W, y + CARD_H, x + CARD_W - r, y + CARD_H)
  shape.lineTo(x + r, y + CARD_H)
  shape.quadraticCurveTo(x, y + CARD_H, x, y + CARD_H - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

const shape = roundedCardShape()
const bodyGeometry = new ExtrudeGeometry(shape, { depth: CARD_T, bevelEnabled: false, curveSegments: 6 })
bodyGeometry.translate(0, 0, -CARD_T / 2)

const faceGeometry = new ShapeGeometry(shape, 6)
{
  const pos = faceGeometry.attributes.position
  const uv = faceGeometry.attributes.uv
  for (let i = 0; i < pos.count; i += 1) {
    uv.setXY(i, pos.getX(i) / CARD_W + 0.5, pos.getY(i) / CARD_H + 0.5)
  }
}

const bodyMaterial = new MeshStandardMaterial({ color: '#eee6d2', roughness: 0.7 })
let backMaterial: MeshStandardMaterial | null = null
const frontMaterials = new Map<string, MeshStandardMaterial>()

function frontMaterial(card: Pick<Card, 'rank' | 'suit'>): MeshStandardMaterial {
  const key = `${card.rank}-${card.suit}`
  let material = frontMaterials.get(key)
  if (!material) {
    material = new MeshStandardMaterial({ map: faceTexture(card), roughness: 0.48, metalness: 0 })
    frontMaterials.set(key, material)
  }
  return material
}

function getBackMaterial(): MeshStandardMaterial {
  backMaterial ??= new MeshStandardMaterial({ map: backFaceTexture(), roughness: 0.4, metalness: 0.05 })
  return backMaterial
}

const glowColors: Record<Exclude<Glow, 'none'>, string> = {
  select: '#ffd166',
  must: '#ff6b3d',
  take: '#6ee7b7',
}

const tmpEuler = new Euler()
const tmpQuat = new Quaternion()
const tmpTarget = new Vector3()
const tmpColor = new Color()

type Props = {
  card: Card
  target: CardTarget
  onHover: (id: string | null) => void
}

function CardMeshBase({ card, target, onHover }: Props) {
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const state = useRef({
    started: -1,
    pos: new Vector3(STOCK_POS[0], 0.6, STOCK_POS[2]),
    quat: new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0, 'YXZ')),
    scale: TABLE_SCALE,
    flip: Math.PI,
    glow: 0,
    lastTarget: new Vector3(NaN, NaN, NaN),
    startDist: 0,
  })
  const latest = useRef(target)
  useLayoutEffect(() => {
    latest.current = target
  })

  const front = useMemo(() => frontMaterial(card), [card])
  const back = getBackMaterial()
  const halos = haloTexture()

  useFrame(({ clock }, dtRaw) => {
    const group = outer.current
    const flipGroup = inner.current
    if (!group || !flipGroup) return
    const s = state.current
    const t = latest.current
    if (s.started < 0) s.started = clock.elapsedTime
    const dt = Math.min(dtRaw, 0.05)
    const waiting = clock.elapsedTime - s.started < t.order * 0.07

    const follow = 1 - Math.exp(-10 * dt)
    tmpTarget.set(t.pos[0], t.pos[1], t.pos[2])
    if (!waiting) {
      // Detect a new destination and remember how far this flight is, to shape the arc.
      if (tmpTarget.distanceToSquared(s.lastTarget) > 0.0025) {
        s.lastTarget.copy(tmpTarget)
        s.startDist = s.pos.distanceTo(tmpTarget)
      }
      s.pos.lerp(tmpTarget, follow)
      tmpQuat.setFromEuler(tmpEuler.set(t.tilt - Math.PI / 2, t.yaw, t.spin, 'YXZ'))
      s.quat.slerp(tmpQuat, follow)
      s.scale += (t.scale - s.scale) * follow
      s.flip += ((t.faceUp ? 0 : Math.PI) - s.flip) * follow
    }

    const remaining = s.pos.distanceTo(tmpTarget)
    const progress = s.startDist > 0.001 ? MathUtils.clamp(1 - remaining / s.startDist, 0, 1) : 1
    const arc = 4 * progress * (1 - progress) * Math.min(s.startDist * 0.14, 1.5)
    const flipArc = Math.sin(s.flip) * 0.7

    group.position.set(s.pos.x, s.pos.y + arc + flipArc, s.pos.z)
    group.quaternion.copy(s.quat)
    group.scale.setScalar(s.scale)
    flipGroup.rotation.y = s.flip

    const wantGlow = t.glow === 'none' ? 0 : 1
    s.glow += (wantGlow - s.glow) * follow
    if (halo.current) {
      if (t.glow !== 'none') halo.current.color.copy(tmpColor.set(glowColors[t.glow]))
      const pulse = t.glow === 'must' ? 0.65 + 0.35 * Math.sin(clock.elapsedTime * 5) : 1
      halo.current.opacity = s.glow * 0.85 * pulse
      halo.current.visible = s.glow > 0.01
    }
  })

  const interactive = Boolean(target.onClick)

  function over(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    onHover(card.id)
    if (latest.current.onClick) document.body.style.cursor = 'pointer'
  }

  function out() {
    onHover(null)
    document.body.style.cursor = ''
  }

  return (
    <group
      ref={outer}
      onPointerOver={over}
      onPointerOut={out}
      onClick={(event) => {
        if (!latest.current.onClick) return
        event.stopPropagation()
        latest.current.onClick()
      }}
      onDoubleClick={(event) => {
        if (!latest.current.onDouble) return
        event.stopPropagation()
        latest.current.onDouble()
      }}
      userData={{ interactive }}
    >
      <mesh position={[0, 0, -CARD_T / 2 - 0.006]} raycast={() => null} renderOrder={2}>
        <planeGeometry args={[CARD_W * 1.8, CARD_H * 1.571]} />
        <meshBasicMaterial
          ref={halo}
          map={halos}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <group ref={inner}>
        <mesh geometry={bodyGeometry} material={bodyMaterial} castShadow receiveShadow />
        <mesh
          geometry={faceGeometry}
          material={front}
          position={[0, 0, CARD_T / 2 + 0.0008]}
          receiveShadow
        />
        <mesh
          geometry={faceGeometry}
          material={back}
          position={[0, 0, -CARD_T / 2 - 0.0008]}
          rotation={[0, Math.PI, 0]}
          receiveShadow
        />
      </group>
    </group>
  )
}

export const CardMesh = memo(CardMeshBase)
