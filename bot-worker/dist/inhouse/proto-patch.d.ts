export declare function patchLobbyVisibilityWhitelist(): void;
/**
 * Same whitelist, for Immortal Draft — `do_player_draft` (field 53).
 *
 * Unlike `visibility`, this one is only safe once the *schema* has the field
 * too, which is a Dockerfile patch (Fix 4): protobufjs throws
 * "#do_player_draft is not a field" when a message is built with a field the
 * schema doesn't know, and createPracticeLobby builds every lobby through this
 * same message — including tournament lobbies. Whitelisting an unpatched schema
 * would therefore break lobby creation for the whole bot, not just inhouses.
 *
 * So the schema is asked first, by construction, and a failed check leaves the
 * whitelist alone: Immortal Draft silently degrades to a normal lobby, exactly
 * as it does today, and nothing else changes.
 */
export declare function patchPlayerDraftWhitelist(): void;
