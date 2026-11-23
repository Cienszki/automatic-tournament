// Short "facts" for the hub pages (#31–#37): each one is a headline number with who/what it is
// about and which full page explains it. Pure data, no React.
import type { GameX, Model, PlayerX, TeamX } from './derive';
import { opponentOf, rankPlayers, topPerfs } from './derive';
import { fmtClock, metric, type MetricKey } from './metrics';
import { heroName } from './heroes';
import { BINGO_EVENTS, hitName } from './bingo';
import { computeAchievements, collectorRanking } from './achievements';
import { count, plural } from '@/lib/plural';

export interface Fact {
  id: string;
  /** Full page that explains it (stats-redesign-N) */
  page: number;
  kicker: string;
  big: string;
  title: string;
  sub?: string;
  heroId?: number;
  player?: PlayerX;
  team?: TeamX;
  tone?: 'brag' | 'roast';
}

const sum = (g: GameX, radiant: boolean, f: (p: GameX['perfs'][number]) => number) => g.perfs.filter(p => p.radiant === radiant).reduce((s, p) => s + f(p), 0);

export function eloTable(model: Model) {
  const r = new Map(model.teams.map(t => [t.id, 1500]));
  for (const g of model.games) {
    const a = r.get(g.radiant) ?? 1500; const b = r.get(g.dire) ?? 1500;
    const e = 1 / (1 + Math.pow(10, (b - a) / 400)); const s = g.radiantWin ? 1 : 0;
    r.set(g.radiant, a + 32 * (s - e)); r.set(g.dire, b + 32 * ((1 - s) - (1 - e)));
  }
  return model.teams.map(t => ({ t, v: r.get(t.id) ?? 1500 })).sort((x, y) => y.v - x.v);
}

export function buildFacts(model: Model): Fact[] {
  const f: Fact[] = [];
  const recordKeys: MetricKey[] = ['kills', 'assists', 'gpm', 'xpm', 'heroDamage', 'lastHits', 'wards', 'stacks', 'netWorth', 'score'];
  for (const k of recordKeys) {
    const p = topPerfs(model, k, 1)[0];
    if (!p?.player) continue;
    const m = metric(k);
    f.push({ id: `rec-${k}`, page: 1, kicker: `Rekord · ${m.label}`, big: m.fmt(m.get(p)), title: p.player.name, sub: `${heroName(p.heroId)} vs ${opponentOf(p)?.name ?? '?'}`, heroId: p.heroId, player: p.player, team: p.team, tone: 'brag' });
  }
  const mvp = rankPlayers(model, 'score', 'avg')[0];
  if (mvp) f.push({ id: 'mvp', page: 2, kicker: 'MVP turnieju', big: mvp.value.toFixed(1), title: mvp.player.name, sub: `punktu fantasy na grę · ${count(mvp.player.games, 'gra', 'gry', 'gier')}`, heroId: mvp.player.heroes[0]?.heroId, player: mvp.player, team: mvp.player.team, tone: 'brag' });
  const hero = model.heroes[0];
  if (hero) f.push({ id: 'hero', page: 3, kicker: 'Bohater turnieju', big: `${hero.contest}×`, title: heroName(hero.heroId), sub: `w drafcie · ${hero.picks} pick · ${hero.bans} ban · ${Math.round(hero.wr * 100)}% wygranych`, heroId: hero.heroId });
  const longest = [...model.games].sort((a, b) => b.duration - a.duration)[0];
  if (longest) f.push({ id: 'long', page: 6, kicker: 'Najdłuższa gra', big: fmtClock(longest.duration), title: `${longest.radiantTeam?.name} vs ${longest.direTeam?.name}`, heroId: longest.mvp?.heroId, team: longest.radiantWin ? longest.radiantTeam : longest.direTeam });
  const fastest = [...model.games].sort((a, b) => a.duration - b.duration)[0];
  if (fastest) f.push({ id: 'fast', page: 14, kicker: 'Najszybsza wygrana', big: fmtClock(fastest.duration), title: (fastest.radiantWin ? fastest.radiantTeam : fastest.direTeam)?.name ?? '', sub: `vs ${(fastest.radiantWin ? fastest.direTeam : fastest.radiantTeam)?.name}`, heroId: fastest.mvp?.heroId, team: fastest.radiantWin ? fastest.radiantTeam : fastest.direTeam, tone: 'brag' });
  const bloody = [...model.games].sort((a, b) => b.kills - a.kills)[0];
  if (bloody) f.push({ id: 'blood', page: 6, kicker: 'Najkrwawsza gra', big: `${bloody.kills}`, title: 'zabójstw w jednej grze', sub: `${bloody.radiantTeam?.name} vs ${bloody.direTeam?.name}`, heroId: bloody.mvp?.heroId });
  const parsed = model.games.filter(g => g.parsed);
  const rosh = parsed.filter(g => sum(g, true, p => p.roshanKills) !== sum(g, false, p => p.roshanKills));
  if (rosh.length) {
    const wr = rosh.filter(g => (sum(g, true, p => p.roshanKills) > sum(g, false, p => p.roshanKills)) === g.radiantWin).length / rosh.length;
    f.push({ id: 'rosh', page: 28, kicker: 'Co wygrywa mecze', big: `${Math.round(wr * 100)}%`, title: 'wygranych przy przewadze Roshanów', sub: `${count(rosh.length, 'gra', 'gry', 'gier')} z różną liczbą Roshanów` });
  }
  const rwr = model.games.filter(g => g.radiantWin).length / Math.max(1, model.games.length);
  f.push({ id: 'side', page: 13, kicker: 'Wojna stron', big: `${Math.round(rwr * 100)}%`, title: 'wygranych strony Radiant', sub: `Dire: ${Math.round((1 - rwr) * 100)}%` });
  const elo = eloTable(model)[0];
  if (elo) f.push({ id: 'elo', page: 23, kicker: 'Ranking siły', big: `${Math.round(elo.v)}`, title: elo.t.name, sub: 'najwyższe Elo w lidze', team: elo.t, heroId: elo.t.heroPicks[0]?.heroId, tone: 'brag' });
  const ach = computeAchievements(model);
  const col = collectorRanking(ach)[0];
  if (col) f.push({ id: 'collector', page: 8, kicker: 'Kolekcjoner osiągnięć', big: `${col.points}`, title: col.player.name, sub: `punktów · ${col.tiers[2]} złote progi`, player: col.player, team: col.player.team, heroId: col.player.heroes[0]?.heroId, tone: 'brag' });
  const streak = [...model.players].sort((a, b) => b.bestWinStreak - a.bestWinStreak)[0];
  if (streak) f.push({ id: 'streak', page: 4, kicker: 'Passa', big: `${streak.bestWinStreak}`, title: streak.name, sub: 'wygranych gier z rzędu', player: streak, team: streak.team, heroId: streak.heroes[0]?.heroId, tone: 'brag' });
  const race = rankPlayers(model, 'score', 'total')[0];
  if (race) f.push({ id: 'race', page: 17, kicker: 'Wyścig sezonu', big: `${Math.round(race.value)}`, title: race.player.name, sub: 'punktów fantasy łącznie', player: race.player, team: race.player.team, heroId: race.player.heroes[0]?.heroId });
  // Best hero duo (same team, ≥ 4 games together)
  const duo = new Map<string, { a: number; b: number; n: number; w: number }>();
  for (const g of model.games) for (const rad of [true, false]) {
    const hs = g.perfs.filter(p => p.radiant === rad).map(p => p.heroId).sort((x, y) => x - y);
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const k = `${hs[i]}-${hs[j]}`; const d = duo.get(k) ?? { a: hs[i], b: hs[j], n: 0, w: 0 };
      d.n++; if (rad === g.radiantWin) d.w++; duo.set(k, d);
    }
  }
  const bestDuo = [...duo.values()].filter(d => d.n >= 4).sort((x, y) => y.w / y.n - x.w / x.n || y.n - x.n)[0];
  if (bestDuo) f.push({ id: 'duo', page: 12, kicker: 'Najlepszy duet', big: `${Math.round((bestDuo.w / bestDuo.n) * 100)}%`, title: `${heroName(bestDuo.a)} + ${heroName(bestDuo.b)}`, sub: `wygranych w ${bestDuo.n} ${plural(bestDuo.n, 'wspólnej grze', 'wspólnych grach', 'wspólnych grach')}`, heroId: bestDuo.a, tone: 'brag' });
  // First pick advantage
  let fpN = 0; let fpW = 0;
  for (const g of model.games) { const fp = [...g.pb].sort((a, b) => a[3] - b[3]).find(x => x[1]); if (!fp) continue; fpN++; if ((fp[2] === 0) === g.radiantWin) fpW++; }
  if (fpN) f.push({ id: 'firstpick', page: 11, kicker: 'Pierwszy pick', big: `${Math.round((fpW / fpN) * 100)}%`, title: 'wygranych drużyny z pierwszym pickiem', sub: `${count(fpN, 'draft', 'drafty', 'draftów')}` });
  const lit = ach.reduce((n, a) => n + a.byTier.filter(Boolean).length, 0);
  f.push({ id: 'achlit', page: 8, kicker: 'Osiągnięcia', big: `${lit}/${ach.length * 3}`, title: 'progów zdobytych', sub: 'brąz, srebro i złoto' });
  for (const e of BINGO_EVENTS.filter(x => x.tone === 'roast')) {
    const hits = e.find(model); const h = hits[hits.length - 1];
    if (!h) continue;
    f.push({ id: `roast-${e.id}`, page: 27, kicker: `Wpadka · ${e.label}`, big: `${hits.length}×`, title: hitName(h), sub: e.quip(hitName(h)), player: h.player ?? h.perf?.player, team: h.team, heroId: h.perf?.heroId, tone: 'roast' });
  }
  return f;
}

/** A spread of facts: one per page/kind, interleaving brags, roasts and the rest */
export function pickFacts(facts: Fact[], n: number): Fact[] {
  const roasts = facts.filter(x => x.tone === 'roast');
  const recs = facts.filter(x => x.id.startsWith('rec-'));
  const rest = facts.filter(x => x.tone !== 'roast' && !x.id.startsWith('rec-'));
  const out: Fact[] = [];
  for (let i = 0; out.length < n && i < 40; i++) {
    const src = [rest, recs, rest, roasts][i % 4];
    const x = src[Math.floor(i / 4) % Math.max(1, src.length)];
    if (x && !out.includes(x)) out.push(x);
  }
  return out;
}
