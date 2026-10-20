import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'
import type { Card, Rank, Suit } from '../game'
import { suitGlyphs } from '../game'

/** Pixel size of every card texture; the aspect matches CARD_W : CARD_H. */
const W = 400
const H = 560

export const SERIF = '"Fraunces", "Playfair Display", Georgia, "Times New Roman", serif'
const SYMBOLS = '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", "DejaVu Sans", sans-serif'

const INK: Record<Suit, string> = {
  hearts: '#c2272f',
  diamonds: '#c2272f',
  clubs: '#161a24',
  spades: '#161a24',
}

// Pip positions as fractions of the inner play area (x: 0..1, y: 0..1).
const L = 0.0
const C = 0.5
const R = 1.0
const pipLayouts: Record<Rank, [number, number][]> = {
  A: [[C, 0.5]],
  '2': [[C, 0], [C, 1]],
  '3': [[C, 0], [C, 0.5], [C, 1]],
  '4': [[L, 0], [R, 0], [L, 1], [R, 1]],
  '5': [[L, 0], [R, 0], [C, 0.5], [L, 1], [R, 1]],
  '6': [[L, 0], [R, 0], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  '7': [[L, 0], [R, 0], [C, 0.25], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  '8': [[L, 0], [R, 0], [C, 0.25], [L, 0.5], [R, 0.5], [C, 0.75], [L, 1], [R, 1]],
  '9': [[L, 0], [R, 0], [L, 1 / 3], [R, 1 / 3], [C, 0.5], [L, 2 / 3], [R, 2 / 3], [L, 1], [R, 1]],
  '10': [[L, 0], [R, 0], [C, 1 / 6], [L, 1 / 3], [R, 1 / 3], [L, 2 / 3], [R, 2 / 3], [C, 5 / 6], [L, 1], [R, 1]],
  J: [],
  Q: [],
  K: [],
}

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  return [canvas, canvas.getContext('2d')!]
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function toTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  return texture
}

function glyph(ctx: CanvasRenderingContext2D, suit: Suit, x: number, y: number, size: number, flip = false) {
  ctx.save()
  ctx.translate(x, y)
  if (flip) ctx.rotate(Math.PI)
  ctx.font = `${size}px ${SYMBOLS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK[suit]
  // Text-presentation selector keeps emoji fonts from colouring the suit.
  ctx.fillText(`${suitGlyphs[suit]}︎`, 0, size * 0.04)
  ctx.restore()
}

function paintFace(card: Pick<Card, 'rank' | 'suit'>): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas()
  const { rank, suit } = card
  const ink = INK[suit]

  // Paper: warm ivory with a soft vignette and a hairline of fibre noise.
  const paper = ctx.createRadialGradient(W * 0.4, H * 0.3, 40, W / 2, H / 2, H * 0.75)
  paper.addColorStop(0, '#fffdf6')
  paper.addColorStop(1, '#f1e8d3')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 1400; i += 1) {
    ctx.fillStyle = `rgba(120, 95, 50, ${Math.random() * 0.035})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1)
  }

  // Inner keyline.
  ctx.strokeStyle = `${ink}33`
  ctx.lineWidth = 2
  roundRect(ctx, 16, 16, W - 32, H - 32, 20)
  ctx.stroke()

  // Corner indices.
  const corner = (flip: boolean) => {
    ctx.save()
    if (flip) {
      ctx.translate(W, H)
      ctx.rotate(Math.PI)
    }
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${rank === '10' ? 66 : 76}px ${SERIF}`
    ctx.fillText(rank, 56, 76)
    ctx.restore()
    glyph(ctx, suit, flip ? W - 56 : 56, flip ? H - 132 : 132, 52, flip)
  }
  corner(false)
  corner(true)

  // Playing area.
  const ax = 118
  const ay = 108
  const aw = W - ax * 2
  const ah = H - ay * 2

  if (rank === 'J' || rank === 'Q' || rank === 'K') {
    const fx = 100
    const fy = 100
    const fw = W - fx * 2
    const fh = H - fy * 2
    // Court panel: tinted field with diagonal hatching and a gold frame.
    const field = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh)
    field.addColorStop(0, suit === 'hearts' || suit === 'diamonds' ? '#f7e3d8' : '#dfe3ea')
    field.addColorStop(1, suit === 'hearts' || suit === 'diamonds' ? '#efcfc4' : '#c9d0dc')
    ctx.fillStyle = field
    roundRect(ctx, fx, fy, fw, fh, 14)
    ctx.fill()
    ctx.save()
    roundRect(ctx, fx, fy, fw, fh, 14)
    ctx.clip()
    ctx.strokeStyle = `${ink}14`
    ctx.lineWidth = 2
    for (let d = -fh; d < fw + fh; d += 14) {
      ctx.beginPath()
      ctx.moveTo(fx + d, fy)
      ctx.lineTo(fx + d + fh, fy + fh)
      ctx.stroke()
    }
    ctx.restore()
    ctx.strokeStyle = '#b8903f'
    ctx.lineWidth = 5
    roundRect(ctx, fx, fy, fw, fh, 14)
    ctx.stroke()
    ctx.strokeStyle = '#e6c878'
    ctx.lineWidth = 1.5
    roundRect(ctx, fx + 9, fy + 9, fw - 18, fh - 18, 8)
    ctx.stroke()

    // Medallion with the court letter.
    const cx = W / 2
    const cy = H / 2
    const medal = ctx.createRadialGradient(cx - 20, cy - 30, 10, cx, cy, 110)
    medal.addColorStop(0, '#fffaf0')
    medal.addColorStop(1, '#ecdcb8')
    ctx.fillStyle = medal
    ctx.beginPath()
    ctx.arc(cx, cy, 104, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#b8903f'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.strokeStyle = '#e6c878'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, 92, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 150px ${SERIF}`
    ctx.fillText(rank, cx, cy + 8)
    glyph(ctx, suit, cx, fy + 52, 56)
    glyph(ctx, suit, cx, fy + fh - 52, 56, true)
    return canvas
  }

  const pipSize = rank === 'A' ? 230 : 84
  for (const [px, py] of pipLayouts[rank]) {
    const x = ax + px * aw
    const y = ay + py * ah
    glyph(ctx, suit, x, y, pipSize, py > 0.5)
  }
  return canvas
}

function paintBack(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas()
  const base = ctx.createLinearGradient(0, 0, W, H)
  base.addColorStop(0, '#6a1c33')
  base.addColorStop(1, '#3e0f20')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  const gold = '#d8b36b'
  const x0 = 28
  const y0 = 28
  const w = W - 56
  const h = H - 56

  ctx.save()
  roundRect(ctx, x0, y0, w, h, 14)
  ctx.clip()
  // Diamond lattice.
  ctx.strokeStyle = `${gold}66`
  ctx.lineWidth = 2
  const step = 38
  for (let d = -h; d < w + h; d += step) {
    ctx.beginPath()
    ctx.moveTo(x0 + d, y0)
    ctx.lineTo(x0 + d + h, y0 + h)
    ctx.moveTo(x0 + d + h, y0)
    ctx.lineTo(x0 + d, y0 + h)
    ctx.stroke()
  }
  // Dots at the lattice crossings.
  ctx.fillStyle = `${gold}aa`
  for (let gx = x0; gx < x0 + w; gx += step * 2) {
    for (let gy = y0; gy < y0 + h; gy += step * 2) {
      ctx.beginPath()
      ctx.arc(gx + (Math.floor((gy - y0) / (step * 2)) % 2) * step, gy, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()

  ctx.strokeStyle = gold
  ctx.lineWidth = 5
  roundRect(ctx, x0, y0, w, h, 14)
  ctx.stroke()
  ctx.lineWidth = 1.5
  roundRect(ctx, x0 + 12, y0 + 12, w - 24, h - 24, 8)
  ctx.stroke()

  // Central medallion.
  const cx = W / 2
  const cy = H / 2
  const medal = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, 100)
  medal.addColorStop(0, '#7d2740')
  medal.addColorStop(1, '#4a1226')
  ctx.fillStyle = medal
  ctx.beginPath()
  ctx.arc(cx, cy, 92, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = gold
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, 78, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = gold
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 74px ${SERIF}`
  ctx.fillText('500', cx, cy + 4)
  ctx.font = `20px ${SYMBOLS}`
  ctx.fillText('♠  ♥  ♣  ♦', cx, cy - 52)
  return canvas
}

const faceCache = new Map<string, CanvasTexture>()
let backTexture: CanvasTexture | null = null

export function faceTexture(card: Pick<Card, 'rank' | 'suit'>): CanvasTexture {
  const key = `${card.rank}-${card.suit}`
  let texture = faceCache.get(key)
  if (!texture) {
    texture = toTexture(paintFace(card))
    faceCache.set(key, texture)
  }
  return texture
}

export function backFaceTexture(): CanvasTexture {
  backTexture ??= toTexture(paintBack())
  return backTexture
}

let glowTexture: CanvasTexture | null = null

/** Soft rounded-rect halo, tinted per use through the material colour. */
export function haloTexture(): CanvasTexture {
  if (glowTexture) return glowTexture
  const canvas = document.createElement('canvas')
  canvas.width = 180
  canvas.height = 220
  const ctx = canvas.getContext('2d')!
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = 22
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 40, 40, 100, 140, 10)
  ctx.fill()
  ctx.fill()
  glowTexture = new CanvasTexture(canvas)
  glowTexture.colorSpace = SRGBColorSpace
  return glowTexture
}

/** Wait for web fonts so the first textures are not painted with fallbacks. */
export async function loadCardFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 40px ${SERIF}`),
      document.fonts.load(`800 40px ${SERIF}`),
    ])
  } catch {
    // Fall back to system serif.
  }
}
