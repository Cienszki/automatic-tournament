'use client';

// #11 — Draft room. The Captains Mode draft rebuilt from every recorded pick/ban order: each of
// the slots shows the hero most often taken there (top row = team that drafts first). Click a
// slot for its full distribution. Below: first-pick advantage, counter-picks and draft priority.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtPct } from '@/lib/stats-lab/metrics';
import { C, HeroImg, LabTitle, LabView, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize, wrColor } from '../kit';
import { count, plural } from '@/lib/plural';

interface HeroCount { heroId: number; n: number; wins: number }
interface Slot { i: number; pick: boolean; sideA: boolean; total: number; heroes: HeroCount[] }

function analyse(model: Model) {
  const raw: Array<{ picks: number; aSide: number; total: number; heroes: Map<number, HeroCount> }> = [];
  let fpGames = 0; let fpWins = 0;
  const firstPicks = new Map<number, HeroCount>();
  const lastPicks = new Map<number, HeroCount>();
  const firstSeen = new Map<number, { sum: number; n: number }>();
  const bump = (m: Map<number, HeroCount>, id: number, win: boolean) => {
    const h = m.get(id) ?? { heroId: id, n: 0, wins: 0 }; h.n++; if (win) h.wins++; m.set(id, h);
  };
  let draftGames = 0;
  for (const g of model.games) {
    if (g.pb.length < 10) continue;
    draftGames++;
    const pb = [...g.pb].sort((a, b) => a[3] - b[3]);
    const firstTeam = pb[0][2];
    const teamWon = (team: number) => (team === 0) === g.radiantWin;
    const seen = new Set<number>();
    pb.forEach(([hero, isPick, team], i) => {
      const s = raw[i] ?? (raw[i] = { picks: 0, aSide: 0, total: 0, heroes: new Map() });
      s.total++; if (isPick) s.picks++; if (team === firstTeam) s.aSide++;
      bump(s.heroes, hero, !!isPick && teamWon(team));
      if (!seen.has(hero)) { seen.add(hero); const f = firstSeen.get(hero) ?? { sum: 0, n: 0 }; f.sum += i; f.n++; firstSeen.set(hero, f); }
    });
    const picks = pb.filter(x => x[1]);
    if (picks.length) {
      const fp = picks[0]; fpGames++; if (teamWon(fp[2])) fpWins++;
      bump(firstPicks, fp[0], teamWon(fp[2]));
      const lp = picks[picks.length - 1];
      bump(lastPicks, lp[0], teamWon(lp[2]));
    }
  }
  const slots: Slot[] = raw.filter(s => s.total >= draftGames * 0.5).map((s, i) => ({
    i, pick: s.picks > s.total / 2, sideA: s.aSide > s.total / 2, total: s.total,
    heroes: [...s.heroes.values()].sort((a, b) => b.n - a.n),
  }));
  const sorted = (m: Map<number, HeroCount>) => [...m.values()].sort((a, b) => b.n - a.n || b.wins - a.wins);
  const minN = Math.max(3, Math.round(draftGames * 0.06));
  const priority = [...firstSeen.entries()].filter(([, f]) => f.n >= minN)
    .map(([heroId, f]) => ({ heroId, avg: f.sum / f.n, n: f.n })).sort((a, b) => a.avg - b.avg);
  return { slots, draftGames, fpWr: fpGames ? fpWins / fpGames : 0, fpGames, firstPicks: sorted(firstPicks), lastPicks: sorted(lastPicks), priority, minN };
}

function SlotCell({ s, active, onClick, w }: { s: Slot; active: boolean; onClick: () => void; w: number }) {
  const top = s.heroes[0];
  return (
    <Tip content={<TipBody title={`${s.pick ? 'Pick' : 'Ban'} ${s.i + 1}`}>{top ? `Najczęściej: ${heroName(top.heroId)} (${top.n}×)` : ''}</TipBody>}>
      <motion.button type="button" onClick={onClick} whileHover={{ y: s.sideA ? -3 : 3 }}
        className="relative rounded-md overflow-hidden shrink-0"
        style={{ width: w, height: s.pick ? w * 1.7 : w * 1.05, outline: active ? `2px solid ${C.secondary}` : 'none', outlineOffset: 2, background: ink(6) }}>
        {top && <HeroImg heroId={top.heroId} title={false} className="absolute inset-0 w-full h-full" style={{ filter: s.pick ? 'none' : 'grayscale(1) brightness(0.55)' }} />}
        {!s.pick && <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(0,0,0,0.45) 6px 8px)' }} />}
        <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: s.pick ? (s.sideA ? C.primary : C.secondary) : 'rgba(255,255,255,0.25)' }} />
        <span className="absolute top-0.5 left-1 text-[11px] font-bold text-white/90 drop-shadow">{s.i + 1}</span>
      </motion.button>
    </Tip>
  );
}

function HeroRow({ h, max, showWr = true }: { h: HeroCount; max: number; showWr?: boolean }) {
  return (
    <Tip content={<TipBody title={heroName(h.heroId)}>{h.n}×{showWr && h.n ? ` · ${Math.round((h.wins / h.n) * 100)}% wygranych` : ''}</TipBody>}>
      <div className="flex items-center gap-3 h-10">
        <HeroImg heroId={h.heroId} className="w-[68px] h-[38px] rounded-md shrink-0" />
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: ink(6) }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${(h.n / max) * 100}%` }} className="h-full rounded-full" style={{ background: showWr ? wrColor(h.wins / h.n) : C.muted }} />
        </div>
        <span className="w-7 text-right text-base tabular-nums font-bold">{h.n}</span>
      </div>
    </Tip>
  );
}

/** As many hero rows as fit the remaining height */
function FitRows({ rows, showWr = true }: { rows: HeroCount[]; showWr?: boolean }) {
  const [ref, n] = useFitCount<HTMLDivElement>(40, 6, 2);
  const max = rows[0]?.n || 1;
  return <div ref={ref} className="h-full flex flex-col gap-1.5">{rows.slice(0, n).map(h => <HeroRow key={h.heroId} h={h} max={max} showWr={showWr} />)}</div>;
}

function Panel({ title, tip, children }: { title: string; tip: string; children: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <div className="flex-1 min-w-0 rounded-2xl p-3 flex flex-col min-h-0" style={{ background: ink(3), border: `1px solid ${ink(8)}` }}>
      <Tip content={tip}><div className="text-lg font-logik-extended-bold uppercase tracking-wide cursor-help self-start" style={{ color: C.heading, ...font }}>{title}</div></Tip>
      <div className="flex-1 min-h-0 mt-2 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}

function Draft({ model }: { model: Model }) {
  const font = useHeaderFont();
  const a = useMemo(() => analyse(model), [model]);
  const [sel, setSel] = useState(a.slots.find(s => s.pick)?.i ?? 0);
  const [boardRef, board] = useSize<HTMLDivElement>();
  const slot = a.slots[sel];
  if (!a.slots.length) return <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.muted }}>Brak zapisanych draftów</div>;
  const cell = Math.max(24, Math.min(60, Math.floor((board.w - 60) / a.slots.length) - 4));

  return (
    <>
      <LabTitle sub={<span>{count(a.draftGames, 'draft', 'drafty', 'draftów')}</span>}>Pokój draftu</LabTitle>

      {/* Draft board: top row = team drafting first, bottom row = second */}
      <div ref={boardRef} className="shrink-0 mt-4 rounded-2xl px-3 py-3" style={{ background: `linear-gradient(180deg, ${mix(C.primary, 10)}, transparent 50%, ${mix(C.secondary, 10)})`, border: `1px solid ${ink(8)}` }}>
        <div className="flex items-center gap-1 justify-center">
          <Tip content="Drużyna, która zaczyna draft"><span className="w-3 h-3 rounded-full shrink-0 mr-1 cursor-help" style={{ background: C.primary }} /></Tip>
          {a.slots.map(s => (
            <div key={s.i} className="flex flex-col justify-end shrink-0" style={{ width: cell, height: cell * 1.75 }}>
              {s.sideA && <SlotCell s={s} w={cell} active={s.i === sel} onClick={() => setSel(s.i)} />}
            </div>
          ))}
        </div>
        <div className="h-px my-1.5 mx-6" style={{ background: ink(12) }} />
        <div className="flex items-center gap-1 justify-center">
          <Tip content="Drużyna, która draftuje druga"><span className="w-3 h-3 rounded-full shrink-0 mr-1 cursor-help" style={{ background: C.secondary }} /></Tip>
          {a.slots.map(s => (
            <div key={s.i} className="flex flex-col justify-start shrink-0" style={{ width: cell, height: cell * 1.75 }}>
              {!s.sideA && <SlotCell s={s} w={cell} active={s.i === sel} onClick={() => setSel(s.i)} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 mt-3">
        <Panel title={slot ? `${slot.pick ? 'Pick' : 'Ban'} ${slot.i + 1}` : '–'} tip="Kto ląduje w zaznaczonym miejscu draftu (kliknij inne pole na planszy)">
          {slot && <FitRows key={slot.i} rows={slot.heroes} showWr={slot.pick} />}
        </Panel>
        <Panel title="Pierwszy pick" tip="Pierwszy wybrany bohater w drafcie i jak radzi sobie drużyna, która go wzięła">
          <div className="flex items-center gap-3 mb-2">
            <Tip content={`Drużyna z pierwszym pickiem wygrała ${Math.round(a.fpWr * 100)}% z ${a.fpGames} ${plural(a.fpGames, 'gry', 'gier', 'gier')}`}>
              <div className="relative w-20 h-20 shrink-0 cursor-help">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={ink(10)} strokeWidth="4" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={wrColor(a.fpWr)} strokeWidth="4" strokeDasharray={`${a.fpWr * 100} 100`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-logik-extended-bold" style={font}>{fmtPct(a.fpWr)}</span>
              </div>
            </Tip>
            <span className="text-[10px] uppercase tracking-widest leading-tight" style={{ color: C.muted }}>wygrane drużyny<br />z pierwszym pickiem</span>
          </div>
          <div className="flex-1 min-h-0"><FitRows rows={a.firstPicks} /></div>
        </Panel>
        <Panel title="Kontra" tip="Ostatni pick draftu — bohater wybierany, gdy rywal nie może już odpowiedzieć">
          <FitRows rows={a.lastPicks} />
        </Panel>
        <Panel title="Priorytet" tip={`Bohaterowie znikający z draftu najwcześniej (średnia pozycja pierwszego pojawienia się, min. ${count(a.minN, 'draft', 'drafty', 'draftów')})`}>
          <div className="grid grid-cols-3 gap-2 content-start">
            {a.priority.slice(0, 12).map((p, i) => (
              <Tip key={p.heroId} content={<TipBody title={`${i + 1}. ${heroName(p.heroId)}`}>średnio znika w ruchu {(p.avg + 1).toFixed(1)} · {count(p.n, 'draft', 'drafty', 'draftów')}</TipBody>}>
                <div className="relative rounded-md overflow-hidden">
                  <HeroImg heroId={p.heroId} className="w-full aspect-video" />
                  <span className="absolute top-0 left-0 px-1.5 text-xs font-bold text-white bg-black/65 rounded-br">{i + 1}</span>
                </div>
              </Tip>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

export default function D11Draft() {
  return <LabView><WithModel>{m => <Draft model={m} />}</WithModel></LabView>;
}
