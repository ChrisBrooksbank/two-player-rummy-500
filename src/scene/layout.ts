import type { Card, Game } from '../game'

export const CARD_W = 1
export const CARD_H = 1.4
export const CARD_T = 0.012

export const TABLE_SCALE = 0.85
export const HAND_SCALE = 1.05
export const OPP_SCALE = 0.66

export const STOCK_POS: [number, number, number] = [-6.2, 0, -2.0]
const DISCARD_X = -3.7
const DISCARD_Z = -2.0
export const DISCARD_SLOT = { cx: 1.0, z: DISCARD_Z, w: 10.1 }
const OPP_HAND_Z = -4.5
const HAND_Z = 4.2
const HAND_TILT = 0.78
const HAND_Y = 0.85

export type Glow = 'none' | 'select' | 'must' | 'take'

export type CardTarget = {
  pos: [number, number, number]
  tilt: number
  yaw: number
  spin: number
  scale: number
  faceUp: boolean
  glow: Glow
  order: number
  onClick?: () => void
  onDouble?: () => void
}

export type MeldMat = { id: string; x: number; z: number; w: number; owner: number }

export type Actions = {
  drawStock: () => void
  takeDiscard: (index: number) => void
  toggleCard: (cardId: string) => void
  discardCard: (cardId: string) => void
}

export type LayoutInput = {
  game: Game
  viewer: number
  hoverId: string | null
  canDraw: boolean
  canPlay: boolean
  revealAll: boolean
  actions: Actions
}

export type LayoutResult = {
  cards: { card: Card; target: CardTarget }[]
  mats: MeldMat[]
}

/** Small stable pseudo-random value in [-1, 1] so piles look hand-stacked. */
function jitter(id: string, salt: number): number {
  let h = salt * 2654435761
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (((h >>> 0) % 2000) / 1000) - 1
}

const lift = (tilt: number, amount: number): [number, number] => [Math.sin(tilt) * amount, -Math.cos(tilt) * amount]

export function layoutCards({ game, viewer, hoverId, canDraw, canPlay, revealAll, actions }: LayoutInput): LayoutResult {
  const cards: LayoutResult['cards'] = []
  const mats: MeldMat[] = []
  const step = CARD_T * 0.9

  // Stock: a slightly untidy face-down pile; the next card to draw is on top.
  game.stock.forEach((card, i) => {
    const top = i === 0
    cards.push({
      card,
      target: {
        pos: [STOCK_POS[0] + jitter(card.id, 1) * 0.03, 0.02 + (game.stock.length - 1 - i) * step + (top && hoverId === card.id && canDraw ? 0.25 : 0), STOCK_POS[2] + jitter(card.id, 2) * 0.03],
        tilt: 0,
        yaw: 0,
        spin: jitter(card.id, 3) * 0.04,
        scale: TABLE_SCALE,
        faceUp: false,
        glow: top && hoverId === card.id && canDraw ? 'take' : 'none',
        order: 0,
        onClick: top && canDraw ? actions.drawStock : undefined,
      },
    })
  })

  // Discard pile: spread so every card is readable and reachable.
  const hoveredDiscard = game.discard.findIndex((card) => card.id === hoverId)
  const count = game.discard.length
  const spacing = Math.min(0.64, 9.2 / Math.max(count - 1, 1))
  game.discard.forEach((card, i) => {
    const takeable = canDraw && hoveredDiscard >= 0 && i >= hoveredDiscard
    cards.push({
      card,
      target: {
        pos: [DISCARD_X + i * spacing, 0.02 + i * step + (takeable ? 0.22 : 0), DISCARD_Z + (takeable ? -0.08 : 0)],
        tilt: 0,
        yaw: 0,
        spin: 0,
        scale: TABLE_SCALE,
        faceUp: true,
        glow: takeable ? 'take' : 'none',
        order: 0,
        onClick: canDraw ? () => actions.takeDiscard(i) : undefined,
      },
    })
  })

  // Melds: each side's sets and runs sit nearest their owner.
  const cursors = [
    { x: -7.4, z: viewer === 0 ? 1.55 : -0.3, dir: viewer === 0 ? 1 : -1 },
    { x: -7.4, z: viewer === 1 ? 1.55 : -0.3, dir: viewer === 1 ? 1 : -1 },
  ]
  const maxX = 7.4
  const spread = 0.4
  for (const meld of game.melds) {
    const cursor = cursors[meld.owner]
    const width = TABLE_SCALE + (meld.cards.length - 1) * spread
    if (cursor.x + width > maxX) {
      cursor.x = -7.4
      cursor.z += cursor.dir * 1.15
    }
    mats.push({ id: meld.id, x: cursor.x + width / 2 - TABLE_SCALE / 2, z: cursor.z, w: width + 0.24, owner: meld.owner })
    meld.cards.forEach((card, i) => {
      cards.push({
        card,
        target: {
          pos: [cursor.x + i * spread, 0.03 + i * step, cursor.z],
          tilt: 0,
          yaw: 0,
          spin: 0,
          scale: TABLE_SCALE,
          faceUp: true,
          glow: 'none',
          order: 0,
        },
      })
    })
    cursor.x += width + 0.5
  }

  // Seated player's hand: a tilted fan held up toward the camera.
  const hand = game.players[viewer].hand
  const spacingHand = Math.min(0.86, 10.6 / Math.max(hand.length, 1))
  const mid = (hand.length - 1) / 2
  const [liftY, liftZ] = lift(HAND_TILT, 1)
  hand.forEach((card, i) => {
    const off = i - mid
    const selected = game.selected.includes(card.id)
    const hovered = hoverId === card.id
    const must = viewer === game.active && game.drawLock?.cardId === card.id
    const raise = selected ? 0.7 : hovered && canPlay ? 0.38 : 0
    cards.push({
      card,
      target: {
        pos: [
          off * spacingHand,
          HAND_Y + liftY * raise + i * 0.002,
          HAND_Z + off * off * 0.014 + liftZ * raise + i * 0.01,
        ],
        tilt: HAND_TILT,
        yaw: 0,
        spin: -off * 0.04,
        scale: HAND_SCALE,
        faceUp: true,
        glow: must ? 'must' : selected ? 'select' : 'none',
        order: i + 1,
        onClick: canPlay ? () => actions.toggleCard(card.id) : undefined,
        onDouble: canPlay ? () => actions.discardCard(card.id) : undefined,
      },
    })
  })

  // Opponent's hand across the far edge.
  const foe = game.players[(viewer + 1) % 2].hand
  const foeSpacing = Math.min(0.5, 6.4 / Math.max(foe.length, 1))
  const foeMid = (foe.length - 1) / 2
  foe.forEach((card, i) => {
    const off = i - foeMid
    cards.push({
      card,
      target: {
        pos: [off * foeSpacing, 0.5 + i * 0.002, OPP_HAND_Z - off * off * 0.01],
        tilt: revealAll ? 0.7 : 0.45,
        yaw: 0,
        spin: off * 0.03,
        scale: OPP_SCALE,
        faceUp: revealAll,
        glow: 'none',
        order: foe.length + i + 1,
      },
    })
  })

  return { cards, mats }
}
