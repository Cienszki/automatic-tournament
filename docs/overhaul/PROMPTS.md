# Session prompts

Start every session with Claude Code opened in the worktree folder `.claude/worktrees/overhaul`, so the agents in `.claude/agents/` load. Choose the model with `/model`. Set effort to `high` unless a session says otherwise. Paste the prompt as the first message.

Order: S0 → S1 → S2 → S3 → S4 → S5+. S0 and S4 run on Opus, to save Fable for S1–S3. If Fable runs out, use the "Continue on Opus" prompt at the bottom.

---

## S0 Groundwork (Opus)

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

## S1 Architecture, scale, code health and testing (Fable)

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

## S2 Organizer experience (Fable)

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

## S3 Card game (Fable)

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

## S4 Business and marketing (Opus, or Fable if quota is left)

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

## S5+ Implementation (Fable or Opus as orchestrator)

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

## Continue on Opus

Use this when a Fable session stopped because of the quota, or when any session stopped before it finished.

```text
Read docs/overhaul/BRIEF.md and docs/overhaul/STATUS.md. The previous session stopped before it finished. Check `git log` and the files it wrote, then continue from "Next step" in STATUS.md, following that session's prompt in docs/overhaul/PROMPTS.md. Mark any section you write in a document that was assigned to Fable "(drafted by Opus)".
```
