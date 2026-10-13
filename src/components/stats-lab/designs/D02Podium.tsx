'use client';

// #2 — League leaders. Pick a metric from the rail, choose average / total / best game,
// filter by position. Top three stand on a podium (height = value), the rest form a ladder
// that fits the available height and pages instead of scrolling.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GROUP_LABEL, metric, type MetricGroup, type MetricKey } from '@/lib/stats-lab/metrics';
import { rankPlayers, type Model, type PlayerX, type RankMode, type RankRow } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, Pager, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, playerTip, useFitCount, useHeaderFont, useMetals, usePages, useSize } from '../kit';

const RAIL: MetricKey[] = ['fantasy', 'kills', 'deaths', 'assists', 'kda', 'kp', 'hdpm', 'heroDamage', 'gpm', 'xpm', 'lastHits', 'lhpm', 'denies', 'netWorth', 'wards', 'dewards', 'stacks', 'runes', 'heroHealing', 'towerDamage', 'roshanKills', 'courierKills', 'streak', 'multi'];
const POS = [
  { v: 'all', label: 'Wszyscy', role: '' },
  { v: '1', label: '1', role: 'Carry' },
  { v: '2', label: '2', role: 'Mid' },
  { v: '3', label: '3', role: 'Offlane' },
  { v: '4', label: '4', role: 'Soft Support' },
  { v: '5', label: '5', role: 'Hard Support' },
] as const;
const MODES: Array<{ value: RankMode; label: string; tip: string }> = [
  { value: 'avg', label: 'Średnio', tip: 'Średnia na grę (tylko gracze z minimalną liczbą gier)' },
  { value: 'total', label: 'Łącznie', tip: 'Suma ze wszystkich gier turnieju' },
  { value: 'best', label: 'Najlepsza gra', tip: 'Najlepszy pojedynczy występ gracza' },
];

function Spark({ player, k, color }: { player: PlayerX; k: MetricKey; color: string }) {
  const m = metric(k);
  const vals = player.perfs.filter(p => !m.parsedOnly || p.parsed).map(p => m.get(p));
  if (vals.length < 2) return null;
  const max = Math.max(...vals, 1e-9); const min = Math.min(...vals, 0);
  const w = 90; const h = 22;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' ');
  return (
    <Tip content={<TipBody title="Forma">Wartość w kolejnych grach: {vals.map(v => m.fmt(v)).join(' · ')}</TipBody>}>
      <svg width={w} height={h} className="overflow-visible cursor-help">
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx={w} cy={h - ((vals[vals.length - 1] - min) / (max - min || 1)) * h} r={2.5} fill={color} />
      </svg>
    </Tip>
  );
}

const fmtVal = (k: MetricKey, mode: RankMode, v: number) => {
  const m = metric(k);
  if (mode === 'avg') return k === 'kp' ? m.fmt(v) : v.toLocaleString('pl-PL', { maximumFractionDigits: m.avgDigits, minimumFractionDigits: m.avgDigits });
  return m.fmt(v);
};

function Podium({ rows, k, mode }: { rows: RankRow[]; k: MetricKey; mode: RankMode }) {
  const font = useHeaderFont();
  const m = metric(k);
  const metals = useMetals();
  const order = [1, 0, 2];
  const top = rows[0]?.value || 1;
  const heights = [1, 0.74, 0.56];
  const [ref, size] = useSize<HTMLDivElement>();
  // Space left for pedestals after avatar, name, value and sparkline
  const maxPed = Math.max(40, size.h - 200);
  return (
    <div ref={ref} className="flex items-end justify-center gap-3 h-full">
      {order.map(i => {
        const r = rows[i];
        if (!r) return <div key={i} className="w-[30%]" />;
        const color = i === 0 ? C.secondary : i === 1 ? metals[1] : metals[0];
        const ratio = m.better === 'low' && mode === 'avg' ? (r.value ? top / r.value : 1) : r.value / top;
        const pedestal = maxPed * heights[i] * (0.6 + 0.4 * Math.min(1, ratio));
        return (
          <motion.div key={r.player.id} layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 24, delay: i * 0.06 }}
            className="w-[30%] max-w-[230px] flex flex-col items-center h-full justify-end min-h-0">
            <Tip content={playerTip(r.player)}>
              <div className="relative">
                <Avatar player={r.player} size={i === 0 ? 76 : 60} ring={color} />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black" style={{ background: color }}>{i + 1}</span>
              </div>
            </Tip>
            <div className="mt-2 flex items-center gap-1.5 max-w-full">
              <TeamLogo team={r.player.team} size={16} />
              <span className="font-bold truncate">{r.player.name}</span>
            </div>
            <div className="text-3xl xl:text-4xl font-logik-extended-bold tabular-nums leading-none mt-1" style={{ color, ...font }}>{fmtVal(k, mode, r.value)}</div>
            <div className="h-6 mt-1 flex items-center">
              {mode === 'best' && r.perf
                ? <Tip content={`${heroName(r.perf.heroId)} · ${r.perf.win ? 'wygrana' : 'przegrana'}`}><span><HeroImg heroId={r.perf.heroId} className="h-6 w-11 rounded" /></span></Tip>
                : <Spark player={r.player} k={k} color={color} />}
            </div>
            <div className="w-full mt-2 rounded-t-xl relative overflow-hidden" style={{ height: pedestal, background: `linear-gradient(180deg, ${mix(color, 35)}, ${mix(color, 6)})`, borderTop: `2px solid ${color}` }}>
              <span className="absolute inset-x-0 top-1 text-center text-[10px] uppercase tracking-widest opacity-60">{r.player.games} gier</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Leaders({ model }: { model: Model }) {
  const [k, setK] = useState<MetricKey>('fantasy');
  const [mode, setMode] = useState<RankMode>('avg');
  const [pos, setPos] = useState<string>('all');
  const [minGames, setMinGames] = useState(model.minGames);
  const font = useHeaderFont();
  const m = metric(k);

  const rows = useMemo(() => {
    const role = POS.find(p => p.v === pos)?.role;
    return rankPlayers(model, k, mode, minGames).filter(r => !role || r.player.role === role);
  }, [model, k, mode, minGames, pos]);
  const rest = useMemo(() => rows.slice(3), [rows]);
  const [listRef, per] = useFitCount<HTMLDivElement>(34, 4, 3);
  const { page, pages, setPage, slice, offset } = usePages(rest, per);
  const top = rows[0]?.value || 1;

  const groups = useMemo(() => {
    const g = new Map<MetricGroup, MetricKey[]>();
    for (const key of RAIL) { const grp = metric(key).group; if (!g.has(grp)) g.set(grp, []); g.get(grp)!.push(key); }
    return [...g.entries()];
  }, []);

  return (
    <>
      <LabTitle sub={<Tip content={m.desc}><span className="cursor-help">{m.label}</span></Tip>}
        right={
          <div className="hidden md:flex items-center gap-2 flex-wrap justify-end">
            <Seg size="sm" value={pos} onChange={setPos} options={POS.map(p => ({ value: p.v, label: p.label, tip: p.role || undefined }))} />
            <Seg size="sm" value={mode} onChange={setMode} options={MODES.map(x => ({ value: x.value, label: x.label, tip: x.tip }))} />
            {mode === 'avg' && (
              <Tip content="Minimalna liczba rozegranych gier, żeby trafić do rankingu średnich">
                <div className="flex items-center gap-1 rounded-full px-1 py-0.5" style={{ background: ink(6), border: `1px solid ${ink(10)}` }}>
                  <button type="button" onClick={() => setMinGames(v => Math.max(1, v - 1))} className="w-6 h-6 rounded-full hover:bg-white/10" aria-label="Mniej gier">−</button>
                  <span className="text-[11px] tabular-nums w-16 text-center whitespace-nowrap">≥{minGames} gier</span>
                  <button type="button" onClick={() => setMinGames(v => v + 1)} className="w-6 h-6 rounded-full hover:bg-white/10" aria-label="Więcej gier">+</button>
                </div>
              </Tip>
            )}
          </div>
        }
      >
        Liderzy
      </LabTitle>

      <div className="flex-1 min-h-0 flex gap-4 mt-3">
        {/* Metric rail */}
        <div className="w-[270px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          {groups.map(([grp, keys]) => (
            <div key={grp}>
              <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: C.muted }}>{GROUP_LABEL[grp]}</div>
              <div className="grid grid-cols-2 gap-1">
                {keys.map(key => {
                  const mm = metric(key); const active = key === k;
                  return (
                    <Tip key={key} side="right" content={<TipBody title={mm.label}>{mm.desc}</TipBody>}>
                      <button type="button" onClick={() => setK(key)}
                        className="text-left px-2 py-1 rounded-md text-[11px] truncate transition-all"
                        style={active ? { background: C.primary, color: '#fff', boxShadow: `0 0 12px ${mix(C.primary, 45)}` } : { background: ink(4), color: C.text, opacity: 0.75 }}>
                        {mm.label}
                      </button>
                    </Tip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Podium + ladder */}
        <div className="flex-1 min-w-0 flex gap-4 min-h-0">
          <div className="flex-[1.15] min-w-0 min-h-0 rounded-2xl px-3 pt-3 relative" style={{ background: `radial-gradient(ellipse at 50% 100%, ${mix(C.primary, 14)}, transparent 70%)` }}>
            {rows.length ? <Podium rows={rows} k={k} mode={mode} /> : <div className="h-full flex items-center justify-center text-xs" style={{ color: C.muted }}>Brak graczy spełniających kryteria</div>}
          </div>
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-1">
              {slice.map((r, i) => {
                const rank = offset + i + 4;
                const above = rows[rank - 2];
                const ratio = m.better === 'low' && mode === 'avg' ? (r.value ? top / r.value : 1) : r.value / top;
                return (
                  <motion.div key={r.player.id} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
                    className="relative h-[34px] shrink-0 flex items-center gap-2 px-2 rounded-lg overflow-hidden" style={{ background: ink(3) }}>
                    <div className="absolute inset-y-0 left-0" style={{ width: `${Math.max(2, ratio * 100)}%`, background: `linear-gradient(90deg, ${mix(C.primary, 8)}, ${mix(C.primary, 26)})` }} />
                    <span className="relative w-6 text-right text-[11px] tabular-nums" style={{ color: C.muted }}>{rank}</span>
                    <Tip content={playerTip(r.player)}><span className="relative"><Avatar player={r.player} size={24} /></span></Tip>
                    <span className="relative flex-1 min-w-0 truncate font-semibold text-xs">{r.player.name}</span>
                    <TeamLogo team={r.player.team} size={16} className="relative" />
                    <span className="relative w-9 text-right text-[10px] tabular-nums" style={{ color: C.muted }}>{r.player.games}g</span>
                    <Tip content={above ? `${fmtVal(k, mode, Math.abs(above.value - r.value))} straty do miejsca ${rank - 1} (${above.player.name})` : ''}>
                      <span className="relative w-16 text-right font-bold tabular-nums cursor-help" style={font}>{fmtVal(k, mode, r.value)}</span>
                    </Tip>
                  </motion.div>
                );
              })}
            </div>
            <Pager className="mt-2" page={page} pages={pages} onChange={setPage} />
          </div>
        </div>
      </div>
    </>
  );
}

export default function D02Podium() {
  return <LabView><WithModel>{m => <Leaders model={m} />}</WithModel></LabView>;
}
