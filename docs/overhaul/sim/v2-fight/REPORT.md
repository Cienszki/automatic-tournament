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



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e1 --slug wiosenna --seed 1` (1000 games, 239 s).

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



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e2 --slug wiosenna --seed 1` (6000 games, 949 s).

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



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e4 --slug wiosenna --seed 1` (1000 games, 155 s).

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



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug wiosenna --seed 1` (9000 games, 604 s).

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
| greedy, new | 96.3% [93.6–97.9] | 77.0% [71.9–81.4] | 44.1% [38.6–49.8] | 30.4% [25.5–35.9] | 7.0% [4.6–10.5] |
| greedy, regular | 99.7% [98.1–99.9] | 92.3% [88.8–94.8] | 75.3% [70.1–79.8] | 57.3% [51.7–62.8] | 21.0% [16.8–26.0] |
| greedy, veteran | 99.7% [98.1–99.9] | 98.0% [95.7–99.1] | 89.7% [85.7–92.6] | 76.5% [71.4–81.0] | 34.7% [29.5–40.2] |
| planner, new | 99.7% [98.1–99.9] | 89.3% [85.3–92.3] | 68.3% [62.9–73.3] | 50.2% [44.5–55.8] | 17.4% [13.5–22.1] |
| planner, regular | 100.0% [98.7–100.0] | 98.3% [96.2–99.3] | 91.3% [87.6–94.0] | 79.6% [74.7–83.8] | 37.8% [32.5–43.4] |
| planner, veteran | 100.0% [98.7–100.0] | 99.0% [97.1–99.7] | 96.3% [93.6–97.9] | 92.7% [89.1–95.1] | 57.7% [52.0–63.2] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e11 --slug wiosenna --seed 1` (9000 games, 522 s).

### E19a. The fight step and the design's targets (wiosenna)

600 games per cell. Rounds, comeback, never trailed and the fight columns: planner vs planner with the same best deck. Veteran vs new: 200 collection pairs. Skill: planner vs greedy, same deck. Shape: a deck of few strong cards and cheap fillers against a deck of even cards (30 collections). Fights per match counts contested objectives over the match; a flip is a contested objective whose controller the fight changed.

| Rules | Rounds | P(win \| behind after round 3) | Winner never trailed | Veteran wins vs new | Planner beats greedy | Stars beat even decks | Fights per match | Hits landed / guarded per side | Fights that change control |
|---|---|---|---|---|---|---|---|---|---|
| settled rules, no fight step | 5.68 | 35.2% [31.2–39.4] | 43.6% | 57.9% [53.9–61.8] | 78.7% [75.2–81.8] | 80.3% [76.9–83.3] | — | — | — |
| fight step | 5.69 | 36.7% [32.7–41.0] | 41.4% | 55.3% [51.3–59.2] | 60.0% [56.0–63.8] | 80.7% [77.3–83.6] | 11.77 | 4.97 / 6.45 | 21.7% |
| fight step, Ancients 16 HP | 6.75 | 36.7% [32.7–40.9] | 40.5% | 55.7% [51.7–59.6] | 52.2% [48.2–56.2] | 83.3% [80.1–86.1] | 15.02 | 6.74 / 7.92 | 23.1% |
| fight step, Ancients 16 HP, last round 10 | 6.79 | 40.9% [36.8–45.2] | 35.0% | 54.7% [50.7–58.6] | 51.9% [47.9–55.9] | 85.3% [82.2–87.9] | 15.20 | 6.89 / 7.94 | 22.5% |
| fight step, Ancients 16 HP, no Gank | 6.71 | 31.7% [27.8–35.8] | 50.3% | 57.8% [53.8–61.7] | 52.8% [48.8–56.8] | 90.3% [87.7–92.4] | 15.88 | 7.01 / 8.38 | 22.7% |

### E19b. Choosing well in the fight (wiosenna)

Both sides are the planner with the same deck and plan the same way; only how they fight differs. Rules: fight step, Ancients 16 HP. 600 games per pair. obvious = hit the strongest, guard the own strongest; answer = best choice against obvious; mixed = unpredictable (equilibrium weights); random = any choice.

| Row fights | Rival fights | Row wins [95% CI] |
|---|---|---|
| obvious | random | 63.4% [59.5–67.2] |
| answer | obvious | 99.2% [98.1–99.6] |
| mixed | obvious | 52.8% [48.8–56.8] |
| mixed | answer | 51.4% [47.4–55.4] |
| mixed | random | 57.9% [53.9–61.8] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e19 --slug wiosenna --seed 1 --games 600` (15000 games, 995 s).

### E19a. The fight step and the design's targets (wiosenna)

600 games per cell. Rounds, comeback, never trailed and the fight columns: planner vs planner with the same best deck. Veteran vs new: 200 collection pairs. Skill: planner vs greedy, same deck. Shape: a deck of few strong cards and cheap fillers against a deck of even cards (30 collections). Fights per match counts contested objectives over the match; a flip is a contested objective whose controller the fight changed.

| Rules | Rounds | P(win \| behind after round 3) | Winner never trailed | Veteran wins vs new | Planner beats greedy | Stars beat even decks | Fights per match | Hits landed / guarded per side | Fights that change control |
|---|---|---|---|---|---|---|---|---|---|
| settled rules, no fight step | 5.68 | 35.2% [31.2–39.4] | 43.6% | 57.9% [53.9–61.8] | 78.7% [75.2–81.8] | 80.3% [76.9–83.3] | — | — | — |
| one hit a round, -3 strength | 5.70 | 34.9% [30.9–39.1] | 38.7% | 60.9% [57.0–64.8] | 74.8% [71.2–78.1] | 80.0% [76.6–83.0] | 11.79 | 3.06 / 2.17 | 11.6% |
| one hit a round, -3 strength, Ancients 14 HP | 6.30 | 36.8% [32.7–41.1] | 42.9% | 60.2% [56.2–64.0] | 73.0% [69.3–76.4] | 81.7% [78.4–84.6] | 13.54 | 3.47 / 2.40 | 11.5% |
| one hit a round, -4 strength, Ancients 14 HP | 6.25 | 40.7% [36.6–45.0] | 37.3% | 60.4% [56.5–64.3] | 70.0% [66.2–73.5] | 81.0% [77.6–83.9] | 13.34 | 3.42 / 2.40 | 13.8% |
| one hit a round, -3 strength, Ancients 16 HP, last round 10 | 6.88 | 39.0% [34.9–43.3] | 35.3% | 60.3% [56.4–64.2] | 72.8% [69.1–76.2] | 84.0% [80.9–86.7] | 15.52 | 3.92 / 2.58 | 11.3% |

### E19b. Choosing well in the fight (wiosenna)

Both sides are the planner with the same deck and plan the same way; only how they fight differs. Rules: {"fight":"oneStrike","hitEffect":3,"hp":14}. 600 games per pair. obvious = hit the strongest, guard the own strongest; answer = best choice against obvious; mixed = unpredictable (equilibrium weights); random = any choice.

| Row fights | Rival fights | Row wins [95% CI] |
|---|---|---|
| obvious | random | 68.2% [64.4–71.8] |
| answer | obvious | 87.1% [84.2–89.6] |
| mixed | obvious | 53.8% [49.8–57.8] |
| mixed | answer | 57.3% [53.3–61.2] |
| mixed | random | 71.1% [67.4–74.6] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e19 --slug wiosenna --seed 1 --games 600` (15000 games, 1270 s).

### E19a. The fight step and the design's targets (wiosenna)

600 games per cell. Rounds, comeback, never trailed and the fight columns: planner vs planner with the same best deck. Veteran vs new: 200 collection pairs. Skill: planner vs greedy, same deck. Shape: a deck of few strong cards and cheap fillers against a deck of even cards (30 collections). Fights per match counts contested objectives over the match; a flip is a contested objective whose controller the fight changed.

| Rules | Rounds | P(win \| behind after round 3) | Winner never trailed | Veteran wins vs new | Planner beats greedy | Stars beat even decks | Fights per match | Hits landed / guarded per side | Fights that change control |
|---|---|---|---|---|---|---|---|---|---|
| settled rules, no fight step | 5.68 | 35.2% [31.2–39.4] | 43.6% | 57.9% [53.9–61.8] | 78.7% [75.2–81.8] | 80.3% [76.9–83.3] | — | — | — |
| one hit and one guard a round | 5.68 | 34.2% [30.3–38.4] | 43.2% | 54.8% [50.8–58.7] | 67.4% [63.6–71.1] | 74.7% [71.0–78.0] | 11.69 | 3.08 / 2.13 | 22.9% |
| one hit and one guard, Ancients 14 HP | 6.27 | 36.4% [32.4–40.7] | 44.6% | 55.1% [51.1–59.1] | 63.9% [60.0–67.7] | 77.5% [74.0–80.7] | 13.41 | 3.46 / 2.39 | 23.8% |
| one hit and one guard, Ancients 14 HP, no Gank | 6.26 | 32.8% [28.9–37.0] | 52.0% | 60.7% [56.7–64.5] | 64.3% [60.4–68.0] | 84.3% [81.2–87.0] | 14.32 | 3.68 / 2.48 | 23.9% |
| one hit and one guard, a hit takes 3 strength | 5.75 | 35.3% [31.2–39.5] | 42.0% | 58.2% [54.2–62.0] | 78.1% [74.6–81.3] | 77.0% [73.4–80.2] | 11.94 | 3.10 / 2.16 | 11.1% |
| hit and guard on every objective, a hit takes 2 strength | 5.70 | 37.2% [33.1–41.4] | 41.2% | 57.3% [53.3–61.2] | 73.2% [69.5–76.6] | 77.2% [73.6–80.3] | 11.82 | 4.88 / 6.55 | 7.4% |

### E19b. Choosing well in the fight (wiosenna)

Both sides are the planner with the same deck and plan the same way; only how they fight differs. Rules: {"fight":"oneStrike","hp":14}. 600 games per pair. obvious = hit the strongest, guard the own strongest; answer = best choice against obvious; mixed = unpredictable (equilibrium weights); random = any choice.

| Row fights | Rival fights | Row wins [95% CI] |
|---|---|---|
| obvious | random | 80.1% [76.8–83.1] |
| answer | obvious | 97.3% [95.7–98.4] |
| mixed | obvious | 55.8% [51.8–59.7] |
| mixed | answer | 52.3% [48.3–56.2] |
| mixed | random | 75.3% [71.7–78.6] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e19 --slug wiosenna --seed 1 --games 600` (17400 games, 1219 s).
