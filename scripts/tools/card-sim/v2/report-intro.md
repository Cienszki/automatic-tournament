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
