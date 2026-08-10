"use strict";
// src/inhouse/types.ts
// Shared domain types for the inhouse system.
//
// These are used by BOTH processes:
//   - the lobby worker (src/index.ts)   — executes Dota 2 GC operations
//   - the Discord gateway (src/discord/) — renders panels and cards
//
// Firestore is the shared state store between them. Every type here maps to a
// document shape described in docs/inhouse-data-model.md.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAYING_SIDES = exports.TERMINAL_STATES = exports.ACCOUNT_HOLDING_STATES = void 0;
exports.isTerminal = isTerminal;
/** States in which the game still occupies a leased Steam account. */
exports.ACCOUNT_HOLDING_STATES = [
    'lobby_creating',
    'open',
    'ready',
    'in_progress',
];
/** States from which no further transition is possible. */
exports.TERMINAL_STATES = [
    'finished',
    'cancelled',
    'expired',
    'abandoned',
    'failed',
];
function isTerminal(state) {
    return exports.TERMINAL_STATES.includes(state);
}
/** Sides that count as "going to play" for slot accounting (§7.1). */
exports.PLAYING_SIDES = ['radiant', 'dire', 'unassigned'];
