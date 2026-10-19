'use client';

// "Kto to?" (was #44), reworked. What changed and why:
//  - clues no longer appear on a hidden timer: you ask for the next one (and see what it costs)
//  - questions get harder as you go — the first ones are about the season's best-known names,
//    not about someone with three games
//  - seven kinds of question instead of four in a fixed order: who is it, which hero, which team,
//    whose record, who has more, true or false, and how many
//  - eight rounds, three one-time lifelines (50/50, free clue, swap the question), keys 1–4
//  - the answer is explained next to the clues (it used to cover the choices) with a link to the
//    view that shows it; the best score is kept and the result can be copied

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, Repeat, Scissors, Share2 } from 'lucide-react';
import { useTournament } from '@/context/TournamentContext';
import type { Model, PlayerX, TeamX, HeroX } from '@/lib/stats-lab/derive';
import { rankPlayers, topPerfs } from '@/lib/stats-lab/derive';
import { eloTable } from '@/lib/stats-lab/teasers';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock, metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { plural, qualified } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, WithModel, ink, mix, onDark, useHeaderFont, useStatsKey } from '@/components/stats-lab/kit';
import { PAGE_BY_ID } from '../catalog';
import { useStatsNav, useStored } from '../nav';

const ROUNDS = 8;
const GOOD = '#3ddc84';
const BAD = '#ff5d5d';
const LEVEL = ['łatwe', 'średnie', 'trudne'] as const;

interface Choice { id: string; name: string; sub?: string; img?: (size: number) => React.ReactNode; render?: number }
interface Question {
  ask: string;
  level: 0 | 1 | 2;
  /** Clue questions start with one clue and can reveal more; the rest show a single statement */
  clues: React.ReactNode[];
  choices: Choice[];
  answer: string;
  /** Points when answered right with no extra clue */
  worth: number;
  page: string;
  explain: React.ReactNode;
}

function rng(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function shuffle<T>(a: T[], r: () => number) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

const H = (id: number) => <span className="inline-flex items-center gap-1.5 align-middle"><HeroImg heroId={id} variant="icon" className="rounded" style={{ width: 26, height: 26 }} /><b>{heroName(id)}</b></span>;

function buildQuiz(model: Model, seed: number): Question[] {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  // Best-known first: players by games and performance, heroes by drafts, teams by Elo
  const players = qualified(model).sort((a, b) => b.games - a.games || (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0));
  const heroes = [...model.heroes].filter(h => h.picks >= 2).sort((a, b) => b.contest - a.contest);
  const teams = eloTable(model).map(e => e.t).filter(t => t.games.length > 0);
  const elo = eloTable(model);
  const score = rankPlayers(model, 'score', 'avg', 1);
  const tier = <T,>(a: T[], level: number) => a.slice(0, Math.max(4, Math.ceil(a.length * [0.3, 0.65, 1][level])));
  const others = <T,>(pool: T[], not: T, n: number) => shuffle(pool.filter(x => x !== not), r).slice(0, n);

  const pc = (p: PlayerX): Choice => ({ id: p.id, name: p.name, sub: p.team?.name, img: s => <Avatar player={p} size={s} className="!rounded-2xl" /> });
  const hc = (h: HeroX): Choice => ({ id: String(h.heroId), name: heroName(h.heroId), render: h.heroId });
  const tc = (t: TeamX): Choice => ({ id: t.id, name: t.name, img: s => <span className="flex items-center justify-center rounded-2xl" style={{ width: s, height: s, background: '#15151c' }}><TeamLogo team={t} size={s * 0.8} /></span> });

  const makers: Record<string, (level: 0 | 1 | 2) => Question | null> = {
    player: level => {
      const pool = tier(players, level); const p = pick(pool); if (!p) return null;
      const s = score.find(x => x.player.id === p.id);
      return {
        ask: 'Który to gracz?', level, worth: 4, page: 'dossier', answer: p.id,
        explain: <><b>{p.name}</b> — {p.games} gier, {Math.round(p.wr * 100)}% wygranych{s ? `, ${s.value.toFixed(1)} pkt występu na grę` : ''}.</>,
        clues: [
          <>{p.games} {plural(p.games, 'gra', 'gry', 'gier')} · {Math.round(p.wr * 100)}% wygranych</>,
          <>najczęściej gra {p.heroes[0] ? H(p.heroes[0].heroId) : '—'}</>,
          <>{p.role ? `gra na pozycji ${p.role}` : 'gra na różnych pozycjach'} · KDA {p.agg.kda.avg?.toFixed(2) ?? '–'}</>,
          <>gra w <b>{p.team?.name ?? '—'}</b></>,
        ],
        choices: shuffle([pc(p), ...others(pool, p, 3).map(pc)], r),
      };
    },
    hero: level => {
      const pool = tier(heroes, level); const h = pick(pool); if (!h) return null;
      const top = [...h.players].sort((a, b) => b.games - a.games)[0];
      return {
        ask: 'Jaki to bohater?', level, worth: 4, page: 'bohaterowie', answer: String(h.heroId),
        explain: <>{H(h.heroId)} — {h.picks} picków, {h.bans} banów, {Math.round(h.wr * 100)}% wygranych.</>,
        clues: [
          <>{h.picks} picków · {h.bans} banów</>,
          <>{Math.round(h.wr * 100)}% wygranych gier</>,
          <>średnio {h.avgK.toFixed(1)} / {h.avgD.toFixed(1)} / {h.avgA.toFixed(1)}</>,
          <>najczęściej grał nim <b>{top?.player.name ?? '—'}</b></>,
        ],
        choices: shuffle([hc(h), ...others(pool, h, 3).map(hc)], r),
      };
    },
    team: level => {
      const pool = tier(teams, level); const t = pick(pool); if (!t) return null;
      const e = elo.findIndex(x => x.t.id === t.id);
      const star = score.find(x => x.player.team?.id === t.id);
      return {
        ask: 'Która to drużyna?', level, worth: 4, page: 'odciski', answer: t.id,
        explain: <><b>{t.name}</b> — {t.wins}–{t.losses} w grach, {e + 1}. miejsce w rankingu Elo.</>,
        clues: [
          <>{t.wins}–{t.losses} w grach</>,
          <>najczęściej wybiera {t.heroPicks[0] ? H(t.heroPicks[0].heroId) : '—'}</>,
          <>{e + 1}. miejsce w rankingu Elo</>,
          <>jej gwiazda: <b>{star?.player.name ?? '—'}</b></>,
        ],
        choices: shuffle([tc(t), ...others(pool, t, 3).map(tc)], r),
      };
    },
    record: level => {
      const keys: MetricKey[] = ['kills', 'assists', 'gpm', 'heroDamage', 'lastHits', 'wards', 'xpm', 'netWorth'];
      const k = pick(keys); const p = topPerfs(model, k, 1)[0]; const holder = p?.player; if (!p || !holder) return null;
      const m = metric(k);
      const pool = players.includes(holder) ? tier(players, level) : [...tier(players, level), holder];
      return {
        ask: 'Czyj to rekord?', level, worth: 3, page: 'rekordy', answer: holder.id,
        explain: <><b>{holder.name}</b>: {m.fmt(m.get(p))} ({m.label.toLowerCase()}) na {heroName(p.heroId)}.</>,
        clues: [
          <><b className="text-2xl">{m.fmt(m.get(p))}</b> · {m.label.toLowerCase()} w jednej grze</>,
          <>zagrane bohaterem {H(p.heroId)}</>,
          <>gra w <b>{holder.team?.name ?? '—'}</b></>,
        ],
        choices: shuffle([pc(holder), ...others(pool, holder, 3).map(pc)], r),
      };
    },
    more: level => {
      const keys: MetricKey[] = ['kills', 'assists', 'gpm', 'deaths', 'wards', 'lastHits'];
      const k = pick(keys); const m = metric(k);
      const pool = tier(players, level);
      const a = pick(pool); const b = pick(pool.filter(x => x !== a && Math.abs((x.agg[k].avg ?? 0) - (a?.agg[k].avg ?? 0)) > 0.05));
      if (!a || !b) return null;
      const win = (a.agg[k].avg ?? 0) > (b.agg[k].avg ?? 0) ? a : b;
      return {
        ask: `Kto ma więcej: ${m.label.toLowerCase()} na grę?`, level, worth: 2, page: 'liderzy', answer: win.id,
        explain: <>{a.name}: <b>{(a.agg[k].avg ?? 0).toFixed(1)}</b> · {b.name}: <b>{(b.agg[k].avg ?? 0).toFixed(1)}</b> ({m.label.toLowerCase()} średnio na grę).</>,
        clues: [<>{m.desc}. Liczy się średnia z całego sezonu.</>],
        choices: shuffle([pc(a), pc(b)], r),
      };
    },
    truth: level => {
      const statements: Array<() => { text: React.ReactNode; truth: boolean; explain: React.ReactNode; page: string } | null> = [
        () => { const h = pick(tier(heroes, level)); if (!h) return null; const t = h.wr > 0.5; return { text: <>{H(h.heroId)} wygrywa ponad połowę swoich gier.</>, truth: t, explain: <>{heroName(h.heroId)}: {Math.round(h.wr * 100)}% wygranych w {h.picks} grach.</>, page: 'bohaterowie' }; },
        () => { const t = pick(tier(teams, level)); if (!t) return null; return { text: <><b>{t.name}</b> ma więcej wygranych gier niż porażek.</>, truth: t.wins > t.losses, explain: <>{t.name}: {t.wins}–{t.losses}.</>, page: 'elo' }; },
        () => { const p = pick(tier(players, level)); if (!p) return null; const n = Math.max(2, Math.round(p.heroes.length + (r() < 0.5 ? -2 : 2))); return { text: <><b>{p.name}</b> zagrał(a) w tym sezonie więcej niż {n} różnymi bohaterami.</>, truth: p.heroes.length > n, explain: <>{p.name}: {p.heroes.length} różnych bohaterów.</>, page: 'dossier' }; },
      ];
      const s = pick(statements)(); if (!s) return null;
      return {
        ask: 'Prawda czy fałsz?', level, worth: 2, page: s.page, answer: s.truth ? 'yes' : 'no', explain: s.explain,
        clues: [s.text],
        choices: [{ id: 'yes', name: 'Prawda' }, { id: 'no', name: 'Fałsz' }],
      };
    },
    count: level => {
      const longest = [...model.games].sort((a, b) => b.duration - a.duration)[0];
      const bloody = [...model.games].sort((a, b) => b.kills - a.kills)[0];
      const asks: Array<() => Question | null> = [
        () => longest ? numeric('Ile trwała najdłuższa gra sezonu?', longest.duration, v => fmtClock(v), [0.7, 0.82, 1.18], 'historie', <>{longest.radiantTeam?.name} vs {longest.direTeam?.name}.</>) : null,
        () => bloody ? numeric('Ile zabójstw padło w najkrwawszej grze?', bloody.kills, v => String(Math.round(v)), [0.72, 0.85, 1.15], 'historie', <>{bloody.radiantTeam?.name} vs {bloody.direTeam?.name}.</>) : null,
        () => numeric('Ilu różnych bohaterów wybrano w tym sezonie?', model.heroes.filter(h => h.picks > 0).length, v => String(Math.round(v)), [0.75, 0.88, 1.12], 'kolekcja', <>Na {model.games.length} gier.</>),
      ];
      return pick(asks)();
      function numeric(ask: string, v: number, fmt: (v: number) => string, mult: number[], page: string, extra: React.ReactNode): Question {
        const opts = shuffle([v, ...mult.map(f => Math.round(v * f))], r);
        return { ask, level, worth: 2, page, answer: String(v), explain: <>Dokładnie <b>{fmt(v)}</b>. {extra}</>, clues: [<>Wybierz najbliższą odpowiedź.</>], choices: opts.map(x => ({ id: String(x), name: fmt(x) })) };
      }
    },
  };

  // Order: a mix of kinds, two easy, three medium, three hard
  const plan: Array<[string, 0 | 1 | 2]> = shuffle([['player', 0], ['hero', 0], ['team', 1], ['record', 1], ['more', 1], ['truth', 2], ['count', 2], ['player', 2]] as Array<[string, 0 | 1 | 2]>, r)
    .sort((a, b) => a[1] - b[1]);
  const out: Question[] = [];
  for (const [kind, level] of plan) {
    for (let tries = 0; tries < 6; tries++) {
      const q = makers[kind](level);
      if (q && q.choices.length >= 2 && new Set(q.choices.map(c => c.id)).size === q.choices.length && !out.some(x => x.answer === q.answer && x.ask === q.ask)) { out.push(q); break; }
    }
  }
  return out.slice(0, ROUNDS);
}

/** A spare question for the "swap" lifeline: same level, a different kind */
function spareFor(model: Model, q: Question, seed: number): Question | null {
  const pool = buildQuiz(model, seed).filter(x => x.ask !== q.ask);
  return pool.find(x => x.level === q.level) ?? pool[0] ?? null;
}

interface Best { best?: number; played?: number }

function Quiz({ model }: { model: Model }) {
  const font = useHeaderFont();
  const nav = useStatsNav();
  const statsKey = useStatsKey();
  const { tournament } = useTournament();
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 1e6));
  const base = useMemo(() => buildQuiz(model, seed), [model, seed]);
  const [swapped, setSwapped] = useState<Record<number, Question>>({});
  const quiz = base.map((q, i) => swapped[i] ?? q);
  const [round, setRound] = useState(0);
  const [clues, setClues] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [hits, setHits] = useState<boolean[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [life, setLife] = useState({ half: true, clue: true, swap: true });
  const [freeClue, setFreeClue] = useState(0);
  const [saved, setSaved] = useStored<Best>(statsKey ? `stats-hub:${statsKey}:quiz` : null, {});
  const [copied, setCopied] = useState(false);
  const q = quiz[round];
  const done = round >= quiz.length;
  const max = quiz.reduce((s, x) => s + x.worth, 0);
  const worth = q ? Math.max(1, q.worth - Math.max(0, clues - 1 - freeClue)) : 0;

  const answer = useCallback((id: string) => {
    if (picked || !q || hidden.has(id)) return;
    setPicked(id); setClues(q.clues.length);
    const ok = id === q.answer;
    setHits(h => [...h, ok]); if (ok) setPoints(p => p + worth);
  }, [picked, q, hidden, worth]);
  const next = useCallback(() => {
    setRound(r => r + 1); setClues(1); setPicked(null); setHidden(new Set()); setFreeClue(0);
  }, []);
  const restart = () => { setSeed(s => s + 7919); setSwapped({}); setRound(0); setClues(1); setPicked(null); setPoints(0); setHits([]); setHidden(new Set()); setLife({ half: true, clue: true, swap: true }); setFreeClue(0); };

  // Save the best score once the quiz ends
  useEffect(() => {
    if (!done || !quiz.length) return;
    setSaved(prev => ({ best: Math.max(prev.best ?? 0, points), played: (prev.played ?? 0) + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per finished quiz
  }, [done]);

  // Keys: 1–4 answer, Enter goes on
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q) return;
      const n = Number(e.key);
      if (!picked && n >= 1 && n <= q.choices.length) answer(q.choices[n - 1].id);
      else if (picked && e.key === 'Enter') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, picked, answer, next]);

  const fifty = () => {
    if (!q || !life.half || picked) return;
    const wrong = shuffle(q.choices.filter(c => c.id !== q.answer), Math.random).slice(0, Math.max(0, q.choices.length - 2));
    setHidden(new Set(wrong.map(c => c.id))); setLife(l => ({ ...l, half: false }));
  };
  const free = () => { if (!q || !life.clue || picked || clues >= q.clues.length) return; setClues(c => c + 1); setFreeClue(f => f + 1); setLife(l => ({ ...l, clue: false })); };
  const swap = () => {
    if (!q || !life.swap || picked) return;
    const s = spareFor(model, q, seed + 101 + round);
    if (s) { setSwapped(m => ({ ...m, [round]: s })); setClues(1); setHidden(new Set()); setFreeClue(0); }
    setLife(l => ({ ...l, swap: false }));
  };

  const progress = (
    <div className="flex items-center gap-1.5">
      {quiz.map((_, i) => <span key={i} className="h-2.5 rounded-full transition-all" style={{ width: i === round ? 30 : 14, background: hits[i] == null ? (i === round ? C.secondary : ink(18)) : hits[i] ? GOOD : BAD }} />)}
      <span className="ml-3 font-logik-extended-bold tabular-nums text-xl" style={{ color: C.heading, ...font }}>{points}</span><span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>pkt</span>
    </div>
  );

  if (done) {
    const ok = hits.filter(Boolean).length;
    const verdict = ok >= 8 ? 'Analityk roku. Kto Ci płaci?' : ok >= 6 ? 'Znasz tę ligę jak własny pick.' : ok >= 4 ? 'Coś tam oglądałeś między grami.' : ok >= 2 ? 'Feed w quizie. Jeszcze raz?' : 'Ty w ogóle grasz w tej lidze?';
    const share = async () => {
      try { await navigator.clipboard.writeText(`Kto to? · ${tournament?.name ?? ''} · ${points}/${max} pkt\n${hits.map(h => (h ? '🟩' : '🟥')).join('')}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
    };
    return (
      <>
        <LabTitle right={progress}>Kto to?</LabTitle>
        <motion.div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="text-[12px] uppercase tracking-[0.4em]" style={{ color: C.muted }}>Wynik</div>
          <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: 'clamp(80px, 16vh, 160px)', color: C.heading, ...font }}>{points}<span className="text-3xl" style={{ color: C.muted }}> / {max}</span></div>
          <div className="text-2xl font-bold" style={{ color: C.text }}>{ok} z {quiz.length} trafionych · {verdict}</div>
          <div className="text-sm" style={{ color: C.muted }}>Twój rekord: <b style={{ color: C.heading }}>{Math.max(saved.best ?? 0, points)}</b> pkt</div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={restart} className="rounded-xl px-8 py-4 text-base font-bold uppercase tracking-widest" style={{ background: C.primary, color: '#fff', boxShadow: `0 0 24px ${mix(C.primary, 45)}` }}>Nowy quiz</button>
            <button type="button" onClick={share} className="rounded-xl px-6 py-4 text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ background: ink(8), color: C.text }}><Share2 className="w-4 h-4" />{copied ? 'Skopiowano!' : 'Udostępnij'}</button>
          </div>
        </motion.div>
      </>
    );
  }
  if (!q) return <LabTitle>Kto to?</LabTitle>;
  const ok = picked != null && picked === q.answer;
  const cols = q.choices.length === 2 ? 'grid-cols-2 grid-rows-1' : 'grid-cols-2 grid-rows-2';

  return (
    <>
      <LabTitle sub={<span>pytanie {round + 1} z {quiz.length} · {LEVEL[q.level]} · klawisze 1–{q.choices.length}</span>} right={progress}>Kto to?</LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        {/* Question, clues, lifelines — and the explanation after answering */}
        <div className="w-[40%] shrink-0 flex flex-col gap-3 min-h-0">
          <div className="text-4xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{q.ask}</div>
          <div className="flex flex-col gap-2.5 mt-1">
            {q.clues.map((c, i) => (
              i < clues ? (
                <motion.div key={`${round}-${i}`} className="rounded-xl px-4 py-3 text-lg flex items-center gap-3" style={{ background: ink(6), color: C.text, border: `1px solid ${ink(10)}` }}
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}>
                  {q.clues.length > 1 && <span className="text-xs font-bold w-5 shrink-0" style={{ color: C.muted }}>{i + 1}</span>}<span className="min-w-0">{c}</span>
                </motion.div>
              ) : (
                <div key={`${round}-${i}`} className="rounded-xl px-4 py-3 text-lg" style={{ border: `1px dashed ${ink(14)}`, color: C.muted }}>
                  {i === clues && !picked ? <button type="button" onClick={() => setClues(c2 => c2 + 1)} className="text-sm uppercase tracking-widest font-bold hover:underline">Pokaż podpowiedź (−1 pkt)</button> : '···'}
                </div>
              )
            ))}
          </div>
          <AnimatePresence mode="wait">
            {picked ? (
              <motion.div key="reveal" className="mt-auto rounded-2xl p-4 flex flex-col gap-3" style={{ background: mix(ok ? GOOD : BAD, 12), border: `1px solid ${mix(ok ? GOOD : BAD, 50)}` }}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-xl font-bold" style={{ color: ok ? GOOD : BAD }}>{ok ? `Dobrze! +${worth} pkt` : 'Nie tym razem'}</div>
                <div className="text-sm leading-relaxed" style={{ color: C.text }}>{q.explain}</div>
                <div className="flex gap-2">
                  <button type="button" onClick={next} className="rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-widest text-white" style={{ background: C.primary }}>{round + 1 < quiz.length ? 'Dalej ↵' : 'Wynik ↵'}</button>
                  <button type="button" onClick={() => nav?.go(q.page)} className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), color: onDark(C.secondary) }}>{PAGE_BY_ID.get(q.page)?.title ?? 'Więcej'} ›</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="life" className="mt-auto flex flex-col gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="text-sm" style={{ color: C.muted }}>Trafienie teraz: <b className="text-xl" style={{ color: C.heading }}>{worth}</b> pkt</div>
                <div className="flex gap-2">
                  {[
                    { on: life.half && q.choices.length > 2, f: fifty, icon: Scissors, label: '50 / 50' },
                    { on: life.clue && clues < q.clues.length, f: free, icon: Lightbulb, label: 'Darmowa podpowiedź' },
                    { on: life.swap, f: swap, icon: Repeat, label: 'Zmień pytanie' },
                  ].map(l => (
                    <button key={l.label} type="button" onClick={l.f} disabled={!l.on} className="flex-1 rounded-xl px-2 py-2 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-25"
                      style={{ background: ink(6), color: C.text, border: `1px solid ${ink(12)}` }}>
                      <l.icon className="w-3.5 h-3.5" />{l.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Choices */}
        <div className="relative flex-1 min-w-0 min-h-0">
          <div className={`absolute inset-0 grid gap-4 ${cols}`}>
            {q.choices.map((ch, k) => {
              const isAns = ch.id === q.answer; const isPick = ch.id === picked; const gone = hidden.has(ch.id);
              const ring = picked ? (isAns ? GOOD : isPick ? BAD : 'transparent') : 'transparent';
              const dim = gone || (picked && !isAns && !isPick);
              return (
                <motion.button key={`${round}-${ch.id}`} type="button" onClick={() => answer(ch.id)} disabled={!!picked || gone}
                  className="relative rounded-3xl overflow-hidden flex flex-col items-center justify-center gap-3 p-3"
                  style={{ background: ch.render != null ? '#0b0b10' : ink(5), boxShadow: `0 0 0 4px ${ring}, 0 14px 30px rgba(0,0,0,0.25)` }}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: dim ? (gone ? 0.12 : 0.35) : 1, scale: picked && isAns ? 1.03 : 1 }} whileHover={picked || gone ? undefined : { scale: 1.03 }}>
                  <span className="absolute top-3 left-3 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center z-10" style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>{k + 1}</span>
                  {ch.render != null ? (
                    <>
                      <HeroImg heroId={ch.render} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-50" />
                      <div className="absolute inset-x-0 top-2 bottom-12"><HeroRender heroId={ch.render} sizes="360px" /></div>
                      <span className="absolute bottom-3 inset-x-0 text-center text-xl font-bold text-white" style={font}>{ch.name}</span>
                    </>
                  ) : ch.img ? (
                    <>
                      {ch.img(q.choices.length === 2 ? 170 : 120)}
                      <span className="text-xl font-bold max-w-full truncate" style={{ color: C.heading, ...font }}>{ch.name}</span>
                      {ch.sub && <span className="text-xs -mt-2 max-w-full truncate" style={{ color: C.muted }}>{ch.sub}</span>}
                    </>
                  ) : (
                    <span className="font-logik-extended-bold tabular-nums" style={{ fontSize: 'clamp(28px, 5vh, 52px)', color: C.heading, ...font }}>{ch.name}</span>
                  )}
                  {picked && isAns && <span className="absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-black" style={{ background: GOOD }}>{isPick ? `+${worth}` : 'to ta odpowiedź'}</span>}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default function QuizPage() {
  return <LabView><WithModel>{m => <Quiz model={m} />}</WithModel></LabView>;
}
