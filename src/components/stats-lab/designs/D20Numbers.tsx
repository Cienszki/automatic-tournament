'use client';

// #20 — The tournament in numbers. Eight totals drawn as unit charts: every dot is a round unit
// and each team owns a block of dots. Pick a team below to light up its share everywhere.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model, TeamX } from '@/lib/stats-lab/derive';
import { C, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize, TeamPicker } from '../kit';

interface Chart { key: string; label: string; desc: string; per: (t: TeamX) => number; fmt: (v: number) => string; unitLabel: (u: number) => string; aside?: (total: number, model: Model) => string }

const fmtBig = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} mln` : v >= 1e4 ? `${(v / 1e3).toFixed(0)} tys.` : Math.round(v).toLocaleString('pl-PL'));
const teamSum = (t: TeamX, f: (p: TeamX['games'][number]['perfs'][number]) => number) => t.games.reduce((s, g) => s + g.perfs.reduce((a, p) => (p.tid === t.id ? a + f(p) : a), 0), 0);

const CHARTS: Chart[] = [
  { key: 'wins', label: 'Wygrane gry', desc: 'Każda rozegrana gra ma jednego zwycięzcę', per: t => t.wins, fmt: fmtBig, unitLabel: u => `1 kropka = ${u} ${u === 1 ? 'wygrana' : 'wygranych'}` },
  { key: 'kills', label: 'Zabójstwa', desc: 'Wszystkie zabójstwa turnieju', per: t => teamSum(t, p => p.kills), fmt: fmtBig, unitLabel: u => `1 kropka = ${u} zabójstw`, aside: (v, m) => `${(v / m.totals.hours / 60).toFixed(2)} na minutę gry` },
  { key: 'hours', label: 'Godziny w grze', desc: 'Czas spędzony w grach przez każdą drużynę (gra liczy się obu drużynom)', per: t => t.games.reduce((s, g) => s + g.duration, 0) / 3600, fmt: v => `${Math.round(v)} h`, unitLabel: u => `1 kropka = ${u} h`, aside: (_v, m) => `${(m.totals.hours / 24).toFixed(1)} doby samych meczów` },
  { key: 'gold', label: 'Złoto', desc: 'Całe zarobione złoto', per: t => teamSum(t, p => p.totalGold), fmt: fmtBig, unitLabel: u => `1 kropka = ${fmtBig(u)} złota` },
  { key: 'wards', label: 'Wardy', desc: 'Postawione observer i sentry wardy', per: t => teamSum(t, p => p.obsPlaced + p.senPlaced), fmt: fmtBig, unitLabel: u => `1 kropka = ${u} wardów` },
  { key: 'towers', label: 'Wieże', desc: 'Zniszczone wieże', per: t => teamSum(t, p => p.towerKills), fmt: fmtBig, unitLabel: u => `1 kropka = ${u} ${u === 1 ? 'wieża' : 'wież'}` },
  { key: 'rosh', label: 'Roshany', desc: 'Zabite Roshany', per: t => teamSum(t, p => p.roshanKills), fmt: fmtBig, unitLabel: u => `1 kropka = ${u} ${u === 1 ? 'Roshan' : 'Roshanów'}` },
  { key: 'stacks', label: 'Stacki', desc: 'Zestackowane obozy neutralnych creepów', per: t => teamSum(t, p => p.campsStacked), fmt: fmtBig, unitLabel: u => `1 kropka = ${u} stacków` },
];
const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000];

function Tile({ chart, model, teams, sel, setSel, i }: { chart: Chart; model: Model; teams: TeamX[]; sel: string | null; setSel: (id: string | null) => void; i: number }) {
  const font = useHeaderFont();
  const vals = teams.map(t => ({ t, v: chart.per(t) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const total = vals.reduce((s, x) => s + x.v, 0);
  const unit = NICE.find(u => total / u <= 110) ?? NICE[NICE.length - 1];
  const [box, area] = useSize<HTMLDivElement>();
  const dots: Array<{ t: TeamX; k: number; block: number }> = [];
  vals.forEach((x, b) => { const n = Math.round(x.v / unit); for (let k = 0; k < n; k++) dots.push({ t: x.t, k, block: b }); });
  const selV = sel ? vals.find(x => x.t.id === sel)?.v ?? 0 : 0;
  // Largest dot that still fits every dot in the tile
  const gap = 3;
  let dot = 6;
  for (let d = 24; d >= 6; d--) {
    const cols = Math.max(1, Math.floor((area.w + gap) / (d + gap)));
    if (Math.ceil(dots.length / cols) * (d + gap) <= area.h) { dot = d; break; }
  }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl p-3 flex flex-col min-h-0 overflow-hidden" style={{ background: ink(3), border: `1px solid ${ink(7)}` }}>
      <div className="flex items-baseline justify-between gap-2">
        <Tip content={<TipBody title={chart.label}>{chart.desc}</TipBody>}>
          <span className="text-[10px] uppercase tracking-[0.25em] cursor-help" style={{ color: C.muted }}>{chart.label}</span>
        </Tip>
        {sel && <span className="text-[11px] font-bold tabular-nums" style={{ color: C.secondary }}>{Math.round((selV / (total || 1)) * 100)}%</span>}
      </div>
      <div className="font-logik-extended-bold tabular-nums leading-none mt-1" style={{ fontSize: 'clamp(22px, 4.2vh, 40px)', color: C.heading, ...font }}>
        {sel ? chart.fmt(selV) : chart.fmt(total)}
      </div>
      {chart.aside && !sel && <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{chart.aside(total, model)}</div>}
      <div ref={box} className="flex-1 min-h-0 mt-2 flex flex-wrap content-start" style={{ gap }}>
        {dots.map((d, j) => {
          const on = !sel || d.t.id === sel;
          return (
            <Tip key={j} content={<TipBody title={d.t.name}>{chart.fmt(vals[d.block].v)} · {Math.round((vals[d.block].v / total) * 100)}%</TipBody>}>
              <button type="button" onClick={() => setSel(sel === d.t.id ? null : d.t.id)} className="rounded-full transition-all"
                style={{ width: dot, height: dot, background: sel && on ? C.secondary : d.block % 2 ? mix(C.primary, 55) : C.primary, opacity: on ? 1 : 0.15, transform: sel && on ? 'scale(1.15)' : undefined }} />
            </Tip>
          );
        })}
      </div>
      <div className="text-[9px] mt-1" style={{ color: C.muted }}>{chart.unitLabel(unit)}</div>
    </motion.div>
  );
}

function Numbers({ model }: { model: Model }) {
  const [sel, setSel] = useState<string | null>(null);
  const teams = useMemo(() => [...model.teams].sort((a, b) => b.wins - a.wins), [model]);
  const selTeam = sel ? model.teamById.get(sel) : null;
  return (
    <>
      <LabTitle sub={selTeam ? <span>udział: {selTeam.name}</span> : <span>{model.games.length} gier · {model.players.length} graczy · {model.teams.length} drużyn</span>}>Turniej w liczbach</LabTitle>
      <div className="flex-1 min-h-0 grid grid-cols-2 lg:grid-cols-4 grid-rows-4 lg:grid-rows-2 gap-2.5 mt-3">
        {CHARTS.map((c, i) => <Tile key={c.key} chart={c} model={model} teams={teams} sel={sel} setSel={setSel} i={i} />)}
      </div>
      <TeamPicker className="shrink-0 mt-3" teams={teams} value={sel} onChange={setSel} allLabel="Wszyscy" />
    </>
  );
}

export default function D20Numbers() {
  return <LabView><WithModel>{m => <Numbers model={m} />}</WithModel></LabView>;
}
