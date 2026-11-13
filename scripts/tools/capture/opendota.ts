// Record OpenDota match responses for games in the fixtures, as test input for the result
// import (WP-13b). Public match data, read by public match id; nothing about the site is sent.
//
//   npx tsx scripts/tools/capture/opendota.ts --out fixtures/opendota fixtures/exports/pdl-s2 fixtures/exports/wiosenna
//
// It picks games of each kind WP-12 names (a normal parsed game, an unparsed one, one with a
// stand-in, a playoff game; the lobby type tells which are practice lobbies), fetches each
// once, at most one request every 1.5 s (OpenDota's free limit is 60 a minute), and writes
// `<match id>.json` (the response, unchanged) and `index.json` (why each was chosen).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { docId, readKindSync, readManifest } from './lib/format';
import { sleep } from './lib/rest';

interface Pick { matchId: string; fixture: string; matchDoc: string; why: string }

/** Per game: does it have performances, and do they look parsed (wards and stacks counted). */
function gamesOf(dir: string) {
  const perfs = readKindSync(dir, 'matches.games.performances');
  const byGame = new Map<string, { n: number; parsedSignal: number }>();
  for (const p of perfs) {
    const gid = p.path.split('/').slice(-3)[0];
    const e = byGame.get(gid) ?? { n: 0, parsedSignal: 0 };
    e.n++;
    e.parsedSignal += Number(p.data.obsPlaced ?? 0) + Number(p.data.campsStacked ?? 0) + Number(p.data.runesPickedUp ?? 0);
    byGame.set(gid, e);
  }
  const matches = new Map(readKindSync(dir, 'matches').map(r => [docId(r.path), r.data]));
  return readKindSync(dir, 'matches.games')
    .filter(g => /^\d{9,12}$/.test(docId(g.path)) && !g.data.is_forfeit)
    .map(g => {
      const matchDoc = g.path.split('/').slice(-3)[0];
      const m = matches.get(matchDoc) ?? {};
      const p = byGame.get(docId(g.path));
      return {
        id: docId(g.path), matchDoc, start: Number(g.data.start_time ?? 0),
        hasPerfs: !!p, parsed: !!p && p.parsedSignal > 0,
        standin: !!m.approvedStandins && Object.keys(m.approvedStandins as object).length > 0,
        playoff: !!m.isPlayoff || !!m.playoffMatchId || !!m.playoff_match_id,
      };
    })
    .sort((a, b) => a.start - b.start);
}

export function choose(fixtures: string[]): Pick[] {
  const picks: Pick[] = [];
  const taken = new Set<string>();
  const take = (fixture: string, g: { id: string; matchDoc: string } | undefined, why: string) => {
    if (!g || taken.has(g.id)) return;
    taken.add(g.id);
    picks.push({ matchId: g.id, fixture, matchDoc: g.matchDoc, why });
  };
  for (const dir of fixtures) {
    const slug = readManifest(dir).slug;
    const games = gamesOf(dir);
    take(slug, games.find(g => g.parsed && !g.standin && !g.playoff), 'normal parsed game');
    take(slug, games.filter(g => g.parsed && !g.standin && !g.playoff).pop(), 'normal parsed game, late in the season');
    take(slug, games.find(g => g.hasPerfs && !g.parsed), 'unparsed game: performances without parsed-only numbers');
    take(slug, games.find(g => !g.hasPerfs), 'game with no performances stored');
    take(slug, games.find(g => g.standin), 'game in a match with an approved stand-in');
    take(slug, games.find(g => g.playoff), 'playoff game');
  }
  return picks.slice(0, 10);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const outAt = argv.indexOf('--out');
  if (outAt < 0) throw new Error('Usage: opendota.ts --out <folder> <fixture>...');
  const out = argv[outAt + 1];
  const fixtures = argv.filter((_, i) => i !== outAt && i !== outAt + 1);
  mkdirSync(out, { recursive: true });
  const picks = choose(fixtures);
  const index: Array<Pick & { status: number; lobbyType: number | null; leagueId: number | null; parsedByOpenDota: boolean; bytes: number }> = [];
  for (const p of picks) {
    const file = join(out, `${p.matchId}.json`);
    let text: string;
    let status = 200;
    if (existsSync(file)) {
      text = readFileSync(file, 'utf8');
    } else {
      await sleep(1500);
      const res = await fetch(`https://api.opendota.com/api/matches/${p.matchId}`, { headers: { Accept: 'application/json' } });
      status = res.status;
      if (res.status === 429) throw new Error('OpenDota answered 429; stopping');
      text = await res.text();
      if (res.ok) writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
    }
    const body = status === 200 ? (JSON.parse(text) as Record<string, unknown>) : {};
    index.push({
      ...p, status,
      lobbyType: typeof body.lobby_type === 'number' ? body.lobby_type : null,
      leagueId: typeof body.leagueid === 'number' ? body.leagueid : null,
      parsedByOpenDota: Array.isArray(body.players) && (body.players as Array<Record<string, unknown>>).some(x => x.obs_placed != null || x.purchase_log != null),
      bytes: Buffer.byteLength(text),
    });
    console.log(`${p.matchId} ${status} ${p.why} (${p.fixture})`);
  }
  writeFileSync(join(out, 'index.json'), `${JSON.stringify({ source: 'https://api.opendota.com/api/matches/{id}', recordedAt: new Date().toISOString(), matches: index }, null, 1)}\n`);
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
