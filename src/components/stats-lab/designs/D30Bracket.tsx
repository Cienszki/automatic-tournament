'use client';

// #30 — Hero knockout. The 16 most contested heroes, seeded by how often they were drafted, play
// a knockout. In "Dane" mode a match is decided by their head-to-head games, or by win rate when
// they never met; press play to reveal it round by round. "Twój typ" lets you pick every winner.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HeroX, Model } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { C, HeroImg, LabTitle, LabView, Seg, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize, HeroRender } from '../kit';

type Mode = 'data' | 'mine';
interface Duel { a: HeroX; b: HeroX; winner: HeroX; why: string }
const SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];

function h2h(model: Model, a: HeroX, b: HeroX) {
  let aw = 0; let bw = 0;
  for (const g of model.games) {
    const pa = g.perfs.find(p => p.heroId === a.heroId); const pb = g.perfs.find(p => p.heroId === b.heroId);
    if (!pa || !pb || pa.radiant === pb.radiant) continue;
    if (pa.win) aw++; else bw++;
  }
  return { aw, bw };
}
const smooth = (h: HeroX) => (h.wins + 2) / (h.picks + 4);

function decide(model: Model, a: HeroX, b: HeroX): Duel {
  const { aw, bw } = h2h(model, a, b);
  if (aw !== bw) return { a, b, winner: aw > bw ? a : b, why: `Bezpośrednio ${Math.max(aw, bw)}:${Math.min(aw, bw)}` };
  const sa = smooth(a); const sb = smooth(b);
  const w = sa === sb ? (a.contest >= b.contest ? a : b) : sa > sb ? a : b;
  return { a, b, winner: w, why: `${aw + bw ? `Bezpośrednio ${aw}:${bw}, ` : ''}wygrane ${Math.round(a.wr * 100)}% vs ${Math.round(b.wr * 100)}%` };
}

function Slot({ h, won, lost, onClick, h2 }: { h?: HeroX; won?: boolean; lost?: boolean; onClick?: () => void; h2: number }) {
  return (
    <button type="button" disabled={!onClick} onClick={onClick} className="relative w-full rounded-md overflow-hidden flex items-center gap-1.5 pr-1.5 text-left transition-all"
      style={{ height: h2, background: won ? mix(C.secondary, 28) : ink(4), border: `1px solid ${won ? C.secondary : ink(10)}`, opacity: lost ? 0.38 : 1, cursor: onClick ? 'pointer' : 'default' }}>
      {h ? <><HeroImg heroId={h.heroId} className="h-full aspect-video shrink-0" style={{ filter: lost ? 'grayscale(1)' : undefined }} /><span className="truncate text-[11px] font-semibold">{heroName(h.heroId)}</span></> : <span className="w-full text-center text-[10px]" style={{ color: C.muted }}>?</span>}
    </button>
  );
}

function Bracket({ model }: { model: Model }) {
  const font = useHeaderFont();
  const seeds = useMemo(() => model.heroes.filter(h => h.picks > 0).slice(0, 16), [model]);
  const [mode, setMode] = useState<Mode>('data');
  const [mine, setMine] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState(4);
  const [ref, size] = useSize<HTMLDivElement>();
  const ok = seeds.length === 16;

  // Data bracket
  const rounds = useMemo(() => {
    if (!ok) return [] as Duel[][];
    const r: Duel[][] = [];
    let field = SEED_ORDER.map(s => seeds[s - 1]);
    while (field.length > 1) {
      const duels: Duel[] = [];
      for (let i = 0; i < field.length; i += 2) duels.push(decide(model, field[i], field[i + 1]));
      r.push(duels); field = duels.map(d => d.winner);
    }
    return r;
  }, [model, seeds, ok]);

  useEffect(() => {
    if (revealed >= 4) return;
    const t = setTimeout(() => setRevealed(x => x + 1), 1100);
    return () => clearTimeout(t);
  }, [revealed]);

  if (!ok) return <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.muted }}>Za mało granych bohaterów na drabinkę</div>;

  // Matches by round for the chosen mode: participants + winner (or undefined)
  const view: Array<Array<{ a?: HeroX; b?: HeroX; w?: HeroX; why?: string; key: string }>> = [];
  let field: Array<HeroX | undefined> = SEED_ORDER.map(s => seeds[s - 1]);
  for (let r = 0; r < 4; r++) {
    const row: (typeof view)[number] = [];
    for (let i = 0; i < field.length; i += 2) {
      const key = `${r}-${i / 2}`;
      const a = field[i]; const b = field[i + 1];
      let w: HeroX | undefined; let why: string | undefined;
      if (mode === 'data') { if (r < revealed) { w = rounds[r][i / 2].winner; why = rounds[r][i / 2].why; } }
      else if (a && b && mine[key] != null) { w = mine[key] === a.heroId ? a : mine[key] === b.heroId ? b : undefined; if (w) why = decide(model, a, b).why; }
      row.push({ a, b, w, why, key });
    }
    view.push(row); field = row.map(m => m.w);
  }
  const champ = view[3][0].w;
  const dataChamp = rounds[3][0].winner;
  const pick = (key: string, h?: HeroX) => {
    if (mode !== 'mine' || !h) return;
    // Changing a pick clears later picks that depended on it
    const [r, i] = key.split('-').map(Number);
    const next = { ...mine, [key]: h.heroId };
    let ci = i; for (let rr = r + 1; rr < 4; rr++) { ci = Math.floor(ci / 2); delete next[`${rr}-${ci}`]; }
    setMine(next);
  };

  // Layout: rounds 0–2 split into left/right halves, final in the centre
  const colW = Math.max(92, Math.min(170, (size.w - 200 - 6 * 12) / 6));
  const slotH = Math.max(22, Math.min(34, size.h / 16 - 6));
  const half = (r: number, left: boolean) => { const n = view[r].length; return left ? view[r].slice(0, n / 2) : view[r].slice(n / 2); };
  const col = (r: number, left: boolean) => (
    <div key={`${r}-${left}`} className="flex flex-col justify-around h-full shrink-0" style={{ width: colW }}>
      {half(r, left).map(m => (
        <Tip key={m.key} content={m.why ? <TipBody title={m.w ? `Awansuje: ${heroName(m.w.heroId)}` : ''}>{m.why}</TipBody> : (mode === 'mine' ? 'Kliknij bohatera, który awansuje' : '')}>
          <div className="flex flex-col gap-0.5">
            <Slot h={m.a} h2={slotH} won={!!m.w && m.w === m.a} lost={!!m.w && m.w !== m.a} onClick={mode === 'mine' && m.a && m.b ? () => pick(m.key, m.a) : undefined} />
            <Slot h={m.b} h2={slotH} won={!!m.w && m.w === m.b} lost={!!m.w && m.w !== m.b} onClick={mode === 'mine' && m.a && m.b ? () => pick(m.key, m.b) : undefined} />
          </div>
        </Tip>
      ))}
    </div>
  );
  const final = view[3][0];

  return (
    <>
      <LabTitle
        sub={<Tip content="Rozstawienie według liczby picków i banów. Mecz rozstrzygają bezpośrednie gry przeciwko sobie, a gdy się nie spotkali — procent wygranych."><span className="cursor-help">16 najczęściej draftowanych bohaterów</span></Tip>}
        right={
          <div className="flex gap-2 items-center">
            {mode === 'data' && <button type="button" onClick={() => setRevealed(0)} className="rounded-full px-4 py-1.5 text-[11px] uppercase tracking-widest font-bold" style={{ background: C.primary, color: '#fff' }}>Rozegraj</button>}
            {mode === 'mine' && Object.keys(mine).length > 0 && <button type="button" onClick={() => setMine({})} className="rounded-full px-3 py-1.5 text-[10px] uppercase tracking-widest" style={{ background: ink(6) }}>Wyczyść</button>}
            <Seg size="sm" value={mode} onChange={setMode} options={[{ value: 'data', label: 'Dane' }, { value: 'mine', label: 'Twój typ', tip: 'Wybierz zwycięzców sam' }]} />
          </div>
        }
      >
        Turniej bohaterów
      </LabTitle>
      <div ref={ref} className="flex-1 min-h-0 mt-3 flex items-stretch justify-center gap-3">
        {col(0, true)}{col(1, true)}{col(2, true)}
        <div className="flex-1 min-w-[180px] max-w-[320px] flex flex-col items-center justify-center gap-3">
          <AnimatePresence mode="wait">
            {champ ? (
              <motion.div key={champ.heroId} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16 }} className="flex flex-col items-center text-center">
                <div className="relative w-[240px] h-[min(260px,32vh)] drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]"><HeroRender heroId={champ.heroId} sizes="240px" /></div>
                <div className="text-[10px] uppercase tracking-[0.35em] mt-1" style={{ color: C.secondary }}>Mistrz</div>
                <div className="text-2xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{heroName(champ.heroId)}</div>
                {mode === 'mine' && <div className="text-xs mt-1" style={{ color: champ === dataChamp ? C.win : C.muted }}>{champ === dataChamp ? 'Tak jak w danych!' : `Według danych: ${heroName(dataChamp.heroId)}`}</div>}
              </motion.div>
            ) : (
              <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-logik-extended-bold" style={{ background: ink(4), color: C.muted, ...font }}>?</motion.div>
            )}
          </AnimatePresence>
          <Tip content={final.why ? <TipBody title="Finał">{final.why}</TipBody> : 'Finał'}>
            <div className="w-full flex flex-col gap-0.5" style={{ maxWidth: colW + 20 }}>
              <Slot h={final.a} h2={slotH + 4} won={!!final.w && final.w === final.a} lost={!!final.w && final.w !== final.a} onClick={mode === 'mine' && final.a && final.b ? () => pick(final.key, final.a) : undefined} />
              <Slot h={final.b} h2={slotH + 4} won={!!final.w && final.w === final.b} lost={!!final.w && final.w !== final.b} onClick={mode === 'mine' && final.a && final.b ? () => pick(final.key, final.b) : undefined} />
            </div>
          </Tip>
        </div>
        {col(2, false)}{col(1, false)}{col(0, false)}
      </div>
    </>
  );
}

export default function D30Bracket() {
  return <LabView><WithModel>{m => <Bracket model={m} />}</WithModel></LabView>;
}
