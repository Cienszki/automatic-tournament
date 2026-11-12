# Overhaul status

Every session updates this file as it works, not only at the end. A new session, on any model, must be able to continue from it alone.

## Next step

Run session S0 (groundwork) from `PROMPTS.md`, on Opus.

## Sessions

| Session | Model | State | Output |
|---|---|---|---|
| S0 Groundwork: safety net + inventories | Opus | not started | `inventory/*.md`, CI, green tests |
| S1 Architecture, scale, code health, testing | Fable | not started | `ARCHITECTURE.md`, `TEST_STRATEGY.md`, `ROADMAP.md`, `CONVENTIONS.md` |
| S2 Organizer experience: admin, wizard, customization | Fable | not started | `ORGANIZER_UX.md`, prototypes |
| S3 Card game | Fable | not started | `GAME_DESIGN.md` |
| S4 Business and marketing | Opus, or Fable if quota is left | not started | `docs/business/*` |
| S5+ Implementation of the roadmap | Fable or Opus as orchestrator | not started | `wp/*` branches merged into `overhaul` |

## Work packages

Filled in by S1, and later by S2 and S3. One line per WP: id, name, branch, state (planned / in progress / in review / merged / dropped), notes.

| WP | Name | Branch | State | Notes |
|---|---|---|---|---|

## Questions for the owner

Each question has the asking session, the recommended answer, and whether work continued on that recommendation.

## Log

- 2026-11-12: restore tag `restore/pre-overhaul-2026-11-12` pushed in all three repos. Branch `overhaul` and worktree `.claude/worktrees/overhaul` created from `feature/multi-tournament-platform` at `0fe0974`. Brief, agents and prompts written.
