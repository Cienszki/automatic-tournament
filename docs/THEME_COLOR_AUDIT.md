# Theme colour audit (planned, not started)

Agreed 2026-10-01. Do later, after the home-page layout work.

## Problem

Organizers can set plenty of colours in **Admin → General → "Branding i kolory"**
(main, secondary, accent, glow, heading, five text-hierarchy levels, page
background, cards, text, borders, navbar, navbar text). Many public components
ignore them and hard-code colours from the original PDL/Letnia styling, so a
tournament with its own palette ends up with mismatched pieces.

A rough count (hex values plus Tailwind palette classes such as `text-red-500`)
found ~740 hard-coded colours in ~90 non-admin components. Largest:
`pdl/my-team/PDLStandinRequest` (48), `app/home/InfoWidgets` (54),
`pdl/my-team/PDLTransferSection` (36), `tournament/TeamsView` (25),
`pdl/MatchCard` (21), `pdl/TeamCard` (20), `playoffs/SeasonPointsTable` (17),
`pdl/my-team/PDLSeasonProgress` (17), `divisions/TeamComparisonTool` (17).
The `PlayoffBracketDisplay-old/-backup/-new` files are probably dead; check and
delete instead of converting them.

## How it should work

Every hard-coded colour falls into one of three groups:

1. **Brand.** Anything that is "our colour" decoratively: buttons, highlights,
   active states, accent bars, glows, gradients, borders. **Must come from the
   theme** (`theme.primaryColor` etc. or the `--tournament-*` CSS variables).
2. **Meaning.** Colours that carry information and must stay the same in every
   tournament: win green / loss red / draw grey, warning amber, error red,
   live/online indicators. **Stay hard-coded**, but define them once (a small
   shared palette) instead of repeating `text-green-500` in each file.
3. **Third-party brands.** Discord `#5865F2`, YouTube `#FF0000`, Twitch purple
   and similar. **Stay hard-coded on purpose.** Recognisability matters more
   than matching the tournament.

## Steps

1. Classify every hit into the three groups above (list per file).
2. Convert group 1 to theme values. Prefer the existing fields; reuse the
   `--tournament-*` CSS variables where a component already uses them.
3. Pull group 2 into one shared module of semantic colours.
4. Where a brand role has no matching admin field (e.g. a secondary/outline
   button colour), add the field to `TournamentTheme`, the admin picker, and a
   sensible default derived from `primaryColor`.
5. Test with a deliberately unusual palette (e.g. green primary on a light
   background) and click through every public page.

## Known spots

- Home hero main CTA and the subtitle's accent bar already use
  `theme.primaryColor`. For PDL, "Kolor główny" is currently a dark crimson,
  while the logo is a bright red. That's a settings choice, not a code bug.
- `FullScreenHomePage` falls back to `#8B1538` when no primary colour is set.
  Decide whether a platform-neutral default would suit new tournaments better.
