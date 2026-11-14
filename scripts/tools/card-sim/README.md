# Card game simulation harness

Plays "Kontrola mapy" computer against computer, offline, on the card pools of the fixture tournaments, to measure the game. Nothing here changes the rules or the computer player in `src/lib/card-lab/`; the harness only drives them. Results are in `docs/overhaul/sim/baseline/REPORT.md`.

| File | Does |
|---|---|
| `load-cards.ts` | `loadCards(slug)` / `loadPool(slug)`: the cards the site makes for a fixture (`buildSeriesCards(deriveModel(dataset), type)`), cached |
| `game.ts` | `playGame({ decks, levels, seed, noise, maxTurns, hooks })`: one game, driven as `OutpostsGame.tsx` drives the computer, returning a `GameRecord` |
| `rng.ts` | Seeded random streams (mulberry32); the harness never uses `Math.random` |
| `decks.ts` | The deck rule and deck builders (random pairs as the practice opponent's deck is made, collections, the deck-building challengers) |
| `ai-mirror.ts` | Copies of the computer's private judgement, to see every option it weighed; a test keeps them equal to the originals |
| `experiments.ts` | The eight experiments |
| `run.ts`, `report.ts` | The command line and `REPORT.md` |

```
npx tsx scripts/tools/card-sim/run.ts <shape|strength|skill|snowball|decisions|abilities|deckbuilding|pool|all|report> [--slug wiosenna] [--games N] [--seed S]
npx vitest run scripts/tools/card-sim
```

A game with the same decks, levels and seed gives the same record. Turn cap: 80 player turns, then the game counts as stalled.
