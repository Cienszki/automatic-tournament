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

planner vs planner, each with a `best` deck (budget 66) from its own veteran collection (40 packs; 100 collection pairs, each played from both seats), default rules. N = 1000 matches.

| Measure | Value |
|---|---|
| Games | 1000 |
| Rounds per match: mean / median / p10 / p90 | 5.38 / 5.00 / 5.00 / 6.00 |
| Rounds per match: distribution | 4: 5.9%, 5: 54.9%, 6: 35.0%, 7: 3.8%, 8: 0.4% |
| How matches end | ancient: 99.8%, cap-objectives: 0.1%, draw: 0.1% |
| Plays per side per match | 7.81 |
| Moves per side per match (of them free: Smoke / Gates) | 2.73 (0.27 / 0.38) |
| Unused orders per side per match (of orders available) | 1.88 of 11.77 (16.0%) |
| Mids played (gank attempts) per side per match | 0.90 |
| Ganks that returned a unit / blocked by an Offlane / nobody to gank | 0.34 / 0.45 / 0.11 |
| Replaces per side per match | 0.30 |
| Cards left in hand at the end, per side | 2.25 |
| Cards left in deck at the end, per side | 2.28 |
| Share of rounds with at least one objective tied (both sides there, equal strength) | 12.1% |
| Share of rounds with at least one objective nobody controls (tie or empty) | 29.2% |
| Farma growth per side per match | 5.64 |
| Aura / Drużyna / High Ground strength per side per match (summed over units and rounds) | 3.78 / 6.93 / 6.13 |
| Rounds where the planner's plan differs from its greedy plan | 77.7% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e1 --slug wiosenna --seed 1` (1000 games, 46 s).

### E2. Deck strength: new player (10 packs) vs veteran (40 packs) (wiosenna)

planner vs planner, both `best` decks, each from its own collection (100 collection pairs, each played from both seats). Target: with budget 66, veteran wins <= 60%.

| Budget | Games | Draws | Veteran wins [95% CI] | Deck cost new / veteran | Deck baseMight new / veteran | Rounds |
|---|---|---|---|---|---|---|
| 66 | 1000 | 0 | 67.1% [64.1–69.9] | 64.0 / 66.0 | 64.8 / 69.9 | 5.38 |
| none | 1000 | 1 | 88.6% [86.5–90.4] | 66.1 / 83.0 | 65.2 / 82.0 | 5.19 |
| 54 | 1000 | 1 | 65.0% [62.0–67.9] | 54.0 / 54.0 | 57.3 / 59.6 | 5.33 |
| 60 | 1000 | 0 | 68.7% [65.8–71.5] | 59.4 / 60.0 | 61.4 / 64.8 | 5.35 |
| 72 | 1000 | 1 | 76.3% [73.5–78.8] | 65.7 / 72.0 | 65.4 / 75.3 | 5.29 |
| 78 | 1000 | 1 | 78.7% [76.0–81.1] | 67.0 / 77.9 | 67.0 / 79.2 | 5.28 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e2 --slug wiosenna --seed 1` (6000 games, 216 s).

### E3a. Skill ladder: win rate of the row player against the column player (wiosenna)

Both sides play the same `best` deck (budget 66) from one regular collection (20 packs) per pair; 1000 games per pair, both seats. Cells with a 95% CI are measured directly; the mirrored cells are 1 minus them. Targets: each step up >= 60%; planner vs greedy >= 70%.

| Row vs column | random | greedy | responder | planner | planner-mixed |
|---|---|---|---|---|---|
| random | — | 7.3% (N=999) | 6.0% (N=1000) | 5.5% (N=999) | 7.0% (N=1000) |
| greedy | 92.7% [90.9–94.1] | — | 13.5% (N=999) | 12.6% (N=1000) | 12.5% (N=999) |
| responder | 94.0% [92.4–95.3] | 86.5% [84.2–88.5] | — | 41.3% (N=999) | 45.2% (N=998) |
| planner | 94.5% [92.9–95.7] | 87.4% [85.2–89.3] | 58.7% [55.6–61.7] | — | 54.6% (N=999) |
| planner-mixed | 93.0% [91.2–94.4] | 87.5% [85.3–89.4] | 54.8% [51.7–57.9] | 45.4% [42.4–48.5] | — |

### E3b. Skill against collection (wiosenna)

planner with a new player's `best` deck (10 packs) vs greedy with a veteran's `best` deck (40 packs), budget 66, N = 1000.

| Matchup | Planner (new player) wins [95% CI] | Draws |
|---|---|---|
| planner/new vs greedy/veteran | 69.0% [66.0–71.8] | 1 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e3 --slug wiosenna --seed 1` (11000 games, 206 s).

### E4. Comebacks (wiosenna)

planner vs planner with the same `best` deck (one veteran collection per pair), N = 1000. Targets: P(win | behind after round 3) >= 25%; winner never trailed <= 55%.

| Measure | Value |
|---|---|
| P(win \| behind on HP after round 2) (matches still going, HP not equal) | 24.6% [21.9–27.5] (N=886) |
| P(win \| behind on HP after round 3) (matches still going, HP not equal) | 17.6% [15.3–20.3] (N=907) |
| P(win \| behind on HP after round 4) (matches still going, HP not equal) | 12.9% [10.8–15.3] (N=856) |
| Lead changes per match (sign changes of the HP difference, equal HP skipped) | 0.39 |
| Winner never trailed on HP after any round | 66.0% [63.0–68.9] |
| Final HP difference: mean / median | 6.86 / 7.00 |
| Winner's remaining HP (count of matches) | 0: 17, 1: 68, 2: 96, 3: 128, 4: 138, 5: 90, 6: 91, 7: 80, 8: 84, 9: 74, 10: 55, 11: 23, 12: 10, -11: 1, -6: 1, -5: 1, -4: 2, -3: 4, -2: 7, -1: 27 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e4 --slug wiosenna --seed 1` (1000 games, 33 s).

### E5a/b. Value of reading the rival (wiosenna)

Same `best` deck for both sides (one veteran collection per pair, budget 66), both seats. omniscient is handed the rival's actual plan each round; exploiter repeats the deterministic planner's reasoning on 3 guessed planner hands and answers the 3 predicted plans. planner vs greedy repeated here for comparison.

| Row player | Rival | Games | Row player wins [95% CI] | Rounds |
|---|---|---|---|---|
| omniscient | planner | 1000 | 94.6% [93.0–95.8] | 4.97 |
| omniscient | greedy | 1000 | 98.6% [97.7–99.2] | 4.76 |
| planner | greedy | 1000 | 86.0% [83.7–88.0] | 5.21 |
| exploiter | planner | 400 | 74.8% [70.3–78.8] | 5.35 |
| exploiter | planner-mixed | 400 | 73.8% [69.2–77.8] | 5.31 |
| planner | planner-mixed | 1000 | 54.5% [51.4–57.5] | 5.42 |

### E5c. How often reading changes the plan (wiosenna)

E1 matches (planner vs planner, own veteran collections), N = 1000 matches: share of planner decisions whose chosen plan is not the plan greedy would play (the best plan if the rival did nothing).

| Measure | Value |
|---|---|
| Planner plan differs from greedy plan | 77.7% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e5 --slug wiosenna --seed 1` (5800 games, 133 s).

### E6a. Deck archetypes: win rate of the row deck against the column deck (wiosenna)

planner vs planner; both decks built from the same veteran collection (40 packs, 100 collections), budget 66; 500 games per pair, both seats.

| Row vs column | best | topHeavy | flat | teamStack | skew Carry | skew Mid | skew Offlane | skew SS | skew HS |
|---|---|---|---|---|---|---|---|---|---|
| best | — | 96.6% | 89.8% | 51.2% | 66.3% | 61.5% | 49.5% | 71.1% | 46.3% |
| topHeavy | 3.4% | — | 13.4% | 3.0% | 4.4% | 5.8% | 2.4% | 9.4% | 4.6% |
| flat | 10.2% | 86.6% | — | 13.3% | 32.9% | 19.8% | 12.6% | 47.4% | 18.0% |
| teamStack | 48.8% | 97.0% | 86.7% | — | 71.8% | 65.0% | 48.0% | 76.8% | 61.6% |
| skew Carry | 33.7% | 95.6% | 67.1% | 28.2% | — | 19.6% | 31.7% | 61.4% | 34.6% |
| skew Mid | 38.5% | 94.2% | 80.2% | 35.0% | 80.4% | — | 34.6% | 83.2% | 79.4% |
| skew Offlane | 50.5% | 97.6% | 87.4% | 52.0% | 68.3% | 65.4% | — | 77.2% | 49.1% |
| skew SS | 28.9% | 90.6% | 52.6% | 23.2% | 38.6% | 16.8% | 22.8% | — | 26.8% |
| skew HS | 53.7% | 95.4% | 82.0% | 38.4% | 65.4% | 20.6% | 50.9% | 73.2% | — |

### E6b. Deck archetypes against the field (wiosenna)

Each archetype's wins over all its games against the other eight. Targets: none above 60% or below 40%; best beats no other archetype by more than 60%.

| Archetype | Against the field [95% CI] | Deck cost | Deck baseMight |
|---|---|---|---|
| best | 66.6% [65.1–68.0] | 66.0 | 70.0 |
| topHeavy | 5.8% [5.1–6.6] | 30.4 | 33.7 |
| flat | 30.1% [28.7–31.5] | 65.0 | 64.7 |
| teamStack | 69.5% [68.0–70.9] | 63.8 | 66.1 |
| skew Carry | 46.5% [44.9–48.0] | 65.7 | 65.6 |
| skew Mid | 65.7% [64.2–67.1] | 65.7 | 65.3 |
| skew Offlane | 68.5% [67.0–69.9] | 65.5 | 72.6 |
| skew SS | 37.5% [36.0–39.0] | 64.9 | 58.6 |
| skew HS | 60.0% [58.4–61.5] | 65.5 | 59.3 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e6 --slug wiosenna --seed 1` (18000 games, 1714 s).

### E7a. Each ability switched off for both sides (wiosenna)

Rounds and comeback rate: planner vs planner with the same `best` veteran deck, 1000 games. Last column: win rate of the deck that leans on that ability (roleSkew of its role; teamStack for Drużyna) against `best` built from the same collection, with the ability on -> off (500 games each).

| Rules | Rounds per match | P(win \| behind after round 3) | Skewed deck vs best: on -> off |
|---|---|---|---|
| everything on | 5.43 | 18.0% [15.6–20.7] | — |
| Farma (Carry) | 5.49 | 22.4% [19.7–25.2] | skew Carry: 37.9% [33.7–42.2] -> 27.6% [23.9–31.7] |
| Gank (Mid) | 5.39 | 16.2% [14.0–18.8] | skew Mid: 38.2% [34.0–42.5] -> 31.0% [27.1–35.2] |
| Tank (Offlane) | 5.45 | 23.7% [21.0–26.6] | skew Offlane: 47.7% [43.3–52.1] -> 47.8% [43.5–52.2] |
| Smoke (Soft Support) | 5.44 | 17.0% [14.7–19.7] | skew SS: 25.6% [22.0–29.6] -> 20.0% [16.7–23.7] |
| Aura (Hard Support) | 5.44 | 17.2% [14.9–19.8] | skew HS: 51.7% [47.3–56.1] -> 17.9% [14.8–21.5] |
| Drużyna (teams) | 5.40 | 18.4% [16.0–21.0] | teamStack: 50.8% [46.4–55.2] -> 46.1% [41.8–50.5] |

### E7b. Ability use per side per match, everything on (wiosenna)

Same matches as the first row above (N = 1000).

| Measure | Per side per match |
|---|---|
| Farma growth gained | 5.71 |
| Ganks that returned a unit | 0.31 |
| Ganks blocked by an Offlane (Tank) | 0.45 |
| Smoke free moves | 0.31 |
| Aura strength (summed over units and rounds) | 4.27 |
| Drużyna strength (summed over units and rounds) | 6.87 |
| High Ground strength (summed over units and rounds) | 6.26 |
| Twin Gates free moves | 0.37 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e7 --slug wiosenna --seed 1` (13000 games, 800 s).

### E8. Rule knobs, one at a time (wiosenna)

Each row changes one rule from the defaults. Rounds, comeback, unused orders and planner != greedy: planner vs planner with the same `best` veteran deck. Veteran win rate: the E2 cell (veteran 40 packs vs new player 10 packs, own collections). 1000 games per cell.

| Change | Rounds per match | P(win \| behind after round 3) | Veteran wins vs new player | Unused orders per side per match | Planner != greedy |
|---|---|---|---|---|---|
| defaults | 5.41 | 18.7% [16.3–21.4] | 74.0% [71.2–76.7] | 1.85 | 77.6% |
| hp 10 | 4.88 | 15.6% [13.4–18.1] | 71.8% [68.9–74.5] | 1.64 | 76.6% |
| hp 15 | 6.11 | 21.2% [18.7–24.0] | 75.0% [72.2–77.6] | 2.25 | 76.0% |
| orders 3 | 5.42 | 23.7% [21.0–26.6] | 71.8% [68.9–74.5] | 4.23 | 78.9% |
| draw 2 | 5.52 | 19.1% [16.7–21.8] | 79.3% [76.7–81.7] | 2.22 | 72.5% |
| capacity 4 | 5.45 | 19.1% [16.7–21.9] | 67.6% [64.6–70.4] | 1.58 | 81.4% |
| replace off | 5.41 | 18.7% [16.3–21.3] | 70.7% [67.8–73.4] | 1.90 | 76.2% |
| gank weakest | 5.39 | 16.3% [14.0–18.8] | 72.2% [69.3–74.9] | 1.87 | 77.5% |
| gank off | 5.37 | 16.1% [13.9–18.7] | 70.9% [68.0–73.6] | 2.00 | 73.0% |
| lateFrom Infinity | 6.31 | 20.0% [17.5–22.7] | 76.4% [73.7–78.9] | 2.63 | 73.2% |
| roshanValue 1 | 5.81 | 18.1% [15.7–20.8] | 72.1% [69.3–74.8] | 1.95 | 78.2% |
| deckSize 15 (budget 82.5) | 5.42 | 19.0% [16.5–21.7] | 75.2% [72.4–77.7] | 1.82 | 78.4% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e8 --slug wiosenna --seed 1` (24000 games, 1066 s).

### E9a. Holding an objective in round 2 (wiosenna)

planner vs planner, `best` decks from own veteran collections, N = 2000. Win rate of the side that controlled the objective in round 2 (matches where someone did). Roshan's share of all damage in matches with Roshan: 51.9%.

| Objective | Matches with it | Controlled by someone in round 2 | Controller wins [95% CI] |
|---|---|---|---|
| High Ground | 1014 | 945 | 70.2% [67.2–73.0] |
| Roshan | 985 | 902 | 70.1% [67.0–73.0] |
| Outpost | 986 | 855 | 57.4% [54.1–60.7] |
| Twin Gates | 1023 | 740 | 47.6% [44.0–51.2] |
| Tormentor | 1014 | 829 | 47.9% [44.5–51.3] |
| Lotus Pool | 960 | 874 | 67.6% [64.4–70.6] |

### E9b. By trio of objectives (wiosenna)

Same matches. The game is symmetric, so a trio cannot favour a seat; what can differ is length and how decisive early control is.

| Trio | Matches | Rounds | Side with more objectives in round 2 wins | Roshan share of damage |
|---|---|---|---|---|
| gates + highground + lotus | 107 | 5.74 | 84.4% [74.7–90.9] | — |
| gates + highground + outpost | 103 | 5.76 | 80.2% [70.9–87.1] | — |
| gates + highground + roshan | 103 | 5.07 | 84.5% [74.3–91.1] | 52.0% |
| gates + highground + tormentor | 113 | 5.78 | 62.8% [52.2–72.3] | — |
| gates + lotus + outpost | 93 | 5.72 | 78.2% [67.8–85.9] | — |
| gates + lotus + roshan | 96 | 5.13 | 70.9% [57.9–81.2] | 53.0% |
| gates + lotus + tormentor | 104 | 5.79 | 79.7% [69.6–87.1] | — |
| gates + outpost + roshan | 96 | 5.00 | 65.5% [54.8–74.8] | 51.7% |
| gates + outpost + tormentor | 102 | 5.80 | 73.6% [63.7–81.6] | — |
| gates + roshan + tormentor | 110 | 5.04 | 76.3% [65.6–84.5] | 52.2% |
| highground + lotus + outpost | 99 | 5.62 | 81.0% [71.0–88.1] | — |
| highground + lotus + roshan | 78 | 5.00 | 80.3% [68.7–88.4] | 51.4% |
| highground + lotus + tormentor | 108 | 5.73 | 81.3% [72.1–88.0] | — |
| highground + outpost + roshan | 119 | 4.91 | 73.1% [63.3–81.1] | 51.6% |
| highground + outpost + tormentor | 89 | 5.67 | 74.6% [63.4–83.3] | — |
| highground + roshan + tormentor | 97 | 4.93 | 91.8% [83.2–96.2] | 51.8% |
| lotus + outpost + roshan | 88 | 4.99 | 78.3% [67.2–86.4] | 51.0% |
| lotus + outpost + tormentor | 97 | 5.82 | 74.7% [64.1–83.0] | — |
| lotus + roshan + tormentor | 94 | 4.95 | 85.0% [73.9–91.9] | 52.9% |
| outpost + roshan + tormentor | 104 | 5.07 | 79.0% [68.9–86.5] | 51.2% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e9 --slug wiosenna --seed 1` (2000 games, 118 s).

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

Today's rules and computer (hard vs hard, first player alternating), decks of 20 cards with 2 per role and sum of cardStrength <= 110, the highest total baseMight within that (exact optimiser); fresh collections every 20 games. 0 games skipped because a collection had no legal deck.

| Measure | New player (10 packs) | Veteran (40 packs) |
|---|---|---|
| Deck cost (sum of cardStrength) | 93.1 | 110.0 |
| Deck total baseMight | 93.3 | 116.6 |
| Wins [95% CI] (decided games) | 14.7% [12.6–17.0] | 85.3% [83.0–87.4] |
| Decided / stalled games | 1000 / 0 |  |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e10 --slug wiosenna --seed 1` (11000 games, 493 s).

### E13. Second round of knobs: card cost and catch-up (wiosenna)

Each row changes one rule from the defaults. Rounds, comeback, unused orders and planner != greedy: planner vs planner with the same `best` veteran deck. Veteran win rate: the E2 cell (veteran 40 packs vs new player 10 packs, own collections). 600 games per cell.

| Change | Rounds per match | P(win \| behind after round 3) | Veteran wins vs new player | Unused orders per side per match | Planner != greedy |
|---|---|---|---|---|---|
| defaults | 5.41 | 20.2% [17.1–23.8] | 74.1% [70.5–77.5] | 1.87 | 77.3% |
| cost = might (role modifier counted) | 5.54 | 21.0% [17.7–24.6] | 62.2% [58.2–66.0] | 1.70 | 80.2% |
| cost = full (role modifier and TOTW counted) | 5.51 | 21.7% [18.4–25.4] | 62.7% [58.7–66.4] | 1.76 | 80.2% |
| catch-up: +1 order when behind | 5.62 | 27.4% [23.7–31.4] | 75.6% [72.0–78.9] | 2.83 | 77.8% |
| catch-up: +1 card when behind | 5.54 | 31.0% [27.2–35.0] | 73.3% [69.6–76.7] | 2.00 | 75.9% |
| High Ground bonus only on High Ground | 5.46 | 17.8% [14.8–21.2] | 72.9% [69.2–76.3] | 1.91 | 78.0% |
| farmMax 2 | 5.44 | 19.3% [16.2–22.8] | 73.8% [70.2–77.2] | 1.85 | 77.7% |
| no late multiplier, hp 10 | 5.40 | 15.1% [12.3–18.4] | 73.2% [69.5–76.6] | 1.90 | 75.7% |
| might + catch-up order + HG here | 5.67 | 31.4% [27.5–35.5] | 71.0% [67.2–74.5] | 2.49 | 79.3% |
| full + catch-up order + HG here | 5.76 | 32.0% [28.0–36.2] | 71.6% [67.9–75.1] | 2.60 | 79.3% |
| might + catch-up card + HG here | 5.74 | 32.4% [28.5–36.6] | 76.3% [72.7–79.5] | 1.95 | 77.2% |
| might + catch-up order + card + HG here | 5.85 | 36.6% [32.4–41.0] | 76.3% [72.7–79.5] | 3.03 | 73.2% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e13 --slug wiosenna --seed 1 --games 600` (14400 games, 1625 s).

### E14. Smoke and Tank variants (wiosenna)

Each row changes one rule from the defaults. Rounds, comeback, unused orders and planner != greedy: planner vs planner with the same `best` veteran deck. Veteran win rate: the E2 cell (veteran 40 packs vs new player 10 packs, own collections). 600 games per cell.

| Change | Rounds per match | P(win \| behind after round 3) | Veteran wins vs new player | Unused orders per side per match | Planner != greedy |
|---|---|---|---|---|---|
| cost = might, HG here (base for this table) | 5.57 | 24.5% [21.1–28.4] | 64.5% [60.6–68.2] | 1.80 | 78.9% |
| base + Smoke pulls a unit | 5.60 | 19.7% [16.6–23.3] | 63.5% [59.6–67.3] | 1.76 | 77.9% |
| base + Tank takes the gank | 5.62 | 25.9% [22.4–29.9] | 64.2% [60.3–67.9] | 1.61 | 78.4% |
| base + both | 5.62 | 25.4% [21.9–29.3] | 62.6% [58.7–66.4] | 1.66 | 78.0% |
| base + both + catch-up order | 5.67 | 35.3% [31.2–39.6] | 74.3% [70.6–77.6] | 2.30 | 79.5% |
| base + both + catch-up card | 5.73 | 36.1% [32.1–40.4] | 65.9% [62.0–69.6] | 1.75 | 75.8% |
| base + both + farmMax 2 | 5.61 | 23.6% [20.2–27.4] | 68.1% [64.3–71.7] | 1.59 | 78.6% |
| base + both + gank weakest | 5.67 | 28.0% [24.4–32.0] | 66.1% [62.2–69.8] | 1.62 | 77.5% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e14 --slug wiosenna --seed 1 --games 600` (9600 games, 511 s).

### E15. Aura once per objective, and the Comeback card, on the settled rules (wiosenna)

Each row changes one rule from the defaults. Rounds, comeback, unused orders and planner != greedy: planner vs planner with the same `best` veteran deck. Veteran win rate: the E2 cell (veteran 40 packs vs new player 10 packs, own collections). 800 games per cell.

| Change | Rounds per match | P(win \| behind after round 3) | Veteran wins vs new player | Unused orders per side per match | Planner != greedy |
|---|---|---|---|---|---|
| settled rules (Aura once per objective) | 5.75 | 41.0% [37.3–44.7] | 65.4% [62.0–68.6] | 1.70 | 75.8% |
| Aura stacks | 5.78 | 38.7% [35.1–42.5] | 68.8% [65.5–71.9] | 1.72 | 76.0% |
| no Comeback card | 5.60 | 26.4% [23.2–29.8] | 61.6% [58.2–64.9] | 1.51 | 78.0% |
| Aura stacks, no Comeback card | 5.64 | 23.6% [20.6–26.9] | 63.6% [60.2–66.9] | 1.53 | 78.3% |
| budget 60 | 5.75 | 41.9% [38.2–45.6] | 60.2% [56.8–63.5] | 1.61 | 75.1% |
| hp 14 | 6.38 | 45.5% [41.7–49.4] | 72.5% [69.3–75.5] | 2.15 | 71.7% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e15 --slug wiosenna --seed 1 --games 800` (9600 games, 337 s).

### E16. Milder catch-up rules on the settled rules (wiosenna)

Each row changes one rule from the defaults. Rounds, comeback, unused orders and planner != greedy: planner vs planner with the same `best` veteran deck. Veteran win rate: the E2 cell (veteran 40 packs vs new player 10 packs, own collections). 800 games per cell.

| Change | Rounds per match | P(win \| behind after round 3) | Veteran wins vs new player | Unused orders per side per match | Planner != greedy |
|---|---|---|---|---|---|
| settled rules (no catch-up) | 5.54 | 22.3% [19.4–25.5] | 58.4% [54.9–61.8] | 1.45 | 78.4% |
| +1 card when behind by 3 or more | 5.66 | 34.7% [31.3–38.2] | 59.0% [55.6–62.4] | 1.50 | 77.6% |
| +1 card when behind by 5 or more | 5.62 | 22.7% [19.7–25.9] | 57.0% [53.6–60.4] | 1.54 | 77.0% |
| +1 card when behind at all | 5.77 | 39.9% [36.3–43.7] | 62.6% [59.2–65.9] | 1.69 | 75.6% |
| farmMax 2 | 5.58 | 23.8% [20.8–27.1] | 58.4% [54.9–61.8] | 1.58 | 77.3% |
| late multiplier from round 4 | 5.06 | 21.3% [18.4–24.5] | 55.5% [52.0–58.9] | 1.21 | 80.1% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e16 --slug wiosenna --seed 1 --games 800` (9600 games, 1041 s).

### E17. One-role decks against the best deck, by rule variant (wiosenna)

planner vs planner. Columns 2 to 7: win rate of a deck heavy in one role (or one real team) against the best deck from the same veteran collection, 400 games each; the rows of one column share seeds and collections. Then the comeback rate and ganks landed per side per match in the mirror (800 games), and the veteran's win rate against a new player (800 games, 200 collection pairs). A deck far above 60% here is a dominant deck.

| Rules | skew Carry | skew Mid | skew Offlane | skew SS | skew HS | teamStack | P(win \| behind after round 3) | Veteran wins vs new | Ganks landed |
|---|---|---|---|---|---|---|---|---|---|
| rules before E17 (gank reaches any unit) | 30.8% | 93.3% | 20.1% | 36.4% | 47.4% | 56.3% | 32.4% [29.0–35.9] | 58.6% [55.2–62.0] | 0.95 |
| gank only a unit no stronger than the Mid | 29.3% | 30.5% | 14.5% | 44.2% | 48.1% | 57.0% | 26.1% [23.0–29.4] | 66.7% [63.3–69.9] | 0.75 |
| gank the weakest unit | 34.8% | 90.8% | 17.3% | 36.3% | 44.3% | 59.3% | 32.7% [29.4–36.3] | 59.5% [56.0–62.9] | 0.85 |
| gank only a unit weaker than the Mid would be: no stronger, and gank weakest | 30.3% | 28.7% | 12.5% | 41.3% | 48.5% | 56.0% | 27.7% [24.6–31.2] | 67.6% [64.3–70.7] | 0.71 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e17 --slug wiosenna --seed 1` (16000 games, 887 s).

### E18a. Decks with exactly k Mids against each other (wiosenna, rules {"gankEffect":"out"})

planner vs planner, both decks from the same veteran collection, otherwise built like best; 400 games per pair. Win rate of the row deck.

| Row vs column | 1 Mid | 2 Mid | 3 Mid | 4 Mid | 5 Mid |
|---|---|---|---|---|---|
| 1 Mid | — | 49.6% | 47.4% | 37.6% | 34.3% |
| 2 Mid | 50.4% | — | 50.8% | 47.7% | 37.7% |
| 3 Mid | 52.6% | 49.2% | — | 39.5% | 42.1% |
| 4 Mid | 62.4% | 52.3% | 60.5% | — | 51.2% |
| 5 Mid | 65.8% | 62.3% | 57.9% | 48.8% | — |

### E18b. The match when both decks have k Mids (wiosenna, rules {"gankEffect":"out"})

Mirror: 800 games, same deck both sides. Veteran against new player, both with k Mids: 800 games, 200 collection pairs.

| Mids in both decks | Rounds | P(win \| behind after round 3) | Ganks landed per side | Winner never trailed | Veteran wins vs new |
|---|---|---|---|---|---|
| 1 | 5.68 | 30.0% [26.7–33.5] | 0.78 | 52.0% | 68.7% [65.4–71.8] |
| 2 | 5.76 | 32.2% [28.8–35.9] | 1.56 | 44.5% | 68.5% [65.2–71.6] |
| 3 | 5.94 | 38.2% [34.5–41.9] | 2.43 | 38.7% | 62.3% [58.9–65.6] |
| 4 | 5.93 | 40.9% [37.2–44.7] | 3.26 | 33.8% | 65.2% [61.8–68.4] |
| 5 | 5.94 | 43.0% [39.2–46.9] | 4.04 | 33.1% | 59.0% [55.6–62.4] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e18 --slug wiosenna --seed 1` (12000 games, 644 s).

### E18a. Decks with exactly k Mids against each other (wiosenna, rules {"gankEffect":"return","maxPerRole":99})

planner vs planner, both decks from the same veteran collection, otherwise built like best; 400 games per pair. Win rate of the row deck.

| Row vs column | 1 Mid | 2 Mid | 3 Mid | 4 Mid | 5 Mid |
|---|---|---|---|---|---|
| 1 Mid | — | 39.5% | 34.2% | 27.1% | 19.0% |
| 2 Mid | 60.5% | — | 42.3% | 35.8% | 26.0% |
| 3 Mid | 65.8% | 57.7% | — | 46.2% | 30.6% |
| 4 Mid | 72.9% | 64.2% | 53.8% | — | 39.0% |
| 5 Mid | 81.0% | 74.0% | 69.4% | 61.0% | — |

### E18b. The match when both decks have k Mids (wiosenna, rules {"gankEffect":"return","maxPerRole":99})

Mirror: 800 games, same deck both sides. Veteran against new player, both with k Mids: 800 games, 200 collection pairs.

| Mids in both decks | Rounds | P(win \| behind after round 3) | Ganks landed per side | Winner never trailed | Veteran wins vs new |
|---|---|---|---|---|---|
| 1 | 5.72 | 34.8% [31.4–38.4] | 0.93 | 50.9% | 69.2% [65.9–72.3] |
| 2 | 5.72 | 29.8% [26.5–33.3] | 2.27 | 57.9% | 66.3% [63.0–69.5] |
| 3 | 5.84 | 33.5% [30.1–37.2] | 3.81 | 57.8% | 62.7% [59.3–66.0] |
| 4 | 6.01 | 28.2% [24.8–31.8] | 5.71 | 63.0% | 60.3% [56.9–63.7] |
| 5 | 6.32 | 27.0% [23.5–30.9] | 7.93 | 69.6% | 59.5% [56.0–62.9] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e18 --slug wiosenna --seed 1` (12000 games, 516 s).
