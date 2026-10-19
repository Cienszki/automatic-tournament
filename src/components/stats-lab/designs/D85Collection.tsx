'use client';

// #85 — Hero collection. Gotta play 'em all: every hero in the game is a slot, coloured once the
// player has played it this season (with games and wins), greyed out otherwise. The list on the
// left ranks the biggest collectors; the header shows completion and the newest addition.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { ATTR_COLOR, heroAttr, heroName, type HeroAttr } from '@/lib/stats-lab/heroes';
import { getAllHeroData } from '@/lib/hero-mapping';
import { fmtDay } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize } from '../kit';

const ATTRS: Array<{ a: HeroAttr; label: string }> = [{ a: 'str', label: 'Siła' }, { a: 'agi', label: 'Zręczność' }, { a: 'int', label: 'Inteligencja' }, { a: 'all', label: 'Uniwersalni' }];

function Collection({ model }: { model: Model }) {
  const font = useHeaderFont();
  const allHeroes = useMemo(() => Object.values(getAllHeroData()).map(h => h.id).sort((a, b) => heroName(a).localeCompare(heroName(b))), []);
  const groups = useMemo(() => ATTRS.map(g => ({ ...g, ids: allHeroes.filter(id => heroAttr(id) === g.a) })), [allHeroes]);
  const collectors = useMemo(() => model.players.filter(p => p.games > 0).sort((a, b) => b.heroes.length - a.heroes.length || b.games - a.games), [model]);
  const [selId, setSel] = useState<string | null>(null);
  const p = collectors.find(x => x.id === selId) ?? collectors[0];
  const [listRef, fit] = useFitCount<HTMLDivElement>(48, 4, 3);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(collectors.length / fit)); const pg = Math.min(page, pages - 1);
  const owned = useMemo(() => new Map((p?.heroes ?? []).map(h => [h.heroId, h])), [p]);
  const newest = useMemo(() => { const seen = new Set<number>(); let last = p?.perfs[0]; for (const x of p?.perfs ?? []) if (!seen.has(x.heroId)) { seen.add(x.heroId); last = x; } return last; }, [p]);
  const [ref, box] = useSize<HTMLDivElement>();
  let tw = 30;
  for (let w = 90; w >= 28; w -= 2) {
    const per = Math.max(1, Math.floor((box.w - 30 + 3) / (w + 3)));
    const h = groups.reduce((s, g) => s + Math.ceil(g.ids.length / per) * (w * 0.56 + 3) + 8, 0);
    if (h <= box.h) { tw = w; break; }
  }
  const pct = p ? p.heroes.length / allHeroes.length : 0;

  return (
    <>
      <LabTitle sub={<span>{allHeroes.length} bohaterów w grze · złap je wszystkie</span>}>Kolekcja bohaterów</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div className="w-[260px] shrink-0 flex flex-col min-h-0">
          <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-1">
            {collectors.slice(pg * fit, pg * fit + fit).map((x, k) => {
              const on = x === p;
              return (
                <button key={x.id} type="button" onClick={() => setSel(x.id)} className="h-[48px] shrink-0 flex items-center gap-2.5 rounded-xl px-2 text-left"
                  style={{ background: on ? mix(C.primary, 40) : ink(4), boxShadow: on ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                  <span className="w-5 text-xs font-bold tabular-nums" style={{ color: C.muted }}>{pg * fit + k + 1}</span>
                  <Avatar player={x} size={34} />
                  <span className="flex-1 min-w-0 truncate font-bold text-sm">{x.name}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: C.heading }}>{x.heroes.length}</span>
                </button>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2 mt-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-8 h-8 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-14 text-center" style={{ color: C.muted }}>{pg + 1} / {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-8 h-8 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          {p && (
            <AnimatePresence mode="wait">
              <motion.div key={p.id} className="shrink-0 flex items-center gap-5" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="relative w-[92px] h-[92px] shrink-0">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90"><circle cx="50" cy="50" r="46" fill="none" stroke={ink(10)} strokeWidth="6" /><motion.circle cx="50" cy="50" r="46" fill="none" stroke={C.secondary} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 46} initial={{ strokeDashoffset: 2 * Math.PI * 46 }} animate={{ strokeDashoffset: 2 * Math.PI * 46 * (1 - pct) }} transition={{ duration: 0.9 }} /></svg>
                  <div className="absolute inset-[9px]"><Avatar player={p} size={74} /></div>
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{p.name}</div>
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: C.muted }}><TeamLogo team={p.team} size={18} />{p.team?.name}</div>
                </div>
                <div className="ml-6"><div className="text-4xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{p.heroes.length}<span className="text-xl" style={{ color: C.muted }}> / {allHeroes.length}</span></div><div className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>{Math.round(pct * 100)}% kolekcji</div></div>
                {newest && (
                  <Tip content={`Pierwszy raz: ${fmtDay(newest.game.start)}`}>
                    <div className="ml-auto flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-help" style={{ background: ink(5) }}>
                      <HeroImg heroId={newest.heroId} className="rounded-md" style={{ width: 72, height: 40 }} />
                      <div className="leading-tight"><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Najnowszy</div><div className="font-bold" style={{ color: C.heading }}>{heroName(newest.heroId)}</div></div>
                    </div>
                  </Tip>
                )}
              </motion.div>
            </AnimatePresence>
          )}
          <div ref={ref} className="flex-1 min-h-0 flex flex-col">
            {box.w > 0 && groups.map(g => (
              <div key={g.a} className="flex gap-2 mb-2">
                <Tip content={`${g.label}: ${g.ids.filter(id => owned.has(id)).length} / ${g.ids.length}`}><div className="w-[22px] shrink-0 rounded-md cursor-help" style={{ background: `linear-gradient(180deg, ${ATTR_COLOR[g.a]}, transparent)` }} /></Tip>
                <div className="flex-1 flex flex-wrap gap-[3px]">
                  {g.ids.map(id => {
                    const h = owned.get(id);
                    return (
                      <Tip key={id} content={<TipBody title={heroName(id)}>{h ? `${h.games} gier · ${h.wins} wygranych` : 'jeszcze nie w kolekcji'}</TipBody>}>
                        <motion.span className="relative block rounded overflow-hidden" style={{ width: tw, height: tw * 0.56 }} initial={false} animate={{ opacity: h ? 1 : 0.28 }} whileHover={{ scale: 1.2, zIndex: 5 }}>
                          <HeroImg heroId={id} className="w-full h-full" style={{ filter: h ? undefined : 'grayscale(1)' }} />
                          {h && h.games > 1 && <span className="absolute bottom-0 right-0 px-1 text-[9px] font-bold bg-black/75 text-white rounded-tl">{h.games}</span>}
                        </motion.span>
                      </Tip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function D85Collection() {
  return <LabView><WithModel>{m => <Collection model={m} />}</WithModel></LabView>;
}
