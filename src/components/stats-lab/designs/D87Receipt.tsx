'use client';

// #87 — Season receipt. A player's season printed as a till receipt: the heroes are the products
// (games × points earned on each), the services are the season totals, deaths come free,
// and the total is their performance points. Pick a team and a player; the receipt prints anew.

import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtDay, scored } from '@/lib/stats-lab/season';
import { C, LabTitle, LabView, Tip, WithModel, ink, useSize } from '../kit';
import { PlayerPicker, usePlayerPick } from '../picker';

const MONO: React.CSSProperties = { fontFamily: '"Courier New", ui-monospace, monospace' };
const PAPER = '#fbfaf6'; const INK = '#222';

function Barcode({ seed }: { seed: string }) {
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bars: number[] = []; for (let i = 0; i < 46; i++) { h = (h * 1103515245 + 12345) >>> 0; bars.push(1 + (h % 3)); }
  let x = 0;
  return (
    <svg width="100%" height="46" viewBox="0 0 200 46" preserveAspectRatio="none">
      {bars.map((w, i) => { const r = <rect key={i} x={x} y={0} width={w} height={46} fill={i % 2 ? 'transparent' : INK} />; x += w + 1.2; return r; })}
    </svg>
  );
}

const Line = ({ l, r, bold, dim }: { l: React.ReactNode; r: React.ReactNode; bold?: boolean; dim?: boolean }) => (
  <div className={`flex justify-between gap-3 ${bold ? 'font-bold' : ''}`} style={{ opacity: dim ? 0.65 : 1 }}><span className="truncate">{l}</span><span className="tabular-nums whitespace-nowrap">{r}</span></div>
);
const Rule = () => <div className="my-1.5 border-t border-dashed" style={{ borderColor: 'rgba(0,0,0,0.45)' }} />;

function Receipt({ p }: { p: PlayerX }) {
  const s = scored(p.perfs);
  const total = s.reduce((a, x) => a + x.score, 0);
  const heroes = p.heroes.slice(0, 6).map(h => ({ ...h, pts: s.filter(x => x.heroId === h.heroId).reduce((a, x) => a + x.score, 0) }));
  const rest = p.heroes.slice(6);
  const restPts = s.filter(x => rest.some(h => h.heroId === x.heroId)).reduce((a, x) => a + x.score, 0);
  const first = p.perfs[0]; const last = p.perfs[p.perfs.length - 1];
  const hours = p.perfs.reduce((a, x) => a + x.game.duration, 0) / 3600;
  const fmt = (v: number) => v.toFixed(2).replace('.', ',');
  return (
    <div className="relative w-full px-5 pt-5 pb-7 text-[13px] leading-[1.45]" style={{ background: PAPER, color: INK, ...MONO, boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
      WebkitMaskImage: 'linear-gradient(135deg, transparent 6px, #000 0) bottom left / 12px 12px repeat-x, linear-gradient(-135deg, transparent 6px, #000 0) bottom right / 12px 12px repeat-x, linear-gradient(#000, #000) top / 100% calc(100% - 10px) no-repeat' }}>
      <div className="text-center font-bold text-base tracking-widest">LIGA · SKLEP Z PUNKTAMI</div>
      <div className="text-center text-[11px]">paragon sezonowy</div>
      <Rule />
      <Line l={`KLIENT: ${p.name.toUpperCase()}`} r="" bold />
      <Line l={`DRUŻYNA: ${p.team?.name ?? '—'}`} r="" />
      <Line l={first && last ? `OKRES: ${fmtDay(first.game.start)} – ${fmtDay(last.game.start)}` : 'OKRES: —'} r="" dim />
      <Rule />
      <div className="font-bold">BOHATEROWIE</div>
      {heroes.map(h => <Line key={h.heroId} l={`${heroName(h.heroId)} x${h.games}`} r={fmt(h.pts)} />)}
      {rest.length > 0 && <Line l={`inni (${rest.length}) x${rest.reduce((a, h) => a + h.games, 0)}`} r={fmt(restPts)} dim />}
      <Rule />
      <div className="font-bold">USŁUGI</div>
      <Line l={`Zabójstwa x${p.agg.kills.total}`} r="w cenie" dim />
      <Line l={`Asysty x${p.agg.assists.total}`} r="w cenie" dim />
      <Line l={`Last hity x${p.agg.lastHits.total.toLocaleString('pl-PL')}`} r="w cenie" dim />
      {p.agg.wards.total > 0 && <Line l={`Wardy x${p.agg.wards.total}`} r="w cenie" dim />}
      <Line l={`Czas gry ${hours.toFixed(1).replace('.', ',')} h`} r="w cenie" dim />
      <Line l={`GRATIS: śmierci x${p.agg.deaths.total}`} r="0,00" />
      <Rule />
      <div className="flex justify-between font-bold text-xl"><span>SUMA PKT</span><span className="tabular-nums">{fmt(total)}</span></div>
      <Line l="Średnio na grę" r={s.length ? fmt(total / s.length) : '–'} />
      <Line l={`Zapłacono: wygrane x${p.wins}`} r={`${Math.round(p.wr * 100)}%`} />
      <Line l={`Reszta: porażki x${p.losses}`} r="" dim />
      <Rule />
      <div className="text-center text-[11px] mt-1">DZIĘKUJEMY ZA SEZON — ZAPRASZAMY PONOWNIE</div>
      <div className="mt-2 px-6"><Barcode seed={p.id} /></div>
      <div className="text-center text-[10px] tracking-[0.3em] mt-0.5">{p.id.slice(-12)}</div>
    </div>
  );
}

function ReceiptPage({ model }: { model: Model }) {
  const pick = usePlayerPick(model);
  const p = pick.player;
  const ranking = useMemo(() => model.players.map(x => ({ x, t: scored(x.perfs).reduce((a, q) => a + q.score, 0) })).sort((a, b) => b.t - a.t), [model]);
  const place = p ? ranking.findIndex(r => r.x.id === p.id) + 1 : 0;
  // the receipt is as long as it needs to be; shrink it to fit the view instead of scrolling
  const [boxRef, box] = useSize<HTMLDivElement>();
  const [paperRef, paper] = useSize<HTMLDivElement>();
  const scale = paper.h > 0 && box.h > 0 ? Math.min(1, box.h / paper.h) : 1;
  return (
    <>
      <LabTitle sub={<span>sezon gracza w formie paragonu · suma = punkty występu</span>}>Paragon sezonu</LabTitle>
      <div className="flex-1 min-h-0 flex gap-8 mt-3">
        <div className="w-[36%] shrink-0 flex flex-col gap-4">
          <PlayerPicker pick={pick} size={72} />
          {p && place > 0 && (
            <Tip content="Miejsce według sumy punktów występu w sezonie">
              <div className="rounded-2xl px-4 py-3 cursor-help" style={{ background: ink(5), color: C.text }}>
                <span className="text-sm" style={{ color: C.muted }}>Największe zakupy w lidze:</span> <b className="text-lg" style={{ color: C.heading }}>#{place}</b> <span className="text-sm" style={{ color: C.muted }}>z {ranking.length}</span>
              </div>
            </Tip>
          )}
        </div>
        <div ref={boxRef} className="flex-1 min-w-0 flex justify-center min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {p && (
              <motion.div key={p.id} className="w-[400px] self-start" style={{ scale, transformOrigin: 'top center' }} initial={{ y: -500, opacity: 1 }} animate={{ y: 0 }} exit={{ y: 60, opacity: 0, rotate: 4 }} transition={{ type: 'tween', ease: 'easeOut', duration: 0.9 }}>
                <div ref={paperRef}><Receipt p={p} /></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D87Receipt() {
  return <LabView><WithModel>{m => <ReceiptPage model={m} />}</WithModel></LabView>;
}
