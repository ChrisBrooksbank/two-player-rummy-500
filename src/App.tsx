import { useMemo, useState } from 'react'
import './App.css'

type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

type Card = {
  id: string
  suit: Suit
  rank: Rank
}

type Meld = {
  id: string
  owner: number
  cards: Card[]
  kind: 'set' | 'run'
}

type Player = {
  name: string
  hand: Card[]
  score: number
}

type DrawLock = {
  cardId: string
  label: string
} | null

type Game = {
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

const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const suitSymbols: Record<Suit, string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
}
const suitGlyphs: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}
const rankValues: Record<Rank, number> = {
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
const runValues: Record<Rank, number> = {
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

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.suit !== b.suit) return suits.indexOf(a.suit) - suits.indexOf(b.suit)
    return runValues[a.rank] - runValues[b.rank]
  })
}

function cardLabel(card: Card): string {
  return `${card.rank}${suitGlyphs[card.suit]}`
}

function cardPoints(cards: Card[]): number {
  return cards.reduce((total, card) => total + rankValues[card.rank], 0)
}

function classifyMeld(cards: Card[]): Meld['kind'] | null {
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

function createGame(previous?: Game): Game {
  const deck = shuffle(makeDeck())
  const playerOne = sortCards(deck.slice(0, 13))
  const playerTwo = sortCards(deck.slice(13, 26))
  const discard = [deck[26]]
  const stock = deck.slice(27)

  return {
    players: [
      { name: 'Player 1', hand: playerOne, score: previous?.players[0].score ?? 0 },
      { name: 'Player 2', hand: playerTwo, score: previous?.players[1].score ?? 0 },
    ],
    stock,
    discard,
    melds: [],
    active: previous ? (previous.active + 1) % 2 : 0,
    phase: 'draw',
    selected: [],
    drawLock: null,
    message: 'Draw from the stock, take the top discard, or reach into the visible discard pile.',
    round: (previous?.round ?? 0) + 1,
  }
}

function App() {
  const [game, setGame] = useState<Game>(() => createGame())

  const activePlayer = game.players[game.active]
  const inactivePlayer = game.players[(game.active + 1) % 2]
  const selectedCards = useMemo(
    () => activePlayer.hand.filter((card) => game.selected.includes(card.id)),
    [activePlayer.hand, game.selected],
  )
  const selectedMeldKind = classifyMeld(selectedCards)
  const topDiscard = game.discard.at(-1)

  function updateActiveHand(nextHand: Card[], gameDraft: Game): Game {
    const players = [...gameDraft.players] as [Player, Player]
    players[gameDraft.active] = { ...players[gameDraft.active], hand: sortCards(nextHand) }
    return { ...gameDraft, players }
  }

  function toggleCard(cardId: string) {
    if (game.phase !== 'play') return
    setGame((current) => ({
      ...current,
      selected: current.selected.includes(cardId)
        ? current.selected.filter((id) => id !== cardId)
        : [...current.selected, cardId],
    }))
  }

  function drawStock() {
    if (game.phase !== 'draw' || game.stock.length === 0) return
    const [drawn, ...stock] = game.stock
    setGame((current) => {
      const next = updateActiveHand([...current.players[current.active].hand, drawn], current)
      return {
        ...next,
        stock,
        phase: 'play',
        message: `${current.players[current.active].name} drew from the stock.`,
      }
    })
  }

  function takeDiscard(index: number) {
    if (game.phase !== 'draw') return
    const taken = game.discard.slice(index)
    const remainingDiscard = game.discard.slice(0, index)
    const chosen = game.discard[index]
    const lock = index === game.discard.length - 1 ? null : { cardId: chosen.id, label: cardLabel(chosen) }

    setGame((current) => {
      const next = updateActiveHand([...current.players[current.active].hand, ...taken], current)
      return {
        ...next,
        discard: remainingDiscard,
        phase: 'play',
        drawLock: lock,
        message: lock
          ? `You took ${taken.length} cards. Meld ${lock.label} before discarding.`
          : `You took ${cardLabel(chosen)} from the top of the discard pile.`,
      }
    })
  }

  function meldSelected() {
    if (game.phase !== 'play' || !selectedMeldKind) return
    if (game.drawLock && !selectedCards.some((card) => card.id === game.drawLock?.cardId)) {
      setGame((current) => ({
        ...current,
        message: `${current.drawLock?.label} has to be part of the meld before you can discard.`,
      }))
      return
    }

    setGame((current) => {
      const cardsToMeld = current.players[current.active].hand.filter((card) =>
        current.selected.includes(card.id),
      )
      const remainingHand = current.players[current.active].hand.filter(
        (card) => !current.selected.includes(card.id),
      )
      const kind = classifyMeld(cardsToMeld)
      if (!kind) return current
      const next = updateActiveHand(remainingHand, current)
      return {
        ...next,
        melds: [
          ...next.melds,
          {
            id: crypto.randomUUID(),
            owner: current.active,
            cards: sortCards(cardsToMeld),
            kind,
          },
        ],
        selected: [],
        drawLock: null,
        message: `${current.players[current.active].name} played a ${kind}.`,
      }
    })
  }

  function discardCard(cardId: string) {
    if (game.phase !== 'play' || game.drawLock) {
      setGame((current) => ({
        ...current,
        message: current.drawLock
          ? `You still need to meld ${current.drawLock.label}.`
          : current.message,
      }))
      return
    }

    setGame((current) => {
      const player = current.players[current.active]
      const card = player.hand.find((candidate) => candidate.id === cardId)
      if (!card) return current
      const remainingHand = player.hand.filter((candidate) => candidate.id !== cardId)

      if (remainingHand.length === 0) {
        return scoreRound(updateActiveHand(remainingHand, current), `${player.name} went out with ${cardLabel(card)}.`)
      }

      const next = updateActiveHand(remainingHand, current)
      return {
        ...next,
        discard: [...current.discard, card],
        active: (current.active + 1) % 2,
        phase: 'draw',
        selected: [],
        message: `${player.name} discarded ${cardLabel(card)}. Pass to ${current.players[(current.active + 1) % 2].name}.`,
      }
    })
  }

  function scoreRound(current: Game, lead: string): Game {
    const players = [...current.players] as [Player, Player]
    const tablePoints = [0, 0]
    for (const meld of current.melds) {
      tablePoints[meld.owner] += cardPoints(meld.cards)
    }

    players[0] = {
      ...players[0],
      score: players[0].score + tablePoints[0] - cardPoints(players[0].hand),
    }
    players[1] = {
      ...players[1],
      score: players[1].score + tablePoints[1] - cardPoints(players[1].hand),
    }

    return {
      ...current,
      players,
      phase: 'round-over',
      selected: [],
      drawLock: null,
      message: `${lead} Round scored: ${players[0].name} ${players[0].score}, ${players[1].name} ${players[1].score}.`,
    }
  }

  function endBlockedRound() {
    setGame((current) => scoreRound(current, 'Stock is empty and nobody can draw.'))
  }

  function nextRound() {
    setGame((current) => createGame(current))
  }

  function resetMatch() {
    setGame(() => createGame())
  }

  return (
    <main className="table">
      <header className="matchbar">
        <div>
          <p className="eyebrow">Two-player Rummy 500</p>
          <h1>Visible discard pile, buried-card commitment.</h1>
        </div>
        <div className="scoreboard" aria-label="Scores">
          {game.players.map((player, index) => (
            <div className={index === game.active ? 'score active-score' : 'score'} key={player.name}>
              <span>{player.name}</span>
              <strong>{player.score}</strong>
            </div>
          ))}
        </div>
      </header>

      <section className="status">
        <div>
          <span>Round {game.round}</span>
          <strong>{game.phase === 'round-over' ? 'Round over' : `${activePlayer.name}'s turn`}</strong>
        </div>
        <p>{game.message}</p>
        <div className="actions">
          {game.phase === 'round-over' ? (
            <button onClick={nextRound} type="button">Next round</button>
          ) : (
            <button disabled={game.phase !== 'draw' || game.stock.length === 0} onClick={drawStock} type="button">
              Draw stock ({game.stock.length})
            </button>
          )}
          <button onClick={resetMatch} type="button">New match</button>
        </div>
      </section>

      <section className="board">
        <aside className="opponent">
          <h2>{inactivePlayer.name}</h2>
          <div className="card-backs" aria-label={`${inactivePlayer.hand.length} cards in hand`}>
            {inactivePlayer.hand.slice(0, 13).map((card) => (
              <span className="card-back" key={card.id} />
            ))}
          </div>
          <p>{inactivePlayer.hand.length} cards in hand</p>
        </aside>

        <section className="center-play">
          <div className="pile-row">
            <button className="stock" disabled={game.phase !== 'draw' || game.stock.length === 0} onClick={drawStock} type="button">
              <span>{game.stock.length}</span>
              Stock
            </button>
            <div className="discard-panel">
              <div className="pile-title">
                <h2>Discard pile</h2>
                <span>{topDiscard ? `${cardLabel(topDiscard)} on top` : 'Empty'}</span>
              </div>
              <div className="discard-strip">
                {game.discard.map((card, index) => (
                  <button
                    className={`card ${card.suit} ${index === game.discard.length - 1 ? 'top-card' : ''}`}
                    disabled={game.phase !== 'draw'}
                    key={card.id}
                    onClick={() => takeDiscard(index)}
                    title={
                      index === game.discard.length - 1
                        ? `Take ${cardLabel(card)}`
                        : `Take ${cardLabel(card)} and ${game.discard.length - index - 1} above it`
                    }
                    type="button"
                  >
                    <span>{card.rank}</span>
                    <span>{suitSymbols[card.suit]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="meld-zone">
            <div className="pile-title">
              <h2>Melds</h2>
              <span>{game.melds.length} on table</span>
            </div>
            <div className="melds">
              {game.melds.length === 0 ? (
                <p className="empty">No melds yet.</p>
              ) : (
                game.melds.map((meld) => (
                  <div className="meld" key={meld.id}>
                    <span>{game.players[meld.owner].name} {meld.kind}</span>
                    <div>
                      {meld.cards.map((card) => (
                        <b className={card.suit} key={card.id}>{cardLabel(card)}</b>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </section>

      <section className="hand-panel">
        <div className="hand-header">
          <div>
            <h2>{activePlayer.name}'s hand</h2>
            <p>
              {game.drawLock
                ? `Must meld ${game.drawLock.label} before discarding.`
                : game.phase === 'draw'
                  ? 'Draw first, then meld or discard.'
                  : 'Select cards to meld, or discard one card.'}
            </p>
          </div>
          <button disabled={!selectedMeldKind || game.phase !== 'play'} onClick={meldSelected} type="button">
            Meld selected{selectedMeldKind ? ` ${selectedMeldKind}` : ''}
          </button>
        </div>

        <div className="hand">
          {activePlayer.hand.map((card) => (
            <button
              className={`card hand-card ${card.suit} ${game.selected.includes(card.id) ? 'selected' : ''} ${
                game.drawLock?.cardId === card.id ? 'must-play' : ''
              }`}
              disabled={game.phase === 'round-over'}
              key={card.id}
              onClick={() => toggleCard(card.id)}
              onDoubleClick={() => discardCard(card.id)}
              type="button"
            >
              <span>{card.rank}</span>
              <span>{suitSymbols[card.suit]}</span>
              <small>dbl discard</small>
            </button>
          ))}
        </div>

        <div className="hand-actions">
          <button
            disabled={game.phase !== 'play' || game.selected.length !== 1 || Boolean(game.drawLock)}
            onClick={() => discardCard(game.selected[0])}
            type="button"
          >
            Discard selected
          </button>
          <button disabled={game.stock.length > 0 || game.phase === 'round-over'} onClick={endBlockedRound} type="button">
            Score blocked round
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
