// Bingo events for the stats-redesign #27 card. Lighthearted on purpose: half of them celebrate,
// half gently roast. `quip` turns the first hit into a one-liner (name = who did it).
import type { GameX, Model, Perf, PlayerX, TeamX } from './derive';
import { fmtClock } from './metrics';
import { heroName } from './heroes';

export interface BingoHit { game: GameX; perf?: Perf; player?: PlayerX; team?: TeamX; note: string }
export interface BingoEvent {
  id: string;
  label: string;
  desc: string;
  /** One-liner about the first person/team who did it */
  quip: (who: string) => string;
  /** 'roast' = gentle teasing, 'brag' = genuinely impressive */
  tone: 'roast' | 'brag';
  find: (m: Model) => BingoHit[];
}

const kda = (p: Perf) => `${p.kills}/${p.deaths}/${p.assists}`;
const SUPPORTS = new Set(['Soft Support', 'Hard Support']);
const CORES = new Set(['Carry', 'Mid', 'Offlane']);
const byTime = (a: BingoHit, b: BingoHit) => a.game.start - b.game.start;

const perfEv = (e: Omit<BingoEvent, 'find'> & { test: (p: Perf) => boolean; note: (p: Perf) => string; parsed?: boolean }): BingoEvent => ({
  ...e,
  find: m => m.perfs.filter(p => p.player && (!e.parsed || p.parsed) && e.test(p)).map(p => ({ game: p.game, perf: p, player: p.player, note: e.note(p) })).sort(byTime),
});
const gameEv = (e: Omit<BingoEvent, 'find'> & { test: (g: GameX) => boolean; note: (g: GameX) => string }): BingoEvent => ({
  ...e,
  find: m => m.games.filter(e.test).map(g => ({ game: g, team: m.teamById.get(g.winnerId), note: e.note(g) })).sort(byTime),
});
const side = (g: GameX, radiant: boolean) => g.perfs.filter(p => p.radiant === radiant);

export const BINGO_EVENTS: BingoEvent[] = [
  // ── Brag ──
  perfEv({ id: 'ramp', label: 'Rampage', desc: 'Pięć zabójstw w krótkim odstępie', tone: 'brag', quip: n => `${n} wyczyścił drużynę rywala w pojedynkę`, test: p => p.rampages > 0, note: p => `${heroName(p.heroId)} ${kda(p)}`, parsed: true }),
  perfEv({ id: 'k25', label: '25 zabójstw', desc: 'Jeden gracz z co najmniej 25 zabójstwami', tone: 'brag', quip: n => `${n} prowadził własną listę ofiar`, test: p => p.kills >= 25, note: p => `${p.kills} zabójstw` }),
  perfEv({ id: 'immortal', label: 'Nietykalny', desc: 'Gra bez śmierci z co najmniej 28 zabójstwami + asystami', tone: 'brag', quip: n => `${n} — rywale nawet go nie drasnęli`, test: p => p.deaths === 0 && p.kills + p.assists >= 28, note: p => kda(p) }),
  perfEv({ id: 'stk15', label: 'Fabryka stacków', desc: 'Co najmniej 13 zestackowanych obozów w jednej grze', tone: 'brag', quip: n => `${n} prowadzi hodowlę neutrali`, test: p => p.campsStacked >= 13, note: p => `${p.campsStacked} stacków`, parsed: true }),
  perfEv({ id: 'gpm900', label: '900 GPM', desc: 'Co najmniej 900 złota na minutę', tone: 'brag', quip: n => `${n} drukował złoto`, test: p => p.gpm >= 900, note: p => `${p.gpm} GPM` }),
  perfEv({ id: 'cour3', label: 'Poczta Polska', desc: 'Trzy zabite kurierki w jednej grze', tone: 'brag', quip: n => `${n}: przesyłka nie dotarła. Trzy razy`, test: p => p.courierKills >= 3, note: p => `${p.courierKills} kurierki`, parsed: true }),
  gameEv({ id: 'speedrun', label: 'Speedrun', desc: 'Wygrana przed 22. minutą', tone: 'brag', quip: n => `${n} spieszył się na kolację`, test: g => g.duration < 22 * 60, note: g => fmtClock(g.duration) }),
  gameEv({ id: 'comeback', label: 'Comeback', desc: 'Wygrana mimo co najmniej 10 zabójstw mniej niż rywal', tone: 'brag', quip: n => `${n} przegrał każdą walkę i wygrał grę`, test: g => (g.radiantWin ? g.direKills - g.radiantKills : g.radiantKills - g.direKills) >= 10, note: g => `${Math.min(g.radiantKills, g.direKills)} vs ${Math.max(g.radiantKills, g.direKills)} zabójstw` }),
  gameEv({ id: 'rosh3', label: 'Abonament na Roshana', desc: 'Jedna drużyna zabija 3 Roshany w grze', tone: 'brag', quip: n => `${n} wykupił karnet na Roshana`, test: g => g.parsed && [true, false].some(r => side(g, r).reduce((s, p) => s + p.roshanKills, 0) >= 3), note: g => `${Math.max(...[true, false].map(r => side(g, r).reduce((s, p) => s + p.roshanKills, 0)))} Roshany` }),
  { id: 'streak5', label: '5 wygranych z rzędu', desc: 'Drużyna wygrywa pięć gier z rzędu', tone: 'brag', quip: n => `${n} zapomniał, jak się przegrywa`,
    find: m => m.teams.flatMap(t => { let s = 0; const out: BingoHit[] = []; t.games.forEach((g, i) => { s = t.form[i] ? s + 1 : 0; if (s === 5) out.push({ game: g, team: t, note: `${t.name} — 5 z rzędu` }); }); return out; }).sort(byTime) },
  { id: 'spammer', label: 'Jedna miłość', desc: 'Gracz zagrał tym samym bohaterem co najmniej 7 razy', tone: 'brag', quip: n => `${n} nie zna innych bohaterów. I dobrze mu z tym`,
    find: m => m.players.flatMap(p => p.heroes.filter(h => h.games >= 7).map(h => ({ game: p.perfs[p.perfs.length - 1].game, player: p, note: `${heroName(h.heroId)} ×${h.games}` }))).sort(byTime) },
  gameEv({ id: 'marathon', label: 'Maraton', desc: 'Gra trwająca ponad 65 minut', tone: 'brag', quip: n => `${n} wygrał, zanim zasnęła publiczność`, test: g => g.duration > 65 * 60, note: g => fmtClock(g.duration) }),

  // ── Roast ──
  perfEv({ id: 'tourist', label: 'Turysta', desc: 'Gra trwająca ponad 30 minut z najwyżej 2 zabójstwami + asystami', tone: 'roast', quip: n => `${n} odwiedził mapę w celach krajoznawczych`, test: p => p.min >= 30 && p.kills + p.assists <= 2, note: p => `${kda(p)} w ${fmtClock(p.game.duration)}` }),
  perfEv({ id: 'donor', label: 'Dawca organów', desc: 'Co najmniej 17 śmierci w jednej grze', tone: 'roast', quip: n => `${n} hojnie rozdawał złoto rywalom`, test: p => p.deaths >= 17, note: p => `${p.deaths} śmierci` }),
  perfEv({ id: 'pacifist', label: 'Pacyfista', desc: 'Zero zabójstw, ale co najmniej 20 asyst', tone: 'roast', quip: n => `${n} pomaga wszystkim, nie krzywdzi nikogo`, test: p => p.kills === 0 && p.assists >= 20, note: p => kda(p) }),
  perfEv({ id: 'blind', label: 'Wardy? Jakie wardy?', desc: 'Support bez ani jednego postawionego warda w grze z pełną powtórką', tone: 'roast', quip: n => `${n} grał na supporcie po omacku`, test: p => SUPPORTS.has(p.player?.role ?? '') && p.obsPlaced + p.senPlaced === 0 && p.min >= 35, note: p => `${heroName(p.heroId)}, 0 wardów`, parsed: true }),
  perfEv({ id: 'thief', label: 'Złodziej farmy', desc: 'Hard support z najwyższą wartością netto w swojej drużynie', tone: 'roast', quip: n => `${n} zabrał carry'emu całe złoto`, test: p => p.player?.role === 'Hard Support' && side(p.game, p.radiant).every(o => o === p || o.netWorth < p.netWorth), note: p => `${Math.round(p.netWorth / 1000)}k netto` }),
  perfEv({ id: 'jobless', label: 'Bezrobotny carry', desc: 'Carry z najniższą wartością netto w swojej drużynie', tone: 'roast', quip: n => `${n} — carry, który nosił głównie wardy`, test: p => p.player?.role === 'Carry' && side(p.game, p.radiant).every(o => o === p || o.netWorth > p.netWorth), note: p => `${Math.round(p.netWorth / 1000)}k netto` }),
  perfEv({ id: 'vegan', label: 'Wegetarianin', desc: 'Gracz rdzenia (1–3) z mniej niż 40 last hitami w grze trwającej ponad 30 minut', tone: 'roast', quip: n => `${n} nie tknął creepów`, test: p => CORES.has(p.player?.role ?? '') && p.min > 30 && p.lastHits < 40, note: p => `${p.lastHits} LH` }),
  perfEv({ id: 'richloser', label: 'Bogaty przegrany', desc: 'Co najmniej 38k wartości netto, a i tak porażka', tone: 'roast', quip: n => `${n} umarł z pełnym portfelem`, test: p => !p.win && p.netWorth >= 38000, note: p => `${Math.round(p.netWorth / 1000)}k netto, porażka` }),
  perfEv({ id: 'bb3', label: 'Wieczny powrót', desc: 'Trzy buybacki w jednej grze', tone: 'roast', quip: n => `${n} kupował życie hurtowo`, test: p => p.buybackCount >= 3, note: p => `${p.buybackCount} buybacki`, parsed: true }),
  gameEv({ id: 'massacre', label: 'Rzeź', desc: 'Gra z co najmniej 105 zabójstwami łącznie', tone: 'roast', quip: n => `${n}: obrona? Nie słyszeli`, test: g => g.kills >= 105, note: g => `${g.kills} zabójstw` }),
  gameEv({ id: 'nailbiter', label: 'Na noże', desc: 'Gra po 45. minucie z różnicą zabójstw najwyżej 2', tone: 'roast', quip: n => `${n} wygrał na zdjęciu fotokomórki`, test: g => g.duration >= 45 * 60 && Math.abs(g.radiantKills - g.direKills) <= 2, note: g => `${g.radiantKills}:${g.direKills} w ${fmtClock(g.duration)}` }),
  { id: 'fbvictim', label: 'Pierwsza ofiara', desc: 'Drużyna oddaje pierwszą krew przed 1. minutą i przegrywa', tone: 'roast', quip: n => `${n} zaczął od falstartu`,
    find: m => m.games.filter(g => g.fbPerf && g.firstBlood >= 10 && g.firstBlood < 60 && g.fbPerf.win).map(g => ({ game: g, team: m.teamById.get(g.loserId), note: `pierwsza krew w ${fmtClock(g.firstBlood)}` })).sort(byTime) },
];

/** Who to name in the quip */
export const hitName = (h: BingoHit) => h.player?.name ?? h.perf?.player?.name ?? h.team?.name ?? '?';
