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

## 3. Three directions

### Direction A: tune today's game

Keep the rules and fix the numbers and the edges: flatten card strength (4 to 8 in place of 1 to 9), resolve fights automatically, build the first deck for the player, shorten the tutorial, and add the reasons to play of section 7.

- **For it.** The smallest change: two or three work packages. Nothing the owner chose is reversed. The screens stay.
- **Against it.** It does not reach the causes. WP-51 measured it on today's engine: with strength flattened to 4 to 8, a 10-pack deck still loses to a 40-pack deck 84% of the time (90% today). *(The result of today's game with a deck budget is added in section 9 when its run finishes.)* And no number can change the structure: with alternating turns and every unit visible a turn before it acts, there is still nothing to read, and the strongest card in hand is still always the right one to play.

### Direction B: the same board, a new round (recommended)

Keep what a player sees and knows: the map, three objectives, Ancients with hit points, cards as units with one strength number, the five positions and their ability names, the team bonus, orders. Change how a round works and how a deck is built:

1. **Both players plan the round at the same time, hidden, and reveal together.** This is what gives the game something to read.
2. **Cards go straight onto objectives, and totals are compared.** The base, the three phases, the path rules and the fight screen go away, which removes most of the rule list.
3. **A deck of 12 has a budget.** This makes deck building a choice and lets a new player meet a collector on nearly equal strength.

- **For it.** It answers each cause in section 2 with a structural change, and the simulations confirm each one (section 9). It keeps the visual work: card faces, objective and Ancient models, the score as damage, the end screen. A round is one decision screen and one reveal, which also fits a phone and makes a live match short and hard to break.
- **Against it.** It reverses several of the owner's decisions (section 10), the largest being the fight screen and the three-phase turn. The match screen is rebuilt. It is seven to nine work packages.

### Direction C: a new game

Start again from the asset. Two shapes were considered. One is a draft game: before a match both players pick and ban from their collections in turns, as teams do in Captains Mode, and the match is then decided by lane and objective contests computed from the cards' six attributes. The other is a full collectible card game with costs, and with heroes and items as cards beside the players.

- **For it.** The highest ceiling. It would use the attributes and heroes that today's cards carry and never use.
- **Against it.** A draft game puts all the decisions before the match and makes the match something to watch, and a result computed from six attributes is hard to explain to the loser. A full card game needs card types the owner ruled out (players only), a cost system the owner ruled out, and a rule book no viewer learns in a minute. Either one discards the board and its visuals and is two to three times the work of B. Nothing in the diagnosis needs it.
- **What is kept from it.** Hero and attribute traits as a second property of a card are a good later addition to B, once the core is proven with players (section 5, "Room to grow").

**Recommendation: B.** A is cheaper but leaves the game shallow and the new player beaten nine times in ten. C costs the most and risks the one-minute start. B fixes the measured problems and keeps the look.

## 4. The rules of the recommended game

The game keeps its name, "Kontrola mapy". Every number below is a setting in one rules object in the prototype (`src/features/cards/domain/v2/rules.ts` on branch `wp/51-card-proto`), and each was chosen by simulation (section 9).

### 4.1 The deck

- 12 cards, at least one of each position.
- One card per player and team, as today.
- **Budget: the cards' strength adds up to at most 60.** A card's cost is the strength printed on it. The +1 of a team-of-the-round card is free: it adds strength without adding cost.

A new player's ten packs hold about 50 cards, enough to spend the whole budget. A larger collection gives more ways to spend it, not more of it.

### 4.2 The board

- Three objectives, drawn from the six of today's game.
- Each player has an Ancient with 12 hit points.
- At most three units per player on one objective.
- There is no base. A card goes from the hand straight onto an objective.

### 4.3 A round

In one sentence: **both players secretly give two orders, each one a card played onto an objective or a unit moved to another; then everything is revealed, and on each objective the stronger side hurts the rival's Ancient.**

In full:

1. **Start.** Each player draws one card. A player who is 3 or more hit points behind draws one more ("Comeback"). The opening hand is four cards, with no draw in round 1. The hand holds at most seven. Each player gets two orders.
2. **Plan, hidden.** An order does one of two things:
   - **Play** a card from the hand onto an objective. If the player already has three units there, the new card replaces one of them, which is discarded.
   - **Move** a unit from one objective to any other. A unit moves once a round, and not in the round it was played.

   Nothing happens until the player confirms, and the plan can be changed freely until then.
3. **Reveal.** Both plans happen at once.
4. **Ganks** (see Mid, below).
5. **Control.** On each objective the side with more total strength controls it this round. A side alone on an objective controls it. Equal totals mean nobody does.
6. **Damage.** Each controlled objective deals 1 damage to the rival's Ancient; Roshan deals 2. From round 5 on, all damage is doubled.
7. **Farma** and the objectives' effects (below).
8. **End.** An Ancient at 0 is destroyed and its owner loses. If both fall in the same round, the one that took less damage beyond 0 wins. A match lasts at most 8 rounds; after that, the player with more hit points wins.

### 4.4 Strength and abilities

A unit's strength is its card's strength plus its bonuses. A card's strength comes from the player's rating in that series (1 to 9), with the position's modifier.

| Position | Modifier | Ability | What it does |
|---|---|---|---|
| Carry | | **Farma** | After every round on an objective its side controls, +1 strength, up to +3. Lost if the Carry returns to the hand |
| Mid | | **Gank** | When played from the hand, the rival's strongest unit on that objective returns to the rival's hand |
| Offlane | +1 | **Tank** | A gank on its objective takes the Offlane, and spares everyone else |
| Support | −1 | **Smoke** | When played from the hand, one of the player's other units may move to its objective without an order |
| Hard Support | −1 | **Aura** | +1 strength to each of the player's units on its objective, itself included. A second Hard Support on the same objective adds nothing more |

Two more bonuses: **Drużyna**, +1 to each unit that shares an objective with a card of the same real team; and **Drużyna kolejki**, +1 on a team-of-the-round card.

Two abilities work as today (Farma, and Aura apart from the limit of one per objective). Three changed, and the simulations are the reason:

- **Tank.** In the first prototype an Offlane blocked ganks outright. Blocked ganks outnumbered successful ones, and switching Tank off changed nothing for a deck full of Offlanes. Now the Offlane takes the gank on itself: the gank always does something, and the Offlane still protects the Carry beside it.
- **Aura.** When every Hard Support on an objective added its own +1 to everyone, the best decks were stacks of Hard Supports and the bonus outweighed the cards. One Aura per objective keeps a Hard Support worth having on each objective and makes a second one there a waste.
- **Smoke.** As a free move from where the Support stood, it was used once in three matches and a Support-heavy deck was the weakest of all. Now it acts when the Support arrives, bringing a second unit with it. That is what a smoke is for in Dota: several heroes turn up where one was expected.

### 4.5 Objectives

| Objective | Effect |
|---|---|
| Roshan | Deals 2 damage where the others deal 1 |
| Outpost | The player who controlled it last round has 3 orders |
| Lotus Pool | The player who controlled it last round draws one more card |
| High Ground | The player who controlled it last round has +1 on each unit there |
| Twin Gates | The player who controlled it last round may move one unit from there without an order |
| Tormentor | A player who takes control of it draws a card |

### 4.6 The numbers

| Setting | Value | Why |
|---|---|---|
| Deck size / minimum per position | 12 / 1 | A choice for a 50-card collection; most of the deck is seen in a match |
| Budget | 60 | 5 per card. A 10-pack collection can spend all of it; at 66 it could not, and the collector gained from that |
| Ancient hit points | 12 | Matches of five to six rounds |
| Units per side per objective | 3 | Limits how much strength can pile on one objective |
| Orders per round | 2 | With 3, a third of all orders went unused |
| Opening hand / draw per round / hand limit | 4 / 1 / 7 | Drawing 2 let the bigger collection matter more |
| Comeback | +1 card when 3 or more hit points behind | Without it the player behind after round 3 wins about 23%; with it about 35%. Given for any deficit, it gave 40% and helped the bigger collection, so it starts at 3 |
| Roshan | 2 damage | Makes one objective worth fighting over, and the other two a way round it |
| Late game | Damage doubled from round 5 | Without it matches run a round longer and comebacks are rarer |
| Farma maximum | +3 | |
| Last round | 8 | Reached in under 1% of matches |

### 4.7 What the player sees

- **Planning.** The board, the hand, two order marks. Cards and units that can still act glow. A card is dragged onto an objective, or tapped and then the objective tapped; a unit likewise. The player's own planned totals are shown on each objective. Nothing about the rival's round is shown, because nothing is known. One button confirms.
- **Reveal.** The rival's cards turn over, moved units slide, a gank sends its target back, each bonus adds itself to the total as a small "+1" on the card that gives it, the two totals meet on each objective, and the Ancients take their damage. It takes a few seconds and can be skipped with a tap.
- **Every number has one place.** A card shows its strength; a unit shows its current strength; an objective shows each side's total and its own effect. Nothing is repeated in a panel.

### 4.8 A match between people

- Each player's plan goes to the server and stays hidden until both are in or the round's clock runs out. Then the server resolves the round and both see the same reveal.
- One clock per round for both players, from today's paces (20, 30 or 60 seconds, or none). When it runs out, the plan counts as it stands at that moment. The computer never plays for a person.
- A player away for 90 seconds loses, as today.
- A match is at most 8 rounds, so with the 30-second pace it cannot last longer than about six minutes including reveals.

## 5. Where the depth comes from

The rule list is short. The depth comes from three places, and each is measured in section 9.

### 5.1 Decisions in a round

A round asks three questions at once, and each has a cost.

- **Which cards.** A hand holds three to five cards and there are two orders. Playing the strongest card is often wrong now: a Mid is worth most when the rival has just put a strong unit down, a Support is worth most when a unit elsewhere can come with it, and a Carry is worth most early, while it can still grow. In the simulations the strongest computer player chose a different plan from the obvious one in **78%** of rounds.
- **Where.** There are three objectives and a player cannot win all of them. Roshan is worth two, so both players want it, which makes the other two the way round it. With three units per side at most, strength cannot be piled without limit, and a full objective forces the question of which unit to give up.
- **Now or later.** A card played early controls an objective for more rounds; a card kept is an answer the rival cannot see. A move costs the same order as a play, so repositioning is paid for with tempo. From round 5 damage doubles, so a player can plan to be weak early and strong late, or the reverse.

A match is about 8 or 9 cards played and 3 moves made by each player over five or six rounds: around a dozen decisions, each of which matters, against 27 clicks in today's game of which a third decide nothing.

### 5.2 Reading the rival

Because both plans are hidden until the reveal, the right play depends on what the rival is about to do.

- **How much is there to read?** A measuring program that is told the rival's plan each round beats the strongest honest computer player **94%** of the time with the same deck. Almost everything that separates a good round from a bad one is knowing where the rival goes.
- **Is being predictable punished?** A program that knows exactly how the rival thinks, without seeing its hand, beats it 68%. A player with habits loses to a player who notices them.
- **What there is to read.** The rival's board is open: where their Carry is growing, which objective they cannot afford to lose, whether their Offlane stands beside their best unit, how many cards they hold. Their hand is hidden, except cards a gank has sent back. So a player reads intentions from position: "they must defend Roshan this round, so the Outpost is free" is the basic thought of the game, and it has no certain answer.

Each ability is a reading question. Gank asks where the rival's best unit will be when the Mid lands. Tank asks whether to keep the Offlane beside the Carry or use its strength elsewhere. Smoke lets two units arrive where one was expected. Farma makes a visible target that grows more worth attacking each round.

### 5.3 Building a deck

The budget turns the deck screen into a set of trades.

- **Few strong cards or many middling ones.** A 9 and a 1 cost the same as two 5s. The 9 wins an objective alone but is the gank's first target; the two 5s hold two places.
- **Positions.** One of each is required; the other seven slots are the deck's character. Mids to disrupt, Carries to grow, an Offlane for each Carry worth protecting, a Hard Support for each objective to be held.
- **Real teams.** Teammates on one objective get +1 each, and the bonus costs nothing. A deck built around one or two real teams is stronger than its budget says, if the player has collected those teams.
- **Team-of-the-round cards.** Their +1 is free, so each one is worth chasing.

*(The measured strength of each kind of deck against the others is added here from the final simulation run.)*

A new player does not have to think about any of this: the first deck is built for them. A competitor has a puzzle with no single answer.

### 5.4 Room to grow

The core is deliberately small. Once it is proven with players, depth can be added without touching the round:

- **Hero traits.** Every card already records the hero of the player's best game. Heroes could carry one trait each (a primary attribute, for instance), giving a second way for cards to combine. This uses data the cards have and the game ignores.
- **Attributes.** The six attributes computed for every card (fight, farm, growth, damage, vision, teamwork) could give a card a second small bonus, so two cards of the same strength differ.
- **More objectives,** or objectives chosen by the organizer.
- **Team-of-the-tournament cards** with their own effect, which the owner planned.

None of these is in the work packages. Each would arrive as a rule with a simulation behind it, through the balance check that WP-52 puts in CI.

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
- **How hard it is.** The computer plays team decks at its easiest honest level, so the difficulty comes from the team's real cards and not from the program. Simulated on Wiosenna's 19 teams over the season, with the team decks sorted into five bands by strength: a player who makes the obvious move each round wins 85% against the weakest band, then 60%, 44%, 33%, and 18% against the strongest; a strong player wins 99%, 93%, 76%, 63% and 37%. With the computer on a stronger level the average player won under 20% from the second band up, which is why the level is fixed low.
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
| Shards | 30 shards buy a pack | New, from the owner's original plan |

A player who plays each round earns three packs a round as today, plus the followed team's cards. The owner's earlier target of about 40 packs in a season, with four or five elite cards among them, still holds for packs; the team cards add a known, small amount on top. The organizer's setting "packs per round" keeps its meaning: it is the total of the automatic pack and the two earned ones, and the game splits it.

**The budget changes what generosity costs.** Today, more packs mean a stronger deck, so every extra pack widens the gap between old and new players, and the earlier sessions had to tune drop rates with care. Under a deck budget, more cards give more choice but not more total strength. The organizer can give packs away freely on stream without damaging fairness.

### Duplicates and shards

A duplicate is a second copy of the same card: same player, same series, same team-of-the-round mark. When a pack contains one, the reveal shows it turning into shards. Proposed values: wooden 1, bronze 2, silver 3, gold 5, elite 8, team of the round 10; a pack costs 30. A simulated Wiosenna season of 37 packs (the welcome ten and three a round) gives 185 cards, of which 68 are duplicates, mostly wooden and bronze. At these values they are worth about 180 shards, which is six more packs, or 16%. The economy work package repeats this with the new sources of cards and sets the final numbers, keeping shards at 10 to 20% of a regular player's packs.

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

## 11. What this document cannot know, and how to find out

- **Whether people find it fun.** Simulations show that the rules are fair, that thinking pays and that matches are short. They cannot show that a round feels good to play. WP-54 puts three versions of the screen in the owner's hands before anything is built for real, and WP-62 runs a trial with five people who have never seen the game.
- **How real people play.** The computer players stand in for people. The weakest of them plays "the obvious move", which is roughly what a new player does, but real beginners make other mistakes, and real experts will find things the strongest computer does not. The balance check of WP-52 runs on every change, so a discovery by players becomes a knob change with a measured effect.
- **How many people play today, and where they stop.** There are no usage numbers. The complaint in the brief and the testers' notes are the only evidence. WP-62 adds the events that answer it: time to the first move, first matches finished, players who return after a real round.
- **Whether the first minute is really a minute.** The path in section 6 has no step that takes long, but only a stopwatch on a new visitor proves it. That is the first thing the trial measures.
- **The economy's exact numbers.** The shard values and the effect of the followed team's cards are estimates until WP-61 simulates full seasons.
- **Small tournaments.** PDL S2 has 12 teams and 117 cards so far, and the rules hold there in simulation. A tournament of four teams in its first round has about 20 cards, fewer than a legal deck needs from one collection with luck against it. The first-run deck and Kolejka's team decks are built from all the tournament's cards, so they work; for a tournament below 8 teams the deck size may need to drop, and WP-52 adds a test for the smallest tournament the game supports.

## 12. Questions for the owner

Each has a recommendation, and the design proceeds on it. They are also in `STATUS.md`.

1. **The deck budget** (decision 9). Recommended: accept. Without it a new player loses nine matches in ten to a collector, and no other rule in this document fixes that.
2. **No fight screen** (decision 13). Recommended: accept. If the owner wants a moment of direct action kept, the place for it is the reveal, and WP-54's third version plays the reveal objective by objective for that reason.
3. **Both players plan at once** (decision 12). Recommended: accept. It is what gives the game something to read, and it removes most of the waiting in a match between people.
4. **Deck of 12** (decision 10). Recommended: accept.
5. **The first deck is built for the player, and the tutorial becomes a four-round first match** (decisions 19 and 20). Recommended: accept.
6. **Two of the three round packs are earned in Kolejka.** Recommended: accept. The alternative that keeps today's income for people who never play is to leave all three automatic and make Kolejka's packs extra; that raises a regular player's income by two-thirds.
7. **Kolejka's opponents are the real teams' lineups.** Recommended: accept. It does not use any user's deck. If a team objects to being "beaten" in a card game, the mode can be named after the round instead of the team.
8. **A phone layout.** Recommended: yes; it is where the viewers are. It is the largest single piece of screen work in the plan (part of WP-54 and WP-55).
9. **When v2 replaces v1 for PDL S2.** Recommended: at a round boundary as soon as WP-58 and WP-59 are proven, with collections untouched and rankings started fresh. If v2's live duels are ready before WP-40 moves v1's duels to the new platform, WP-40 skips them.
