# Two-Player Rummy 500

A focused browser prototype for the two-player version of Rummy 500, built around the wonderfully sharp discard-pile rule: the whole discard pile is visible, and if you reach down into it, you must immediately use the card you went in for.

This project is a local game (pass-and-play, versus a bot, or bot vs bot). It is designed to capture the feel of a kitchen-table two-player match before adding online play, AI, or a deeper rules engine.

## Why This Exists

Rummy has many regional and family variants. This version models the common 500 Rummy discard behavior often played in Canada and elsewhere:

- The discard pile is spread face up.
- You can take the top discard normally.
- You can take a buried discard, but you also take every card above it.
- The buried card you selected must be played immediately in a valid meld before you may discard.

That single rule makes the discard pile a public memory game, a temptation engine, and a small act of brinkmanship.

## Features

- Two-player 13-card deal.
- Visible discard pile with clickable buried cards.
- Enforced buried-card commitment.
- Set and run validation.
- Round scoring with positive and negative hand totals.
- Three modes: two humans (pass-and-play), human vs bot, or watch two bots.
- Rule-aware bot that only reaches into the discard pile when it can meld the card it wants.
- Responsive card-table interface.
- Local match state managed entirely in React.

## Rules Modeled

- Two players are dealt 13 cards each.
- One card starts the discard pile.
- A turn has three phases: draw, optional meld, discard.
- A player may draw from the stock.
- A player may take the top discard without an immediate meld requirement.
- A player may take any buried discard, along with all cards above it.
- When a buried discard is taken, that specific card must be included in a newly played meld before the player can discard.
- Melds may be sets of 3-4 cards of the same rank with unique suits.
- Melds may be suited runs of 3 or more consecutive cards.
- Aces are low for runs.
- Aces score 15 points.
- Number cards score face value.
- Face cards score 10 points.
- The round ends when a player discards their final card.
- If the stock is empty and play is blocked, the table can score the round.

## Not Yet Modeled

These are natural next steps rather than bugs:

- Laying off onto existing melds.
- Joker or wild-card rules.
- Configurable ace behavior.
- Requiring a discard to go out as a strict house-rule toggle.
- Calling "Rummy" on a missed playable discard.
- Online multiplayer.
- Saved match history.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run the linter:

```bash
npm run lint
```

## Tech Stack

- React
- TypeScript
- Vite
- Oxlint

## Project Structure

```text
src/
  game.ts      Cards, meld validation, scoring, and pure turn transitions
  bot.ts       Bot player (one action per call)
  App.tsx      Mode select and match UI
  App.css      Table, card, pile, and responsive styling
  index.css    Global base styles
```

## Design Notes

The current implementation keeps the rules close to the interface on purpose. For a small rules prototype, this makes the game easier to inspect and adjust as house rules become clearer. If the project grows, the next architectural move should be extracting the card model, meld validation, scoring, and turn reducer into a separate game engine module with unit tests.

## License

No license has been selected yet.
