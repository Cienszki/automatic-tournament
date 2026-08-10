// src/inhouse/proto-patch.ts
//
// node-dota2's createPracticeLobby/configPracticeLobby filter every option
// through Dota2._lobbyOptions (a key whitelist) before building
// CMsgPracticeLobbySetDetails — see dota-client.js:66-88, which already
// patches this same whitelist for `selection_priority_rules` and the draft
// penalty fields. That whitelist has never included `visibility` (confirmed:
// zero matches for "visibility" in node_modules/dota2/handlers/lobbies.js),
// even though dota-client.js's own createLobby() unconditionally builds
// `visibility: options.visibility` into the outgoing options
// (dota-client.js:373). The field is silently dropped before it reaches the
// GC, so every lobby is created Public regardless of what's requested.
//
// This has never been hit on the tournament path — tournament lobbies are
// always LOBBY_VISIBILITY.unlisted and nobody varies it — but it is load
// bearing for inhouses: an unpublished lobby that's actually Public defeats
// the whole "host chooses who hears about it first" invariant.
//
// Patching the shared `dota2` module object is idempotent and safe regardless
// of load order or how many times this runs — see the identical reasoning in
// dota-client.js's own patch block, which this mirrors.
//
// Import this before anything calls DotaClient.createLobby()/updateSeriesScore-
// equivalent — conventionally the first line of inhouse-runner.ts, for the same
// reason dota-client.js patches itself at module-load time rather than lazily.

import { logger } from '../logger';

export function patchLobbyVisibilityWhitelist(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dota2mod = require('dota2') as { _lobbyOptions?: Record<string, string> };
    if (dota2mod._lobbyOptions && dota2mod._lobbyOptions.visibility === undefined) {
      dota2mod._lobbyOptions.visibility = 'number';
      logger.info('[InhouseRunner] Patched dota2 _lobbyOptions to allow visibility (public/unlisted)');
    }
  } catch (e) {
    logger.warn('[InhouseRunner] Could not patch dota2 _lobbyOptions for visibility', e);
  }
}

patchLobbyVisibilityWhitelist();
