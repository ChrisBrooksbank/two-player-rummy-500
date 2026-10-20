import { useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { DoubleSide, ShapeGeometry, Shape } from 'three'
import type { Group } from 'three'
import type { Card, Game } from '../game'
import { CardMesh } from './CardMesh'
import { CARD_H, TABLE_SCALE, layoutCards, metricsFor } from './layout'
import { usePortrait } from './viewport'
import type { Actions } from './layout'

const matShape = (() => {
  const w = 1
  const h = 1
  const r = 0.09
  const s = new Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return new ShapeGeometry(s, 8)
})()

type Props = {
  game: Game
  viewer: number
  canDraw: boolean
  canPlay: boolean
  revealAll: boolean
  actions: Actions
}

export function MatchScene({ game, viewer, canDraw, canPlay, revealAll, actions }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const m = metricsFor(usePortrait())

  const layout = useMemo(
    () => layoutCards({ game, viewer, hoverId, canDraw, canPlay, revealAll, actions, m }),
    [game, viewer, hoverId, canDraw, canPlay, revealAll, actions, m],
  )

  return (
    <group>
      {layout.mats.map((mat) => (
        <mesh
          key={mat.id}
          geometry={matShape}
          position={[mat.x, 0.008, mat.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[mat.w, CARD_H * TABLE_SCALE + 0.24, 1]}
          raycast={() => null}
        >
          <meshBasicMaterial
            color={mat.owner === viewer ? '#f2c14e' : '#6ccbff'}
            transparent
            opacity={0.16}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
      {layout.cards.map(({ card, target }) => (
        <CardMesh key={card.id} card={card} target={target} spawn={m.stock} onHover={setHoverId} />
      ))}
    </group>
  )
}

const showcase: Card[] = [
  { id: 'show-10', rank: '10', suit: 'spades' },
  { id: 'show-J', rank: 'J', suit: 'spades' },
  { id: 'show-Q', rank: 'Q', suit: 'spades' },
  { id: 'show-K', rank: 'K', suit: 'spades' },
  { id: 'show-A', rank: 'A', suit: 'spades' },
]

/** A slowly turning fan of cards hovering over the felt behind the menu. */
export function Showcase() {
  const group = useRef<Group>(null)
  const noop = () => {}
  const portrait = usePortrait()
  const gap = portrait ? 0.85 : 1.25
  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.12
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.3) * 0.16
  })
  return (
    <group ref={group}>
      {showcase.map((card, i) => {
        const off = i - 2
        return (
          <CardMesh
            key={card.id}
            card={card}
            onHover={noop}
            target={{
              pos: [off * gap, 1.7 + Math.abs(off) * -0.06 + i * 0.004, (portrait ? -2.4 : 0.2) + off * off * 0.12 + i * 0.01],
              tilt: 0.5,
              yaw: 0,
              spin: -off * 0.15,
              scale: portrait ? 1.25 : 1.5,
              faceUp: true,
              glow: 'none',
              order: i + 1,
            }}
          />
        )
      })}
    </group>
  )
}
