"use strict";
// src/inhouse/link-codes.ts
// One-time codes for the in-lobby `!link` flow (§3).
//
// The bot already knows the Steam ID of whoever typed `!link`, so the code only
// has to prove "the person entering this on the website is the person who typed
// it in the lobby". A short code is fine for that: it's single-use, short-lived,
// and the worst case for a guessed code is that someone links a Steam account
// they don't own to their own Discord — which costs them their own stats and
// nothing else.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LINK_CODE_TTL_SECONDS = void 0;
exports.generateCode = generateCode;
exports.issueLinkCode = issueLinkCode;
/**
 * Unambiguous alphabet: no O/0, I/1, or S/5. People read these off a Dota chat
 * line and type them into a browser, often on a phone.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRTUVWXYZ';
const CODE_LENGTH = 4;
/** Codes expire quickly — the player is meant to use it during this lobby. */
exports.LINK_CODE_TTL_SECONDS = 15 * 60;
function generateCode(length = CODE_LENGTH) {
    let out = '';
    for (let i = 0; i < length; i++) {
        out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return out;
}
/**
 * Issue a code for a Steam ID, retrying on collision.
 *
 * With a 31-character alphabet and 4 places there are ~920k codes; collisions
 * against the small set of live codes are vanishingly rare, but a collision
 * would hand one player's link to another, so it is checked rather than assumed.
 */
async function issueLinkCode(store, steamId32, playerName) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const created = await store.createLinkCodeIfAbsent({
            code,
            steamId32,
            playerName,
            ttlSeconds: exports.LINK_CODE_TTL_SECONDS,
        });
        if (created)
            return code;
    }
    // Fall back to a longer code rather than failing the player's request.
    const code = generateCode(6);
    await store.createLinkCode({ code, steamId32, playerName, ttlSeconds: exports.LINK_CODE_TTL_SECONDS });
    return code;
}
