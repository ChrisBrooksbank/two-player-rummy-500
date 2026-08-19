# Two-Player Rummy 500

A small pass-and-play browser prototype for the two-player version of Rummy 500.

## Rules Modeled

- Two players get 13 cards each.
- The discard pile is always visible.
- A player may take the top discard freely.
- A player may take a buried discard, but must also take every card above it.
- When taking a buried discard, the chosen buried card must be melded before the player can discard.
- Melds can be sets of 3-4 cards with the same rank, or suited runs of 3+ cards.
- Aces are low for runs and worth 15 points for scoring.
- A turn is draw, optional meld, then discard.
- The round ends when a player discards their last card or when the stock is empty and the table chooses to score the blocked round.

## Run Locally

```bash
npm install
npm run dev
```

## Useful Scripts

```bash
npm run build
npm run lint
```

## Current Scope

This is intentionally a focused local prototype rather than a full online game. It has no AI opponent, no networking, and no account system. The next natural improvements are laying off onto existing melds, optional joker rules, and configurable house rules for going out.
