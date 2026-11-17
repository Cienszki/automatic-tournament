# Card game match screen: what today's screen does

Written 2026-11-17 by an explorer agent for WP-55, checked and edited by Opus. It lists every user-facing feature of today's match screen (`src/components/card-lab/OutpostsGame.tsx`, "OG" below) so that the new match screen keeps them. WP-55's report must give each row a verdict: kept, adapted (how), or dropped (why).

Verdicts here are a first reading against the final rules (`GAME_DESIGN.md` section 4): **AS** carries over as is; **CH** carries over with the change stated; **NO** has no place. The final rules in one line: no base (cards go from the hand straight onto an objective), both players plan two orders at once and reveal together, then a fight step (each player hits one rival unit for −3 strength this round and guards one own unit; Offlanes cannot be hit), then each objective goes to the higher total; four places per side on an objective.

Today's match has no keyboard support; almost all polish is pointer and hover.

## 1. Card in hand
| Feature | Where | Verdict |
|---|---|---|
| Hand fans out: 3° rotation and 3 px drop per step from centre, cards overlap | OG:1636-1649 | AS |
| Hover lifts a playable card (y −14, scale 1.05) above its neighbours | OG:1642-1644 | AS |
| Hover 350 ms flips the card in 3D (0.45 s) to its back, grown to at least 1.55× or 190 px, raised 46 px; the back shows name, team vs opponent, the position's ability, strength | Figure OG:178-266 | CH: new ability texts; strength parts of the new rules |
| Flip cancelled on pointer down and leave; off while dragging | OG:188-199, 1646 | AS |
| Strength badge, position under the name, avatar, hero render, name shrunk to fit (`FitLine`) | OG:213-226 | AS; add the card's cost in the deck screen and on hover |
| A card that cannot be played is greyed with a moon icon | OG:211, 219, 1645 | CH: "cannot" now means no order left or no place |
| Playable cards glow when nothing is picked | OG:1645 | AS |
| Selected card: ring, glow, lifted 10 px; the order gems it would spend blink | OG:207, 1643 | AS |
| Tap selects, tap again deselects; select several cards, then one tap on an objective plays them all | OG:1336, 1411, 1278-1286 | CH: an objective, not the base; at most as many as orders left |
| "Za dużo kart: masz N rozkazy" when more are selected than orders | OG:1615, 1622 | CH: two orders (three with the Outpost) |
| "Nie wystawiam więcej" card beside the hand | OG:1651-1658 | NO (no deploy phase) |
| Empty hand text "Ręka pusta: dobierasz 2 karty" | OG:1659 | CH: draws one (more with Lotus Pool or Comeback) |
| Rival's hand as fanned card backs with a count; tooltip with hand, deck and graveyard counts | OG:1551-1557 | AS |
| Cards slide from hand to board through a shared `layoutId` | OG:1645 | AS |

## 2. Units on the board
| Feature | Where | Verdict |
|---|---|---|
| Unit size from the arena size (ResizeObserver), 60-140 px | OG:1140, 461 | CH: four places per side, one size rule |
| Dashed empty slots per side per objective | Slot OG:387 | CH: four |
| Side-coloured ring (green me, red rival) | OG:210 | AS |
| Ready units glow; planned units get a dashed outline; a unit Smoke can bring along gets a purple ring and wind icon | OG:358-364, 235-236 | CH: "planned" = has an order this round; Smoke now = a Support played from hand brings one unit |
| Buff chips with icon and signed value (Aura, Farma, High Ground, Drużyna) | OG:71, 227-234 | CH: also the −3 hit; Aura once per objective |
| "+N" pop and badge bounce when strength rises | OG:1165-1181, 224-226, 268-273 | AS |
| Units leave with a fade and shrink | OG:197 | AS |
| A dropped unit "settles" instead of sliding a second time | OG:361-363, 1253 | AS |
| Clicking a unit that cannot act says why and pulses the hand | OG:1376-1381 | CH: new reasons |

## 3. Selection
| Feature | Where | Verdict |
|---|---|---|
| Tap a unit to select; a second unit from the same place adds to the group; one from elsewhere replaces | OG:1337-1342 | CH: each move costs one order, so a group is a convenience for sending several units to one place, capped by orders |
| Tap again to deselect; a tap on empty board clears | OG:1535 | AS |
| Pressing a selected unit drags the whole selection | OG:1364 | AS |
| Selecting cards clears selected units and the reverse | OG:1364-1365 | AS |
| Tap a target after selecting, anywhere on the objective | OG:401, 1411 | AS |

## 4. Dragging
| Feature | Where | Verdict |
|---|---|---|
| Drag starts after 9 px; less is a tap | OG:1324 | AS |
| Ghost portalled to `document.body`, outside the scaled stage, scaled by `fit` | OG:1731-1738 | AS |
| Ghost keeps the grab offset | OG:1320 | AS |
| Position set each frame by rAF with `translate3d`, not React state | OG:1301-1314 | AS |
| Tilt from horizontal speed, smoothed (0.82/0.18), ±14°, scale 1.06 | OG:1307-1308 | AS |
| Several dragged cards shown stacked | OG:1733 | AS |
| The source fades while dragged | OG:1643, 373 | AS |
| Drop target found by `elementsFromPoint` + `data-drop` | OG:1297-1300 | AS |
| A refused drop springs back in 220 ms, the selection returns, a note says why | OG:1352-1359 | AS |
| While carrying, valid targets are tinted with a pill, invalid ones greyed with the reason | OG:399-405, 435-439 | CH: new legality (full objective asks which unit to replace) |
| Listeners on `window`, removed on pointer up; `touch-none select-none` | OG:1316, 1362, 199 | AS |

## 5. Hover, tooltips, previews
| Feature | Where | Verdict |
|---|---|---|
| Card flip | Figure | AS |
| Strength parts on the back, only for real buffs | OG:248-257, 279 | CH: parts of the new rules, including a landed hit |
| `CardInfo` popover in the combat log | OG:282-304 | AS |
| Target pill: what sending there gives ("Twoja siła N", cost in gems, free by Smoke) | OG:314-330 | CH: own total only, never the rival's or a predicted result (owner's rule); no "do bazy" |
| `powerIfMoved`: own total at the destination | OG:310-313 | CH: reuse for the plan preview |
| Effect chips per row (Smoke, Aura, High Ground, Drużyna) with tooltips | OG:132-163 | CH: the effects of the new rules |
| Tooltips on Ancient HP, objectives, gems, clock, rival hand, help icons | scattered | CH: new wording |
| Tooltip delay 120 ms, skip 60 ms | CardLab.tsx:253 | AS |
| Pointer cursor on valid targets, help cursor on explained things | OG:402 | AS |

## 6. Objectives
| Feature | Where | Verdict |
|---|---|---|
| Arena background: the real 7.41 minimap cropped around the objective, darkened, edge-faded | Arena OG:372-384, 62-69 | AS |
| 3D model, name (owner-coloured), rule text | OG:414-419 | AS |
| Owner glow | OG:404, 418 | CH: control is decided each round |
| "przejęcie −N HP" / "trzymanie" labels | OG:420-423 | CH: "−N HP a round while held", doubled from round 5 |
| High Ground towers and glow when held | HgFx OG:118-131 | AS |
| Aura sparkle under a group with a Hard Support | AuraFx OG:104-115 | AS |
| Smoke cloud | SmokeFx OG:93-102 | CH: shown when a Support brings a unit |
| Rival row on top, own row below | OG:406-433 | AS |
| Two Ancients with HP | ScoreRace | AS |

## 7. Effects and animation
| Feature | Where | Verdict |
|---|---|---|
| `LayoutGroup` + `layoutId` spring slides | OG:194, 1544 | AS |
| Points fly from an objective to the Ancient; the bar moves only when each lands (`owed`) | OG:954, 1143-1162, 1687-1695 | CH: one flyer per controlled objective at the end of a round |
| Gains wait until the fight scene closes | OG:1152-1153 | AS |
| Round banner | OG:1185-1187, 1698-1704 | CH: "Runda N", then "Odsłona", "Walka" |
| "Brak rozkazów" banner | OG:1233-1239 | CH: a nudge to confirm |
| Prompt pill glows for 1.4 s on change | OG:1618 | AS |
| Confirm button pulses when nothing is left to do | OG:1673 | AS |
| Gems blink on one shared clock | OG:81-89, 1536 | AS |
| Rival's actions summed up in a pill | OG:1625-1631 | CH: the reveal shows them |

## 8. Score and HUD
| Feature | Where | Verdict |
|---|---|---|
| Top bar: back, rival hand, ScoreRace, opponent, help, log, resign, bug report | OG:1546-1598 | AS |
| ScoreRace: Ancient images, HP numbers, pip bars draining | OG:482-521 | AS (14 HP) |
| Order gem tray | OG:1661-1669 | CH: two (three with the Outpost) |
| Prompt pill that becomes a button when nothing else is possible | OG:1427-1433, 1616-1623 | CH: plan, fight |
| Round button (124 px) with its labels | OG:1670-1678 | CH: "Zatwierdź"; a locked state while waiting for the rival |
| Rival identity: bot with level colour, or person with rating and avatar | OG:1561-1574 | AS |

## 9. Combat log
| Feature | Where | Verdict |
|---|---|---|
| "Przebieg meczu" overlay, by turn, newest first | OG:567-599 | CH: by round |
| Rows for plays, moves, fights, points with card chips | OG:546-566 | CH: plays, moves, ganks, hits, guards, control, damage |
| Card chips with `CardInfo` | OG:525-535 | AS |
| Closes on backdrop or X; scrolls itself | OG:576-583 | AS |
| Game pauses while the log is open (computer games) | OG:1199, 1211 | AS for the computer, NO online |

## 10. The battle screen, as material for the fight step
| Feature | Where | Verdict |
|---|---|---|
| Full-screen scene with no backdrop blur (slow on weak graphics) | OG:753-756 | CH: the fight step happens on the board; keep the no-blur lesson |
| Turn prompt with pulse | OG:765-779 | CH: "Uderz", "Osłoń" |
| Dashed aim line from the picked unit to the pointer, with arrowheads | OG:801-803, 692 | AS: the owner liked it |
| Picks use `onPointerUp` because the card stops clicks | OG:706-709 | AS |
| Legal targets glow and grow; illegal ones do not respond | OG:701, 709 | AS (Offlanes and uncontested units are not legal) |
| Arrow flies, attacker lunges, target shakes with a red flash and "−N" | OG:704-728, 794-799 | CH: "−3", or breaking on a shield |
| Health bars, dead cards with fire and skull | OG:718-735 | NO (a hit lasts one round) |
| Offlane tank shield | OG:712-716 | CH: shows that an Offlane cannot be hit |
| Outcome text, "Ancient −N HP" | OG:740-747, 808-814 | CH: control per objective |
| "Dalej" after a fight; layout measured through `data-bu`, divided by `fit` | OG:645-654, 815-820 | AS |
| Net mode: rival hits one at a time, own hit predicted locally | OG:621-684 | CH: both picks are shown together |
| Fight clocks with reserve; "czas minął" | OG:769-777 | CH: one fight clock for both |
| A 2 s pause shows the moves before the fight | OG:994-1002 | CH: the reveal |
| The finished fight stays 2.2 s on its own timer | OG:970-990 | AS (it fixed stuck fights) |
| Computer hits after 800 ms | OG:686-690 | CH |

## 11. End screen
| Feature | Where | Verdict |
|---|---|---|
| Win: burst and rotating rays; loss: falling ash | OG:827-873 | AS |
| Letters drop in, the screen shakes | OG:847-852 | AS |
| "vs name", final HP with Ancients, "po N turach" | OG:853-864 | CH: rounds; when both Ancients fall, show 0 : 0 with who fell first |
| Online: reason, rating and change | OG:912-925 | AS |
| Rewanż, Nowy rywal, Wyjdź, fading in in turn | OG:866-870 | AS |
| Appears only after the fight and the flyers | OG:1720 | AS |

## 12. Sound and attention (online)
| Feature | Where | Verdict |
|---|---|---|
| Two-note chime (660 then 880 Hz) built with Web Audio; resumes a suspended context | chime.ts:8-28 | CH: when a round starts and when the rival has confirmed |
| Green edge glow for 2.2 s | OG:1538-1543 | AS |
| Tab title blinks "● Twoja tura" | chime.ts:32-42 | CH: "● Twoja runda" |

## 13. Clocks and online play
| Feature | Where | Verdict |
|---|---|---|
| Turn clock with reserve; ∞ mode | OG:885-910 | CH: one plan clock and one fight clock for both |
| Ticks every 250 ms with a server offset | OG:888-889 | AS |
| Resign with confirmation | OG:1576-1581 | AS |
| Away detection and pings | useDuel.ts:35, 93-105 | AS |
| Plan applied locally, sent once | OG:1076-1133 | CH: sent once on "Zatwierdź" |
| Plan survives a refresh (sessionStorage) | OG:1080-1101 | AS |
| Server board ignored while a request is in flight | OG:1083-1085 | AS |
| Several cards in one request | OG:1285 | AS |
| A refused move shows the server's reason | OG:1104-1112 | AS |
| Older views ignored | useDuel.ts:61-68 | AS |

## 14. Onboarding
| Feature | Where | Verdict |
|---|---|---|
| Guided tour with spotlight | Tour.tsx, OG:937-946 | NO in the match (the first match teaches); keep the component for elsewhere |
| One-time hints | OG:1437-1462, Hint.tsx | NO in the match (section 6 of the design) |
| Scripted tutorial with a coach | OG:1467-1525, tutorial.ts | NO: replaced by `first-match.ts` (WP-56) |
| Refusal notes clear after max(2.6 s, 55 ms × length) | OG:1251 | AS |
| Refusals pulse the hand | OG:1378 | AS |

## 15. Misc
| Feature | Where | Verdict |
|---|---|---|
| Bug report with full state | ReportBug, OG:1590-1596 | AS |
| Back and exit | OG:1547-1550 | AS |
| Level picker | Home.tsx:242 | CH: Łatwy, Średni, Trudny (`ai/levels.ts`) |
| Rematch keeps the rival deck and level | OG:1054-1057 | AS |
| Match stays mounted when hidden | Home.tsx:521-526 | AS |
| Small-screen notice below 900 px | CardLab.tsx:233, 247 | NO: the phone layout replaces it (design section 4.9) |
| 1920×900 stage scaled uniformly (`FitStage`, `FitScaleCtx`) | CardLab.tsx:24-42 | CH: desktop only; the phone layout is its own |
| Accessibility: labels on icon buttons only, no keyboard play | | Room to improve |

## Constants and tokens
- Colours: background `#0c0e13`, line `rgba(255,255,255,.10)`, text `#ece9e3`, muted `rgba(236,233,227,.6)`; me `#4fd17b`, rival `#ff5d55`, points `#f2c94c`, warn `#ffb347`, smoke `#b48cff`, positive `#5fd38d`, negative `#ff6b6b`, High Ground `#6fb7ff`, team `#7fd3ff`, wound `#ff7a6b`, team of the round `#5ef0ff`; accent = tournament `C.primary`. OG:53-56, 71-72, 116.
- Card: hand 112 px, board 60-140 px, height = width × 1.34, scale k = w/110, radius 12k.
- Flip 350 ms delay, 1.55× or 190 px, 46 px rise, 0.45 s. Drag 9 px threshold, ±14° tilt, 1.06 scale, 220 ms spring-back.
- Layout: top HUD 64 px, bottom HUD 214 px, ScoreRace 780 px, round button 124 px, gems 20 px.
- Timings: gem blink 1100 ms; banner 1900/1150 ms; computer move 900 ms; hit 750 ms (420 ms online); reveal 2000 ms; outro 2200 ms; edge glow 2200 ms; title blink 900 ms; settle 700 ms.
- Storage: `karty:tour-seen`, `karty:hints`, `card-duel:<id>:plan`, `card-lab:intro-seen`.
- Layers: banner 30, edge glow 35, flyers 40, log 55, end 60, battle 95, ghost 100, hint 150, coach 160, tour 200, pulse 300.

## Easily missed
1. The drag ghost lives outside the scaled stage; every `getBoundingClientRect` is divided by `fit`.
2. Drag position is written by rAF straight to the DOM.
3. Drops are found by `elementsFromPoint` + `data-drop`, so overlays never swallow them.
4. Battle picks use `onPointerUp` because the card's `onClick` stops propagation.
5. Dropped units do not slide twice (`settled`).
6. Flyers wait for the fight to close; `owed` stops the score bar from running ahead.
7. Every automatic step waits for scene, flyers, banner, log, tour and coach; missing one desynchronises the screen.
8. `autoKey` de-duplicates automatic steps; `endSent` stops a double end; timeouts re-check the turn.
9. The online fight timer has its own effect so re-renders cannot cancel it (two past stuck-fight bugs).
10. The server's board is ignored while a plan or request is in flight.
11. Gems blink on one clock; badges on the back face are hidden so they don't show through mirrored.
12. `backfaceVisibility` needs the WebKit prefix; no backdrop blur in the battle.
13. Hints and tour re-measure every 250-400 ms because the stage animates.
14. Window events `card-lab:flip` and `card-lab:hit` drive the tutorial.
15. Storage access is wrapped in try/catch (private mode).
16. The hand's `layoutId` `0:cardId` matches the unit uid `side:cardId`; that is the hand-to-board slide.

## The ten features players would miss most
1. The hover flip of any card, with the ability and the strength parts.
2. Selecting several cards or units, then one tap to send.
3. Drag with grab offset, tilt, ghost and spring-back.
4. Target pills with the own previewed strength and the cost in gems.
5. Greyed illegal targets with the reason on them.
6. Refusal notes that say why a click did nothing.
7. Order gems that blink for what is about to be spent.
8. Points flying to the Ancient and the draining score bar.
9. Arena backgrounds, objective models and ownership glows.
10. The chime, edge glow and tab blink online, and the combat log with card tooltips.
