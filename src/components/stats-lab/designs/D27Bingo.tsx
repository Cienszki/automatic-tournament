'use client';

// #27 — Tournament bingo. A 5×5 card of rare-ish events: half brag, half gentle roast. A cell is
// daubed once the event has happened (avatar/logo = the first "culprit", ×N = how often) and the
// one-liner names them. Complete rows, columns and diagonals are struck through.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { BINGO_EVENTS, hitName, type BingoEvent, type BingoHit } from '@/lib/stats-lab/bingo';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize } from '../kit';

// Fixed tone colours: roasts in a warm "oops" orange, brags in the theme accent
const ROAST = '#ff8a3d';

// Deterministic shuffle so the card looks like bingo but is stable per tournament
function seeded(seed: string) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

const who = (h: BingoHit, size: number, ring?: string) =>
  (h.player ?? h.perf?.player) ? <Avatar player={h.player ?? h.perf?.player} size={size} ring={ring} /> : <TeamLogo team={h.team} size={size} />;

function Bingo({ model }: { model: Model }) {
  const font = useHeaderFont();
  const cells = useMemo(() => {
    const rnd = seeded(model.ds.tournamentId);
    const evs = [...BINGO_EVENTS].sort(() => rnd() - 0.5).slice(0, 24).map(e => ({ e, hits: e.find(model).filter(h => h.game) }));
    return [...evs.slice(0, 12), null, ...evs.slice(12, 24)] as Array<{ e: BingoEvent; hits: BingoHit[] } | null>;
  }, [model]);
  const [sel, setSel] = useState<number | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const lit = (i: number) => i === 12 || (cells[i]?.hits.length ?? 0) > 0;
  const lines = useMemo(() => {
    const L: number[][] = [];
    for (let r = 0; r < 5; r++) L.push([0, 1, 2, 3, 4].map(c => r * 5 + c));
    for (let c = 0; c < 5; c++) L.push([0, 1, 2, 3, 4].map(r => r * 5 + c));
    L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
    return L;
  }, []);
  const done = lines.filter(l => l.every(lit));
  const closest = lines.filter(l => !l.every(lit)).map(l => ({ l, miss: l.filter(i => !lit(i)) })).sort((a, b) => a.miss.length - b.miss.length)[0];
  const board = Math.max(200, Math.min(size.h, size.w));
  const cell = board / 5;
  const cur = sel != null ? cells[sel] : null;
  const center = (i: number) => ({ x: (i % 5) * cell + cell / 2, y: Math.floor(i / 5) * cell + cell / 2 });
  const [listRef, per] = useFitCount<HTMLDivElement>(42, 6, 2);

  return (
    <>
      <LabTitle sub={<span>{cells.filter((c, i) => i !== 12 && c && c.hits.length).length} / 24 zdarzeń · <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle" style={{ background: ROAST }} /> wpadki · <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle" style={{ background: C.secondary }} /> popisy</span>}>Bingo turnieju</LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        <div ref={ref} className="flex-1 min-w-0 min-h-0 flex justify-center">
          {size.w > 0 && (
            <div className="relative" style={{ width: board, height: board }}>
              <div className="grid grid-cols-5 gap-1.5 w-full h-full">
                {cells.map((c, i) => {
                  if (!c) return (
                    <Tip key="free" content="Darmowe pole — jak w każdym bingo">
                      <div className="rounded-xl flex items-center justify-center text-center p-1 cursor-help" style={{ background: mix(C.secondary, 30), border: `1px solid ${C.secondary}` }}>
                        <span className="font-logik-extended-bold uppercase leading-tight" style={{ fontSize: Math.max(10, cell * 0.13), ...font }}>Darmowe pole</span>
                      </div>
                    </Tip>
                  );
                  const first = c.hits[0];
                  const on = c.hits.length > 0;
                  const tone = c.e.tone === 'roast' ? ROAST : C.secondary;
                  return (
                    <Tip key={c.e.id} content={<TipBody title={c.e.label}>{c.e.desc}{on ? ` · ${c.hits.length}× w turnieju` : ' · jeszcze się nie zdarzyło'}{on && <div className="mt-1 italic text-white/85">„{c.e.quip(hitName(first))}”</div>}</TipBody>}>
                      <motion.button type="button" onClick={() => setSel(i)} whileHover={{ scale: 1.04 }}
                        className="relative rounded-xl overflow-hidden flex flex-col items-center justify-center text-center p-1.5"
                        style={{ background: on ? mix(tone, 18) : ink(3), border: `1.5px solid ${sel === i ? C.text : on ? mix(tone, 70) : ink(10)}` }}>
                        {on && first?.perf && <HeroImg heroId={first.perf.heroId} title={false} className="absolute inset-0 w-full h-full opacity-20" />}
                        <span className="relative font-bold uppercase leading-tight" style={{ fontSize: Math.max(10, cell * 0.105), opacity: on ? 1 : 0.5 }}>{c.e.label}</span>
                        {on && (
                          <motion.div initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.03, type: 'spring', stiffness: 260, damping: 16 }}
                            className="relative mt-1.5 flex items-center gap-1.5">
                            {who(first, Math.max(22, cell * 0.32), tone)}
                            {c.hits.length > 1 && <span className="text-xs font-bold tabular-nums">×{c.hits.length}</span>}
                          </motion.div>
                        )}
                      </motion.button>
                    </Tip>
                  );
                })}
              </div>
              <svg width={board} height={board} className="absolute inset-0 pointer-events-none">
                {done.map((l, k) => {
                  const a = center(l[0]); const b = center(l[4]);
                  return <motion.line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.text} strokeWidth={3} strokeLinecap="round" opacity={0.3} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8 + k * 0.2, duration: 0.5 }} />;
                })}
              </svg>
            </div>
          )}
        </div>

        <div className="w-[380px] shrink-0 hidden md:flex flex-col gap-4 min-h-0">
          <Tip content="Pełne rzędy, kolumny i przekątne">
            <div className="cursor-help">
              <div className="font-logik-extended-bold uppercase leading-none" style={{ fontSize: 56, color: done.length ? C.secondary : C.muted, ...font }}>{done.length ? `Bingo ×${done.length}` : 'Bez bingo'}</div>
              {closest && <div className="text-sm mt-1.5" style={{ color: C.muted }}>do kolejnej linii brakuje: <b style={{ color: C.text }}>{closest.miss.map(i => cells[i]?.e.label).join(', ')}</b></div>}
            </div>
          </Tip>
          <AnimatePresence mode="wait">
            {cur ? (
              <motion.div key={cur.e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col gap-2 min-h-0">
                <div className="text-2xl font-logik-extended-bold uppercase" style={{ color: cur.e.tone === 'roast' ? ROAST : C.heading, ...font }}>{cur.e.label}</div>
                <div className="text-sm" style={{ color: C.muted }}>{cur.e.desc}</div>
                {cur.hits[0] && (
                  <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: mix(cur.e.tone === 'roast' ? ROAST : C.secondary, 14) }}>
                    {who(cur.hits[0], 56, cur.e.tone === 'roast' ? ROAST : C.secondary)}
                    <div className="text-base italic leading-snug">„{cur.e.quip(hitName(cur.hits[0]))}”</div>
                  </div>
                )}
                {cur.hits.length === 0 && <div className="text-base italic" style={{ color: C.muted }}>Jeszcze się nie zdarzyło — ktoś chętny?</div>}
                <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-1.5">
                  {cur.hits.slice(1, 1 + per).map((h, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm h-[42px]">
                      {who(h, 34)}
                      <span className="flex-1 truncate font-semibold">{hitName(h)}</span>
                      <span className="tabular-nums text-xs" style={{ color: C.muted }}>{h.note}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm" style={{ color: C.muted }}>
                Kliknij pole, żeby zobaczyć, kto na nie zapracował.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D27Bingo() {
  return <LabView><WithModel>{m => <Bingo model={m} />}</WithModel></LabView>;
}
