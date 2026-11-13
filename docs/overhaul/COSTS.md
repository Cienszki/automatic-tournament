# Costs: what will be paid, and when

Written on 2026-11-13 by Fable, for the owner. It follows the decisions in `ARCHITECTURE.md` (ADR-03 hosting, ADR-04 database, ADR-09 jobs, ADR-10 bot). Prices were read from the vendors' own pages on that day and are in US dollars per month, before tax. Usage figures are estimates from the S0 model tournament (16 teams, 120 games a season, 2,500 page views a month); the real numbers will come from the dashboards once the new platform has traffic.

**The short version.** Building costs nothing new. Running the first tournaments on the new platform costs nothing new, or $5 for a second bot service. The first real bill, about $45 to $70 a month, starts when the platform takes money or outgrows the free limits, and not before. At 1,000 active tournaments the estimate is $300 to $500 a month, which is $0.30 to $0.50 per tournament.

## 1. What is paid today

I cannot see the bills. Please fill in the last column once; it turns the estimates below into real differences.

| Service | Used for | Plan, as far as the code shows | Your monthly cost |
|---|---|---|---|
| Firebase (project `tournament-tracker-f35tb`) | hosting on Cloud Run, Firestore, sign-in, files | Blaze, pay per use | ? |
| Railway | the tournament bot (one container) | Hobby is $5 including $5 of usage | ? |
| Vercel | the community site, which owns the domain | Hobby (free) or Pro | ? |
| Bunny | hero videos | pay per use | ? |
| Domain `dota2inhouse.pl` | | yearly | ? |
| OpenDota, Steam Web API, Gemini | match data, the rules assistant | free tiers | 0 |

## 2. Phases

Each phase starts at an event, not on a date. I cannot give dates: they depend on how fast the work packages are run.

### Phase A. Building (from now until the first tournament is served by the new platform)

New cost: **$0**.

| Service | Plan | Why it is enough |
|---|---|---|
| Supabase (database) | Free, two projects: staging now, production later | 500 MB each; a tournament needs an estimated 2 to 5 MB |
| Vercel (previews of the new app) | Hobby | a staging site with a handful of visitors |
| Firebase project for staging | Blaze with a $1 budget alert | only sign-in and a small file bucket; inside the free allowance |
| Sentry (errors) | Free | 5,000 errors a month |
| GitHub Actions (tests, nightly backup) | Free minutes | the test suite is a few minutes per push |

Everything paid today continues unchanged, because production is not touched.

### Phase B. The archive and the first seasons are live; the site earns nothing

Starts when Letnia and the finished seasons are served by the new platform (after milestone M1), and continues when new seasons start on it (after M3).

New cost: **$0 to $5**.

- Vercel Hobby and Supabase Free still carry it.
- A second small Railway service runs the new bot while the old bot finishes the old site's seasons: about $5. It ends when the old bot is switched off.
- The Firebase bill goes down as tournaments leave the old site, and to almost nothing when the old site retires (sign-in and files stay, and are free at this size).

What to watch in this phase, because a free plan stops instead of billing:

| Limit | Free allowance | Estimated use | What happens at the limit |
|---|---|---|---|
| Vercel CDN requests | 1,000,000 a month | about 75,000 per active tournament, so 10 to 15 tournaments | the site is paused until 30 days have passed |
| Vercel data transfer | 100 GB a month | well under, with cached pages | same |
| Supabase database size | 500 MB | 100 or more tournaments | writes are refused |
| Supabase backups | none | | a nightly dump from CI replaces them (WP-36) |

The platform sends an alert at 70% of each (ADR-13), so the upgrade is a decision, not a surprise.

### Phase C. Public launch: the first outside organizers, or the first income

Starts at the first of: the platform takes money in any form (organizer plans, ads, paid sponsor placement); a Vercel limit comes near; an organizer needs backups you can promise.

New cost: **about $45 to $70**.

| Service | Plan | Cost | Why now |
|---|---|---|---|
| Vercel | Pro, one developer seat | $20 | the free plan is for non-commercial use only; unlimited domains for organizers; no pause at a limit |
| Supabase | Pro | $25 | daily backups kept 7 days, no pausing, 8 GB |
| Railway | Hobby, one bot service | $5 to $20 | depends on how many lobbies run at once |
| Sentry | Free | $0 | |
| Staging | stays on the free plans | $0 | |

### Phase D. About 100 active tournaments

New cost: **about $80 to $130**.

| Service | Cost | Note |
|---|---|---|
| Vercel Pro | $20 to $30 | about 7.5 million CDN requests, inside or just over the included usage |
| Supabase Pro | $25 to $40 | perhaps one size up for the database |
| Railway | $20 to $40 | two or three bot workers; not known until WP-23 measures one |
| OpenDota key | $5 to $10 | paid per call beyond the free daily allowance; price to confirm |
| Sentry | $0 to $26 | the paid plan if errors pass 5,000 a month |

### Phase E. About 1,000 active tournaments

New cost: **about $300 to $500**, so $0.30 to $0.50 per active tournament.

| Service | Cost | Note |
|---|---|---|
| Vercel Pro | $120 to $170 | about 75 million CDN requests and 0.5 to 1 TB of transfer; this is the largest item and the first to optimise or move (ADR-03, option 3) |
| Supabase Pro | $60 to $110 | a medium database, 3 to 5 GB of data |
| Railway | $50 to $150 | bot workers for a busy evening; the least certain number here |
| OpenDota key | $20 to $50 | |
| Sentry | $26 | |

At this size an organizer plan of a few dollars a month covers the platform many times over. S4 sets the prices.

## 3. Costs that engineering does not remove

- **Steam accounts for the bot.** Each series played at the same time needs one account. Accounts cost no money, but they need phone numbers and care, and Valve limits how fast one account may create lobbies. This is the real ceiling on how many matches can run in one evening.
- **OpenDota.** Its free allowance is shared by the whole platform. A paid key is needed beyond a few tournaments.
- **The rules assistant (Gemini).** Today one free daily allowance is shared by everyone. It becomes an allowance per organization, and beyond the free tier it is paid per question.
- **Video (Bunny).** Paid by the amount watched. A tournament with a hero video costs more than one without.

## 4. What I chose because of the budget

- **Supabase over Neon.** Neon bills by the hour the database is awake. The bot and the job scheduler keep it awake, which would pass Neon's free allowance. Supabase's free plan is always on.
- **The job scheduler lives in the database**, because Vercel's free plan runs scheduled functions only once a day.
- **Vercel Hobby first.** It is free and needs no adapter. The price of that choice is the non-commercial rule: the day the site earns anything, the $20 plan is required.
- **One region.** A second region doubles the database bill (ADR-17).
- **The load test for 1,000 tournaments** runs against a database inside CI, which is free, and only its CDN part runs on staging.

## 5. Questions that change these numbers

1. What do you pay today (the table in section 1)?
2. Does the site already earn anything: sponsors who pay for placement, entry fees, ads? If yes, Vercel's free plan is not allowed for the new app from its first day in production, and Phase B costs $20 more.
3. Which Vercel plan is the community site on? If it is already Pro, the new app is a second project on the same plan and the $20 is already paid.

## Sources

Read on 2026-11-13.

- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Supabase pricing](https://supabase.com/pricing)
- [Neon plans](https://neon.com/docs/introduction/plans)
- [Railway pricing](https://docs.railway.com/reference/pricing/plans)

Not verified, from memory: Sentry's free allowance and its $26 plan, OpenDota's paid key, and Vercel's price per extra million requests. Confirm each when its phase comes.
