'use client';

// #53 — Fire & ice. Who is hot right now? Form = average performance over the last five games
// minus the season average. The hottest stand in fire on the left, the coldest in ice on the
// right; win and loss streaks still running get a counter. Click anyone for their last ten
// games against their own average.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtDay, scored } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const LAST = 5;
const FIRE = '#ff6a2b';
const ICE = '#5cc8ff';

interface Form { p: PlayerX; s: Perf[]; season: number; recent: number; d: number; streak: number }

function forms(model: Model): Form[] {
  return model.players.map(p => {
    const s = scored(p.perfs);
    if (s.length < Math.max(model.minGames, LAST + 1)) return null;
    const season = s.reduce((a, x) => a + x.score, 0) / s.length;
    const last = s.slice(-LAST);
    const recent = last.reduce((a, x) => a + x.score, 0) / last.length;
    let streak = 0; const all = p.perfs;
    for (let i = all.length - 1; i >= 0; i--) { const w = all[i].win; if (streak === 0) streak = w ? 1 : -1; else if ((streak > 0) === w) streak += w ? 1 : -1; else break; }
    return { p, s, season, recent, d: recent - season, streak };
  }).filter((x): x is Form => !!x);
}

function Glow({ color, size, children }: { color: string; size: number; children: React.ReactNode }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div className="absolute -inset-3 rounded-full blur-xl" style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
        animate={{ opacity: [0.55, 0.95, 0.55], scale: [0.96, 1.06, 0.96] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Side({ list, hot, sel, onSel }: { list: Form[]; hot: boolean; sel: string | null; onSel: (id: string) => void }) {
  const font = useHeaderFont();
  const color = hot ? FIRE : ICE;
  const [lead, ...rest] = list;
  if (!lead) return null;
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2 rounded-3xl p-4 min-h-0" style={{ background: `linear-gradient(${hot ? 160 : 200}deg, ${mix(color, 22)}, transparent 65%)`, border: `1px solid ${mix(color, 30)}` }}>
      <div className="text-[11px] uppercase tracking-[0.4em] font-bold" style={{ color }}>{hot ? 'W ogniu' : 'Zamrożeni'}</div>
      <button type="button" onClick={() => onSel(lead.p.id)} className="flex items-center gap-4 text-left rounded-2xl p-2" style={{ boxShadow: sel === lead.p.id ? `0 0 0 2px ${color}` : undefined }}>
        <Glow color={color} size={112}><Avatar player={lead.p} size={112} ring={color} /></Glow>
        <div className="min-w-0">
          <div className="text-2xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{lead.p.name}</div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}><TeamLogo team={lead.p.team} size={18} />{lead.p.team?.name}</div>
          <div className="text-4xl font-logik-extended-bold tabular-nums mt-1" style={{ color, ...font }}>{lead.d > 0 ? '+' : ''}{lead.d.toFixed(1)}</div>
          <div className="text-[11px]" style={{ color: C.muted }}>{lead.recent.toFixed(1)} w ostatnich {LAST} vs {lead.season.toFixed(1)} w sezonie</div>
        </div>
      </button>
      <div className="flex-1 min-h-0 flex flex-col gap-1.5 justify-start overflow-hidden">
        {rest.map(f => (
          <Tip key={f.p.id} content={<TipBody title={f.p.name}>{f.recent.toFixed(1)} pkt w ostatnich {LAST} grach · średnia sezonu {f.season.toFixed(1)}</TipBody>}>
            <button type="button" onClick={() => onSel(f.p.id)} className="flex items-center gap-3 rounded-xl px-2 h-12 text-left shrink-0"
              style={{ background: sel === f.p.id ? mix(color, 25) : ink(4) }}>
              <Avatar player={f.p} size={38} ring={mix(color, 70)} />
              <span className="flex-1 min-w-0 truncate font-bold">{f.p.name}</span>
              {Math.abs(f.streak) >= 3 && (f.streak > 0) === hot && <Tip content={hot ? 'Wygrane z rzędu — seria trwa' : 'Porażki z rzędu — seria trwa'}><span className="text-[11px] font-bold px-1.5 rounded cursor-help" style={{ background: mix(color, 30), color: C.heading }}>{Math.abs(f.streak)}× {hot ? 'W' : 'P'}</span></Tip>}
              <span className="w-14 text-right text-lg font-bold tabular-nums" style={{ color }}>{f.d > 0 ? '+' : ''}{f.d.toFixed(1)}</span>
            </button>
          </Tip>
        ))}
      </div>
    </div>
  );
}

function FireIce({ model }: { model: Model }) {
  const font = useHeaderFont();
  const all = useMemo(() => forms(model), [model]);
  const hot = useMemo(() => all.filter(f => f.d > 0).sort((a, b) => b.d - a.d).slice(0, 6), [all]);
  const cold = useMemo(() => all.filter(f => f.d < 0).sort((a, b) => a.d - b.d).slice(0, 6), [all]);
  const [selId, setSel] = useState<string | null>(null);
  const sel = all.find(f => f.p.id === selId) ?? hot[0] ?? cold[0];
  const [ref, box] = useSize<HTMLDivElement>();
  const games = sel ? sel.s.slice(-10) : [];
  const maxV = Math.max(1, ...games.map(g => g.score), sel?.season ?? 0) * 1.1;
  const color = sel && sel.d >= 0 ? FIRE : ICE;

  return (
    <>
      <LabTitle sub={<Tip content={`Forma = średnia punktów występu z ostatnich ${LAST} gier minus średnia całego sezonu. Liczą się gracze z co najmniej ${Math.max(model.minGames, LAST + 1)} grami.`}><span className="cursor-help">forma z ostatnich {LAST} gier</span></Tip>}>Ogień i lód</LabTitle>
      <div className="flex-1 min-h-0 flex gap-4 mt-3">
        <Side list={hot} hot sel={sel?.p.id ?? null} onSel={setSel} />
        {/* Selected: last ten games */}
        <div className="flex-[1.1] min-w-0 flex flex-col rounded-3xl p-4 min-h-0" style={{ background: ink(4), border: `1px solid ${ink(8)}` }}>
          <AnimatePresence mode="wait">
            {sel && (
              <motion.div key={sel.p.id} className="flex-1 min-h-0 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-3 shrink-0">
                  <Avatar player={sel.p} size={52} ring={color} />
                  <div className="flex-1 min-w-0"><div className="text-xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{sel.p.name}</div><div className="text-xs" style={{ color: C.muted }}>ostatnie {games.length} gier · linia = średnia sezonu</div></div>
                  <div className="text-right"><div className="text-3xl font-logik-extended-bold tabular-nums" style={{ color, ...font }}>{sel.d > 0 ? '+' : ''}{sel.d.toFixed(1)}</div><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>forma</div></div>
                </div>
                <div ref={ref} className="relative flex-1 min-h-0 mt-3">
                  {box.w > 0 && (
                    <>
                      <div className="absolute left-0 right-0 border-t-2 border-dashed z-10" style={{ top: (box.h - 52) * (1 - sel.season / maxV), borderColor: C.heading, opacity: 0.6 }}>
                        <span className="absolute right-0 -top-5 text-[10px] font-bold" style={{ color: C.heading }}>{sel.season.toFixed(1)}</span>
                      </div>
                      <div className="absolute inset-x-0 top-0 flex items-end gap-2" style={{ height: box.h - 52 }}>
                        {games.map((g, i) => {
                          const above = g.score >= sel.season;
                          return (
                            <Tip key={g.idx} content={<TipBody title={`${heroName(g.heroId)} · ${g.win ? 'wygrana' : 'porażka'}`}>{fmtDay(g.game.start)} · {g.kills}/{g.deaths}/{g.assists} · {g.score.toFixed(1)} pkt</TipBody>}>
                              <motion.div className="flex-1 rounded-t-lg cursor-help relative" style={{ background: above ? `linear-gradient(0deg, ${mix(FIRE, 50)}, ${FIRE})` : `linear-gradient(0deg, ${mix(ICE, 40)}, ${ICE})`, opacity: i >= games.length - LAST ? 1 : 0.45 }}
                                initial={{ height: 0 }} animate={{ height: `${(g.score / maxV) * 100}%` }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 160, damping: 20 }}>
                                <span className="absolute -top-5 inset-x-0 text-center text-[11px] font-bold tabular-nums" style={{ color: C.heading }}>{g.score.toFixed(0)}</span>
                              </motion.div>
                            </Tip>
                          );
                        })}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 flex gap-2 h-[46px]">
                        {games.map(g => (
                          <div key={g.idx} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                            <HeroImg heroId={g.heroId} variant="icon" className="rounded" style={{ width: 30, height: 30 }} />
                            <span className="w-full h-1.5 rounded-full" style={{ background: g.win ? C.win : C.loss }} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Side list={cold} hot={false} sel={sel?.p.id ?? null} onSel={setSel} />
      </div>
    </>
  );
}

export default function D53FireIce() {
  return <LabView><WithModel>{m => <FireIce model={m} />}</WithModel></LabView>;
}
