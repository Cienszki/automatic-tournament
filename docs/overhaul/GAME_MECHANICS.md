# How the card game works, exactly

Written 2026-11-17 for the owner, who asked to know the game "like I built it from scratch": the math, the decisions, the trade-offs and the reasons behind each rule. Drafted by Opus. `GAME_DESIGN.md` says what the game is for and how it was chosen; this file says what the engine does, step by step, and what follows from it for a player. Every rule here is read from the code in `src/features/cards/domain/v2/`, and every number from the simulations in `docs/overhaul/sim/v2-final/` unless it says otherwise.

## 1. A match in numbers

- Two players, three objectives, two Ancients of 14 HP.
- A match lasts 6.3 rounds on average: 16% end in round 5, 46% in round 6, 33% in round 7, 6% in round 8. 99% end with an Ancient destroyed; the rest at the round limit (8).
- Each round each player has 2 orders. Over a match a player plays about 9.9 cards and makes about 3.6 moves. About 1.9 objectives per round have units of both sides on them ("contested"); the fight changes who controls one of them 13% of the time.
- On a contested objective each side has on average 2.9 units and a total strength of about 19 (10% of totals are under 6, 10% over 30).

## 2. Where a card's numbers come from

**Rating.** Each card is one player's one series. The series gets a performance score; the card's rating (`ovr`, 45 to 99) is that score's percentile among all series of the same position in the tournament. A rating of 72 means "better than half of the series played in this position".

**Strength** (the number on the card), in three steps (`src/lib/card-lab/outposts.ts`):

1. Rating strength = 1 + round(8 × p^1.3), where p is the percentile (0 to 1). The curve makes the top rarer: a median series (p = 0.5) gives 4, the top 10% gives 8, only about the top 5% gives 9. On Wiosenna the counts are: 1: 96 cards, 2: 121, 3: 119, 4: 90, 5: 89, 6: 89, 7: 91, 8: 73, 9: 38.
2. Position modifier: Offlane +1, Support and Hard Support −1, Carry and Mid 0. The reason: Offlanes have a defensive ability with no strength in it, supports have abilities that add strength to others.
3. Team of the round: +1.

The printed strength is never below 1.

**Cost** (what a card takes from the deck budget): the printed strength without the team-of-the-round +1, except that each point above 7 counts twice.

| Printed strength (without the +1) | 1 to 7 | 8 | 9 | 10 |
|---|---|---|---|---|
| Cost | same as strength | 9 | 11 | 13 |

So a 9-rated Offlane prints 10 and costs 13; the same card as team of the round prints 11 and still costs 13.

**Why the steep cost.** With cost equal to strength, a deck of three stars and nine cheap fillers beat every other kind of deck (72% against the field). The reason is the places: at most four of your units fit on an objective, so a 9 uses one place to do what two 5s do with two. Making strength above 7 dearer, and allowing a fourth place, brought that deck to 49% (`GAME_DESIGN.md` 9.9).

## 3. The deck

- 12 cards. Each position at least once and at most three times. One card per player and team (a player who stood in for another team may bring one card from each).
- In ranked duels and practice the costs add up to at most 60, that is 5 per card on average. In Kolejka and in duels "bez limitu" there is no budget.

**What 60 buys.** Twelve 5s (60). Or three 9-rated stars (33) and nine cards averaging 3 (27). Or any shape in between. A new player's ten packs (50 cards) are enough to fill the budget; a collector's 200 cards fill it with better cost-for-strength, which is why the collector still wins 61% in ranked play on Wiosenna and 52% on PDL S2. Without the budget it is 90%.

**Free strength.** Three things add strength without adding cost, and they are what deck building is really about:
- Team of the round: +1 printed, not counted in the cost.
- Teammates: +1 to each unit that shares an objective with a unit of the same real team (section 5).
- Carries grow (Farma) and Hard Supports give Aura: ability strength that the budget does not see.

## 4. A round, in the exact order the engine runs it

**Start of the round** (`setup.ts`, from round 2 on):
1. Each player draws 1 card. A player who controlled Lotus Pool at the end of the last round draws 1 more. A player who is **3 or more HP behind** draws 1 more ("Comeback"). The hand holds at most 7; a draw into a full hand is skipped and the card stays in the deck.
2. Each player gets 2 orders, 3 if they controlled the Outpost at the end of the last round.

Round 1 has no draw: both start with 4 cards.

**Plan** (secret, both at once). An order is one of:
- **Play** a card from the hand onto an objective. If you already have 4 units there, the plan names one of your units there to discard (to the graveyard) to make room.
- **Move** one of your units to another objective. Any objective to any other; each unit at most once a round.

Some moves cost no order:
- **Smoke:** for each Support you play this round, one of your units moving to that Support's objective is free.
- **Twin Gates:** if you controlled Twin Gates at the end of the last round, one move out of Twin Gates is free.

You may leave orders unused. Nothing happens until both players confirm.

**Reveal** (`resolve.ts`, `revealRound`): both plans happen at once, side 0's actions first in the list, but nothing is decided by that order: the board is only read after both are applied.

**Ganks** (`gank.ts`): for every Mid **played from the hand this round**, looking at the board right after the reveal:
- If the rival has an Offlane on that objective, the Offlane is ganked.
- Otherwise the rival's strongest unit there (by its current strength; ties to the lower card id) is ganked.
- A ganked unit is **out for this round**: it stays on the board, counts 0, gives no bonuses to others (no Aura, no team bonus), cannot be hit or guarded, and a ganked Carry loses all its Farma growth. Next round it counts again.
- Two Mids of one side on one objective gank two different units. All ganks are chosen on the same board, so a Mid that is itself ganked still ganks.

**Fight** (`fight.ts`, `finishRound`): on the board after the ganks, each player secretly names
- one rival unit to **hit**: any rival unit on a contested objective that is not out and is not an Offlane, and
- one of their own units to **guard**.

Then both are applied together. A hit unit that its owner did not guard, **for this round only**: loses 3 strength (down to 0 at most), and gives nothing to others (its Aura and the team bonus it gives switch off). A unit that is hit still hits. Either choice can be left empty. (The second half was added on 2026-11-17, after the question "why hit this card and not another"; section 7.)

**Control and damage:** on each objective the side with the strictly higher total controls it (a side alone there controls it with any total above 0; equal totals mean nobody does). Each controlled objective damages the other Ancient: 1, Roshan 2; from round 5 on, double (2, Roshan 4).

**After control:** each Carry on an objective its side controls gains +1 (Farma, up to +3). A side that takes control of the Tormentor this round, after not having it last round, draws a card.

**End:** an Ancient at 0 or below loses. If both fall in the same round, the one less far below 0 wins (equal: play on, unless it is round 8). After round 8, more HP wins; then more objectives controlled in the last round; then a draw.

## 5. A unit's strength

Strength = printed strength + Farma growth + Aura + team bonus + High Ground − a landed hit.

| Part | Exactly |
|---|---|
| Farma | +1 per round this Carry spent on an objective its side controlled, up to +3; reset to 0 by a gank |
| Aura | +1 if any Hard Support of your side stands on this objective and is neither out nor hit; at most +1 however many Hard Supports are there; the Hard Support gets it too |
| Team bonus | +1 if another unit of your side from the same real team stands on this objective and is neither out nor hit |
| High Ground | +1 for units standing on High Ground, if your side controlled it at the end of the last round |
| Hit | −3 this round, not below 0; the hit unit also stops giving Aura and team bonus to others |

**Worked example.** On Roshan you have a 7-rated Carry with 2 growth, a Hard Support printed 5, and an Offlane printed 6 from the Carry's real team. The Carry counts 7 + 2 + 1 (Aura) + 1 (team) = 11. The Hard Support: 5 + 1 (Aura) = 6. The Offlane: 6 + 1 (Aura) + 1 (team) = 8. Total 25. The bonuses come to 5 strength without costing a point of budget, and they all depend on the units standing together. Splitting them across objectives loses them.

The same position under a hit. The Offlane cannot be hit. A hit on the **Carry** takes its 3 and the team bonus it gives the Offlane: 8 + 6 + 7 = 21, four less. A hit on the **Hard Support** takes its 3 and the Aura of all three: 2 + 10 + 7 = 19, six less. Which unit is hit now matters, and the Hard Support is the one to guard.

## 6. Control and damage: the race

- The most one player can take in a round is 1 + 1 + 2 = 4 HP (all three objectives, one of them Roshan), 8 from round 5. 14 HP therefore lasts at least 4 rounds against a perfect sweep, and the usual 6 rounds because control is shared.
- **Roshan** is worth twice the others. Both players want it, which is why it is usually contested and the other two are often the cheaper damage.
- **Rounds 5 and later count double.** A lead built early can be overturned late: the player behind after round 3 still wins 38% of the time. The trade-off it creates: spending early rounds on board strength (Farma, positions) instead of damage.
- **Ties deny.** Equal totals mean nobody controls the objective. Bringing a contested objective to a tie is often enough: it costs the rival the damage without you having to win it.
- **Holding versus taking.** There is no bonus for holding: control is decided again every round from scratch. What persists is the units, so a strong position keeps paying until it is broken.

## 7. The fight, in depth

### What a hit does

A landed hit takes 3 from the unit for one round, and for that round the unit gives nothing to the others: a hit Hard Support's Aura is gone from everyone on its objective, and a hit unit stops giving the team bonus to its teammates there. So the swing a hit causes on an objective is

**3 + the Aura it was giving + the team bonuses it was giving**,

which is 3 for a plain unit, up to 7 or more for a Hard Support on a full objective (3, its own Aura, and one Aura for each of up to three others), and 4 or 5 for a unit that links teammates. Units of 1 or 2 strength lose only what they have from the 3, but still lose what they give.

**Why it works this way.** At first a hit was a flat −3 that left every bonus in place, and then every unit of 3 or more on an objective was the same target: the choice of unit was only a coin toss against the guard. Experiment E19 (`docs/overhaul/sim/v2-hit/`) compared that with this rule and with a hit that takes half the unit's strength:

| Hit | Choosing the target well beats choosing at random | Fights that change control | Better planner beats the obvious-move player |
|---|---|---|---|
| −3 only | 65% | 9% | 86% |
| **−3 and switches off what it gives (chosen)** | **83%** | **13%** | **80%** |
| Half the strength | 72% | 12% | 82% |
| Half, and switches off | 82% | 15% | 77% |

The chosen rule makes the target matter most for the least loss of planning skill, and it keeps every balance target (the veteran's edge 59%, comebacks 36%).

### When a hit matters

A hit changes the outcome on an objective only if the margin there is within its swing. Measured on the board after the reveal between strong players (with the earlier flat hit, so the swing was 3; the margins themselves come from planning and are the same):

| Margin between the two totals | Share of contested objectives | A plain hit (swing 3) by the side behind | A hit on a Hard Support with three others (swing 7) |
|---|---|---|---|
| 0 (tied) | 6% | wins it | wins it |
| 1 or 2 | 21% | wins it | wins it |
| 3 | 8% | makes it a tie | wins it |
| 4 or 5 | 14% | changes nothing | wins it |
| 6 or more | 50% | changes nothing | wins it at 6, ties at 7 |

So on a third of contested objectives any hit decides the result, and on another fifth only a hit on the right unit does. Both sides hit: two hits on the same objective cancel out, partly or fully. Overall a fight now changes who controls an objective 13% of the time; today's game's fights did it 5% of the time with three times the clicks.

### Choosing the hit

Three questions, in this order:

1. **Where.** The objectives where a hit can change control, weighted by what they are worth (Roshan 2, others 1, double from round 5).
2. **Which unit there.** The one whose loss swings the most: a Hard Support on a crowded objective first, then a unit that links teammates, then any unit of 3 or more. A Carry with growth is no better a target than another unit (the growth is its own strength, and a hit takes a flat 3); a gank is what resets growth.
3. **Against the guard.** The rival can guard one unit. If the best target is obvious, they will guard it. Then the second-best target, or the same target on a different objective, is often the better hit.

### Choosing the guard

The guard only helps if the rival hits exactly that unit. It is a guess about the rival's hit. The natural guard is your most valuable unit on the most valuable close objective, which is also what the rival expects.

### The guessing game

The habit "hit their most valuable unit, guard my most valuable unit" is the right first instinct now: it beats choosing at random 83% of the time. But it is predictable. A player who expects it hits the second-best target and guards where the habit will hit, and wins **87%** against the habit with everything else equal. Being unpredictable (mixing between the good options in the right proportions) only edges out the habit, 54%. The money is in reading a rival who has a pattern, and in not having one yourself.

Against a player with no habit, a guard succeeds about 4 times in 10 (measured: 41% of hits were guarded).

### How positions change the guessing

- **An Offlane cannot be hit.** An objective where your only hittable unit stands next to an Offlane leaves the rival one target, and your guard then stops the hit for certain. Offlanes make guards work.
- **A lone star** is the same: one target, a certain guard. But a lone star is the Mid's target too (a gank takes the strongest).
- **A Hard Support on a crowded objective** is your most valuable and most exposed unit: it is worth the most to hit, so it is what the rival aims at and what you guard. Two objectives each with a Hard Support give the rival a choice you cannot cover with one guard.
- **Many plain units** give the rival many equal targets, so your guard rarely matters; but no single hit swings more than 3.
- **Units under 3** are poor targets for the 3 they lose, but still lose what they give.

### Is the fight solvable?

Each round's fight is a small zero-sum game with simultaneous choices, so it has an optimal mixed strategy (a probability for each hit and guard), which the strongest computer player computes. A human cannot do that arithmetic, and does not need to: listing the objectives a hit can change, ranking the targets by their swing, and varying the choice between the best two gets close. What wins more than the optimum is noticing a habit.

## 8. The abilities

| Position | Ability | Exactly | When it is good | Counter |
|---|---|---|---|---|
| Carry | Farma | +1 a round on an objective you controlled that round, up to +3 | Early, on an objective you can hold: a Carry that farms three rounds is a +3 card at no cost | A Mid: a gank resets the growth to 0 |
| Mid | Gank | When played: the rival's strongest unit there sits out the round (an Offlane takes it instead) | Into an objective where the rival relies on one big unit; played late in the reveal of a close objective | An Offlane beside the big unit; keeping Mids in the hand until it matters |
| Offlane | Tank | +1 printed strength; cannot be hit in the fight; takes the gank instead of others | Next to your star: it absorbs the gank (losing its own strength for the round instead of the star's) and makes your guard certain | A hit on its neighbours, which it does not stop |
| Support | Smoke | −1 printed; when played, one of your units moving to its objective is free | Turns two orders into three actions: play the Support and pull a unit across | None directly; the rival sees it only at the reveal |
| Hard Support | Aura | −1 printed; +1 to each of your units on its objective, itself included (one Aura per objective) | On a crowded objective: with four units it adds 4 strength | A gank or a landed hit on it removes the Aura for the round, so it is the first unit to guard; a second Hard Support on the same objective adds nothing |

Measured on the final rules: a deck heavy in any one position wins 46% to 60% against the automatic deck; three Mids is the strongest (60%), because ganks are the main way to break a strong position. Switching Gank off lowers the comeback rate from 37% to 29%: it is the game's main comeback tool.

## 9. The objectives

| Objective | Effect | Measured: holding it in round 2 wins |
|---|---|---|
| Roshan | Worth 2 (4 from round 5) | 59% |
| Lotus Pool | Controller draws 1 more card next round | 62% |
| Outpost | Controller has 3 orders next round | 54% |
| Tormentor | Taking it draws a card at once | 55% |
| High Ground | Next round, your units on it get +1 | 47% |
| Twin Gates | Next round, one move out of it is free | 49% |

Three of the six appear in each match. Lotus Pool is the strongest early because cards are the scarcest thing in the game (one draw a round).

## 10. Planning: the decisions and their trade-offs

**Two orders, and what they compete for.**
- *Play or move.* A play adds strength to the board for the rest of the match; a move only relocates it. Strong players play nearly 3 cards for every move. Moves matter when the rival has committed somewhere and you can avoid them, or concentrate on Roshan.
- *Spend or keep.* A card kept in the hand is an answer the rival cannot see. A card played early controls an objective for more rounds and lets a Carry farm. The hand is small (4, then one draw a round), so every card kept is a card not on the board.
- *Spread or stack.* Spread units contest more objectives; stacked units get Aura and team bonuses and are harder to overturn. Four places per objective cap the stack.

**What you can and cannot know.** The board is open: every unit, its strength, its growth. The rival's hand size and cards played are open; the hand itself is not, except cards a gank has shown. So you can count exactly how much the rival can bring by moving units (moves are visible options), and you can only guess what they will play. The strongest computer player guesses the rival's hand by sampling cards of the right cost from the tournament's pool.

**What reading means in practice.** "They are 2 behind on Roshan and have a Mid in hand: they will play the Mid there, and my Carry will be ganked. So I put my Offlane there." Then they expect the Offlane and play the Mid elsewhere. The value of knowing: a program told the rival's plan beats the strongest honest player 85% of the time. A program that only knows how the rival thinks beats it 62%.

**The obvious plan.** "Put my strongest card where I gain the most if nothing else happens." Strong players chose something else in 81% of rounds. The most common reasons: the rival's likely Mid, the late doubling, and denying an objective by a tie instead of winning it.

## 11. Is the game solvable?

- **Not by brute force.** Each round both players choose among dozens of plans with hidden hands, then play a small fight game, for six rounds. The strongest computer player does not solve it: it samples a few guesses of the rival's hand and plans against them.
- **Not by a simple rule.** The best computer player beats the one that always makes the obvious move 83% of the time, and the obvious-move player beats a random one 97% of the time. Each step of thinking pays, and the top step is still not close to the ceiling: a program told the rival's plan wins 85% against the best honest player.
- **A human's edge** is reading: a computer opponent mixes its choices well but does not adapt to a person; a person can learn a rival's habits within a match and between matches.
- **What keeps it from being solved in practice** is that the two hidden things (the plan and the fight) interact: the best plan depends on the fight you expect, and the best fight on the plan you expect.

## 12. Why each rule is what it is

| Rule | Alternatives tested | Why this one |
|---|---|---|
| Both plan at once | Alternating turns (today's game) | Today, every unit was seen a turn before it acted: nothing to read. Simultaneous plans make every round a prediction |
| Two orders | Three | With three, a third of the orders went unused |
| One draw a round | Two | With two, the bigger collection won more (79%) |
| Fight: one hit and one guard, −3 | A hit and guard on every objective, removing the unit; −4 | The bigger fight made the better planner win only 52%: the fight swallowed the game. −3 keeps planning decisive and the fight still matters |
| A hit also switches off what the unit gives | A flat −3; half the unit's strength | With a flat −3 the choice of unit did not matter (65% for choosing well); now it does (83%), and fights change control 13% of the time |
| Gank: the target sits out the round | Back to the hand; only units no stronger than the Mid; the weakest unit | Back to the hand made a deck of Mids win 93%; the others gave the advantage back to collections |
| Offlane takes the gank, cannot be hit | Blocking ganks | Blocking made Tank do nothing measurable |
| Aura once per objective | Every Hard Support adds +1 | Stacking Hard Supports beat the cards themselves |
| Budget 60, steep cost, four places | 66, cost = strength, three places | The collector and the stars-and-fillers deck both stayed too strong |
| Comeback card at 3 HP behind | Any deficit; none | None: the player behind won 23%; any deficit: 40% and it helped collections |
| Damage doubled from round 5 | None | Without it matches ran a round longer and comebacks fell |
| Ancients 14 HP | 12, 16 | 12 gave matches of 5.7 rounds, which the owner found too short; 16 gave 6.9 rounds and moved no target |

## 13. What is not settled, and weak spots

- **The target of a hit used to hardly matter** (a flat −3 on any unit). Fixed on 2026-11-17: a hit also switches off what the unit gives (section 7).
- **Three Mids is at the edge** (60% against the automatic deck). The first thing to watch when people play.
- **Kolejka on PDL S2 is too easy** (short team decks early in a season); WP-59 measures the fix.
- **Weak units are poor targets**, so a deck of 1s and 2s on one objective shrugs off hits. The steep cost makes such decks rare, but it is a known hole.
- **Both Ancients at exactly the same negative HP** in the same round, before round 8, means playing on with Ancients below zero. Rare (both must fall to the same number) and harmless, but odd; the end screen shows it as 0 : 0.
- **The fight is a guessing game**, by design. Against an unpredictable rival a good fighter gains only a little; the gain is against habits. Whether people enjoy that is something only the trial with people (WP-62) can tell.
- **All of this is measured with computer players.** People will find lines the programs do not; the balance check in CI catches a rule change that breaks the numbers, not a strategy nobody simulated.
