'use client';

// #75 — Twins. Who plays most like you? Every regular has a profile of eight percentiles (fight,
// farm, growth, damage, teamwork, vision, survival, sieges). Pick a player: their statistical twin
// stands next to them with both profiles overlaid, the runners-up are listed, and the very
// opposite player closes the page.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { ROLE_LABEL, SUBJECTS, profiles } from '@/lib/stats-lab/season';
import { Avatar, C, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';
import { PlayerPicker, usePlayerPick } from '../picker';

function similarity(a: Record<string, number>, b: Record<string, number>) {
  const d = SUBJECTS.reduce((s, x) => s + Math.pow((a[x.key] ?? 0.5) - (b[x.key] ?? 0.5), 2), 0);
  return 1 - Math.sqrt(d / SUBJECTS.length);
}

function Radar({ a, b, size }: { a: Record<string, number>; b?: Record<string, number>; size: number }) {
  const n = SUBJECTS.length; const r = size / 2 - 40; const cx = size / 2; const cy = size / 2;
  const pt = (i: number, v: number) => { const ang = (i / n) * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(ang) * r * v, cy + Math.sin(ang) * r * v]; };
  const poly = (rec: Record<string, number>) => SUBJECTS.map((s, i) => pt(i, 0.08 + 0.92 * (rec[s.key] ?? 0)).join(',')).join(' ');
  return (
    <svg width={size} height={size} overflow="visible">
      {[0.25, 0.5, 0.75, 1].map(k => <polygon key={k} points={SUBJECTS.map((_, i) => pt(i, k).join(',')).join(' ')} fill="none" stroke={ink(12)} />)}
      {SUBJECTS.map((s, i) => { const [x, y] = pt(i, 1.1); const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end'; return <text key={s.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fontWeight={700} fill={C.muted}>{s.name}</text>; })}
      {b && <motion.polygon points={poly(b)} fill={mix(C.secondary, 25)} stroke={C.secondary} strokeWidth={2.5} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
      <polygon points={poly(a)} fill={mix(C.primary, 30)} stroke={C.primary} strokeWidth={2.5} />
    </svg>
  );
}

function Twins({ model }: { model: Model }) {
  const font = useHeaderFont();
  const pick = usePlayerPick(model);
  const prof = useMemo(() => profiles(model, false), [model]);
  const p = pick.player;
  const me = p ? prof.get(p.id) : undefined;
  const ranked = useMemo(() => {
    if (!p || !me) return [];
    return [...prof.entries()].filter(([id]) => id !== p.id).map(([id, r]) => ({ q: model.playerById.get(id)!, r, s: similarity(me, r) })).filter(x => x.q).sort((a, b) => b.s - a.s);
  }, [p, me, prof, model]);
  const [altId, setAlt] = useState<string | null>(null);
  useEffect(() => { setAlt(null); }, [p?.id]);
  const twin = ranked.find(x => x.q.id === altId) ?? ranked[0];
  const opposite = ranked[ranked.length - 1];
  const [ref, box] = useSize<HTMLDivElement>();
  const rs = Math.min(box.w - 180, box.h);

  const face = (q: PlayerX, label: string, ring: string) => (
    <div className="flex flex-col items-center gap-1.5 text-center w-[150px]">
      <Avatar player={q} size={120} ring={ring} />
      <div className="text-lg font-logik-extended-bold uppercase truncate max-w-full" style={{ color: C.heading, ...font }}>{q.name}</div>
      <div className="flex items-center gap-1 text-[11px]" style={{ color: C.muted }}><TeamLogo team={q.team} size={14} />{q.role ? ROLE_LABEL[q.role] : '—'}</div>
      <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: ring }}>{label}</div>
    </div>
  );

  return (
    <>
      <LabTitle sub={<Tip content="Podobieństwo profili: 8 percentyli średnich na grę wśród graczy z minimalną liczbą gier, bez względu na pozycję"><span className="cursor-help">statystyczni bliźniacy</span></Tip>}>Bliźniacy</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <PlayerPicker pick={pick} className="w-[30%] shrink-0" size={68} cols={4} />
        {p && me && twin ? (
          <AnimatePresence mode="wait">
            <motion.div key={p.id + twin.q.id} className="flex-1 min-w-0 flex gap-4 min-h-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex-1 min-w-0 flex flex-col items-center min-h-0">
                <div className="flex items-center gap-4 shrink-0">
                  {face(p, 'wybrany', C.primary)}
                  <div className="flex flex-col items-center">
                    <div className="text-4xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{Math.round(twin.s * 100)}%</div>
                    <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>podobieństwa</div>
                  </div>
                  {face(twin.q, 'bliźniak', C.secondary)}
                </div>
                <div ref={ref} className="flex-1 min-h-0 w-full flex items-center justify-center overflow-visible">{rs > 0 && <div style={{ width: rs, height: rs, overflow: 'visible' }}><Radar a={me} b={twin.r} size={rs} /></div>}</div>
              </div>
              <div className="w-[250px] shrink-0 flex flex-col gap-1.5 min-h-0">
                <div className="text-[10px] uppercase tracking-[0.3em] mb-0.5" style={{ color: C.muted }}>Też podobni</div>
                {ranked.slice(0, 6).map(x => (
                  <Tip key={x.q.id} content={<TipBody title={x.q.name}>{x.q.team?.name} · {x.q.role ? ROLE_LABEL[x.q.role] : '—'}</TipBody>}>
                    <button type="button" onClick={() => setAlt(x.q.id)} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left"
                      style={{ background: x === twin ? mix(C.secondary, 25) : ink(4), boxShadow: x === twin ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                      <Avatar player={x.q} size={38} />
                      <span className="flex-1 min-w-0 truncate font-bold text-sm">{x.q.name}</span>
                      <span className="font-bold tabular-nums" style={{ color: C.heading }}>{Math.round(x.s * 100)}%</span>
                    </button>
                  </Tip>
                ))}
                {opposite && (
                  <button type="button" onClick={() => setAlt(opposite.q.id)} className="mt-auto rounded-2xl p-3 flex items-center gap-3 text-left" style={{ background: mix(C.loss, 14), border: `1px solid ${mix(C.loss, 35)}` }}>
                    <Avatar player={opposite.q} size={52} />
                    <div className="min-w-0"><div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.loss }}>Przeciwieństwo</div><div className="font-bold truncate" style={{ color: C.heading }}>{opposite.q.name}</div><div className="text-xs" style={{ color: C.muted }}>{Math.round(opposite.s * 100)}% podobieństwa</div></div>
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.muted }}>{p?.name ?? 'Ten gracz'} ma za mało gier, by mieć profil.</div>}
      </div>
    </>
  );
}

export default function D75Twins() {
  return <LabView><WithModel>{m => <Twins model={m} />}</WithModel></LabView>;
}
