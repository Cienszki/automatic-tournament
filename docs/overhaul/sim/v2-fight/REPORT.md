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
