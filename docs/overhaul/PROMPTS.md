# Session prompts

**How the overhaul is worked on (owner, 2026-11-23).** One step per session, because a long session gets expensive. The owner opens a new session, pastes the step's prompt (one message, sometimes a second with answers), the session does the step, and its last message says the step is done and which prompt to paste next. Start every session with Claude Code opened in the worktree folder `.claude/worktrees/overhaul`, so the agents in `.claude/agents/` load. Model: **Opus 5.5 for everything** (Fable can no longer be used). Effort: `high`.

Two rules every session keeps:
1. **The step log below is always true.** A session marks its step done there before it ends. This is the most important rule.
2. **The prompts are always current.** When a step changes a design, a file name, the order or what a later step needs, it updates the later prompts in this file in the same session.

---

## Step log

| Step | What | State | Result |
|---|---|---|---|
| S0 to S3 | Groundwork, architecture, organizer experience, card game | done 2026-11-13 to 14 | See "Sessions" in `STATUS.md` |
| S4 | Business and marketing | not started | Optional; prompt at the bottom |
| S5 | Implementation up to stage 1 (WP-04, 05, 12, 13a, 20, 32; card game WP-50 to 55, 64, 65) | done 2026-11-13 to 17 | Merged into `overhaul` |
| S6 | Stage 1: WP-03 environments, WP-33 import, WP-66 part 1, WP-06 local half | **done 2026-11-23** | WP-03, WP-33 and WP-66 part 1 merged; WP-06 local half built and reviewed on `wp/06-hosting-trial`, waiting for the staging run; questions 41 to 43 for the owner |
| S7 | WP-06 staging run and the hosting decision | **stopped 2026-11-24**, waiting for the owner's protection-bypass secret | Done: staging migrated and marked `staging`, seeded, pdl-s2 imported anonymized; preview `tournament-platform-cwov6snzg-pd-2-ih.vercel.app` deployed (functions in `fra1`); `pg_cron` and `pg_net` proven (WP-06 step 8). Left: steps 5 to 7 and 9 to 10 of `WP-06.md`, the review, the merge, the `getDataset` cache wrapping. The preview is behind Vercel's login; see the S7 note in `STATUS.md` |
| S8 | WP-15 statistics | **done 2026-11-23** | Merged: one `computeTournament` over all rows, 11 tenant-scoped reads in one snapshot, nothing combined stored, 55 ms on Wiosenna; pdl-s2 equals the published numbers, Wiosenna differs only where listed. Caching waits for WP-06 (S7) |
| S9 | The owner's answers to questions 41 to 43 folded into the design | ready (all answered 2026-11-23 and recorded in STATUS; can run before or after S7) | |
| S10 | WP-07 platform kernel | after S7 | |
| S11 | WP-08 server-rendered shell | after S10 | |
| S12 | WP-09a teams and schedule | after S11 | |
| S13 | WP-09b standings and playoffs | after S12 | |
| S14 | WP-09c content pages | after S12 (can run beside S13) | |
| S15 | WP-10 home page and deep links | after S13, S14 and S8 | |
| S16 | WP-11 speed budgets and a lighter bundle | after S15 | |
| S17 | The owner's review kit (end of stage 2, question 40) | after S16 | |

Stages 3 to 7 get their steps while stage 2 is under way (S9 and S17 may change them).

---

## Every step ends like this

Every prompt below says "End as in PROMPTS.md". That means, in this order:

1. Mark the step **done** in the step log above, with the date and a one-line result. If it could not finish, mark it "stopped" with what is left; the next session then uses "Continue a stopped step".
2. Update `STATUS.md`: "Next step", the work-package rows, a log line.
3. Update the prompts of the later steps with anything this step changed; add a prompt for any new step.
4. Commit with Conventional Commits and push `overhaul` and the step's `wp/*` branches without asking (owner, 2026-11-23; these pushes deploy nothing while previews are off). Never push any other branch. Delete a `wp/*` branch and its worktree once it is merged and pushed, without asking: nothing deploys from it and no code is lost. Anything that touches production or a deployed service still needs the owner's yes, with one Polish sentence explaining the step.
5. The last message to the owner: what was done; what the owner must do or decide, each item with full context (tournament, stage or round, the teams, the date, the score; never a bare id); the git state; and **"Next: paste step SN (name)"**. Refer to every file as a clickable markdown link relative to the `overhaul` worktree, for example [STATUS.md](docs/overhaul/STATUS.md). A file that exists only on another branch is linked in that branch's worktree, for example [WP-06.md](../wp-06-hosting-trial/docs/overhaul/spikes/WP-06.md).

Rules inside every step: implementation goes to `implementer` agents, and every branch gets an Opus `reviewer` agent before it is merged (`--no-ff` into `overhaul`). A package that `ROADMAP.md` marks "Fable review" gets an Opus reviewer whose prompt lists what to check. Agents commit in small steps; an agent stopped by the 5-hour limit is resumed with a message after the reset, not restarted. Do not end a turn to wait for an agent: wait in the foreground.

---

## S7 WP-06: the staging run and the hosting decision

Before pasting: restore the paused Supabase staging project (supabase.com, Dashboard, the staging project, "Restore project"; wait until it shows "Healthy"). Everything else on the owner's list of WP-06 steps 1 to 4 was done by the S8 session on 2026-11-23 or is no longer needed (see the S7 note in `STATUS.md`, "Next step").

**State after the first S7 session (2026-11-24):** points 1 and 2 below are done (the "staging run" section of `WP-06.md` on `wp/06-hosting-trial` has the details), and step 8 of `WP-06.md` too. The session stopped because the preview is behind Vercel's login and the agent may not create the bypass secret. Once the owner has put `VERCEL_PROTECTION_BYPASS` in `.env.staging.local`, continue with "Continue a stopped step". Three rules learned: always deploy with `vercel deploy --environment preview` (the CLI made a plain `vercel deploy` a production deployment), always add `--env FIREBASE_SERVICE_ACCOUNT_BASE64=null --build-env FIREBASE_SERVICE_ACCOUNT_BASE64=null`, and export `VERCEL_PROTECTION_BYPASS` from the file for the measuring scripts. A new deployment has a new address (no stable alias for CLI deployments), so step 7's redeploy changes the address that Firebase must list.

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md and docs/overhaul/PROMPTS.md. You are running step S7: the staging half of WP-06. The local half is built and reviewed on branch wp/06-hosting-trial (worktree .claude/worktrees/wp-06-hosting-trial); its report is docs/overhaul/spikes/WP-06.md there. The S7 note in STATUS.md "Next step" says what the S8 session already set up.
1. Check that the staging database answers (read DATABASE_URL_SESSION from .env.staging.local into a variable; never print it). If it does not, tell me exactly what to do in the Supabase dashboard and stop.
2. Finish steps 1 to 4 of WP-06.md yourself; my paste of this prompt is my yes to them, including the preview deploys of the Vercel project tournament-platform (never --prod, never the community-site project):
   - Migrations: the Staging migrations workflow cannot be started by hand (GitHub runs workflow_dispatch only for files on the default branch, master). Run the job's own command from the overhaul worktree: DATABASE_URL from DATABASE_URL_SESSION, then npm run db:migrate -- --remote --expect staging. Then write the environment = "staging" row of app.platform_settings (DEV_SETUP.md, "Staging").
   - Import pdl-s2 into staging with --anonymize (WP-06.md step 2).
   - The Vercel Preview variables are set (PLATFORM_ROUTING, LEGACY_ORIGIN, LEGACY_SLUGS, PLATFORM_TRIAL_SECRET; DATABASE_URL was there). Check with vercel env ls preview.
   - The preview: no VERCEL_TOKEN in GitHub (the Vercel team PD2IH also holds the community site, so any token would reach production). Deploy the preview with the CLI that is already logged in on this machine, vercel deploy from the wp-06-hosting-trial worktree, after checking that no .env file, data-exports/ or .local/ is uploaded (.vercelignore). Check in the function logs that the region is fra1.
3. Run steps 5 to 9 of WP-06.md against the preview (an implementer agent may do the runs). Never print a secret. Step 6: do not add any domain to the production Firebase project; sign-in on the preview needs the preview's address as an authorized domain of the staging Firebase project, which only I can add: tell me the exact address and where to click, and continue with the other steps meanwhile. Step 7 needs a throwaway Vercel project: ask me once before creating it.
4. Fill in the acceptance table and write the recommendation (go, go with changes, or the fallback of ADR-03), each claim backed by a measured number.
5. Have an Opus reviewer check the numbers, the recommendation and that nothing in production was touched. Then merge the kept parts into overhaul with --no-ff and remove the trial code as step 10 says.
6. Once src/platform/cache is merged, have an implementer wrap WP-15's getDataset (src/features/stats/queries.ts) in cachedQuery exactly as the WP-15 row in STATUS.md says (name 'stats.dataset', tags stats, teams and matches, cacheNull false), with a test that invalidating the tag gives fresh numbers; the reviewer of step 5 checks it too. Until then nothing may send traffic to /api/v1/stats/dataset.
7. My first look: give me the preview's address of the PDL S2 teams page as a clickable link, and say what I should see there.
End as in PROMPTS.md.
```

---

## S8 WP-15: statistics from one compute

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md, docs/overhaul/PROMPTS.md and docs/overhaul/ROADMAP.md section WP-15. You are running step S8: WP-15, the stats feature.
1. Brief an implementer agent on branch wp/15-stats from overhaul. If WP-06's cache helpers (src/platform/cache) are not merged yet, build the pure compute and its tests first, and wire the cached queries once they are merged.
2. Then an Opus reviewer with this list besides the acceptance criteria: the fixtures' published stats-hub totals are reproduced exactly; there is one compute and no old calculator was ported; every read is tenant-scoped; nothing combined (tables, totals, averages, rankings) is stored or updated incrementally, everything comes from the one compute over all rows (ROADMAP WP-15, owner 2026-11-23); no file over 300 lines; the tests use fixtures and PGlite with no network.
3. Apply the fixes, merge with --no-ff into overhaul, run the full checks.
End as in PROMPTS.md.
```

---

## S9 The owner's answers to questions 41 to 43

All of 41 to 43 is answered and recorded in `STATUS.md` (42 and the last point of 43 on 2026-11-23). Paste the prompt as it is.

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md (questions 41 to 43) and docs/overhaul/PROMPTS.md. You are running step S9: fold the answers recorded in questions 41, 42 and 43 into the design.
- Update ROADMAP.md (WP-13b, WP-14, WP-16, WP-17, WP-21, WP-44, WP-66 as needed; the bot-account test for ticketless games goes into WP-16; replay upload parsing goes to the backlog as "later"), ORGANIZER_UX.md (the decisions table: the captains' score flow, the lineup check, the organizer's manual forfeit, the "Napisz do organizatora" button; the match page: changing one match's format) and CONVENTIONS.md (how matches, teams and players are named in reports, findings and messages). Question 42: no visible match number; add the support lookup to WP-46 and write docs/support/queries.sql (read-only queries that find a match, team or player by team names, nickname, Steam id, Dota match id and date, each printing tournament, stage, teams, date and score), tested on PGlite with the fixtures.
- Record the data answers so the import applies them as owner corrections: a small data file and a test, through an implementer agent and an Opus reviewer, merged into overhaul. In the same package: the PDL S1 Steam-id answers of question 43 (the six Kotwica Gaming games on account 313683754 are Kildren's, as an unregistered stand-in, not Joxxi's); and the import places every game by date (a game listed on two matches belongs to the one on its date) and takes each game's teams from its players, not from its labels (question 43, "The bug behind most of these"). Also from WP-15: a bracket match's completion time comes from its mirror match in `matches` when `playoff_matches.result.completedAt` is a bulk rewrite (in Wiosenna all 11 bracket matches read 2026-07-25 17:46; `ub-r1-p1` really finished 2026-07-12 21:43); then update the expected differences in `src/features/stats/dataset.parity.db.test.ts`.
- Move each answered question to the decisions in STATUS.md. Where an answer leaves a gap, ask me in one message with your recommendation.
End as in PROMPTS.md.
```

---

## S10 WP-07: the platform kernel

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md, docs/overhaul/PROMPTS.md, docs/overhaul/ROADMAP.md section WP-07 and the WP-06 result in docs/overhaul/spikes/WP-06.md. You are running step S10: WP-07.
1. Implementer agent on branch wp/07-platform-kernel from overhaul. The cache helpers keep the shape WP-06 settled.
2. Opus reviewer with this list besides the acceptance criteria: the lint rules really fail a forbidden import (show a failing example); every command checks permission before it writes and writes its audit row in the same transaction; nothing reaches the database outside platform/db and scoped; every client of Supabase's transaction pooler uses `poolOptions` (`max_pipeline: 1`; WP-06 found that pipelined statements hang there until the function's time limit); the old site's behaviour is unchanged.
3. Fixes, merge with --no-ff, full checks.
End as in PROMPTS.md.
```

---

## S11 to S16: the rest of stage 2

Each is one package, run the same way. Paste the block and replace `<WP>` with the step's package from this table.

| Step | `<WP>` | What the reviewer must check besides the acceptance criteria |
|---|---|---|
| S11 | WP-08 | No page reads Firestore in the browser; the loading gate and the whole-collection read are gone; an unknown slug answers 404 (WP-06 found it answers 200); the 44 kB of translations is no longer on every page; the root layout no longer preloads 16 font files on every page (WP-06 measured 51 CDN requests per cold view; `COSTS.md`); old tournaments still work through the forwarding |
| S12 | WP-09a | Teams and schedule equal the old pages for all four imported tournaments, field by field |
| S13 | WP-09b | Standings and brackets equal the published ones for every division, group and bracket |
| S14 | WP-09c | Rules, news, prizes and the static pages are complete in the first response |
| S15 | WP-10 | The home page keeps its design; deep links open the right section with no redirect; the stats hub and the rankings page (`RankingsView`) read WP-15's cached `getDataset` and `computeTournament` and show the same numbers as the old pages; the old Firestore `src/lib/stats-lab/build-dataset.ts` and `/api/stats/dataset` lose their last users on the new platform |
| S16 | WP-11 | The budgets fail CI when exceeded (show it), including a budget for requests per cold page view (WP-06 measured 51; target about 30, `COSTS.md`); no page ships the Firebase data SDK |

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md, docs/overhaul/PROMPTS.md and docs/overhaul/ROADMAP.md section <WP>. You are running the step of PROMPTS.md whose package is <WP>.
1. Implementer agent on the branch STATUS.md names for <WP>, from overhaul.
2. Opus reviewer with the acceptance criteria and the checks PROMPTS.md lists for this step.
3. Fixes, merge with --no-ff, full checks.
End as in PROMPTS.md.
```

---

## S17 The owner's review kit

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md (question 40) and docs/overhaul/PROMPTS.md. You are running step S17: prepare my review of stage 2. Produce one page I can open: the staging link of every public page of Letnia, PDL, PDL S2 and Wiosenna; the old and the new page side by side with every difference listed (compare-sites; an implementer builds it if it does not exist); the import report with counts per table and every unmapped field; load times on a phone profile next to today's site. Name every match and team with its tournament, stage and date. Then tell me how to go through it.
End as in PROMPTS.md.
```

---

## Continue a stopped step

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md and docs/overhaul/PROMPTS.md. The step marked "stopped" in the step log did not finish. Check git log, the branches and worktrees it used and its agents' commits, then continue it from where it stopped, following its prompt.
End as in PROMPTS.md.
```

---

## Earlier prompts (sessions S0 to S5, done; kept for reference)

### S0 Groundwork (Opus)

```text
Read docs/overhaul/BRIEF.md and docs/overhaul/STATUS.md. You are running session S0.

You are the owner and long-term maintainer of this codebase, and its design is up to you.

S0 has two parts. Part A makes the codebase safe to change. Part B writes short inventories, so that the Fable sessions can make decisions without reading 156k lines of code. Fable is expensive, so the inventories must be accurate, compact and backed by file references. Use explorer agents for the reading. Commit after each step and keep STATUS.md current.

Part A: safety net
1. Make the test suite pass. reserved-slugs.test.ts fails because public/card-lab is not reserved; fix the cause. The Swiss "no-consecutive-rematch" test failed once under CPU load and passed alone. Find out why, and make it fast and deterministic.
2. Add .github/workflows/ci.yml for pushes and pull requests to overhaul and feature/multi-tournament-platform: npm ci, typecheck, lint, test, build. Use placeholder NEXT_PUBLIC_* values; next.config.mjs fails the build without them on purpose.
3. Delete src/app/api/admin/**. Before you delete it, search the client code, scripts/, bot-worker/ and the other two repos for callers, and report any you find. Keep the 410 rule in src/middleware.ts. Then delete the src/lib modules that nothing imports any more; confirm each one with tsc. Delete the tracked one-off scripts in the repo root that nothing refers to. Do not delete anything in _archive/, docs/ or scripts/. List any you think are dead in inventory/CODE_HEALTH.md.

Part B: inventories in docs/overhaul/inventory/
Each file states the facts first and ends with a short "Problems seen" list. Do not propose redesigns. That is the Fable sessions' job.
- PAGES.md: every route under src/app. For each one: server or client component, where its data comes from (browser Firestore, API route, server, the cached dataset), First Load JS from the build output, and measured load times. To measure, run a production build in this worktree, start it with `next start -p 3100`, and use puppeteer-core or Lighthouse with the installed Edge. For the wiosenna and pdl-s2 tournaments, record TTFB, LCP, the time until the loading screen is gone, and the number of Firestore requests, cold and warm. Explain why the home page is fast and the subpages are slow, with evidence.
- ADMIN.md: every admin tab, section and control. What it does, which API routes and Firestore paths it writes, which tournament formats need it, when it last changed (git log), and whether it looks deprecated, duplicated or unknown. Group the controls by the organizer's job (set up the tournament, manage teams, schedule, run matches, fix results, and so on), not by tab.
- DATA.md: every Firestore collection in use. Global or per tournament, who writes it, who reads it, its size per tournament, indexes, and security rules. Include the legacy top-level collections and what still reads them.
- SCALE.md: everything whose cost or time grows with the number of tournaments, teams or users. Crons and periodic jobs that loop over all tournaments, global queries, per-request fan-out, the lobby bot's Steam account pool, the Gemini assistant, Storage, and Cloud Run cold starts. Estimate the cost per tournament per month where you can.
- PRODUCT.md: the selling points from the brief (automatic lobbies, automatic results, the creator wizard, customization, custom domains, viewer features). For each one: what exists, what works end to end, what is partial or manual, and what is missing. Cover all three repos.
- TESTS.md: what is tested today, at which level, and what the most important untested paths are.
- CARDS.md: the current card game in one page. The rules, the economy (packs, shards, finds), PvP, the tutorial, and the tester feedback recorded so far. The decision log in the memory note card-game-design.md is the main source; check it against the code.
- CODE_HEALTH.md: the largest files, duplicated logic (stats and fantasy scoring above all), dead code, `any` hotspots, mixed patterns for the same job, and the conventions the code actually follows.

When S0 is done, set "Next step" in STATUS.md to S1, and push the overhaul branch so that CI runs. Finish with the report described in the brief: what was done, every deleted file group, the test and CI results, and the problems that most surprised you.
```

---

### S1 Architecture, scale, code health and testing (Fable)

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md and every file in docs/overhaul/inventory/. You are running session S1, which covers the owner's concerns 1, 4, 5, 6 (the technical part) and 7.

You are the owner and long-term maintainer of this codebase, and its design is up to you.

Your quota is limited. Spend it on judgment. Use explorer agents to check claims and fill gaps in the inventories, and implementer agents for spikes and measurements. Before you rely on a claim, verify it.

Decide how this product should be built to serve thousands of tournaments at once, to feel fast on every page, and to be readable and testable. Then plan how to get there from here without breaking the leagues that are running. Write, committing as you finish each section:

1. ARCHITECTURE.md
   - The current architecture in one page, and the bad decisions it contains, each with evidence and its cost today.
   - The target architecture. Cover at least: why subpages are slow and how every page becomes as fast as the home page (keep the home page's design); the multi-tenant data model and isolation between tournaments; organizer accounts, roles and permissions; per-tenant theming and custom domains, given that the community site on Vercel owns dota2inhouse.pl; background jobs, crons and the lobby bot at scale; the stats and fantasy pipeline as one module; caching; costs per tournament; observability and error monitoring; how the website and the bot talk to each other; and the module boundaries in the code.
   - Each decision as a short ADR: the context, the options you considered, the choice, why, and what it costs.
2. CONVENTIONS.md: how the code should be written from now on, so that humans and AI agents can read it. File size, module boundaries, naming, data access, error handling, comments, tests. Short, with examples from this repo.
3. TEST_STRATEGY.md: the test levels (pure logic, Firestore rules on the emulator, API integration, contracts between the website and the bot, end-to-end flows, load tests, visual checks), what each one covers, the tools, the environments (a staging Firebase project is needed; say exactly what the owner must create), coverage goals, and the order to build them in.
4. ROADMAP.md: work packages that an Opus implementer can execute from the description alone, without your context. Each WP has: the goal, the files and areas involved, the design to follow (link to the ADR), acceptance criteria, the tests that prove it, risks and the rollback plan, dependencies, and a size. Order them so that the riskiest unknowns are tested early and the leagues keep running. Mark which WPs need a Fable review and which an Opus reviewer can handle. Add each WP to the table in STATUS.md.

Where the owner must decide something, add it to "Questions for the owner" with your recommendation. Finish with the report described in the brief.
```

Effort: `high`. If the quota allows, `xhigh` gives the most benefit in this session.

---

### S2 Organizer experience (Fable)

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md, docs/overhaul/ARCHITECTURE.md, docs/overhaul/inventory/ADMIN.md and docs/overhaul/inventory/PRODUCT.md. You are running session S2, which covers the owner's concern 2 and the organizer-facing part of concern 6.

The owner does not know how to design this and is counting on you. The test: a new organizer who has never seen the site creates a tournament and runs it to the final without help, and wants to keep using it. Today, only the owner can use the admin panel.

1. Write ORGANIZER_UX.md:
   - Who uses it: a new organizer, an experienced one, co-admins, captains and casters where they touch admin, and the owner as platform super admin. What each one is trying to do, and how often.
   - The organizer's whole journey: sign up, the creator wizard, customizing the look and domain, inviting teams, running the season, fixing problems, and the end of the season. Mark where automation should remove a step altogether. Automation is the main selling point, so the best admin screen is often one the organizer never needs.
   - The new information architecture. Map every control in ADMIN.md to keep, merge, automate, move to super admin, or drop, with a reason.
   - Specs for the key screens: what they show and why, the states (empty, normal, problem), and how errors and automatic actions are explained through the design, following the owner's product rules in the brief.
   - Customization: what an organizer can change, how they preview it, and the limits that keep every tournament looking good.
   - Other places on the site with the same problems, at a lower priority.
2. Have implementer agents build clickable prototypes of the 3–4 most important screens, in 2–3 versions each, behind the `?v=N` version picker. Use mock data, and no writes to production. Look at screenshots of each version yourself, fix what is weak, and write down the version you recommend and why, so the owner can choose.
3. Add work packages for the new organizer experience to ROADMAP.md and STATUS.md, in the same format as S1.

Finish with the report described in the brief.
```

---

### S3 Card game (Fable)

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md and docs/overhaul/inventory/CARDS.md. The rules engine is in src/lib/card-lab/ (outposts.ts, outposts-ai.ts, pvp.ts), and the UI is in src/components/card-lab/. You are running session S3, which covers the owner's concern 3.

The owner is not a game designer and is counting on you. The game must become a proper game with real depth. A new player must still be able to start playing within a minute, without reading rules, and must have a reason to come back. The cards come from the real tournament's players and series. That is our unique asset, so use it.

1. Diagnose before you propose: why the game feels shallow, why new players are confused, and why they see no reason to play. Use the code, the recorded tester feedback, and simulations. Implementer agents can run the existing simulation harness for you.
2. Write GAME_DESIGN.md:
   - The design goals and the player types you design for.
   - 2–3 directions for the core game, from small changes to the current game up to a new core, each with its trade-offs. Recommend one.
   - For the recommended direction: the full rules, where the depth comes from (decisions per turn, deck building, reading the opponent), the onboarding (a first match that teaches by playing), the reasons to play (links to the real tournament, collection, ranking, social play, rewards), and the economy.
   - Balance targets and the simulations that prove them, with results. Have implementers prototype the rules in the pure engine and simulate them before you settle anything.
   - The owner's earlier decisions are recorded in CARDS.md. Keep each one, or argue plainly for changing it.
3. Add work packages for the game to ROADMAP.md and STATUS.md, in the same format as S1.

Finish with the report described in the brief.
```

---

### S4 Business and marketing (Opus, or Fable if quota is left)

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md, docs/overhaul/inventory/PRODUCT.md and docs/overhaul/ORGANIZER_UX.md. You are running session S4, which covers the business part of concern 6. Write the results to docs/business/.

1. Research the market on the web: tournament platforms that Dota 2 and other esports organizers use, what they automate, what they charge, and their weak points. Check every claim about a competitor against a current source, and list the sources. Check especially whether any competitor reports Dota 2 results automatically, because the owner believes no one does.
2. POSITIONING.md: who the customers are (community leagues, streamers, schools and universities, LAN organizers, companies, game publishers), the problem each one has, why we win, and where we do not.
3. BUSINESS_PLAN.md: business models and pricing options with a recommendation, our costs per tournament (from inventory/SCALE.md), break-even, the risks (Valve's rules for bots and the API, platform dependencies), and the milestones.
4. GO_TO_MARKET.md: the first 10 customers and how to win them, channels, partnerships, and what to measure.
5. Material for customers, in Polish and English: landing page copy, a one-page product sheet, and the content of a pitch deck, slide by slide. Claim only what PRODUCT.md shows works today, and mark the claims that depend on roadmap work.

Finish with the report described in the brief.
```

---

### S5+ Implementation (Fable or Opus as orchestrator)

Run this as many times as needed. Opus can orchestrate. Fable is worth it for the WPs that ROADMAP.md marks as needing a Fable review.

```text
Read docs/overhaul/BRIEF.md, docs/overhaul/STATUS.md and docs/overhaul/ROADMAP.md. You are orchestrating the implementation of the roadmap.

1. Merge feature/multi-tournament-platform into overhaul, and resolve any conflicts.
2. Take the next work packages in roadmap order whose dependencies are merged. Brief an implementer agent for each one, with the WP text, the branch, the worktree and the acceptance criteria. Run WPs in parallel only when they do not touch the same files.
3. When an implementer finishes, have a reviewer agent check the branch. Fix or rework until the verdict is merge, then merge with --no-ff into overhaul, run the full test suite, and update STATUS.md.
4. Continue with the next WPs until the roadmap is done, or until a WP needs an answer from the owner. Then go on with WPs that do not depend on that answer.

Finish with the report described in the brief: the WPs merged, the behaviour changes, open questions, and the next WPs.
```

---

### Continue on Opus

Use this when a Fable session stopped because of the quota, or when any session stopped before it finished.

```text
Read docs/overhaul/BRIEF.md and docs/overhaul/STATUS.md. The previous session stopped before it finished. Check `git log` and the files it wrote, then continue from "Next step" in STATUS.md, following that session's prompt in docs/overhaul/PROMPTS.md. Mark any section you write in a document that was assigned to Fable "(drafted by Opus)".
```
