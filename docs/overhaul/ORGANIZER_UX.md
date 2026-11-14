# Organizer experience

Written in S2 (2026-11-14) by Fable. It covers the owner's concern 2 (the admin panel is a patchwork) and the organizer-facing part of concern 6 (a public platform organizers choose). It designs what an organizer sees and does, from signing up to the end of a season. The work packages that build it are WP-41 to WP-49 in `ROADMAP.md`.

**The test this design must pass.** A new organizer who has never seen the site creates a tournament and runs it to the final without help, and wants to keep using it.

**The short version.**

1. **The panel is organized around what needs the organizer, not around features.** Today's 17 tabs become one home screen and five work areas. The home screen answers three questions: where the tournament is, what needs a decision, and what the platform did by itself.
2. **Most controls disappear.** Of the 112 controls counted in today's panel, 49 are kept, 28 are merged into another control, 14 are replaced by automation, 5 move to the platform's super admin, and 16 are dropped. So an organizer meets fewer than half of today's controls, and most of those sit behind defaults. Section 4 lists every one.
3. **The wizard produces a tournament that is ready to open registration.** The format, the ranking rules, the bot, the rulebook and the look all start from defaults that work. Nothing after the wizard is required before publishing. One thing is required before the first match: the id of the organizer's league in Dota 2, which only they can create.
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
2. **Name and dates.** Name, address (suggested from the name), when registration closes, when the season starts, and how match times are set: fixed (for example every Wednesday at 20:00, set once and never touched again) or agreed by the captains inside each round's window.
3. **Look.** A preset, a logo and one colour. The preview is the tournament's real home page.

"Utwórz" creates a draft tournament and opens its home screen. Everything else already has a value:

| Already set by the wizard | From |
|---|---|
| Stages, groups, best-of per stage, ranking rules, tie-breakers, who advances where | the format preset (ADR-11 defaults) |
| Lobby bot on, lobby settings, lateness rules | platform defaults, the same PDL uses |
| A rulebook | a template whose paragraphs about format, lateness, stand-ins and transfers are generated from the settings |
| Team size 5, stand-ins allowed | defaults |
| Fantasy and pick'em on, where the format supports them | defaults; the role-based fantasy formula (owner's decision 11) |
| Language, time zone, Dota server region | the organizer's browser, shown and editable in step 2 |

Removed: enabling the bot, creating a division, choosing a playoff size, writing rules before anything can be published.

**The one step the platform cannot take for the organizer: the Dota 2 league.** Every tournament has its own league, created by the organizer in the Dota 2 client, and its id is how results are found (the owner's answer to question 21; ADR-11 stands). The wizard's second step has a field for it that may be left empty. While it is empty, the home screen carries the decision "Podaj ID ligi Dota 2" from the first day, with the two or three steps of creating a league in the client shown as pictures of the client, not as paragraphs. When an id is entered the platform looks the league up and shows its name, so a mistyped id is seen at once. Registration can open without it; the season cannot start without it.

### 3.3 Before the season: look, domain, teams

The draft's home screen shows one primary action, **"Opublikuj i otwórz zapisy"**, and a preview link the organizer can share before publishing.

- **Look.** Optional. The look screen (section 5.5) edits colours, fonts, hero and sponsors against a live preview and publishes them in one step.
- **Domain.** Optional. Under Settings, the organizer enters a domain, gets the DNS record to add, and watches the state change to connected (section 6.4).
- **Inviting teams.** Publishing gives the organizer one registration link and a ready-made announcement text for Discord. A captain signs in, names the team, and adds players, who each confirm and link Steam. The form refuses an incomplete team, as it does today. What happens to a complete one is the organizer's choice under Zapisy i składy: "akceptuj automatycznie", where the organizer sees a team only when something is off (over the MMR cap, a player already on another roster), or "weryfikuj każdą drużynę", where every team waits for the organizer, which is how the owner filters out cheaters before a season. New tournaments start on automatic; a new edition copies the previous edition's choice.
- **Registration closes by itself** at the set time. If the number of teams does not fit the format (for example 13 teams for two groups of 8), the home screen says so and offers the choices: extend registration, change the group sizes, or continue with a bye.

Removed: approving every team by hand, unless the organizer chooses to; the status dropdown and the bulk save; resolving Steam vanity addresses; refreshing avatars and hero data; closing registration by changing a status.

### 3.4 Starting the season

When registration has closed the primary action becomes **"Rozlosuj grupy i wygeneruj terminarz"**. It needs the league id; without one, the league decision holds the primary button.

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
| The next Swiss round is paired when the last result arrives | platform; the organizer confirms before it is published, or, with "publikuj bez potwierdzenia" set once, it is published at once on the fixed match times |
| Fantasy rounds open and lock with the match days | platform |

The organizer is needed only for what the rules cannot settle. Each of these is one row in "needs a decision" and one Discord message with a link straight to it:

| Decision | Appears when |
|---|---|
| League id missing | from creation until it is entered |
| Team needs a look | registration flagged it (MMR over the cap, player on two rosters), or the tournament verifies every team |
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
| Basic info: Valve league id | Merge | One field under Ustawienia, Automat, also offered in the wizard. Required before the season starts, and checked against Dota when entered. Today it exists in two tabs, and a missing one silently imports another tournament's games. |
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
| Hero video upload (super admin only today) | Keep | A link to a hosted video for everyone; upload to the platform's video host stays with the super admin (the owner agreed, question 24). |
| News: create, edit, delete, publish, notify | Keep | Treść, Aktualności. "Powiadom" is a checkbox on publishing, not a second step. |
| Rules: sections, paragraphs, markdown | Keep | Treść, Regulamin. Each paragraph saves by itself; paragraphs generated from settings are marked and edited by changing the setting. |
| Prizes: switch, display mode, image, list | Merge | Treść, Nagrody. The switch is dropped: the page is public when it has content. |

#### Teams and players (section 3)

| Control today | Verdict | Where, and why |
|---|---|---|
| Team status select with bulk save | Merge | "Przyjmij" and "Odrzuć" on a team that waits: a flagged one, or every one when the tournament verifies teams. "Eliminated" is derived from results. |
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
| Custom commands | Drop | Never used (the owner agreed, question 25). |
| Post-match: auto-sync, delay, close phases | Automate | Always on. |
| Enforcement: kick players who are not on the roster, show the password | Keep | Automat, Lobby. |
| Late policy (Bot tab) and late-penalty minutes (General tab) | Merge | Automat, Spóźnienia: when a game is forfeited, when the series is, and whether teams may vote to wait. The rulebook paragraph is generated from it. |
| Bot personality | Drop | Never used (the owner agreed, question 25). |
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

## 5. The key screens

Each screen is given as a text wireframe. In the wireframes a horizontal rule is a hairline or a band between open areas, never the edge of a box; `[ Tekst ]` is the one filled, primary button; `Tekst ›` is a quiet action; `●` is a state mark whose colour carries meaning (section 5.7). Sample copy is in Polish as it would appear.

Each screen has two or three versions. WP-41 builds them as clickable prototypes behind the `?v=N` picker so the owner can choose; version 1 is always the one recommended here.

### 5.1 Przegląd, the home screen

**What it is for.** The organizer opens the panel with one of three questions: where are we, does anything need me, did the automation work. The screen answers them in that order and holds nothing else.

**Version 1 (recommended): three questions.**

```
PDL sezon 3                                                    Podgląd strony ›
Przegląd   Mecze   Drużyny   Format   Treść   Wygląd   Ustawienia
────────────────────────────────────────────────────────────────────────────────
 Zapisy ━━━━━━━━ Faza grupowa ━━━━●────── Playoff ─────────── Finał
                 kolejka 4 z 7              od 12 gru            21 gru
────────────────────────────────────────────────────────────────────────────────
 Do decyzji                                   Automat

 ● Remis o 4. miejsce w grupie A              20:47  Team Spirit PL 1:0 Ogry
   Wilki i Ogry mają tyle samo punktów               gra 1 zaimportowana
   po wszystkich kryteriach.                  20:03  Lobby: Wilki – Rysie, gra 1
   [ Rozstrzygnij ]             do 10 gru     19:50  Utworzono 4 lobby
                                              19:00  Przypomnienie dla 8 drużyn
 ● Odwołanie od zastępstwa                    wczoraj
   Rysie · mecz z Wilkami, czw. 20:00         22:10  Walkower: Sowy nie stawiły
   Rozpatrz ›                   do czw.              się na grę 2      Cofnij ›
                                              21:30  Kolejka 3 zakończona
 ● Mecz bez terminu
   Sowy – Orły · kolejka 4                    Wszystko ›
   Ustaw termin ›               do niedz.
────────────────────────────────────────────────────────────────────────────────
 Dziś
 20:00  Wilki – Rysie         ● w lobby, gra 1
 20:00  Team Spirit PL – Ogry ● 1:0, gra 2
 21:30  Sowy – Orły           ○ lobby o 21:20
```

- **The phase line** is the tournament's stages from the Format screen plus registration and the final. The mark shows where the season is. It is the only place the status appears. When the next step is the organizer's, the primary button sits on this line, at the mark.
- **Do decyzji** lists the decisions of section 3.5, most urgent first. Each row: what, which object, the deadline, one action. The most urgent row has the filled button; the others are quiet. A decision leaves the list when it is made, by anyone.
- **Automat** lists what the platform did, newest first, in past-tense sentences, with "Cofnij" where the action can be taken back. It is the audit log filtered to actions with no human actor.
- **Dziś** appears only on a day with matches, and is the match rows of the Mecze screen. On other days the area shows the next match day's date and nothing else.

**States.**

| State | Phase line | Do decyzji | Rest |
|---|---|---|---|
| Draft | "Szkic", with `[ Opublikuj i otwórz zapisy ]` | "Podaj ID ligi Dota 2", until it is entered | The preview link with "Kopiuj". Automat is hidden until there is something in it. |
| Registration open | "Zapisy", "11 z 16 drużyn", closing date | flagged teams, if any | The registration link with "Kopiuj" and "Kopiuj ogłoszenie". |
| Registration closed, count fits | `[ Rozlosuj grupy i wygeneruj terminarz ]` | | |
| Registration closed, count does not fit | "13 drużyn, format zakłada 16" | one decision with three actions: "Przedłuż zapisy", "Zmień grupy", "Graj z wolnym losem" | |
| Season running, quiet | mark on the current round | the area holds one line: the next match day and when its lobbies open | This is the normal state and it should look calm, not empty. |
| Match day | as above | match-day decisions (no bot, late import) rise to the top | Dziś is shown; rows update while lobbies are live (ADR-16). |
| Something failed | unchanged | the failure is a decision with its fix | The affected match row carries a red mark. Nothing else on the screen changes colour. |
| Stage over | `[ Opublikuj drabinkę ]`, or blocked by a tie | the tie, first | |
| Completed | all phases filled | empty | Final placings, the season's numbers, `[ Nowa edycja ]`, "Pobierz dane ›". |

**A referee** sees the same screen with match and stand-in decisions only, and no primary action on the phase line.

**Version 2: the match-day console.** The screen is built around a time axis of today's and the next matches, each a row that widens as it goes live. Decisions are marks on the rows they concern; decisions about nothing in particular sit above. It is the best screen for a referee on a match evening and the worst one for a new organizer three weeks before the season, when there are no matches and the screen is empty. Recommended only as how the "Dziś" band of version 1 behaves on a match day.

**Version 3: one stream.** A single chronological column mixing automatic actions and decisions, like a chat with the platform, with open decisions pinned on top. It is the simplest to read on a phone and makes automation very visible, but the phase and the next step get lost in the stream, and a busy match evening pushes a decision out of sight.

### 5.2 The wizard

**What it is for.** Turn "I want to run a tournament" into a tournament that can open registration, while showing the organizer what they are getting. The preview does the persuading; the form asks only what cannot be guessed.

**Version 1 (recommended): choices on the left, the result on the right.**

```
Nowy turniej                                   Format · Nazwa i terminy · Wygląd
────────────────────────────────────────────────────────────────────────────────
 Jak gracie?                         │
                                     │   Grupa A        Grupa B
  Liga                               │   ▪ ▪ ▪ ▪        ▪ ▪ ▪ ▪
  Grupy i playoff            ◀       │   ▪ ▪ ▪ ▪        ▪ ▪ ▪ ▪
  Swiss                              │      │ 4 najlepsze  │
  Swiss i playoff                    │      └──────┬───────┘
  Puchar                             │        ┌────┴────┐
  Kwalifikacje LAN                   │        Playoff · 8 drużyn
                                     │        podwójna eliminacja
 Ile drużyn?   [ 8 ] [ 12 ] [16] [24]│        ╞═╗
               inna liczba ›         │        ╞═╝═╗
                                     │        ╞═╗ ╠══ finał BO5
 Awans z grupy   4 najlepsze ▾       │        ╞═╝═╝
 Playoff         podwójna elim. ▾    │
                                     │   56 meczów w grupach · 14 w playoff
                                     │   około 7 tygodni przy 2 wieczorach
                              [ Dalej ]
```

- **Step 1, Format.** Six formats, each a word an organizer knows. Selecting one draws it on the right; the drawing is the explanation, so the formats carry no description text. The team count is a guess used for the drawing and the defaults; the real structure is fixed when registration closes. Two or three follow-up choices appear per format (how many advance, bracket type), each with a default. The line under the drawing answers the question organizers actually have: how many matches and how long.
- **Step 2, Nazwa i terminy.** Name; address (`dota2inhouse.pl/` plus a slug suggested from the name, checked as it is typed); registration closes; season starts; match times, as one choice between "stałe terminy" (weekday chips and a time) and "kapitanowie ustalają" (the same chips mark the round's window); the Dota 2 league id, which may be left for later. Language, time zone and Dota server region are one quiet line with the detected values and "Zmień ›". The right side becomes a calendar strip showing registration, each stage and the final on real dates.
- **Step 3, Wygląd.** Eight presets as small renderings of a real home page; a logo; one colour. The right side is the tournament's real home page with the name, dates and format already in it. "Utwórz turniej" is the primary button.
- Going back keeps everything. Leaving and returning restores the draft from the browser. Nothing is saved on the server until "Utwórz turniej".
- **An experienced organizer** starts from "Nowa edycja" on the organizer page and gets the same three steps pre-filled from the last edition; step 1 is skipped unless they open it.

**The six formats** and what each presets (all are stages and rules as data, WP-34):

| Format | Stages | Defaults |
|---|---|---|
| Liga | one round robin, in divisions | each pair once, BO2, 2/1/0 points |
| Grupy i playoff | round-robin groups, then a bracket | top half advances; cross-seeded; double elimination; final BO5 |
| Swiss | one Swiss stage | rounds from the team count; BO3; Buchholz; one extra choice: rounds wait for confirmation or are published by themselves |
| Swiss i playoff | Swiss, then a bracket | top 8 advance, seeded by place |
| Puchar | one bracket | seeded by MMR; single elimination |
| Kwalifikacje LAN | the PDL S2 format | as PDL S2 |

**States.** The address is taken: the field shows a free suggestion in place. A format does not support the team count (for example a bracket of 5): the nearest counts that work are offered as chips. Creation fails: the button returns with the reason next to it, and nothing is lost. Not on the allowlist (before launch): the request form, section 3.1.

**Version 2: one question per screen.** Large type, one decision at a time ("Jak gracie?", "Ile drużyn?", "Kiedy zaczynacie?"), about eight screens. Friendly for a first-timer and good on a phone, but slow for a second tournament, and the preview has no room next to the question, which loses the wizard's main argument.

**Version 3: one page.** All fields on one scrolling page with the preview pinned beside it. The fastest for an experienced organizer and the easiest to build, but a first-timer meets every decision at once.

### 5.3 Mecze and the match page

**What it is for.** The list answers "which matches need me". The page of one match tells that match's whole story and holds every fix.

**The list.**

```
Mecze                    Wymagają uwagi 2 · Dziś 3 · Bez terminu 1 · Wszystkie
────────────────────────────────────────────────────────────────────────────────
 Kolejka 4 · do niedz. 8 gru
 czw. 20:00   Wilki          1 : 0   Rysie          ● gra 2 w lobby
 czw. 20:00   Team Spirit PL 2 : 0   Ogry           ✓
 czw. 21:30   Sowy           – : –   Orły           ● brak wolnego bota
 —            Bobry          – : –   Żubry          ● bez terminu
────────────────────────────────────────────────────────────────────────────────
 Kolejka 3 · zakończona
 ...
                                                               Dodaj mecz ›
```

Rows are the public schedule's match rows with one extra element, the state. Matches are grouped by round or match day, the current one first. The filters at the top are counts that also filter; "Wymagają uwagi" is the default when it is not zero. A filter "Pominięte gry" lists games the organizer told the platform to ignore.

**The match page, version 1 (recommended): the story on the left, the fixes on the right.**

```
‹ Mecze        Kolejka 4 · Grupa A · BO3                 ‹ poprzedni  następny ›
────────────────────────────────────────────────────────────────────────────────
          Wilki    1 : 0    Rysie                              ● gra 2 w lobby
────────────────────────────────────────────────────────────────────────────────
 czw. 5 gru                                    Ustaw termin ›
 19:00  Przypomnienie wysłane                  Popraw wynik ›
 19:50  Lobby utworzone · bot Inhouse#3        Dodaj grę z Dota ›
 19:58  Rysie: zastępstwo Kowal za Nowaka      Walkower ›
        zatwierdzone przez kapitana Wilków     Kara w drafcie ›
 20:03  Gra 1 rozpoczęta                       Mecz powtórzony ›
 20:47  Gra 1: wygrywają Wilki · 38 min
        zaimportowana · statystyki ›  Usuń ›   Komentatorzy
 20:52  Gra 2: lobby otwarte, 9 z 10 graczy    Majkel · w lobby
        czeka na: Zieliński (Rysie)
────────────────────────────────────────────────────────────────────────────────
 Składy
 Wilki   Adamski · Baran · Cichy · Dudek · Ekiert
 Rysie   Fijał · Górski · Hajduk · Kowal (zastępstwo) · Zieliński
```

- **The left column is the match's timeline**: every automatic and human action on this match, in order, in plain sentences. It is the audit log for this match plus the lobby's state. This is where the organizer learns to trust the automation, and where a referee sees at once what happened before they were called.
- **The right column is every fix**, as a quiet list. Only actions that make sense in the current state are listed: a completed match has no "Ustaw termin"; an unplayed one has no "Popraw wynik".
- **When the match has a problem**, the problem takes the place of the state mark's text under the score, with its fix as the page's one filled button. For example: "Gra rozegrana poza lobby nie została rozpoznana" with `[ Dodaj grę z Dota ]`.
- **Every fix opens in place** (the right column becomes the form), asks for the minimum, and shows the consequence before confirming: "Tabela grupy A: Rysie z 3. na 4. miejsce". Fixes that the audit log needs a reason for (result correction, walkover, removing a game) have a one-line reason field.
- **Dodaj grę z Dota** takes a Dota match id, shows the game it found (teams, players matched to rosters, winner, duration), and adds it on confirmation.
- "‹ poprzedni, następny ›" walk through the current filter, so a referee can clear "Wymagają uwagi" without returning to the list.

**States of a match**, and the mark each has:

| State | Mark | Shown as |
|---|---|---|
| No time yet | amber | "bez terminu", with the round's deadline |
| Scheduled | none | date and time |
| Lobby opens soon | hollow | "lobby o 21:20" |
| In lobby, in game | green, live | "gra 2 w lobby", "gra 2 trwa, 24 min" |
| Waiting for a bot | red | "brak wolnego bota" |
| Game being imported | hollow | "wynik za chwilę" |
| Import failed, game not recognized | red | the reason |
| Completed | check | the score |
| Walkover | check | the score and "walkower" |
| Disputed (stand-in appeal, reschedule conflict) | amber | the dispute |

**Version 2: a side panel.** The match opens as a panel over the list, which stays visible. Faster on a match evening because the list never leaves, but the timeline and the fixes compete for a narrow column, and it does not work on a phone, where it becomes version 1 anyway.

**Version 3: rows that open.** Each row expands in place to show its games and a row of actions. The least navigation, and the closest to today's panel. It has no room for the timeline, so the automation stays invisible, and a long list jumps as rows open.

### 5.4 Format

**What it is for.** Everything about how the competition works, in one place: stages, groups, how tables are ordered, who advances where, and the schedule. It replaces five tabs (Structure, Divisions, Swiss, Scheduling, Playoffs). After the wizard it is already filled in; the organizer comes here to adjust, to run the draw, and at each change of stage.

**Version 1 (recommended): the season as a line of stages; the selected stage below.**

```
Format
────────────────────────────────────────────────────────────────────────────────
   Faza grupowa              ───▶    Playoff                    + Dodaj etap
   2 grupy · każdy z każdym          podwójna eliminacja
   ● trwa, kolejka 4 z 7             12 drużyn · od 12 gru
   ══════════════
────────────────────────────────────────────────────────────────────────────────
 Grupy                       Kolejność w tabeli           Awans

 Grupa A        Grupa B      Punkty  2 · 1 · 0 ▾          1.–2.  górna drabinka, 2. runda
 1 Wilki        1 Bobry                                   3.–4.  górna drabinka, 1. runda
 2 Spirit PL    2 Żubry      Przy równej liczbie punktów  5.–6.  dolna drabinka
 3 Rysie        3 Sowy       ⠿ Bezpośrednie mecze         7.–8.  koniec turnieju
 4 Ogry    ●    4 Orły       ⠿ Różnica gier
 5 ...          5 ...        ⠿ Mecz dodatkowy             Zmień ›
                             + Dodaj kryterium
 Mecze  BO2 · jedna runda ▾
 Wieczory  wt. czw. 20:00 ▾
────────────────────────────────────────────────────────────────────────────────
 Terminarz   28 meczów · 7 kolejek · 14 rozegranych   Wygeneruj ponownie od kolejki 5 ›
```

- **The line of stages** is the same line as on Przegląd. Selecting a stage shows its three parts side by side: who plays (groups), how the table is ordered (ranking), and where each place leads (advancement).
- **Grupy** is the public standings component. Before the season, teams can be dragged between groups and the draw can be run again. During the season it is the live table, and a tie that needs a decision is marked on its rows.
- **Kolejność w tabeli** is the stage's ranking rules (ADR-11): a points scheme and an ordered list of tie-breakers. Rows are dragged to reorder; "Dodaj kryterium" opens the catalogue, where each rule has one sentence saying what it compares. Changing anything re-sorts the table on the left at once and marks the rows that moved, so the organizer sees the effect on their own teams. Before the season the table holds the registered teams with sample results.
- **Awans** is the stage's advancement rules as sentences. Hovering a line highlights those places in the table and their slots in the next stage. "Zmień" offers the presets of WP-34 (top N per group; top N plus the best K of the next place; cross-seeding; upper and lower bracket by place) and "Własne", where the next stage's bracket is shown and each entry slot is clicked to choose its source ("1. miejsce grupy A", "najlepsze 3. miejsce").
- **Terminarz** generates the stage's matches on the chosen evenings as a proposal shown in the Mecze list's form, to adjust and confirm. Regenerating touches only unplayed matches and says how many.

**A bracket stage** shows the bracket itself where the groups are, with its entry slots labelled by source until they are filled, and round formats (BO3, final BO5) set on the round headings. **A Swiss stage** shows the standings, the current round's pairings with `[ Opublikuj rundę 3 ]` when a round waits, the number of rounds, and under "więcej" the MMR pairing band.

**Ties.** An open tie is a mark on the tied rows and a decision on Przegląd. Its action opens the two ways out next to the table: "Zagrajcie mecz dodatkowy" (creates the match or, for three or more teams, a small round robin) and "Ustal kolejność" (drag the tied teams, give a reason). Both show which places and bracket slots depend on the outcome.

**The tie-breaker catalogue**, with the names an organizer sees (the keys are WP-13a's):

| Name | Key | Offered for |
|---|---|---|
| Bezpośrednie mecze | `head_to_head` | round robin |
| Różnica gier | `game_difference` | all |
| Wygrane gry | `games_won` | all |
| Wygrane mecze | `match_wins` | all |
| Neustadtl | `neustadtl` | round robin |
| Buchholz | `buchholz` | Swiss |
| Niższe MMR drużyny | `lower_mmr` | all |
| Mecz dodatkowy | `tiebreak_match` | all; always after the computed rules |
| Decyzja organizatora | `manual` | all; always last |

`head_to_head_wins` exists only so that imported seasons keep their published tables. It is shown on those tournaments as "Bezpośrednie mecze (dawne)" and is not offered for new ones.

**What can change, and when.**

| Change | Before the season | After the stage has results |
|---|---|---|
| Add, remove or reorder stages; group count | free | only for stages that have not started |
| Move a team between groups | free | not possible; withdraw the team instead |
| Best-of, match evenings | free | applies to unplayed matches |
| Points and tie-breakers | free | allowed; the screen shows the table before and after, and the change is recorded with a reason |
| Advancement | free | until the next stage is published |

**States.** Draft: everything editable, the table shows sample teams. Registration closed: `[ Rozlosuj grupy i wygeneruj terminarz ]` sits here as on Przegląd. Running: as drawn above. A problem: the team count stopped fitting (a team withdrew), shown on the stage with the choices.

**Version 2: one long page.** Stages one under another, each with its groups, rules and schedule open. Nothing is hidden and it prints well, but the relation between stages (who advances where) is the hardest thing to understand and here it is spread over a scroll.

**Version 3: edit on the public pages.** No Format screen: the organizer opens the public standings or bracket and sees edit handles on it (the table's ordering rules behind its header, the bracket's slots clickable). It follows "the organizer edits the thing they see" furthest, but it has no natural place for things with no public page yet, such as the draw and schedule generation, and it mixes editing into pages that must stay cacheable.

### 5.5 Wygląd

**What it is for.** Make the tournament look like the organizer's own, with no way to make it look bad. Section 6 says what can be changed and why; this is the screen.

**Version 1 (recommended): controls beside the real site.**

```
Wygląd       wersja robocza · 3 zmiany          Odrzuć ›   [ Opublikuj wygląd ]
────────────────────────────────────────────────────────────────────────────────
 Motyw        Nocny ▾            │   Strona główna · Drużyny · Mecz · Tabela
                                 │   telefon · komputer
 Marka                           │  ┌────────────────────────────────────────┐
  logo        ⬚ pdl.svg          │  │                                        │
                                 │  │                                        │
 Kolory                          │  │        the real page, rendered         │
  główny      ■ #E11D48          │  │        with the draft look             │
  dodatkowy   ■ #0F172A          │  │                                        │
  akcent      ■ #F59E0B          │  │                                        │
                                 │  │                                        │
 Tło          obraz · 60% ▾      │  │                                        │
 Czcionki     Rajdhani · Inter ▾ │  └────────────────────────────────────────┘
 Styl         szkło · miękkie ▾  │
 Hero         wideo ▾            │
 Sponsorzy    3 ▾                │
 Linki        4 ▾                │
                                 │
 Historia ›                      │
```

- The preview is the tournament's real pages (not a mock-up) rendered with the draft look, with a switch between four pages and two widths. It is the one framed object on the screen, because it is a real object: a window onto the site.
- Each control group is one line that opens in place. A change shows in the preview at once and is saved as a draft that viewers do not see.
- "Opublikuj wygląd" makes the draft live for everyone. "Historia" lists published looks with their dates and restores any of them.
- **A colour that would make text unreadable** is not refused with an error. The control shows the nearest colour that works next to the chosen one ("zbyt jasny dla białego tekstu, najbliższy: ■"), and the preview marks the element that would fail. A draft with a failing pair cannot be published; the button says which pair.
- **An image** is cropped and scaled on upload, with the crop shown on the preview. One that is too small is said to be too small, with the size needed.

**States.** No changes: no draft line, no publish button. Draft: as drawn. Imported tournament with stored values the new controls cannot express (for example its own text colours): the look is kept exactly, and the control group says "własne wartości" with "Wróć do automatycznych ›".

**Version 2: edit on the site.** The whole screen is the real site; clicking an element (the logo, the hero, a heading, the background) opens a small palette for it. The most direct, and impressive in a demo. It costs much more to build, things without a visible element (favicon, link preview image) need a second place, and it is hard to make discoverable without the explanatory text the product rules forbid.

**Version 3: presets only.** A gallery of twelve presets and four fields (logo, one colour, background image, hero). Almost impossible to get wrong and quick to build, but it does not deliver "design each organizer can make their own", the second selling point.

### 5.6 The smaller screens

These follow the same patterns and need no versions.

- **Drużyny.** The public teams list with a state per team (complete, waiting for players, flagged, withdrawn) and filters as counts. A team's page: roster with each player's Steam and MMR state, "MMR do rozstawienia", stand-ins and transfers as a history, and the actions (change captain, edit roster, ban, withdraw). A second view, Zastępstwa, lists stand-in requests and appeals.
- **Treść.** Three views. Aktualności: posts, with "Powiadom drużyny" as a checkbox on publishing. Regulamin: sections and paragraphs edited in place; a paragraph generated from a setting shows its text greyed with "z ustawień ›" leading to the setting. Nagrody: a list or one image.
- **Ustawienia.** One page per section named in 4.1, each a short list of fields that save one by one. Settings almost nobody changes sit under "więcej" in their section. Ludzie lists people with their role and an invitation link per role. Adres holds the slug, the domain with its DNS state, and the redirect. Historia zmian is the audit log with filters by person and object. Strefa zagrożenia holds "Cofnij etap" and "Usuń turniej", each listing what it undoes.
- **`/organizer`.** A list of the organization's tournaments as rows (logo, name, phase, the count of open decisions), running ones first, `[ Utwórz turniej ]`, and "Nowa edycja" on a finished one. A second view for the organization: name, logo, default look, links, members.
- **`/platform`.** Bot accounts and workers with heartbeat and what each is doing; live lobby sessions; the job queue with retry; creation requests; organizations and their tournaments; card-game bug reports; the mirror report; usage against free-plan limits. It is a working tool for one person; it gets plain tables and no design effort beyond the shared components.

### 5.7 Patterns every screen shares

- **Saving.** A field saves when it is left, through its command, and shows a small check for a moment. There is no page-wide "Zapisz". The three exceptions are proposals the organizer confirms as a whole: the draw and schedule, a Swiss round, and the look.
- **Decisions** have one anatomy everywhere: a state mark, one line saying what, one line naming the object, a deadline, one action.
- **Automatic actions** have one anatomy: time, a past-tense sentence, the object as a link, "Cofnij" where possible.
- **Destructive actions** never ask "Czy na pewno?". They list what will change ("usunie 14 nierozegranych meczów", "3 walkowery dla rywali") and the button repeats the verb ("Wycofaj drużynę").
- **Colour.** Amber: a decision is waiting. Red: something failed or will fail without action. Green: live now. Everything else uses the tournament's theme. No other colour coding.
- **Errors** say what happened and what to do, in the organizer's words, where the action was taken: "Ten adres jest już zajęty", not "Błąd 409". An unexpected failure says so, keeps what was typed, and is reported to error monitoring (ADR-13) with nothing for the organizer to copy.
- **Empty areas** show what will be there or the next event, in one line. They never show an illustration or a paragraph of help.
- **Phone.** Przegląd, Mecze, the match page and Drużyny must work fully at 390 px, because referees and organizers act on match evenings from a phone. Format and Wygląd are built for a wide screen and must still fit and be usable at 390 px (stacked, preview on a second tab).
- **Language.** The panel's copy goes through the one translation system (WP-29) from the start; Polish first.
- **Roles** come from `authorize` (ADR-06). A person never sees a control they may not use; nothing is shown disabled for lack of permission.

## 6. Customization

The second selling point is design that each organizer can make their own. The risk is the opposite of the promise: thirty free-form theme fields let an organizer make a site that is unreadable, and then every tournament on the platform looks like a home-made page. The design gives a wide range of looks through a small number of choices that cannot go wrong.

### 6.1 What an organizer can change

| Level | Where | What |
|---|---|---|
| 1. In the wizard | step 3 | A preset; the logo; one colour. Enough for a tournament that looks finished. |
| 2. On the look screen | Wygląd | Everything in the table below. |
| 3. The address | Ustawienia, Adres | The slug. The organizer's own domain, in the highest paid plan only (the owner's answer to question 27; plans are S4's). |

| Group | Choices | Derived by the platform |
|---|---|---|
| Motyw | One of the presets (about eight at the start): a complete, tested set of every value below. Choosing one resets the groups the organizer has not touched. | |
| Marka | Main logo. Optional: a wide logo for the navbar, the organizer's logo, a favicon. | Navbar logo and favicon from the main logo; the link-preview image from the logo, name and colours. |
| Kolory | Primary, secondary, accent; dark or light mode. | Every text colour, the glow, borders, card surfaces, hover states, colours of state marks on this background. |
| Tło | A colour, a gradient from the palette, or an image with its position and one "przyciemnienie" slider. | The slider's minimum, from the image's brightness, so text stays readable. |
| Czcionki | Heading font and body font from a curated list; or an uploaded heading font. | Sizes, weights, line heights, the fonts of the rulebook and long text. |
| Styl | Cards: solid or glass. Corners: sharp or soft. Navbar: solid, transparent or blurred. | The numbers behind each. |
| Hero | Layout (logo and promo image, three images, video); the title; the images or a video link. | Crops for each width; a still frame for slow connections. |
| Sponsorzy | Slides in the navbar strip (image or text), link, pace. | Scaling to the strip's height. |
| Linki | Twitch, Discord, YouTube, Instagram, TikTok. | Defaults from the organization. |
| Grupy | Per group or division: a colour and a medal image (on the Format screen, with the group). | The group's accents on tables and team pages. |

An organization can store its own look (Marka, Kolory, Czcionki, Linki) as the default for its new tournaments.

### 6.2 What nobody can change

- The layout of any page, the order of its parts, spacing, the type scale and component shapes. These are what make the site feel like one crafted product, and what the public pages' tests protect.
- Text colours directly. They follow from the palette.
- The public navigation's items. They follow from which features are on (Dla widzów): a tournament without fantasy has no fantasy section.
- Dota terms and the wording of the interface.
- The platform's mark in the footer. Whether a paid plan may remove it is a business decision for S4.
- Free-form CSS or HTML, ever. One organizer's script on a shared domain is every organizer's security problem.

### 6.3 The limits that keep every tournament looking good

They are enforced in the theme's schema (WP-27), so no path, including an import or a future API, can store a look that breaks them.

- **Contrast.** Body text against its surface must reach WCAG AA (4.5 to 1); large headings 3 to 1. Text colours are derived to meet this. When a chosen primary or accent cannot carry readable text, the text on it flips between light and dark; when even that fails, the look cannot be published, and the control proposes the nearest colour that works.
- **Background images.** The overlay has a minimum that depends on the image, so no photo can sit raw under text.
- **Fonts.** The curated list holds only fonts with Polish letters and with the weights the design uses. An uploaded font is checked for the same; missing letters fall back per letter to the body font, and the control says which letters are missing. Fonts never block text from showing (ADR-08).
- **Images.** Minimum pixel sizes per slot; a maximum file size; uploads are converted and resized by the platform, so an organizer cannot slow their own site with a 12 MB logo.
- **Lengths.** Tournament name up to 60 characters, short name up to 12, team name up to 24, team tag up to 5. Every component is tested with the longest values (TEST_STRATEGY level 8, the "extreme" theme), so content fits its container at every size.
- **Presets are tests.** Each preset is a fixture of the visual test suite. A change to a component that breaks a preset fails in CI.

### 6.4 Preview, publishing and the domain

- **Draft and preview.** Changes on the look screen are stored as a draft beside the published look. The preview renders the tournament's real pages with the draft for the organizer only; those responses are never cached for viewers. "Opublikuj wygląd" replaces the published look in one command, which invalidates the tournament's pages. "Historia" restores an earlier published look.
- **The draft tournament** as a whole has the preview link it has today: anyone with the link sees the unpublished tournament.
- **The domain** is a feature of the highest paid plan; on other plans Adres shows the slug only, and how the plan is offered there is S4's. Under Adres the organizer types a domain. The screen shows the one DNS record to create, in the words their registrar's form uses (type, name, value), each with "Kopiuj". The state under it moves by itself: "czeka na rekord DNS", "sprawdzanie", "połączono". Once connected, the tournament's links, link previews and sign-in work on that domain (ADR-08), and the platform address keeps working and points to it. A failed check after a day becomes a decision on Przegląd with what the check saw in place of the expected value.
- A domain can belong to the organization instead, with each tournament at a path under it. This is the same control on the organizer page.

## 7. Other places with the same problems

Lower priority. These were not read in this session; the findings come from the inventories, and each needs a short design pass of its own before it is built (WP-49).

| Place | The problem | Direction |
|---|---|---|
| The captain's team page (`MyTeamView.tsx`, 1,859 lines, 17 direct writes) | Grew the same way the admin panel did: roster, stand-ins, reschedules, scrims, transfers and match panels in one view. It is the screen most users with a job to do see. | The same idea as Przegląd, for a captain: the next match with its state and lobby, what needs the captain (a reschedule to answer, a stand-in to approve, a player without Steam), and the roster. WP-17 moves it to commands and keeps the look; the redesign comes after. |
| Registration (`register/page.tsx`, 1,127 lines) | One long form. A team cannot be registered until everything about every player is known. | Captain creates the team with a name; players join through an invitation link and each links their own Steam. The team becomes complete by itself. This is also what makes automatic acceptance (section 3.3) possible. |
| Account page (489 kB, the heaviest route) | Holds the account, the team, caster tools and more behind one address. | Split by what the person is: player, captain, caster. Each lands on their own next thing. |
| Caster desk | Built quickly; several prototype versions exist and it is not clear which shipped. | One screen: matches open to cast, mine, and the lobby seat state. Design with the match page's timeline as the shared component. |
| Fantasy and pick'em pages | Fantasy shows a placeholder for its ranking; pick'em collects picks and scores nothing (ARCHITECTURE B8). WP-16 makes them work with the existing components. | A design pass once they produce real numbers: the round's deadline, my lineup and its points, the ranking. |
| The platform's front page | `/` redirects to one tournament. There is no page that says what the platform is or lists tournaments. | Needed before any organizer can sign up from outside. Its content is S4's (promotional material); its design should use the wizard's preview as the main argument. |
| Rules page and the rules assistant | Not inspected. | Check after generated paragraphs exist (WP-18e). |

## 8. What this design needs from the architecture

Nothing here changes a decision record. It adds data and a few rules, listed so the work packages can cite them.

**ADR-11 stands as written.** A tournament without a league id cannot sync and says so. The first version of this document assumed the id could become optional; the owner answered that every tournament keeps its own Dota 2 league (question 21), so the design asks for it instead (section 3.2).

**Additions to the schema** (each an additive migration in the work package that needs it):

| Addition | For |
|---|---|
| `tournaments.theme_draft` (jsonb, null) | the look's draft (6.4). History comes from the audit rows of the publish command, which hold the previous look. |
| `settings.scheduling.matchEvenings` (`[{ weekday, time }]`) | schedule proposals |
| `settings.registration.minTeams` | "count does not fit". Acceptance uses the existing `requireApproval` (false for new tournaments). |
| `teams.flags` (jsonb: reasons registration marked the team) | "team needs a look" |
| `stages.settings.autoPublishRounds` (Swiss, default false) | rounds that publish themselves. Fixed match times use the existing `settings.scheduling.method: 'fixed'` with `matchEvenings`. |
| `rule_paragraphs.generated_from` (text, null: the settings key) | generated rulebook paragraphs |
| `creation_requests` (user, text, contact, state, decided by) | the request form before launch |
| `member_invites` (scope, role, token, expires, used by) | invitation links for staff; caster requests are a row with the user set and no token |
| `decision_notices` (tournament, decision key, notified at) | one Discord message per decision, not one per page load |

**Decisions are computed, not stored.** `getDecisions(tournamentId)` is a cached query that reads the state the decisions come from: flagged teams, stand-in appeals, matches without a time near their deadline, reschedule requests outside the rules, lobby sessions waiting for an account, roster players without Steam before a match, failed or unrecognized imports (from `jobs`), open ties (from the standings' `openTie`), a Swiss round or a bracket waiting for confirmation (from the stage's state), caster requests, a failed domain check. A decision cannot go stale or be forgotten, because it exists exactly as long as its cause. Each has a stable key (`kind:targetId`), used for links and for `decision_notices`. A job compares the current keys with the notices and messages the tournament's admins on Discord about new ones.

**The activity list is the audit log.** Rows with no human actor, rendered through one table from action to sentence. "Cofnij" is offered for actions that have an inverse command (walkover and revert, import and remove game, publish round and reopen round); the table of inverses is code, next to the role table.

**Automatic lifecycle steps are jobs** with a `run_at` (ADR-09): close registration at its time; complete the tournament when the last match of the last stage is recorded; archive thirty days later. Each writes an audit row, so each appears in the activity list and can be taken back with "Cofnij etap".

**Format presets are data.** `preset(name, teamCount, options)` returns stages with their settings, ranking and advancement, plus the numbers the wizard draws (matches per stage, an estimate of weeks). The wizard, "Nowa edycja" and the seed tool use the same function.

**Proposals are pure functions.** `proposeDraw(teams, stage)` and `proposeSchedule(stage, evenings, from)` return a proposal the organizer edits; a command stores the confirmed version. Nothing is written before confirmation.

**The role table gets the referee's actions** as this document uses them: everything on the match page, stand-in decisions, and reading Przegląd, Mecze and Drużyny. Staff management, the domain, "Cofnij etap" and deletion are the organization's.

**Preview rendering.** A request for a tournament page with the draft look is authorized as an admin's request and is never cached, like a draft tournament's pages (ARCHITECTURE section 2.1).

## 9. Versions to choose, and the recommendation for each

WP-41 builds these as clickable prototypes with mock data. Until the owner has chosen, the real screens are built from version 1.

| Screen | Version 1 (recommended) | Version 2 | Version 3 | Why version 1 |
|---|---|---|---|---|
| Przegląd | Three questions: phase line, decisions, activity | Match-day console | One stream | It is useful on every day of a season, including the weeks with no matches, and keeps the next step in one fixed place. Version 2's time axis is kept as the "Dziś" band. |
| Wizard | Choices beside a live preview, three steps | One question per screen | One page | The preview is the sales argument and the explanation; it must be next to the choice that changes it. |
| Match page | Timeline and fixes, as a page | Side panel over the list | Rows that open | Only this one shows what the automation did, which is what makes an organizer trust it; and it is the only one that works on a phone. |
| Format | Line of stages, selected stage below | One long page | Edit on the public pages | It shows the relation between stages, which is the hard part of any format, and has a place for the draw and the schedule. |
| Wygląd | Controls beside the real site | Edit on the site | Presets only | The range of the second selling point at a fraction of version 2's cost. Version 3 is the fallback if time is short: it is version 1 with most groups hidden. |

## 10. The owner's answers

The owner answered questions 21 to 28 on 2026-11-14 (`STATUS.md`). The text above already includes them.

| Question | Answer | What it changed here |
|---|---|---|
| 21. The Valve league id | Each tournament keeps its own league, created by the organizer in Dota 2; every system works this way. | The id is asked for, checked, and required before the season starts (3.2). No platform league; WP-47 dropped. |
| 22. Accept complete teams automatically | The form already refuses incomplete teams; verification exists to filter out cheaters; organizers must be able to choose. | A choice between automatic acceptance and verifying every team (3.3). |
| 23. Lateness forfeits | Keep it as it was built. | No change: the bot applies the tournament's lateness settings, and the organizer can take a forfeit back. As today, the rule is off until the organizer turns it on. |
| 24. Hero video by link | Yes. | |
| 25. Drop three bot controls | Yes; never used. | |
| 26. Swiss rounds | Confirmation by default, and an organizer must be able to set it once and never touch it: fixed match times and rounds published without review. | Fixed match times as a first-class choice in the wizard; "publikuj bez potwierdzenia" (3.2, 3.5, 5.2). |
| 27. Free subdomains and domains | Domains only in the highest paid plan; decide the rest later. | The organizer's own domain is gated by plan (6.1, 6.4). |
| 28. The six formats | Enough for now; many more later. | None. Formats are data (section 8), so adding one is a preset, not a screen. |
