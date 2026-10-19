'use client';

// #51 — Hero masters. The in-game hero grid (Strength / Agility / Intelligence / Universal) with
// every hero played this season, each wearing the avatar of its champion — the player with the
// best average performance on it (min. 2 games). Click a hero for its leaderboard and the
// challenger; the crown table counts who owns the most heroes.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HeroX, Model, Perf, PlayerX } from '@/lib/stats-lab/derive';
import { ATTR_COLOR, heroAttr, heroName, type HeroAttr } from '@/lib/stats-lab/heroes';
import { avgScore, scored } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize, wrColor } from '../kit';

const ATTRS: Array<{ a: HeroAttr; label: string }> = [
  { a: 'str', label: 'Siła' }, { a: 'agi', label: 'Zręczność' }, { a: 'int', label: 'Inteligencja' }, { a: 'all', label: 'Uniwersalni' },
];
const GOLD = '#f2c94c';
const MIN = 2;

interface Master { p: PlayerX; games: number; wins: number; avg: number; best: Perf }

function mastersOf(h: HeroX): Master[] {
  const by = new Map<string, Perf[]>();
  for (const p of h.perfs) if (p.player) { if (!by.has(p.pid)) by.set(p.pid, []); by.get(p.pid)!.push(p); }
  return [...by.values()].map(list => {
    const s = scored(list);
    return { p: list[0].player!, games: list.length, wins: list.filter(x => x.win).length, avg: avgScore(list) ?? -1, best: (s.length ? s : list).sort((a, b) => (b.score || 0) - (a.score || 0))[0] };
  }).sort((a, b) => Number(b.games >= MIN) - Number(a.games >= MIN) || b.avg - a.avg || b.games - a.games);
}

function Masters({ model }: { model: Model }) {
  const font = useHeaderFont();
  const heroes = useMemo(() => model.heroes.filter(h => h.picks > 0).map(h => ({ h, m: mastersOf(h) })), [model]);
  const groups = useMemo(() => ATTRS.map(g => ({ ...g, list: heroes.filter(x => heroAttr(x.h.heroId) === g.a).sort((a, b) => heroName(a.h.heroId).localeCompare(heroName(b.h.heroId))) })), [heroes]);
  const crowns = useMemo(() => {
    const c = new Map<string, { p: PlayerX; heroes: number[] }>();
    for (const { h, m } of heroes) { const k = m[0]; if (!k || k.games < MIN) continue; const r = c.get(k.p.id) ?? { p: k.p, heroes: [] }; r.heroes.push(h.heroId); c.set(k.p.id, r); }
    return [...c.values()].sort((a, b) => b.heroes.length - a.heroes.length);
  }, [heroes]);
  const [selId, setSel] = useState<number | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const sel = heroes.find(x => x.h.heroId === selId) ?? heroes[0];

  // tile size: the largest that fits every group
  const [ref, box] = useSize<HTMLDivElement>();
  let tw = 40;
  for (let w = 120; w >= 40; w -= 2) {
    const per = Math.max(1, Math.floor((box.w - 34 + 4) / (w + 4)));
    const h = groups.reduce((s, g) => s + Math.ceil(g.list.length / per) * (w * 0.56 + 4) + 10, 0);
    if (h <= box.h) { tw = w; break; }
  }
  const th = tw * 0.56;
  const king = sel?.m[0];
  const crowned = king && king.games >= MIN;
  const challenger = sel?.m.find((x, i) => i > 0 && x.games >= MIN);

  return (
    <>
      <LabTitle sub={<Tip content={`Mistrz bohatera: najwyższa średnia punktów występu na nim, minimum ${MIN} gry`}><span className="cursor-help">{heroes.length} bohaterów · {crowns.length} mistrzów</span></Tip>}>Mistrzowie bohaterów</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Hero grid */}
        <div ref={ref} className="flex-[1.6] min-w-0 min-h-0 flex flex-col">
          {box.w > 0 && groups.map(g => (
            <div key={g.a} className="flex gap-2 mb-[10px]">
              <Tip content={g.label}><div className="w-[26px] shrink-0 rounded-md" style={{ background: `linear-gradient(180deg, ${ATTR_COLOR[g.a]}, transparent)` }} /></Tip>
              <div className="flex-1 flex flex-wrap gap-[4px]">
                {g.list.map(({ h, m }) => {
                  const k = m[0]; const has = k && k.games >= MIN;
                  const on = h.heroId === sel?.h.heroId;
                  const dim = owner && (!has || k.p.id !== owner);
                  return (
                    <Tip key={h.heroId} content={<TipBody title={heroName(h.heroId)}>{has ? `Mistrz: ${k.p.name} · ${k.avg.toFixed(1)} pkt w ${k.games} grach` : 'Bez mistrza — nikt nie zagrał nim 2 razy'}</TipBody>}>
                      <motion.button type="button" onClick={() => setSel(h.heroId)} className="relative rounded-md overflow-visible" whileHover={{ scale: 1.15, zIndex: 5 }}
                        style={{ width: tw, height: th, opacity: dim ? 0.18 : 1, boxShadow: on ? `0 0 0 2px ${C.secondary}, 0 0 16px ${mix(C.secondary, 60)}` : undefined, zIndex: on ? 4 : 1 }}>
                        <HeroImg heroId={h.heroId} className="w-full h-full rounded-md" style={{ filter: has ? undefined : 'grayscale(0.8) brightness(0.6)' }} />
                        {has && <span className="absolute -right-1 -bottom-1"><Avatar player={k.p} size={Math.max(16, Math.round(th * 0.62))} ring={GOLD} /></span>}
                      </motion.button>
                    </Tip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected hero */}
        <div className="w-[380px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          <AnimatePresence mode="wait">
            {sel && (
              <motion.div key={sel.h.heroId} className="flex flex-col gap-3 flex-1 min-h-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="relative h-[200px] shrink-0 rounded-3xl overflow-hidden text-white" style={{ background: '#0b0b10' }}>
                  <HeroImg heroId={sel.h.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-50" />
                  <div className="absolute top-2 bottom-0 right-0 w-[55%]"><HeroRender heroId={sel.h.heroId} sizes="240px" /></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/30 to-transparent" />
                  <div className="relative h-full flex flex-col justify-end p-4 gap-1">
                    <div className="text-2xl font-logik-extended-bold uppercase leading-none" style={font}>{heroName(sel.h.heroId)}</div>
                    <div className="text-xs text-white/70">{sel.h.picks} gier · <span style={{ color: wrColor(sel.h.wr) }}>{Math.round(sel.h.wr * 100)}%</span> wygranych · {sel.h.bans} banów</div>
                    {crowned ? (
                      <div className="flex items-center gap-3 mt-2">
                        <Avatar player={king.p} size={56} ring={GOLD} />
                        <div><div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>Mistrz</div><div className="text-lg font-bold leading-tight">{king.p.name}</div><div className="text-xs text-white/70 tabular-nums">{king.avg.toFixed(2)} pkt · {king.wins}–{king.games - king.wins}</div></div>
                      </div>
                    ) : <div className="text-sm mt-2" style={{ color: GOLD }}>Tron wolny — wystarczą 2 dobre gry</div>}
                  </div>
                </div>
                {challenger && crowned && (
                  <Tip content="Tyle punktów występu średnio dzieli pretendenta od korony">
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2 cursor-help" style={{ background: ink(5) }}>
                      <span className="text-[10px] uppercase tracking-widest w-20" style={{ color: C.muted }}>Pretendent</span>
                      <Avatar player={challenger.p} size={36} /><span className="flex-1 font-bold truncate">{challenger.p.name}</span>
                      <span className="tabular-nums text-sm" style={{ color: C.muted }}>−{(king.avg - challenger.avg).toFixed(2)}</span>
                    </div>
                  </Tip>
                )}
                <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
                  {sel.m.slice(0, 7).map((x, i) => (
                    <div key={x.p.id} className="flex items-center gap-2.5 h-10 rounded-lg px-2" style={{ background: i === 0 && crowned ? mix(GOLD, 14) : ink(3) }}>
                      <span className="w-4 text-xs tabular-nums" style={{ color: C.muted }}>{i + 1}</span>
                      <Avatar player={x.p} size={30} />
                      <span className="flex-1 min-w-0 truncate text-sm font-bold">{x.p.name}</span>
                      <span className="text-xs tabular-nums" style={{ color: C.muted }}>{x.wins}–{x.games - x.wins}</span>
                      <span className="w-12 text-right text-sm font-bold tabular-nums" style={{ color: x.games >= MIN ? C.heading : C.muted }}>{x.avg >= 0 ? x.avg.toFixed(1) : '–'}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* crown table */}
          <div className="shrink-0">
            <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: C.muted }}>Najwięcej koron · kliknij, by podświetlić</div>
            <div className="flex gap-2">
              {crowns.slice(0, 6).map(c => (
                <Tip key={c.p.id} content={<TipBody title={c.p.name}>{c.heroes.map(heroName).join(', ')}</TipBody>}>
                  <button type="button" onClick={() => setOwner(o => (o === c.p.id ? null : c.p.id))} className="flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all"
                    style={{ background: owner === c.p.id ? mix(C.primary, 40) : ink(5), boxShadow: owner === c.p.id ? `0 0 0 2px ${C.secondary}` : undefined }}>
                    <Avatar player={c.p} size={44} ring={GOLD} />
                    <span className="text-sm font-bold tabular-nums" style={{ color: C.heading }}>{c.heroes.length}</span>
                  </button>
                </Tip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D51HeroMasters() {
  return <LabView><WithModel>{m => <Masters model={m} />}</WithModel></LabView>;
}
