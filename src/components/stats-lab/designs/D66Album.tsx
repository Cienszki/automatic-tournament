'use client';

// #66 — Sticker album. A Panini-style album with one spread per team: the crest page on the left,
// the players' stickers on the right (shiny for record holders and the team's best performer).
// Turn pages with the arrows, ← → or the tabs below; click a sticker to turn it over.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { topPerfs } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { POS_OF, ROLE_LABEL } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const PAGE = '#f4ecd8';
const PAGE_INK = '#2a2118';
const RECORD_KEYS: MetricKey[] = ['kills', 'assists', 'kda', 'gpm', 'xpm', 'lastHits', 'heroDamage', 'towerDamage', 'wards', 'stacks', 'netWorth', 'score'];

function Sticker({ p, w, shiny, n, records }: { p: PlayerX; w: number; shiny: boolean; n: number; records: string[] }) {
  const font = useHeaderFont();
  const [flip, setFlip] = useState(false);
  const h = w * 1.32;
  const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 10, overflow: 'hidden', boxShadow: '0 6px 14px rgba(0,0,0,0.35)' };
  return (
    <motion.button type="button" onClick={() => setFlip(f => !f)} className="relative shrink-0" style={{ width: w, height: h, perspective: 900 }} whileHover={{ rotate: -1.5, scale: 1.03 }}>
      <motion.div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }} animate={{ rotateY: flip ? 180 : 0 }} transition={{ duration: 0.5 }}>
        <div style={{ ...face, background: shiny ? 'linear-gradient(135deg, #f8e7a1, #d9b44a 40%, #fff6cf 55%, #c99a2e)' : '#fff' }} className="flex flex-col p-1.5">
          <div className="relative flex-1 rounded-md overflow-hidden" style={{ background: '#ddd' }}>
            <Avatar player={p} size={Math.round(w - 12)} className="!rounded-none !w-full !h-full" />
            {shiny && <motion.div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.6) 45%, transparent 60%)', backgroundSize: '250% 100%' }} animate={{ backgroundPosition: ['100% 0', '-100% 0'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }} />}
            <span className="absolute top-1 left-1 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center" style={{ background: PAGE_INK, color: '#fff' }}>{POS_OF[p.role ?? ''] ?? '–'}</span>
          </div>
          <div className="pt-1 text-center leading-tight" style={{ color: PAGE_INK }}>
            <div className="font-logik-extended-bold uppercase truncate" style={{ fontSize: Math.max(11, w * 0.09), ...font }}>{p.name}</div>
            <div className="text-[10px] tabular-nums opacity-75">{p.games} gier · {(p.agg.score.avg ?? 0).toFixed(1)} pkt</div>
          </div>
          <span className="absolute bottom-1 right-1.5 text-[9px] font-bold opacity-50" style={{ color: PAGE_INK }}>{n}</span>
        </div>
        <div style={{ ...face, transform: 'rotateY(180deg)', background: '#fff', color: PAGE_INK }} className="flex flex-col p-2.5 gap-1.5 text-left">
          <div className="font-logik-extended-bold uppercase truncate" style={{ fontSize: Math.max(11, w * 0.085), ...font }}>{p.name}</div>
          <div className="text-[10px] opacity-70">{p.role ? ROLE_LABEL[p.role] : '—'} · {p.wins}–{p.losses}</div>
          <div className="grid grid-cols-2 gap-x-2 text-[11px] tabular-nums">
            <span>K/D/A</span><b className="text-right">{(p.agg.kills.avg ?? 0).toFixed(1)}/{(p.agg.deaths.avg ?? 0).toFixed(1)}/{(p.agg.assists.avg ?? 0).toFixed(1)}</b>
            <span>GPM</span><b className="text-right">{Math.round(p.agg.gpm.avg ?? 0)}</b>
            <span>XPM</span><b className="text-right">{Math.round(p.agg.xpm.avg ?? 0)}</b>
          </div>
          <div className="flex gap-1 mt-auto">{p.heroes.slice(0, 3).map(hu => <HeroImg key={hu.heroId} heroId={hu.heroId} className="rounded-sm flex-1 min-w-0 aspect-video" />)}</div>
          {records.length > 0 && <div className="text-[10px] font-bold" style={{ color: '#9a6a00' }}>Rekord: {records.join(', ')}</div>}
        </div>
      </motion.div>
    </motion.button>
  );
}

function Album({ model }: { model: Model }) {
  const font = useHeaderFont();
  const teams = useMemo(() => model.teams.filter(t => t.players.some(p => !p.standin)).sort((a, b) => a.name.localeCompare(b.name)), [model]);
  const records = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const k of RECORD_KEYS) { const r = topPerfs(model, k, 1)[0]; if (r?.player) m.set(r.pid, [...(m.get(r.pid) ?? []), metric(k).label]); }
    return m;
  }, [model]);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (d: number) => { setDir(d); setI(x => Math.max(0, Math.min(teams.length - 1, x + d))); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const t: TeamX | undefined = teams[i];
  const roster = (t?.players ?? []).filter(p => !p.standin).sort((a, b) => (POS_OF[a.role ?? ''] ?? 9) - (POS_OF[b.role ?? ''] ?? 9)).slice(0, 6);
  const best = [...roster].sort((a, b) => (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0))[0];
  const [ref, box] = useSize<HTMLDivElement>();
  const cols = roster.length > 4 ? 3 : 2;
  const rowsN = Math.ceil(roster.length / cols);
  const sw = Math.max(70, Math.min((box.w - 40 - (cols - 1) * 14) / cols, (box.h - 40 - (rowsN - 1) * 14) / rowsN / 1.32));
  const startNo = teams.slice(0, i).reduce((a, x) => a + Math.min(6, x.players.filter(p => !p.standin).length), 0) + 1;

  return (
    <>
      <LabTitle sub={<span>strona {i + 1} z {teams.length} · kliknij naklejkę, by ją odwrócić</span>}>Album</LabTitle>
      <div className="flex-1 min-h-0 flex items-center gap-3 mt-3">
        <button type="button" aria-label="Poprzednia strona" disabled={i === 0} onClick={() => go(-1)} className="w-12 h-12 shrink-0 rounded-full text-2xl disabled:opacity-20" style={{ background: ink(8) }}>‹</button>
        <div className="relative flex-1 min-w-0 h-full" style={{ perspective: 2000 }}>
          <AnimatePresence mode="wait" custom={dir}>
            {t && (
              <motion.div key={t.id} className="absolute inset-0 flex rounded-2xl overflow-hidden" style={{ boxShadow: '0 30px 70px rgba(0,0,0,0.55)', transformOrigin: dir > 0 ? 'left center' : 'right center' }}
                initial={{ rotateY: dir > 0 ? 25 : -25, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: dir > 0 ? -25 : 25, opacity: 0 }} transition={{ duration: 0.35 }}>
                {/* left page: crest */}
                <div className="w-[40%] shrink-0 flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: `linear-gradient(90deg, ${PAGE} 92%, #d9ceb4)`, color: PAGE_INK }}>
                  <div className="text-[11px] uppercase tracking-[0.4em] opacity-60">Sezon · drużyna</div>
                  <div className="rounded-2xl p-4" style={{ background: '#fff', boxShadow: '0 6px 14px rgba(0,0,0,0.25)' }}><TeamLogo team={t} size={Math.min(190, box.h * 0.4)} /></div>
                  <div className="text-3xl font-logik-extended-bold uppercase leading-tight" style={font}>{t.name}</div>
                  <div className="flex gap-6">
                    <div><div className="text-2xl font-bold tabular-nums">{t.wins}–{t.losses}</div><div className="text-[10px] uppercase tracking-widest opacity-60">gry</div></div>
                    <div><div className="text-2xl font-bold tabular-nums">{Math.round(t.wr * 100)}%</div><div className="text-[10px] uppercase tracking-widest opacity-60">wygranych</div></div>
                    <div><div className="text-2xl font-bold tabular-nums">{t.avg.kills.toFixed(0)}</div><div className="text-[10px] uppercase tracking-widest opacity-60">zabójstw / grę</div></div>
                  </div>
                  <div className="flex gap-1.5">
                    {t.heroPicks.slice(0, 4).map(h => <Tip key={h.heroId} content={`${heroName(h.heroId)} · ${h.games} gier`}><span><HeroImg heroId={h.heroId} className="rounded" style={{ width: 64, height: 36 }} /></span></Tip>)}
                  </div>
                </div>
                {/* right page: stickers */}
                <div ref={ref} className="flex-1 min-w-0 flex items-center justify-center p-5" style={{ background: `linear-gradient(90deg, #d9ceb4, ${PAGE} 6%)` }}>
                  <div className="grid gap-[14px]" style={{ gridTemplateColumns: `repeat(${cols}, ${sw}px)` }}>
                    {box.w > 0 && roster.map((p, k) => <Sticker key={p.id} p={p} w={sw} n={startNo + k} shiny={p === best || records.has(p.id)} records={records.get(p.id) ?? []} />)}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button type="button" aria-label="Następna strona" disabled={i >= teams.length - 1} onClick={() => go(1)} className="w-12 h-12 shrink-0 rounded-full text-2xl disabled:opacity-20" style={{ background: ink(8) }}>›</button>
      </div>
      <div className="shrink-0 flex justify-center gap-1.5 mt-3 flex-wrap">
        {teams.map((x, k) => (
          <Tip key={x.id} content={x.name}>
            <button type="button" onClick={() => { setDir(k > i ? 1 : -1); setI(k); }} className="rounded-lg p-1 transition-all"
              style={{ background: k === i ? mix(C.primary, 40) : ink(5), boxShadow: k === i ? `0 0 0 2px ${C.secondary}` : undefined, transform: k === i ? 'translateY(-3px)' : undefined }}>
              <TeamLogo team={x} size={30} />
            </button>
          </Tip>
        ))}
      </div>
    </>
  );
}

export default function D66Album() {
  return <LabView><WithModel>{m => <Album model={m} />}</WithModel></LabView>;
}
