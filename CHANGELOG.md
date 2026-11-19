# Changelog

All notable changes to the website are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Caster corner at `/[slug]/caster`, and requests for the caster role that admins approve.
- Every caster of a tournament is told about new and moved match times ("Mecze do castowania"), not only the casters already assigned to the match.
- Every notification can turn its kind off: a "Wyłącz takie powiadomienia" button in Discord messages, and a bell-off button on each item in the bell. Turned-off kinds are listed in the bell's settings with "Włącz".

### Fixed

- Steam profile links resolve without the Steam API key (public profile page as a fallback), so a revoked key no longer breaks the lobby whitelist or saves standins with an empty Steam id, which got them kicked from bot lobbies.
- A standin can no longer be approved without a readable Steam account.
- Match sync names the cause when Steam rejects the API key, instead of a raw 403.
- Error toasts stay 20 seconds and have a "Kopiuj" button.
