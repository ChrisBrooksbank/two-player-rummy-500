import { cardPoints } from './game'
import type { Game } from './game'

export type Mode = {
  id: string
  title: string
  blurb: string
  icon: string
  seats: [import('./game').Seat, import('./game').Seat]
}

export function MainMenu({ modes, onStart }: { modes: Mode[]; onStart: (mode: Mode) => void }) {
  return (
    <div className="menu">
      <div className="menu-head">
        <p className="eyebrow">A two-player card game</p>
        <h1>
          Rummy <span>500</span>
        </h1>
        <p className="lede">
          The whole discard pile is on show. Reach down for a buried card, and you must play it before you
          can let go.
        </p>
      </div>
      <div className="mode-grid">
        {modes.map((mode) => (
          <button className="mode-card" key={mode.id} onClick={() => onStart(mode)} type="button">
            <span className="mode-icon" aria-hidden="true">{mode.icon}</span>
            <strong>{mode.title}</strong>
            <span>{mode.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Seat({ game, index, viewer }: { game: Game; index: number; viewer: number }) {
  const player = game.players[index]
  const active = game.active === index && game.phase !== 'round-over'
  return (
    <div className={`seat ${active ? 'active' : ''} ${index === viewer ? 'me' : ''}`}>
      <span className="avatar" aria-hidden="true">{player.name.slice(0, 1)}</span>
      <div className="seat-text">
        <span className="seat-name">{player.name}</span>
        <span className="seat-sub">
          {player.hand.length} cards{player.controller === 'bot' ? ' · bot' : ''}
        </span>
      </div>
      <strong className="seat-score">{player.score}</strong>
    </div>
  )
}

type MatchHudProps = {
  game: Game
  viewer: number
  modeTitle: string
  humanTurn: boolean
  canDraw: boolean
  canPlay: boolean
  botTurn: boolean
  paused: boolean
  selectedMeldKind: string | null
  onTogglePause: () => void
  onDraw: () => void
  onMeld: () => void
  onDiscard: () => void
  onBlocked: () => void
  onNextRound: () => void
  onNewMatch: () => void
  onExit: () => void
}

export function MatchHud(props: MatchHudProps) {
  const { game, viewer, humanTurn, canDraw, canPlay, botTurn, paused, selectedMeldKind } = props
  const active = game.players[game.active]
  const over = game.phase === 'round-over'

  const hint = over
    ? 'Round over.'
    : botTurn
      ? `${active.name} is thinking…`
      : game.drawLock
        ? `Play ${game.drawLock.label} in a meld before you discard.`
        : game.phase === 'draw'
          ? 'Draw from the stock, or click any discard to take it and everything above.'
          : 'Click cards to select. Meld a set or run, or double-click a card to discard it.'

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <button className="ghost" onClick={props.onExit} type="button" aria-label="Back to menu">
            ← Menu
          </button>
          <span className="round-chip">
            {props.modeTitle} · Round {game.round}
          </span>
        </div>
        <div className="scoreboard" aria-label="Scores">
          <Seat game={game} index={0} viewer={viewer} />
          <span className="versus">vs</span>
          <Seat game={game} index={1} viewer={viewer} />
        </div>
        <div className="topbar-right">
          {botTurn || paused ? (
            <button className="ghost" onClick={props.onTogglePause} type="button">
              {paused ? '▶ Resume' : '❚❚ Pause'}
            </button>
          ) : null}
          <button className="ghost" onClick={props.onNewMatch} type="button">
            New match
          </button>
        </div>
      </header>

      <p className="toast" key={game.message} role="status">
        {game.message}
      </p>

      {!over ? (
        <footer className="dock">
          <p className={`hint ${game.drawLock ? 'warn' : ''}`}>{hint}</p>
          {humanTurn ? (
            <div className="dock-buttons">
              {game.phase === 'draw' ? (
                <button className="primary" disabled={!canDraw || game.stock.length === 0} onClick={props.onDraw} type="button">
                  Draw from stock <kbd>{game.stock.length}</kbd>
                </button>
              ) : null}
              {game.phase === 'play' ? (
                <>
                  <button className="primary" disabled={!canPlay || !selectedMeldKind} onClick={props.onMeld} type="button">
                    {selectedMeldKind ? `Meld ${selectedMeldKind}` : 'Meld selected'}
                  </button>
                  <button
                    disabled={!canPlay || game.selected.length !== 1 || Boolean(game.drawLock)}
                    onClick={props.onDiscard}
                    type="button"
                  >
                    Discard
                  </button>
                </>
              ) : null}
              {game.stock.length === 0 ? (
                <button onClick={props.onBlocked} type="button">
                  Score blocked round
                </button>
              ) : null}
            </div>
          ) : null}
        </footer>
      ) : (
        <RoundSummary game={game} onNext={props.onNextRound} onExit={props.onExit} />
      )}
    </>
  )
}

function RoundSummary({ game, onNext, onExit }: { game: Game; onNext: () => void; onExit: () => void }) {
  const rows = game.players.map((player, index) => {
    const table = game.melds.filter((meld) => meld.owner === index).reduce((sum, meld) => sum + cardPoints(meld.cards), 0)
    const hand = cardPoints(player.hand)
    return { player, table, hand, net: table - hand }
  })
  const leader = rows[0].net === rows[1].net ? null : rows[0].net > rows[1].net ? 0 : 1
  const total = game.players[0].score === game.players[1].score ? null : game.players[0].score > game.players[1].score ? 0 : 1

  return (
    <div className="summary-backdrop">
      <section className="summary" aria-label="Round summary">
        <p className="eyebrow">Round {game.round} complete</p>
        <h2>{leader === null ? 'A dead heat' : `${game.players[leader].name} took the round`}</h2>
        <table>
          <thead>
            <tr>
              <th />
              <th>Melds</th>
              <th>In hand</th>
              <th>Round</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className={leader === index ? 'lead' : ''} key={index}>
                <th>{row.player.name}</th>
                <td>+{row.table}</td>
                <td>−{row.hand}</td>
                <td>{row.net >= 0 ? `+${row.net}` : `−${-row.net}`}</td>
                <td className={total === index ? 'total lead' : 'total'}>{row.player.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="summary-actions">
          <button className="primary" onClick={onNext} type="button" autoFocus>
            Deal next round
          </button>
          <button className="ghost" onClick={onExit} type="button">
            Back to menu
          </button>
        </div>
      </section>
    </div>
  )
}
