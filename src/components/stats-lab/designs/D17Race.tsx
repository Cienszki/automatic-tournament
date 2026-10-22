'use client';

// #17 — Race. A bar-chart race of running totals: press play and watch players (or teams)
// overtake each other game by game. Scrub with the slider; the watermark shows the date.

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameX, Model, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { Avatar, C, LabTitle, LabView, Seg, TeamLogo, Tip, WithModel, ink, mix, playerTip, useHeaderFont, useSize } from '../kit';

/** One game per 0.6 s — the whole season plays in about a minute */
const STEP_MS = 600;

type Kind = 'players' | 'teams';
interface RaceMetric { key: string; label: string; tip: string; player?: (g: GameX, pid: string) => number; team?: (g: GameX, tid: string) => number; fmt?: (v: number) => string }

const sumP = (g: GameX, pid: string, f: (p: GameX['perfs'][number]) => number) => g.perfs.reduce((s, p) => (p.pid === pid ? s + f(p) : s), 0);
const sumT = (g: GameX, tid: string, f: (p: GameX['perfs'][number]) => number) => g.perfs.reduce((s, p) => (p.tid === tid ? s + f(p) : s), 0);
const METRICS: Record<Kind, RaceMetric[]> = {
  players: [
    { key: 'score', label: 'Punkty fantasy', tip: 'Suma punktów fantasy', player: (g, id) => sumP(g, id, p => (Number.isFinite(p.score) ? p.score : 0)), fmt: v => v.toFixed(0) },
    { key: 'kills', label: 'Zabójstwa', tip: 'Suma zabójstw', player: (g, id) => sumP(g, id, p => p.kills) },
    { key: 'assists', label: 'Asysty', tip: 'Suma asyst', player: (g, id) => sumP(g, id, p => p.assists) },
    { key: 'gold', label: 'Złoto', tip: 'Całe zarobione złoto', player: (g, id) => sumP(g, id, p => p.totalGold), fmt: v => `${(v / 1000).toFixed(0)}k` },
    { key: 'wards', label: 'Wardy', tip: 'Postawione wardy', player: (g, id) => sumP(g, id, p => p.obsPlaced + p.senPlaced) },
    { key: 'wins', label: 'Wygrane', tip: 'Wygrane gry', player: (g, id) => (g.perfs.some(p => p.pid === id && p.win) ? 1 : 0) },
  ],
  teams: [
    { key: 'wins', label: 'Wygrane', tip: 'Wygrane gry', team: (g, id) => (g.winnerId === id ? 1 : 0) },
    { key: 'kills', label: 'Zabójstwa', tip: 'Suma zabójstw drużyny', team: (g, id) => sumT(g, id, p => p.kills) },
    { key: 'gold', label: 'Złoto', tip: 'Całe zarobione złoto drużyny', team: (g, id) => sumT(g, id, p => p.totalGold), fmt: v => `${(v / 1e6).toFixed(2)}M` },
    { key: 'towers', label: 'Wieże', tip: 'Zniszczone wieże', team: (g, id) => sumT(g, id, p => p.towerKills) },
  ],
};

function Race({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [kind, setKind] = useState<Kind>('players');
  const [mk, setMk] = useState<Record<Kind, string>>({ players: 'score', teams: 'wins' });
  const n = model.games.length;
  const [t, setT] = useState(n - 1);
  const [playing, setPlaying] = useState(false);
  const K = 10;
  const [ref, box] = useSize<HTMLDivElement>();
  const m = METRICS[kind].find(x => x.key === mk[kind])!;
  const fmt = m.fmt ?? ((v: number) => Math.round(v).toLocaleString('pl-PL'));

  // Cumulative series per entity
  const series = useMemo(() => {
    const ents: Array<{ id: string; e: PlayerX | TeamX; cum: number[] }> = [];
    const list = kind === 'players' ? model.players : model.teams;
    for (const e of list) {
      const cum = new Array<number>(n); let s = 0;
      const touched = kind === 'players' ? new Set((e as PlayerX).perfs.map(p => p.game.idx)) : new Set((e as TeamX).games.map(g => g.idx));
      for (let i = 0; i < n; i++) {
        if (touched.has(i)) s += kind === 'players' ? m.player!(model.games[i], e.id) : m.team!(model.games[i], e.id);
        cum[i] = s;
      }
      ents.push({ id: e.id, e, cum });
    }
    return ents;
  }, [model, kind, m, n]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT(x => { if (x >= n - 1) { setPlaying(false); return x; } return x + 1; }), STEP_MS);
    return () => clearInterval(id);
  }, [playing, n]);

  const ranked = [...series].sort((a, b) => b.cum[t] - a.cum[t]).slice(0, K);
  const max = Math.max(1e-9, ranked[0]?.cum[t] ?? 1);
  const rowH = Math.max(40, Math.floor(box.h / K));
  const g = model.games[t];
  const date = new Date(g.start * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
  const palette = [C.primary, C.secondary, C.accent, '#7aa2f7', '#9ece6a', '#bb9af7', '#e0af68', '#73daca'];
  const colorOf = (e: PlayerX | TeamX) => {
    const tid = kind === 'players' ? (e as PlayerX).teamId : e.id;
    const i = model.teams.findIndex(x => x.id === tid);
    return palette[(i < 0 ? 0 : i) % palette.length];
  };

  return (
    <>
      <LabTitle
        sub={<Tip content={m.tip}><span className="cursor-help">{m.label} — suma narastająco</span></Tip>}
        right={<div className="hidden md:flex gap-2">
          <Seg size="sm" value={mk[kind]} onChange={v => setMk(x => ({ ...x, [kind]: v }))} options={METRICS[kind].map(x => ({ value: x.key, label: x.label, tip: x.tip }))} />
          <Seg size="sm" value={kind} onChange={setKind} options={[{ value: 'players', label: 'Gracze' }, { value: 'teams', label: 'Drużyny' }]} />
        </div>}
      >
        Wyścig
      </LabTitle>
      <div className="relative flex-1 min-h-0 mt-3">
        {/* Date watermark */}
        <div className="absolute right-2 bottom-2 text-right pointer-events-none select-none">
          <div className="font-logik-extended-bold uppercase leading-none" style={{ fontSize: 'clamp(36px, 8vh, 84px)', color: ink(12), ...font }}>{date}</div>
          <div className="text-xs uppercase tracking-[0.3em] mt-1" style={{ color: ink(30) }}>gra {t + 1} / {n}</div>
        </div>
        <div ref={ref} className="relative h-full overflow-hidden">
          {ranked.map((r, i) => {
            const v = r.cum[t];
            const color = colorOf(r.e);
            return (
              <motion.div key={r.id} className="absolute left-0 right-0 flex items-center gap-2" style={{ height: rowH - 6 }}
                initial={false} animate={{ y: i * rowH, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
                <span className="w-8 text-right text-xl tabular-nums font-bold" style={{ color: C.muted, ...font }}>{i + 1}</span>
                <Tip content={kind === 'players' ? playerTip(r.e as PlayerX) : r.e.name}>
                  <span className="shrink-0">{kind === 'players' ? <Avatar player={r.e as PlayerX} size={Math.min(56, rowH - 10)} /> : <TeamLogo team={r.e as TeamX} size={Math.min(56, rowH - 10)} />}</span>
                </Tip>
                <div className="flex-1 min-w-0 h-full relative">
                  <motion.div className="absolute inset-y-0 left-0 rounded-r-xl flex items-center px-3 overflow-hidden" initial={false}
                    animate={{ width: `${Math.max(1, (v / max) * 84)}%` }} transition={{ type: 'tween', ease: 'linear', duration: playing ? STEP_MS / 1000 : 0.4 }}
                    style={{ background: `linear-gradient(90deg, ${mix(color, 45)}, ${color})` }}>
                    <span className="text-base font-bold text-white truncate drop-shadow">{r.e.name}</span>
                  </motion.div>
                  <motion.span className="absolute top-1/2 -translate-y-1/2 text-2xl font-logik-extended-bold tabular-nums pl-3" initial={false}
                    animate={{ left: `${Math.max(1, (v / max) * 84)}%` }} transition={{ type: 'tween', ease: 'linear', duration: playing ? STEP_MS / 1000 : 0.4 }} style={font}>{fmt(v)}</motion.span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3 mt-2">
        <button type="button" onClick={() => { if (!playing && t >= n - 1) setT(0); setPlaying(p => !p); }}
          className="rounded-full w-10 h-10 font-bold" style={{ background: playing ? ink(10) : C.primary, color: playing ? C.text : '#fff', boxShadow: playing ? 'none' : `0 0 18px ${mix(C.primary, 50)}` }}
          aria-label={playing ? 'Pauza' : 'Odtwórz'}>{playing ? '❚❚' : '▶'}</button>
        <input type="range" min={0} max={n - 1} value={t} onChange={e => { setPlaying(false); setT(Number(e.target.value)); }}
          className="flex-1 accent-current" style={{ color: 'var(--tournament-primary)' }} aria-label="Gra" />
      </div>
    </>
  );
}

export default function D17Race() {
  return <LabView><WithModel>{m => <Race model={m} />}</WithModel></LabView>;
}
