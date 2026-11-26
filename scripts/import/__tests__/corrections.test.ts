// @vitest-environment node
// The owner corrections as data (owner-corrections.json, corrections.ts), and the Letnia ones on
// the reduced Letnia fixture: four lower-bracket matches played as best of three, and a game whose
// labels name two teams that did not play it.

import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import * as s from '@/platform/db/schema';
import { correctionsFileSchema, OWNER_CORRECTIONS } from '../corrections';
import { MatchLabels } from '../labels';
import { mapCapture } from '../map';
import { readCapture } from '../run';

const ROOT = join(__dirname, '..', '..', '..');
const LETNIA = join(ROOT, 'fixtures', 'import', 'letnia');
const mapLetnia = (dir = LETNIA) => mapCapture(readCapture(dir), null, { anonymize: false }, new Map());

describe('the owner corrections file', () => {
  it('holds every correction of STATUS.md questions 43 and 44, each with ids, a label, a reason and a source', () => {
    const byKind = (kind: string, tournament?: string) => OWNER_CORRECTIONS.filter((c) => c.kind === kind && (!tournament || ('tournament' in c && c.tournament === tournament))).length;
    expect({ wiosennaMatches: byKind('match', 'wiosenna'), wiosennaGames: byKind('game', 'wiosenna'), letnia: byKind('match', 'letnia'), pdl: byKind('match', 'pdl') })
      .toEqual({ wiosennaMatches: 3, wiosennaGames: 2, letnia: 4, pdl: 2 });
    expect({ steam: byKind('roster-steam'), standins: byKind('standin'), members: byKind('member'), players: byKind('player') })
      .toEqual({ steam: 4, standins: 6, members: 1, players: 1 });
    for (const c of OWNER_CORRECTIONS) expect(c.source).toMatch(/2026-11-2\d/);
  });

  it('names each tournament as the import\'s findings do', () => {
    const names = {
      letnia: new MatchLabels(mapLetnia().rows, 'letnia').match('KdDxXJ3e06yYYzED7cQ2').split(',')[0],
      wiosenna: new MatchLabels(mapCapture(readCapture(join(ROOT, 'fixtures', 'exports', 'wiosenna')), null, { anonymize: false }, new Map()).rows, 'wiosenna').match('HVwwRd87bSFsCzkph25p').split(',')[0],
      pdl: 'POLISH DOTA2 LEAGUE Season 1',
    };
    expect(names).toEqual({ letnia: 'Letnia Batalia', wiosenna: 'Wiosenna Furia', pdl: 'POLISH DOTA2 LEAGUE Season 1' });
    for (const c of OWNER_CORRECTIONS) {
      if (c.kind === 'player') continue;
      expect({ id: c.id, starts: c.label.startsWith(`${names[c.tournament as keyof typeof names]}, `) }).toEqual({ id: c.id, starts: true });
    }
  });

  it('refuses an entry without a readable label, and a repeated id', () => {
    const entry = { id: 'x-y', kind: 'game', tournament: 'w', dotaMatchId: 1, matchId: 'a', notMatchId: 'b', label: 'Wiosenna, game 3', reason: 'because', source: 'owner, today' };
    expect(correctionsFileSchema.safeParse({ corrections: [entry] }).success).toBe(true);
    expect(correctionsFileSchema.safeParse({ corrections: [{ ...entry, label: 'b' }] }).success).toBe(false);
    expect(correctionsFileSchema.safeParse({ corrections: [entry, entry] }).success).toBe(false);
    expect(correctionsFileSchema.safeParse({ corrections: [{ ...entry, extra: 1 }] }).success).toBe(false);
  });
});

describe('the Letnia corrections on the reduced fixture', () => {
  const m = mapLetnia();
  const matches = m.rows.get(s.matches);

  it('store the four lower-bracket round-one matches as best of three, so none has more games than its format', () => {
    const lb = matches.filter((r) => /^lb-r1-m[1-4]$/.test(String(r.code))).map((r) => [r.code, r.bestOf, `${String(r.scoreA)}:${String(r.scoreB)}`]).sort();
    expect(lb).toEqual([['lb-r1-m1', 3, '2:0'], ['lb-r1-m2', 3, '0:2'], ['lb-r1-m3', 3, '2:0'], ['lb-r1-m4', 3, '2:0']]);
    expect(m.ctx.findings.filter((f) => f.reason.startsWith('the match has more games than its series length'))).toEqual([]);
    expect(m.state.corrections.finish().map((o) => o.status)).toEqual(['applied', 'applied', 'applied', 'applied']);
  });
});

describe('a game whose labels name two teams that did not play it (Letnia, 25 August 2025, game 8433022489)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'letnia-teams-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(LETNIA, join(dir, 'letnia'), { recursive: true });
  const capture = join(dir, 'letnia');
  // The reduced fixture keeps no performances for this game: add ten, the players of the two teams
  // that played it (Kępski Kryształ on Radiant, Ja w sprawie pumy on Dire, as on OpenDota).
  const lines = (file: string) => readFileSync(join(capture, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { path: string; data: Record<string, unknown> });
  const game = lines('matches.games.jsonl').find((g) => g.path.endsWith('/8433022489'))!;
  const picks = (game.data.picksBans as Array<{ hero_id: number; is_pick: boolean; team: number }>).filter((p) => p.is_pick);
  const roster = (team: string) => lines('teams.players.jsonl').filter((p) => p.path.startsWith(`teams/${team}/`)).slice(0, 5).map((p) => p.path.split('/').pop()!);
  const added = [
    ...roster('sNjbhJNDTBhhijMMxN7Y').map((id, i) => ({ id, team: 'sNjbhJNDTBhhijMMxN7Y', hero: picks.filter((p) => p.team === 0)[i].hero_id })),
    ...roster('kutPIkCyWUTRi0mjLnzJ').map((id, i) => ({ id, team: 'kutPIkCyWUTRi0mjLnzJ', hero: picks.filter((p) => p.team === 1)[i].hero_id })),
  ];
  appendFileSync(join(capture, 'matches.games.performances.jsonl'), added.map((p) => JSON.stringify({
    path: `${game.path}/performances/${p.id}`, data: { playerId: p.id, teamId: p.team, heroId: p.hero, kills: 1 },
  })).join('\n') + '\n');
  const manifestFile = join(capture, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  manifest.collections['matches.games.performances'].documents += added.length;
  writeFileSync(manifestFile, JSON.stringify(manifest));
  const m = mapLetnia(capture);

  it('takes its teams from the players, so the stored 2:0 agrees with the games', () => {
    expect(m.rows.get(s.games).find((g) => g.id === '8433022489')).toMatchObject({ radiantTeamId: 'sNjbhJNDTBhhijMMxN7Y', direTeamId: 'kutPIkCyWUTRi0mjLnzJ', radiantWin: false });
    expect(m.ctx.findings.filter((f) => f.reason.startsWith('the stored score disagrees'))).toEqual([]);
  });

  it('reports the disagreement with the labels, naming the game readably', () => {
    const [f] = m.ctx.findings.filter((x) => x.reason.startsWith('the players of a game are of other teams than its stored labels'));
    expect(new MatchLabels(m.rows, 'letnia').game(f.about!.matchId, f.about!.game!))
      .toBe('Letnia Batalia, Grupa Foczek, 25 August 2025, Ja w sprawie pumy vs Kępski Kryształ, 2:0, game 2 (Dota 8433022489 at 18:57; match 3nsXHgbRZNL2Bo3w6R18)');
  });

  it('without the players, keeps the labels and flags the score, as before', () => {
    const plain = mapLetnia();
    expect(plain.ctx.findings.filter((f) => f.reason.startsWith('the stored score disagrees')).map((f) => f.ref)).toEqual(['3nsXHgbRZNL2Bo3w6R18 2:0 vs games 1:0']);
  });
});
