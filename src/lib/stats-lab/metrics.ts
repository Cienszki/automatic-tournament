// Catalog of per-game metrics used by every stats-redesign page: label, hover explanation,
// how to read it off a performance and how to format it.
import type { Perf } from './derive';

export type MetricGroup = 'combat' | 'farm' | 'vision' | 'objectives' | 'special';

interface MetricDef {
  label: string;
  /** ≤ 6 chars, for column heads and chips */
  short: string;
  /** Hover explanation — one short sentence */
  desc: string;
  group: MetricGroup;
  get: (p: Perf) => number;
  /** 'low' = smaller is better (deaths) */
  better: 'high' | 'low';
  /** Needs a parsed replay; averages only count parsed games */
  parsedOnly?: boolean;
  fmt: (v: number) => string;
  /** Digits for per-game averages */
  avgDigits: number;
}

export interface Metric extends MetricDef {
  key: MetricKey;
}

export const fmtInt = (v: number) => Math.round(v).toLocaleString('pl-PL');
export const fmtK = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  if (a >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return `${Math.round(v)}`;
};
export const fmtDec = (d = 1) => (v: number) => v.toFixed(d);
export const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
export const fmtClock = (sec: number) => {
  if (!isFinite(sec) || sec <= 0) return '–';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const M = <K extends string>(key: K, m: MetricDef) => ({ key, ...m });

export const METRICS = {
  kills:      M('kills',      { label: 'Zabójstwa', short: 'K', desc: 'Zabici wrogowie bohaterowie w jednej grze', group: 'combat', get: p => p.kills, better: 'high', fmt: fmtInt, avgDigits: 1 }),
  deaths:     M('deaths',     { label: 'Śmierci', short: 'D', desc: 'Ile razy gracz zginął w grze — mniej znaczy lepiej', group: 'combat', get: p => p.deaths, better: 'low', fmt: fmtInt, avgDigits: 1 }),
  assists:    M('assists',    { label: 'Asysty', short: 'A', desc: 'Udział w zabójstwie bez zadania ostatniego ciosu', group: 'combat', get: p => p.assists, better: 'high', fmt: fmtInt, avgDigits: 1 }),
  kda:        M('kda',        { label: 'KDA', short: 'KDA', desc: '(zabójstwa + asysty) ÷ śmierci — ogólna skuteczność w walce', group: 'combat', get: p => p.kda, better: 'high', fmt: fmtDec(1), avgDigits: 2 }),
  kp:         M('kp',         { label: 'Udział w zabójstwach', short: 'KP', desc: 'Jaki procent zabójstw drużyny gracz zabił lub asystował', group: 'combat', get: p => p.kp, better: 'high', fmt: fmtPct, avgDigits: 2 }),
  streak:     M('streak',     { label: 'Seria zabójstw', short: 'Seria', desc: 'Najdłuższa seria zabójstw bez śmierci w jednej grze', group: 'combat', get: p => p.highestKillStreak, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 1 }),
  heroDamage: M('heroDamage', { label: 'Obrażenia bohaterom', short: 'DMG', desc: 'Łączne obrażenia zadane wrogim bohaterom w grze', group: 'combat', get: p => p.heroDamage, better: 'high', fmt: fmtK, avgDigits: 0 }),
  hdpm:       M('hdpm',       { label: 'Obrażenia / min', short: 'DMG/m', desc: 'Obrażenia bohaterom na minutę gry — niezależne od długości meczu', group: 'combat', get: p => p.hdpm, better: 'high', fmt: fmtInt, avgDigits: 0 }),
  gpm:        M('gpm',        { label: 'Złoto / min', short: 'GPM', desc: 'Złoto zdobywane na minutę — tempo farmy', group: 'farm', get: p => p.gpm, better: 'high', fmt: fmtInt, avgDigits: 0 }),
  xpm:        M('xpm',        { label: 'Doświadczenie / min', short: 'XPM', desc: 'Doświadczenie zdobywane na minutę — tempo levelowania', group: 'farm', get: p => p.xpm, better: 'high', fmt: fmtInt, avgDigits: 0 }),
  lastHits:   M('lastHits',   { label: 'Last hity', short: 'LH', desc: 'Dobite jednostki (creepy) — główne źródło złota', group: 'farm', get: p => p.lastHits, better: 'high', fmt: fmtInt, avgDigits: 0 }),
  lhpm:       M('lhpm',       { label: 'Last hity / min', short: 'LH/m', desc: 'Dobite jednostki na minutę gry', group: 'farm', get: p => p.lhpm, better: 'high', fmt: fmtDec(1), avgDigits: 1 }),
  denies:     M('denies',     { label: 'Denies', short: 'DN', desc: 'Dobite własne jednostki, żeby wróg nie dostał za nie złota', group: 'farm', get: p => p.denies, better: 'high', fmt: fmtInt, avgDigits: 1 }),
  netWorth:   M('netWorth',   { label: 'Wartość netto', short: 'NW', desc: 'Wartość przedmiotów i złota na koniec gry', group: 'farm', get: p => p.netWorth, better: 'high', fmt: fmtK, avgDigits: 0 }),
  neutralKills: M('neutralKills', { label: 'Neutralne creepy', short: 'NEU', desc: 'Zabite neutralne jednostki w dżungli', group: 'farm', get: p => p.neutralKills, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 0 }),
  wards:      M('wards',      { label: 'Postawione wardy', short: 'WRD', desc: 'Observer + sentry wardy postawione w grze', group: 'vision', get: p => p.obsPlaced + p.senPlaced, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 1 }),
  obsPlaced:  M('obsPlaced',  { label: 'Observer wardy', short: 'OBS', desc: 'Postawione observer wardy — dają widok na mapę', group: 'vision', get: p => p.obsPlaced, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 1 }),
  senPlaced:  M('senPlaced',  { label: 'Sentry wardy', short: 'SEN', desc: 'Postawione sentry wardy — wykrywają niewidzialnych i wrogie wardy', group: 'vision', get: p => p.senPlaced, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 1 }),
  dewards:    M('dewards',    { label: 'Zniszczone wardy', short: 'DEW', desc: 'Zniszczone wrogie wardy (observer + sentry)', group: 'vision', get: p => p.observerKills + p.sentryKills, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 1 }),
  runes:      M('runes',      { label: 'Runy', short: 'RUN', desc: 'Podniesione runy w jednej grze', group: 'vision', get: p => p.runesPickedUp, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 1 }),
  stacks:     M('stacks',     { label: 'Stackowane obozy', short: 'STK', desc: 'Ile razy gracz zestackował obóz neutralnych creepów', group: 'vision', get: p => p.campsStacked, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 1 }),
  heroHealing: M('heroHealing', { label: 'Leczenie', short: 'HEAL', desc: 'Punkty zdrowia wyleczone sojuszniczym bohaterom', group: 'vision', get: p => p.heroHealing, better: 'high', fmt: fmtK, avgDigits: 0 }),
  towerDamage: M('towerDamage', { label: 'Obrażenia budynkom', short: 'BLD', desc: 'Obrażenia zadane wieżom i budynkom wroga', group: 'objectives', get: p => p.towerDamage, better: 'high', fmt: fmtK, avgDigits: 0 }),
  towerKills: M('towerKills', { label: 'Zniszczone wieże', short: 'TWR', desc: 'Wieże, którym gracz zadał ostatni cios', group: 'objectives', get: p => p.towerKills, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 1 }),
  roshanKills: M('roshanKills', { label: 'Roshany', short: 'ROSH', desc: 'Roshany dobite przez gracza', group: 'objectives', get: p => p.roshanKills, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 2 }),
  courierKills: M('courierKills', { label: 'Zabite kurierki', short: 'KUR', desc: 'Zabite kurierki przeciwnika', group: 'objectives', get: p => p.courierKills, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 2 }),
  fantasy:    M('fantasy',    { label: 'Punkty fantasy', short: 'FP', desc: 'Ocena występu wg punktacji fantasy (uwzględnia rolę gracza)', group: 'special', get: p => p.fantasyPoints, better: 'high', fmt: fmtDec(1), avgDigits: 1 }),
  buybacks:   M('buybacks',   { label: 'Buybacki', short: 'BB', desc: 'Wykupienia się z martwych za złoto', group: 'special', get: p => p.buybackCount, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 2 }),
  multi:      M('multi',      { label: 'Multi-killi', short: 'MK', desc: 'Triple kille, ultra kille i rampage razem', group: 'special', get: p => p.tripleKills + p.ultraKills + p.rampages, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 2 }),
  rampages:   M('rampages',   { label: 'Rampage', short: 'RMP', desc: 'Pięć zabójstw w krótkim odstępie czasu', group: 'special', get: p => p.rampages, better: 'high', parsedOnly: true, fmt: fmtInt, avgDigits: 2 }),
} satisfies Record<string, MetricDef & { key: string }>;

export type MetricKey = keyof typeof METRICS;
export const METRIC_LIST: Metric[] = Object.values(METRICS) as Metric[];
export const metric = (k: MetricKey): Metric => METRICS[k] as Metric;

export const GROUP_LABEL: Record<MetricGroup, string> = {
  combat: 'Walka',
  farm: 'Farma',
  vision: 'Wizja i wsparcie',
  objectives: 'Cele',
  special: 'Specjalne',
};

/** Kill-streak announcer names (Dota) for hover flavour */
export function streakName(n: number): string {
  if (n >= 10) return 'Beyond Godlike';
  return ({ 3: 'Killing Spree', 4: 'Dominating', 5: 'Mega Kill', 6: 'Unstoppable', 7: 'Wicked Sick', 8: 'Monster Kill', 9: 'Godlike' } as Record<number, string>)[n] ?? '';
}
