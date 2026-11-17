# v2 prototype: simulation report

Simulations of the redesigned card-game core ("v2", `src/features/cards/domain/v2/`), run for `docs/overhaul/GAME_DESIGN.md`. All games are computer against computer on the real cards of Wiosenna (851 cards) and PDL S2 (117 cards). Every run is seeded; the command under each table reproduces it.

There are two folders:

- `docs/overhaul/sim/v2/` (this report when built without `SIM_OUT`): the **settled rules**, which are `DEFAULT_RULES` in `rules.ts`. These are the numbers `GAME_DESIGN.md` section 9 quotes.
- `docs/overhaul/sim/v2-first/` (built with `SIM_OUT=v2-first`): the road to the settled rules.
  - E1 to E10: the **first candidate rules** (`FIRST_RULES` in `rules.ts`: budget 66 counted on rating strength, Tank blocks ganks, a ganked unit returns to its owner's hand, Smoke frees a move from where the Support stood, every Hard Support adds its own Aura, High Ground helps all units, no Comeback card, no limit per position).
  - E8, E13, E14: one change at a time from the first rules.
  - E15, E16, E17: one change at a time from the rules as they stood at that step. In each, the first row is the rule set of that moment; its name says so. They were run before the later defaults existed, so rerunning the printed command today gives the settled rules in the first row instead.
  - E18 (two files): decks with exactly one to five Mids, with a gank that returns its target to the hand (`return`) and one that puts it out for the round (`out`). Both need `maxPerRole` lifted, as the printed `SIM_RULES` of the `return` run shows; the `out` run was made before the limit of three per position became a default.

- `docs/overhaul/sim/v2-fight/` (built with `SIM_OUT=v2-fight`): the revision of 2026-11-15, after the owner asked for the fight to stay and for collecting to matter.
  - E19 in three files: the fight step tried as a hit and a guard on every contested objective (`each`), as one hit and one guard a round (`one`), and the settings around the form that was chosen (`final`). Run with `SIM_SET=each|one|final`. In each, the first row is the game without a fight step.
  - E1, E2, E4: the settled rules with the fight step as a default (`DEFAULT_RULES` from this revision on).
  - E11 in two files, run with `SIM_CPUS=greedy`: Kolejka with the deck budget, and without it (`SIM_RULES={"budget":999}`, file tag `nobudget`).
  - The reports in `sim/v2/` were measured before the fight step existed and have not been re-run with it.

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
| Rounds per match: mean / median / p10 / p90 | 6.28 / 6.00 / 5.00 / 7.00 |
| Rounds per match: distribution | 5: 17.4%, 6: 45.4%, 7: 29.4%, 8: 7.8% |
| How matches end | ancient: 98.3%, draw: 0.7%, cap-objectives: 0.8%, cap: 0.2% |
| Plays per side per match | 9.32 |
| Moves per side per match (of them free: Smoke / Gates) | 3.58 (0.87 / 0.48) |
| Unused orders per side per match (of orders available) | 2.20 of 13.75 (16.0%) |
| Mids played (gank attempts) per side per match | 1.63 |
| Ganks that returned a unit / blocked by an Offlane / nobody to gank | 1.46 / 0.00 / 0.17 |
| Replaces per side per match | 1.05 |
| Cards left in hand at the end, per side | 1.80 |
| Cards left in deck at the end, per side | 0.88 |
| Share of rounds with at least one objective tied (both sides there, equal strength) | 14.7% |
| Share of rounds with at least one objective nobody controls (tie or empty) | 29.5% |
| Farma growth per side per match | 4.32 |
| Aura / Drużyna / High Ground strength per side per match (summed over units and rounds) | 23.35 / 11.48 / 2.90 |
| Rounds where the planner's plan differs from its greedy plan | 74.9% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e1 --slug wiosenna --seed 1` (1000 games, 229 s).

### E1. Shape of a match (pdl-s2)

planner vs planner, each with a `best` deck (the default budget) from its own veteran collection (40 packs; 100 collection pairs, each played from both seats), default rules. N = 1000 matches.

| Measure | Value |
|---|---|
| Games | 1000 |
| Rounds per match: mean / median / p10 / p90 | 6.18 / 6.00 / 5.00 / 7.00 |
| Rounds per match: distribution | 5: 20.7%, 6: 46.7%, 7: 26.6%, 8: 6.0% |
| How matches end | ancient: 99.0%, cap-objectives: 0.9%, draw: 0.1% |
| Plays per side per match | 9.17 |
| Moves per side per match (of them free: Smoke / Gates) | 3.74 (0.87 / 0.48) |
| Unused orders per side per match (of orders available) | 1.99 of 13.54 (14.7%) |
| Mids played (gank attempts) per side per match | 1.54 |
| Ganks that returned a unit / blocked by an Offlane / nobody to gank | 1.34 / 0.00 / 0.20 |
| Replaces per side per match | 1.09 |
| Cards left in hand at the end, per side | 1.90 |
| Cards left in deck at the end, per side | 0.93 |
| Share of rounds with at least one objective tied (both sides there, equal strength) | 11.9% |
| Share of rounds with at least one objective nobody controls (tie or empty) | 26.3% |
| Farma growth per side per match | 4.88 |
| Aura / Drużyna / High Ground strength per side per match (summed over units and rounds) | 21.45 / 12.74 / 2.83 |
| Rounds where the planner's plan differs from its greedy plan | 74.5% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e1 --slug pdl-s2 --seed 1` (1000 games, 161 s).

### E2. Deck strength: new player (10 packs) vs veteran (40 packs) (wiosenna)

planner vs planner, both `best` decks, each from its own collection (250 collection pairs, each played from both seats). Deck cost is counted as the default rules count it. Target: with the default budget, veteran wins <= 60%.

| Budget | Games | Draws | Veteran wins [95% CI] | Deck cost new / veteran | Deck baseMight new / veteran | Rounds |
|---|---|---|---|---|---|---|
| 60 | 1000 | 4 | 57.6% [54.5–60.7] | 59.1 / 60.0 | 59.3 / 60.7 | 6.19 |
| none | 1000 | 0 | 89.9% [87.9–91.6] | 65.1 / 81.3 | 65.3 / 82.0 | 5.82 |
| 48 | 1000 | 1 | 52.2% [49.1–55.2] | 48.0 / 48.0 | 48.2 / 48.7 | 6.17 |
| 54 | 1000 | 4 | 54.8% [51.7–57.9] | 53.9 / 54.0 | 54.1 / 54.7 | 6.19 |
| 66 | 1000 | 2 | 69.4% [66.5–72.2] | 63.0 / 66.0 | 63.1 / 66.7 | 6.18 |
| 72 | 1000 | 2 | 79.5% [76.8–81.9] | 64.7 / 72.0 | 64.9 / 72.7 | 6.05 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e2 --slug wiosenna --seed 1` (6000 games, 969 s).

### E2. Deck strength: new player (10 packs) vs veteran (40 packs) (pdl-s2)

planner vs planner, both `best` decks, each from its own collection (250 collection pairs, each played from both seats). Deck cost is counted as the default rules count it. Target: with the default budget, veteran wins <= 60%.

| Budget | Games | Draws | Veteran wins [95% CI] | Deck cost new / veteran | Deck baseMight new / veteran | Rounds |
|---|---|---|---|---|---|---|
| 60 | 1000 | 3 | 67.1% [64.1–69.9] | 60.0 / 60.0 | 60.8 / 62.6 | 6.12 |
| none | 1000 | 3 | 87.3% [85.0–89.2] | 86.8 / 96.6 | 87.6 / 99.2 | 6.02 |
| 48 | 1000 | 3 | 62.6% [59.5–65.5] | 48.0 / 48.0 | 48.8 / 50.6 | 6.08 |
| 54 | 1000 | 2 | 66.6% [63.6–69.5] | 54.0 / 54.0 | 54.8 / 56.6 | 6.08 |
| 66 | 1000 | 6 | 63.6% [60.5–66.5] | 66.0 / 66.0 | 66.8 / 68.6 | 6.19 |
| 72 | 1000 | 1 | 61.8% [58.7–64.7] | 72.0 / 72.0 | 72.8 / 74.6 | 6.12 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e2 --slug pdl-s2 --seed 1` (6000 games, 883 s).

### E3a. Skill ladder: win rate of the row player against the column player (wiosenna)

Both sides play the same `best` deck (the default budget) from one regular collection (20 packs) per pair; 1000 games per pair, both seats. Cells with a 95% CI are measured directly; the mirrored cells are 1 minus them. Targets: each step up >= 60%; planner vs greedy >= 70%.

| Row vs column | random | greedy | responder | planner | planner-mixed |
|---|---|---|---|---|---|
| random | — | 3.3% (N=1000) | 3.9% (N=999) | 1.8% (N=1000) | 2.9% (N=1000) |
| greedy | 96.7% [95.4–97.6] | — | 6.9% (N=999) | 21.2% (N=995) | 28.0% (N=994) |
| responder | 96.1% [94.7–97.1] | 93.1% [91.3–94.5] | — | 38.8% (N=996) | 43.0% (N=1000) |
| planner | 98.2% [97.2–98.9] | 78.8% [76.1–81.2] | 61.2% [58.2–64.2] | — | 55.5% (N=997) |
| planner-mixed | 97.1% [95.9–98.0] | 72.0% [69.2–74.7] | 57.0% [53.9–60.0] | 44.5% [41.5–47.6] | — |

### E3b. Skill against collection (wiosenna)

planner with a new player's `best` deck (10 packs) vs greedy with a veteran's `best` deck (40 packs), the default budget, N = 1000.

| Matchup | Planner (new player) wins [95% CI] | Draws |
|---|---|---|
| planner/new vs greedy/veteran | 63.8% [60.7–66.7] | 4 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e3 --slug wiosenna --seed 1` (11000 games, 902 s).

### E4. Comebacks (wiosenna)

planner vs planner with the same `best` deck (one veteran collection per pair), N = 1000. Targets: P(win | behind after round 3) >= 25%; winner never trailed <= 55%.

| Measure | Value |
|---|---|
| P(win \| behind on HP after round 2) (matches still going, HP not equal) | 41.2% [37.8–44.7] (N=796) |
| P(win \| behind on HP after round 3) (matches still going, HP not equal) | 33.5% [30.4–36.7] (N=845) |
| P(win \| behind on HP after round 4) (matches still going, HP not equal) | 27.8% [24.9–30.8] (N=878) |
| Lead changes per match (sign changes of the HP difference, equal HP skipped) | 0.77 |
| Winner never trailed on HP after any round | 41.5% [38.5–44.6] |
| Final HP difference: mean / median | 5.63 / 5.00 |
| Winner's remaining HP (count of matches) | 0: 81, 1: 121, 2: 126, 3: 98, 4: 95, 5: 96, 6: 97, 7: 81, 8: 58, 9: 37, 10: 20, 11: 10, 12: 2, 13: 2, 14: 1, -8: 3, -7: 2, -3: 16, -2: 15, -1: 34 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e4 --slug wiosenna --seed 1` (1000 games, 163 s).

### E4. Comebacks (pdl-s2)

planner vs planner with the same `best` deck (one veteran collection per pair), N = 1000. Targets: P(win | behind after round 3) >= 25%; winner never trailed <= 55%.

| Measure | Value |
|---|---|
| P(win \| behind on HP after round 2) (matches still going, HP not equal) | 41.2% [37.8–44.6] (N=799) |
| P(win \| behind on HP after round 3) (matches still going, HP not equal) | 36.7% [33.6–40.0] (N=863) |
| P(win \| behind on HP after round 4) (matches still going, HP not equal) | 30.2% [27.3–33.3] (N=898) |
| Lead changes per match (sign changes of the HP difference, equal HP skipped) | 0.76 |
| Winner never trailed on HP after any round | 41.1% [38.0–44.1] |
| Final HP difference: mean / median | 5.65 / 5.00 |
| Winner's remaining HP (count of matches) | 0: 80, 1: 127, 2: 134, 3: 87, 4: 91, 5: 111, 6: 92, 7: 74, 8: 54, 9: 35, 10: 22, 11: 12, 12: 5, 13: 1, -8: 1, -5: 1, -4: 1, -3: 9, -2: 25, -1: 34 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e4 --slug pdl-s2 --seed 1` (1000 games, 128 s).

### E5a/b. Value of reading the rival (wiosenna)

Same `best` deck for both sides (one veteran collection per pair, the default budget), both seats. omniscient is handed the rival's actual plan each round; exploiter repeats the deterministic planner's reasoning on 3 guessed planner hands and answers the 3 predicted plans. planner vs greedy repeated here for comparison.

| Row player | Rival | Games | Row player wins [95% CI] | Rounds |
|---|---|---|---|---|
| omniscient | planner | 1000 | 81.3% [78.8–83.6] | 5.90 |
| omniscient | greedy | 1000 | 87.2% [85.0–89.1] | 5.82 |
| planner | greedy | 1000 | 74.2% [71.4–76.8] | 6.12 |
| exploiter | planner | 400 | 61.2% [56.3–65.9] | 6.20 |
| exploiter | planner-mixed | 400 | 68.2% [63.4–72.5] | 6.09 |
| planner | planner-mixed | 1000 | 54.8% [51.7–57.9] | 6.29 |

### E5c. How often reading changes the plan (wiosenna)

E1 matches (planner vs planner, own veteran collections), N = 1000 matches: share of planner decisions whose chosen plan is not the plan greedy would play (the best plan if the rival did nothing).

| Measure | Value |
|---|---|
| Planner plan differs from greedy plan | 74.9% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e5 --slug wiosenna --seed 1` (5800 games, 448 s).

### E6a. Deck archetypes: win rate of the row deck against the column deck (wiosenna)

planner vs planner; both decks built from the same veteran collection (40 packs, 30 collections), the default budget; 300 games per pair, both seats.

| Row vs column | best | topHeavy | flat | teamStack | most Carry | most Mid | most Offlane | most Support | most Hard Supp |
|---|---|---|---|---|---|---|---|---|---|
| best | — | 29.4% | 62.0% | 43.0% | 50.5% | 43.2% | 53.4% | 50.8% | 49.2% |
| topHeavy | 70.6% | — | 83.7% | 65.9% | 70.4% | 70.2% | 76.3% | 72.7% | 69.1% |
| flat | 38.0% | 16.3% | — | 27.8% | 37.5% | 30.5% | 30.7% | 34.3% | 31.6% |
| teamStack | 57.0% | 34.1% | 72.2% | — | 59.1% | 56.5% | 65.2% | 61.4% | 59.0% |
| most Carry | 49.5% | 29.6% | 62.5% | 40.9% | — | 46.3% | 50.3% | 51.7% | 51.7% |
| most Mid | 56.8% | 29.8% | 69.5% | 43.5% | 53.7% | — | 54.0% | 51.8% | 52.2% |
| most Offlane | 46.6% | 23.7% | 69.3% | 34.8% | 49.7% | 46.0% | — | 48.3% | 48.7% |
| most Support | 49.2% | 27.3% | 65.7% | 38.6% | 48.3% | 48.2% | 51.7% | — | 48.0% |
| most Hard Supp | 50.8% | 30.9% | 68.4% | 41.0% | 48.3% | 47.8% | 51.3% | 52.0% | — |

### E6b. Deck archetypes against the field (wiosenna)

Each archetype's wins over all its games against the other eight. Targets: none above 60% or below 40%; best beats no other archetype by more than 60%.

| Archetype | Against the field [95% CI] | Deck cost | Deck baseMight |
|---|---|---|---|
| best | 47.7% [45.7–49.7] | 60.0 | 60.9 |
| topHeavy | 72.4% [70.5–74.1] | 59.9 | 60.7 |
| flat | 30.8% [29.0–32.7] | 60.0 | 60.4 |
| teamStack | 58.1% [56.1–60.0] | 59.4 | 60.3 |
| most Carry | 47.8% [45.8–49.8] | 60.0 | 60.9 |
| most Mid | 51.4% [49.4–53.4] | 60.0 | 60.9 |
| most Offlane | 45.9% [43.9–47.9] | 60.0 | 60.9 |
| most Support | 47.1% [45.1–49.1] | 60.0 | 60.9 |
| most Hard Supp | 48.8% [46.8–50.8] | 60.0 | 60.9 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e6 --slug wiosenna --seed 1 --games 300` (10800 games, 1281 s).

### E7a. Each ability switched off for both sides (wiosenna)

Rounds and comeback rate: planner vs planner with the same `best` veteran deck, 1000 games. Last column: win rate of the deck that leans on that ability (roleSkew of its role; teamStack for Drużyna) against `best` built from the same collection, with the ability on -> off (500 games each).

| Rules | Rounds per match | P(win \| behind after round 3) | Skewed deck vs best: on -> off |
|---|---|---|---|
| everything on | 6.24 | 36.0% [32.8–39.3] | — |
| Farma (Carry) | 6.34 | 36.2% [33.1–39.5] | most Carry: 52.1% [47.7–56.5] -> 49.1% [44.7–53.5] |
| Gank (Mid) | 6.21 | 28.6% [25.7–31.7] | most Mid: 54.1% [49.7–58.5] -> 42.1% [37.8–46.5] |
| Tank (Offlane) | 6.25 | 36.6% [33.5–39.9] | most Offlane: 45.9% [41.6–50.3] -> 41.9% [37.7–46.3] |
| Smoke (Soft Support) | 6.28 | 36.3% [33.2–39.5] | most Support: 46.1% [41.7–50.5] -> 46.3% [42.0–50.7] |
| Aura (Hard Support) | 6.22 | 35.6% [32.5–38.9] | most Hard Supp: 50.4% [46.0–54.8] -> 52.1% [47.7–56.5] |
| Drużyna (teams) | 6.27 | 34.2% [31.1–37.4] | teamStack: 57.2% [52.8–61.5] -> 64.7% [60.4–68.7] |

### E7b. Ability use per side per match, everything on (wiosenna)

Same matches as the first row above (N = 1000).

| Measure | Per side per match |
|---|---|
| Farma growth gained | 4.29 |
| Ganks that returned a unit | 1.48 |
| Ganks blocked by an Offlane (Tank) | 0.00 |
| Smoke free moves | 0.85 |
| Aura strength (summed over units and rounds) | 22.98 |
| Drużyna strength (summed over units and rounds) | 11.21 |
| High Ground strength (summed over units and rounds) | 2.80 |
| Twin Gates free moves | 0.47 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e7 --slug wiosenna --seed 1` (13000 games, 1739 s).

### E9a. Holding an objective in round 2 (wiosenna)

planner vs planner, `best` decks from own veteran collections, N = 2000. Win rate of the side that controlled the objective in round 2 (matches where someone did). Roshan's share of all damage in matches with Roshan: 51.0%.

| Objective | Matches with it | Controlled by someone in round 2 | Controller wins [95% CI] |
|---|---|---|---|
| High Ground | 1014 | 881 | 55.2% [51.9–58.4] |
| Roshan | 985 | 925 | 58.1% [54.8–61.2] |
| Outpost | 986 | 865 | 51.9% [48.6–55.2] |
| Twin Gates | 1021 | 758 | 47.8% [44.2–51.3] |
| Tormentor | 1013 | 812 | 53.6% [50.1–57.0] |
| Lotus Pool | 963 | 874 | 60.6% [57.4–63.8] |

### E9b. By trio of objectives (wiosenna)

Same matches. The game is symmetric, so a trio cannot favour a seat; what can differ is length and how decisive early control is.

| Trio | Matches | Rounds | Side with more objectives in round 2 wins | Roshan share of damage |
|---|---|---|---|---|
| gates + highground + lotus | 107 | 6.64 | 67.9% [57.3–76.9] | — |
| gates + highground + outpost | 103 | 6.89 | 60.0% [49.0–70.0] | — |
| gates + highground + roshan | 103 | 5.63 | 42.7% [32.1–53.9] | 51.0% |
| gates + highground + tormentor | 113 | 6.77 | 62.2% [51.9–71.5] | — |
| gates + lotus + outpost | 93 | 6.75 | 64.0% [52.7–73.9] | — |
| gates + lotus + roshan | 96 | 5.75 | 60.3% [48.4–71.1] | 51.6% |
| gates + lotus + tormentor | 104 | 6.80 | 55.7% [44.7–66.1] | — |
| gates + outpost + roshan | 96 | 5.67 | 51.9% [41.1–62.4] | 51.2% |
| gates + outpost + tormentor | 102 | 6.85 | 57.0% [46.0–67.3] | — |
| gates + roshan + tormentor | 110 | 5.73 | 69.1% [58.4–78.1] | 51.4% |
| highground + lotus + outpost | 99 | 6.61 | 64.6% [53.8–74.1] | — |
| highground + lotus + roshan | 78 | 5.56 | 68.9% [56.4–79.1] | 50.5% |
| highground + lotus + tormentor | 108 | 6.61 | 61.9% [51.2–71.6] | — |
| highground + outpost + roshan | 119 | 5.66 | 67.8% [57.6–76.5] | 51.7% |
| highground + outpost + tormentor | 89 | 6.78 | 79.2% [68.4–86.9] | — |
| highground + roshan + tormentor | 97 | 5.73 | 70.0% [58.5–79.5] | 50.6% |
| lotus + outpost + roshan | 88 | 5.80 | 58.6% [46.9–69.4] | 50.0% |
| lotus + outpost + tormentor | 97 | 6.71 | 53.8% [42.9–64.5] | — |
| lotus + roshan + tormentor | 94 | 5.61 | 65.6% [53.4–76.1] | 51.9% |
| outpost + roshan + tormentor | 104 | 5.67 | 68.8% [57.9–77.8] | 50.2% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e9 --slug wiosenna --seed 1` (2000 games, 334 s).

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
| greedy, new | 97.7% [95.3–98.9] | 68.8% [63.3–73.8] | 35.3% [30.1–40.9] | 25.1% [20.5–30.3] | 3.7% [2.1–6.4] |
| greedy, regular | 95.7% [92.7–97.5] | 76.6% [71.5–81.0] | 41.8% [36.3–47.4] | 28.2% [23.4–33.5] | 5.3% [3.3–8.5] |
| greedy, veteran | 96.3% [93.6–97.9] | 80.7% [75.8–84.7] | 46.0% [40.4–51.7] | 24.9% [20.3–30.1] | 9.0% [6.3–12.8] |
| planner, new | 100.0% [98.7–100.0] | 84.3% [79.7–88.0] | 61.9% [56.2–67.2] | 38.9% [33.6–44.6] | 12.3% [9.1–16.5] |
| planner, regular | 99.0% [97.1–99.7] | 87.7% [83.5–90.9] | 65.0% [59.4–70.2] | 50.2% [44.5–55.8] | 13.0% [9.7–17.3] |
| planner, veteran | 99.7% [98.1–99.9] | 92.0% [88.3–94.5] | 71.0% [65.6–75.8] | 49.7% [44.0–55.3] | 14.3% [10.8–18.8] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug wiosenna --seed 1` (9000 games, 469 s).

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
| greedy, new | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 90.0% [86.0–92.9] | 71.9% [66.6–76.7] | 33.7% [28.6–39.2] |
| greedy, regular | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 95.3% [92.3–97.2] | 75.4% [70.2–80.0] | 37.3% [32.1–42.9] |
| greedy, veteran | 100.0% [98.7–100.0] | 99.3% [97.6–99.8] | 95.3% [92.3–97.2] | 86.0% [81.6–89.5] | 41.3% [35.9–47.0] |
| planner, new | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 98.3% [96.2–99.3] | 89.0% [85.0–92.1] | 47.3% [41.8–53.0] |
| planner, regular | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 98.3% [96.2–99.3] | 90.7% [86.8–93.5] | 52.3% [46.7–57.9] |
| planner, veteran | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 99.0% [97.1–99.7] | 91.3% [87.6–94.0] | 57.7% [52.0–63.1] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug pdl-s2 --seed 1` (9000 games, 376 s).

### E12. Duplicates over a season of packs (wiosenna)

1000 simulated players, 9 rounds (seasonPeriods). 10 welcome packs after round 1, then 3 or 5 packs after every round; the pack pool after round r is each team's last series up to r (packPool, openPack as on the site, TOTW chance 25%). Cells: mean (p10 / median / p90). A duplicate is a card whose exact id the player already had; "players" counts player-and-team pairs (deckKey); a complete team has all five roles held.

| Packs | Packs opened | Cards received | Exact duplicates | Duplicates by tier (mean) | Distinct players | Complete teams |
|---|---|---|---|---|---|---|
| 3 per round | 37.0 (37 / 37 / 37) | 185.0 (185 / 185 / 185) | 67.7 (63 / 68 / 72) | wood 24.5, bronze 21.8, silver 10.3, gold 4.6, elite 3.0, totw 3.6 | 76.7 (72 / 77 / 81) | 5.0 (3 / 5 / 7) |
| 5 per round | 55.0 (55 / 55 / 55) | 275.0 (275 / 275 / 275) | 105.1 (98 / 105 / 112) | wood 39.5, bronze 32.9, silver 16.8, gold 7.3, elite 4.0, totw 4.6 | 94.3 (90 / 94 / 99) | 9.7 (7 / 10 / 12) |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e12 --slug wiosenna --seed 1` (0 games, 15 s).

### E12. Duplicates over a season of packs (pdl-s2)

1000 simulated players, 2 rounds (seasonPeriods). 10 welcome packs after round 1, then 3 or 5 packs after every round; the pack pool after round r is each team's last series up to r (packPool, openPack as on the site, TOTW chance 25%). Cells: mean (p10 / median / p90). A duplicate is a card whose exact id the player already had; "players" counts player-and-team pairs (deckKey); a complete team has all five roles held.

| Packs | Packs opened | Cards received | Exact duplicates | Duplicates by tier (mean) | Distinct players | Complete teams |
|---|---|---|---|---|---|---|
| 3 per round | 16.0 (16 / 16 / 16) | 80.0 (80 / 80 / 80) | 27.2 (24 / 27 / 31) | wood 7.4, bronze 8.8, silver 7.3, gold 3.5, elite 0.1, totw 0.1 | 45.0 (42 / 45 / 48) | 2.6 (1 / 3 / 4) |
| 5 per round | 20.0 (20 / 20 / 20) | 100.0 (100 / 100 / 100) | 37.7 (34 / 38 / 41) | wood 10.3, bronze 11.8, silver 10.2, gold 5.0, elite 0.2, totw 0.2 | 49.6 (46 / 50 / 53) | 4.0 (2 / 4 / 6) |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e12 --slug pdl-s2 --seed 1` (0 games, 1 s).

### E20a. Practice levels against each other (wiosenna)

Both sides play the same best budget deck from one veteran collection per pair; 400 games per pair, both seats. Target: each level beats the one below it between 60 and 85%.

| Level | Against | Wins [95% CI] | Rounds |
|---|---|---|---|
| Średni | Łatwy | 84.5% [80.6–87.7] | 6.02 |
| Trudny | Średni | 57.4% [52.5–62.2] | 6.18 |
| Trudny | Łatwy | 89.5% [86.1–92.1] | 5.85 |
| Łatwy | Kolejka | 36.9% [32.3–41.8] | 6.38 |

### E20b. Thinking time per level (wiosenna)

Milliseconds in Node on this machine, with other simulations running beside it, so an upper bound for a desktop; a phone is several times slower. Per round = plan and fight together.

| Level | Mean per round | Median of the slowest round of a match | 95th percentile of the slowest round |
|---|---|---|---|
| Łatwy | 9.1 | 17.1 | 28.7 |
| Średni | 68.4 | 125.2 | 190.5 |
| Trudny | 195.9 | 337.3 | 472.7 |
| Kolejka | 7.1 | 12.9 | 21.5 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e20 --slug wiosenna --seed 1 --games 400` (1600 games, 337 s).

### E21. Deck shapes and the collector's edge, by rule variant (wiosenna)

planner vs planner. Deck duels: both decks from the same veteran collection (40 collections), 400 games each; "stars" is the deck of few strong cards and cheap fillers, "even" the deck of evenly middling cards, "best" the automatic deck. Veteran vs new: 800 games, 200 collection pairs, both with the automatic deck, then both with the stars deck. Targets: no duel above 60%; veteran at most 60%.

| Rules | Stars beat best | Stars beat even | Stars beat team deck | Best beats even | Team deck beats best | Veteran beats new (best decks) | Veteran beats new (stars decks) | Rounds | P(win \| behind after round 3) |
|---|---|---|---|---|---|---|---|---|---|
| settled rules | 68.8% [64.0–73.1] | 80.5% [76.3–84.1] | 59.3% [54.4–64.0] | 66.5% [61.7–71.0] | 59.3% [54.4–64.0] | 58.6% [55.1–62.0] | 76.6% [73.5–79.4] | 6.29 | 34.3% [29.5–39.4] |
| four places per side on an objective | 62.4% [57.6–67.0] | 72.5% [67.9–76.6] | 53.1% [48.2–58.0] | 63.5% [58.7–68.1] | 58.3% [53.4–63.0] | 61.1% [57.6–64.4] | 68.5% [65.2–71.6] | 6.30 | 42.3% [37.1–47.6] |
| steep cost (strength above 7 costs double) | 66.8% [62.0–71.2] | 68.8% [64.0–73.1] | 55.4% [50.5–60.2] | 64.1% [59.2–68.6] | 55.1% [50.2–59.9] | 63.7% [60.3–67.0] | 63.9% [60.5–67.2] | 6.30 | 37.9% [32.9–43.1] |
| steep cost, team-of-the-round +1 counted | 58.8% [53.9–63.5] | 64.4% [59.6–69.0] | 49.9% [45.0–54.8] | 60.1% [55.2–64.7] | 56.3% [51.4–61.1] | 63.4% [60.0–66.7] | 57.0% [53.5–60.4] | 6.33 | 34.5% [29.6–39.8] |
| team-of-the-round +1 counted | 69.7% [65.0–74.0] | 80.2% [76.0–83.8] | 62.4% [57.6–67.0] | 61.7% [56.8–66.3] | 61.6% [56.7–66.3] | 57.3% [53.9–60.7] | 73.7% [70.5–76.6] | 6.28 | 32.7% [28.0–37.9] |
| steep cost and four places | 49.5% [44.6–54.4] | 55.3% [50.4–60.0] | 46.9% [42.0–51.8] | 60.9% [56.0–65.5] | 50.6% [45.7–55.5] | 60.3% [56.8–63.6] | 57.1% [53.6–60.5] | 6.31 | 40.1% [35.1–45.3] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e21 --slug wiosenna --seed 1` (24000 games, 3941 s).

### E21. Deck shapes and the collector's edge, by rule variant (pdl-s2)

planner vs planner. Deck duels: both decks from the same veteran collection (40 collections), 300 games each; "stars" is the deck of few strong cards and cheap fillers, "even" the deck of evenly middling cards, "best" the automatic deck. Veteran vs new: 600 games, 200 collection pairs, both with the automatic deck, then both with the stars deck. Targets: no duel above 60%; veteran at most 60%.

| Rules | Stars beat best | Stars beat even | Stars beat team deck | Best beats even | Team deck beats best | Veteran beats new (best decks) | Veteran beats new (stars decks) | Rounds | P(win \| behind after round 3) |
|---|---|---|---|---|---|---|---|---|---|
| settled rules | 69.7% [64.2–74.6] | 87.6% [83.4–90.9] | 55.7% [50.0–61.2] | 83.6% [79.0–87.4] | 65.6% [60.0–70.7] | 64.3% [60.4–68.0] | 61.7% [57.7–65.5] | 6.16 | 35.5% [29.9–41.6] |
| steep cost and four places | 51.0% [45.4–56.6] | 52.2% [46.5–57.8] | 38.3% [33.0–43.9] | 63.5% [57.9–68.8] | 60.0% [54.4–65.4] | 47.7% [43.8–51.7] | 53.4% [49.4–57.4] | 6.17 | 34.0% [28.5–39.9] |
| steep cost with team-of-the-round +1 counted, and four places | 29.9% [25.0–35.3] | 36.5% [31.2–42.1] | 27.6% [22.8–33.0] | 61.0% [55.4–66.3] | 64.3% [58.8–69.5] | 45.8% [41.9–49.8] | 45.5% [41.6–49.5] | 6.25 | 39.8% [33.9–45.9] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e21 --slug pdl-s2 --seed 1 --games 300` (9000 games, 1721 s).
