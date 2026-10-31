export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export type Card = {
  id: string
  suit: Suit
  rank: Rank
}

export type Meld = {
  id: string
  owner: number
  cards: Card[]
  kind: 'set' | 'run'
  /** Seat that laid off each card, for cards added after the meld was made; the rest belong to `owner`. */
  laidBy: Record<string, number>
}

export type Controller = 'human' | 'bot'

export type Seat = {
  name: string
  controller: Controller
}

export type Player = Seat & {
  hand: Card[]
  score: number
}

export type DrawLock = {
  cardId: string
  label: string
} | null

export type Game = {
  players: [Player, Player]
  stock: Card[]
  discard: Card[]
  melds: Meld[]
  active: number
  phase: 'draw' | 'play' | 'round-over'
  selected: string[]
  drawLock: DrawLock
  message: string
  round: number
}

export const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
export const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const suitSymbols: Record<Suit, string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
}
export const suitGlyphs: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}
export const rankValues: Record<Rank, number> = {
  A: 15,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
}
export const runValues: Record<Rank, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
}

function makeDeck(): Card[] {
  return suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${rank}-${suit}-${crypto.randomUUID()}`,
      rank,
      suit,
    })),
  )
}

function shuffle(cards: Card[]): Card[] {
  const copy = [...cards]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.suit !== b.suit) return suits.indexOf(a.suit) - suits.indexOf(b.suit)
    return runValues[a.rank] - runValues[b.rank]
  })
}

export function cardLabel(card: Card): string {
  return `${card.rank}${suitGlyphs[card.suit]}`
}

export function cardPoints(cards: Card[]): number {
  return cards.reduce((total, card) => total + rankValues[card.rank], 0)
}

export function classifyMeld(cards: Card[]): Meld['kind'] | null {
  if (cards.length < 3) return null

  const allSameRank = cards.every((card) => card.rank === cards[0].rank)
  const uniqueSuits = new Set(cards.map((card) => card.suit)).size === cards.length
  if (allSameRank && uniqueSuits && cards.length <= 4) return 'set'

  const allSameSuit = cards.every((card) => card.suit === cards[0].suit)
  const ordered = sortCards(cards)
  const consecutive = ordered.every((card, index) => {
    if (index === 0) return true
    return runValues[card.rank] === runValues[ordered[index - 1].rank] + 1
  })
  if (allSameSuit && consecutive) return 'run'

  return null
}

export function createGame(seats: [Seat, Seat], previous?: Game): Game {
  const deck = shuffle(makeDeck())
  const hands = [sortCards(deck.slice(0, 13)), sortCards(deck.slice(13, 26))]

  return {
    players: [
      { ...seats[0], hand: hands[0], score: previous?.players[0].score ?? 0 },
      { ...seats[1], hand: hands[1], score: previous?.players[1].score ?? 0 },
    ],
    stock: deck.slice(27),
    discard: [deck[26]],
    melds: [],
    active: previous ? (previous.active + 1) % 2 : 0,
    phase: 'draw',
    selected: [],
    drawLock: null,
    message: 'Draw from the stock, take the top discard, or reach into the visible discard pile.',
    round: (previous?.round ?? 0) + 1,
  }
}

function withActiveHand(game: Game, hand: Card[]): Game {
  const players = [...game.players] as [Player, Player]
  players[game.active] = { ...players[game.active], hand: sortCards(hand) }
  return { ...game, players }
}

export function toggleSelected(game: Game, cardId: string): Game {
  if (game.phase !== 'play') return game
  return {
    ...game,
    selected: game.selected.includes(cardId)
      ? game.selected.filter((id) => id !== cardId)
      : [...game.selected, cardId],
  }
}

export function drawFromStock(game: Game): Game {
  if (game.phase !== 'draw' || game.stock.length === 0) return game
  const [drawn, ...stock] = game.stock
  const player = game.players[game.active]
  return {
    ...withActiveHand(game, [...player.hand, drawn]),
    stock,
    phase: 'play',
    message: `${player.name} drew from the stock.`,
  }
}

export function takeFromDiscard(game: Game, index: number): Game {
  if (game.phase !== 'draw' || index < 0 || index >= game.discard.length) return game
  const player = game.players[game.active]
  const taken = game.discard.slice(index)
  const chosen = game.discard[index]
  const lock = index === game.discard.length - 1 ? null : { cardId: chosen.id, label: cardLabel(chosen) }

  return {
    ...withActiveHand(game, [...player.hand, ...taken]),
    discard: game.discard.slice(0, index),
    phase: 'play',
    drawLock: lock,
    message: lock
      ? `${player.name} took ${taken.length} cards from ${cardLabel(chosen)} up. ${lock.label} must be melded before discarding.`
      : `${player.name} took ${cardLabel(chosen)} from the top of the discard pile.`,
  }
}

export function playMeld(game: Game, cardIds: string[]): Game {
  if (game.phase !== 'play') return game
  const player = game.players[game.active]
  const cards = player.hand.filter((card) => cardIds.includes(card.id))
  const kind = cards.length === cardIds.length ? classifyMeld(cards) : null
  if (!kind) return game

  if (game.drawLock && !cards.some((card) => card.id === game.drawLock?.cardId)) {
    return {
      ...game,
      message: `${game.drawLock.label} has to be part of the meld before you can discard.`,
    }
  }
  if (cards.length === player.hand.length) {
    return { ...game, message: 'Keep one card back to discard.' }
  }

  const next = withActiveHand(
    game,
    player.hand.filter((card) => !cardIds.includes(card.id)),
  )
  return {
    ...next,
    melds: [
      ...next.melds,
      { id: crypto.randomUUID(), owner: game.active, cards: sortCards(cards), kind, laidBy: {} },
    ],
    selected: [],
    drawLock: null,
    message: `${player.name} played a ${kind}: ${sortCards(cards).map(cardLabel).join(' ')}.`,
  }
}

/** Whether `cards` can all be added to `meld` and leave it a valid meld of the same kind. */
export function canLayOff(meld: Meld, cards: Card[]): boolean {
  return cards.length > 0 && classifyMeld([...meld.cards, ...cards]) === meld.kind
}

/** Adds cards from the active hand onto any meld on the table; they score for the player laying off. */
export function layOff(game: Game, cardIds: string[], meldId: string): Game {
  if (game.phase !== 'play') return game
  const player = game.players[game.active]
  const cards = player.hand.filter((card) => cardIds.includes(card.id))
  const meld = game.melds.find((candidate) => candidate.id === meldId)
  if (!meld || cards.length !== cardIds.length || !canLayOff(meld, cards)) return game

  if (game.drawLock && cardIds.includes(game.drawLock.cardId)) {
    return { ...game, message: `${game.drawLock.label} has to go in a new meld, not onto an existing one.` }
  }
  if (cards.length === player.hand.length) {
    return { ...game, message: 'Keep one card back to discard.' }
  }

  const laidBy = { ...meld.laidBy }
  for (const card of cards) laidBy[card.id] = game.active
  const next = withActiveHand(
    game,
    player.hand.filter((card) => !cardIds.includes(card.id)),
  )
  return {
    ...next,
    melds: next.melds.map((candidate) =>
      candidate.id === meldId ? { ...candidate, cards: sortCards([...candidate.cards, ...cards]), laidBy } : candidate,
    ),
    selected: [],
    message: `${player.name} laid off ${sortCards(cards).map(cardLabel).join(' ')}.`,
  }
}

/** Table points per seat; laid-off cards count for whoever laid them off. */
export function tablePoints(game: Game): [number, number] {
  const points: [number, number] = [0, 0]
  for (const meld of game.melds) {
    for (const card of meld.cards) points[meld.laidBy[card.id] ?? meld.owner] += rankValues[card.rank]
  }
  return points
}

export function scoreRound(game: Game, lead: string): Game {
  const table = tablePoints(game)

  const players = game.players.map((player, index) => ({
    ...player,
    score: player.score + table[index] - cardPoints(player.hand),
  })) as [Player, Player]

  return {
    ...game,
    players,
    phase: 'round-over',
    selected: [],
    drawLock: null,
    message: `${lead} Round scored: ${players[0].name} ${players[0].score}, ${players[1].name} ${players[1].score}.`,
  }
}

export const TARGET_SCORE = 500

/** Seat index of the match winner once a round ends with someone at 500+; the higher score wins, a tie plays on. */
export function matchWinner(game: Game): number | null {
  if (game.phase !== 'round-over') return null
  const [a, b] = game.players.map((player) => player.score)
  if (Math.max(a, b) < TARGET_SCORE || a === b) return null
  return a > b ? 0 : 1
}

export function endBlockedRound(game: Game): Game {
  if (game.phase === 'round-over') return game
  return scoreRound(game, 'Stock is empty and nobody can draw.')
}

export function discardFromHand(game: Game, cardId: string): Game {
  if (game.phase !== 'play') return game
  if (game.drawLock) {
    return { ...game, message: `You still need to meld ${game.drawLock.label}.` }
  }

  const player = game.players[game.active]
  const card = player.hand.find((candidate) => candidate.id === cardId)
  if (!card) return game
  const next = withActiveHand(
    game,
    player.hand.filter((candidate) => candidate.id !== cardId),
  )

  if (next.players[game.active].hand.length === 0) {
    return scoreRound(next, `${player.name} went out with ${cardLabel(card)}.`)
  }

  const nextActive = (game.active + 1) % 2
  return {
    ...next,
    discard: [...game.discard, card],
    active: nextActive,
    phase: 'draw',
    selected: [],
    message: `${player.name} discarded ${cardLabel(card)}.`,
  }
}
