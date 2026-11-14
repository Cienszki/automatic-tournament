# Card game design

Written in S3 (2026-11-14) by Fable. It covers the owner's concern 3: the card game lacks depth, new players are confused, and they see no reason to play. It diagnoses today's game, compares three directions, and specifies the recommended one. The work packages are in `ROADMAP.md` under "S3. The card game".

**Status of this file: sections 1 and 2 are written. Sections 3 to 9 wait for the simulation results of WP-50 and WP-51 (see `STATUS.md`, "Next step").**

Sources: the rules engine (`src/lib/card-lab/`), the game's screens (`src/components/card-lab/`), `inventory/CARDS.md`, the owner's decision log (`card-game-design.md` in the memory folder), and simulations run for this session (`docs/overhaul/sim/`). Nobody could watch a real player for this document, and there are no usage numbers; section 9 says how to get both.

## 1. What the game is for, and for whom

The card game is one of the things for viewers that should make an organizer choose this platform. Its one asset that no other card game has is that **every card is a real player's real series in this tournament**. A game that does not use that is a weaker copy of games people already have on their phones. So the test of every choice below is whether it ties the game closer to the tournament being played.

### Goals

Each goal has a number, so a later session can check it.

| # | Goal | Measure |
|---|---|---|
| G1 | Playing within a minute | A first-time visitor makes their first move within 60 seconds of opening the page: no sign-in, no pack opening, no deck building, no page of rules before it |
| G2 | Short matches | A match takes 4 to 6 minutes. In a match between people, nobody waits more than about 40 seconds without something to do |
| G3 | Few rules | The round fits in one sentence and each position's ability in one. A player who has finished three matches has met every rule |
| G4 | Skill over collection | With equal play, a new player's deck loses to a season-long collector's deck at most 60% of the time. With equal decks, the clearly better player wins at least 70% |
| G5 | A real choice every round | In most rounds the best play depends on what the rival does, and the rival's play is hidden until both have chosen |
| G6 | The tournament drives the game | Every real round changes what there is to do in the game, and a real result can be felt in it the same evening |
| G7 | Worth opening alone | There is something worth doing when no other player is online. The league has a few hundred people; two of them are rarely free at the same moment |
| G8 | No work for the organizer | Everything is produced from match data. It works for a tournament of 8 teams and for one of 100 |
| G9 | Playable on a phone | Viewers watch streams with a phone in hand. Today the game refuses to start below 900 px (`CardLab.tsx:237-248`) |

### Players

| Player | Who they are | What they want | What they need from the design |
|---|---|---|---|
| **Viewer** | Follows the league, knows the nicknames, watches the stream. The largest group | To open packs, to see familiar names, a quick match during a break | G1, G2, G9. Must never need to study |
| **Tournament player** | Plays in the league. A few hundred people, and the core of the community | Their own card, its rating, bragging against teammates and rivals | Their own cards arrive without luck; challenges between people who know each other |
| **Collector** | Wants complete teams and the rare cards | Sets to finish, a use for duplicates | Collection goals that matter in play |
| **Competitor** | Wants to be first in a ranking | A game where thinking wins, and a ranking that is alive | G4, G5; a ranking they can climb without waiting for an opponent |
| **Organizer and caster** | Runs or shows the tournament | Something to give away, something to show on stream | Packs as prizes (exists); a match that reads well on a stream |

The design serves the viewer first and the competitor second. When they conflict, the viewer wins the first minute and the competitor wins the tenth match: rules stay few, and depth has to come from how the few rules combine.

## 2. Diagnosis

There are three complaints. Each has its own cause, and the causes are structural: none of them goes away with better explanations or better visuals.

### 2.1 Why the game feels shallow

A game has depth when a player regularly faces a choice in which the options trade one good thing for another, and the right option depends on something they cannot be sure of. Today's game has few such choices, for four reasons.

**Which cards to play is never a question.** A card has one number, its strength, from 1 to 9. It is what the card hits for and what kills it. Cards cost nothing to play (the owner's rule: better cards must simply be better). So a 7 is better than a 5 in every situation, and a 9 kills any card in one hit while surviving eight damage. The only trade-off in a turn is how to split three orders between putting cards out and moving them.

**Deck building is sorting.** With no cost and one number, the best deck is the twenty strongest cards the rules allow. The only other thing to consider is the +1 for teammates who share an objective. The deck screen asks for twenty clicks to enter an answer that a sort would give.

**There is nothing to read.** A card goes from the hand to the base, face up, and can move only on the next turn. Turns alternate. So before any unit acts, the rival has seen it for a full turn, and the player whose turn it is sees the whole board and knows that nothing can change until they finish. Fights have no chance in them. The attacker therefore attacks only where the arithmetic already says they win. The game is a calculation, which is why the computer plays it well and why it is tiring for a person.

**The fight screen is long and decides little.** Fights are played hit by hit, the sides alternating, until one side is gone. Each hit is a click, and in a match between people each hit has its own 15-second clock. The earlier session measured that the choice of targets changes the result of about one fight in five (decision log, 2026-11-05).

On top of this, **the collection decides the match.** The earlier sessions measured that with equal play, a deck rated 10 higher wins about 86% of matches, and the strongest computer level needs a deck 8 points better to be a challenge. A new player with the ten welcome packs cannot beat a player who has collected for a season, whatever they do. For a game that hopes people will challenge each other, that is the most damaging number.

**The measurements.** WP-50 built a simulation harness (`scripts/tools/card-sim/`) that plays today's game, computer against computer, with the real cards of Wiosenna (851 cards) and PDL S2 (117 cards). The full tables are in `docs/overhaul/sim/baseline/REPORT.md` on branch `wp/50-card-sim`. Each number below is from 1,000 or more games on Wiosenna, between two computer players of the same level ("Trudny") unless stated.

| Claim | Measurement |
|---|---|
| The collection decides the match | A deck built from the 10 welcome packs loses to a deck built from 40 packs **90%** of the time (81.5% on PDL S2). The stronger computer level ("Mistrz") with the 10-pack deck still loses 58% against the weaker level with the 40-pack deck |
| Which card to play is never a question | Of 25,095 cards played, **100%** were the strongest card in the hand at that moment |
| Deck building is sorting | Against the strongest twenty from the same collection: that deck with its three best cards swapped for the next best wins 16%; a deck built around real teams wins 10%; a random legal deck wins 4% |
| There is nothing to read | In 6,330 fights, **no** defender was ever a unit the attacker had not already seen on the board for a full turn. The attacker won **93.5%** of fights |
| The fight screen decides little | A match has 6.5 fights and 19 hits. A player's 27 actions in a match are 11 card plays, 6.5 moves and 9.5 hits, so a third of all clicks are hits. Choosing targets with a full search, against simply hitting the obvious target, changes who holds the objective in **5%** of fights, and changes anything at all in 16% |
| The player who gets ahead stays ahead | The side ahead after three turns each wins 85.5%. With a lead of three points or more at that moment it wins 94% |
| Going first is a disadvantage | The first player wins 43%. The six-card hand given to the second player overcorrects |

One finding is about packs, not rules. Packs hold only each team's last series, so on Wiosenna a pack can reach 95 of the 851 cards, and only 2 of the 45 team-of-the-round cards. A card from an earlier round can never be collected by someone who joins later. Section 8 keeps the pack rule and adds ways to reach the other cards.

### 2.2 Why new players are confused

**The path to the first match is long, and the game sends the player away twice before it.** Nothing can be played without signing in (`CardLab.tsx:228`). After signing in: a welcome page, a name step for accounts without Discord, an intro overlay of two pages with eight blocks of text, ten packs at three to seven clicks each, and then a deck of twenty slots filled one by one. The deck is never built for the player; the button only says "Uzupełnij talię" and pulses the deck (`Home.tsx:434`). A quick-deck function exists on the server but is offered only to a guest who arrives through a duel link. The tutorial can be started without a deck, but nothing tells the player so.

**There are many rules, and they are taught by text.** Before or during the tutorial a player is told about seventeen things: Ancient points, taking and holding, three objective effects, strength, abilities, flipping a card, three phases, shared orders, that a new card cannot move, groups, alternating hits, lasting damage, and more. The tutorial has 24 coach panels, 11 of which wait for one exact action and refuse anything else. Rules are explained in at least ten separate places: intro pages, a seven-step tour, fifteen one-time hints, the coach, card tooltips, the card back, objective lines, position keywords, refusal notes and the lobby text. The testers' own feedback was that they do not read.

**The tutorial does not teach the game the player will meet.** It shows two of the five abilities. It fixes the three objectives, while a real match draws three of six, so half the objective rules appear for the first time in the first real match. Mid's Gank, Offlane's Tank, Smoke, the team bonus, and the limits on hand and objective are never shown. The tutorial uses 6 points where the tour, opened from a button labelled "Samouczek", says 10.

**The rules have exceptions that only make sense once known.** A card cannot move on the turn it is put out. A unit goes from one objective to another only through the base, unless it is a Mid or stands on Twin Gates. Units that go from the same place to the same place are one group for one order, and one group is free if a Support stood at its starting place when the turn began. Each of these was added for balance, and each is one more thing a new player gets wrong and is refused for.

**After the tutorial, nothing happens.** The end screen offers "Rewanż" (the tutorial again), "Nowy rywal" and "Wyjdź". There is no reward and no next step, and the play button still points at the tutorial.

### 2.3 Why players see no reason to play

**Winning gives nothing and playing gives nothing.** A match against the computer leaves no trace: no reward, no progress, no record. Packs arrive whether or not the player ever plays: three per finished round to every collection. So the collection grows without the game, and the game adds nothing to the collection.

**The only lasting goal needs another person online.** The ranking counts only live matches between two people, and a match exists only if one player challenges another by name or sends a link. There is no list of open games and no list of who is online. In a community of a few hundred, a player who opens the page alone has the computer and nothing else. All rankings were also wiped on 2026-11-07, so the ranking shows no history.

**The game does not know the tournament is being played.** The real tournament enters the game at one point only: when a card's numbers are computed. After that, nothing that happens in a real match is felt in the game. A viewer's favourite team winning tonight changes nothing for them. Of the data on a card, only the rating, the team and the team-of-the-round mark affect play; the six attributes computed for every card are never shown or used, and the hero and the series result are decoration.

**The collection has no goals of its own.** Duplicates have no use (the planned shards were never built). Completing a team is counted in the album but earns nothing.

**It cannot be played where the viewers are.** Below 900 px the game shows a notice to open it on a computer. The pack that appears while browsing still appears on a phone, and says to open it in a game that will not start there.

<!-- SECTIONS 3-5 GO HERE -->

## 6. Onboarding: the first match teaches by playing

The rule for this section is the owner's product rule: teach through the design. What the player can do glows, the next step is highlighted, and nothing is explained that the board can show. Today's intro pages, the seven-step tour, the fifteen hints and the 24-panel coach are all removed.

### The first minute

| Time | What the visitor sees | What they do |
|---|---|---|
| 0 s | The cards section: the tournament's best-known cards and one button, "Zagraj" | Taps it. No sign-in |
| 5 s | The board: three objectives, two Ancients, a hand of two cards. One card and Roshan glow | Drags the card onto Roshan |
| 15 s | The rival's card turns face up beside theirs. The two numbers meet, the higher one wins, the rival's Ancient loses 2 | Watches. They have learned the whole core: put cards on objectives, the higher total takes it, taking it hurts the Ancient, and the rival plays at the same moment |

The first move happens well inside a minute because nothing stands before it. The visitor plays as a guest with a ready deck made from the tournament's cards. Guest progress lives in the browser only, so there is nothing on the server to abuse.

### The first match

It is a fixed match of four rounds against a scripted rival, with Ancients at 6. Each round adds one idea, shown by the board and by a single short line in the place where the game always shows whose move it is.

| Round | New idea | How the board shows it | The line |
|---|---|---|---|
| 1 | Cards go on objectives; the higher total controls; control damages the Ancient; Roshan is worth 2 | One card and Roshan glow; the reveal counts both totals | "Przeciągnij kartę na Roshana" |
| 2 | Two orders a round; cards add up; a Hard Support and a teammate each add +1 | Two order marks; "+1" chips appear on the cards as the total counts up | "Masz 2 rozkazy" |
| 3 | A unit can move; the rival does not always go where expected | The rival's total on one objective is higher; the player's unit there and another objective glow | "Przesuń jednostkę" |
| 4 | The match ends when an Ancient falls | The rival's Ancient shows 2; Roshan shows 2 | none |

The script only fixes what is in the hand and what the rival does. It does not refuse other moves. A player who does something else still plays a legal round and still wins this match, because the rival's script is weak; they have simply found a rule early.

### Straight after the first win

1. The end screen has one action: a pack to open. It is the first of the ten welcome packs. The first pack is opened card by card, because that is the fun of it. After it, "Otwórz wszystkie" opens the rest in one go for those who want that.
2. Opening the pack asks for sign-in ("Zachowaj karty": Discord or Google). This is the first moment the player has something to lose, so it is the first moment sign-in is worth asking for. A guest who declines can keep playing the computer with the ready deck.
3. After sign-in, one tap on a team crest chooses "Twoja drużyna" (section 7). The name step appears here only for accounts that have no name.
4. The deck is built for the player from their new cards, legal and within the budget. The deck screen is there for those who want it, with "Ułóż za mnie" always available. Nobody has to open it before playing.
5. The play button now points at the next thing: the easiest opponent of the current round (section 7).

### Matches two and three

The remaining rules arrive one at a time, when they happen. The ready deck and the player's first own deck hold all five positions. The first time a card with an ability the player has not yet seen comes into the hand, its ability line is lit. The first time an ability does something, the board names it once at the place where it happened ("Gank: Kiritych wraca na rękę"). The same goes for each objective's effect, and the first three matches use objective sets that between them contain all six. After three matches the player has seen every rule (goal G3), and none of them was a panel to read.

A "?" on the board opens one static page: the round in one sentence, the five abilities, the six objectives. It is for looking something up, and never opens by itself.

## 7. Reasons to play

The game's clock is the real tournament. Each real round should give a player a reason to open the game that evening, and something to do that takes ten to thirty minutes and then is done. There are no daily tasks and no lists of one-time challenges; the owner ruled those out, and a weekly league does not need them.

### 7.1 Kolejka: play this round's real teams

When a real round is finished and its games are in (the moment that already triggers round packs, `src/server/card-lab/rewards.ts`), the game opens that round's **Kolejka**.

- **Opponents.** Every team that played in the round is an opponent, played by the computer. A team's deck is that team's own cards: the five players' cards from this round's series, filled up to the deck size with the same players' most recent earlier series. The computer's team decks ignore the budget and the one-card-per-player rule. Their strength is whatever the team really did, so the bottom of the table is beatable by anyone and the team that dominated the round is a hard opponent. In a tournament with many teams, the game shows five: the weakest, the strongest, and three spread between them.
- **One counted match per opponent per round.** A player may play each opponent once for points. They may replay any opponent, of this round or of past rounds, as often as they like for practice. This keeps the counted play to at most five matches a round, and makes each one matter.
- **Points and the ranking.** Beating an opponent gives points equal to its place from the bottom (1 for the weakest of five, 5 for the strongest). The season's sum is the **Kolejka ranking** of the tournament. Anyone can climb it at any hour without another player online (goal G7).
- **Packs.** Two of the three round packs are earned here: one for finishing a counted match, one for winning one. The third still arrives by itself, so a collector who never plays keeps collecting.

This is the answer to "the only lasting goal needs another person online", and it uses the asset: the opponent is the real lineup of a real team from the matches just played. It needs nothing from the organizer.

### 7.2 Twoja drużyna: a real result pays out

Each player follows one real team, chosen with one tap after the first win and changeable between rounds. When that team's series ends, the player gets its cards from that series: all five if the team won, one if it lost. They arrive as a "Paczka drużyny" with a notification that names the result.

This gives a viewer a stake in a real match the same evening (goal G6). It also completes the followed team's set quickly, and a deck with real teammates is stronger (the Drużyna bonus), so fans end up playing their own team's lineup.

### 7.3 Twoje karty: every tournament player gets their own cards

A user whose account is linked to a roster player receives each card of their own, for every series they play, without luck. The notification states the rating ("Twoja karta za serię z X: 87, złota"). For the few hundred people who actually play in the league this is the strongest hook there is, and it costs one rule in the reward job.

### 7.4 Pojedynki: live matches between people

Live duels stay as the owner decided: by challenge or by link, with no automatic matchmaking, an Elo ranking per tournament, and no prizes for winning. Three things change.

- **A match is quicker and cannot hang.** Both players plan at the same time, so there is one clock per round for both, and a match of six to eight rounds ends in about five minutes by construction. The hit-by-hit fight, which caused the stuck matches and most of the waiting, no longer exists.
- **Open tables are visible.** A player who opens a link lobby today waits alone. The cards screen lists the lobbies that are open now ("Wolne stoły"), and a tournament that has a Discord webhook gets one message when a lobby opens. This is a list of invitations that already exist, so it stays within the owner's decision against matchmaking.
- **A new player is not shut out.** With the deck budget (section 4), a welcome-pack deck meets a season-long collection on nearly equal strength.

### 7.5 The collection

- **Duplicates become shards,** and shards buy packs, never chosen cards. The owner decided this at the start and it was never built (section 8).
- **A complete team** (a card for each of its five positions) is marked in the album and unlocks that team's crest as a card back. More important, it is useful: the five can be played together for the team bonus.
- **Cheap cards matter.** Under the budget, a deck needs good cards at low cost, so a wooden card with a useful position is a find and no longer waste.

### 7.6 The site sends people to the game, and the game sends them back

- A finished series' page shows the cards issued from it, and a card links to its series.
- The team-of-the-round announcement shows its boosted cards.
- One notification per real round, and no more: Kolejka is open, what the followed team's result gave, and the player's own new card if they play in the league.

## 8. Economy

Nothing is sold and nothing is traded. Packs are earned, found or given. If paid packs are ever wanted, that is a separate decision with legal weight, because paid random rewards are regulated in several countries.

### Income

| Source | Amount | State |
|---|---|---|
| Welcome | 10 packs | Kept. Given at first sign-in |
| Finished real round, automatic | 1 pack | Was 3 |
| Kolejka: first counted match finished | 1 pack | New; replaces one automatic pack |
| Kolejka: first counted win | 1 pack | New; replaces one automatic pack |
| Twoja drużyna | 5 cards on a win, 1 on a loss | New. About two-thirds of a pack per round on average |
| Twoje karty | The player's own card for each series | New. Tournament players only |
| Found on the site | As now (`finds.ts`) | Kept |
| Given by the organizer | As now ("Daj paczki") | Kept |
| Shards | 20 shards buy a pack | New, from the owner's original plan |

A player who plays each round earns three packs a round as today, plus the followed team's cards. The owner's earlier target of about 40 packs in a season, with four or five elite cards among them, still holds for packs; the team cards add a known, small amount on top. The organizer's setting "packs per round" keeps its meaning: it is the total of the automatic pack and the two earned ones, and the game splits it.

**The budget changes what generosity costs.** Today, more packs mean a stronger deck, so every extra pack widens the gap between old and new players, and the earlier sessions had to tune drop rates with care. Under a deck budget, more cards give more choice but not more total strength. The organizer can give packs away freely on stream without damaging fairness.

### Duplicates and shards

A duplicate is a second copy of the same card: same player, same series, same team-of-the-round mark. When a pack contains one, the reveal shows it turning into shards. Proposed values: wooden 1, bronze 2, silver 3, gold 5, elite 8, team of the round 10; a pack costs 20. These numbers are a starting point. The economy work package simulates a season and sets them so that shards add 10 to 20% to a regular player's packs.

### What packs contain

Unchanged: one card per position, from a random team's last series, with the per-card weights in `cards.ts`, and a 25% chance of the boosted card where one exists.

### Organizer settings

Three, all existing: the game on or off, packs per round, and giving packs. The free-text "how to get more cards" goes, because the screen now shows the sources itself.

<!-- SECTION 9 GOES HERE -->

## 10. The owner's earlier decisions

Each decision recorded in `inventory/CARDS.md` and the decision log, with a verdict. "Keep" means unchanged. Where the verdict is "change", the reason is given plainly, and the owner can overrule it; section 12 lists these as questions.

| # | Decision | Verdict |
|---|---|---|
| 1 | Player cards only; one card per player per series; stand-ins get the role they filled; cards frozen when issued | Keep |
| 2 | Team-of-the-round cards are boosted twins with +1 strength, 25% chance in a pack | Keep. The +1 does not count against the deck budget, which makes these the cards worth chasing |
| 3 | Rating is a percentile within the position (the owner also proposed a fixed baseline across tournaments) | Keep the percentile within one tournament. On a platform of many organizers, levels differ too much for one baseline, and the budget makes cross-tournament comparison unnecessary |
| 4 | Packs: one card per position, a random team's last series, per-card weights | Keep |
| 5 | Album per tournament, best card per player on top | Keep; add the complete-team mark |
| 6 | Duplicates become shards; shards buy packs only | Keep, and build it. It was decided and never built |
| 7 | No one-time challenge lists; packs found while browsing | Keep. Kolejka is not a challenge list: it is at most five matches per real round, and it replaces packs that were given for nothing |
| 8 | Live challenges only; no matchmaking; no play against other users' decks; the computer never uses a user's deck | Keep all four. The list of open tables shows invitations that already exist. Kolejka's decks are real teams' lineups, not users' decks |
| 9 | **No cost to play a card; better cards must simply be better** | Keep on the table: a 9 beats a 5 and costs nothing to play. **Change in the deck:** a budget limits the total rating strength of a deck. Reason: without any price, deck building is a sort and the collection decides the match (section 2.1). The budget is the smallest price that fixes both, and it is paid once, on the deck screen, in a form fantasy players already know |
| 10 | **Deck of 20: two per position and ten free** | **Change to 12: one per position and seven free.** Reason: a new player has about 50 cards; 20 of them is nearly all the good ones, and 12 is a choice. A smaller deck also means the player sees most of it in a match, so the deck they built is the deck they play |
| 11 | Strength 1 to 9 on a curve (the owner declined a flatter 4 to 8) | Keep. The budget removes the reason to flatten it |
| 12 | **Turn of three phases; cards enter through the base; moves are a plan; orders shared** | **Change:** both players plan one round at the same time; cards go straight onto objectives; orders stay, two a round. Reason: sections 2.1 and 2.2. Orders, planning before confirming, and "nothing happens until you confirm" are kept |
| 13 | **Fights hit by hit, to the end, with the aim line** | **Change: no fight screen.** Totals are compared when the round is revealed. Reason: the fight is where a match's time goes, and it decides about one fight in five. The reveal keeps the moment: cards turn over, bonuses count up, the Ancient is hit |
| 14 | Second player is dealt six cards | No longer needed: there is no second player |
| 15 | Draw two a turn; first to ten points | Replaced by the numbers in section 4 |
| 16 | One ability per position: Farma, Gank, Tank, Smoke, Aura; +1 for teammates together | Keep the five names and the team bonus. Farma, Smoke and Aura work as before. Gank and Tank get new meanings that fit a round played at the same time (section 4) |
| 17 | Six objectives, three per match | Keep |
| 18 | Computer levels; the strongest plays a deck 8 points better | Keep the levels. The computer in practice plays within the budget like the player. The "stronger deck" challenge moves to Kolejka's top teams, where it has a reason |
| 19 | **No automatic deck** | **Change for the first deck only:** it is built for the player, and "Ułóż za mnie" stays available. Reason: goal G1. After that the deck is the player's, and under the budget there is no single best deck for a button to find |
| 20 | **A fully scripted tutorial that teaches optimal moves; one-time hints** | **Change:** a first match of four rounds that fixes the cards and the rival but refuses nothing (section 6). Reason: testers do not read, and the tutorial taught a third of the rules in 24 panels |
| 21 | No pre-filled choices and no preview of a fight's result | Keep. The planning screen shows the player's own totals only. The rival's plan is hidden, so there is no result to preview |
| 22 | Elo per tournament; no prizes for winning duels; public ranking and history | Keep |
| 23 | Paces; the computer never plays for a player who still has time | Keep. One clock per round for both players. When it runs out, the plan is confirmed as it stands |
| 24 | The game is a one-screen section of the home page | Keep, and add a layout for phones (goal G9) |
| 25 | No Twitch linking; subs and channel points handled by the admin | Keep |
| 26 | Rarity by strength; welcome 10 packs; 3 packs per round | Keep, with two of the three round packs now earned in Kolejka (section 8) |
| 27 | One card per player and team in a deck | Keep |
| 28 | Cards need a nickname or Discord | Keep; asked after the first match, not before it |
