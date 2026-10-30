import {
  canLayOff,
  cardPoints,
  discardFromHand,
  drawFromStock,
  endBlockedRound,
  layOff,
  playMeld,
  rankValues,
  runValues,
  suits,
  takeFromDiscard,
} from './game'
import type { Card, Game } from './game'

/** Every legal set or run that can be laid down from `hand`. */
function candidateMelds(hand: Card[]): Card[][] {
  const found: Card[][] = []

  const byRank = new Map<string, Card[]>()
  for (const card of hand) byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card])
  for (const group of byRank.values()) {
    if (group.length < 3) continue
    found.push(group)
    if (group.length === 4) {
      for (let skip = 0; skip < 4; skip += 1) found.push(group.filter((_, index) => index !== skip))
    }
  }

  for (const suit of suits) {
    const cards = hand
      .filter((card) => card.suit === suit)
      .sort((a, b) => runValues[a.rank] - runValues[b.rank])
    for (let start = 0; start < cards.length; start += 1) {
      for (let end = start + 2; end < cards.length; end += 1) {
        const consecutive = runValues[cards[end].rank] - runValues[cards[start].rank] === end - start
        if (!consecutive) break
        found.push(cards.slice(start, end + 1))
      }
    }
  }

  return found
}

/**
 * Greedily lays down the highest-scoring melds, always keeping one card back so
 * there is something to discard. When `mustInclude` is given, the first meld has
 * to contain that card; an empty plan means it cannot be satisfied.
 */
function planMelds(hand: Card[], mustInclude?: string): Card[][] {
  const plan: Card[][] = []
  let rest = hand
  let required = mustInclude

  for (;;) {
    const options = candidateMelds(rest).filter(
      (meld) =>
        meld.length < rest.length && (!required || meld.some((card) => card.id === required)),
    )
    if (options.length === 0) break
    const best = options.reduce((top, meld) =>
      cardPoints(meld) > cardPoints(top) ? meld : top,
    )
    plan.push(best)
    const used = new Set(best.map((card) => card.id))
    rest = rest.filter((card) => !used.has(card.id))
    required = undefined
  }

  return plan
}

/** Net points gained by taking the discard pile from `index`, or null if it cannot be melded. */
function takeValue(game: Game, index: number): number | null {
  const hand = game.players[game.active].hand
  const taken = game.discard.slice(index)
  const plan = planMelds([...hand, ...taken], game.discard[index].id)
  if (plan.length === 0) return null

  const melded = new Set(plan.flat().map((card) => card.id))
  const gained = plan.reduce((total, meld) => total + cardPoints(meld), 0)
  const alreadyMeldable = planMelds(hand).reduce((total, meld) => total + cardPoints(meld), 0)
  const stuck = cardPoints(taken.filter((card) => !melded.has(card.id)))
  return gained - alreadyMeldable - stuck
}

/** Cards that pair up or sit near same-suit neighbours are worth keeping. */
function keepScore(card: Card, hand: Card[]): number {
  return hand.reduce((total, other) => {
    if (other.id === card.id) return total
    if (other.rank === card.rank) return total + 2
    if (other.suit === card.suit && Math.abs(runValues[other.rank] - runValues[card.rank]) <= 2) {
      return total + 1
    }
    return total
  }, 0)
}

function chooseDiscard(hand: Card[]): Card {
  return hand.reduce((worst, card) => {
    const diff = keepScore(card, hand) - keepScore(worst, hand)
    if (diff !== 0) return diff < 0 ? card : worst
    return rankValues[card.rank] > rankValues[worst.rank] ? card : worst
  })
}

/** A hand card that fits onto a meld already on the table, keeping one card back to discard. */
function findLayOff(game: Game): { card: Card; meldId: string } | null {
  const hand = game.players[game.active].hand
  if (hand.length < 2) return null
  for (const card of hand) {
    const meld = game.melds.find((candidate) => canLayOff(candidate, [card]))
    if (meld) return { card, meldId: meld.id }
  }
  return null
}

/** Performs a single action for the active bot. Always returns a changed game. */
export function botStep(game: Game): Game {
  if (game.phase === 'draw') {
    let bestIndex = -1
    let bestValue = 0
    for (let index = 0; index < game.discard.length; index += 1) {
      const value = takeValue(game, index)
      if (value !== null && value > bestValue) {
        bestIndex = index
        bestValue = value
      }
    }
    if (bestIndex >= 0) return takeFromDiscard(game, bestIndex)
    if (game.stock.length > 0) return drawFromStock(game)
    return endBlockedRound(game)
  }

  if (game.phase === 'play') {
    const hand = game.players[game.active].hand
    const [meld] = planMelds(hand, game.drawLock?.cardId)
    if (meld) return playMeld(game, meld.map((card) => card.id))
    if (game.drawLock) return endBlockedRound(game)
    const fit = findLayOff(game)
    if (fit) return layOff(game, [fit.card.id], fit.meldId)
    return discardFromHand(game, chooseDiscard(hand).id)
  }

  return game
}
