// Test helper: every difference between two stats datasets, one line each, so a parity test can
// state exactly which differences it expects. Players and matches are compared as sets (their
// order changes nothing the hub derives); games and performances in order.

import { PERF_NUM_FIELDS, type StatsDataset } from '../domain/types';

type Row = Record<string, unknown>;

const show = (v: unknown) => (v === undefined ? 'none' : JSON.stringify(v));

function diffRows(kind: string, ours: Row[], theirs: Row[], out: string[]): void {
  const byId = new Map(theirs.map((r) => [String(r.id), r]));
  const seen = new Set<string>();
  for (const o of ours) {
    const id = String(o.id);
    seen.add(id);
    const t = byId.get(id);
    if (!t) { out.push(`${kind} ${id}: only in ours`); continue; }
    for (const key of new Set([...Object.keys(o), ...Object.keys(t)])) {
      if (JSON.stringify(o[key]) !== JSON.stringify(t[key])) out.push(`${kind} ${id}.${key}: ours ${show(o[key])}, published ${show(t[key])}`);
    }
  }
  for (const t of theirs) if (!seen.has(String(t.id))) out.push(`${kind} ${String(t.id)}: only published`);
}

function diffPerfs(ours: StatsDataset, theirs: StatsDataset, out: string[]): void {
  const key = (ds: StatsDataset, r: StatsDataset['perfs'][number]) => `${ds.games[r[0]].id}/${r[1]}`;
  if (ours.perfs.map((r) => key(ours, r)).join() !== theirs.perfs.map((r) => key(theirs, r)).join()) out.push('perfs: another order or other rows');
  const byKey = new Map(theirs.perfs.map((r) => [key(theirs, r), r]));
  for (const r of ours.perfs) {
    const t = byKey.get(key(ours, r));
    if (!t) continue;
    if (r[2] !== t[2]) out.push(`perf ${key(ours, r)}.teamId: ours ${r[2]}, published ${t[2]}`);
    PERF_NUM_FIELDS.forEach((f, i) => {
      if (r[3 + i] !== t[3 + i]) out.push(`perf ${key(ours, r)}.${f}: ours ${String(r[3 + i])}, published ${String(t[3 + i])}`);
    });
  }
}

export function datasetDifferences(ours: StatsDataset, theirs: StatsDataset): string[] {
  const out: string[] = [];
  if (ours.tournamentId !== theirs.tournamentId) out.push(`tournamentId: ours ${ours.tournamentId}, published ${theirs.tournamentId}`);
  const asRows = (x: unknown) => x as Row[];
  diffRows('team', asRows(ours.teams), asRows(theirs.teams), out);
  diffRows('group', asRows(ours.groups ?? []), asRows(theirs.groups ?? []), out);
  diffRows('player', asRows(ours.players), asRows(theirs.players), out);
  diffRows('match', asRows(ours.matches), asRows(theirs.matches), out);
  if (ours.games.map((g) => g.id).join() !== theirs.games.map((g) => g.id).join()) out.push('games: another order or other games');
  diffRows('game', asRows(ours.games), asRows(theirs.games), out);
  diffPerfs(ours, theirs, out);
  return out;
}

/** Lines grouped by what differs (`match *.round`), with a count, for differences that repeat. */
export function differenceKinds(lines: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) {
    const m = /^(\w+) ([^:]+?)(\.\w+)?: (.*)$/.exec(line);
    const kind = !m ? line : m[3] ? `${m[1]} *${m[3]}` : `${m[1]} *: ${m[4]}`;
    out[kind] = (out[kind] ?? 0) + 1;
  }
  return out;
}
