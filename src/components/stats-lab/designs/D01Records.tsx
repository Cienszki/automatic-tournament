'use client';

// #1 — Record wall. Each record is a plaque with the hero art of the record game, the holder,
// and a "chase bar" where the next challengers sit as avatars at their % of the record.
// Click a plaque for the full top-10 of that record.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { opponentOf, topPerfs, type Model, type Perf } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont } from '../kit';

const TABS: Array<{ id: string; label: string; keys: MetricKey[] }> = [
  { id: 'combat', label: 'Walka', keys: ['kills', 'assists', 'kda', 'streak', 'heroDamage', 'hdpm', 'multi', 'fantasy'] },
  { id: 'farm', label: 'Farma', keys: ['gpm', 'xpm', 'lastHits', 'lhpm', 'denies', 'netWorth', 'neutralKills', 'buybacks'] },
  { id: 'vision', label: 'Wizja', keys: ['wards', 'obsPlaced', 'senPlaced', 'dewards', 'runes', 'stacks', 'heroHealing', 'courierKills'] },
  { id: 'obj', label: 'Cele', keys: ['towerDamage', 'towerKills', 'roshanKills', 'rampages'] },
];

const fmtDate = (unix: number) => new Date(unix * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

/** Best perf per player (so the chase bar shows 5 different people) */
function distinctTop(model: Model, key: MetricKey, n: number): Perf[] {
  const seen = new Set<string>();
  const out: Perf[] = [];
  for (const p of topPerfs(model, key, 400)) {
    if (seen.has(p.pid)) continue;
    seen.add(p.pid);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

function Plaque({ model, k, onOpen, index }: { model: Model; k: MetricKey; onOpen: () => void; index: number }) {
  const m = metric(k);
  const font = useHeaderFont();
  const top = useMemo(() => distinctTop(model, k, 6), [model, k]);
  const rec = top[0];
  if (!rec) return <div className="rounded-2xl" style={{ background: ink(4) }} />;
  const recV = m.get(rec);
  const ties = top.filter(p => m.get(p) === recV).length;
  const opp = opponentOf(rec);
  // Zoomed range: from a bit below the last challenger up to the record, so gaps are visible
  const lo = Math.max(0, Math.min(...top.map(p => m.get(p))) * 0.85);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -3 }}
      className="group relative rounded-2xl overflow-hidden text-left min-h-0 flex flex-col"
      style={{ border: `1px solid ${ink(10)}`, background: ink(3) }}
    >
      {/* Hero art of the record game */}
      <HeroImg heroId={rec.heroId} className="absolute inset-0 w-full h-full opacity-35 group-hover:opacity-55 group-hover:scale-105 transition-all duration-500" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.85) 100%)' }} />
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.secondary}, transparent)` }} />

      <div className="relative flex-1 flex flex-col p-3 min-h-0 text-white">
        <Tip content={<TipBody title={m.label}>{m.desc}{m.parsedOnly ? ' (tylko gry z pełną powtórką)' : ''}</TipBody>}>
          <span className="self-start text-[10px] uppercase tracking-[0.2em] text-white/70 cursor-help">{m.label}</span>
        </Tip>
        <div className="flex-1" />
        <div className="flex items-end gap-2">
          <span className="text-3xl xl:text-4xl font-logik-extended-bold leading-none tabular-nums" style={{ color: C.secondary, ...font }}>{m.fmt(recV)}</span>
          {ties > 1 && (
            <Tip content={`${ties} graczy ma ten sam wynik — rekord należy do pierwszego`}>
              <span className="mb-1 text-[10px] px-1.5 rounded-full bg-white/15">×{ties}</span>
            </Tip>
          )}
        </div>
        <Tip content={<TipBody title={`${rec.player?.name} · ${heroName(rec.heroId)}`}>{opp ? `vs ${opp.name} · ` : ''}{fmtDate(rec.game.start)} · {rec.win ? 'wygrana' : 'przegrana'}</TipBody>}>
          <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
            <Avatar player={rec.player} size={20} ring={C.secondary} />
            <span className="truncate text-xs font-semibold">{rec.player?.name}</span>
            <TeamLogo team={rec.team} size={14} className="opacity-80" />
          </div>
        </Tip>

        {/* Chase bar: challengers at their % of the record */}
        <div className="relative mt-3 h-5">
          <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/15" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: C.secondary, boxShadow: `0 0 8px ${C.secondary}` }} />
          {top.slice(1).reverse().map((p, i) => {
            const v = m.get(p);
            const pct = recV > lo ? Math.max(0, Math.min(1, (v - lo) / (recV - lo))) : 1;
            return (
              <Tip key={p.idx} content={<TipBody title={p.player?.name}>{m.fmt(v)} · {recV - v > 0 ? `brakuje ${m.fmt(recV - v)} do rekordu` : 'wyrównany rekord'}</TipBody>}>
                <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform hover:scale-125 hover:z-10" style={{ left: `${pct * 100}%`, zIndex: i }}>
                  <Avatar player={p.player} size={16} ring="rgba(0,0,0,0.6)" />
                </span>
              </Tip>
            );
          })}
        </div>
      </div>
    </motion.button>
  );
}

function Ladder({ model, k, onClose }: { model: Model; k: MetricKey; onClose: () => void }) {
  const m = metric(k);
  const font = useHeaderFont();
  const rows = useMemo(() => topPerfs(model, k, 10), [model, k]);
  const rec = rows[0];
  const recV = rec ? m.get(rec) : 1;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
      className="absolute inset-0 z-10 rounded-2xl overflow-hidden flex"
      style={{ background: 'rgba(8,8,12,0.97)', border: `1px solid ${ink(12)}` }}
      onClick={onClose}
    >
      {rec && (
        <div className="relative w-[34%] hidden md:flex flex-col justify-end p-5 text-white">
          <HeroImg heroId={rec.heroId} className="absolute inset-0 w-full h-full opacity-50" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.9))' }} />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">{m.label}</div>
            <div className="text-6xl font-logik-extended-bold leading-none mt-1" style={{ color: C.secondary, ...font }}>{m.fmt(recV)}</div>
            <div className="mt-3 flex items-center gap-2">
              <Avatar player={rec.player} size={36} ring={C.secondary} />
              <div className="min-w-0">
                <div className="font-bold truncate">{rec.player?.name}</div>
                <div className="text-[11px] text-white/60 truncate">{heroName(rec.heroId)} · vs {opponentOf(rec)?.name} · {fmtDate(rec.game.start)}</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-white/50 leading-snug">{m.desc}</div>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col p-4 min-w-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-[0.25em] text-white/60">Top 10 · {m.label}</span>
          <button type="button" onClick={onClose} aria-label="Zamknij" className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white">×</button>
        </div>
        <div className="flex-1 grid grid-rows-10 gap-1 min-h-0">
          {rows.map((p, i) => {
            const v = m.get(p);
            return (
              <div key={p.idx} className="relative flex items-center gap-2 px-2 rounded-lg overflow-hidden text-white min-h-0">
                <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${(v / recV) * 100}%`, background: i === 0 ? mix(C.secondary, 22) : 'rgba(255,255,255,0.06)' }} />
                <span className="relative w-5 text-right text-[11px] tabular-nums text-white/50">{i + 1}</span>
                <HeroImg heroId={p.heroId} variant="icon" className="relative w-6 h-6 rounded" />
                <Avatar player={p.player} size={22} />
                <span className="relative flex-1 truncate text-xs font-semibold">{p.player?.name}<span className="font-normal text-white/45"> · {heroName(p.heroId)} vs {opponentOf(p)?.tag || opponentOf(p)?.name}</span></span>
                <span className="relative w-1.5 h-4 rounded-sm" style={{ background: p.win ? C.win : C.loss }} />
                <span className="relative w-14 text-right font-bold tabular-nums" style={{ color: i === 0 ? C.secondary : undefined }}>{m.fmt(v)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function RecordWall({ model }: { model: Model }) {
  const [tab, setTab] = useState(TABS[0].id);
  const [open, setOpen] = useState<MetricKey | null>(null);
  const keys = TABS.find(t => t.id === tab)!.keys;

  // Who holds the most records across every tab
  const holders = useMemo(() => {
    const count = new Map<string, { p: Perf; keys: MetricKey[] }>();
    for (const t of TABS) for (const k of t.keys) {
      const rec = topPerfs(model, k, 1)[0];
      if (!rec?.player) continue;
      const e = count.get(rec.pid) ?? { p: rec, keys: [] };
      e.keys.push(k);
      count.set(rec.pid, e);
    }
    return [...count.values()].sort((a, b) => b.keys.length - a.keys.length).slice(0, 5);
  }, [model]);

  return (
    <>
      <LabTitle
        sub={`${model.games.length} gier · ${model.players.length} graczy`}
        right={
          <div className="hidden md:flex items-center gap-2">
            {holders.map(h => (
              <Tip key={h.p.pid} content={<TipBody title={`${h.p.player?.name} — ${h.keys.length} rekord${h.keys.length === 1 ? '' : h.keys.length < 5 ? 'y' : 'ów'}`}>{h.keys.map(k => metric(k).label).join(', ')}</TipBody>}>
                <div className="relative">
                  <Avatar player={h.p.player} size={34} ring={mix(C.secondary, 70)} />
                  <span className="absolute -bottom-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-black" style={{ background: C.secondary }}>{h.keys.length}</span>
                </div>
              </Tip>
            ))}
          </div>
        }
      >
        Rekordy
      </LabTitle>
      <div className="flex justify-center my-3 shrink-0">
        <Seg value={tab} onChange={v => { setTab(v); setOpen(null); }} options={TABS.map(t => ({ value: t.id, label: t.label }))} />
      </div>
      <div className="relative flex-1 min-h-0">
        <div className="h-full grid grid-cols-2 lg:grid-cols-4 grid-rows-4 lg:grid-rows-2 gap-2.5">
          {keys.map((k, i) => <Plaque key={`${tab}-${k}`} model={model} k={k} index={i} onOpen={() => setOpen(k)} />)}
        </div>
        <AnimatePresence>{open && <Ladder key={open} model={model} k={open} onClose={() => setOpen(null)} />}</AnimatePresence>
      </div>
    </>
  );
}

export default function D01Records() {
  return <LabView><WithModel>{m => <RecordWall model={m} />}</WithModel></LabView>;
}
