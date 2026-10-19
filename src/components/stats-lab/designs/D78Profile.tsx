'use client';

// #78 — Player profile. A social-media profile for a player: the header with counters, highlight
// circles of their most played heroes (click one to filter), and a grid of "posts" — every game
// is a tile with its hero. Click a post to open it: the hero render, the caption, the numbers and
// the teammates tagged in it.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf } from '@/lib/stats-lab/derive';
import { opponentOf } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { ROLE_LABEL, fmtDay } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, Tip, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';
import { PlayerPicker, usePlayerPick } from '../picker';

const RING = 'conic-gradient(from 210deg, #f9ce34, #ee2a7b, #6228d7, #f9ce34)';

function caption(x: Perf): string {
  const kda = `${x.kills}/${x.deaths}/${x.assists}`;
  if (x.deaths === 0) return `${kda} i ani razu na szarym ekranie. ${x.win ? 'GG.' : 'Szkoda tylko wyniku.'}`;
  if (x.kills >= 15) return `${kda} na ${heroName(x.heroId)}. Ktoś musiał to zrobić.`;
  if (x.assists >= 25) return `${x.assists} asyst — praca drużynowa w czystej postaci.`;
  if (!x.win && x.deaths >= 10) return `Nie mówmy o tym. ${kda}.`;
  return x.win ? `Kolejne zwycięstwo na ${heroName(x.heroId)} (${kda}).` : `Przegrana, ale ${kda} na ${heroName(x.heroId)} wstydu nie przynosi.`;
}

function Profile({ model }: { model: Model }) {
  const font = useHeaderFont();
  const pick = usePlayerPick(model);
  const p = pick.player;
  const [hero, setHero] = useState<number | null>(null);
  const posts = useMemo(() => [...(p?.perfs ?? [])].reverse().filter(x => hero == null || x.heroId === hero), [p, hero]);
  const [selIdx, setSel] = useState<number | null>(null);
  useEffect(() => { setHero(null); setSel(null); setPage(0); }, [p?.id]);
  const sel = posts.find(x => x.idx === selIdx) ?? posts[0];
  const [gridRef, grid] = useSize<HTMLDivElement>();
  const cols = 4; const gap = 4;
  const tile = grid.w > 0 ? (grid.w - (cols - 1) * gap) / cols : 80;
  const rows = Math.max(1, Math.floor((grid.h + gap) / (tile + gap)));
  const per = rows * cols;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(posts.length / per));
  const pg = Math.min(page, pages - 1);
  if (!p) return <LabTitle>Profil gracza</LabTitle>;
  const mates = sel ? sel.game.perfs.filter(o => o.radiant === sel.radiant && o.pid !== p.id && o.player) : [];

  return (
    <>
      <LabTitle sub={<span>każda gra to post · kliknij post, by go otworzyć</span>}>Profil gracza</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <PlayerPicker pick={pick} className="w-[24%] shrink-0" size={46} cols={4} teamSize={28} teamRows={4} />
        {/* profile */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          <div className="shrink-0 flex items-center gap-5">
            <div className="rounded-full p-[4px] shrink-0" style={{ background: RING }}><div className="rounded-full p-[3px]" style={{ background: 'var(--tournament-background, #0b0b10)' }}><Avatar player={p} size={104} /></div></div>
            <div className="min-w-0 flex-1">
              <div className="text-2xl font-logik-extended-bold truncate" style={{ color: C.heading, ...font }}>{p.name}</div>
              <div className="flex gap-6 my-1.5">
                {[[p.games, 'gier'], [p.wins, 'wygranych'], [p.heroes.length, 'bohaterów'], [p.agg.score.avg != null ? p.agg.score.avg.toFixed(1) : '–', 'pkt / grę']].map(([v, l]) => (
                  <div key={l as string}><span className="text-lg font-bold tabular-nums" style={{ color: C.heading }}>{v}</span> <span className="text-sm" style={{ color: C.muted }}>{l}</span></div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-sm" style={{ color: C.text }}><TeamLogo team={p.team} size={18} />{p.team?.name} · {p.role ? ROLE_LABEL[p.role] : 'stand-in'}{p.heroes[0] ? ` · najczęściej ${heroName(p.heroes[0].heroId)}` : ''}</div>
            </div>
          </div>
          {/* highlights */}
          <div className="shrink-0 flex gap-3">
            {p.heroes.slice(0, 6).map(h => (
              <Tip key={h.heroId} content={`${heroName(h.heroId)} · ${h.games} gier · ${h.wins} wygranych`}>
                <button type="button" onClick={() => { setHero(x => (x === h.heroId ? null : h.heroId)); setPage(0); setSel(null); }} className="flex flex-col items-center gap-1">
                  <span className="rounded-full p-[2px]" style={{ background: hero === h.heroId ? RING : ink(20) }}>
                    <HeroImg heroId={h.heroId} variant="icon" className="rounded-full" style={{ width: 54, height: 54, background: '#15151c', border: '2px solid var(--tournament-background, #0b0b10)' }} />
                  </span>
                  <span className="text-[10px] truncate max-w-[64px]" style={{ color: C.text }}>{heroName(h.heroId)}</span>
                </button>
              </Tip>
            ))}
          </div>
          <div className="shrink-0 h-px" style={{ background: ink(12) }} />
          <div ref={gridRef} className="flex-1 min-h-0 grid content-start" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
            {grid.w > 0 && posts.slice(pg * per, pg * per + per).map(x => (
              <motion.button key={x.idx} type="button" onClick={() => setSel(x.idx)} className="relative overflow-hidden group" style={{ height: tile, boxShadow: x === sel ? `inset 0 0 0 3px ${C.secondary}` : undefined }} whileHover={{ scale: 1.02 }}>
                <HeroImg heroId={x.heroId} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full" style={{ background: x.win ? C.win : C.loss, boxShadow: '0 0 0 2px rgba(0,0,0,0.6)' }} />
                <span className="absolute inset-0 flex items-center justify-center gap-3 text-white font-bold bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity">{x.kills}/{x.deaths}/{x.assists}</span>
                {x === sel && <span className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 3px ${C.secondary}` }} />}
              </motion.button>
            ))}
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-8 h-8 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-14 text-center" style={{ color: C.muted }}>{pg + 1} / {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-8 h-8 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
        {/* open post */}
        <div className="w-[300px] shrink-0 rounded-2xl overflow-hidden flex flex-col min-h-0" style={{ background: ink(4), border: `1px solid ${ink(10)}` }}>
          <AnimatePresence mode="wait">
            {sel && (
              <motion.div key={sel.idx} className="flex-1 min-h-0 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-2 px-3 py-2 shrink-0"><Avatar player={p} size={30} /><span className="text-sm font-bold" style={{ color: C.heading }}>{p.name}</span><span className="ml-auto text-xs" style={{ color: C.muted }}>{fmtDay(sel.game.start)}</span></div>
                <div className="relative flex-1 min-h-0" style={{ background: '#0b0b10' }}>
                  <HeroImg heroId={sel.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-50" />
                  <div className="absolute inset-x-0 top-2 bottom-0"><HeroRender heroId={sel.heroId} sizes="300px" /></div>
                  <span className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded text-white" style={{ background: sel.win ? C.win : C.loss }}>{sel.win ? 'wygrana' : 'porażka'}</span>
                </div>
                <div className="p-3 flex flex-col gap-2 shrink-0">
                  <div className="text-sm leading-snug" style={{ color: C.text }}><b style={{ color: C.heading }}>{p.name}</b> {caption(sel)}</div>
                  <div className="flex justify-between text-xs" style={{ color: C.muted }}><span>vs {opponentOf(sel)?.name}</span><span>{fmtClock(sel.game.duration)} · {sel.gpm} GPM · {Number.isFinite(sel.score) ? `${sel.score.toFixed(1)} pkt` : ''}</span></div>
                  {mates.length > 0 && <div className="flex items-center gap-1.5"><span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>oznaczeni</span>{mates.map(o => <Tip key={o.pid} content={`${o.player!.name} · ${heroName(o.heroId)}`}><span><Avatar player={o.player} size={26} /></span></Tip>)}</div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D78Profile() {
  return <LabView><WithModel>{m => <Profile model={m} />}</WithModel></LabView>;
}
