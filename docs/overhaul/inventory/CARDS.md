# Card game inventory

Written in S0 (2026-11-13) by an explorer agent and checked by Opus. Sources: the decision log `memory/card-game-design.md` in the owner's Claude memory folder ("note" below) and the code at commit c642ed5. Line numbers are in the files named, mostly under `src/lib/card-lab/`. The game is a two-player area-control card game named "Kontrola mapy" (internally "outposts"). The earlier "Linie" lane game was deleted.

## Rules
- **Goal.** Reduce the rival's Ancient to 0. Taking an objective deals damage to it. `WIN_POINTS = 10`; the tutorial uses 6 (`src/lib/card-lab/outposts.ts:21`, `tutorial.ts:23`). Score is shown as damage to the Ancient.
- **Board.**
  - Each side has a base and 3 random objectives: Roshan (2 points, `takePoints`, `outposts.ts:64`), Outpost (+1 order per turn, `:481`), Lotus Pool (+1 draw, `:480`), and others (Tormentor draws 2, `:450`).
  - Up to 3 units per side can stand at an objective (`PER_SIDE_AT_OBJECTIVE`, `:44`).
- **Deck and hand.**
  - Deck is 20 cards, with at least 2 per position and 10 free slots (`DECK_SIZE`, `DECK_PER_ROLE`, `:41-43`).
  - One card per player per team (`deckKey`, `cards.ts:207`).
  - Start hand is 4, maximum hand is 7, and you draw 2 per turn (`:39-40`, `DRAW = 2`).
  - The second player is dealt 6 and skips the turn-2 draw (`:37`, `:480`).
- **Turn.**
  - Three phases: deploy cards from hand to base, move units as a plan, then fights resolve.
  - Orders are 3 per turn, shared between deploying and moving (`ORDERS = 3`). A group moving together costs 1.
- **Card stats.**
  - One card per player per series played, built from real match data (`buildSeriesCards`, `cards.ts:82`).
  - Rating `ovr` is a percentile rank of the performance score within the role, range 45–99 (`cards.ts:117`).
  - Five attributes are percentile-ranked, range 30–99.
  - Standins get cards with the role of the roster player they replaced (`standinRole`, `cards.ts:70`).
  - Cards are frozen at issue time (`frozen.ts:1`).
  - Strength (SIŁA) is derived from the card (`cardStrength`) plus a role modifier: Offlane +1, supports −1 (`outposts.ts:137-139`). The user-chosen curve is "1–9" (note l.41).
  - TOTW (team of the week/round) cards are twins with +1 strength (`cards.ts:50`, `:134`).
- **Abilities, one per position** (`outposts.ts:67-72`):
  - Carry "Farma": +1 strength per turn while on your objective, up to +3.
  - Mid "Gank": moves directly between objectives.
  - Offlane "Tank": must be killed before others can be hit.
  - Support "Smoke": one group per turn moves free.
  - Hard Support "Aura": +1 strength to every friendly unit on the same objective.
  - Teammates sharing an objective get a Drużyna +1 bonus.
- **Fights.**
  - Alternating single attacks, attacker first, continuing to the end (`RULES.toTheEnd = true`, `:32`).
  - A hit deals the attacker's strength. A unit dies when damage taken reaches its strength (`:288-290`).
  - Tie: both sides die; the objective keeps its flag but scores nothing until reoccupied (note l.41).
  - `wounds` is off (`:34`).
- **Clock (PvP only).** Presets in `PACES` (`pvp.ts:36-39`):

| Pace | Turn | Hit | Reserve |
|---|---|---|---|
| Szybki | 20 s | 10 s | 60 s |
| Normalny | 30 s | 15 s | 90 s |
| Spokojny | 60 s | 25 s | 180 s |
| none | no deadlines | no deadlines | no deadlines |

  - Away for 90 s means a loss (`pvp.ts:29`).
  - Once the reserve hits 0, the automatic hit fires (`pvp.ts` `chargeHit`).

## Economy
- **Packs.**
  - One card per role, drawn on the server with a weight per rarity (`RARITY_WEIGHT` 1/.95/.9/.8/.65, `cards.ts:168`).
  - A TOTW card replaces the regular one with 25% chance (`TOTW_CHANCE`, `:146`).
  - Pool is the stats of that tournament (`cardCollections/{key}__{uid}`, `collection.ts:45`).
- **Rarity.** Wood, bronze, silver, gold, elite by strength (1–2, 3–4, 5–6, 7–8, 9+; `cards.ts:63`), plus a holographic TOTW tier.
- **Income.**
  - 10 welcome packs (`START_PACKS`, `collection.ts:15`).
  - `roundPacks` per round to every collection, default 3, set per tournament (`rewards.ts`, `settings.ts`).
  - Admin "Daj paczki" for contests, subs and channel points (`api/manage/cards`, `cardGrants`).
  - Random site finds: at most 1 beat per 55 s, base chance 1/120 per counted minute divided by (1 + finds in 7 days / 2) (`finds.ts:15-40`, `PackFinder.tsx`).
- **Duplicates are kept as separate cards.** There are no shards (see discrepancies).
- Cards need a nick or a linked Discord (`hasName`, `collection.ts:20`).

## PvP
- **No matchmaking.** Duels are created by challenging a named player (inbox notification) or by an open link.
  - A lobby stays open while the host sends a heartbeat, for at most 30 minutes.
  - The first guest to press "Przyjmij" gets a 5-minute seat.
  - Challenger picks the pace.
  - "Szybka talia" (`api/cards` action `quick`) is for a newcomer's first duel.
- **Server authority.**
  - Game state is JSON in `cardDuels/{id}`. All moves go through `/api/cards/duel`, validated by `parseMove` (`route.ts:29-39`) and applied by pure `act()` in `pvp.ts`.
  - Clients read only their own `views/{uid}`, flipped, with rival hand and decks blanked as `hidden:n` (`viewFor`).
  - Planning is queued on the client and sent as one `batch`, all-or-nothing.
  - Timeouts are settled lazily by `settle()`, and `settleStale()` runs in the orchestrate cron.
  - The client predicts its own hits locally.
- **Rating.** Elo per tournament, start 1000. K is 40 for the first 10 games, else 24. Repeat games against the same opponent on the same day weigh 1, ½, ¼, 0 (`eloDelta`, `pvp.ts:347`). A public ranking and game history exist.

## Tutorial
- A fixed scripted 6-HP match (`tutorial.ts:5-13`): turn 1 places 3, turn 3 sends a group to Roshan and Mid to Lotus, turn 4 the rival attacks, turn 5 wins.
- `tutAllows(step)` gates actions, and a `Coach` overlay shows the steps.
- Practice AI levels: Samouczek, Łatwy, Średni, Trudny, Mistrz (`outposts-ai.ts:13-21`). Mistrz gets a deck +8 stronger.

## Data & code

| File | Lines |
|---|---|
| src/lib/card-lab/outposts.ts (rules) | 483 |
| src/lib/card-lab/pvp.ts | 383 |
| src/lib/card-lab/cards.ts | 255 |
| src/lib/card-lab/outposts-ai.ts | 240 |
| src/lib/card-lab/tutorial.ts | 96 |
| src/lib/card-lab/frozen.ts | 79 |
| src/lib/card-lab/settings.ts | 52 |
| src/server/card-lab/duels.ts | 337 |
| src/server/card-lab/collection.ts | 151 |
| src/server/card-lab/rewards.ts | 142 |
| src/server/card-lab/finds.ts | 61 |
| src/app/api/cards/duel/route.ts | 128 |
| src/app/api/manage/cards/route.ts | 127 |
| src/app/api/cards/route.ts, find, report | 56, 28, 79 |
| src/components/card-lab/OutpostsGame.tsx | 1743 |
| src/components/card-lab/Home.tsx | 536 |
| src/components/card-lab/Album.tsx | 312 |
| src/components/card-lab/duel/DuelScreen.tsx | 290 |
| src/components/card-lab/CardLab.tsx | 276 |
| src/app/[tournamentSlug]/admin/tabs/CardsTab.tsx | 255 |

The game library, server code and UI total about 4,700 lines.

**Firestore paths:**
- `cardCollections/{key}__{uid}` (packs, cards, slots).
- `cardDuels/{id}` and `cardDuels/{id}/meta/history`.
- `views/{uid}`.
- `cardRankings/{key}/players/{uid}` and its `games/{id}`.
- `cardRankings/{key}/pairs/{day}__a__b`.
- `cardGrants`, `cardRewards`, `cardActivity`, `cardReports`.
- `tournaments/{id}.cardSettings`.
- `accounts/{uid}/inbox` (invites).

**Browser storage:** `card-lab:intro-seen`, `karty:hints`, `card-lab:level`, `card-duel:{id}:plan`. Collections and decks moved to the server in commit f376dfe.

**Routes.** The game is a home-page section (`?view=cards`); `/cards` and `/karty` redirect to it (`cards/page.tsx`, `karty/page.tsx`, 7 lines each). Duel page is `/cards/duel/[id]`.

## Tester feedback
These come from the note, not from the code.
- Testers don't read text. Anything that looks like an action must be clickable. A selected area must never grey out.
- They could not win against the old AI, and the sim agreed (about 2% beginner win rate). Difficulty levels were added.
- They disliked pre-filled choices and preview numbers in fights. They want game-relevant info, not "random facts", and dislike explanatory sub-texts.
- They wanted the cards bigger (hence 166 px).
- They found Mistrz "way too easy", so it was hardened. They called the Linie UI "basic and AI-like".
- Live tests: stuck PvP fights, a latency of about 500 ms per move (Firestore `nam5` in the US), and "never see the computer play for me while I have time".
- No docs/ note records card feedback. `docs/overhaul/BRIEF.md:37` states: "The card game lacks depth. New players are confused, do not know how to play, and mostly see no reason to play."

## Note-vs-code discrepancies
- **Shards.** The note l.17 says duplicates become shards that buy packs. There is no shard economy: `grep` finds only game-board icons in `outposts.ts`. Duplicates stay as extra cards.
- **Matchmaking.** The note says "NO matchmaking", and the code agrees. It is challenge by name or open link only.
- **Deck rule.** Note l.21 says "bigger deck"; note l.48 says "2 per position + 10 free". The code matches l.48 (`outposts.ts:43`).
- **Drops.** The note describes fixed rarity odds (l.74, l.77). It then says they were replaced by per-card weights (l.79), and the code has the weights.
- **Draw.** Note l.43 says draw 2, and the code has `DRAW = 2`. Note l.87 says the second player gets 6 cards, matching `secondBonus`.
- **Clock.** Note l.57 says turn 30 s plus a 60 s reserve and a 60 s deck pick. The code has paces (default 30/15/90) and no deck-pick phase. Note l.61 and l.87 already update this.
- **Route.** The note says `/card-lab` and later `/karty`. The code has `/cards` and `/karty`, both redirecting to `?view=cards`.
- **Browsing packs.** Note l.72 and l.75 mark "browsing packs" as not chosen. `finds.ts` and `PackFinder` are built (random site finds).
- **Not checked.** I did not run the app or simulations, and I did not read the UI files in full. I did not verify Elo storage details, the `rewards.ts` seeding, or the Firestore rules.

## Problems seen
- **Strength.**
  - Card strength is 1–9 with a role modifier. The maximum-to-minimum ratio drives the outcome, so the stronger deck wins about 86% (note l.50).
  - The note says "better cards must simply be better", so deck quality dominates.
  - Skill margin is by AI: Mistrz beats Trudny about 80%.
  - The hardest AI gets a deck +8 stronger.
- **Complexity.**
  - Orders, phases, groups, Smoke by place, Aura, team bonus, Farma, Tank and Roshan scoring make a long rule list.
  - Testers don't read, so hints, a tour, coach steps and intro pages were added. Rules are explained in several places.
- **Pack outcomes.** Real rarity distribution is about wood 30 / bronze 25 / silver 22 / gold 18 / elite 5% (note l.79). There are no shards, so duplicates have no use.
- **Fights.** Fights run to the end, so one fight can swing a whole objective.
- **Latency.** Firestore is in the US (`nam5`), and each duel move costs about 450–550 ms.
- **Code risk.** `OutpostsGame.tsx` is 1,743 lines and holds the entire game UI, tutorial and net mode.
- **Reliability.** The note records many PvP bugs fixed in a single week: stuck fights, away detection and duplicate views. Server settling is lazy and cron-driven.
- **Wiped data.** All duels and rankings were wiped on 2026-11-07 (note l.88), so there is no real ranking history.
