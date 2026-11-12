# Overhaul brief

Read this file first in every overhaul session, whichever model you are. It holds the goals, the limits, and the way sessions hand work to each other. Then read `STATUS.md` in this folder to see where the work stands.

## The product

dota2inhouse.pl runs Polish Dota 2 leagues: PDL, pdl-s2, Wiosenna and Letnia. The site handles registration, scheduling, groups, Swiss and playoff brackets, results, stats, fantasy, pick'em, a collectible card game and tools for casters.

The goal is a public platform. Any organizer can create a tournament and run it the way we run ours. The platform must handle tens, hundreds or thousands of tournaments at the same time. Cost, speed and admin work must not grow with the number of tournaments in ways we cannot afford.

What must make organizers choose us over the competition:

1. **Automation, most importantly.** Our bot creates the Dota 2 lobbies. Results are reported automatically, which the owner believes no competitor does. The organizer creates the tournament in our creator wizard, and that should be nearly all the work they do.
2. **Design that each organizer can make their own.** It must be deeply customizable, up to running on their own domain.
3. **Things for viewers.** Stats, fantasy, pick'em, the card game and caster tools.

The product must actually deliver these. Promotional material must not claim more than the product does.

## Repositories

| Repo | Path | Deploys |
|---|---|---|
| Website (this repo) | `C:\Users\wilqw\Desktop\code\Letnia\automatic-tournament` | By hand with `firebase deploy` from `feature/multi-tournament-platform`. Firebase Hosting frameworks adapter, SSR on Cloud Run. |
| Lobby bot (live) | `bot-worker/` inside the website repo | Railway, automatically on a push to `feature/multi-tournament-platform`. Corrected in S0: this is the deployed bot (memory note `inhouse-worker-website-contract.md`). |
| Old lobby bot | `C:\Users\wilqw\Desktop\code\inhouse bot\dota2-lobby-bot` | Not deployed since about June 2026. Read it only for behaviour that was never ported. Still do not push its branches. |
| Community site | `C:\Users\wilqw\Desktop\code\dota.pl\dota2-community-site` | Vercel. It owns the dota2inhouse.pl domain and forwards the paths it does not own to Firebase. |

There is only one Firebase project, `tournament-tracker-f35tb`. It is production. There is no staging environment yet.

Background notes from earlier sessions are in `C:\Users\wilqw\.claude\projects\c--Users-wilqw-Desktop-code-Letnia-automatic-tournament\memory\`. `MEMORY.md` is the index. They are history. Some are out of date, and many are cautions written for one task. Use them as facts to check, not as rules.

## What the owner is worried about

These are the owner's own concerns from 2026-11-12, condensed.

1. **Slow pages.** Every page except the home page loads very slowly. The home page loads all its content once, in one request, and uses a full-screen snap-scrolling layout. The owner likes that design, but the slow subpages force everything onto the home page, so other pages cannot be used much. First lead, not yet proven: subpages are client components that fetch from Firestore in the browser after the JavaScript loads (see `src/app/[tournamentSlug]/teams/page.tsx`). The home page uses a cached dataset API.
2. **The admin panel is a patchwork.** Features were added one by one. It is messy and not intuitive, and probably only the owner can use it. Some parts are deprecated, some are duplicated, and the owner does not know what some of them do. It must be completely re-imagined so that a new organizer can use it, and it should look good. Other parts of the site have the same problem to a lesser degree.
3. **The card game lacks depth.** New players are confused, do not know how to play, and mostly see no reason to play. It must become a proper game that players can still pick up immediately.
4. **Bad decisions from two years of piecemeal work.** The code was written over two years by many AI agents with very different abilities, with the owner as a beginner architect at the start. Find the bad decisions and fix them, even when the fix is at a high level.
5. **Code that is hard for humans to read.** Most of the code was written by AI. This might become a problem: for new developers, for a buyer's or investor's due diligence, and for AI agents, which pay in context and mistakes for very large files.
6. **Scale and sales.** See "The product" above. In addition, we need promotional material for potential customers and a full marketing and business plan.
7. **Testing.** The code has never been tested to enterprise standards. Plan testing thoroughly at least; at best, test fully.

## Problems found on 2026-11-12

1. There is no CI. The test suite fails: `reserved-slugs.test.ts` (`public/card-lab` is not reserved), and the Swiss "no-consecutive-rematch" test is probably a timeout under load. Typecheck passes.
2. Production is deployed by hand from a working copy. `master` is 228 commits behind and is not used. Production can run code that is in no commit.
3. Work is often left uncommitted for days.
4. Stats and fantasy scoring are spread over about 14 modules in `src/lib`. At least two live paths calculate fantasy points: `fantasy-scoring-admin` (used by `unified-game-save` and `post-sync-recalculations`) and `pdl-fantasy-scoring` (used by `pdl-admin-actions`). Several modules are only used by dead routes.
5. About 60 dead routes in `src/app/api/admin/**`. `src/middleware.ts` returns 410 for that whole path, so they never run. There are also one-off scripts in the repo root and 119 tracked files in `_archive/`.
6. Very large files: `BotTab.tsx` 3,070 lines, `GeneralTab.tsx` 2,753, `MatchesTab.tsx` 2,417, `pdl-admin-actions.ts` 2,200, `comprehensive-stats-calculator.ts` 2,171.
7. 25 test files for 736 source files (about 156k lines). 646 uses of `any`.
8. No error monitoring in production.
9. The last performance audit (January 2026) gave 67 points and an LCP of 7.0 s. Nobody has measured it since. 340 files are `"use client"`.
10. `src/lib/rate-limit.ts` uses `x-forwarded-for` as the client's address. Behind the Vercel rewrite, that address is Vercel's, so per-IP limits on the paid Gemini rules assistant act as one limit shared by everyone.

## How we work

### Branches and restore points

- Restore point: the tag `restore/pre-overhaul-2026-11-12` is on GitHub in all three repos. In this repo it points to snapshot commit `4ecde37`, which also contains the owner's uncommitted caster-corner work from 2026-11-12. The local branch `backup/pre-overhaul-2026-11-12` points to the same commit.
- All overhaul work happens on the branch `overhaul`, in the worktree `.claude/worktrees/overhaul`. Do not work in the main working copy. The owner works there and runs a dev server there.
- Each work package gets its own branch `wp/NN-short-name` from `overhaul`. Merge it back with `git merge --no-ff`. Then the owner can revert one work package, or copy it into production, as a single unit.
- Production stays on `feature/multi-tournament-platform` until the overhaul is proven. At the start of each implementation session, merge `feature/multi-tournament-platform` into `overhaul` so the two do not drift apart.

### Models and quota

Fable 5.2 quota is limited, and we do not know the limit. Spend Fable on what needs the most judgment: decisions, design, and reviewing the results of other agents. Delegate the rest to the agents in `.claude/agents/`:

| Agent | Model | Use it for |
|---|---|---|
| `explorer` | Sonnet | Reading and mapping code. Read-only. Cheapest. |
| `implementer` | Opus | Building one work package on its own branch. |
| `reviewer` | Opus | Checking a finished work package against its acceptance criteria. Read-only, but may run tests. |

- Use these agents, not the general-purpose agent, which runs on the parent's model.
- A subagent starts with no context. Brief it fully: the goal, the files, the worktree path, the acceptance criteria, the limits from this file, and the report you want back.
- Run subagents in parallel only when they do not edit the same files. Each implementer that runs in parallel gets its own worktree.
- Explorer reports are summaries. Before a decision depends on a claim, check the important claims yourself, or have an explorer quote the code.

**Every session must be resumable by Opus alone,** because the Fable quota can run out mid-session:

- Write outputs to files as you go, not at the end. Commit after each finished section.
- Keep `STATUS.md` current: what is done, what is next, and open questions.
- If you are Opus continuing a session that Fable started, read `STATUS.md` and continue from "Next step". If you write sections of a document that was assigned to Fable, mark them "(drafted by Opus)" so the owner reviews them more closely.

### Limits, and the reason for each

- **Never delete, move or force-push the restore points:** the `restore/*` tags and the `backup/*` branches, locally or on GitHub, in any of the three repos. They are the owner's way back to the state before the overhaul.
- **Do not run `firebase deploy` or any other deploy.** Production serves live leagues.
- **Push only the `overhaul` and `wp/*` branches of this repo.** Never push `feature/multi-tournament-platform`. Never push the bot repo's or the community site's branches: Railway and Vercel deploy on those pushes.
- **Do not write to the production Firestore or Storage.** Do not run scripts that use service-account credentials. Use the Firebase emulator or fixtures. Reading production data through the public website is fine.
- **Change the Firestore schema only additively**, with a migration script and a test on the emulator. Old and new code must both work against the data during the change.
- **Do not start `next dev` in the main working copy.** The owner's dev server runs there, and two dev servers that share `.next` break each other. In a worktree, `next build`, `next start` and `next dev` are fine on a port other than 3000.
- **Disk space is low** (about 17 GB free). Do not run `npm install` into new folders. A worktree under `.claude/worktrees/` finds the repo's `node_modules` in a parent folder. If a tool still cannot find a module, create a directory junction (`mklink /J node_modules <repo>\node_modules`), and remove it with `rmdir` before you run `git worktree remove`. Delete build output, screenshots, logs and temporary files when you are done with them.
- **On Windows, use bash `cp` for paths with `[tournamentSlug]`.** PowerShell treats the brackets as a wildcard. Do not write Polish text through PowerShell `Set-Content`, because it breaks the UTF-8.

### What needs no approval

Creating and committing on `overhaul` and `wp/*` branches. Creating worktrees under `.claude/worktrees/`. Editing, moving or deleting code as a work package describes. Adding tests and dev dependencies. Running typecheck, lint, tests, builds, the Firebase emulator, and local servers in a worktree. Reading the three repos and the public website.

### Questions for the owner

Do not stop to wait for an answer. Add the question to "Questions for the owner" in `STATUS.md`, with your recommended answer. If the choice is easy to reverse, continue on your recommendation. If it is not, do other work until the owner answers.

### Finishing work

Do not stop while you still owe work the user asked for. Be persistent. Status notes are welcome, and so are questions on open decisions, but carry on with work that does not depend on the answer. If you notice that you are inviting the user to redirect you or offering to wait, go on to the next part of the task instead. You may meet ordinary obstacles such as errors, timeouts, locked files, empty results or failing tools. Diagnose them first. If they are not real blockers, work through them with the access you have: wait and retry, fix the request, or use another tool. If something is a deliberate limit, such as the limits above, leave it alone, say plainly what you found, and find another safe way to finish. This does not remove the need for confirmation on risky or destructive actions.

### Writing

Write for an intelligent reader with little context. The reader has not seen your tool calls or the files you opened, and may be switching in from other work. Put the key points in the first few sentences. Use plain words and full sentences. Do not use terms that you made up during the work. Use the same word for the same thing throughout. Use prose where ideas connect, and bullets for lists of separate items.

Documents and code are in English. Website copy is in Polish.

### The owner's product rules

They have had to repeat these many times. Every new screen must follow them.

- **No box inside a box.** Lay pages out with open areas, hairlines, gradients and bands. Use rounded shapes only for real objects such as cards, pills and buttons.
- **Show each fact once.** No banner that repeats the columns below it, and no tooltip that repeats a visible rule.
- **No redundant or explanatory text.** If the context already says it, do not write it. Teach through the design: what you can do glows, the next step is highlighted, and outcomes preview on hover.
- **No decorative numbering** of section headers. **No generic "AI design" controls**, such as coloured pill toggles with dots. Reuse the site's own visual language. Use colour only where it carries meaning.
- **URLs in English** (`/account`, `/cards`). UI copy in Polish. Keep a redirect when an old address was already shared.
- **Content must fit its container** at every size. The site should feel like a crafted product or game client, not a generic web page. New pages must match the teams, stats and schedule pages.
- **Polish copy:** sentence case. "Drużyna", not "zespół". Use `@/lib/plural` for counts. Dota terms stay in English (Ancient, Tormentor, gank).
- **Prototypes:** build several versions side by side, behind a version picker (`?v=N`) that is collapsed and fixed in a corner, so the owner can choose.
