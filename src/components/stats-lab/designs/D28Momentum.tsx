'use client';

// #28 — Momentum. What decides a game? Every team-in-a-game flows through the chosen factors
// (side, first blood, first pick, more wards, more Roshans, Elo favourite) into the result.
// Ribbons are coloured by the result, so a factor that matters splits green from red.
// Click factor chips to add / remove stages; the bars on the right rank every factor.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { C, LabTitle, LabView, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

type FKey = 'side' | 'fb' | 'fp' | 'wards' | 'rosh' | 'fav' | 'dew' | 'stk' | 'runes' | 'cour' | 'heal' | 'multi' | 'bb' | 'denies';
interface Factor { key: FKey; label: string; desc: string; yes: string; no: string }
const FACTORS: Factor[] = [
  { key: 'side', label: 'Strona', desc: 'Radiant czy Dire', yes: 'Radiant', no: 'Dire' },
  { key: 'fb', label: 'Pierwsza krew', desc: 'Czy drużyna zdobyła pierwszą krew', yes: 'Pierwsza krew', no: 'Bez pierwszej krwi' },
  { key: 'fp', label: 'Pierwszy pick', desc: 'Czy drużyna wybierała bohatera jako pierwsza', yes: 'Pierwszy pick', no: 'Drugi pick' },
  { key: 'wards', label: 'Wizja', desc: 'Czy drużyna postawiła więcej wardów niż rywal', yes: 'Więcej wardów', no: 'Mniej wardów' },
  { key: 'rosh', label: 'Roshan', desc: 'Czy drużyna zabiła więcej Roshanów niż rywal', yes: 'Więcej Roshanów', no: 'Mniej Roshanów' },
  { key: 'fav', label: 'Faworyt', desc: 'Czy drużyna miała wyższy ranking Elo przed grą', yes: 'Faworyt', no: 'Underdog' },
  { key: 'dew', label: 'Dewardy', desc: 'Czy drużyna zniszczyła więcej wrogich wardów', yes: 'Więcej dewardów', no: 'Mniej dewardów' },
  { key: 'stk', label: 'Stacki', desc: 'Czy drużyna zestackowała więcej obozów', yes: 'Więcej stacków', no: 'Mniej stacków' },
  { key: 'runes', label: 'Runy', desc: 'Czy drużyna podniosła więcej run', yes: 'Więcej run', no: 'Mniej run' },
  { key: 'cour', label: 'Kurierki', desc: 'Czy drużyna zabiła kurierka rywala', yes: 'Zabity kurierek', no: 'Bez kurierka' },
  { key: 'heal', label: 'Leczenie', desc: 'Czy drużyna wyleczyła więcej zdrowia', yes: 'Więcej leczenia', no: 'Mniej leczenia' },
  { key: 'multi', label: 'Multi-kill', desc: 'Czy ktoś z drużyny zrobił ultra kill lub rampage', yes: 'Ultra / rampage', no: 'Bez ultra kill' },
  { key: 'bb', label: 'Buybacki', desc: 'Czy drużyna użyła więcej buybacków', yes: 'Więcej buybacków', no: 'Mniej buybacków' },
  { key: 'denies', label: 'Denies', desc: 'Czy drużyna miała więcej denies (wygrana linia)', yes: 'Więcej denies', no: 'Mniej denies' },
];

type Unit = Partial<Record<FKey, boolean>> & { win: boolean };

function buildUnits(model: Model): Unit[] {
  const elo = new Map<string, number>(model.teams.map(t => [t.id, 1500]));
  const units: Unit[] = [];
  for (const g of model.games) {
    const ra = elo.get(g.radiant) ?? 1500; const rb = elo.get(g.dire) ?? 1500;
    const sum = (rad: boolean, f: (p: (typeof g.perfs)[number]) => number) => g.perfs.filter(p => p.radiant === rad).reduce((s, p) => s + f(p), 0);
    const pb = [...g.pb].sort((a, b) => a[3] - b[3]);
    const firstPickTeam = pb.find(x => x[1])?.[2];
    for (const rad of [true, false]) {
      const u: Unit = { win: rad === g.radiantWin, side: rad };
      if (g.parsed && g.fbPerf) u.fb = g.fbPerf.radiant === rad;
      if (firstPickTeam != null) u.fp = (firstPickTeam === 0) === rad;
      if (g.parsed) {
        const w = sum(rad, p => p.obsPlaced + p.senPlaced); const wo = sum(!rad, p => p.obsPlaced + p.senPlaced);
        if (w !== wo) u.wards = w > wo;
        const r = sum(rad, p => p.roshanKills); const ro = sum(!rad, p => p.roshanKills);
        if (r !== ro) u.rosh = r > ro;
      }
      if (ra !== rb) u.fav = rad ? ra > rb : rb > ra;
      const more = (f: (p: (typeof g.perfs)[number]) => number, parsedOnly = true) => {
        if (parsedOnly && !g.parsed) return undefined;
        const a = sum(rad, f); const b = sum(!rad, f);
        return a === b ? undefined : a > b;
      };
      u.dew = more(p => p.observerKills + p.sentryKills);
      u.stk = more(p => p.campsStacked);
      u.runes = more(p => p.runesPickedUp);
      u.heal = more(p => p.heroHealing, false);
      u.bb = more(p => p.buybackCount);
      u.denies = more(p => p.denies, false);
      if (g.parsed) {
        u.cour = sum(rad, p => p.courierKills) > 0;
        u.multi = sum(rad, p => p.ultraKills + p.rampages) > 0;
      }
      units.push(u);
    }
    const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400)); const sa = g.radiantWin ? 1 : 0;
    elo.set(g.radiant, ra + 32 * (sa - ea)); elo.set(g.dire, rb + 32 * ((1 - sa) - (1 - ea)));
  }
  return units;
}

function Alluvial({ units, stages }: { units: Unit[]; stages: FKey[] }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const cols = [...stages, 'win' as const];
  const data = units.filter(u => stages.every(s => u[s] != null));
  const N = data.length || 1;
  const nodeW = 14; const gap = 18; const labelW = 140;
  const W = size.w - labelW * 2; const H = size.h - 10;
  const xs = cols.map((_, i) => labelW + (i / Math.max(1, cols.length - 1)) * (W - nodeW));
  const val = (u: Unit, c: FKey | 'win') => (c === 'win' ? u.win : !!u[c]);
  const nodeH = (c: FKey | 'win', v: boolean) => (data.filter(u => val(u, c) === v).length / N) * (H - gap);
  const nodeY = (c: FKey | 'win', v: boolean) => (v ? 0 : nodeH(c, true) + gap);
  const scale = (H - gap) / N;
  const label = (c: FKey | 'win', v: boolean) => (c === 'win' ? (v ? 'Wygrana' : 'Przegrana') : v ? FACTORS.find(f => f.key === c)!.yes : FACTORS.find(f => f.key === c)!.no);

  const ribbons: Array<{ id: string; d: string; win: boolean; n: number; a: string; b: string }> = [];
  for (let i = 0; i < cols.length - 1; i++) {
    const A = cols[i]; const B = cols[i + 1];
    const outOff = new Map<string, number>(); const inOff = new Map<string, number>();
    for (const av of [true, false]) for (const bv of [true, false]) for (const r of [true, false]) {
      const n = data.filter(u => val(u, A) === av && val(u, B) === bv && u.win === r).length;
      if (!n) continue;
      const h = n * scale;
      const ka = `${av}`; const kb = `${bv}`;
      const y0 = nodeY(A, av) + (outOff.get(ka) ?? 0); outOff.set(ka, (outOff.get(ka) ?? 0) + h);
      const y1 = nodeY(B, bv) + (inOff.get(kb) ?? 0); inOff.set(kb, (inOff.get(kb) ?? 0) + h);
      const x0 = xs[i] + nodeW; const x1 = xs[i + 1]; const mx = (x0 + x1) / 2;
      ribbons.push({
        id: `${i}-${av}-${bv}-${r}`, win: r, n, a: label(A, av), b: label(B, bv),
        d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h} C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h} Z`,
      });
    }
  }

  return (
    <div ref={ref} className="relative w-full h-full">
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="absolute inset-0 overflow-visible">
          {ribbons.map(r => (
            <Tip key={r.id} content={<TipBody title={`${r.a} → ${r.b}`}>{r.n} przypadków · {r.win ? 'zakończonych wygraną' : 'zakończonych porażką'}</TipBody>}>
              <motion.path d={r.d} initial={{ opacity: 0 }} animate={{ opacity: hover == null || hover === r.id ? 0.55 : 0.12 }} fill={r.win ? C.win : C.loss}
                onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} className="cursor-help" />
            </Tip>
          ))}
          {cols.map((c, i) => [true, false].map(v => {
            const h = nodeH(c, v); const y = nodeY(c, v);
            const n = data.filter(u => val(u, c) === v).length;
            const wr = n ? data.filter(u => val(u, c) === v && u.win).length / n : 0;
            const leftSide = i === 0;
            return (
              <g key={`${c}-${v}`}>
                <rect x={xs[i]} y={y} width={nodeW} height={Math.max(1, h)} rx={3} fill={c === 'win' ? (v ? C.win : C.loss) : v ? C.secondary : C.primary} />
                <text x={leftSide ? xs[i] - 8 : xs[i] + nodeW + 8} y={y + h / 2 - 6} textAnchor={leftSide ? 'end' : 'start'} fontSize={12} fontWeight={700} fill="currentColor">{label(c, v)}</text>
                <text x={leftSide ? xs[i] - 8 : xs[i] + nodeW + 8} y={y + h / 2 + 9} textAnchor={leftSide ? 'end' : 'start'} fontSize={10} fill="currentColor" opacity={0.6}>{c === 'win' ? `${n}` : `${n} · ${Math.round(wr * 100)}% W`}</text>
              </g>
            );
          }))}
        </svg>
      )}
    </div>
  );
}

function Momentum({ model }: { model: Model }) {
  const font = useHeaderFont();
  const units = useMemo(() => buildUnits(model), [model]);
  const [stages, setStages] = useState<FKey[]>(['side', 'fb']);
  const toggle = (k: FKey) => setStages(s => (s.includes(k) ? s.filter(x => x !== k) : s.length >= 5 ? [...s.slice(1), k] : [...s, k]));

  const impact = FACTORS.map(f => {
    const pool = units.filter(u => u[f.key] != null);
    const yes = pool.filter(u => u[f.key]);
    return { f, wr: yes.length ? yes.filter(u => u.win).length / yes.length : 0.5, n: pool.length / 2 };
  }).sort((a, b) => Math.abs(b.wr - 0.5) - Math.abs(a.wr - 0.5));

  // Series: does the game-1 winner win the series?
  const series = useMemo(() => {
    const out = { w: 0, d: 0, l: 0 };
    const byMatch = new Map<string, typeof model.games>();
    for (const g of model.games) { if (!byMatch.has(g.matchId)) byMatch.set(g.matchId, []); byMatch.get(g.matchId)!.push(g); }
    for (const m of model.ds.matches) {
      const gs = (byMatch.get(m.id) ?? []).sort((a, b) => a.start - b.start);
      if (gs.length < 2) continue;
      const g1 = gs[0].winnerId;
      const mine = g1 === m.teamA ? [m.scoreA, m.scoreB] : [m.scoreB, m.scoreA];
      if (mine[0] > mine[1]) out.w++; else if (mine[0] === mine[1]) out.d++; else out.l++;
    }
    return out;
  }, [model]);
  const sTot = series.w + series.d + series.l || 1;

  return (
    <>
      <LabTitle sub={<span>{units.length / 2} gier · wybierz do 5 czynników — kolejność = etapy przepływu</span>}>Momentum</LabTitle>
      <div className="shrink-0 hidden md:flex gap-1.5 flex-wrap mt-3">
        {FACTORS.map(f => {
          const k = stages.indexOf(f.key);
          return (
            <Tip key={f.key} content={f.desc}>
              <button type="button" onClick={() => toggle(f.key)} className="rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
                style={k >= 0 ? { background: C.primary, color: '#fff' } : { background: ink(5), border: `1px solid ${ink(10)}` }}>
                {k >= 0 && <span className="w-4 h-4 rounded-full bg-white/25 text-[9px] flex items-center justify-center">{k + 1}</span>}{f.label}
              </button>
            </Tip>
          );
        })}
        {stages.length > 0 && <button type="button" onClick={() => setStages([])} className="rounded-full px-3.5 py-1.5 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Wyczyść</button>}
      </div>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        <div className="flex-[1.8] min-w-0 min-h-0">{stages.length ? <Alluvial units={units} stages={stages} /> : <div className="h-full flex items-center justify-center text-sm" style={{ color: C.muted }}>Wybierz czynnik</div>}</div>
        <div className="w-[300px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          <div>
            <Tip content="Procent wygranych drużyny, która miała dany atut (0–100%, środek = 50%)"><div className="text-xs font-logik-extended-bold uppercase inline-block cursor-help" style={{ color: C.heading, ...font }}>Co daje przewagę</div></Tip>
            <div className="mt-2 flex flex-col gap-1">
              {impact.map(({ f, wr }) => (
                <Tip key={f.key} content={`${f.yes}: ${Math.round(wr * 100)}% wygranych`}>
                  <button type="button" onClick={() => toggle(f.key)} className="text-left">
                    <div className="flex justify-between text-[11px] mb-0.5"><span>{f.yes}</span><span className="font-bold tabular-nums" style={{ color: wr >= 0.5 ? C.win : C.loss }}>{Math.round(wr * 100)}%</span></div>
                    <div className="relative h-2 rounded-full" style={{ background: ink(6) }}>
                      <div className="absolute top-0 bottom-0 w-px left-1/2" style={{ background: ink(30) }} />
                      <motion.div className="absolute top-0 bottom-0 rounded-full" initial={false}
                        animate={{ left: `${Math.min(50, wr * 100)}%`, width: `${Math.abs(wr - 0.5) * 100}%` }} style={{ background: wr >= 0.5 ? C.win : C.loss }} />
                    </div>
                  </button>
                </Tip>
              ))}
            </div>
          </div>
          <div>
            <Tip content="Serie, w których rozegrano co najmniej dwie gry: jak kończyła się seria dla zwycięzcy pierwszej gry"><div className="text-xs font-logik-extended-bold uppercase inline-block cursor-help" style={{ color: C.heading, ...font }}>Wygrana gra 1 →</div></Tip>
            <div className="flex h-7 rounded-lg overflow-hidden mt-2 text-[11px] font-bold">
              {[['w', series.w, C.win, 'seria wygrana'], ['d', series.d, C.muted, 'remis'], ['l', series.l, C.loss, 'seria przegrana']].map(([k, n, col, t]) => (n as number) > 0 && (
                <Tip key={k as string} content={`${n} serii — ${t}`}><div className="flex items-center justify-center text-white" style={{ width: `${((n as number) / sTot) * 100}%`, background: mix(col as string, 75) }}>{Math.round(((n as number) / sTot) * 100)}%</div></Tip>
              ))}
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-widest mt-1" style={{ color: C.muted }}><span>wygrana</span><span>remis</span><span>porażka</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D28Momentum() {
  return <LabView><WithModel>{m => <Momentum model={m} />}</WithModel></LabView>;
}
