'use client';

// #6 — Tournament pulse. Every game is a bar on a timeline. Drag/hover to scrub: the counters
// show the tournament's totals up to that game and the card shows the game itself. Play replays
// the whole tournament. "Rozkład" turns the bars into a histogram.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameX, Model } from '@/lib/stats-lab/derive';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

type GKey = 'duration' | 'kills' | 'fb' | 'gold' | 'wards';
const GMETRICS: Record<GKey, { label: string; desc: string; get: (g: GameX) => number | null; fmt: (v: number) => string; unit: string }> = {
  duration: { label: 'Czas gry', desc: 'Długość gry', get: g => g.duration, fmt: fmtClock, unit: '' },
  kills: { label: 'Zabójstwa', desc: 'Łączna liczba zabójstw obu drużyn', get: g => g.kills, fmt: v => String(Math.round(v)), unit: '' },
  fb: { label: 'Pierwsza krew', desc: 'Kiedy padło pierwsze zabójstwo', get: g => (g.firstBlood > 0 ? g.firstBlood : null), fmt: fmtClock, unit: '' },
  gold: { label: 'Złoto', desc: 'Łączna wartość netto obu drużyn na koniec gry', get: g => g.radiantNW + g.direNW, fmt: v => `${Math.round(v / 1000)}k`, unit: '' },
  wards: { label: 'Wardy', desc: 'Wszystkie postawione wardy w grze', get: g => (g.parsed ? g.perfs.reduce((s, p) => s + p.obsPlaced + p.senPlaced, 0) : null), fmt: v => String(Math.round(v)), unit: '' },
};

const COUNTERS: Array<{ key: string; label: string; desc: string; get: (g: GameX) => number; fmt?: (v: number) => string }> = [
  { key: 'games', label: 'Gry', desc: 'Rozegrane gry', get: () => 1 },
  { key: 'hours', label: 'Godziny', desc: 'Łączny czas wszystkich gier', get: g => g.duration / 3600, fmt: v => v.toFixed(1) },
  { key: 'kills', label: 'Zabójstwa', desc: 'Wszystkie zabójstwa', get: g => g.kills },
  { key: 'ramp', label: 'Rampage', desc: 'Pięć zabójstw w krótkim czasie przez jednego gracza', get: g => g.perfs.reduce((s, p) => s + p.rampages, 0) },
  { key: 'ultra', label: 'Ultra kille', desc: 'Cztery zabójstwa w krótkim czasie', get: g => g.perfs.reduce((s, p) => s + p.ultraKills, 0) },
  { key: 'rosh', label: 'Roshany', desc: 'Zabite Roshany', get: g => g.perfs.reduce((s, p) => s + p.roshanKills, 0) },
  { key: 'towers', label: 'Wieże', desc: 'Zniszczone wieże', get: g => g.perfs.reduce((s, p) => s + p.towerKills, 0) },
  { key: 'wards', label: 'Wardy', desc: 'Postawione wardy', get: g => g.perfs.reduce((s, p) => s + p.obsPlaced + p.senPlaced, 0) },
  { key: 'gold', label: 'Złoto', desc: 'Zarobione złoto (mln)', get: g => g.perfs.reduce((s, p) => s + p.totalGold, 0), fmt: v => `${(v / 1e6).toFixed(1)}M` },
];

const fmtDay = (unix: number) => new Date(unix * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

function GameCard({ g }: { g: GameX }) {
  const font = useHeaderFont();
  const side = (radiant: boolean) => {
    const team = radiant ? g.radiantTeam : g.direTeam;
    const won = radiant === g.radiantWin;
    return (
      <div className="flex-1 min-w-0 flex flex-col items-center gap-1" style={{ opacity: won ? 1 : 0.55 }}>
        <TeamLogo team={team} size={40} />
        <span className="text-[11px] font-semibold truncate max-w-full">{team?.name}</span>
        <span className="text-2xl font-logik-extended-bold tabular-nums leading-none" style={{ color: won ? C.win : undefined, ...font }}>{radiant ? g.radiantKills : g.direKills}</span>
      </div>
    );
  };
  return (
    <motion.div key={g.idx} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="h-full rounded-2xl p-3 flex flex-col gap-2" style={{ background: ink(4), border: `1px solid ${ink(10)}` }}>
      <div className="flex justify-between text-[10px] uppercase tracking-widest" style={{ color: C.muted }}><span>Gra {g.idx + 1}</span><span>{fmtDay(g.start)}</span></div>
      <div className="flex items-start gap-2">{side(true)}<span className="pt-3 text-xs opacity-40">vs</span>{side(false)}</div>
      <div className="flex justify-center gap-4 text-xs tabular-nums">
        <Tip content="Długość gry"><span className="cursor-help">{fmtClock(g.duration)}</span></Tip>
        {g.firstBlood > 0 && <Tip content="Czas pierwszej krwi"><span className="cursor-help" style={{ color: C.loss }}>FB {fmtClock(g.firstBlood)}</span></Tip>}
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-x-2 overflow-hidden">
        {[true, false].map(radiant => (
          <div key={String(radiant)} className="flex flex-col justify-around min-h-0">
            {g.perfs.filter(p => p.radiant === radiant).sort((a, b) => b.netWorth - a.netWorth).map(p => (
              <Tip key={p.idx} content={<TipBody title={p.player?.name ?? 'Gracz'}>{heroName(p.heroId)} · {p.kills}/{p.deaths}/{p.assists} · {p.gpm} GPM</TipBody>}>
                <div className="flex items-center gap-1 min-w-0">
                  <HeroImg heroId={p.heroId} variant="icon" className="w-5 h-5 shrink-0" />
                  <span className="text-[10px] truncate flex-1">{p.player?.name ?? '—'}</span>
                  <span className="text-[10px] tabular-nums" style={{ color: C.muted }}>{p.kills}/{p.deaths}/{p.assists}</span>
                </div>
              </Tip>
            ))}
          </div>
        ))}
      </div>
      {g.mvp && (
        <Tip content={<TipBody title="Gracz meczu (najwięcej punktów fantasy)">{g.mvp.kills}/{g.mvp.deaths}/{g.mvp.assists} · {g.mvp.gpm} GPM</TipBody>}>
          <div className="relative rounded-xl overflow-hidden h-16 cursor-help">
            <HeroImg heroId={g.mvp.heroId} className="absolute inset-0 w-full h-full opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 to-black/20" />
            <div className="relative h-full flex items-center gap-2 px-2 text-white">
              <Avatar player={g.mvp.player} size={32} ring={C.secondary} />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{g.mvp.player?.name ?? '—'}</div>
                <div className="text-[10px] opacity-70 truncate">{heroName(g.mvp.heroId)} · {g.mvp.kills}/{g.mvp.deaths}/{g.mvp.assists}</div>
              </div>
              <span className="ml-auto text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: C.secondary, color: '#000' }}>MVP</span>
            </div>
          </div>
        </Tip>
      )}
    </motion.div>
  );
}

function Pulse({ model }: { model: Model }) {
  const font = useHeaderFont();
  const games = model.games;
  const [gk, setGk] = useState<GKey>('duration');
  const [view, setView] = useState<'time' | 'dist'>('time');
  const [cursor, setCursor] = useState(games.length - 1);
  const [playing, setPlaying] = useState(false);
  const [ref, size] = useSize<HTMLDivElement>();
  const dragging = useRef(false);
  const gm = GMETRICS[gk];

  const values = useMemo(() => games.map(gm.get), [games, gm]);
  const known = values.filter((v): v is number => v != null);
  const max = Math.max(1, ...known);
  const min = Math.min(...known, 0);
  const sorted = [...known].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  // Prefix sums for the counters
  const prefix = useMemo(() => COUNTERS.map(c => { let s = 0; return games.map(g => (s += c.get(g))); }), [games]);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= games.length - 1) setCursor(0);
    const id = setInterval(() => setCursor(c => { if (c >= games.length - 1) { setPlaying(false); return c; } return c + 1; }), Math.max(20, 6000 / games.length));
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const W = size.w; const H = Math.max(60, size.h - 22);
  const bw = W / games.length;
  const idxAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(games.length - 1, Math.floor(((clientX - r.left) / r.width) * games.length)));
  };

  // Histogram
  const bins = useMemo(() => {
    const n = 16; const lo = sorted[0] ?? 0; const hi = sorted[sorted.length - 1] ?? 1; const step = (hi - lo) / n || 1;
    const b = Array.from({ length: n }, (_, i) => ({ from: lo + i * step, to: lo + (i + 1) * step, games: [] as GameX[] }));
    games.forEach((g, i) => { const v = values[i]; if (v == null) return; b[Math.min(n - 1, Math.floor((v - lo) / step))].games.push(g); });
    return b;
  }, [games, values, sorted]);
  const binMax = Math.max(1, ...bins.map(b => b.games.length));
  const extremes = useMemo(() => {
    const idx = values.map((v, i) => ({ v, i })).filter(x => x.v != null) as Array<{ v: number; i: number }>;
    idx.sort((a, b) => a.v - b.v);
    return { lo: idx[0], hi: idx[idx.length - 1] };
  }, [values]);

  const g = games[cursor];
  const day = (i: number) => new Date(games[i].start * 1000).toDateString();

  return (
    <>
      <LabTitle
        sub={<span>{fmtDay(games[0].start)} — {fmtDay(games[games.length - 1].start)}</span>}
        right={<div className="hidden md:flex gap-2"><Seg size="sm" value={gk} onChange={setGk} options={(Object.keys(GMETRICS) as GKey[]).map(k => ({ value: k, label: GMETRICS[k].label, tip: GMETRICS[k].desc }))} /><Seg size="sm" value={view} onChange={setView} options={[{ value: 'time', label: 'Oś czasu', tip: 'Każda gra po kolei' }, { value: 'dist', label: 'Rozkład', tip: 'Ile gier miało daną wartość' }]} /></div>}
      >
        Puls turnieju
      </LabTitle>

      {/* Counters */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-9 gap-2 mt-3">
        {COUNTERS.map((c, i) => {
          const v = prefix[i][cursor] ?? 0;
          return (
            <Tip key={c.key} content={<TipBody title={c.label}>{c.desc} — do gry {cursor + 1}</TipBody>}>
              <div className="rounded-xl px-2 py-1.5 text-center cursor-help" style={{ background: ink(4) }}>
                <div className="text-xl xl:text-2xl font-logik-extended-bold tabular-nums leading-none" style={{ color: i === 0 ? C.secondary : C.heading, ...font }}>{c.fmt ? c.fmt(v) : Math.round(v).toLocaleString('pl-PL')}</div>
                <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{c.label}</div>
              </div>
            </Tip>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex gap-4 mt-3">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div
            ref={ref}
            className="relative flex-1 min-h-0 select-none touch-none"
            style={{ cursor: view === 'time' ? 'ew-resize' : 'default' }}
            onPointerDown={e => { if (view !== 'time') return; dragging.current = true; setPlaying(false); (e.target as Element).setPointerCapture?.(e.pointerId); setCursor(idxAt(e.clientX)); }}
            onPointerMove={e => { if (view === 'time' && (dragging.current || e.pointerType === 'mouse')) setCursor(idxAt(e.clientX)); }}
            onPointerUp={() => { dragging.current = false; }}
          >
            {W > 0 && view === 'time' && (
              <svg width={W} height={H + 22} className="absolute inset-0 overflow-visible">
                <line x1={0} x2={W} y1={H} y2={H} stroke={ink(15)} />
                {/* day separators */}
                {games.map((_, i) => (i > 0 && day(i) !== day(i - 1) ? <line key={`d${i}`} x1={i * bw} x2={i * bw} y1={0} y2={H} stroke={ink(5)} /> : null))}
                {games.map((game, i) => {
                  const v = values[i];
                  const t = v == null ? 0 : (v - min) / (max - min);
                  const h = v == null ? 3 : Math.max(2, t * H * 0.95);
                  const past = i <= cursor;
                  return (
                    <rect key={game.idx} x={i * bw + bw * 0.15} y={H - h} width={Math.max(1, bw * 0.7)} height={h} rx={Math.min(3, bw * 0.3)}
                      fill={v == null ? ink(10) : `color-mix(in srgb, ${C.secondary} ${Math.round(t * 100)}%, ${C.primary})`} opacity={past ? 1 : 0.22} />
                  );
                })}
                <line x1={0} x2={W} y1={H - ((median - min) / (max - min)) * H * 0.95} y2={H - ((median - min) / (max - min)) * H * 0.95} stroke={C.text} strokeOpacity={0.5} strokeDasharray="4 4" />
                <text x={4} y={H - ((median - min) / (max - min)) * H * 0.95 - 5} fontSize={10} fontWeight={700} fill="currentColor" stroke="rgba(0,0,0,0.6)" strokeWidth={3} paintOrder="stroke">mediana {gm.fmt(median)}</text>
                {/* cursor */}
                <line x1={(cursor + 0.5) * bw} x2={(cursor + 0.5) * bw} y1={0} y2={H} stroke={C.text} strokeOpacity={0.6} />
                <circle cx={(cursor + 0.5) * bw} cy={H + 9} r={7} fill={C.secondary} />
                <text x={(cursor + 0.5) * bw} y={-4} textAnchor="middle" fontSize={12} fontWeight={700} fill="currentColor">{values[cursor] != null ? gm.fmt(values[cursor]!) : '–'}</text>
              </svg>
            )}
            {W > 0 && view === 'dist' && (
              <div className="absolute inset-0 flex items-end gap-1 pb-5">
                {bins.map((b, i) => (
                  <Tip key={i} content={<TipBody title={`${gm.fmt(b.from)} – ${gm.fmt(b.to)}`}>{b.games.length} gier</TipBody>}>
                    <div className="relative flex-1 h-full flex flex-col justify-end cursor-help">
                      <motion.div initial={{ height: 0 }} animate={{ height: `${(b.games.length / binMax) * 92}%` }} className="rounded-t-md"
                        style={{ background: `color-mix(in srgb, ${C.secondary} ${Math.round((i / bins.length) * 100)}%, ${C.primary})` }} />
                      <span className="absolute -bottom-5 inset-x-0 text-center text-[9px] tabular-nums" style={{ color: C.muted }}>{i % 3 === 0 ? gm.fmt(b.from) : ''}</span>
                    </div>
                  </Tip>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-3 mt-1">
            <button type="button" onClick={() => setPlaying(p => !p)} className="rounded-full px-4 py-1.5 text-[11px] uppercase tracking-widest font-bold"
              style={{ background: playing ? ink(10) : C.primary, color: playing ? C.text : '#fff' }}>{playing ? '❚❚' : '▶'}</button>
            {view === 'dist' && extremes.lo && extremes.hi && (
              <div className="flex gap-4 text-[11px]" style={{ color: C.muted }}>
                <span>min <b style={{ color: C.text }}>{gm.fmt(extremes.lo.v)}</b></span>
                <span>mediana <b style={{ color: C.text }}>{gm.fmt(median)}</b></span>
                <span>max <b style={{ color: C.text }}>{gm.fmt(extremes.hi.v)}</b></span>
              </div>
            )}
            {view === 'time' && <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Gra {cursor + 1} z {games.length}</span>}
          </div>
        </div>
        <div className="w-[280px] shrink-0 hidden md:block">
          <GameCard g={view === 'dist' && extremes.hi ? games[gk === 'fb' ? extremes.lo.i : extremes.hi.i] : g} />
        </div>
      </div>
    </>
  );
}

export default function D06Pulse() {
  return <LabView><WithModel>{m => <Pulse model={m} />}</WithModel></LabView>;
}
