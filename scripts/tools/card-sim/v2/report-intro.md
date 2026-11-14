# v2 prototype: simulation report

Simulations of the redesigned card-game core ("v2", `src/features/cards/domain/v2/`), run for `docs/overhaul/GAME_DESIGN.md`. All games are computer against computer on the real cards of Wiosenna (851 cards) and PDL S2 (117 cards). Every run is seeded; the command under each table reproduces it.

There are two folders:

- `docs/overhaul/sim/v2/` (this report when built without `SIM_OUT`): the **settled rules**, which are `DEFAULT_RULES` in `rules.ts`. These are the numbers `GAME_DESIGN.md` section 9 quotes.
- `docs/overhaul/sim/v2-first/` (built with `SIM_OUT=v2-first`): the **first candidate rules** (`FIRST_RULES`: budget 66 counted on rating strength, Tank blocks ganks, Smoke frees a move from where the Support stood, every Hard Support adds its own Aura, High Ground helps all units, no Comeback card) in E1 to E10, and the knob experiments that led from them to the settled rules: E8, E13 and E14 change one thing at a time from the first rules; E15 and E16 from the rules as they stood at that step. Their titles say what each row changes.

How to read the numbers:

- Win rates are over decided games, with a 95% Wilson interval. The interval treats games as independent. Decks come from a limited number of simulated collections (100 pairs per cell, 250 in E2), so the real uncertainty of a deck-strength comparison is a few points wider than the interval shown. Differences of under five points between two rows of a knob table are not evidence.
- The computer players, weakest to strongest: `random`; `greedy` (assumes the rival does nothing this round); `responder` (predicts the rival with `greedy` and answers); `planner` (scores its plans against a sample of plausible rival plans and looks for lethal damage). None of them sees the rival's hand, deck order or plan. `omniscient` and `exploiter` are measuring tools: the first is handed the rival's plan each round, the second knows which program the rival is.
- "New player", "regular" and "veteran" are collections of 10, 20 and 40 packs opened with the site's pack rule. `best` is the strongest legal deck within the budget from a collection.
