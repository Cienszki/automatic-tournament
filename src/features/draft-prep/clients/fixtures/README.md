# Response fixtures for the draft-prep clients

Responses in the exact shape OpenDota's `/players/{id}/matches` (with the fields the client projects) and STRATZ's player-matches GraphQL query return. The network could not be reached when they were written (2026-11-23), so they were not captured live: the league game `9077734536` copies its values from the recorded match in `fixtures/opendota/`, and the other entries were written by hand to cover the cases the code must handle (Dire and Radiant wins, Turbo and Ability Draft, an abandoned game with no winner, a missing hero, a `null` entry, a missing lane, a string id from STRATZ, a game with no player row).

When the network is available, replace them with captured responses of a few real accounts and keep the same cases.
