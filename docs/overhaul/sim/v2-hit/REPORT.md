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

### E19a. The fight step and the design's targets (wiosenna)

500 games per cell. Rounds, comeback, never trailed and the fight columns: planner vs planner with the same best deck. Veteran vs new: 200 collection pairs. Skill: planner vs greedy, same deck. Shape: a deck of few strong cards and cheap fillers against a deck of even cards (30 collections). Fights per match counts contested objectives over the match; a flip is a contested objective whose controller the fight changed.

| Rules | Rounds | P(win \| behind after round 3) | Winner never trailed | Veteran wins vs new | Planner beats greedy | Stars beat even decks | Fights per match | Hits landed / guarded per side | Fights that change control |
|---|---|---|---|---|---|---|---|---|---|
| final rules (a hit takes 3) | 6.32 | 37.2% [32.7–41.9] | 40.6% | 61.8% [57.5–66.0] | 86.0% [82.6–88.7] | 57.1% [52.7–61.4] | 11.99 | 3.76 / 2.19 | 9.0% |

### E19b. Choosing well in the fight (wiosenna)

Both sides are the planner with the same deck and plan the same way; only how they fight differs. Rules: {}. 500 games per pair. obvious = hit the strongest, guard the own strongest; answer = best choice against obvious; mixed = unpredictable (equilibrium weights); random = any choice.

| Row fights | Rival fights | Row wins [95% CI] |
|---|---|---|
| obvious | random | 65.1% [60.8–69.2] |
| answer | obvious | 84.0% [80.5–86.9] |
| mixed | obvious | 54.4% [50.0–58.7] |
| mixed | answer | 54.8% [50.4–59.1] |
| mixed | random | 65.4% [61.1–69.4] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e19 --slug wiosenna --seed 1 --games 500` (4500 games, 728 s).

### E19a. The fight step and the design's targets (wiosenna)

500 games per cell. Rounds, comeback, never trailed and the fight columns: planner vs planner with the same best deck. Veteran vs new: 200 collection pairs. Skill: planner vs greedy, same deck. Shape: a deck of few strong cards and cheap fillers against a deck of even cards (30 collections). Fights per match counts contested objectives over the match; a flip is a contested objective whose controller the fight changed.

| Rules | Rounds | P(win \| behind after round 3) | Winner never trailed | Veteran wins vs new | Planner beats greedy | Stars beat even decks | Fights per match | Hits landed / guarded per side | Fights that change control |
|---|---|---|---|---|---|---|---|---|---|
| a hit takes 3 and switches off what the unit gives others | 6.31 | 35.7% [31.2–40.4] | 41.2% | 59.0% [54.7–63.3] | 80.4% [76.7–83.6] | 57.7% [53.3–61.9] | 12.00 | 3.62 / 2.31 | 12.8% |

### E19b. Choosing well in the fight (wiosenna)

Both sides are the planner with the same deck and plan the same way; only how they fight differs. Rules: {"hitDisables":true}. 500 games per pair. obvious = hit the strongest, guard the own strongest; answer = best choice against obvious; mixed = unpredictable (equilibrium weights); random = any choice.

| Row fights | Rival fights | Row wins [95% CI] |
|---|---|---|
| obvious | random | 83.4% [79.8–86.4] |
| answer | obvious | 86.8% [83.5–89.5] |
| mixed | obvious | 53.8% [49.4–58.1] |
| mixed | answer | 56.8% [52.4–61.1] |
| mixed | random | 72.4% [68.3–76.2] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e19 --slug wiosenna --seed 1 --games 500` (4500 games, 679 s).

### E19a. The fight step and the design's targets (wiosenna)

500 games per cell. Rounds, comeback, never trailed and the fight columns: planner vs planner with the same best deck. Veteran vs new: 200 collection pairs. Skill: planner vs greedy, same deck. Shape: a deck of few strong cards and cheap fillers against a deck of even cards (30 collections). Fights per match counts contested objectives over the match; a flip is a contested objective whose controller the fight changed.

| Rules | Rounds | P(win \| behind after round 3) | Winner never trailed | Veteran wins vs new | Planner beats greedy | Stars beat even decks | Fights per match | Hits landed / guarded per side | Fights that change control |
|---|---|---|---|---|---|---|---|---|---|
| a hit takes half the strength of the unit | 6.34 | 35.5% [31.0–40.3] | 41.6% | 58.6% [54.2–62.8] | 82.1% [78.5–85.2] | 55.5% [51.1–59.8] | 12.08 | 3.70 / 2.26 | 11.9% |

### E19b. Choosing well in the fight (wiosenna)

Both sides are the planner with the same deck and plan the same way; only how they fight differs. Rules: {"hitEffect":"half"}. 500 games per pair. obvious = hit the strongest, guard the own strongest; answer = best choice against obvious; mixed = unpredictable (equilibrium weights); random = any choice.

| Row fights | Rival fights | Row wins [95% CI] |
|---|---|---|
| obvious | random | 71.9% [67.8–75.7] |
| answer | obvious | 87.8% [84.6–90.4] |
| mixed | obvious | 54.4% [50.0–58.7] |
| mixed | answer | 58.4% [54.1–62.7] |
| mixed | random | 67.9% [63.7–71.9] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e19 --slug wiosenna --seed 1 --games 500` (4500 games, 708 s).

### E19a. The fight step and the design's targets (wiosenna)

500 games per cell. Rounds, comeback, never trailed and the fight columns: planner vs planner with the same best deck. Veteran vs new: 200 collection pairs. Skill: planner vs greedy, same deck. Shape: a deck of few strong cards and cheap fillers against a deck of even cards (30 collections). Fights per match counts contested objectives over the match; a flip is a contested objective whose controller the fight changed.

| Rules | Rounds | P(win \| behind after round 3) | Winner never trailed | Veteran wins vs new | Planner beats greedy | Stars beat even decks | Fights per match | Hits landed / guarded per side | Fights that change control |
|---|---|---|---|---|---|---|---|---|---|
| a hit takes half and switches off what the unit gives | 6.36 | 37.3% [32.8–42.1] | 39.5% | 60.3% [56.0–64.5] | 76.9% [73.0–80.4] | 54.9% [50.5–59.2] | 12.22 | 3.60 / 2.38 | 15.0% |

### E19b. Choosing well in the fight (wiosenna)

Both sides are the planner with the same deck and plan the same way; only how they fight differs. Rules: {"hitEffect":"half","hitDisables":true}. 500 games per pair. obvious = hit the strongest, guard the own strongest; answer = best choice against obvious; mixed = unpredictable (equilibrium weights); random = any choice.

| Row fights | Rival fights | Row wins [95% CI] |
|---|---|---|
| obvious | random | 82.4% [78.8–85.5] |
| answer | obvious | 91.2% [88.4–93.4] |
| mixed | obvious | 57.7% [53.3–62.0] |
| mixed | answer | 57.4% [53.0–61.7] |
| mixed | random | 72.3% [68.3–76.1] |



Command: `npx tsx scripts/tools/card-sim/run-v2.ts e19 --slug wiosenna --seed 1 --games 500` (4500 games, 732 s).
