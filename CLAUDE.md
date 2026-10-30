# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (the type check is the closest thing to a test suite)
- `npm run lint` — Oxlint (config in `.oxlintrc.json`)
- `npm run preview` — serve the production build

There is no test runner configured.

## Architecture

Small React 19 + TypeScript + Vite app, a local two-player Rummy 500 game (human vs human, human vs bot, bot vs bot). All state lives in React; there is no backend.

- `src/game.ts` — the rules engine. Pure functions of the form `(game: Game, ...args) => Game` (`drawFromStock`, `takeFromDiscard`, `playMeld`, `discardFromHand`, `scoreRound`, ...). Holds card/meld types, meld validation (`classifyMeld`), and scoring. No React imports; keep rules here.
- `src/bot.ts` — `botStep(game) => Game` performs exactly one action per call, using the same `game.ts` transitions as a human.
- `src/App.tsx` — mode select and match UI. In pass-and-play, `revealedSeat` keeps the active hand face-down behind a hand-off screen until its player taps through. Holds `Game` in `useState`; a `useEffect` with `setTimeout` (`BOT_DELAY_MS`) drives bot turns by repeatedly applying `botStep`.

### Key rule: buried discard commitment

Taking a buried discard also takes every card above it, and that specific card must be played in a new meld before discarding. This is tracked via the `DrawLock` on `Game`; any new transition or bot logic must respect it (the bot only reaches into the pile when it can meld the card it wants).

Other modeled rules: aces low in runs and worth 15, face cards 10, sets of 3-4 unique suits, suited runs of 3+. Laying off (`layOff`) extends any meld on the table; laid-off cards are recorded in `Meld.laidBy` and score for the player who laid them off, but cannot satisfy a `DrawLock`. Jokers are not implemented (see README "Not Yet Modeled").
