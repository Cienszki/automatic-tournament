'use client';

// Dotadle (was #55) — three daily puzzles from the season's data, like LoLdle: the player, the
// hero and the team of the day. Every guess colours its columns (green = right, yellow = close,
// an arrow says "more" or "less"); two hints unlock on the way. Wins, streaks and the guess
// distribution are kept per puzzle in this browser, and the result can be copied as a square
// grid for Discord. "Bez limitu" rolls a fresh puzzle any time (it does not count to the streak).

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { useTournament } from '@/context/TournamentContext';
import type { Model, PlayerX, TeamX, HeroX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { getHeroData } from '@/lib/hero-mapping';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { eloTable } from '@/lib/stats-lab/teasers';
import { POS_OF, plural, qualified, seededRandom } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, Tip, WithModel, ink, mix, useHeaderFont, useStatsKey } from '@/components/stats-lab/kit';
import { useStatsNav, useStored } from '../nav';

const TRIES = 8;
const GREEN = '#2fbf71';
const YELLOW = '#e3b341';
const GREY = '#3a3d48';
const norm = (s: string) => s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');

type Mark = 'ok' | 'near' | 'no';
const bg = (m: Mark) => (m === 'ok' ? GREEN : m === 'near' ? YELLOW : GREY);
const EMOJI: Record<Mark, string> = { ok: '🟩', near: '🟨', no: '⬛' };
interface Cell { m: Mark; node: React.ReactNode; dir?: number }

const num = (a: number, b: number, tol: number): { m: Mark; dir: number } => ({ m: Math.abs(a - b) < 1e-9 ? 'ok' : Math.abs(a - b) <= tol ? 'near' : 'no', dir: b > a ? 1 : b < a ? -1 : 0 });

/** One puzzle kind: what can be guessed, the columns, and how a guess compares with the answer */
interface Kind<T> {
  id: 'gracz' | 'bohater' | 'druzyna';
  label: string;
  ask: string;
  pool: T[];
  guessable: T[];
  key: (x: T) => string;
  name: (x: T) => string;
  img: (x: T, size: number) => React.ReactNode;
  cols: Array<{ label: string; tip: string }>;
  compare: (g: T, t: T) => Cell[];
  hints: (t: T) => [React.ReactNode, React.ReactNode];
  /** Hub view that explains the answer */
  page: string;
}

function kinds(model: Model) {
  const elo = eloTable(model);
  const eloRank = new Map(elo.map((e, i) => [e.t.id, i + 1]));
  const groupOf = new Map<string, string>();
  for (const m of model.ds.matches) if (m.groupId) { groupOf.set(m.teamA, m.groupId); groupOf.set(m.teamB, m.groupId); }
  const groupName = (id?: string) => model.ds.groups?.find(g => g.id === id)?.name ?? '—';
  const topPlayerOf = (h: HeroX) => [...h.players].sort((a, b) => b.games - a.games)[0]?.player;
  const starOf = (t: TeamX) => [...t.players].filter(p => p.agg.score.avg != null).sort((a, b) => (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0))[0];

  const player: Kind<PlayerX> = {
    id: 'gracz', label: 'Gracz', ask: 'Kim jest dzisiejszy gracz?', page: 'dossier',
    pool: qualified(model).sort((a, b) => a.id.localeCompare(b.id)),
    guessable: model.players.filter(p => p.games > 0),
    key: p => p.id, name: p => p.name,
    img: (p, s) => <Avatar player={p} size={s} />,
    cols: [
      { label: 'Drużyna', tip: 'Zielony: ta sama drużyna' },
      { label: 'Pozycja', tip: 'Zielony: ta sama · żółty: sąsiednia' },
      { label: 'Gry', tip: 'Strzałka: szukany ma więcej / mniej · żółty: różnica do 20%' },
      { label: '% wygr.', tip: 'Procent wygranych · żółty: do 5 p.p. różnicy' },
      { label: 'Pkt/grę', tip: 'Średnia punktów występu · żółty: do 1 pkt różnicy' },
      { label: 'Bohater', tip: 'Najczęściej grany · żółty: jest w trójce ulubionych szukanego' },
    ],
    compare: (g, t) => {
      const gp = POS_OF[g.role ?? ''] ?? 0; const tp = POS_OF[t.role ?? ''] ?? 0;
      const gh = g.heroes[0]?.heroId; const th = t.heroes.slice(0, 3).map(h => h.heroId);
      const games = num(g.games, t.games, t.games * 0.2);
      const wr = num(Math.round(g.wr * 100), Math.round(t.wr * 100), 5);
      const sc = num(Math.round((g.agg.score.avg ?? 0) * 10) / 10, Math.round((t.agg.score.avg ?? 0) * 10) / 10, 1);
      return [
        { m: g.teamId && g.teamId === t.teamId ? 'ok' : 'no', node: <TeamLogo team={g.team} size={30} /> },
        { m: gp && gp === tp ? 'ok' : gp && tp && Math.abs(gp - tp) === 1 ? 'near' : 'no', node: <span className="text-lg font-bold">{gp || '–'}</span> },
        { ...games, node: <span className="text-lg font-bold tabular-nums">{g.games}</span> },
        { ...wr, node: <span className="text-lg font-bold tabular-nums">{Math.round(g.wr * 100)}%</span> },
        { ...sc, node: <span className="text-lg font-bold tabular-nums">{(g.agg.score.avg ?? 0).toFixed(1)}</span> },
        { m: gh != null && gh === th[0] ? 'ok' : gh != null && th.includes(gh) ? 'near' : 'no', node: gh != null ? <HeroImg heroId={gh} className="rounded w-full h-full" /> : '–' },
      ];
    },
    hints: t => [
      <>Najczęściej gra <b>{t.heroes[0] ? heroName(t.heroes[0].heroId) : '—'}</b></>,
      <>Nick zaczyna się na <b>„{t.name.slice(0, 1).toUpperCase()}”</b> i ma {t.name.length} znaków</>,
    ],
  };

  const heroPool = model.heroes.filter(h => h.picks >= 3);
  const hero: Kind<HeroX> = {
    id: 'bohater', label: 'Bohater', ask: 'Jaki to bohater?', page: 'bohaterowie',
    pool: [...heroPool].sort((a, b) => a.heroId - b.heroId),
    guessable: model.heroes.filter(h => h.picks + h.bans > 0),
    key: h => String(h.heroId), name: h => heroName(h.heroId),
    img: (h, s) => <HeroImg heroId={h.heroId} variant="icon" style={{ width: s, height: s }} />,
    cols: [
      { label: 'Atrybut', tip: 'Siła, zręczność, inteligencja lub uniwersalny' },
      { label: 'Atak', tip: 'Wręcz albo z dystansu' },
      { label: 'Picki', tip: 'Ile razy wybrany w sezonie · żółty: do 20% różnicy' },
      { label: 'Bany', tip: 'Ile razy zbanowany · żółty: do 20% różnicy' },
      { label: '% wygr.', tip: 'Skuteczność w sezonie · żółty: do 5 p.p.' },
      { label: 'Grał nim', tip: 'Kto grał nim najczęściej · żółty: ktoś z tej samej drużyny' },
    ],
    compare: (g, t) => {
      const ga = getHeroData(g.heroId); const ta = getHeroData(t.heroId);
      const gp = topPlayerOf(g); const tp = topPlayerOf(t);
      const attr: Record<string, string> = { str: 'SIŁ', agi: 'ZRĘ', int: 'INT', all: 'UNI' };
      return [
        { m: ga?.primary_attr === ta?.primary_attr ? 'ok' : 'no', node: <span className="text-sm font-bold">{attr[ga?.primary_attr ?? ''] ?? '?'}</span> },
        { m: ga?.attack_type === ta?.attack_type ? 'ok' : 'no', node: <span className="text-sm font-bold">{ga?.attack_type === 'Melee' ? 'Wręcz' : 'Dystans'}</span> },
        { ...num(g.picks, t.picks, Math.max(1, t.picks * 0.2)), node: <span className="text-lg font-bold tabular-nums">{g.picks}</span> },
        { ...num(g.bans, t.bans, Math.max(1, t.bans * 0.2)), node: <span className="text-lg font-bold tabular-nums">{g.bans}</span> },
        { ...num(Math.round(g.wr * 100), Math.round(t.wr * 100), 5), node: <span className="text-lg font-bold tabular-nums">{g.picks ? `${Math.round(g.wr * 100)}%` : '–'}</span> },
        { m: gp && tp && gp.id === tp.id ? 'ok' : gp?.teamId && gp.teamId === tp?.teamId ? 'near' : 'no', node: gp ? <Avatar player={gp} size={30} /> : '–' },
      ];
    },
    hints: t => [
      <>Najczęściej grał nim <b>{topPlayerOf(t)?.name ?? '—'}</b></>,
      <>Nazwa zaczyna się na <b>„{heroName(t.heroId).slice(0, 1)}”</b></>,
    ],
  };

  const teamPool = model.teams.filter(t => t.games.length >= 2);
  const team: Kind<TeamX> = {
    id: 'druzyna', label: 'Drużyna', ask: 'Która to drużyna?', page: 'odciski',
    pool: [...teamPool].sort((a, b) => a.id.localeCompare(b.id)),
    guessable: model.teams.filter(t => t.games.length > 0),
    key: t => t.id, name: t => t.name,
    img: (t, s) => <TeamLogo team={t} size={s} />,
    cols: [
      { label: 'Dywizja', tip: 'Zielony: ta sama dywizja / grupa' },
      { label: 'Elo', tip: 'Miejsce w rankingu Elo · żółty: sąsiednie' },
      { label: 'Wygrane', tip: 'Wygrane gry · żółty: do 2 różnicy' },
      { label: 'Zab./grę', tip: 'Zabójstwa na grę · żółty: do 2 różnicy' },
      { label: 'Czas gry', tip: 'Średni czas gry · żółty: do 2 minut' },
      { label: 'Bohater', tip: 'Ulubiony bohater · żółty: w trójce ulubionych szukanej' },
    ],
    compare: (g, t) => {
      const gr = eloRank.get(g.id) ?? 99; const tr = eloRank.get(t.id) ?? 99;
      const gh = g.heroPicks[0]?.heroId; const th = t.heroPicks.slice(0, 3).map(h => h.heroId);
      const gg = groupOf.get(g.id); const tg = groupOf.get(t.id);
      return [
        { m: gg && gg === tg ? 'ok' : 'no', node: <span className="text-[11px] font-bold leading-tight text-center px-1 line-clamp-2">{groupName(gg)}</span> },
        // Lower rank number = better, so the arrow follows the rank number
        { ...num(gr, tr, 1), node: <span className="text-lg font-bold tabular-nums">#{gr}</span> },
        { ...num(g.wins, t.wins, 2), node: <span className="text-lg font-bold tabular-nums">{g.wins}</span> },
        { ...num(Math.round(g.avg.kills), Math.round(t.avg.kills), 2), node: <span className="text-lg font-bold tabular-nums">{g.avg.kills.toFixed(0)}</span> },
        { ...num(Math.round(g.avg.duration / 60), Math.round(t.avg.duration / 60), 2), node: <span className="text-base font-bold tabular-nums">{fmtClock(g.avg.duration)}</span> },
        { m: gh != null && gh === th[0] ? 'ok' : gh != null && th.includes(gh) ? 'near' : 'no', node: gh != null ? <HeroImg heroId={gh} className="rounded w-full h-full" /> : '–' },
      ];
    },
    hints: t => [
      <>Jej gwiazda: <b>{starOf(t)?.name ?? '—'}</b></>,
      <>Nazwa zaczyna się na <b>„{t.name.slice(0, 1).toUpperCase()}”</b></>,
    ],
  };
  return { gracz: player, bohater: hero, druzyna: team };
}

// ── Saved state ─────────────────────────────────────────────────────────

type KindId = 'gracz' | 'bohater' | 'druzyna';
interface Daily { day: string; guesses: string[]; done: boolean; won: boolean }
interface Stats { played: number; won: number; streak: number; best: number; dist: number[]; lastDay?: string }
type Saved = Partial<Record<KindId, Daily>> & { stats?: Partial<Record<KindId, Stats>> };
const emptyStats = (): Stats => ({ played: 0, won: 0, streak: 0, best: 0, dist: Array(TRIES).fill(0) });

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNumber = (day: string) => Math.round((new Date(day + 'T12:00:00').getTime() - new Date('2026-01-01T12:00:00').getTime()) / 86400000) + 1;
const yesterday = (day: string) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - 1); return localDay(d); };
const KIND_SALT: Record<KindId, number> = { gracz: 0, bohater: 7_777, druzyna: 31_337 };

function useCountdown() {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const n = new Date(); const mid = new Date(n); mid.setHours(24, 0, 0, 0);
      const s = Math.floor((mid.getTime() - n.getTime()) / 1000);
      setLeft(`${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
    };
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);
  return left;
}

// ── Board ───────────────────────────────────────────────────────────────

function Puzzle<T>({ kind, target, guesses, onGuess, done, won, endless, onNext, stats, day, tournamentName }: {
  kind: Kind<T>; target: T; guesses: T[]; onGuess: (x: T) => void; done: boolean; won: boolean; endless: boolean; onNext: () => void;
  stats: Stats; day: string; tournamentName: string;
}) {
  const font = useHeaderFont();
  const nav = useStatsNav();
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown();
  const sugg = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    const used = new Set(guesses.map(kind.key));
    return kind.guessable.filter(x => !used.has(kind.key(x)) && norm(kind.name(x)).includes(n))
      .sort((a, b) => Number(norm(kind.name(b)).startsWith(n)) - Number(norm(kind.name(a)).startsWith(n)) || kind.name(a).localeCompare(kind.name(b))).slice(0, 6);
  }, [q, kind, guesses]);
  const rows = guesses.map(g => kind.compare(g, target));
  const hints = kind.hints(target);
  const wrong = guesses.length - (won ? 1 : 0);

  const share = async () => {
    const grid = rows.map(r => r.map(c => EMOJI[c.m]).join('')).join('\n');
    const text = `Dotadle · ${tournamentName} · ${kind.label}${endless ? '' : ` #${dayNumber(day)}`} · ${won ? guesses.length : 'X'}/${TRIES}\n${grid}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="flex-1 min-h-0 flex gap-6">
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="grid gap-2 shrink-0 mb-1.5" style={{ gridTemplateColumns: '210px repeat(6, 1fr)' }}>
          <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{kind.label}</span>
          {kind.cols.map(c => <Tip key={c.label} content={c.tip}><span className="text-[10px] uppercase tracking-widest text-center cursor-help" style={{ color: C.muted }}>{c.label}</span></Tip>)}
        </div>
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          {Array.from({ length: TRIES }, (_, i) => {
            const g = guesses[i]; const r = rows[i];
            if (!g || !r) return <div key={i} className="flex-1 max-h-14 rounded-xl" style={{ border: `1px dashed ${ink(12)}` }} />;
            return (
              <div key={kind.key(g)} className="flex-1 max-h-14 grid gap-2" style={{ gridTemplateColumns: '210px repeat(6, 1fr)' }}>
                <motion.div className="flex items-center gap-2.5 rounded-xl px-2 min-w-0" style={{ background: ink(5) }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                  {kind.img(g, 38)}<span className="truncate font-bold">{kind.name(g)}</span>
                </motion.div>
                {r.map((c, k) => (
                  <motion.div key={k} className="relative rounded-xl flex items-center justify-center gap-1 overflow-hidden text-white" style={{ background: bg(c.m) }}
                    initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ delay: 0.12 * k, duration: 0.35 }}>
                    {c.node}
                    {c.dir ? <span className="text-base font-bold">{c.dir > 0 ? '↑' : '↓'}</span> : null}
                  </motion.div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-[340px] shrink-0 flex flex-col gap-3 min-h-0">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" className="rounded-3xl flex flex-col items-center gap-2.5 text-center p-5" style={{ background: mix(won ? GREEN : C.loss, 14), border: `1px solid ${mix(won ? GREEN : C.loss, 45)}` }}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: C.muted }}>{won ? `Trafione w ${guesses.length} ${plural(guesses.length, 'próbie', 'próbach', 'próbach')}` : 'Szukany'}</div>
              {kind.img(target, 110)}
              <div className="text-2xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{kind.name(target)}</div>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={share} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ background: ink(8), color: C.text }}>
                  <Share2 className="w-3.5 h-3.5" />{copied ? 'Skopiowano!' : 'Udostępnij'}
                </button>
                <button type="button" onClick={() => nav?.go(kind.page)} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), color: C.text }}>Więcej ›</button>
              </div>
              {endless
                ? <button type="button" onClick={onNext} className="mt-1 rounded-xl px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Następna zagadka</button>
                : <div className="text-xs" style={{ color: C.muted }}>Następna zagadka za <b className="tabular-nums" style={{ color: C.heading }}>{countdown}</b></div>}
            </motion.div>
          ) : (
            <motion.div key="play" className="flex flex-col gap-2.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="rounded-3xl p-4 flex items-center gap-4" style={{ background: ink(4), border: `1px solid ${ink(10)}` }}>
                <div className="w-[72px] h-[72px] shrink-0 rounded-full flex items-center justify-center text-4xl font-logik-extended-bold" style={{ background: mix(C.primary, 35), color: C.heading, ...font }}>?</div>
                <div>
                  <div className="font-bold" style={{ color: C.heading }}>{kind.ask}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{TRIES - guesses.length} {plural(TRIES - guesses.length, 'próba', 'próby', 'prób')} · {endless ? 'bez limitu' : `zagadka #${dayNumber(day)}`}</div>
                </div>
              </div>
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && sugg[0]) { onGuess(sugg[0]); setQ(''); } }}
                placeholder={kind.id === 'gracz' ? 'Wpisz nick…' : kind.id === 'bohater' ? 'Wpisz bohatera…' : 'Wpisz drużynę…'} aria-label="Twoja odpowiedź" spellCheck={false} autoComplete="off"
                className="w-full rounded-xl px-4 py-3 text-lg outline-none" style={{ background: ink(6), border: `2px solid ${mix(C.secondary, 50)}`, color: C.heading }} />
              <div className="flex flex-col gap-1.5">
                {sugg.map(x => (
                  <button key={kind.key(x)} type="button" onClick={() => { onGuess(x); setQ(''); }} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:brightness-125" style={{ background: ink(6) }}>
                    {kind.img(x, 32)}<span className="flex-1 truncate font-bold">{kind.name(x)}</span>
                  </button>
                ))}
              </div>
              {!q && (
                <div className="flex flex-col gap-1.5">
                  {[4, 6].map((at, k) => (
                    <div key={at} className="rounded-xl px-3 py-2 text-sm" style={{ background: wrong >= at ? mix(C.secondary, 14) : ink(4), color: wrong >= at ? C.text : C.muted, border: wrong >= at ? undefined : `1px dashed ${ink(12)}` }}>
                      {wrong >= at ? <>Podpowiedź {k + 1}: {hints[k]}</> : <>Podpowiedź {k + 1} po {at} pudłach</>}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Statistics of this puzzle */}
        {!endless && (
          <div className="mt-auto rounded-2xl p-3" style={{ background: ink(4) }}>
            <div className="grid grid-cols-4 gap-2 text-center mb-2">
              {[['Gier', stats.played], ['% wygr.', stats.played ? Math.round((stats.won / stats.played) * 100) : 0], ['Seria', stats.streak], ['Rekord', stats.best]].map(([l, v]) => (
                <div key={l as string}><div className="text-xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{v}</div><div className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{l}</div></div>
              ))}
            </div>
            <div className="flex flex-col gap-0.5">
              {stats.dist.map((n, i) => {
                const max = Math.max(1, ...stats.dist);
                const mine = done && won && guesses.length === i + 1;
                return (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] tabular-nums">
                    <span className="w-3 text-right" style={{ color: C.muted }}>{i + 1}</span>
                    <div className="h-3 rounded-sm flex items-center justify-end px-1 font-bold text-white" style={{ width: `${8 + (n / max) * 92}%`, background: mine ? GREEN : ink(14) }}>{n}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DotadleGame({ model }: { model: Model }) {
  const statsKey = useStatsKey();
  const { tournament } = useTournament();
  const all = useMemo(() => kinds(model), [model]);
  const [mode, setMode] = useState<KindId>('gracz');
  const [endless, setEndless] = useState(false);
  const [rollSeed, setRollSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [endlessGuesses, setEndlessGuesses] = useState<string[]>([]);
  const [saved, setSaved] = useStored<Saved>(statsKey ? `stats-hub:${statsKey}:dotadle` : null, {});
  const today = localDay();
  const kind = all[mode] as Kind<unknown>;

  const target = useMemo(() => {
    const pool = kind.pool;
    if (!pool.length) return null;
    const seed = endless ? rollSeed : dayNumber(today) * 97 + KIND_SALT[mode];
    const r = seededRandom(seed); r(); r();
    return pool[Math.floor(r() * pool.length)];
  }, [kind, endless, rollSeed, today, mode]);

  const daily: Daily = saved[mode]?.day === today ? saved[mode]! : { day: today, guesses: [], done: false, won: false };
  const keys = endless ? endlessGuesses : daily.guesses;
  const byKey = useMemo(() => new Map(kind.guessable.map(x => [kind.key(x), x])), [kind]);
  const guesses = keys.map(k => byKey.get(k)).filter((x): x is NonNullable<typeof x> => x != null);
  const won = !!target && keys.includes(kind.key(target));
  const done = won || keys.length >= TRIES;
  const stats = saved.stats?.[mode] ?? emptyStats();

  const guess = (x: unknown) => {
    if (done || !target) return;
    const k = kind.key(x);
    if (endless) { setEndlessGuesses(g => [...g, k]); return; }
    setSaved(prev => {
      const cur: Daily = prev[mode]?.day === today ? prev[mode]! : { day: today, guesses: [], done: false, won: false };
      const nextGuesses = [...cur.guesses, k];
      const hit = k === kind.key(target);
      const finished = hit || nextGuesses.length >= TRIES;
      let st = prev.stats?.[mode] ?? emptyStats();
      if (finished) {
        const continues = st.lastDay === yesterday(today);
        const streak = hit ? (continues ? st.streak + 1 : 1) : 0;
        const dist = [...st.dist]; if (hit) dist[nextGuesses.length - 1]++;
        st = { played: st.played + 1, won: st.won + (hit ? 1 : 0), streak, best: Math.max(st.best, streak), dist, lastDay: today };
      }
      return { ...prev, [mode]: { day: today, guesses: nextGuesses, done: finished, won: hit }, stats: { ...prev.stats, [mode]: st } };
    });
  };
  useEffect(() => { setEndlessGuesses([]); }, [mode, rollSeed, endless]);

  const solvedToday = (id: KindId) => saved[id]?.day === today && saved[id]?.done;
  return (
    <>
      <LabTitle sub={<span>{endless ? 'bez limitu — nie liczy się do serii' : `zagadka dnia #${dayNumber(today)} · nowe o północy`}</span>}
        right={
          <div className="flex items-center gap-2">
            <Seg value={mode} onChange={setMode} options={(['gracz', 'bohater', 'druzyna'] as KindId[]).map(id => ({ value: id, label: <span>{all[id].label}{!endless && solvedToday(id) ? ' ✓' : ''}</span> }))} />
            <button type="button" onClick={() => { setEndless(e => !e); setRollSeed(Math.floor(Math.random() * 1e9)); }}
              className="rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all"
              style={endless ? { background: C.primary, color: '#fff' } : { background: ink(6), color: C.text, border: `1px solid ${ink(10)}` }}>Bez limitu</button>
          </div>
        }>
        Dotadle
      </LabTitle>
      <div className="flex-1 min-h-0 flex flex-col mt-3">
        {target ? (
          <Puzzle key={`${mode}-${endless ? rollSeed : today}`} kind={kind} target={target} guesses={guesses} onGuess={guess} done={done} won={won}
            endless={endless} onNext={() => setRollSeed(Math.floor(Math.random() * 1e9))} stats={stats} day={today} tournamentName={tournament?.name ?? ''} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.muted }}>Za mało danych na tę zagadkę — wróć po kilku grach.</div>
        )}
      </div>
    </>
  );
}

export default function Dotadle() {
  return <LabView><WithModel>{m => <DotadleGame model={m} />}</WithModel></LabView>;
}
