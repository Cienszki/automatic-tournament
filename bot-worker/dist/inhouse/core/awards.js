"use strict";
// packages/core/src/awards.ts
// Silly awards (§10) — generated per match from parsed replay data.
//
// Hard rule: **never awarded for good play.** Every entry here is either
// self-deprecating or neutral. The pool is large and rotating so nobody can
// farm one, and `selectAwards` never emits the same award twice in a match.
//
// This lives in the shared package because both halves need it: the bot writes
// awards onto the game document during result ingestion, and the website
// renders them on match pages and may re-run selection for a backfilled match.
//
// Every metric here only exists once OpenDota has parsed the replay, which can
// lag a long time and sometimes never happens. Callers must render fine with
// an empty award list.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AWARDS = void 0;
exports.selectAwards = selectAwards;
const n = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const mmss = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};
exports.AWARDS = [
    {
        id: 'couriers_lost',
        emoji: '🐔',
        minimum: 1,
        extract: (p) => n(p.courier_kills_received) ?? n(p.courier_lost),
        render: (name, v) => `🐔  ${name} lost ${v} courier${v === 1 ? '' : 's'}`,
    },
    {
        id: 'time_dead',
        emoji: '⏰',
        minimum: 300,
        extract: (p) => n(p.life_state_dead),
        render: (name, v) => `⏰  ${name} spent ${mmss(v)} dead`,
    },
    {
        id: 'tangos_wasted',
        emoji: '🥭',
        minimum: 10,
        extract: (p) => {
            const bought = n(p.purchase?.tango);
            return bought;
        },
        render: (name, v) => `🥭  ${name} bought ${v} tangos`,
    },
    {
        id: 'roshan_death',
        emoji: '🐗',
        minimum: 1,
        extract: (p) => n(p.killed_by?.npc_dota_roshan),
        render: (name, v) => `🐗  ${name} died to Roshan${v > 1 ? ` ${v} times` : ''}`,
    },
    {
        id: 'creep_death',
        emoji: '🩸',
        minimum: 1,
        extract: (p) => {
            const killedBy = p.killed_by ?? {};
            return Object.entries(killedBy)
                .filter(([k]) => k.includes('creep') || k.includes('neutral'))
                .reduce((sum, [, v]) => sum + (n(v) ?? 0), 0) || null;
        },
        render: (name, v) => `🩸  ${name} was killed by creeps ${v} time${v === 1 ? '' : 's'}`,
    },
    {
        id: 'buybacks',
        emoji: '💸',
        minimum: 2,
        extract: (p) => n(p.buyback_count),
        render: (name, v) => `💸  ${name} bought back ${v} times`,
    },
    {
        id: 'smallest_net_worth',
        emoji: '🪙',
        lowest: true,
        minimum: 0,
        extract: (p) => n(p.total_gold) ?? n(p.net_worth),
        render: (name, v) => `🪙  ${name} finished on ${v.toLocaleString('en-US')} net worth`,
    },
    {
        id: 'fewest_tps',
        emoji: '🚶',
        lowest: true,
        minimum: 0,
        extract: (p) => n(p.item_uses?.tpscroll),
        render: (name, v) => `🚶  ${name} used ${v} TP scroll${v === 1 ? '' : 's'} the whole game`,
    },
    {
        id: 'runes_missed',
        emoji: '💧',
        lowest: true,
        minimum: 0,
        extract: (p) => n(p.rune_pickups),
        render: (name, v) => `💧  ${name} picked up ${v} runes all game`,
    },
    {
        id: 'wards_zero',
        emoji: '👁️',
        lowest: true,
        minimum: 0,
        extract: (p) => n(p.obs_placed),
        render: (name, v) => `👁️  ${name} placed ${v} observer wards`,
    },
    {
        id: 'denies',
        emoji: '🪓',
        minimum: 20,
        extract: (p) => n(p.denies),
        render: (name, v) => `🪓  ${name} denied ${v} creeps and still lost lane`,
    },
    {
        id: 'stuns',
        emoji: '🌀',
        minimum: 60,
        extract: (p) => n(p.stuns),
        render: (name, v) => `🌀  ${name} stunned things for ${Math.round(v)} seconds total`,
    },
];
/**
 * Pick up to `limit` awards for a finished match.
 *
 * Each award goes to at most one player and each player wins at most one award,
 * so a single dominant performance can't sweep the recap. Award order is
 * randomised so the same ones don't always appear first.
 */
function selectAwards(players, limit = 4) {
    const shuffledAwards = [...exports.AWARDS].sort(() => Math.random() - 0.5);
    const usedPlayers = new Set();
    const out = [];
    for (const award of shuffledAwards) {
        if (out.length >= limit)
            break;
        const candidates = players
            .filter((p) => !usedPlayers.has(p.steamId32))
            .map((p) => ({ player: p, value: award.extract(p.data) }))
            .filter((c) => c.value !== null)
            .filter((c) => (award.lowest ? c.value >= award.minimum : c.value >= award.minimum));
        if (!candidates.length)
            continue;
        candidates.sort((a, b) => (award.lowest ? a.value - b.value : b.value - a.value));
        const winner = candidates[0];
        usedPlayers.add(winner.player.steamId32);
        out.push({
            id: award.id,
            steamId32: winner.player.steamId32,
            text: award.render(winner.player.name, winner.value),
        });
    }
    return out;
}
