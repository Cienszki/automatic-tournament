'use client';

// #73 — Periodic table. Every ranked player is an element: the atomic number is their place in the
// performance ranking, the symbol comes from their nick, the family colour is their position, and
// the "atomic mass" is their average performance score. Elements fill the real periodic table
// shape (the 57th onwards drop into the lanthanide rows). Click an element for its card.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { POS_OF, ROLE_LABEL, qualified } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, useHeaderFont, useSize } from '../kit';

const FAMILY: Record<string, string> = { Carry: '#e8505b', Mid: '#f9a826', Offlane: '#2fbf71', 'Soft Support': '#3d8bfd', 'Hard Support': '#9b6bff', '': '#8a8f9c' };

/** Grid position (row, col; 1-based) of element Z in the standard 18-column layout */
function cell(z: number): [number, number] {
  if (z === 1) return [1, 1]; if (z === 2) return [1, 18];
  if (z <= 4) return [2, z - 2]; if (z <= 10) return [2, z + 8];
  if (z <= 12) return [3, z - 10]; if (z <= 18) return [3, z];
  if (z <= 36) return [4, z - 18]; if (z <= 54) return [5, z - 36];
  if (z <= 56) return [6, z - 54]; if (z <= 71) return [9, z - 54]; if (z <= 86) return [6, z - 68];
  if (z <= 88) return [7, z - 86]; if (z <= 103) return [10, z - 86]; return [7, z - 100];
}

/** Two-letter symbol: first letter + the next consonant (unique within the table) */
function symbols(players: PlayerX[]): Map<string, string> {
  const used = new Set<string>(); const out = new Map<string, string>();
  for (const p of players) {
    const clean = p.name.normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
    const first = (clean[0] ?? '?').toUpperCase();
    const rest = clean.slice(1).toLowerCase();
    const cands = [...rest.replace(/[aeiouy]/g, ''), ...rest].map(ch => first + ch);
    let sym = cands.find(s => !used.has(s)) ?? first;
    if (used.has(sym)) { let k = 2; while (used.has(first + k)) k++; sym = first + k; }
    used.add(sym); out.set(p.id, sym);
  }
  return out;
}

function Periodic({ model }: { model: Model }) {
  const font = useHeaderFont();
  const list = useMemo(() => qualified(model).sort((a, b) => (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0)).slice(0, 118), [model]);
  const sym = useMemo(() => symbols(list), [list]);
  const [selId, setSel] = useState<string | null>(null);
  const [fam, setFam] = useState<string | null>(null);
  const sel = list.find(p => p.id === selId) ?? list[0];
  const [ref, box] = useSize<HTMLDivElement>();
  const gap = 3;
  const s = Math.max(20, Math.min((box.w - 17 * gap) / 18, (box.h - 8 * gap - 14) / 9));
  // rows 9–10 (lanthanides/actinides) sit right under row 7 with a small gap
  const pos = (r: number, c: number) => ({ left: (c - 1) * (s + gap), top: (r >= 9 ? r - 2 : r - 1) * (s + gap) + (r >= 9 ? 14 : 0) });
  const z = sel ? list.indexOf(sel) + 1 : 0;

  return (
    <>
      <LabTitle sub={<Tip content="Liczba atomowa = miejsce w rankingu średnich punktów występu · masa atomowa = średnia punktów"><span className="cursor-help">{list.length} pierwiastków · kliknij pierwiastek</span></Tip>}
        right={
          <div className="flex gap-1.5">
            {Object.entries(FAMILY).filter(([k]) => k).map(([role, color]) => (
              <button key={role} type="button" onClick={() => setFam(f => (f === role ? null : role))} className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-all"
                style={{ background: color, opacity: fam && fam !== role ? 0.35 : 1, boxShadow: fam === role ? '0 0 0 2px #fff' : undefined }}>{ROLE_LABEL[role]}</button>
            ))}
          </div>
        }>Układ okresowy</LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-3">
        {box.w > 0 && list.map((p, i) => {
          const [r, c] = cell(i + 1); const color = FAMILY[p.role ?? ''] ?? FAMILY[''];
          const on = p === sel; const dim = fam && p.role !== fam;
          return (
            <Tip key={p.id} content={<TipBody title={`${i + 1}. ${p.name}`}>{p.role ? ROLE_LABEL[p.role] : '—'} · {(p.agg.score.avg ?? 0).toFixed(2)} pkt · {p.games} gier</TipBody>}>
              <motion.button type="button" onClick={() => setSel(p.id)} className="absolute rounded-[4px] flex flex-col justify-between p-[3px] text-left overflow-hidden"
                style={{ ...pos(r, c), width: s, height: s, background: color, color: '#0b0b10', opacity: dim ? 0.18 : 1, boxShadow: on ? '0 0 0 2px #fff, 0 0 14px rgba(255,255,255,0.6)' : undefined, zIndex: on ? 5 : 1 }}
                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: dim ? 0.18 : 1, scale: 1 }} transition={{ delay: Math.min(0.8, i * 0.006) }} whileHover={{ scale: 1.25, zIndex: 10 }}>
                <span className="leading-none font-bold tabular-nums" style={{ fontSize: Math.max(7, s * 0.2) }}>{i + 1}</span>
                <span className="leading-none font-logik-extended-bold text-center" style={{ fontSize: s * 0.38, ...font }}>{sym.get(p.id)}</span>
                <span className="leading-none truncate text-center" style={{ fontSize: Math.max(6, s * 0.15) }}>{p.name}</span>
              </motion.button>
            </Tip>
          );
        })}
        {/* the big element card in the empty block above the transition metals */}
        {box.w > 0 && sel && (
          <AnimatePresence mode="wait">
            <motion.div key={sel.id} className="absolute rounded-xl p-2.5 flex gap-3" style={{ left: 2 * (s + gap) + s * 0.3, top: 0, width: 10 * (s + gap) - s * 0.6, height: 3 * (s + gap) - gap, background: ink(5), border: `1px solid ${ink(12)}` }}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="h-full aspect-square rounded-lg p-2 flex flex-col justify-between shrink-0" style={{ background: FAMILY[sel.role ?? ''] ?? FAMILY[''], color: '#0b0b10' }}>
                <div className="flex justify-between text-sm font-bold tabular-nums"><span>{z}</span><span>{(sel.agg.score.avg ?? 0).toFixed(2)}</span></div>
                <div className="text-center font-logik-extended-bold leading-none" style={{ fontSize: s * 1.1, ...font }}>{sym.get(sel.id)}</div>
                <div className="text-center text-xs font-bold truncate">{sel.name}</div>
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <Avatar player={sel} size={Math.min(110, 3 * s)} />
                <div className="min-w-0 text-sm leading-relaxed" style={{ color: C.text }}>
                  <div className="text-lg font-bold truncate" style={{ color: C.heading }}>{sel.name}</div>
                  <div className="flex items-center gap-1.5" style={{ color: C.muted }}><TeamLogo team={sel.team} size={16} />{sel.team?.name}</div>
                  <Tip content="Średnio zabójstwa / śmierci / asysty"><div className="cursor-help">konfiguracja: <b>{(sel.agg.kills.avg ?? 0).toFixed(1)}/{(sel.agg.deaths.avg ?? 0).toFixed(1)}/{(sel.agg.assists.avg ?? 0).toFixed(1)}</b></div></Tip>
                  <div>rodzina: <b>{sel.role ? ROLE_LABEL[sel.role] : '—'}</b> · poz. {POS_OF[sel.role ?? ''] ?? '–'}</div>
                </div>
                {sel.heroes[0] && <Tip content={`Najczęściej: ${heroName(sel.heroes[0].heroId)}`}><span className="ml-auto shrink-0"><HeroImg heroId={sel.heroes[0].heroId} className="rounded-lg" style={{ width: Math.min(120, 3.2 * s), height: Math.min(68, 1.8 * s) }} /></span></Tip>}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </>
  );
}

export default function D73Periodic() {
  return <LabView><WithModel>{m => <Periodic model={m} />}</WithModel></LabView>;
}
