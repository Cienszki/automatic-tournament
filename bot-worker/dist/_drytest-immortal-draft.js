"use strict";
// Immortal Draft, end to end short of a real lobby: settings → create options →
// node-dota2's option filter → the actual protobuf that goes to the GC.
//
// The field is `do_player_draft` (53) — Valve's internal name for Immortal
// Draft is "player draft", which is why searching the protos for "immortal"
// finds nothing. It needs three things to line up, and each one fails silently
// on its own, so all three are checked here:
//
//   1. Dockerfile Fix 4 adds the field to CMsgPracticeLobbySetDetails.
//   2. proto-patch.js whitelists it on Dota2._lobbyOptions — but only if (1)
//      really applied, because building the message with a field the schema
//      lacks THROWS, and every tournament lobby goes through the same message.
//   3. dota-client.js only sets it when asked.
//
// Usage: node dist/_drytest-immortal-draft.js
// Locally, apply the same patch the Dockerfile does first, or check 1 fails:
//   node -e "...see Dockerfile Fix 4..."

require('./inhouse/proto-patch.js');
const Dota2 = require('dota2');
const { toInhouseLobbySettings } = require('./inhouse/lobby-settings.js');
const { DEFAULT_SETTINGS } = require('./inhouse/core/settings.js');

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`);
}

const schemaHasField = (() => {
  try {
    new Dota2.schema.CMsgPracticeLobbySetDetails({ do_player_draft: true });
    return true;
  } catch {
    return false;
  }
})();

console.log(`\nSchema has do_player_draft: ${schemaHasField}`);
if (!schemaHasField) {
  console.log('  → the Dockerfile proto patch has not been applied to this tree.');
  console.log('  → Checking only that this degrades safely rather than breaking lobby creation.');
  check('whitelist left alone (an unpatched schema must not be offered the field)',
    Dota2._lobbyOptions.do_player_draft, undefined);

  // The property that actually matters: a create that asks for Immortal Draft
  // on an unpatched build must produce an ordinary lobby, not an exception —
  // every tournament lobby is built through this same message.
  let threw = null;
  let carried = 'n/a';
  try {
    const details = new Dota2.schema.CMsgPracticeLobbySetDetails(
      Dota2._parseOptions({ game_name: 'x', pass_key: '1', do_player_draft: true }, Dota2._lobbyOptions)
    );
    carried = details.do_player_draft;
  } catch (e) {
    threw = e.message;
  }
  check('create still builds', threw, null);
  // `undefined` here, `null` on a patched schema — either way, not sent.
  check('the option is simply dropped', carried !== true, true);

  console.log(failures === 0 ? '\nDEGRADES SAFELY' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

console.log('\n1. Settings mapping');
const off = toInhouseLobbySettings({ ...DEFAULT_SETTINGS, immortalDraft: false }, true);
const on = toInhouseLobbySettings({ ...DEFAULT_SETTINGS, immortalDraft: true }, true);
check('off → field omitted entirely', 'doPlayerDraft' in off, false);
check('on  → doPlayerDraft true', on.doPlayerDraft, true);

console.log('\n2. Whitelist patch');
check('do_player_draft whitelisted', Dota2._lobbyOptions.do_player_draft, 'boolean');
check('visibility still whitelisted', Dota2._lobbyOptions.visibility, 'number');

console.log('\n3. The message node-dota2 actually builds');
// Mirrors createPracticeLobby: filter through the whitelist, then build the proto.
const filtered = Dota2._parseOptions(
  { game_name: 'test', pass_key: '1234', game_mode: 22, do_player_draft: true },
  Dota2._lobbyOptions
);
check('survives the option filter', filtered.do_player_draft, true);

const details = new Dota2.schema.CMsgPracticeLobbySetDetails(filtered);
check('encodes onto the message', details.do_player_draft, true);
const roundTripped = Dota2.schema.CMsgPracticeLobbySetDetails.decode(details.toBuffer());
check('survives a wire round-trip', roundTripped.do_player_draft, true);

console.log('\n4. A lobby that did not ask for it must not carry it');
const plain = new Dota2.schema.CMsgPracticeLobbySetDetails(
  Dota2._parseOptions({ game_name: 'tournament', pass_key: '1', game_mode: 2 }, Dota2._lobbyOptions)
);
check('absent on an ordinary lobby', plain.do_player_draft, null);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
