// Immortal Draft, end to end short of a real lobby (was dist/_drytest-immortal-draft.js):
// settings → create options → node-dota2's option filter → the protobuf sent to the GC.
//
// The field is `do_player_draft` (53); Valve's name for Immortal Draft is "player draft".
// Three things must line up, and each fails silently on its own:
//   1. Dockerfile Fix 4 adds the field to CMsgPracticeLobbySetDetails.
//   2. proto-patch whitelists it on Dota2._lobbyOptions, but only if (1) applied:
//      building the message with a field the schema lacks throws, and every tournament
//      lobby goes through the same message.
//   3. The client only sets it when asked.
//
// Which half runs depends on the installed node_modules. CI and local trees are patched
// like the image by setup-local.js, so the patched half runs there; a tree without Fix 4
// runs the "degrades safely" half instead.

import { describe, expect, it } from 'vitest';
import './proto-patch';
import { toInhouseLobbySettings } from './lobby-settings';
import { DEFAULT_SETTINGS } from './core/settings';

interface Details { do_player_draft?: boolean | null; toBuffer(): Buffer }
interface Dota2Module {
  _lobbyOptions: Record<string, string>;
  _parseOptions(options: Record<string, unknown>, whitelist: Record<string, string>): Record<string, unknown>;
  schema: { CMsgPracticeLobbySetDetails: { new (payload: Record<string, unknown>): Details; decode(buf: Buffer): Details } };
}

// node-dota2 is CommonJS without types; proto-patch patches this same module object.
const Dota2 = require('dota2') as Dota2Module;

const schemaHasField = (() => {
  try {
    new Dota2.schema.CMsgPracticeLobbySetDetails({ do_player_draft: true });
    return true;
  } catch {
    return false;
  }
})();

const build = (options: Record<string, unknown>) =>
  new Dota2.schema.CMsgPracticeLobbySetDetails(Dota2._parseOptions(options, Dota2._lobbyOptions));

describe.skipIf(schemaHasField)('Immortal Draft on an unpatched schema', () => {
  it('leaves the whitelist alone, so the field is never offered', () => {
    expect(Dota2._lobbyOptions.do_player_draft).toBeUndefined();
  });

  it('still builds a lobby that asked for it, as an ordinary lobby', () => {
    let details: Details | undefined;
    expect(() => { details = build({ game_name: 'x', pass_key: '1', do_player_draft: true }); }).not.toThrow();
    expect(details?.do_player_draft).not.toBe(true);
  });
});

describe.runIf(schemaHasField)('Immortal Draft on a patched schema', () => {
  it('maps the setting to doPlayerDraft only when it is on', () => {
    const off = toInhouseLobbySettings({ ...DEFAULT_SETTINGS, immortalDraft: false }, true);
    const on = toInhouseLobbySettings({ ...DEFAULT_SETTINGS, immortalDraft: true }, true);
    expect('doPlayerDraft' in off).toBe(false);
    expect(on.doPlayerDraft).toBe(true);
  });

  it('whitelists do_player_draft, and visibility stays whitelisted', () => {
    expect(Dota2._lobbyOptions.do_player_draft).toBe('boolean');
    expect(Dota2._lobbyOptions.visibility).toBe('number');
  });

  it('carries the field through the filter, onto the message and over the wire', () => {
    const filtered = Dota2._parseOptions({ game_name: 'test', pass_key: '1234', game_mode: 22, do_player_draft: true }, Dota2._lobbyOptions);
    expect(filtered.do_player_draft).toBe(true);
    const details = new Dota2.schema.CMsgPracticeLobbySetDetails(filtered);
    expect(details.do_player_draft).toBe(true);
    expect(Dota2.schema.CMsgPracticeLobbySetDetails.decode(details.toBuffer()).do_player_draft).toBe(true);
  });

  it('leaves it off a lobby that did not ask for it', () => {
    expect(build({ game_name: 'tournament', pass_key: '1', game_mode: 2 }).do_player_draft).toBeNull();
  });
});
