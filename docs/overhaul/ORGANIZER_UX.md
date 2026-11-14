# Organizer experience

Written in S2 (2026-11-14) by Fable. It covers the owner's concern 2 (the admin panel is a patchwork) and the organizer-facing part of concern 6 (a public platform organizers choose). It designs what an organizer sees and does, from signing up to the end of a season. The work packages that build it are WP-41 to WP-49 in `ROADMAP.md`.

**The test this design must pass.** A new organizer who has never seen the site creates a tournament and runs it to the final without help, and wants to keep using it.

**The short version.**

1. **The panel is organized around what needs the organizer, not around features.** Today's 17 tabs become one home screen and five work areas. The home screen answers three questions: where the tournament is, what needs a decision, and what the platform did by itself.
2. **Most controls disappear.** Of about 95 controls in today's panel, 31 are kept, 24 are merged into another control, 17 are replaced by automation, 6 move to the platform's super admin, and 17 are dropped. Section 4 lists every one.
3. **The wizard produces a tournament that is ready to open registration.** The format, the ranking rules, the bot, the rulebook and the look all start from defaults that work. Nothing after the wizard is required before publishing.
4. **A season runs without the panel.** Registration closes, groups are drawn, the schedule is generated, lobbies are created, results arrive, tables move, the bracket is seeded and the season is closed. The organizer confirms a few of these steps and is messaged on Discord only when a decision is needed.
5. **Customization has three levels:** a preset and a logo in the wizard; colours, fonts, hero and sponsors on the look screen with a live preview of the real site; and the organizer's own domain. Layout, spacing and text contrast are never editable, which is what keeps every tournament looking good.

**What this run did not do.** `STATUS.md` changed the S2 prompt for this run: no clickable prototypes and no screenshots, because agents cannot start a browser on this machine. Section 5 gives each key screen as a text wireframe in two or three versions, with the recommended one. WP-41 builds those versions as clickable prototypes behind `?v=N` so the owner can choose before the real screens are built.

**Sources.** `inventory/ADMIN.md`, `inventory/PRODUCT.md`, `ARCHITECTURE.md` (ADR-06, 07, 08, 10, 11, 15) and `SCHEMA.md`. The screens for the captain, the caster and the viewer were not read in this session; what section 7 says about them comes from the inventories.

## 1. Design principles

These follow from the brief's product rules and from "automation is the main selling point". Every screen in this document is checked against them.

1. **The panel shows state and asks for decisions. It does not ask for maintenance.** There is no "synchronize", "recalculate" or "refresh" button anywhere. If the organizer would need one, the platform has a bug, and the fix belongs to the platform's super admin, not to every organizer.
2. **One home for each fact and each setting.** Late penalties, lobby settings and the Valve league id each exist in two tabs today. Here each exists once, and the rulebook's text about them is generated from the setting, so the two cannot disagree.
3. **A problem appears where the organizer already looks, with the one action that fixes it.** There are no error banners and no warning pages. A problem is a row in the "needs a decision" list and a mark on the object it belongs to (the match, the team). The row's button is the fix.
4. **Automatic actions are visible and reversible.** Everything the platform does by itself is a line in the activity list, written as a plain past-tense sentence, with an undo where undo is possible. An organizer trusts automation they can see and take back.
5. **The next step glows; the rest is quiet.** At every stage of a tournament exactly one action is the primary one (publish, start the season, confirm the round, seed the bracket). It is the only filled button on the screen. This replaces the launch checklist, the welcome text and the hints.
6. **Choices show their outcome before they are made.** Hovering a format preset draws its structure. Hovering a place in a table highlights the bracket slot it leads to. Changing a ranking rule shows the table it would produce. A destructive action lists exactly what it removes.
7. **Defaults are decisions.** Every setting has a default taken from how PDL and Wiosenna are run, so an organizer who changes nothing gets a tournament that works. A setting that almost nobody should change is not shown until asked for.
8. **The panel looks like the site.** It uses the tournament's own theme, the same tables, team rows and match rows as the public pages, open areas with hairlines and bands, and no boxes inside boxes. The organizer edits the thing they see.

## 2. Who uses it

| Person | What they are trying to do | How often | What they need from the design |
|---|---|---|---|
| **New organizer.** Runs a Discord community or a small league. Has used Challonge, Battlefy or a spreadsheet. Has never seen this site. | Find out whether the platform can run their tournament, create it, get teams in, and get through the first match day without embarrassment. | Once to create. Then daily during registration, and on match days. | The wizard must show what they will get before they commit. After the wizard, one obvious next step at a time. Nothing that assumes they know what a Valve league, a bot account or a Buchholz score is. |
| **Experienced organizer.** The owner today; later anyone on their second season. | Start the next edition quickly, change details of the format, and otherwise be left alone. | A few minutes a week. More in the week before a season and at the switch to playoffs. | "New edition" that copies the last one. Direct access to every setting. A home screen that is empty when nothing needs them. |
| **Co-admin (tournament admin).** A trusted helper. | Share the organizer's work for one tournament. | As the organizer. | Sees everything in the tournament except its members, its domain and its deletion (ADR-06). Every change carries a name, so two admins do not wonder who did what. |
| **Referee.** A helper for match days. New role from ADR-06. | Handle tonight's matches: a late team, a stand-in, a wrong result. | Match evenings only. | Sees the home screen, matches, and teams' stand-in requests. Does not see format, look or settings, so they cannot break the tournament and have less to learn. |
| **Captain.** | Register a team, keep the roster valid, agree match times, ask for a stand-in. | Weekly. | Not a user of the panel. Their requests reach the organizer only when the rules cannot settle them (section 3.5). Their own screens are in section 7. |
| **Caster.** | See which matches are open to cast, take one, get into the lobby. | Match days. | Not a user of the panel. The organizer adds casters under People, or approves a request. A caster who takes a match is added to its lobby automatically. |
| **Platform super admin.** The owner. | Keep the platform healthy for every organizer: bot accounts and workers, failed jobs, who may create tournaments, abuse. | Daily glance; action when alerted (ADR-13). | A separate place, `/platform`, that no organizer sees. It holds everything that today sits in the tournament panel but is really about the platform. |

Two consequences shape the whole design. First, the new organizer and the experienced one use the same screens: the experienced one simply meets more of them empty. There is no "simple mode" and "advanced mode". Second, the owner stops being the only person who understands the panel, because the things only the owner understood (bot accounts, recalculation, the orchestrator) leave it.

## 3. The organizer's journey

Each step says what the organizer does, what the platform does, and what today's step it removes. "Removed" means the organizer no longer does it at all.

### 3.1 Signing up

1. The organizer opens the platform's landing page and presses "Utwórz turniej".
2. They sign in with Discord or Google. This is the same account viewers and captains use.
3. They land in the wizard. There is no "create an organization" step: the first tournament creates the organization, named after the user, and the name can be changed later under the organizer page.

**Until the public launch** creation is limited to an allowlist (ADR-06). A signed-in user who is not on it sees a short request form (who they are, what they run, a Discord contact) in place of the wizard, and the super admin approves it under `/platform`. After the launch the form disappears.

Removed: asking the owner for access by private message; the separate `/creator` template page.

### 3.2 The wizard

Three steps and a live preview. Section 5.2 has the screen.

1. **Format.** The organizer picks one of six formats and says roughly how many teams they expect. The preview draws the structure: groups, how many advance, the bracket.
2. **Name and dates.** Name, address (suggested from the name), when registration closes, when the season starts, and on which evenings matches are played.
3. **Look.** A preset, a logo and one colour. The preview is the tournament's real home page.

"Utwórz" creates a draft tournament and opens its home screen. Everything else already has a value:

| Already set by the wizard | From |
|---|---|
| Stages, groups, best-of per stage, ranking rules, tie-breakers, who advances where | the format preset (ADR-11 defaults) |
| Lobby bot on, lobby settings, lateness rules | platform defaults, the same PDL uses |
| A rulebook | a template whose paragraphs about format, lateness, stand-ins and transfers are generated from the settings |
| Team size 5, stand-ins allowed, captains agree match times inside each round's window | defaults |
| Fantasy and pick'em on, where the format supports them | defaults; the role-based fantasy formula (owner's decision 11) |
| Language, time zone, Dota server region | the organizer's browser, shown and editable in step 2 |

Removed: entering a Valve league id (question S2-1), enabling the bot, creating a division, choosing a playoff size, writing rules before anything can be published.

### 3.3 Before the season: look, domain, teams

The draft's home screen shows one primary action, **"Opublikuj i otwórz zapisy"**, and a preview link the organizer can share before publishing.

- **Look.** Optional. The look screen (section 5.5) edits colours, fonts, hero and sponsors against a live preview and publishes them in one step.
- **Domain.** Optional. Under Settings, the organizer enters a domain, gets the DNS record to add, and watches the state change to connected (section 6.4).
- **Inviting teams.** Publishing gives the organizer one registration link and a ready-made announcement text for Discord. A captain signs in, names the team, and adds players, who each confirm and link Steam. A team that is complete and has Steam linked for every player is accepted automatically. The organizer sees a team only when something is off: over the MMR cap, a player already on another roster, a name that needs a look.
- **Registration closes by itself** at the set time. If the number of teams does not fit the format (for example 13 teams for two groups of 8), the home screen says so and offers the choices: extend registration, change the group sizes, or continue with a bye.

Removed: approving every team by hand; the status dropdown and the bulk save; resolving Steam vanity addresses; refreshing avatars and hero data; closing registration by changing a status.

### 3.4 Starting the season

When registration has closed the primary action becomes **"Rozlosuj grupy i wygeneruj terminarz"**.

1. The platform proposes the groups (seeded by MMR in a snake order, or drawn at random, as the format says) and the full schedule on the chosen match evenings.
2. The organizer sees the proposal as the public pages would show it, can drag a team to another group or move a match day, and presses "Rozpocznij sezon".
3. Captains are notified with their schedule. The tournament's status becomes active.

For a Swiss format only round 1 is paired at this point.

Removed: the Divisions tab's team assignment, two different match generators, the manual matchday list, setting the status to active.

### 3.5 Running the season

On a normal match day the organizer does nothing.

| What happens | Who does it |
|---|---|
| A reminder an hour before the match | platform |
| The lobby is created, players are invited, casters get their seats | bot |
| A late team is handled by the lateness rules (wait, vote, forfeit a game, forfeit the series) | bot, by the tournament's settings |
| Each game's result and stats are imported | platform, within seconds of the game ending (ADR-09, ADR-10) |
| Tables, stats, fantasy points and card rewards update | platform |
| Captains agree a new time inside the allowed window | captains; the lobby follows |
| A stand-in inside the limits, approved by the opposing captain | captains; the lobby follows |
| The next Swiss round is paired when the last result arrives | platform; the organizer confirms before it is published (can be set to publish by itself) |
| Fantasy rounds open and lock with the match days | platform |

The organizer is needed only for what the rules cannot settle. Each of these is one row in "needs a decision" and one Discord message with a link straight to it:

| Decision | Appears when |
|---|---|
| Team needs a look | registration flagged it (MMR over the cap, player on two rosters) |
| Stand-in appeal | a captain appeals a rejected stand-in |
| Match has no time | the round's window is ending and the captains have not agreed |
| Reschedule outside the rules | captains ask for a time the rules do not allow |
| No bot for a match | 15 minutes before a match no bot account is free (the super admin is alerted at the same time) |
| Player cannot be invited | a roster player has no Steam account linked, 48 hours before their match |
| Game not recognized | a game was played but its teams match no scheduled match |
| Result could not be imported | the import failed after its retries |
| Tie | teams are level after every rule, and the place matters (ADR-11) |
| Round ready | a Swiss round is paired and waits for confirmation |
| Bracket ready | the stage is over and the bracket is seeded, waiting for confirmation |
| Caster request | a user asks to cast this tournament |
| Domain not connected | the DNS check has failed for a day |

Removed: the "Synchronizuj mecze" button; both recalculation buttons; setting scores by hand after every match; creating fantasy rounds; watching the bot monitor; running the orchestrator.

### 3.6 Fixing problems

Everything that can go wrong with a match is fixed on that match's page (section 5.3): set or change the time, correct a result, add a game by its Dota match id, remove a game, give a walkover or take one back, add a draft penalty, replace the match with a rematch. Each fix asks for a short reason where the audit log needs one, shows what it will change in the table before it is confirmed, and can be undone from the activity list.

Team problems are fixed on the team's page: change the captain, edit the roster on the captain's behalf, ban or withdraw the team. Withdrawing a team after the season started gives walkovers for its remaining matches; the dialog lists them.

Nothing here needs a second step. Tables, stats, fantasy and the bracket follow every correction by themselves.

### 3.7 Group stage to playoffs

When the last match of a stage is played, the platform resolves the advancement rules (WP-34). If a tie blocks it, the tie is the decision to make first: play a tiebreaker match (one press creates it) or order the teams by hand with a reason. Then the seeded bracket is shown, the organizer can still move a team (audited), and "Opublikuj drabinkę" makes it public and schedules the first round.

Before that moment the public bracket already exists with placeholders ("1. miejsce grupy A"), so viewers see where the season is going.

Removed: picking each team for each bracket slot from a dropdown; mirroring playoff matches; the separate visibility switch.

### 3.8 The end of the season

When the final is played the tournament becomes completed by itself. The home screen turns into a summary: final placings, the season's numbers, the fantasy and pick'em winners, and three actions.

- **"Nowa edycja"** creates a draft that copies the format, the settings, the look, the rulebook and the staff. Last season's teams get an invitation to register again with their roster pre-filled. The old address can be pointed at the new edition when it is published (today's "redirect between editions", done by hand).
- **"Pobierz dane"** exports the tournament (WP-36).
- **Prizes.** If prizes were listed, the final placings are matched to them and shown on the public prizes page. Paying them is outside the platform.

Thirty days later the tournament is archived by itself: it stays readable at its address and leaves the lists of running tournaments.

Removed: setting the status to completed and archived; the redirect card on the organizer page.

## 4. Information architecture

### 4.1 The places

Addresses are in English and labels in Polish, as the brief requires. `/{slug}/admin` is kept because it is the address people already have.

| Place | Address | Who | What it is for |
|---|---|---|---|
| Organizer page | `/organizer` | organization owner and admins | All tournaments of the organization with their state, "Utwórz turniej", "Nowa edycja", members of the organization, defaults for new tournaments (logo, look). Empty for a new user except the create button. |
| Wizard | `/organizer/new` | same | Section 5.2. `/creator`, `/creator/new` and `/create` redirect here. |
| **Przegląd** (home) | `/{slug}/admin` | admin, referee | Section 5.1. State, the next step, decisions, activity. |
| **Mecze** | `/{slug}/admin/matches`, `.../matches/{id}` | admin, referee | Section 5.3. Every match; the match page is where results are fixed. |
| **Drużyny** | `/{slug}/admin/teams`, `.../teams/{id}` | admin; referee for stand-ins | Registration, rosters, stand-ins, transfers. |
| **Format** | `/{slug}/admin/format` | admin | Section 5.4. Stages, groups, ranking rules, advancement, schedule generation, Swiss rounds, the bracket. |
| **Treść** | `/{slug}/admin/content` | admin | News, rulebook, prizes. |
| **Wygląd** | `/{slug}/admin/look` | admin | Section 5.5. |
| **Ustawienia** | `/{slug}/admin/settings` | admin; Ludzie, Adres and deletion for the organization only | Sections: Podstawy (name, language, time zone, dates), Zapisy i składy (registration, team size, MMR cap, coach, stand-ins, transfers), Terminy (scheduling method and reschedule rules), Automat (lobby, lateness, bot messages, extra people in lobbies, test lobby), Dla widzów (fantasy, pick'em, cards, Twitch), Ludzie (admins, referees, casters), Adres (slug, domain, redirect), Historia zmian (the audit log), Strefa zagrożenia (go back a stage, delete). |
| Platform | `/platform` | platform super admin | Bot accounts and workers, live lobby sessions, the job queue, creation requests and the allowlist, organizations, card-game bug reports, the mirror report (WP-39), usage of free plans. `platform` joins the reserved slugs. |

Navigation inside a tournament's panel is one horizontal row of the seven names under the tournament's own navbar, in the same visual language as the public section navigation. It is not a sidebar of nested boxes. A referee's row has three names.

Why seven and not seventeen: the old tabs were named after the feature that was being built (Swiss, Divisions, Playoffs, Scheduling, Structure were five tabs about one thing, the format). The new names are the nouns an organizer already uses: matches, teams, format, content, look.

### 4.2 Every control in `ADMIN.md`, and where it goes

**Keep** means the control exists in the new panel, possibly renamed. **Merge** means it becomes part of another control or the two duplicates become one. **Automate** means the platform does it and no control exists. **Super admin** means it moves to `/platform`. **Drop** means it is gone.

#### Set up the tournament (ADMIN.md section 1)

| Control today | Verdict | Where, and why |
|---|---|---|
| Launch card (checklist, preview link, publish) | Merge | Przegląd in the draft state. The checklist is not needed because the wizard leaves nothing unfinished; the preview link and the publish action stay. |
| Basic info: name, short name, description | Keep | Ustawienia, Podstawy. |
| Basic info: hero title, layout, media, video, trailer | Merge | Wygląd, with the hero editor. They are look, not settings. |
| Basic info: Valve league id | Merge | Ustawienia, Automat, as an optional field (question S2-1). Today it also exists in the Bot tab. |
| Basic info: social links | Keep | Wygląd, Linki. Organization-level links are the default. |
| Basic info: Discord server gate | Keep | Ustawienia, Zapisy i składy ("tylko członkowie serwera"). |
| Status select and visibility | Automate | The status follows the journey: publish, start, final played, archive after 30 days. Visibility is derived from status. "Cofnij etap" in Strefa zagrożenia is the manual way back. A dropdown that lets anyone set "completed" mid-season is how tournaments break. |
| Dates and registration (start, end, registration window, team limit) | Keep | Set in the wizard; Ustawienia, Podstawy and Zapisy i składy. |
| Tournament type (league, mmr-limited, swiss) and MMR cap | Merge | The type is replaced by stages on the Format screen (one model for every format, ADR-04). The MMR cap is a registration rule under Zapisy i składy. |
| Lobby settings in the General tab | Merge | One lobby section under Automat, with the Bot tab's copy. |
| Team size, coach mode | Keep | Zapisy i składy. |
| Scheduling method (captains or admin) | Keep | Ustawienia, Terminy. |
| Rounds per season, default match format | Merge | Properties of a stage on the Format screen (one or two legs, best-of). Today they are stored and barely read. |
| Promotion and relegation toggle | Drop | Nothing reads it. Zones in a table come from the advancement rules. |
| Playoffs on/off and team count | Merge | A playoff is a stage; its size follows from the advancement rules. |
| "Playoff match format" and "grand final format" selects | Drop | Never saved. The real ones are on the bracket stage. |
| Fantasy and pick'em switches (missing today) | Keep | Ustawienia, Dla widzów. New. |
| Creator wizard | Keep | Redesigned, section 5.2. |

#### Branding and content (section 2)

| Control today | Verdict | Where, and why |
|---|---|---|
| Logo, inline logo, organizer logo | Keep | Wygląd, Marka. The inline logo and the favicon are made from the main logo unless replaced. |
| Primary, secondary, accent, glow colours | Keep | Wygląd, Kolory. Glow is derived from the accent. |
| Five text-hierarchy colours | Automate | Derived from the palette so that contrast always holds (section 6.3). An imported tournament keeps its stored values until its organizer changes the palette. |
| Background image, overlay, blur, position | Merge | Wygląd, Tło: image, position, and one "przyciemnienie" slider that replaces overlay colour, opacity and blur. |
| Favicon | Automate | Made from the logo. Replaceable under Marka. |
| Advanced theme, 30+ fields (card opacity, blur, radius, navbar style and colours, theme style) | Merge | Three choices under Wygląd, Styl: cards (solid or glass), corners (sharp, soft), navbar (solid, transparent, blurred). The numbers behind them are the platform's. |
| Typography: header, text, readable, rules fonts | Merge | Two choices: heading font and body font, from a curated list. Readable and rules fonts follow the body font. |
| Custom font upload | Keep | Heading font only, with the checks in section 6.3. |
| Navbar sponsor strip | Keep | Wygląd, Sponsorzy. |
| Hero panels editor | Keep | Wygląd, Hero. The legacy left, right and promo image fields are dropped; the import maps them into the hero media. |
| Hero video upload (super admin only today) | Keep | A link to a hosted video for everyone; upload to the platform's video host stays with the super admin (question S2-4). |
| News: create, edit, delete, publish, notify | Keep | Treść, Aktualności. "Powiadom" is a checkbox on publishing, not a second step. |
| Rules: sections, paragraphs, markdown | Keep | Treść, Regulamin. Each paragraph saves by itself; paragraphs generated from settings are marked and edited by changing the setting. |
| Prizes: switch, display mode, image, list | Merge | Treść, Nagrody. The switch is dropped: the page is public when it has content. |

#### Teams and players (section 3)

| Control today | Verdict | Where, and why |
|---|---|---|
| Team status select with bulk save | Merge | "Przyjmij" and "Odrzuć" on a flagged team. Complete, valid teams are accepted by the platform. "Eliminated" is derived from results. |
| Change captain (one-time code) | Keep | Team page. |
| Ban team | Keep | Team page. Lists the walkovers it causes before confirming. |
| Delete team | Merge | Before the season: delete. After it started: "Wycofaj drużynę", which keeps history. |
| Sync Steam avatars | Automate | A job (`refresh-avatars`). |
| Refresh hero data (Teams tab) | Automate | A job. Also removes the duplicate in the Stats tab. |
| Swiss: edit a team's average MMR | Merge | "MMR do rozstawienia" on the team page; the seeding list on the Format screen shows it. One place where today there are two. |
| Smurf URL resolving | Automate | Done on the server when a player links Steam. |
| Transfer window switch and limits | Keep | Zapisy i składy. The window is a pair of dates that opens and closes by itself; the switch is dropped. |
| "Recent transfers" and "transfer window schedule" cards | Drop | Placeholders. Real roster history is on the team page, from the audit log. |
| Stand-in appeals: approve, reject, undo, history, list | Keep | A decision on Przegląd; the full list under Drużyny, Zastępstwa. |
| Stand-in rules (per-round limit, opponent approval), unreachable today | Keep | Zapisy i składy. Finally reachable. |
| Casters manager | Merge | Ustawienia, Ludzie, as the role "komentator". |

#### Structure (section 4)

| Control today | Verdict | Where, and why |
|---|---|---|
| Divisions and groups: name, tier, colour, medal | Keep | Format, on a stage's groups. |
| Division theme and highlights | Merge | The colour and medal are the theme. Highlighted zones come from the advancement rules. |
| Assign teams to divisions | Keep | Format, by dragging; first filled by the automatic draw. |
| Generate round-robin matches (Divisions tab) | Merge | One "Wygeneruj terminarz" per stage, with the Scheduling tab's generator. |
| Recalculate standings | Drop | Standings are computed when read (ADR-11). |
| Groups tab (dead) | Drop | |
| Swiss: field setup and bye team | Automate | The field is the accepted teams; a bye is given when the count is odd. |
| Swiss: MMR pairing band | Keep | Format, Swiss stage, under "więcej". |
| Swiss: seed list | Merge | The seeding list of the stage. |
| Swiss: generate, save, commit, reopen a round | Keep | Format, Swiss stage. Pairing happens by itself; the organizer edits and confirms, or reopens. |
| Swiss: mark round complete; "reschedule latest" | Automate | A round is complete when its matches are. The reschedule limit is the tournament's reschedule rule. |
| Swiss: standings table in the panel | Merge | The panel shows the same standings component as the public page. |
| LAN qualifier: format switch, Group A pick, tiebreak decision, status cards | Merge | A format preset. Its decisions are ordinary tie and advancement decisions. |
| Playoffs: bracket format, sizes, round formats | Keep | Format, bracket stage. |
| Playoffs: seed teams, generate, regenerate | Automate | Seeded from the advancement rules; the organizer confirms and may move a team. |
| Playoffs: edit one bracket match | Merge | The match page, like any match. |
| Playoffs visibility switch | Drop | The bracket is public with placeholders from the start. |

#### Schedule (section 5)

| Control today | Verdict | Where, and why |
|---|---|---|
| Two-phase schedule generator | Keep | Format, "Wygeneruj terminarz", as a proposal the organizer adjusts and confirms. |
| Delete a round's matches | Merge | "Wygeneruj ponownie od kolejki N", allowed only for unplayed matches. |
| Reschedule rules | Keep | Ustawienia, Terminy. |
| Reschedule requests list (no actions today) | Keep | With actions. Shown as a decision only when captains cannot settle it. |
| "Created matches" list | Merge | Mecze. |
| Legacy matchdays list | Drop | Nothing reads it. |

#### Bot and lobbies (section 6)

| Control today | Verdict | Where, and why |
|---|---|---|
| Bot enable | Keep | Automat. On by default. |
| Lobby settings: game mode, server, DotaTV delay, spectators | Keep | Automat, Lobby. One copy. |
| Lobby settings: pauses, lobby open minutes | Keep | Automat, Lobby, under "więcej". |
| Lobby settings: cheats, fill with bots | Super admin | Test options. An organizer's test lobby (below) does not need them. |
| Ready-check commands | Drop | Platform constants. Nobody needs their own word for "ready". |
| Chat messages | Keep | Automat, "Wiadomości bota", under "więcej", with defaults in the tournament's language. |
| Custom commands | Drop | No known use (question S2-5). |
| Post-match: auto-sync, delay, close phases | Automate | Always on. |
| Enforcement: kick players who are not on the roster, show the password | Keep | Automat, Lobby. |
| Late policy (Bot tab) and late-penalty minutes (General tab) | Merge | Automat, Spóźnienia: when a game is forfeited, when the series is, and whether teams may vote to wait. The rulebook paragraph is generated from it. |
| Bot personality | Drop | Cosmetic and unexplained (question S2-5). |
| Lobby whitelist | Keep | Automat, "Dodatkowe osoby w lobby". Casters are added by themselves. |
| Manual test session | Keep | Automat, "Lobby testowe": the organizer gets a lobby with themselves in it, to see the bot work before the first match day. Limited per day. |
| Bot pool status, run orchestrator, active sessions | Super admin | `/platform`. An organizer sees a live lobby as the state of its match. |
| Bot Steam accounts | Super admin | `/platform`. |

#### Results (section 7)

| Control today | Verdict | Where, and why |
|---|---|---|
| Match table with score inputs and bulk save | Merge | "Popraw wynik" on the match page, with a reason. Scores are not typed in as routine. |
| Sync matches | Automate | Results arrive by themselves. |
| Add match (tiebreak, showmatch, rematch) | Keep | Mecze, "Dodaj mecz". A tiebreak is normally created from the tie's decision. |
| Games dialog: view and delete a game | Keep | Match page. |
| Force-import a game by Dota match id, with preview | Keep | Match page, "Dodaj grę z Dota". |
| Force schedule | Keep | Match page, "Ustaw termin". |
| Walkover, forfeit and revert | Keep | Match page. |
| Draft penalty | Keep | Match page. |
| Skipped games (add, remove, list) | Merge | "Pomiń tę grę" on an unrecognized game; a filter on Mecze lists skipped games. |
| Delete one match | Keep | Only for an unplayed added match. |
| Delete all matches | Drop | Replaced by regenerating the unplayed part of a schedule. |
| "Import from OpenDota" dialog (dead) | Drop | |
| Recalculate stats, recalculate rankings | Drop | Computed when read. A stuck job is the super admin's to retry. |
| Match-prep data card, player data card | Automate | Jobs. |
| Stats preview | Drop | It reads tables that no longer exist. |

#### Viewer features (section 8)

| Control today | Verdict | Where, and why |
|---|---|---|
| Fantasy rounds: create, set current, delete, lock | Automate | Rounds follow match days or stage rounds, and lock at the round's first match. Dla widzów keeps one override: the lock time of a round. |
| Pick'em: bye count, deadline, instructions | Merge | Dla widzów. The deadline defaults to the first playoff match, the bye count comes from the bracket, the instructions are generated. |
| Pick'em CSV export | Keep | Dla widzów. Without e-mail addresses. |
| Cards: packs per round, Twitch channels | Keep | Dla widzów. |
| Cards: how-to text | Keep | Until S3 redesigns the game so it explains itself; then dropped. |
| Cards: give packs by hand | Keep | Dla widzów. |
| Cards: bug reports | Super admin | They are about the game, not the tournament. |

#### Access and roles (section 9), and unreferenced code (section 10)

| Control today | Verdict | Where, and why |
|---|---|---|
| Tournament admins (works only for the super admin today) | Keep | Ustawienia, Ludzie: invite by link or Discord name, with a role. Works for the organizer. |
| Tournament creators allowlist | Super admin | `/platform`, with the request form's inbox. |
| Organizer page: your tournaments, your series | Keep | `/organizer`. |
| Organizer page: redirects between editions | Automate | Offered when a new edition is published. A manual field stays under Adres. |
| Creator template page | Merge | The wizard's first step. |
| `/api/checkAdmin`, dev `makeAdmin` | Drop | Replaced by `authorize` (ADR-06). |
| Orphan components (`GameDeleteModal`, `MatchImportModal`, `PlayoffMonitor`, `FakeTeamGenerator`) | Drop | The seed tool (WP-03) replaces the fake-team generator. |

#### New controls that have no counterpart today

Ranking rules and tie-breakers per stage; advancement rules; tie decisions; the automatic draw; match evenings for scheduling; the referee role; the organization's members; the domain; language, time zone and Dota server region; the look's draft, preview and history; the audit log view; "Nowa edycja"; the data export; the test lobby.
