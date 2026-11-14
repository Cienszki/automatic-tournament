# v2 prototype: simulation report

Simulations of the redesigned card-game core ("v2", `src/features/cards/domain/v2/`), run for `docs/overhaul/GAME_DESIGN.md`. All games are computer against computer on the real cards of Wiosenna (851 cards) and PDL S2 (117 cards). Every run is seeded; the command under each table reproduces it.

There are two folders:

- `docs/overhaul/sim/v2/` (this report when built without `SIM_OUT`): the **settled rules**, which are `DEFAULT_RULES` in `rules.ts`. These are the numbers `GAME_DESIGN.md` section 9 quotes.
- `docs/overhaul/sim/v2-first/` (built with `SIM_OUT=v2-first`): the road to the settled rules.
  - E1 to E10: the **first candidate rules** (`FIRST_RULES` in `rules.ts`: budget 66 counted on rating strength, Tank blocks ganks, a ganked unit returns to its owner's hand, Smoke frees a move from where the Support stood, every Hard Support adds its own Aura, High Ground helps all units, no Comeback card, no limit per position).
  - E8, E13, E14: one change at a time from the first rules.
  - E15, E16, E17: one change at a time from the rules as they stood at that step. In each, the first row is the rule set of that moment; its name says so. They were run before the later defaults existed, so rerunning the printed command today gives the settled rules in the first row instead.
  - E18 (two files): decks with exactly one to five Mids, with a gank that returns its target to the hand (`return`) and one that puts it out for the round (`out`). Both need `maxPerRole` lifted, as the printed `SIM_RULES` of the `return` run shows; the `out` run was made before the limit of three per position became a default.

How to read the numbers:

- Win rates are over decided games, with a 95% Wilson interval. The interval treats games as independent. Decks come from a limited number of simulated collections (100 pairs per cell, 250 in E2), so the real uncertainty of a deck-strength comparison is a few points wider than the interval shown. Differences of under five points between two rows of a knob table are not evidence.
- The computer players, weakest to strongest: `random`; `greedy` (assumes the rival does nothing this round); `responder` (predicts the rival with `greedy` and answers); `planner` (scores its plans against a sample of plausible rival plans and looks for lethal damage). None of them sees the rival's hand, deck order or plan. `omniscient` and `exploiter` are measuring tools: the first is handed the rival's plan each round, the second knows which program the rival is.
- "New player", "regular" and "veteran" are collections of 10, 20 and 40 packs opened with the site's pack rule. `best` is the strongest legal deck within the budget from a collection.

## Tables

### E1. Shape of a match (wiosenna)

planner vs planner, each with a `best` deck (the default budget) from its own veteran collection (40 packs; 100 collection pairs, each played from both seats), default rules. N = 1000 matches.

| Measure | Value |
|---|---|
| Games | 1000 |
| Rounds per match: mean / median / p10 / p90 | 5.68 / 6.00 / 5.00 / 7.00 |
| Rounds per match: distribution | 4: 1.2%, 5: 42.4%, 6: 44.9%, 7: 9.7%, 8: 1.8% |
| How matches end | ancient: 99.8%, cap-objectives: 0.2% |
| Plays per side per match | 8.79 |
| Moves per side per match (of them free: Smoke / Gates) | 3.20 (0.89 / 0.40) |
| Unused orders per side per match (of orders available) | 1.74 of 12.44 (14.0%) |
| Mids played (gank attempts) per side per match | 1.55 |
| Ganks that returned a unit / blocked by an Offlane / nobody to gank | 1.41 / 0.00 / 0.14 |
| Replaces per side per match | 0.85 |
| Cards left in hand at the end, per side | 1.87 |
| Cards left in deck at the end, per side | 1.34 |
| Share of rounds with at least one objective tied (both sides there, equal strength) | 14.8% |
| Share of rounds with at least one objective nobody controls (tie or empty) | 30.2% |
| Farma growth per side per match | 3.81 |
| Aura / Drużyna / High Ground strength per side per match (summed over units and rounds) | 19.56 / 9.05 / 2.51 |
| Rounds where the planner's plan differs from its greedy plan | 77.1% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e1 --slug wiosenna --seed 1` (1000 games, 185 s).

### E1. Shape of a match (pdl-s2)

planner vs planner, each with a `best` deck (the default budget) from its own veteran collection (40 packs; 100 collection pairs, each played from both seats), default rules. N = 1000 matches.

| Measure | Value |
|---|---|
| Games | 1000 |
| Rounds per match: mean / median / p10 / p90 | 5.62 / 6.00 / 5.00 / 6.00 |
| Rounds per match: distribution | 4: 0.8%, 5: 46.5%, 6: 44.3%, 7: 6.8%, 8: 1.6% |
| How matches end | ancient: 99.2%, cap-objectives: 0.5%, draw: 0.3% |
| Plays per side per match | 8.56 |
| Moves per side per match (of them free: Smoke / Gates) | 3.41 (0.88 / 0.46) |
| Unused orders per side per match (of orders available) | 1.63 of 12.26 (13.3%) |
| Mids played (gank attempts) per side per match | 1.43 |
| Ganks that returned a unit / blocked by an Offlane / nobody to gank | 1.24 / 0.00 / 0.19 |
| Replaces per side per match | 0.88 |
| Cards left in hand at the end, per side | 1.99 |
| Cards left in deck at the end, per side | 1.45 |
| Share of rounds with at least one objective tied (both sides there, equal strength) | 12.1% |
| Share of rounds with at least one objective nobody controls (tie or empty) | 28.0% |
| Farma growth per side per match | 4.46 |
| Aura / Drużyna / High Ground strength per side per match (summed over units and rounds) | 17.52 / 10.21 / 2.41 |
| Rounds where the planner's plan differs from its greedy plan | 78.5% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e1 --slug pdl-s2 --seed 1` (1000 games, 221 s).

### E2. Deck strength: new player (10 packs) vs veteran (40 packs) (wiosenna)

planner vs planner, both `best` decks, each from its own collection (250 collection pairs, each played from both seats). Deck cost is counted as the default rules count it. Target: with the default budget, veteran wins <= 60%.

| Budget | Games | Draws | Veteran wins [95% CI] | Deck cost new / veteran | Deck baseMight new / veteran | Rounds |
|---|---|---|---|---|---|---|
| 60 | 1000 | 4 | 59.1% [56.1–62.1] | 59.5 / 60.0 | 59.7 / 60.6 | 5.64 |
| none | 1000 | 2 | 87.8% [85.6–89.7] | 65.0 / 81.3 | 65.2 / 81.9 | 5.39 |
| 48 | 1000 | 6 | 49.7% [46.6–52.8] | 48.0 / 48.0 | 48.2 / 48.7 | 5.65 |
| 54 | 1000 | 1 | 52.3% [49.2–55.3] | 53.9 / 54.0 | 54.1 / 54.7 | 5.64 |
| 66 | 1000 | 2 | 68.2% [65.3–71.1] | 63.2 / 66.0 | 63.4 / 66.7 | 5.70 |
| 72 | 1000 | 1 | 82.4% [79.9–84.6] | 64.3 / 72.0 | 64.5 / 72.7 | 5.52 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e2 --slug wiosenna --seed 1` (6000 games, 803 s).

### E2. Deck strength: new player (10 packs) vs veteran (40 packs) (pdl-s2)

planner vs planner, both `best` decks, each from its own collection (250 collection pairs, each played from both seats). Deck cost is counted as the default rules count it. Target: with the default budget, veteran wins <= 60%.

| Budget | Games | Draws | Veteran wins [95% CI] | Deck cost new / veteran | Deck baseMight new / veteran | Rounds |
|---|---|---|---|---|---|---|
| 60 | 1000 | 2 | 65.8% [62.8–68.7] | 60.0 / 60.0 | 60.8 / 62.6 | 5.60 |
| none | 1000 | 2 | 84.2% [81.8–86.3] | 86.8 / 96.6 | 87.6 / 99.2 | 5.55 |
| 48 | 1000 | 1 | 65.0% [62.0–67.9] | 48.0 / 48.0 | 48.8 / 50.6 | 5.60 |
| 54 | 1000 | 1 | 65.8% [62.8–68.6] | 54.0 / 54.0 | 54.8 / 56.6 | 5.56 |
| 66 | 1000 | 3 | 61.5% [58.4–64.5] | 66.0 / 66.0 | 66.8 / 68.6 | 5.62 |
| 72 | 1000 | 0 | 60.2% [57.1–63.2] | 72.0 / 72.0 | 72.8 / 74.6 | 5.58 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e2 --slug pdl-s2 --seed 1` (6000 games, 1309 s).

### E3a. Skill ladder: win rate of the row player against the column player (wiosenna)

Both sides play the same `best` deck (the default budget) from one regular collection (20 packs) per pair; 1000 games per pair, both seats. Cells with a 95% CI are measured directly; the mirrored cells are 1 minus them. Targets: each step up >= 60%; planner vs greedy >= 70%.

| Row vs column | random | greedy | responder | planner | planner-mixed |
|---|---|---|---|---|---|
| random | — | 6.4% (N=1000) | 6.4% (N=999) | 5.5% (N=1000) | 6.8% (N=999) |
| greedy | 93.6% [91.9–95.0] | — | 22.3% (N=994) | 21.7% (N=997) | 23.5% (N=992) |
| responder | 93.6% [91.9–95.0] | 77.7% [75.0–80.1] | — | 44.3% (N=994) | 47.5% (N=993) |
| planner | 94.5% [92.9–95.8] | 78.3% [75.7–80.8] | 55.7% [52.6–58.8] | — | 55.8% (N=994) |
| planner-mixed | 93.2% [91.5–94.6] | 76.5% [73.8–79.0] | 52.5% [49.4–55.6] | 44.2% [41.1–47.3] | — |

### E3b. Skill against collection (wiosenna)

planner with a new player's `best` deck (10 packs) vs greedy with a veteran's `best` deck (40 packs), the default budget, N = 1000.

| Matchup | Planner (new player) wins [95% CI] | Draws |
|---|---|---|
| planner/new vs greedy/veteran | 67.2% [64.2–70.0] | 3 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e3 --slug wiosenna --seed 1` (11000 games, 420 s).

### E4. Comebacks (wiosenna)

planner vs planner with the same `best` deck (one veteran collection per pair), N = 1000. Targets: P(win | behind after round 3) >= 25%; winner never trailed <= 55%.

| Measure | Value |
|---|---|
| P(win \| behind on HP after round 2) (matches still going, HP not equal) | 41.2% [37.8–44.7] (N=791) |
| P(win \| behind on HP after round 3) (matches still going, HP not equal) | 35.1% [32.0–38.4] (N=845) |
| P(win \| behind on HP after round 4) (matches still going, HP not equal) | 28.7% [25.8–31.8] (N=867) |
| Lead changes per match (sign changes of the HP difference, equal HP skipped) | 0.70 |
| Winner never trailed on HP after any round | 45.6% [42.5–48.7] |
| Final HP difference: mean / median | 5.13 / 5.00 |
| Winner's remaining HP (count of matches) | 0: 53, 1: 119, 2: 138, 3: 168, 4: 145, 5: 99, 6: 76, 7: 45, 8: 41, 9: 25, 10: 4, 11: 3, -12: 1, -10: 2, -5: 2, -4: 2, -3: 4, -2: 21, -1: 45 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e4 --slug wiosenna --seed 1` (1000 games, 99 s).

### E5a/b. Value of reading the rival (wiosenna)

Same `best` deck for both sides (one veteran collection per pair, the default budget), both seats. omniscient is handed the rival's actual plan each round; exploiter repeats the deterministic planner's reasoning on 3 guessed planner hands and answers the 3 predicted plans. planner vs greedy repeated here for comparison.

| Row player | Rival | Games | Row player wins [95% CI] | Rounds |
|---|---|---|---|---|
| omniscient | planner | 1000 | 92.0% [90.1–93.5] | 5.22 |
| omniscient | greedy | 1000 | 93.4% [91.7–94.8] | 5.18 |
| planner | greedy | 1000 | 76.5% [73.8–79.0] | 5.60 |
| exploiter | planner | 400 | 64.4% [59.6–69.0] | 5.65 |
| exploiter | planner-mixed | 400 | 68.5% [63.8–72.9] | 5.55 |
| planner | planner-mixed | 1000 | 52.3% [49.2–55.4] | 5.74 |

### E5c. How often reading changes the plan (wiosenna)

E1 matches (planner vs planner, own veteran collections), N = 1000 matches: share of planner decisions whose chosen plan is not the plan greedy would play (the best plan if the rival did nothing).

| Measure | Value |
|---|---|
| Planner plan differs from greedy plan | 77.5% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e5 --slug wiosenna --seed 1` (5800 games, 412 s).

### E6a. Deck archetypes: win rate of the row deck against the column deck (wiosenna)

planner vs planner; both decks built from the same veteran collection (40 packs, 30 collections), the default budget; 300 games per pair, both seats.

| Row vs column | best | topHeavy | flat | teamStack | most Carry | most Mid | most Offlane | most Support | most Hard Supp |
|---|---|---|---|---|---|---|---|---|---|
| best | — | 32.7% | 62.7% | 41.5% | 54.2% | 48.2% | 59.7% | 46.3% | 48.5% |
| topHeavy | 67.3% | — | 76.7% | 55.3% | 65.7% | 58.9% | 66.9% | 66.7% | 72.6% |
| flat | 37.3% | 23.3% | — | 28.4% | 38.1% | 30.3% | 36.2% | 39.3% | 34.9% |
| teamStack | 58.5% | 44.7% | 71.6% | — | 57.3% | 56.2% | 64.5% | 58.9% | 59.9% |
| most Carry | 45.8% | 34.3% | 61.9% | 42.7% | — | 44.1% | 55.3% | 47.8% | 57.2% |
| most Mid | 51.8% | 41.1% | 69.7% | 43.8% | 55.9% | — | 55.0% | 52.5% | 54.4% |
| most Offlane | 40.3% | 33.1% | 63.8% | 35.5% | 44.7% | 45.0% | — | 48.8% | 43.7% |
| most Support | 53.7% | 33.3% | 60.7% | 41.1% | 52.2% | 47.5% | 51.2% | — | 40.8% |
| most Hard Supp | 51.5% | 27.4% | 65.1% | 40.1% | 42.8% | 45.6% | 56.3% | 59.2% | — |

### E6b. Deck archetypes against the field (wiosenna)

Each archetype's wins over all its games against the other eight. Targets: none above 60% or below 40%; best beats no other archetype by more than 60%.

| Archetype | Against the field [95% CI] | Deck cost | Deck baseMight |
|---|---|---|---|
| best | 49.2% [47.2–51.2] | 60.0 | 60.9 |
| topHeavy | 66.2% [64.3–68.1] | 59.9 | 60.7 |
| flat | 33.5% [31.6–35.4] | 60.0 | 60.4 |
| teamStack | 58.9% [56.9–60.9] | 59.4 | 60.3 |
| most Carry | 48.6% [46.6–50.6] | 60.0 | 60.9 |
| most Mid | 53.0% [51.0–55.0] | 60.0 | 60.9 |
| most Offlane | 44.3% [42.4–46.3] | 60.0 | 60.9 |
| most Support | 47.6% [45.6–49.6] | 60.0 | 60.9 |
| most Hard Supp | 48.5% [46.5–50.5] | 60.0 | 60.9 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e6 --slug wiosenna --seed 1 --games 300` (10800 games, 1006 s).

### E7a. Each ability switched off for both sides (wiosenna)

Rounds and comeback rate: planner vs planner with the same `best` veteran deck, 1000 games. Last column: win rate of the deck that leans on that ability (roleSkew of its role; teamStack for Drużyna) against `best` built from the same collection, with the ability on -> off (500 games each).

| Rules | Rounds per match | P(win \| behind after round 3) | Skewed deck vs best: on -> off |
|---|---|---|---|
| everything on | 5.76 | 35.9% [32.7–39.2] | — |
| Farma (Carry) | 5.82 | 34.7% [31.6–38.0] | most Carry: 53.2% [48.8–57.6] -> 49.4% [45.0–53.8] |
| Gank (Mid) | 5.74 | 26.7% [23.9–29.7] | most Mid: 56.5% [52.1–60.7] -> 46.1% [41.8–50.5] |
| Tank (Offlane) | 5.72 | 35.9% [32.7–39.1] | most Offlane: 41.9% [37.6–46.3] -> 47.8% [43.5–52.2] |
| Smoke (Soft Support) | 5.76 | 34.5% [31.3–37.8] | most Support: 49.4% [45.0–53.8] -> 50.7% [46.3–55.1] |
| Aura (Hard Support) | 5.75 | 28.6% [25.6–31.7] | most Hard Supp: 51.6% [47.2–56.0] -> 47.9% [43.5–52.3] |
| Drużyna (teams) | 5.72 | 29.0% [26.0–32.1] | teamStack: 62.9% [58.6–67.0] -> 59.8% [55.4–64.0] |

### E7b. Ability use per side per match, everything on (wiosenna)

Same matches as the first row above (N = 1000).

| Measure | Per side per match |
|---|---|
| Farma growth gained | 3.84 |
| Ganks that returned a unit | 1.37 |
| Ganks blocked by an Offlane (Tank) | 0.00 |
| Smoke free moves | 0.88 |
| Aura strength (summed over units and rounds) | 20.08 |
| Drużyna strength (summed over units and rounds) | 9.24 |
| High Ground strength (summed over units and rounds) | 2.47 |
| Twin Gates free moves | 0.40 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e7 --slug wiosenna --seed 1` (13000 games, 2189 s).

### E9a. Holding an objective in round 2 (wiosenna)

planner vs planner, `best` decks from own veteran collections, N = 2000. Win rate of the side that controlled the objective in round 2 (matches where someone did). Roshan's share of all damage in matches with Roshan: 51.3%.

| Objective | Matches with it | Controlled by someone in round 2 | Controller wins [95% CI] |
|---|---|---|---|
| High Ground | 1014 | 888 | 53.7% [50.4–57.0] |
| Roshan | 985 | 928 | 58.5% [55.3–61.6] |
| Outpost | 987 | 858 | 55.0% [51.7–58.3] |
| Twin Gates | 1023 | 772 | 47.2% [43.7–50.7] |
| Tormentor | 1014 | 791 | 53.0% [49.5–56.4] |
| Lotus Pool | 959 | 873 | 62.8% [59.5–65.9] |

### E9b. By trio of objectives (wiosenna)

Same matches. The game is symmetric, so a trio cannot favour a seat; what can differ is length and how decisive early control is.

| Trio | Matches | Rounds | Side with more objectives in round 2 wins | Roshan share of damage |
|---|---|---|---|---|
| gates + highground + lotus | 107 | 6.15 | 64.6% [53.8–74.1] | — |
| gates + highground + outpost | 103 | 6.17 | 51.8% [41.3–62.1] | — |
| gates + highground + roshan | 103 | 5.30 | 62.3% [49.7–73.4] | 51.4% |
| gates + highground + tormentor | 113 | 6.11 | 60.9% [50.7–70.2] | — |
| gates + lotus + outpost | 93 | 6.05 | 63.4% [52.6–73.0] | — |
| gates + lotus + roshan | 96 | 5.29 | 76.1% [65.0–84.5] | 52.3% |
| gates + lotus + tormentor | 104 | 6.08 | 69.9% [58.6–79.2] | — |
| gates + outpost + roshan | 96 | 5.28 | 46.7% [35.8–57.8] | 51.8% |
| gates + outpost + tormentor | 102 | 6.13 | 67.1% [56.3–76.3] | — |
| gates + roshan + tormentor | 110 | 5.20 | 68.1% [56.6–77.7] | 50.8% |
| highground + lotus + outpost | 99 | 5.99 | 63.4% [52.6–73.0] | — |
| highground + lotus + roshan | 78 | 5.33 | 66.0% [52.6–77.3] | 51.2% |
| highground + lotus + tormentor | 108 | 6.18 | 65.5% [54.8–74.8] | — |
| highground + outpost + roshan | 119 | 5.18 | 65.1% [54.3–74.4] | 50.1% |
| highground + outpost + tormentor | 89 | 6.17 | 55.9% [44.1–67.1] | — |
| highground + roshan + tormentor | 97 | 5.32 | 68.2% [56.2–78.2] | 50.7% |
| lotus + outpost + roshan | 88 | 5.23 | 55.9% [44.1–67.1] | 50.6% |
| lotus + outpost + tormentor | 97 | 6.11 | 72.0% [61.4–80.5] | — |
| lotus + roshan + tormentor | 94 | 5.37 | 66.7% [53.4–77.8] | 52.8% |
| outpost + roshan + tormentor | 104 | 5.27 | 60.6% [48.9–71.1] | 51.5% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e9 --slug wiosenna --seed 1` (2000 games, 339 s).

### E10 (reference, STRENGTH unchanged 1-9 curve 1.3): 2a. Deck strength: rating gap (wiosenna)

Hard vs hard; the stronger deck aimed at 75+gap, the other at 75 (cpuDeck, realised averages shown); a fresh pair every 2 games, first player alternating. Win rate of the stronger deck.

| Aimed gap | Rating weaker vs stronger (realised) | Average strength weaker vs stronger | Decided games | Stalled | Stronger deck wins [95% CI] |
|---|---|---|---|---|---|
| +0 | 74.7 vs 74.5 (gap -0.2) | 4.73 vs 4.71 (gap -0.03) | 1000 | 0 | 49.3% [46.2–52.4] |
| +3 | 74.7 vs 77.3 (gap 2.5) | 4.74 vs 5.12 (gap 0.38) | 1000 | 0 | 57.8% [54.7–60.8] |
| +5 | 74.7 vs 79.2 (gap 4.5) | 4.74 vs 5.40 (gap 0.66) | 1000 | 0 | 64.3% [61.3–67.2] |
| +10 | 74.7 vs 84.0 (gap 9.3) | 4.74 vs 6.15 (gap 1.41) | 1000 | 0 | 78.2% [75.5–80.6] |

### E10 (reference, STRENGTH unchanged 1-9 curve 1.3): 2b. Deck strength: 10-pack collection vs 40-pack collection (wiosenna)

1000 games, hard vs hard, autoDeck(simCollection(cards, 10)) vs autoDeck(simCollection(cards, 40)), fresh collections every 20 games (50 pairs), first player alternating.

| Measure | New player (10 packs) | Veteran (40 packs) |
|---|---|---|
| Deck average rating (TOTW counted +7, as avgOvr) | 73.3 | 83.7 |
| Deck average strength (baseMight) | 4.54 | 6.16 |
| Legal decks (of collections drawn) | 50/50 | 50/50 |
| Wins [95% CI] (decided games; stalled shown below) | 10.0% [8.3–12.0] | 90.0% [88.0–91.7] |
| Decided / stalled games | 1000 / 0 |  |

### E10 (i) STRENGTH min 4, max 8, curve 1: 2a. Deck strength: rating gap (wiosenna)

Hard vs hard; the stronger deck aimed at 75+gap, the other at 75 (cpuDeck, realised averages shown); a fresh pair every 2 games, first player alternating. Win rate of the stronger deck.

| Aimed gap | Rating weaker vs stronger (realised) | Average strength weaker vs stronger | Decided games | Stalled | Stronger deck wins [95% CI] |
|---|---|---|---|---|---|
| +0 | 74.7 vs 74.5 (gap -0.2) | 6.05 vs 6.02 (gap -0.02) | 1000 | 0 | 46.6% [43.5–49.7] |
| +3 | 74.7 vs 77.3 (gap 2.5) | 6.04 vs 6.24 (gap 0.19) | 1000 | 0 | 57.2% [54.1–60.2] |
| +5 | 74.7 vs 79.2 (gap 4.5) | 6.04 vs 6.38 (gap 0.34) | 1000 | 0 | 64.4% [61.4–67.3] |
| +10 | 74.7 vs 84.0 (gap 9.3) | 6.05 vs 6.77 (gap 0.72) | 1000 | 0 | 73.1% [70.3–75.8] |

### E10 (i) STRENGTH min 4, max 8, curve 1: 2b. Deck strength: 10-pack collection vs 40-pack collection (wiosenna)

1000 games, hard vs hard, autoDeck(simCollection(cards, 10)) vs autoDeck(simCollection(cards, 40)), fresh collections every 20 games (50 pairs), first player alternating.

| Measure | New player (10 packs) | Veteran (40 packs) |
|---|---|---|
| Deck average rating (TOTW counted +7, as avgOvr) | 73.4 | 83.2 |
| Deck average strength (baseMight) | 6.10 | 6.89 |
| Legal decks (of collections drawn) | 50/50 | 50/50 |
| Wins [95% CI] (decided games; stalled shown below) | 16.3% [14.1–18.7] | 83.7% [81.3–85.9] |
| Decided / stalled games | 1000 / 0 |  |

### E10 (ii). Today's game with a deck budget (wiosenna)

Today's rules and computer (hard vs hard, first player alternating), decks of 20 cards with 2 per role and sum of cardStrength <= 90, the highest total baseMight within that (exact optimiser); fresh collections every 20 games. 0 games skipped because a collection had no legal deck.

| Measure | New player (10 packs) | Veteran (40 packs) |
|---|---|---|
| Deck cost (sum of cardStrength) | 88.4 | 90.0 |
| Deck total baseMight | 90.9 | 100.8 |
| Wins [95% CI] (decided games) | 29.1% [26.4–32.0] | 70.9% [68.0–73.6] |
| Decided / stalled games | 1000 / 0 |  |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e10 --slug wiosenna --seed 1` (11000 games, 246 s).

### E11a. Team decks next to budget decks (wiosenna)

98 team decks (team x period, 9 periods from seasonPeriods). 18 (18.4%) have fewer than 12 cards; smallest 4. Numbers are min / Q1 / median / Q3 / max.

| Decks | Total baseMight | Total cost | Cards |
|---|---|---|---|
| Team decks | 10 / 36 / 51 / 60 / 83 | 9 / 37 / 53 / 61 / 84 | 4 / 12 / 12 / 12 / 12 |
| best default-budget deck, new (10 packs, 50 collections) | 53 / 59 / 60 / 60 / 62 | 53 / 60 / 63 / 64 / 65 | 12 |
| best default-budget deck, regular (20 packs, 50 collections) | 59 / 60 / 60 / 61 / 62 | 61 / 63 / 64 / 65 / 65 | 12 |
| best default-budget deck, veteran (40 packs, 50 collections) | 60 / 60 / 61 / 61 / 62 | 61 / 63 / 64 / 64 / 65 | 12 |

### E11b. Human proxy vs team decks played by the greedy computer (wiosenna)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 10-32) | band 2 (might 32-48) | band 3 (might 49-53) | band 4 (might 53-61) | band 5 (might 63-83) |
|---|---|---|---|---|---|
| greedy, new | 91.7% [88.0–94.3] | 61.9% [56.2–67.2] | 35.8% [30.6–41.4] | 32.8% [27.7–38.3] | 9.7% [6.8–13.5] |
| greedy, regular | 93.7% [90.3–95.9] | 68.3% [62.9–73.3] | 42.1% [36.6–47.8] | 31.0% [26.0–36.4] | 11.7% [8.5–15.8] |
| greedy, veteran | 92.3% [88.7–94.8] | 72.3% [67.0–77.1] | 39.0% [33.7–44.6] | 31.8% [26.8–37.3] | 16.7% [12.9–21.3] |
| planner, new | 99.3% [97.6–99.8] | 88.3% [84.2–91.5] | 63.5% [57.9–68.8] | 45.7% [40.1–51.3] | 18.3% [14.4–23.1] |
| planner, regular | 100.0% [98.7–100.0] | 89.0% [84.9–92.0] | 68.2% [62.7–73.2] | 52.2% [46.5–57.8] | 19.7% [15.6–24.5] |
| planner, veteran | 99.7% [98.1–99.9] | 93.0% [89.5–95.4] | 74.3% [69.1–78.9] | 50.0% [44.4–55.6] | 24.7% [20.1–29.8] |

### E11b. Human proxy vs team decks played by the responder computer (wiosenna)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 10-32) | band 2 (might 32-48) | band 3 (might 49-53) | band 4 (might 53-61) | band 5 (might 63-83) |
|---|---|---|---|---|---|
| greedy, new | 80.9% [76.1–85.0] | 42.1% [36.7–47.8] | 14.0% [10.5–18.4] | 7.7% [5.2–11.3] | 0.7% [0.2–2.4] |
| greedy, regular | 83.3% [78.7–87.1] | 47.2% [41.6–52.8] | 18.3% [14.4–23.1] | 10.7% [7.7–14.7] | 1.0% [0.3–2.9] |
| greedy, veteran | 84.0% [79.4–87.7] | 50.5% [44.9–56.1] | 17.7% [13.8–22.5] | 10.7% [7.7–14.7] | 1.0% [0.3–2.9] |
| planner, new | 94.3% [91.1–96.4] | 71.7% [66.3–76.5] | 40.0% [34.6–45.6] | 22.7% [18.3–27.7] | 4.0% [2.3–6.9] |
| planner, regular | 96.7% [94.0–98.2] | 75.7% [70.5–80.2] | 46.3% [40.8–52.0] | 25.3% [20.7–30.5] | 4.0% [2.3–6.9] |
| planner, veteran | 94.0% [90.7–96.2] | 77.5% [72.4–81.9] | 48.0% [42.4–53.6] | 28.1% [23.3–33.4] | 8.3% [5.7–12.0] |

### E11b. Human proxy vs team decks played by the planner computer (wiosenna)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 10-32) | band 2 (might 32-48) | band 3 (might 49-53) | band 4 (might 53-61) | band 5 (might 63-83) |
|---|---|---|---|---|---|
| greedy, new | 83.9% [79.4–87.7] | 45.0% [39.5–50.7] | 8.7% [6.0–12.4] | 7.0% [4.6–10.5] | 1.0% [0.3–2.9] |
| greedy, regular | 85.0% [80.5–88.6] | 48.5% [42.9–54.1] | 15.4% [11.8–20.0] | 8.3% [5.7–12.0] | 1.7% [0.7–3.8] |
| greedy, veteran | 81.3% [76.5–85.3] | 51.8% [46.2–57.4] | 19.7% [15.6–24.5] | 12.3% [9.1–16.5] | 0.7% [0.2–2.4] |
| planner, new | 92.7% [89.1–95.1] | 63.3% [57.7–68.6] | 32.7% [27.6–38.2] | 18.3% [14.4–23.1] | 2.3% [1.1–4.7] |
| planner, regular | 93.0% [89.5–95.4] | 72.7% [67.4–77.4] | 39.3% [33.9–44.9] | 24.3% [19.8–29.5] | 5.0% [3.1–8.1] |
| planner, veteran | 97.0% [94.4–98.4] | 74.7% [69.5–79.4] | 45.3% [39.7–51.0] | 29.4% [24.6–34.8] | 7.7% [5.2–11.2] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug wiosenna --seed 1` (27000 games, 823 s).

### E11a. Team decks next to budget decks (pdl-s2)

22 team decks (team x period, 2 periods from seasonPeriods). 22 (100.0%) have fewer than 12 cards; smallest 4. Numbers are min / Q1 / median / Q3 / max.

| Decks | Total baseMight | Total cost | Cards |
|---|---|---|---|
| Team decks | 8 / 18 / 28 / 42 / 67 | 8 / 19 / 28 / 43 / 67 | 4 / 5 / 5 / 10 / 10 |
| best default-budget deck, new (10 packs, 50 collections) | 60 / 60 / 61 / 61 / 64 | 62 / 64 / 65 / 65 / 65 | 12 |
| best default-budget deck, regular (20 packs, 50 collections) | 60 / 61 / 61 / 62 / 64 | 61 / 63 / 64 / 65 / 65 | 12 |
| best default-budget deck, veteran (40 packs, 50 collections) | 60 / 62 / 63 / 63 / 65 | 62 / 63 / 64 / 65 / 65 | 12 |

### E11b. Human proxy vs team decks played by the greedy computer (pdl-s2)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 8-16) | band 2 (might 18-19) | band 3 (might 20-31) | band 4 (might 31-44) | band 5 (might 48-67) |
|---|---|---|---|---|---|
| greedy, new | 99.7% [98.1–99.9] | 98.0% [95.7–99.1] | 83.9% [79.4–87.7] | 58.1% [52.4–63.5] | 32.7% [27.6–38.2] |
| greedy, regular | 99.3% [97.6–99.8] | 98.0% [95.7–99.1] | 91.3% [87.6–94.0] | 64.2% [58.6–69.4] | 34.3% [29.2–39.9] |
| greedy, veteran | 100.0% [98.7–100.0] | 98.0% [95.7–99.1] | 88.7% [84.6–91.8] | 69.3% [63.9–74.3] | 37.5% [32.2–43.1] |
| planner, new | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 99.3% [97.6–99.8] | 90.3% [86.4–93.2] | 52.0% [46.4–57.6] |
| planner, regular | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 92.3% [88.7–94.8] | 54.7% [49.0–60.2] |
| planner, veteran | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 93.0% [89.5–95.4] | 60.7% [55.1–66.1] |

### E11b. Human proxy vs team decks played by the responder computer (pdl-s2)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 8-16) | band 2 (might 18-19) | band 3 (might 20-31) | band 4 (might 31-44) | band 5 (might 48-67) |
|---|---|---|---|---|---|
| greedy, new | 99.3% [97.6–99.8] | 96.0% [93.1–97.7] | 62.3% [56.7–67.6] | 29.5% [24.6–34.9] | 13.0% [9.7–17.3] |
| greedy, regular | 98.0% [95.7–99.1] | 95.3% [92.3–97.2] | 65.7% [60.1–70.8] | 34.7% [29.5–40.2] | 14.4% [10.9–18.8] |
| greedy, veteran | 99.7% [98.1–99.9] | 97.7% [95.3–98.9] | 74.7% [69.5–79.3] | 37.5% [32.2–43.1] | 18.7% [14.7–23.5] |
| planner, new | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 89.7% [85.7–92.6] | 67.0% [61.5–72.1] | 26.8% [22.1–32.1] |
| planner, regular | 100.0% [98.7–100.0] | 98.7% [96.6–99.5] | 90.7% [86.8–93.5] | 67.9% [62.4–72.9] | 32.3% [27.3–37.8] |
| planner, veteran | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 93.0% [89.5–95.4] | 74.3% [69.1–78.9] | 39.3% [34.0–45.0] |

### E11b. Human proxy vs team decks played by the planner computer (pdl-s2)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 8-16) | band 2 (might 18-19) | band 3 (might 20-31) | band 4 (might 31-44) | band 5 (might 48-67) |
|---|---|---|---|---|---|
| greedy, new | 99.3% [97.6–99.8] | 96.7% [94.0–98.2] | 66.3% [60.8–71.4] | 31.0% [26.0–36.4] | 10.4% [7.4–14.3] |
| greedy, regular | 99.7% [98.1–99.9] | 95.3% [92.3–97.2] | 69.3% [63.9–74.3] | 33.1% [28.0–38.6] | 11.0% [7.9–15.0] |
| greedy, veteran | 99.3% [97.6–99.8] | 96.0% [93.1–97.7] | 71.0% [65.6–75.8] | 39.0% [33.7–44.6] | 18.7% [14.7–23.5] |
| planner, new | 100.0% [98.7–100.0] | 99.3% [97.6–99.8] | 84.0% [79.4–87.7] | 56.7% [51.0–62.2] | 24.7% [20.1–29.8] |
| planner, regular | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 89.3% [85.3–92.3] | 64.9% [59.3–70.1] | 26.6% [21.9–31.9] |
| planner, veteran | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 91.0% [87.2–93.7] | 69.7% [64.2–74.6] | 34.6% [29.4–40.1] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug pdl-s2 --seed 1` (27000 games, 657 s).

### E12. Duplicates over a season of packs (wiosenna)

1000 simulated players, 9 rounds (seasonPeriods). 10 welcome packs after round 1, then 3 or 5 packs after every round; the pack pool after round r is each team's last series up to r (packPool, openPack as on the site, TOTW chance 25%). Cells: mean (p10 / median / p90). A duplicate is a card whose exact id the player already had; "players" counts player-and-team pairs (deckKey); a complete team has all five roles held.

| Packs | Packs opened | Cards received | Exact duplicates | Duplicates by tier (mean) | Distinct players | Complete teams |
|---|---|---|---|---|---|---|
| 3 per round | 37.0 (37 / 37 / 37) | 185.0 (185 / 185 / 185) | 67.7 (63 / 68 / 72) | wood 24.5, bronze 21.8, silver 10.3, gold 4.6, elite 3.0, totw 3.6 | 76.7 (72 / 77 / 81) | 5.0 (3 / 5 / 7) |
| 5 per round | 55.0 (55 / 55 / 55) | 275.0 (275 / 275 / 275) | 105.1 (98 / 105 / 112) | wood 39.5, bronze 32.9, silver 16.8, gold 7.3, elite 4.0, totw 4.6 | 94.3 (90 / 94 / 99) | 9.7 (7 / 10 / 12) |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e12 --slug wiosenna --seed 1` (0 games, 16 s).

### E12. Duplicates over a season of packs (pdl-s2)

1000 simulated players, 2 rounds (seasonPeriods). 10 welcome packs after round 1, then 3 or 5 packs after every round; the pack pool after round r is each team's last series up to r (packPool, openPack as on the site, TOTW chance 25%). Cells: mean (p10 / median / p90). A duplicate is a card whose exact id the player already had; "players" counts player-and-team pairs (deckKey); a complete team has all five roles held.

| Packs | Packs opened | Cards received | Exact duplicates | Duplicates by tier (mean) | Distinct players | Complete teams |
|---|---|---|---|---|---|---|
| 3 per round | 16.0 (16 / 16 / 16) | 80.0 (80 / 80 / 80) | 27.2 (24 / 27 / 31) | wood 7.4, bronze 8.8, silver 7.3, gold 3.5, elite 0.1, totw 0.1 | 45.0 (42 / 45 / 48) | 2.6 (1 / 3 / 4) |
| 5 per round | 20.0 (20 / 20 / 20) | 100.0 (100 / 100 / 100) | 37.7 (34 / 38 / 41) | wood 10.3, bronze 11.8, silver 10.2, gold 5.0, elite 0.2, totw 0.2 | 49.6 (46 / 50 / 53) | 4.0 (2 / 4 / 6) |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e12 --slug pdl-s2 --seed 1` (0 games, 0 s).
