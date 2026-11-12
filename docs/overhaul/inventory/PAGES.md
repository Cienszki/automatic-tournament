# Pages inventory

Written in S0 (2026-11-13). The static analysis (sections 4 to 6) is an explorer agent's, checked by Opus at the points marked "S0 checked". The measurements are Opus's. They come from a production build of `overhaul` (`next build`, then `next start -p 3100`, with every server secret blanked), from the live site, and from Firestore's public REST API.

**Not measured yet:** LCP, the time until the loading screen is gone, and the number of Firestore requests per page. All three need a real browser. Edge with puppeteer-core could not start inside this session's sandbox, and running it outside the sandbox was refused. `scripts/measure-pages.js` measures all three, cold and warm, for any list of URLs. The owner or S1 should run it once:

```
node scripts/measure-pages.js https://dota2inhouse.pl pages.json /wiosenna /wiosenna/teams /wiosenna/schedule /pdl-s2 /pdl-s2/teams /pdl-s2/schedule
```

## 1. Why the home page feels fast and the subpages feel slow

The brief's lead is half right. Every page is a client component that fetches from Firestore in the browser after the JavaScript has loaded, **the home page included**. The home page does not get its content from one cached request: it makes about ten browser `getDocs` calls (S0 checked: `FullScreenHomePage.tsx:279,386,410,472,493,525,535,541`). Only the stats hub inside it uses the cached `/api/stats/dataset`, and only once the page is idle. The difference is in when that work happens and how often it is repeated:

1. **The server sends no content to anyone.** Every page's HTML is the same empty shell. Live `/pdl-s2/teams` is 63 KB with 41 characters of visible text (the page title), no `<main>`, the loading-screen logo and 36 script tags. It is sent with `Cache-Control: private, no-store` and misses both CDNs (`X-Cache: MISS`, `X-Vercel-Cache: MISS`), so every page view runs Cloud Run only to produce that shell (about 0.3 s, table 2).
2. **No page starts its own data load until the tournament document has arrived.** `[tournamentSlug]/layout.tsx:217` renders children only when `tournament` is set (S0 checked). That document is fetched in the browser after hydration, together with the **whole** `tournaments` collection (`TournamentContext.tsx:162` → `lib/api/tournaments.ts:493`, S0 checked). The first Firestore request on a new connection took 0.95 s from here to the `nam5` (US) database. Requests on a warm connection took 0.18 s.
3. **The home page pays this once and then never again.** Its data effects all start together as soon as the tournament exists. The full-screen loading screen is also waiting for fonts, the background image and the hero videos (`layout.tsx:146`), so the data wait is hidden behind it. After that, the home sections switch on the client (`?view=`) without a page load or a second loader. Teams, schedule and match data are already in memory; a few sections, such as the stats hub and the cards, fetch their own data the first time they open (inferred from the dynamic imports; not traced section by section).
4. **A subpage pays it on every visit.** Each subpage mounts only after the gate, then starts its own `useEffect` fetch and shows a second `LoadingScreen` (`teams/page.tsx:156`) until that fetch returns. Nothing is shared between pages: teams and matches are read again by home, teams, schedule, groups and playoffs. Some fetches are chained (rules: sections, then one read per section; playoffs: teams → matches → `playoff_matches`).
5. **Deep links to the stats views are the worst case.** `/stats`, `/rankings` and `/teams/[teamId]` run the whole gate, then `router.replace` to `/?view=...`, which runs the home page's load (section 5).

The critical path of a hard load of a subpage is therefore (inferred from the measured parts; not timed end to end):

- the HTML: about 0.3 s;
- 36 to 41 scripts: about 420-440 KB decoded;
- hydration;
- auth, plus the tournament document and the whole tournaments collection: about 1 s on a cold Firestore connection;
- the page's own fetch: 0.2 s or more, plus the payload (the wiosenna rosters alone are about 190 KB of JSON);
- render.

Only then does the second loader disappear.

## 2. Measured: HTML time to first byte

Three requests per URL with curl, from Poland, on 2026-11-13. "Local" is the production build on this machine, so it shows server render time without the network. "Live" goes through Vercel (dota2inhouse.pl) → Firebase Hosting → Cloud Run (europe-west1). The direct Firebase origin (`tournament-tracker-f35tb.web.app`) answered in 0.22-0.37 s, so the Vercel hop adds little.

| Path | Local `next start` median | Live dota2inhouse.pl median (max) | HTML size |
|---|---|---|---|
| `/wiosenna` | 15 ms | 1022 ms (1131) | 63 KB |
| `/wiosenna/teams` | 17 ms | 316 ms (327) | 63 KB |
| `/wiosenna/schedule` | 17 ms | 316 ms (365) | 63 KB |
| `/wiosenna/playoffs` | 10 ms | 289 ms (320) | 63 KB |
| `/wiosenna/rules` | 10 ms | 324 ms (407) | 63 KB |
| `/wiosenna/stats` | 11 ms | 306 ms (435) | 62 KB |
| `/wiosenna/news` | 10 ms | 330 ms (346) | 63 KB |
| `/pdl-s2` | 10 ms | 297 ms (350) | 63 KB |
| `/pdl-s2/teams` | 10 ms | 283 ms (323) | 63 KB |
| `/pdl-s2/schedule` | 10 ms | 302 ms (305) | 63 KB |
| `/pdl-s2/playoffs` | 11 ms | 301 ms (306) | 63 KB |
| `/pdl-s2/rules` | 10 ms | 357 ms (416) | 63 KB |
| `/pdl-s2/stats` | 9 ms | 306 ms (332) | 62 KB |
| `/pdl-s2/news` | 10 ms | 292 ms (302) | 63 KB |

The `/wiosenna` median is high because it was the first live URL requested, so this is most likely Cloud Run warming up; all the other live pages are about 0.3 s. The HTML is identical in kind for every route: an empty shell of 62-63 KB.

Other measurements on the same day:

| What | Result |
|---|---|
| JavaScript referenced by the HTML (decoded) | `/pdl-s2`: 41 scripts, 444 KB. `/pdl-s2/teams`: 36 scripts, 424 KB |
| Whole `tournaments` collection, which every page load reads | 77 KB as REST JSON for 4 documents, about 0.99 s per request |
| Firestore read from Poland, new connection vs warm connection | 0.95 s vs 0.18 s |
| `teams` collection: pdl-s2 / wiosenna (REST JSON, which is pretty-printed and so larger than what the SDK transfers) | 492 KB / 808 KB, about 1.1 s each. Wiosenna's 22 team documents hold about 191 KB of `roster` data as compact JSON |
| `matches` collection: pdl-s2 / wiosenna | 76 KB / 589 KB, about 1.0-1.1 s each |
| `/api/stats/dataset` (stats hub), first request after expiry | wiosenna 7.8 s, pdl-s2 1.4 s |
| `/api/stats/dataset`, cached (Firebase CDN HIT, `s-maxage=300`) | 0.16-0.23 s. 100 KB (wiosenna) and 18 KB (pdl-s2) gzipped |

## 3. First Load JS per route (production build of `overhaul`)

All routes are dynamic (`ƒ`). The root layout reads the `NEXT_LOCALE` cookie through next-intl, so no page can be prerendered. The exceptions are `/robots.txt` and `/sitemap.xml` (`○`), and the sitemap is built from production data at build time (see Problems). First Load JS shared by all routes is 104 kB.

| Route | Page JS | First Load JS |
|---|---|---|
| `/` | 332 B | 104 kB |
| `/_not-found` | 332 B | 104 kB |
| `/[tournamentSlug]` | 16.8 kB | 401 kB |
| `/[tournamentSlug]/about` | 5.22 kB | 300 kB |
| `/[tournamentSlug]/account` | 10 kB | 489 kB |
| `/[tournamentSlug]/admin` | 149 kB | 504 kB |
| `/[tournamentSlug]/cards` | 332 B | 104 kB |
| `/[tournamentSlug]/cards/duel/[id]` | 78.4 kB | 416 kB |
| `/[tournamentSlug]/diploma` | 13.8 kB | 299 kB |
| `/[tournamentSlug]/divisions` | 6.64 kB | 287 kB |
| `/[tournamentSlug]/divisions/[divisionId]` | 14.6 kB | 369 kB |
| `/[tournamentSlug]/fantasy` | 7.34 kB | 274 kB |
| `/[tournamentSlug]/faq` | 4.83 kB | 294 kB |
| `/[tournamentSlug]/format-lan` | 16.9 kB | 355 kB |
| `/[tournamentSlug]/groups` | 6.74 kB | 326 kB |
| `/[tournamentSlug]/karty` | 332 B | 104 kB |
| `/[tournamentSlug]/konto` | 332 B | 104 kB |
| `/[tournamentSlug]/my-team` | 4.54 kB | 483 kB |
| `/[tournamentSlug]/newcaptain` | 5.44 kB | 264 kB |
| `/[tournamentSlug]/news` | 6.9 kB | 272 kB |
| `/[tournamentSlug]/pickem` | 10.7 kB | 358 kB |
| `/[tournamentSlug]/playoffs` | 4.37 kB | 356 kB |
| `/[tournamentSlug]/privacy` | 9.27 kB | 287 kB |
| `/[tournamentSlug]/prizes` | 4.06 kB | 282 kB |
| `/[tournamentSlug]/rankings` | 1.27 kB | 243 kB |
| `/[tournamentSlug]/register` | 10.6 kB | 381 kB |
| `/[tournamentSlug]/rules` | 14 kB | 323 kB |
| `/[tournamentSlug]/schedule` | 1.81 kB | 357 kB |
| `/[tournamentSlug]/stats` | 1.27 kB | 243 kB |
| `/[tournamentSlug]/teams` | 9.04 kB | 343 kB |
| `/[tournamentSlug]/teams/[teamId]` | 1.3 kB | 243 kB |
| `/[tournamentSlug]/teams/[teamId]/players/[playerId]` | 1.3 kB | 243 kB |
| `/creator` | 3.99 kB | 302 kB |
| `/creator/new` | 24.6 kB | 356 kB |
| `/fantasy` | 15 kB | 324 kB |
| `/fantasy/calculator` | 8.26 kB | 147 kB |
| `/fantasy/scoring-guide` | 4.24 kB | 119 kB |
| `/faq` | 5.59 kB | 163 kB |
| `/groups` | 6.35 kB | 307 kB |
| `/my-team` | 9.41 kB | 358 kB |
| `/organizer` | 6.66 kB | 265 kB |
| `/pickem` | 7.98 kB | 343 kB |
| `/playoffs` | 11 kB | 284 kB |
| `/register` | 9.55 kB | 356 kB |
| `/robots.txt` | 332 B | 104 kB |
| `/rules` | 9.68 kB | 159 kB |
| `/schedule` | 2.42 kB | 381 kB |
| `/sitemap.xml` | 332 B | 104 kB |
| `/standins` | 12.5 kB | 305 kB |
| `/stats` | 9.04 kB | 245 kB |
| `/teams` | 7.59 kB | 316 kB |
| `/teams/[teamId]` | 7.2 kB | 309 kB |
| `/teams/[teamId]/players/[playerId]` | 3.4 kB | 306 kB |

## 4. Shared shell (static analysis)

**Middleware** (`src/middleware.ts`). It does no slug or host logic. The matcher is `['/(.*\\.rsc)', '/api/admin(.*)']`, so it skips almost every request.
- It strips a trailing `.rsc` or `.prefetch.rsc` from the path and rewrites. This works around the Vercel fallback rewrite from dota2inhouse.pl.
- It returns 410 for anything under `/api/admin`.

**next.config.mjs redirects (verified).**
- `/create` goes to `/creator`.
- `/admin` goes to `/letnia/admin`.
- `/teams`, `/groups`, `/schedule`, `/playoffs`, `/fantasy`, `/pickem`, `/stats`, `/rules`, `/faq`, `/standins`, `/register` and `/my-team` get a permanent redirect to `/letnia/<same>`.
- Because these redirects run first, the top-level legacy page files are effectively dead for those URLs (inferred: the redirect precedes page resolution).
- I did not find any cache headers in `next.config.mjs`.

**Root layout** (`src/app/layout.tsx`).
- It is an async server component and awaits `getLocale()` and `getMessages()` (next-intl). `src/i18n/request.ts` reads the `NEXT_LOCALE` cookie, so every route is dynamic and none is statically generated (inferred).
- Fonts: Space_Mono and GeistSans from `next/font`, plus 7 local fonts from `src/app/fonts.ts`. All the CSS variables are put on `<body>`.
- A blocking inline script applies the cached theme from `sessionStorage` (`theme-cache-<slug>`) before first paint.
- Provider tree: `NextIntlClientProvider`, then `AuthProvider`, then `TournamentProvider`, then `TimeProvider`, then `children` and `Toaster`.
- Every route pays for three things:
  - `AuthProvider` (`context/AuthContext.tsx`) runs `onAuthStateChanged` and `fetch('/api/login/providers')` on mount.
  - `TournamentProvider` (`context/TournamentContext.tsx`) runs `refreshTournaments()` on mount, which is a `getDocs` of the whole `tournaments` collection (`lib/api/tournaments.ts` `fetchTournaments`). It also runs `fetchTournamentBySlug`, which is `getDocs(query(tournaments, where slug==))`, once a slug is set. These two run in parallel, with no `onSnapshot`.
  - `lib/firebase.ts` initialises the Auth, Firestore, Storage and Functions SDKs in the browser. On the server it exports stubs.
- Note that `TournamentProvider` is mounted in the root layout without an `initialTournamentSlug`. The slug only arrives later, when `[tournamentSlug]/layout.tsx` calls `setTournamentSlug` in an effect.

**Tournament layout** (`src/app/[tournamentSlug]/layout.tsx`, `"use client"`, 249 lines). This wraps every `/[slug]/*` page, including home.
- Waterfall: render, hydrate, effect calls `setTournamentSlug(slug)`, then provider effect fetches the tournament doc, then `tournament` becomes non-null.
- **Children are not rendered until `tournament` is loaded.** The code is `{tournament && (<> navbar, PackFinder, <main>{children}</main> ...)}`. So no page component, and none of its fetches, mounts before the tournament doc arrives.
- A full-screen `LoadingScreen` overlay stays up while `showLoading` is true: `isLoading || !tournament || !bgImageReady || !pageReady || !fontsReady || heroMediaPending`.
  - `bgImageReady` waits for the theme background image (`new Image()` plus `decode()`, 3 s timeout).
  - `pageReady` waits two `requestAnimationFrame` calls.
  - `fontsReady` comes from `ThemeFontApplier`.
  - `heroMediaPending` applies to home only: it waits for the hero videos to paint a frame (`HERO_VIDEO_GATE_TIMEOUT_MS`).
  - There is a 420 ms fade-out after the gate opens.
- Wrappers: `DraftGate` (reads `useAuth` and `checkIfAdmin`), `TournamentRedirect` (client-side redirect via `redirectToSlug`, e.g. `/pdl` to `/pdl-s2`), `DynamicFontLoader`, `ThemeFontApplier`, `HomeNavigationProvider`, `ErrorBoundary`, `HeroMediaGateProvider`, `PackFinder`, `TournamentNavbar` and `Footer` (not on home).
- Both `src/app/loading.tsx` and `src/app/[tournamentSlug]/loading.tsx` render `<LoadingScreen/>`. The Suspense fallback covers only route chunk fetching.
- Legacy top-level pages (e.g. `/creator`, `/organizer`) get only the root layout. They have no tournament layout, no navbar and no `TournamentProvider` slug.

## 5. Route table (static analysis)

All `[slug]` routes are under `src/app/[tournamentSlug]/`. All pages are client components unless noted. Every route is subject to the shell gate above (tournament doc loaded first). No page file exports `revalidate` or `dynamic`. The only caching in this area is `unstable_cache` in the dataset route. I did not open every file in full: reads are counted from grep of `getDocs`, `fetch` and `collection(...)`.

| Route | Page file | Server/client | Data source(s) | Loading screen | Waterfall? | Approx. reads | Caching |
|---|---|---|---|---|---|---|---|
| `/` | `app/page.tsx` | server | none | none | redirect | 0 | `redirect('/wiosenna')` |
| `/[slug]` (home) | `page.tsx` renders `components/tournament/FullScreenHomePage` | client | browser `getDocs`: `usePDLData` (divisions, teams, matches scheduled, matches completed, in parallel). Separate effects: matches, teams (plus per-team players only if there is no roster map), `playoff_matches`, teams and matches again if league, `where captainId==uid` if signed in. Dynamic sections: `StatsHub` calls `/api/stats/dataset` when idle. | Layout overlay, with the extra hero-video gate | After the tournament doc, the effects fire in parallel. | about 10 or more (inferred: roughly 4 + 1 + 1 + 1 + 3 + 1), plus the dataset | Dataset: `unstable_cache` 600 s + `s-maxage=300` |
| `/[slug]/teams` | `teams/page.tsx` | client | `getDocs(tournaments/{id}/teams)`, then per-team `players` `getDocs` only without a roster map. Legacy: `getAllTeams()`, which does 1 + N player reads. | Layout overlay, then the page's own `<LoadingScreen/>` while `loading` is true | Yes: tournament doc, then page effect, then teams, then players | 1 (+N legacy) | none |
| `/[slug]/schedule` | `schedule/page.tsx` | client | `getDocs(.../matches)`; legacy `getAllMatches()` | own `<LoadingScreen/>` | Yes | 1 | none |
| `/[slug]/stats` | `stats/page.tsx` | client | none; `HomeViewRedirect` does `router.replace('/slug?view=stats')` | `<LoadingScreen/>` | redirect after hydration, then the whole home load | 0, then home | none |
| `/[slug]/rankings` | `rankings/page.tsx` | client | same redirect to `?view=rankings` | `<LoadingScreen/>` | same | 0, then home | none |
| `/[slug]/teams/[teamId]` | `teams/[teamId]/page.tsx` | client | redirect to `?view=teams&team=id` | `<LoadingScreen/>` | same | 0, then home | none |
| `/[slug]/teams/[teamId]/players/[playerId]` | `.../page.tsx` (10 lines) | not inspected in detail (inferred: same redirect pattern) | not checked | not checked | not checked | not checked | not checked |
| `/[slug]/groups` | `groups/page.tsx` | client | `usePDLData`: 4 parallel `getDocs` (divisions, teams, scheduled matches, completed matches). Shows "unavailable" if not MMR-limited. | own `<LoadingScreen/>` while `loading` is true | Yes | 4 | none |
| `/[slug]/playoffs` | `playoffs/page.tsx` | client | league: `teams`, then `matches`, then (grep: 4 `getDocs`) `playoff_matches` | own `<LoadingScreen/>` | Yes, sequential awaits (inferred from reading the first part) | about 3-4 | none |
| `/[slug]/divisions` | `divisions/page.tsx` | client | `usePDLData` (4 parallel) | own `<LoadingScreen/>` | Yes | 4 | none |
| `/[slug]/divisions/[divisionId]` | `divisions/[divisionId]/page.tsx` | client | `getDocs(divisions)` plus more (2 `getDocs`) | own `<LoadingScreen/>` | Yes | about 2 | none |
| `/[slug]/fantasy` | `fantasy/page.tsx` | client | `Promise.all` of fantasy API helpers (`lib/firestore`) plus dynamic-imported `firebase/firestore` for `fantasyRounds` and `teams` | own `<LoadingScreen/>` | Yes, chained | about 3 or more | none |
| `/[slug]/pickem` | `pickem/page.tsx` (also dynamic-imported by the home page) | client | `getDocs(teams)` plus `lib/firestore` helpers | own `<LoadingScreen/>` | Yes | about 3 | none |
| `/[slug]/register` | `register/page.tsx` (1127 lines) | client | `getDocs(teams)`, 2 `fetch` calls | none | Yes | about 3 | none |
| `/[slug]/rules` | `rules/page.tsx` | client | `getDocs(rules)`, then `getDocs(paragraphs)` per section (N+1) | own `<LoadingScreen/>` | Yes: sections, then paragraphs | 1 + N | none |
| `/[slug]/news` | `news/page.tsx` | client | `getDocs(announcements)` | own `<LoadingScreen/>` | Yes | 1 | none |
| `/[slug]/prizes` | `prizes/page.tsx` | client | `getDocs(prizes)` | none | Yes | 1 | none |
| `/[slug]/diploma` | `diploma/page.tsx` | client | `getDocs(teams)` | own `<LoadingScreen/>` | Yes | 1 or more | none |
| `/[slug]/about`, `/faq`, `/format-lan`, `/privacy` | respective `page.tsx` | client | static content; no Firestore | none | no, but still behind the shell gate | 0 | none |
| `/[slug]/admin` | `admin/page.tsx` | client | `lib/auth` admin check | own `<LoadingScreen/>` | Yes (auth, then check) | not counted | none |
| `/[slug]/account` | `account/page.tsx` renders `AccountPage` | client | not inspected | not inspected | not inspected | not counted | none |
| `/[slug]/my-team` | `my-team/page.tsx` | client | Letnia: `MyTeamView`; others: `router.replace('/slug/account')` and render null | none | redirect | not counted | none |
| `/[slug]/newcaptain` | `newcaptain/page.tsx` | client | 1 `fetch` (`/api/captain-change/redeem`) | none | no | 0 | none |
| `/[slug]/cards`, `/karty` | `cards/page.tsx`, `karty/page.tsx` | server | server `redirect('/slug?view=cards')` | none | no | 0 | server redirect |
| `/[slug]/konto` | `konto/page.tsx` | server | server `redirect('/slug/account')` | none | no | 0 | server redirect |
| `/[slug]/cards/duel/[id]` | `cards/duel/[id]/page.tsx` | client | `DuelScreen` (not inspected) | not inspected | not inspected | not counted | none |
| `/creator`, `/creator/new` | `creator/page.tsx`, `creator/new/page.tsx` | client | `lib/api/tournaments` (not read in detail) | none | not checked | not counted | none |
| `/organizer` | `organizer/page.tsx` | client | 1 `fetch` plus `lib/api/tournaments` | none | not checked | not counted | none |
| `/teams`, `/groups`, `/schedule`, `/playoffs`, `/stats`, `/fantasy`, `/pickem`, `/rules`, `/faq`, `/standins`, `/register`, `/my-team` | top-level `page.tsx` files | client | Letnia root collections (e.g. `getAllTeams`, `getAllMatches`, `onSnapshot` in `app/stats`) | local text spinners | n/a | n/a | permanently redirected to `/letnia/*` by `next.config.mjs`, so effectively unreachable (inferred) |
| `/teams/[teamId]` (+ `players/[playerId]`) | `app/teams/[teamId]/page.tsx` | client | not inspected | `<LoadingScreen/>` | not checked | not checked | not redirected by `next.config.mjs` (only `/teams` is), so possibly still reachable (inferred) |
| `/fantasy/calculator`, `/fantasy/scoring-guide` | 9-line files | server | static | none | no | 0 | none |

Not checked: `onSnapshot` use in components (none found in any `[slug]` page file), the exact read counts of `AccountPage`, `DuelScreen`, `register` and `admin`, and the `[tournamentSlug]/standins` route (no page file under `[tournamentSlug]` for it; only the top-level `app/standins/page.tsx` exists).

## 6. Data flow of the home page and the subpages (static analysis)

All of the following was verified by reading the code, not by measuring.

**Identical for every route (the shared cost).**
1. Hydrate the JS bundle.
2. `TournamentProvider` fetches the tournament doc by slug (`fetchTournamentBySlug`), and in parallel the whole `tournaments` collection. This is one browser `getDocs` round trip, and it only starts after `[tournamentSlug]/layout.tsx` effects set the slug.
3. Only then are `children` mounted (`{tournament && ...<main>{children}</main>}`). Page data fetches therefore start strictly after step 2.

**Home** (`components/tournament/FullScreenHomePage.tsx`).
- Its comment says "Data fetching - all at once on mount". The effects start at about lines 378, 403, 465 and 517. Together with `usePDLData` (line 279, 4 parallel `getDocs`), all of them fire together once `tournament.id` exists. They are parallel, not chained.
- The big difference: this data load runs while the layout's full-screen `LoadingScreen` is still visible. That overlay also waits for fonts, the background image and the hero videos (an extra gate that only applies to home). Those waits overlap with the data fetches, so the data wait is largely hidden. The home page never shows a second loader. Its sections render with empty arrays, so there is no page-level loading state (inferred from the absence of any `if (loading) return <LoadingScreen/>` in the home component).
- The `/api/stats/dataset` call is not on the critical path. The stats hub is dynamic-imported with `ssr:false` and starts the dataset through `useWarmup` after `whenIdle(..., 3000)` (`StatsHub.tsx` ~line 60). `loadStatsModel` (`stats-lab/kit.tsx:68`) caches the result per session. Server side, `route.ts` uses `unstable_cache` (revalidate 600 s) plus `Cache-Control: s-maxage=300`.
- The home sections receive their data as props (`ScheduleSection matches=...`, `TeamsSection teams=...`), so every section is populated from the one fetch pass.

**Subpages.**
- The page mounts only after the tournament doc, then its own `useEffect` starts its own fetch. It begins with `loading = true` and returns a second `<LoadingScreen/>` (e.g. `teams/page.tsx` `if (loading) return <LoadingScreen />`). The user sees the layout loader, a brief gap, then the page loader.
- Teams: `getDocs(teams)`, then `Promise.all` of per-team `players` reads only when a team has no `roster` map. Legacy Letnia uses `getAllTeams()` (1 + N reads).
- Rules: sections, then paragraphs per section (N+1).
- Playoffs and fantasy: chained awaits (teams, matches, `playoff_matches`; fantasy helpers plus dynamic `import('firebase/firestore')`).
- `usePDLData` pages (groups, divisions) do 4 parallel reads but have no cache, and the same data is re-fetched on each navigation, because each page owns its fetch and nothing is shared between pages (e.g. teams and matches are fetched separately by home, teams, schedule, groups and playoffs).
- Redirect-only routes (`stats`, `rankings`, `teams/[teamId]`) first run the whole shell gate, then `router.replace` to `/slug?view=...`, which triggers home's data load. They pay the cost twice.
- Every navigation re-mounts the page (`ErrorBoundary key={tournament.id}` only keys per tournament). The tournament doc is held in context, so in-app navigation reuses it, but each page's data is re-read from Firestore each time.

**Net difference (inferred).** The Firestore work is similar in kind. Home overlaps it with its own heavy loading gate and shows no second loader, while subpages run it after the gate with a second loader and no shared cache. I have not measured any timings.

## Problems seen

- The server renders an empty shell for every page and sends it with `private, no-store`, so a Cloud Run request is made on every view and nothing is cached at the CDN (section 1).
- `/sitemap.xml` is prerendered at build time from the production `tournaments` collection with the service account (`sitemap.ts:86-89`). It changes only on a redeploy, and every build, including a developer's local build with `.env.local`, reads production. In S0 a local build did exactly that once (read only; see STATUS.md).
- The Firestore database is in the US (`nam5`) while the users and Cloud Run are in Europe: about 0.95 s for the first request and 0.18 s for later ones, measured from Poland.
- The stats dataset takes up to 7.8 s to build when its cache has expired. The first visitor after expiry waits for that, and each Cloud Run instance keeps its own `unstable_cache` copy.
- The home page reads teams and matches more than once on the same load (`usePDLData` plus its own effects).
- The home page does not use a single cached request for its content. It makes about 10 or more browser Firestore reads on load, including duplicate reads of `teams` and `matches` (`usePDLData` plus its own `matches` and `teams` effects plus the playoffs effect).
- Teams are fetched twice on home: once inside `usePDLData` and once in the teams effect. If the league playoffs effect runs, teams and matches are read a third time.
- No page renders before the tournament doc arrives (`[tournamentSlug]/layout.tsx`: `{tournament && ...}`), so every subpage fetch waits on one browser round trip plus hydration.
- Every subpage with data shows two loaders in sequence: the layout overlay, then the page's own `<LoadingScreen/>`.
- `refreshTournaments()` reads the entire `tournaments` collection on every page load in the root provider, though most pages only need one doc.
- There is no `onSnapshot` in the pages inspected, so everything is one-shot `getDocs` with no shared client cache and no HTTP caching.
- `rules/page.tsx` issues one paragraphs read per rules section (N+1). Legacy `getAllTeams()` issues one players read per team (N+1).
- The `/stats`, `/rankings` and `/teams/[teamId]` routes only redirect after hydration to `/slug?view=...` and then load the home page, so a deep link costs a full extra shell cycle.
- `TournamentRedirect` redirects superseded tournaments client-side after the tournament doc loads (it says so in its own comment).
- The root layout reads cookies via next-intl for every request, which opts every route out of static generation (inferred).
- Seven local fonts plus Space_Mono and Geist are attached to `<body>` on every route, and the loading gate also waits for fonts, the background image and (home) hero videos.
- Top-level legacy pages (`app/teams`, `app/stats` etc.) are shadowed by permanent redirects in `next.config.mjs`. `app/teams/[teamId]` and `app/teams/[teamId]/players/[playerId]` are not covered by those redirects.
