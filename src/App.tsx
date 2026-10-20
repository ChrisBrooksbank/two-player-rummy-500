import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { botStep } from './bot'
import {
  cardLabel,
  classifyMeld,
  createGame,
  discardFromHand,
  drawFromStock,
  endBlockedRound,
  playMeld,
  suitSymbols,
  takeFromDiscard,
  toggleSelected,
} from './game'
import type { Game, Seat } from './game'

const BOT_DELAY_MS = 800

type Mode = {
  id: string
  title: string
  blurb: string
  seats: [Seat, Seat]
}

const modes: Mode[] = [
  {
    id: 'hotseat',
    title: 'Two players',
    blurb: 'Pass and play on one screen.',
    seats: [
      { name: 'Player 1', controller: 'human' },
      { name: 'Player 2', controller: 'human' },
    ],
  },
  {
    id: 'versus-bot',
    title: 'Play the bot',
    blurb: 'You against the computer.',
    seats: [
      { name: 'You', controller: 'human' },
      { name: 'Bot', controller: 'bot' },
    ],
  },
  {
    id: 'watch',
    title: 'Watch two bots',
    blurb: 'Sit back and see them play.',
    seats: [
      { name: 'Bot 1', controller: 'bot' },
      { name: 'Bot 2', controller: 'bot' },
    ],
  },
]

function ModeSelect({ onStart }: { onStart: (mode: Mode) => void }) {
  return (
    <main className="table">
      <header className="matchbar">
        <div>
          <p className="eyebrow">Two-player Rummy 500</p>
          <h1>Visible discard pile, buried-card commitment.</h1>
        </div>
      </header>
      <section className="mode-select">
        {modes.map((mode) => (
          <button className="mode-card" key={mode.id} onClick={() => onStart(mode)} type="button">
            <strong>{mode.title}</strong>
            <span>{mode.blurb}</span>
          </button>
        ))}
      </section>
    </main>
  )
}

function App() {
  const [mode, setMode] = useState<Mode | null>(null)
  if (!mode) return <ModeSelect onStart={setMode} />
  return <Match mode={mode} onExit={() => setMode(null)} />
}

function Match({ mode, onExit }: { mode: Mode; onExit: () => void }) {
  const [game, setGame] = useState<Game>(() => createGame(mode.seats))
  const [paused, setPaused] = useState(false)

  const activePlayer = game.players[game.active]
  const humanSeats = game.players.flatMap((player, index) => (player.controller === 'human' ? [index] : []))
  // Pass-and-play shows whoever is up; otherwise the table is seen from one fixed seat.
  const viewer = humanSeats.length === 2 ? game.active : (humanSeats[0] ?? 0)
  const viewerPlayer = game.players[viewer]
  const opponent = game.players[(viewer + 1) % 2]
  const humanTurn = activePlayer.controller === 'human' && game.phase !== 'round-over'
  const botsOnly = humanSeats.length === 0

  const selectedCards = useMemo(
    () => viewerPlayer.hand.filter((card) => game.selected.includes(card.id)),
    [viewerPlayer.hand, game.selected],
  )
  const selectedMeldKind = classifyMeld(selectedCards)
  const topDiscard = game.discard.at(-1)
  const canDraw = humanTurn && game.phase === 'draw'
  const canPlay = humanTurn && game.phase === 'play'

  useEffect(() => {
    if (paused || game.phase === 'round-over' || game.players[game.active].controller !== 'bot') return
    const timer = setTimeout(() => setGame(botStep), BOT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [game, paused])

  function toggleCard(cardId: string) {
    if (canPlay) setGame((current) => toggleSelected(current, cardId))
  }

  function discardCard(cardId: string) {
    if (canPlay) setGame((current) => discardFromHand(current, cardId))
  }

  function nextRound() {
    setGame((current) => createGame(mode.seats, current))
  }

  function resetMatch() {
    setGame(createGame(mode.seats))
  }

  const handTitle =
    viewerPlayer.name === 'You'
      ? 'Your hand'
      : botsOnly
        ? `${viewerPlayer.name}'s hand (revealed)`
        : `${viewerPlayer.name}'s hand`

  return (
    <main className="table">
      <header className="matchbar">
        <div>
          <p className="eyebrow">Two-player Rummy 500 · {mode.title}</p>
          <h1>Visible discard pile, buried-card commitment.</h1>
        </div>
        <div className="scoreboard" aria-label="Scores">
          {game.players.map((player, index) => (
            <div className={index === game.active ? 'score active-score' : 'score'} key={index}>
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
          ) : activePlayer.controller === 'bot' ? (
            <button onClick={() => setPaused((value) => !value)} type="button">
              {paused ? 'Resume' : 'Pause'}
            </button>
          ) : (
            <button disabled={!canDraw || game.stock.length === 0} onClick={() => setGame(drawFromStock)} type="button">
              Draw stock ({game.stock.length})
            </button>
          )}
          <button onClick={resetMatch} type="button">New match</button>
          <button onClick={onExit} type="button">Change mode</button>
        </div>
      </section>

      <section className="board">
        <aside className="opponent">
          <h2>{opponent.name}</h2>
          <div className="card-backs" aria-label={`${opponent.hand.length} cards in hand`}>
            {opponent.hand.slice(0, 13).map((card) => (
              <span className="card-back" key={card.id} />
            ))}
          </div>
          <p>{opponent.hand.length} cards in hand</p>
        </aside>

        <section className="center-play">
          <div className="pile-row">
            <button className="stock" disabled={!canDraw || game.stock.length === 0} onClick={() => setGame(drawFromStock)} type="button">
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
                    disabled={!canDraw}
                    key={card.id}
                    onClick={() => setGame((current) => takeFromDiscard(current, index))}
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
            <h2>{handTitle}</h2>
            <p>
              {!humanTurn
                ? game.phase === 'round-over'
                  ? 'Round over.'
                  : `${activePlayer.name} is playing…`
                : game.drawLock
                  ? `Must meld ${game.drawLock.label} before discarding.`
                  : game.phase === 'draw'
                    ? 'Draw first, then meld or discard.'
                    : 'Select cards to meld, or discard one card.'}
            </p>
          </div>
          <button
            disabled={!selectedMeldKind || !canPlay}
            onClick={() => setGame((current) => playMeld(current, current.selected))}
            type="button"
          >
            Meld selected{selectedMeldKind ? ` ${selectedMeldKind}` : ''}
          </button>
        </div>

        <div className="hand">
          {viewerPlayer.hand.map((card) => (
            <button
              className={`card hand-card ${card.suit} ${game.selected.includes(card.id) ? 'selected' : ''} ${
                viewer === game.active && game.drawLock?.cardId === card.id ? 'must-play' : ''
              }`}
              disabled={!canPlay}
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
            disabled={!canPlay || game.selected.length !== 1 || Boolean(game.drawLock)}
            onClick={() => discardCard(game.selected[0])}
            type="button"
          >
            Discard selected
          </button>
          <button disabled={!humanTurn || game.stock.length > 0} onClick={() => setGame(endBlockedRound)} type="button">
            Score blocked round
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
