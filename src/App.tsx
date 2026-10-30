import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { botStep } from './bot'
import {
  canLayOff,
  classifyMeld,
  createGame,
  discardFromHand,
  drawFromStock,
  endBlockedRound,
  layOff,
  playMeld,
  takeFromDiscard,
  toggleSelected,
} from './game'
import type { Game } from './game'
import { MainMenu, MatchHud } from './Hud'
import type { Mode } from './Hud'
import { loadCardFonts } from './scene/cardArt'
import { MatchScene, Showcase } from './scene/MatchScene'
import { Stage } from './scene/Stage'
import type { Actions } from './scene/layout'

const BOT_DELAY_MS = 1000

const modes: Mode[] = [
  {
    id: 'versus-bot',
    title: 'Play the bot',
    blurb: 'You against the computer.',
    icon: '♠',
    seats: [
      { name: 'You', controller: 'human' },
      { name: 'Bot', controller: 'bot' },
    ],
  },
  {
    id: 'hotseat',
    title: 'Two players',
    blurb: 'Pass and play on one screen.',
    icon: '♥',
    seats: [
      { name: 'Player 1', controller: 'human' },
      { name: 'Player 2', controller: 'human' },
    ],
  },
  {
    id: 'watch',
    title: 'Watch two bots',
    blurb: 'Sit back and see them play.',
    icon: '♦',
    seats: [
      { name: 'Bot 1', controller: 'bot' },
      { name: 'Bot 2', controller: 'bot' },
    ],
  },
]

function App() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [paused, setPaused] = useState(false)
  const [ready, setReady] = useState(false)
  // Pass-and-play: the seat whose player has tapped through the hand-off screen this turn.
  const [revealedSeat, setRevealedSeat] = useState<number | null>(null)

  useEffect(() => {
    // Card faces are painted once, so give the web fonts a moment to arrive first.
    Promise.race([loadCardFonts(), new Promise((resolve) => setTimeout(resolve, 1500))]).then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!game || paused || game.phase === 'round-over' || game.players[game.active].controller !== 'bot') return
    const timer = setTimeout(() => setGame((current) => (current ? botStep(current) : current)), BOT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [game, paused])

  const actions = useMemo<Actions>(
    () => ({
      drawStock: () => setGame((current) => (current ? drawFromStock(current) : current)),
      takeDiscard: (index) => setGame((current) => (current ? takeFromDiscard(current, index) : current)),
      toggleCard: (cardId) => setGame((current) => (current ? toggleSelected(current, cardId) : current)),
      discardCard: (cardId) => setGame((current) => (current ? discardFromHand(current, cardId) : current)),
      layOff: (meldId) => setGame((current) => (current ? layOff(current, current.selected, meldId) : current)),
    }),
    [],
  )

  const view = mode && game ? 'match' : 'menu'

  const humanSeats = game ? game.players.flatMap((player, index) => (player.controller === 'human' ? [index] : [])) : []
  // Pass-and-play shows whoever is up; otherwise the table is seen from one fixed seat.
  const passAndPlay = humanSeats.length === 2
  const viewer = game ? (passAndPlay ? game.active : (humanSeats[0] ?? 0)) : 0
  const activePlayer = game?.players[game.active]
  const roundOver = game?.phase === 'round-over'
  // Keep the next hand face-down until its player has the screen.
  const handoff = Boolean(game && passAndPlay && !roundOver && revealedSeat !== game.active)
  const humanTurn = Boolean(game && activePlayer?.controller === 'human' && !roundOver && !handoff)
  const botTurn = Boolean(game && activePlayer?.controller === 'bot' && !roundOver)
  const canDraw = humanTurn && game?.phase === 'draw'
  const canPlay = humanTurn && game?.phase === 'play'

  const selectedMeldKind = useMemo(() => {
    if (!game) return null
    return classifyMeld(game.players[viewer].hand.filter((card) => game.selected.includes(card.id)))
  }, [game, viewer])

  const layOffTargets = useMemo(() => {
    if (!game || !canPlay) return []
    const cards = game.players[viewer].hand.filter((card) => game.selected.includes(card.id))
    return game.melds.filter((meld) => canLayOff(meld, cards)).map((meld) => meld.id)
  }, [game, viewer, canPlay])

  function start(next: Mode) {
    setMode(next)
    setPaused(false)
    setRevealedSeat(null)
    setGame(createGame(next.seats))
  }

  function exit() {
    setMode(null)
    setGame(null)
  }

  return (
    <div className="app">
      {ready ? (
        <Stage view={view}>
          {game ? (
            <MatchScene
              game={game}
              viewer={viewer}
              canDraw={canDraw}
              canPlay={canPlay}
              revealAll={humanSeats.length === 0}
              hideHand={handoff}
              actions={actions}
            />
          ) : (
            <Showcase />
          )}
        </Stage>
      ) : null}
      <div className="vignette" aria-hidden="true" />
      {mode && game ? (
        <MatchHud
          game={game}
          viewer={viewer}
          modeTitle={mode.title}
          humanTurn={humanTurn}
          canDraw={canDraw}
          canPlay={canPlay}
          botTurn={botTurn}
          paused={paused}
          selectedMeldKind={selectedMeldKind}
          layOffTargets={layOffTargets}
          handoff={handoff}
          onReveal={() => setRevealedSeat(game.active)}
          onTogglePause={() => setPaused((value) => !value)}
          onDraw={actions.drawStock}
          onMeld={() => setGame((current) => (current ? playMeld(current, current.selected) : current))}
          onLayOff={() => layOffTargets.length === 1 && actions.layOff(layOffTargets[0])}
          onDiscard={() => game.selected[0] && actions.discardCard(game.selected[0])}
          onBlocked={() => setGame((current) => (current ? endBlockedRound(current) : current))}
          onNextRound={() => {
            setRevealedSeat(null)
            setGame((current) => (current ? createGame(mode.seats, current) : current))
          }}
          onNewMatch={() => {
            setRevealedSeat(null)
            setGame(createGame(mode.seats))
          }}
          onExit={exit}
        />
      ) : (
        <MainMenu modes={modes} onStart={start} />
      )}
    </div>
  )
}

export default App
