# Overhaul status

Every session updates this file as it works, not only at the end. A new session, on any model, must be able to continue from it alone.

## Next step

S1 is in progress (2026-11-13, Fable). `ARCHITECTURE.md` is written and committed. Still to write, in this order: `CONVENTIONS.md`, `TEST_STRATEGY.md`, `ROADMAP.md`, then the work-package table and new questions in this file. If S1 stopped here, continue with the first of those that does not exist yet, following the S1 prompt in `PROMPTS.md` and the decisions in `ARCHITECTURE.md`.

## Sessions

| Session | Model | State | Output |
|---|---|---|---|
| S0 Groundwork: safety net + inventories | Opus | done 2026-11-13 | `inventory/*.md`, CI, green tests |
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

1. **(S0, urgent) Copy the bot-route security fix into production?** Commit `3db4e3e` on `overhaul`. In production, any signed-in visitor can list, add, re-password, disable or delete the lobby bot's Steam accounts, and edit any tournament's lobby whitelist (`/api/manage/bot/accounts`, `accounts/[id]`, `pool-status`, `whitelist` only check that a token is valid). Recommended: cherry-pick `3db4e3e` onto `feature/multi-tournament-platform` and deploy soon. It touches four route files and one line of `BotTab.tsx`. Not done by S0, because S0 may not deploy or push that branch.
2. **(S0) Browser measurements for PAGES.md.** The headless browser (Edge through puppeteer-core) cannot start inside this session's command sandbox, and running it outside the sandbox was refused. TTFB, page weight and Firestore round-trip times were measured with curl instead. Recommended: run `node scripts/measure-pages.js` yourself once (see `inventory/PAGES.md`), or allow the browser for the S1 session. Work continued without it.
3. **(S0) `firestore.rules` changed on `overhaul`** (reserved slugs `card-lab`, `stats-lab`, `opengraph-image`). Not deployed. Recommended: deploy with the next rules deploy; it only rejects more slugs.

## Log

- 2026-11-13 (S0): Part B done: `inventory/{PAGES, ADMIN, DATA, SCALE, PRODUCT, TESTS, CARDS, CODE_HEALTH}.md`. Explorer agents drafted them; Opus checked and corrected them. PAGES.md has curl and build measurements but no browser measurements (question 2). The repo table in BRIEF.md is corrected: the live lobby bot is `bot-worker/`. CI passed on GitHub (run 43327108507, commit `62fbe0b`).
- 2026-11-13 (S0): Part A done. Tests green (reserved slug `card-lab`; Swiss pairing search sped up about 4x with identical output). CI added (`.github/workflows/ci.yml`); ESLint set up for the first time (0 errors). Deleted `src/app/api/admin/**` plus two prefix-sharing routes, 21 orphaned modules and 9 root one-off scripts (about 15,000 lines). Fixed open bot-account routes (`3db4e3e`).
- 2026-11-13 (S0) **Incident, read-only:** the first local `next build` loaded the worktree's `.env.local`, which holds the production service account, and prerendering `/sitemap.xml` read the production `tournaments` collection once (no writes). Every later local build and `next start` ran with `FIREBASE_SERVICE_ACCOUNT_BASE64=` and the other secrets blanked, checked by the sitemap coming out empty. Future sessions: always blank them, or the sitemap and any prerendered page read production. The underlying problem (the sitemap is built from production data at build time) is in `inventory/PAGES.md`.
- 2026-11-12: restore tag `restore/pre-overhaul-2026-11-12` pushed in all three repos. Branch `overhaul` and worktree `.claude/worktrees/overhaul` created from `feature/multi-tournament-platform` at `0fe0974`. Brief, agents and prompts written.
