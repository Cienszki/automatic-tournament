'use client';

// #55 — Dotadle. Guess today's mystery player (like LoLdle / Dotadle): every guess shows how close
// it is — same team, position (or a neighbour), more or fewer games, win rate and performance,
// same favourite hero. Eight tries; a new player every day, or roll one any time.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { POS_OF, plural, qualified, seededRandom } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont } from '../kit';

const TRIES = 8;
const GREEN = '#2fbf71';
const YELLOW = '#e3b341';
const GREY = '#3a3d48';
const norm = (s: string) => s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');

type Mark = 'ok' | 'near' | 'no';
const bg = (m: Mark) => (m === 'ok' ? GREEN : m === 'near' ? YELLOW : GREY);

const COLS = [
  { key: 'team', label: 'Drużyna', tip: 'Zielony: ta sama drużyna' },
  { key: 'pos', label: 'Pozycja', tip: 'Zielony: ta sama pozycja · żółty: sąsiednia' },
  { key: 'games', label: 'Gry', tip: 'Strzałka mówi, czy szukany gracz ma więcej, czy mniej gier · żółty: różnica do 20%' },
  { key: 'wr', label: '% wygr.', tip: 'Procent wygranych gier · żółty: różnica do 5 p.p.' },
  { key: 'score', label: 'Pkt/grę', tip: 'Średnia punktów występu · żółty: różnica do 1 pkt' },
  { key: 'hero', label: 'Bohater', tip: 'Najczęściej grany bohater · żółty: jest w trójce ulubionych szukanego' },
] as const;

function compare(g: PlayerX, t: PlayerX) {
  const num = (a: number, b: number, tol: number): { m: Mark; dir: 0 | 1 | -1 } => ({ m: a === b || Math.abs(a - b) < 1e-9 ? 'ok' : Math.abs(a - b) <= tol ? 'near' : 'no', dir: b > a ? 1 : b < a ? -1 : 0 });
  const gp = POS_OF[g.role ?? ''] ?? 0; const tp = POS_OF[t.role ?? ''] ?? 0;
  const gh = g.heroes[0]?.heroId; const th = t.heroes.slice(0, 3).map(h => h.heroId);
  const gs = g.agg.score.avg ?? 0; const ts = t.agg.score.avg ?? 0;
  return {
    team: { m: (g.teamId && g.teamId === t.teamId ? 'ok' : 'no') as Mark },
    pos: { m: (gp && gp === tp ? 'ok' : gp && tp && Math.abs(gp - tp) === 1 ? 'near' : 'no') as Mark },
    games: num(g.games, t.games, t.games * 0.2),
    wr: num(Math.round(g.wr * 100), Math.round(t.wr * 100), 5),
    score: num(Math.round(gs * 10) / 10, Math.round(ts * 10) / 10, 1),
    hero: { m: (gh != null && gh === th[0] ? 'ok' : gh != null && th.includes(gh) ? 'near' : 'no') as Mark },
  };
}

function Dotadle({ model }: { model: Model }) {
  const font = useHeaderFont();
  const pool = useMemo(() => qualified(model).sort((a, b) => a.id.localeCompare(b.id)), [model]);
  const today = useMemo(() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }, []);
  const [seed, setSeed] = useState(today);
  const target = useMemo(() => { const r = seededRandom(seed); r(); return pool[Math.floor(r() * pool.length)]; }, [pool, seed]);
  const [guesses, setGuesses] = useState<PlayerX[]>([]);
  const [q, setQ] = useState('');
  const won = !!target && guesses.some(g => g.id === target.id);
  const lost = !won && guesses.length >= TRIES;
  const done = won || lost;
  const sugg = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    return model.players.filter(p => !guesses.includes(p) && norm(p.name).includes(n)).sort((a, b) => Number(norm(b.name).startsWith(n)) - Number(norm(a.name).startsWith(n)) || b.games - a.games).slice(0, 6);
  }, [q, model, guesses]);
  const guess = (p: PlayerX) => { if (done) return; setGuesses(g => [...g, p]); setQ(''); };
  const reset = (s: number) => { setSeed(s); setGuesses([]); setQ(''); };

  if (!target) return <LabTitle>Dotadle</LabTitle>;
  return (
    <>
      <LabTitle sub={<span>{seed === today ? 'gracz dnia' : 'losowy gracz'} · {guesses.length} / {TRIES} prób</span>}
        right={<button type="button" onClick={() => reset(Math.floor(Math.random() * 1e9))} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), border: `1px solid ${ink(14)}`, color: C.text }}>Losuj innego</button>}>
        Dotadle
      </LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        {/* Board */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="grid gap-2 shrink-0 mb-1.5" style={{ gridTemplateColumns: '220px repeat(6, 1fr)' }}>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Gracz</span>
            {COLS.map(c => <Tip key={c.key} content={c.tip}><span className="text-[10px] uppercase tracking-widest text-center cursor-help" style={{ color: C.muted }}>{c.label}</span></Tip>)}
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-1.5">
            {Array.from({ length: TRIES }, (_, i) => {
              const g = guesses[i];
              if (!g) return <div key={i} className="flex-1 max-h-14 rounded-xl" style={{ border: `1px dashed ${ink(12)}` }} />;
              const r = compare(g, target);
              const cells: Array<{ m: Mark; node: React.ReactNode; dir?: number }> = [
                { m: r.team.m, node: <TeamLogo team={g.team} size={30} /> },
                { m: r.pos.m, node: <span className="text-lg font-bold">{POS_OF[g.role ?? ''] ?? '–'}</span> },
                { m: r.games.m, node: <span className="text-lg font-bold tabular-nums">{g.games}</span>, dir: r.games.dir },
                { m: r.wr.m, node: <span className="text-lg font-bold tabular-nums">{Math.round(g.wr * 100)}%</span>, dir: r.wr.dir },
                { m: r.score.m, node: <span className="text-lg font-bold tabular-nums">{(g.agg.score.avg ?? 0).toFixed(1)}</span>, dir: r.score.dir },
                { m: r.hero.m, node: g.heroes[0] ? <HeroImg heroId={g.heroes[0].heroId} className="rounded w-full h-full" /> : '–' },
              ];
              return (
                <div key={g.id} className="flex-1 max-h-14 grid gap-2" style={{ gridTemplateColumns: '220px repeat(6, 1fr)' }}>
                  <motion.div className="flex items-center gap-2.5 rounded-xl px-2 min-w-0" style={{ background: ink(5) }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <Avatar player={g} size={40} /><span className="truncate font-bold">{g.name}</span>
                  </motion.div>
                  {cells.map((c, k) => (
                    <motion.div key={k} className="relative rounded-xl flex items-center justify-center gap-1 overflow-hidden text-white" style={{ background: bg(c.m), perspective: 600 }}
                      initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ delay: 0.12 * k, duration: 0.35 }}>
                      {c.node}
                      {c.dir ? <span className="text-base font-bold" title={c.dir > 0 ? 'szukany ma więcej' : 'szukany ma mniej'}>{c.dir > 0 ? '↑' : '↓'}</span> : null}
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        {/* Input / result */}
        <div className="w-[340px] shrink-0 flex flex-col gap-3">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done" className="flex-1 rounded-3xl flex flex-col items-center justify-center gap-3 text-center p-5" style={{ background: mix(won ? GREEN : C.loss, 16), border: `1px solid ${mix(won ? GREEN : C.loss, 45)}` }}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: C.muted }}>{won ? 'Trafione!' : 'Szukany gracz'}</div>
                <Avatar player={target} size={150} ring={won ? GREEN : C.loss} />
                <div className="text-3xl font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>{target.name}</div>
                <div className="flex items-center gap-2 text-sm" style={{ color: C.muted }}><TeamLogo team={target.team} size={22} />{target.team?.name}</div>
                {won && <div className="text-lg font-bold" style={{ color: C.heading }}>w {guesses.length} {plural(guesses.length, 'próbie', 'próbach', 'próbach')}</div>}
                <button type="button" onClick={() => reset(Math.floor(Math.random() * 1e9))} className="mt-2 rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Następny gracz</button>
              </motion.div>
            ) : (
              <motion.div key="play" className="flex flex-col gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="rounded-3xl p-5 flex flex-col items-center gap-2" style={{ background: ink(4), border: `1px solid ${ink(10)}` }}>
                  <div className="w-[110px] h-[110px] rounded-full flex items-center justify-center text-5xl font-logik-extended-bold" style={{ background: mix(C.primary, 35), color: C.heading, ...font }}>?</div>
                  <div className="text-sm" style={{ color: C.muted }}>Kim jest dzisiejszy gracz?</div>
                </div>
                <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && sugg[0]) guess(sugg[0]); }}
                  placeholder="Wpisz nick…" aria-label="Nick gracza" spellCheck={false} autoComplete="off"
                  className="w-full rounded-xl px-4 py-3 text-lg outline-none" style={{ background: ink(6), border: `2px solid ${mix(C.secondary, 50)}`, color: C.heading }} />
                <div className="flex flex-col gap-1.5">
                  {sugg.map(p => (
                    <button key={p.id} type="button" onClick={() => guess(p)} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:brightness-125" style={{ background: ink(6) }}>
                      <Avatar player={p} size={36} /><span className="flex-1 truncate font-bold">{p.name}</span><TeamLogo team={p.team} size={22} />
                    </button>
                  ))}
                  {!q && guesses.length === 0 && <div className="text-xs leading-relaxed" style={{ color: C.muted }}>Każda próba podpowiada: zielony = trafione, żółty = blisko, strzałka = szukany ma więcej lub mniej.</div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {guesses.length > 0 && !done && target.heroes[0] && guesses.length >= 5 && (
            <Tip content={<TipBody title="Podpowiedź">Pojawia się po 5 próbach</TipBody>}>
              <div className="rounded-xl px-3 py-2 text-sm cursor-help" style={{ background: ink(5), color: C.text }}>Podpowiedź: gra często <b>{heroName(target.heroes[0].heroId)}</b></div>
            </Tip>
          )}
        </div>
      </div>
    </>
  );
}

export default function D55Dotadle() {
  return <LabView><WithModel>{m => <Dotadle model={m} />}</WithModel></LabView>;
}
