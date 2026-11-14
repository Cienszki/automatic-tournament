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

*(The measurements of WP-50 go here: deck strength against win rate with realistic collections, how often the strongest cards are the ones played, the attacker's share of won fights, how often target choice matters, and how often the player who gets ahead stays ahead.)*

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
