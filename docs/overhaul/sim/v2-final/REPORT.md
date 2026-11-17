# v2 prototype: simulation report

Simulations of the redesigned card-game core ("v2", `src/features/cards/domain/v2/`), run for `docs/overhaul/GAME_DESIGN.md`. All games are computer against computer on the real cards of Wiosenna (851 cards) and PDL S2 (117 cards). Every run is seeded; the command under each table reproduces it.

There are two folders:

- `docs/overhaul/sim/v2/` (built without `SIM_OUT`): the rules as first settled on 2026-11-14, before the owner's review added the fight step. Kept as a record.
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

- `docs/overhaul/sim/v2-settled/` (built with `SIM_OUT=v2-settled`, 2026-11-15 to 17): the whole battery on the rules with the fight step but before the last change (cost = strength with the position modifier, three places per objective), and E21, the experiment that found the last change (a steep cost and four places), with E20 on the practice levels.
- `docs/overhaul/sim/v2-final/` (built with `SIM_OUT=v2-final`, 2026-11-17): **the final rules**, `DEFAULT_RULES` from WP-52 on. These are the numbers `GAME_DESIGN.md` sections 9.2 and 9.4 quote. E11 has two files: with the budget, and without it (`nobudget`), which is how Kolejka is played.

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
| Rounds per match: distribution | 5: 15.7%, 6: 45.9%, 7: 32.9%, 8: 5.5% |
| How matches end | ancient: 99.1%, cap-objectives: 0.6%, cap: 0.1%, draw: 0.2% |
| Plays per side per match | 9.87 |
| Moves per side per match (of them free: Smoke / Gates) | 3.87 (0.99 / 0.52) |
| Unused orders per side per match (of orders available) | 1.50 of 13.73 (10.9%) |
| Mids played (gank attempts) per side per match | 1.87 |
| Ganks that returned a unit / blocked by an Offlane / nobody to gank | 1.67 / 0.00 / 0.20 |
| Replaces per side per match | 0.54 |
| Cards left in hand at the end, per side | 1.17 |
| Cards left in deck at the end, per side | 0.96 |
| Share of rounds with at least one objective tied (both sides there, equal strength) | 12.7% |
| Share of rounds with at least one objective nobody controls (tie or empty) | 30.1% |
| Farma growth per side per match | 5.20 |
| Aura / Drużyna / High Ground strength per side per match (summed over units and rounds) | 28.49 / 13.15 / 3.35 |
| Rounds where the planner's plan differs from its greedy plan | 80.7% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e1 --slug wiosenna --seed 1` (1000 games, 270 s).

### E1. Shape of a match (pdl-s2)

planner vs planner, each with a `best` deck (the default budget) from its own veteran collection (40 packs; 100 collection pairs, each played from both seats), default rules. N = 1000 matches.

| Measure | Value |
|---|---|
| Games | 1000 |
| Rounds per match: mean / median / p10 / p90 | 6.19 / 6.00 / 5.00 / 7.00 |
| Rounds per match: distribution | 5: 19.6%, 6: 46.4%, 7: 29.6%, 8: 4.4% |
| How matches end | ancient: 99.5%, cap: 0.1%, cap-objectives: 0.3%, draw: 0.1% |
| Plays per side per match | 9.73 |
| Moves per side per match (of them free: Smoke / Gates) | 4.04 (1.26 / 0.49) |
| Unused orders per side per match (of orders available) | 1.51 of 13.53 (11.2%) |
| Mids played (gank attempts) per side per match | 1.48 |
| Ganks that returned a unit / blocked by an Offlane / nobody to gank | 1.29 / 0.00 / 0.19 |
| Replaces per side per match | 0.51 |
| Cards left in hand at the end, per side | 1.24 |
| Cards left in deck at the end, per side | 1.02 |
| Share of rounds with at least one objective tied (both sides there, equal strength) | 11.0% |
| Share of rounds with at least one objective nobody controls (tie or empty) | 28.0% |
| Farma growth per side per match | 5.15 |
| Aura / Drużyna / High Ground strength per side per match (summed over units and rounds) | 27.62 / 15.51 / 3.33 |
| Rounds where the planner's plan differs from its greedy plan | 79.7% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e1 --slug pdl-s2 --seed 1` (1000 games, 237 s).

### E2. Deck strength: new player (10 packs) vs veteran (40 packs) (wiosenna)

planner vs planner, both `best` decks, each from its own collection (250 collection pairs, each played from both seats). Deck cost is counted as the default rules count it. Target: with the default budget, veteran wins <= 60%.

| Budget | Games | Draws | Veteran wins [95% CI] | Deck cost new / veteran | Deck baseMight new / veteran | Rounds |
|---|---|---|---|---|---|---|
| 60 | 1000 | 3 | 61.2% [58.1–64.2] | 59.3 / 60.0 | 58.6 / 60.4 | 6.19 |
| none | 1000 | 1 | 89.9% [87.9–91.6] | 67.4 / 86.6 | 65.3 / 82.0 | 5.86 |
| 48 | 1000 | 4 | 53.7% [50.6–56.8] | 48.0 / 48.0 | 48.1 / 48.4 | 6.20 |
| 54 | 1000 | 2 | 57.8% [54.7–60.8] | 53.9 / 54.0 | 53.7 / 54.4 | 6.19 |
| 66 | 1000 | 4 | 68.1% [65.1–70.9] | 63.6 / 66.0 | 62.1 / 66.3 | 6.19 |
| 72 | 1000 | 2 | 76.0% [73.2–78.5] | 66.1 / 72.0 | 64.2 / 71.5 | 6.11 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e2 --slug wiosenna --seed 1` (6000 games, 1341 s).

### E2. Deck strength: new player (10 packs) vs veteran (40 packs) (pdl-s2)

planner vs planner, both `best` decks, each from its own collection (250 collection pairs, each played from both seats). Deck cost is counted as the default rules count it. Target: with the default budget, veteran wins <= 60%.

| Budget | Games | Draws | Veteran wins [95% CI] | Deck cost new / veteran | Deck baseMight new / veteran | Rounds |
|---|---|---|---|---|---|---|
| 60 | 1000 | 1 | 52.3% [49.2–55.3] | 60.0 / 60.0 | 60.3 / 61.0 | 6.22 |
| none | 1000 | 1 | 83.1% [80.6–85.3] | 94.5 / 110.0 | 87.6 / 99.2 | 6.12 |
| 48 | 1000 | 3 | 53.6% [50.5–56.6] | 48.0 / 48.0 | 48.4 / 49.0 | 6.16 |
| 54 | 1000 | 1 | 49.4% [46.4–52.5] | 54.0 / 54.0 | 54.3 / 55.0 | 6.16 |
| 66 | 1000 | 3 | 57.7% [54.6–60.7] | 66.0 / 66.0 | 66.2 / 67.0 | 6.26 |
| 72 | 1000 | 2 | 53.7% [50.6–56.8] | 72.0 / 72.0 | 71.5 / 73.0 | 6.27 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e2 --slug pdl-s2 --seed 1` (6000 games, 1184 s).

### E3a. Skill ladder: win rate of the row player against the column player (wiosenna)

Both sides play the same `best` deck (the default budget) from one regular collection (20 packs) per pair; 1000 games per pair, both seats. Cells with a 95% CI are measured directly; the mirrored cells are 1 minus them. Targets: each step up >= 60%; planner vs greedy >= 70%.

| Row vs column | random | greedy | responder | planner | planner-mixed |
|---|---|---|---|---|---|
| random | — | 3.3% (N=1000) | 2.7% (N=1000) | 1.8% (N=1000) | 3.3% (N=999) |
| greedy | 96.7% [95.4–97.6] | — | 4.1% (N=1000) | 16.8% (N=995) | 16.8% (N=997) |
| responder | 97.3% [96.1–98.1] | 95.9% [94.5–97.0] | — | 36.2% (N=994) | 40.4% (N=996) |
| planner | 98.2% [97.2–98.9] | 83.2% [80.8–85.4] | 63.8% [60.7–66.7] | — | 58.6% (N=999) |
| planner-mixed | 96.7% [95.4–97.6] | 83.2% [80.8–85.4] | 59.6% [56.6–62.6] | 41.4% [38.4–44.5] | — |

### E3b. Skill against collection (wiosenna)

planner with a new player's `best` deck (10 packs) vs greedy with a veteran's `best` deck (40 packs), the default budget, N = 1000.

| Matchup | Planner (new player) wins [95% CI] | Draws |
|---|---|---|
| planner/new vs greedy/veteran | 72.0% [69.1–74.7] | 3 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e3 --slug wiosenna --seed 1` (11000 games, 872 s).

### E4. Comebacks (wiosenna)

planner vs planner with the same `best` deck (one veteran collection per pair), N = 1000. Targets: P(win | behind after round 3) >= 25%; winner never trailed <= 55%.

| Measure | Value |
|---|---|
| P(win \| behind on HP after round 2) (matches still going, HP not equal) | 43.3% [40.0–46.8] (N=817) |
| P(win \| behind on HP after round 3) (matches still going, HP not equal) | 37.8% [34.6–41.1] (N=844) |
| P(win \| behind on HP after round 4) (matches still going, HP not equal) | 30.7% [27.8–33.9] (N=885) |
| Lead changes per match (sign changes of the HP difference, equal HP skipped) | 0.75 |
| Winner never trailed on HP after any round | 42.7% [39.7–45.8] |
| Final HP difference: mean / median | 5.36 / 5.00 |
| Winner's remaining HP (count of matches) | 0: 92, 1: 139, 2: 119, 3: 116, 4: 95, 5: 97, 6: 102, 7: 77, 8: 53, 9: 19, 10: 15, 11: 5, 12: 2, -9: 1, -8: 3, -5: 2, -4: 1, -3: 7, -2: 18, -1: 29 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e4 --slug wiosenna --seed 1` (1000 games, 193 s).

### E4. Comebacks (pdl-s2)

planner vs planner with the same `best` deck (one veteran collection per pair), N = 1000. Targets: P(win | behind after round 3) >= 25%; winner never trailed <= 55%.

| Measure | Value |
|---|---|
| P(win \| behind on HP after round 2) (matches still going, HP not equal) | 40.2% [36.9–43.7] (N=805) |
| P(win \| behind on HP after round 3) (matches still going, HP not equal) | 35.7% [32.5–38.9] (N=861) |
| P(win \| behind on HP after round 4) (matches still going, HP not equal) | 28.8% [25.9–31.9] (N=885) |
| Lead changes per match (sign changes of the HP difference, equal HP skipped) | 0.74 |
| Winner never trailed on HP after any round | 43.5% [40.5–46.6] |
| Final HP difference: mean / median | 5.50 / 5.00 |
| Winner's remaining HP (count of matches) | 0: 89, 1: 140, 2: 139, 3: 92, 4: 87, 5: 99, 6: 107, 7: 80, 8: 53, 9: 31, 10: 12, 11: 7, 12: 3, 14: 1, -9: 1, -8: 1, -6: 1, -5: 2, -3: 11, -2: 18, -1: 23 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e4 --slug pdl-s2 --seed 1` (1000 games, 199 s).

### E5a/b. Value of reading the rival (wiosenna)

Same `best` deck for both sides (one veteran collection per pair, the default budget), both seats. omniscient is handed the rival's actual plan each round; exploiter repeats the deterministic planner's reasoning on 3 guessed planner hands and answers the 3 predicted plans. planner vs greedy repeated here for comparison.

| Row player | Rival | Games | Row player wins [95% CI] | Rounds |
|---|---|---|---|---|
| omniscient | planner | 1000 | 85.1% [82.7–87.1] | 5.88 |
| omniscient | greedy | 1000 | 94.3% [92.7–95.6] | 5.69 |
| planner | greedy | 1000 | 86.0% [83.8–88.1] | 6.01 |
| exploiter | planner | 400 | 62.2% [57.3–66.8] | 6.14 |
| exploiter | planner-mixed | 400 | 72.5% [68.0–76.7] | 6.12 |
| planner | planner-mixed | 1000 | 56.8% [53.7–59.8] | 6.26 |

### E5c. How often reading changes the plan (wiosenna)

E1 matches (planner vs planner, own veteran collections), N = 1000 matches: share of planner decisions whose chosen plan is not the plan greedy would play (the best plan if the rival did nothing).

| Measure | Value |
|---|---|
| Planner plan differs from greedy plan | 80.7% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e5 --slug wiosenna --seed 1` (5800 games, 845 s).

### E6a. Deck archetypes: win rate of the row deck against the column deck (wiosenna)

planner vs planner; both decks built from the same veteran collection (40 packs, 30 collections), the default budget; 300 games per pair, both seats.

| Row vs column | best | topHeavy | flat | teamStack | most Carry | most Mid | most Offlane | most Support | most Hard Supp |
|---|---|---|---|---|---|---|---|---|---|
| best | — | 56.3% | 65.3% | 45.8% | 48.7% | 49.7% | 54.4% | 49.5% | 51.7% |
| topHeavy | 43.7% | — | 53.2% | 47.8% | 48.1% | 42.7% | 55.7% | 54.3% | 46.8% |
| flat | 34.7% | 46.8% | — | 45.0% | 40.5% | 36.7% | 39.5% | 40.6% | 34.1% |
| teamStack | 54.2% | 52.2% | 55.0% | — | 55.7% | 51.0% | 56.9% | 52.5% | 54.0% |
| most Carry | 51.3% | 51.9% | 59.5% | 44.3% | — | 48.3% | 57.5% | 51.3% | 53.7% |
| most Mid | 50.3% | 57.3% | 63.3% | 49.0% | 51.7% | — | 64.5% | 53.0% | 50.7% |
| most Offlane | 45.6% | 44.3% | 60.5% | 43.1% | 42.5% | 35.5% | — | 42.8% | 46.0% |
| most Support | 50.5% | 45.7% | 59.4% | 47.5% | 48.7% | 47.0% | 57.2% | — | 51.0% |
| most Hard Supp | 48.3% | 53.2% | 65.9% | 46.0% | 46.3% | 49.3% | 54.0% | 49.0% | — |

### E6b. Deck archetypes against the field (wiosenna)

Each archetype's wins over all its games against the other eight. Targets: none above 60% or below 40%; best beats no other archetype by more than 60%.

| Archetype | Against the field [95% CI] | Deck cost | Deck baseMight |
|---|---|---|---|
| best | 52.7% [50.7–54.7] | 60.0 | 60.4 |
| topHeavy | 49.0% [47.0–51.0] | 59.8 | 55.5 |
| flat | 39.7% [37.8–41.7] | 60.0 | 60.4 |
| teamStack | 53.9% [51.9–55.9] | 59.8 | 58.1 |
| most Carry | 52.2% [50.2–54.2] | 60.0 | 60.4 |
| most Mid | 55.0% [53.0–57.0] | 60.0 | 60.4 |
| most Offlane | 45.0% [43.1–47.0] | 60.0 | 60.4 |
| most Support | 50.9% [48.9–52.9] | 60.0 | 60.4 |
| most Hard Supp | 51.5% [49.5–53.5] | 60.0 | 60.4 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e6 --slug wiosenna --seed 1 --games 300` (10800 games, 1963 s).

### E7a. Each ability switched off for both sides (wiosenna)

Rounds and comeback rate: planner vs planner with the same `best` veteran deck, 1000 games. Last column: win rate of the deck that leans on that ability (roleSkew of its role; teamStack for Drużyna) against `best` built from the same collection, with the ability on -> off (500 games each).

| Rules | Rounds per match | P(win \| behind after round 3) | Skewed deck vs best: on -> off |
|---|---|---|---|
| everything on | 6.26 | 36.7% [33.6–40.0] | — |
| Farma (Carry) | 6.39 | 37.2% [34.0–40.5] | most Carry: 48.5% [44.1–52.9] -> 50.9% [46.5–55.3] |
| Gank (Mid) | 6.15 | 28.9% [25.9–32.0] | most Mid: 59.9% [55.6–64.1] -> 47.6% [43.2–52.0] |
| Tank (Offlane) | 6.28 | 39.2% [36.0–42.5] | most Offlane: 47.8% [43.4–52.2] -> 41.5% [37.2–45.9] |
| Smoke (Soft Support) | 6.30 | 36.6% [33.4–39.9] | most Support: 49.1% [44.7–53.5] -> 50.8% [46.4–55.2] |
| Aura (Hard Support) | 6.23 | 34.5% [31.4–37.7] | most Hard Supp: 46.2% [41.9–50.6] -> 49.9% [45.5–54.3] |
| Drużyna (teams) | 6.29 | 35.0% [31.8–38.2] | teamStack: 55.5% [51.1–59.8] -> 55.9% [51.5–60.2] |

### E7b. Ability use per side per match, everything on (wiosenna)

Same matches as the first row above (N = 1000).

| Measure | Per side per match |
|---|---|
| Farma growth gained | 5.25 |
| Ganks that returned a unit | 1.62 |
| Ganks blocked by an Offlane (Tank) | 0.00 |
| Smoke free moves | 0.99 |
| Aura strength (summed over units and rounds) | 28.63 |
| Drużyna strength (summed over units and rounds) | 12.59 |
| High Ground strength (summed over units and rounds) | 3.26 |
| Twin Gates free moves | 0.51 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e7 --slug wiosenna --seed 1` (13000 games, 2288 s).

### E9a. Holding an objective in round 2 (wiosenna)

planner vs planner, `best` decks from own veteran collections, N = 2000. Win rate of the side that controlled the objective in round 2 (matches where someone did). Roshan's share of all damage in matches with Roshan: 51.1%.

| Objective | Matches with it | Controlled by someone in round 2 | Controller wins [95% CI] |
|---|---|---|---|
| High Ground | 1013 | 885 | 47.3% [44.1–50.6] |
| Roshan | 985 | 926 | 58.5% [55.3–61.7] |
| Outpost | 987 | 839 | 53.6% [50.3–57.0] |
| Twin Gates | 1023 | 720 | 49.0% [45.4–52.7] |
| Tormentor | 1017 | 802 | 55.0% [51.5–58.4] |
| Lotus Pool | 960 | 862 | 61.7% [58.4–64.9] |

### E9b. By trio of objectives (wiosenna)

Same matches. The game is symmetric, so a trio cannot favour a seat; what can differ is length and how decisive early control is.

| Trio | Matches | Rounds | Side with more objectives in round 2 wins | Roshan share of damage |
|---|---|---|---|---|
| gates + highground + lotus | 107 | 6.76 | 67.5% [56.5–76.9] | — |
| gates + highground + outpost | 103 | 6.85 | 55.6% [44.7–65.9] | — |
| gates + highground + roshan | 103 | 5.76 | 56.0% [44.7–66.7] | 50.7% |
| gates + highground + tormentor | 113 | 6.90 | 64.0% [52.7–73.9] | — |
| gates + lotus + outpost | 93 | 6.75 | 55.0% [44.1–65.4] | — |
| gates + lotus + roshan | 96 | 5.86 | 60.9% [48.7–71.9] | 51.8% |
| gates + lotus + tormentor | 104 | 6.75 | 67.1% [55.7–76.8] | — |
| gates + outpost + roshan | 96 | 5.72 | 49.3% [38.2–60.5] | 50.9% |
| gates + outpost + tormentor | 102 | 6.83 | 57.7% [46.6–68.0] | — |
| gates + roshan + tormentor | 110 | 5.83 | 56.9% [44.1–68.8] | 51.6% |
| highground + lotus + outpost | 99 | 6.72 | 67.6% [56.3–77.1] | — |
| highground + lotus + roshan | 78 | 5.77 | 62.5% [48.4–74.8] | 50.8% |
| highground + lotus + tormentor | 108 | 6.70 | 63.9% [53.1–73.4] | — |
| highground + outpost + roshan | 119 | 5.75 | 62.9% [52.5–72.2] | 51.1% |
| highground + outpost + tormentor | 89 | 6.70 | 57.1% [45.5–68.1] | — |
| highground + roshan + tormentor | 97 | 5.75 | 59.7% [48.2–70.3] | 50.9% |
| lotus + outpost + roshan | 88 | 5.89 | 68.7% [56.8–78.5] | 50.4% |
| lotus + outpost + tormentor | 97 | 6.68 | 77.6% [67.1–85.5] | — |
| lotus + roshan + tormentor | 94 | 5.67 | 69.8% [57.6–79.8] | 51.6% |
| outpost + roshan + tormentor | 104 | 5.78 | 57.8% [45.6–69.1] | 51.2% |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e9 --slug wiosenna --seed 1` (2000 games, 421 s).

### E11a. Team decks next to budget decks (wiosenna)

98 team decks (team x period, 9 periods from seasonPeriods). 18 (18.4%) have fewer than 12 cards; smallest 4. Numbers are min / Q1 / median / Q3 / max.

| Decks | Total baseMight | Total cost | Cards |
|---|---|---|---|
| Team decks | 10 / 36 / 51 / 60 / 83 | 9 / 37 / 53 / 61 / 84 | 4 / 12 / 12 / 12 / 12 |
| best default-budget deck, new (10 packs, 50 collections) | 53 / 58 / 59 / 60 / 61 | 53 / 60 / 61 / 63 / 65 | 12 |
| best default-budget deck, regular (20 packs, 50 collections) | 58 / 60 / 60 / 61 / 61 | 60 / 62 / 63 / 64 / 65 | 12 |
| best default-budget deck, veteran (40 packs, 50 collections) | 60 / 60 / 60 / 60 / 61 | 61 / 63 / 64 / 64 / 65 | 12 |

### E11b. Human proxy vs team decks played by the greedy computer (wiosenna)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 10-32) | band 2 (might 32-48) | band 3 (might 49-53) | band 4 (might 53-61) | band 5 (might 63-83) |
|---|---|---|---|---|---|
| greedy, new | 94.3% [91.1–96.4] | 68.0% [62.5–73.0] | 42.6% [37.1–48.3] | 30.8% [25.8–36.2] | 10.7% [7.7–14.7] |
| greedy, regular | 95.0% [91.9–96.9] | 72.7% [67.4–77.4] | 46.3% [40.7–52.0] | 35.9% [30.7–41.5] | 13.7% [10.3–18.1] |
| greedy, veteran | 95.0% [91.9–96.9] | 75.3% [70.2–79.9] | 53.4% [47.7–58.9] | 41.1% [35.6–46.8] | 18.0% [14.1–22.7] |
| planner, new | 99.3% [97.6–99.8] | 91.0% [87.2–93.7] | 76.3% [71.1–80.7] | 59.5% [53.9–64.9] | 27.8% [23.0–33.1] |
| planner, regular | 100.0% [98.7–100.0] | 95.3% [92.3–97.2] | 84.0% [79.4–87.7] | 70.9% [65.5–75.8] | 36.2% [31.0–41.8] |
| planner, veteran | 99.7% [98.1–99.9] | 95.0% [91.9–96.9] | 87.3% [83.0–90.6] | 69.0% [63.6–74.0] | 34.0% [28.9–39.5] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug wiosenna --seed 1` (9000 games, 611 s).

### E11a. Team decks next to budget decks (pdl-s2)

22 team decks (team x period, 2 periods from seasonPeriods). 22 (100.0%) have fewer than 12 cards; smallest 4. Numbers are min / Q1 / median / Q3 / max.

| Decks | Total baseMight | Total cost | Cards |
|---|---|---|---|
| Team decks | 8 / 18 / 28 / 42 / 67 | 8 / 19 / 28 / 43 / 67 | 4 / 5 / 5 / 10 / 10 |
| best default-budget deck, new (10 packs, 50 collections) | 76 / 85 / 87 / 92 / 96 | 76 / 86 / 88 / 92 / 95 | 12 |
| best default-budget deck, regular (20 packs, 50 collections) | 90 / 93 / 96 / 98 / 101 | 90 / 93 / 95 / 96 / 98 | 12 |
| best default-budget deck, veteran (40 packs, 50 collections) | 93 / 99 / 100 / 100 / 103 | 93 / 97 / 98 / 98 / 98 | 12 |

### E11b. Human proxy vs team decks played by the greedy computer (pdl-s2)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 8-16) | band 2 (might 18-19) | band 3 (might 20-31) | band 4 (might 31-44) | band 5 (might 48-67) |
|---|---|---|---|---|---|
| greedy, new | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 99.7% [98.1–99.9] | 97.7% [95.3–98.9] | 80.3% [75.5–84.4] |
| greedy, regular | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 98.7% [96.6–99.5] | 89.3% [85.3–92.3] |
| greedy, veteran | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 98.3% [96.2–99.3] | 91.7% [88.0–94.3] |
| planner, new | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 96.0% [93.1–97.7] |
| planner, regular | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] |
| planner, veteran | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug pdl-s2 --seed 1` (9000 games, 474 s).

### E11a. Team decks next to budget decks (wiosenna)

98 team decks (team x period, 9 periods from seasonPeriods). 18 (18.4%) have fewer than 12 cards; smallest 4. Numbers are min / Q1 / median / Q3 / max.

| Decks | Total baseMight | Total cost | Cards |
|---|---|---|---|
| Team decks | 10 / 36 / 51 / 60 / 83 | 9 / 37 / 53 / 61 / 84 | 4 / 12 / 12 / 12 / 12 |
| best default-budget deck, new (10 packs, 50 collections) | 53 / 59 / 64 / 71 / 78 | 53 / 60 / 66 / 72 / 78 | 12 |
| best default-budget deck, regular (20 packs, 50 collections) | 59 / 73 / 76 / 79 / 85 | 61 / 74 / 77 / 80 / 84 | 12 |
| best default-budget deck, veteran (40 packs, 50 collections) | 74 / 81 / 84 / 85 / 87 | 79 / 82 / 85 / 86 / 87 | 12 |

### E11b. Human proxy vs team decks played by the greedy computer (wiosenna)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 10-32) | band 2 (might 32-48) | band 3 (might 49-53) | band 4 (might 53-61) | band 5 (might 63-83) |
|---|---|---|---|---|---|
| greedy, new | 94.3% [91.1–96.4] | 78.7% [73.7–82.9] | 54.9% [49.2–60.4] | 40.8% [35.4–46.5] | 18.3% [14.4–23.1] |
| greedy, regular | 98.7% [96.6–99.5] | 89.0% [85.0–92.1] | 79.3% [74.3–83.5] | 71.0% [65.6–75.8] | 35.3% [30.1–40.9] |
| greedy, veteran | 98.0% [95.7–99.1] | 93.3% [89.9–95.6] | 86.0% [81.6–89.5] | 80.0% [75.1–84.1] | 47.3% [41.7–53.0] |
| planner, new | 100.0% [98.7–100.0] | 95.3% [92.3–97.2] | 81.3% [76.5–85.3] | 72.2% [66.9–77.0] | 37.8% [32.5–43.4] |
| planner, regular | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 96.3% [93.6–97.9] | 88.6% [84.5–91.7] | 68.3% [62.9–73.3] |
| planner, veteran | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 99.3% [97.6–99.8] | 97.7% [95.3–98.9] | 80.3% [75.5–84.4] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug wiosenna --seed 1` (9000 games, 696 s).

### E11a. Team decks next to budget decks (pdl-s2)

22 team decks (team x period, 2 periods from seasonPeriods). 22 (100.0%) have fewer than 12 cards; smallest 4. Numbers are min / Q1 / median / Q3 / max.

| Decks | Total baseMight | Total cost | Cards |
|---|---|---|---|
| Team decks | 8 / 18 / 28 / 42 / 67 | 8 / 19 / 28 / 43 / 67 | 4 / 5 / 5 / 10 / 10 |
| best default-budget deck, new (10 packs, 50 collections) | 60 / 60 / 60 / 61 / 62 | 62 / 64 / 65 / 65 / 65 | 12 |
| best default-budget deck, regular (20 packs, 50 collections) | 60 / 60 / 61 / 61 / 62 | 62 / 64 / 65 / 65 / 65 | 12 |
| best default-budget deck, veteran (40 packs, 50 collections) | 60 / 61 / 61 / 61 / 62 | 63 / 64 / 65 / 65 / 65 | 12 |

### E11b. Human proxy vs team decks played by the greedy computer (pdl-s2)

Proxy (row) with a `best` default-budget deck from its collection vs the computer with a team deck from the band (team decks sorted by total baseMight, in fifths). 300 games per cell, both seats. Win rate of the proxy. Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.

| Proxy | band 1 (might 8-16) | band 2 (might 18-19) | band 3 (might 20-31) | band 4 (might 31-44) | band 5 (might 48-67) |
|---|---|---|---|---|---|
| greedy, new | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 94.0% [90.7–96.2] | 73.2% [68.0–77.9] | 29.8% [24.9–35.2] |
| greedy, regular | 100.0% [98.7–100.0] | 99.0% [97.1–99.7] | 96.7% [94.0–98.2] | 81.7% [76.9–85.6] | 31.9% [26.8–37.4] |
| greedy, veteran | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 94.7% [91.5–96.7] | 78.3% [73.3–82.6] | 28.1% [23.3–33.4] |
| planner, new | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 98.7% [96.6–99.5] | 96.0% [93.1–97.7] | 57.4% [51.7–62.9] |
| planner, regular | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 99.7% [98.1–99.9] | 94.3% [91.1–96.4] | 56.5% [50.9–62.0] |
| planner, veteran | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 100.0% [98.7–100.0] | 92.7% [89.1–95.1] | 57.7% [52.0–63.1] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug pdl-s2 --seed 1` (9000 games, 592 s).

### E20a. Practice levels against each other (wiosenna)

Both sides play the same best budget deck from one veteran collection per pair; 600 games per pair, both seats. Target: each level beats the one below it between 60 and 85%.

| Level | Against | Wins [95% CI] | Rounds |
|---|---|---|---|
| Średni | Łatwy | 90.8% [88.2–92.8] | 5.90 |
| Trudny | Średni | 60.4% [56.5–64.3] | 6.22 |
| Trudny | Łatwy | 93.3% [91.0–95.0] | 5.74 |
| Łatwy | Kolejka | 30.8% [27.2–34.6] | 6.43 |

### E20b. Thinking time per level (wiosenna)

Milliseconds in Node on this machine, with other simulations running beside it, so an upper bound for a desktop; a phone is several times slower. Per round = plan and fight together.

| Level | Mean per round | Median of the slowest round of a match | 95th percentile of the slowest round |
|---|---|---|---|
| Łatwy | 16.7 | 32.5 | 56.0 |
| Średni | 129.2 | 251.1 | 513.4 |
| Trudny | 327.9 | 605.0 | 965.5 |
| Kolejka | 15.0 | 29.4 | 47.6 |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e20 --slug wiosenna --seed 1` (2400 games, 319 s).
