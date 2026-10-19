'use client';

// #69 — Herodex. A Pokédex for the season's heroes: the entry number is the hero's id, the
// screen shows the full-body render, the right panel its "base stats" as bars (pick rate, ban rate,
// win rate, K/D/A, farm), its trainers (who played it best), what it beats and what beats it, and
// its best partner. Browse with the d-pad, ← → or the strip of icons.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HeroX, Model } from '@/lib/stats-lab/derive';
import { ATTR_COLOR, heroAttr, heroName } from '@/lib/stats-lab/heroes';
import { avgScore } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, Tip, TipBody, WithModel, useHeaderFont, useSize, wrColor } from '../kit';

const RED = '#c8102e';
const ATTR_NAME = { str: 'Siła', agi: 'Zręczność', int: 'Inteligencja', all: 'Uniwersalny' } as const;
type Rec = { n: number; w: number };

function useMatchups(model: Model) {
  return useMemo(() => {
    const vs = new Map<string, Rec>(); const tog = new Map<string, Rec>();
    const add = (m: Map<string, Rec>, k: string, win: boolean) => { const r = m.get(k) ?? { n: 0, w: 0 }; r.n++; if (win) r.w++; m.set(k, r); };
    for (const g of model.games) {
      const r = g.perfs.filter(p => p.radiant).map(p => p.heroId); const d = g.perfs.filter(p => !p.radiant).map(p => p.heroId);
      for (const a of r) for (const b of d) { add(vs, `${a}|${b}`, g.radiantWin); add(vs, `${b}|${a}`, !g.radiantWin); }
      for (const [side, win] of [[r, g.radiantWin], [d, !g.radiantWin]] as const) for (const a of side) for (const b of side) if (a !== b) add(tog, `${a}|${b}`, win);
    }
    return { vs, tog };
  }, [model]);
}

function Bar({ label, value, max, text, tip, color }: { label: string; value: number; max: number; text: string; tip: string; color: string }) {
  return (
    <Tip content={tip}>
      <div className="flex items-center gap-3 cursor-help">
        <span className="w-24 text-xs uppercase tracking-wider shrink-0" style={{ color: '#4a4a4a' }}>{label}</span>
        <span className="w-14 text-right text-sm font-bold tabular-nums" style={{ color: '#111' }}>{text}</span>
        <span className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: '#d9d9d9' }}>
          <motion.span className="block h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.max(3, Math.min(100, (value / max) * 100))}%` }} transition={{ duration: 0.6 }} />
        </span>
      </div>
    </Tip>
  );
}

function Herodex({ model }: { model: Model }) {
  const font = useHeaderFont();
  const heroes = useMemo(() => model.heroes.filter(h => h.picks + h.bans > 0).sort((a, b) => a.heroId - b.heroId), [model]);
  const mu = useMatchups(model);
  const [i, setI] = useState(() => Math.max(0, heroes.findIndex(h => h === model.heroes[0])));
  const go = (d: number) => setI(x => (x + d + heroes.length) % heroes.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const h: HeroX = heroes[i];
  const attr = heroAttr(h.heroId);
  const maxPick = Math.max(...heroes.map(x => x.pickRate)); const maxBan = Math.max(...heroes.map(x => x.banRate));
  const maxK = Math.max(...heroes.map(x => x.avgK)); const maxA = Math.max(...heroes.map(x => x.avgA)); const maxG = Math.max(...heroes.map(x => x.avgGpm));
  const trainers = h.players.filter(u => u.games >= 1).map(u => ({ ...u, avg: avgScore(h.perfs.filter(p => p.pid === u.player.id)) ?? 0 })).sort((a, b) => b.games - a.games || b.avg - a.avg).slice(0, 4);
  const matchups = heroes.filter(o => o !== h).map(o => ({ o, r: mu.vs.get(`${h.heroId}|${o.heroId}`) })).filter(x => x.r && x.r.n >= 2) as Array<{ o: HeroX; r: Rec }>;
  const strong = [...matchups].sort((a, b) => (b.r.w + 1) / (b.r.n + 2) - (a.r.w + 1) / (a.r.n + 2)).slice(0, 3);
  const weak = [...matchups].sort((a, b) => (a.r.w + 1) / (a.r.n + 2) - (b.r.w + 1) / (b.r.n + 2)).slice(0, 3);
  const partner = heroes.filter(o => o !== h).map(o => ({ o, r: mu.tog.get(`${h.heroId}|${o.heroId}`) })).filter(x => x.r && x.r.n >= 2).sort((a, b) => (b.r!.w + 1) / (b.r!.n + 2) - (a.r!.w + 1) / (a.r!.n + 2))[0];
  const [stripRef, strip] = useSize<HTMLDivElement>();
  const per = Math.max(5, Math.floor(strip.w / 50));
  const start = Math.max(0, Math.min(heroes.length - per, i - Math.floor(per / 2)));

  const chip = (o: HeroX, r: Rec, good: boolean) => (
    <Tip key={o.heroId} content={<TipBody title={`${heroName(h.heroId)} vs ${heroName(o.heroId)}`}>{r.w}–{r.n - r.w} w {r.n} grach</TipBody>}>
      <button type="button" onClick={() => setI(heroes.indexOf(o))} className="flex flex-col items-center gap-0.5">
        <HeroImg heroId={o.heroId} className="rounded-md" style={{ width: 58, height: 33, boxShadow: `0 0 0 2px ${good ? C.win : C.loss}` }} />
        <span className="text-[10px] font-bold tabular-nums" style={{ color: '#333' }}>{r.w}–{r.n - r.w}</span>
      </button>
    </Tip>
  );

  return (
    <>
      <LabTitle sub={<span>{heroes.length} bohaterów w tym sezonie · ← → lub krzyżak, by przewijać</span>}>Herodex</LabTitle>
      <div className="flex-1 min-h-0 mt-3 rounded-[28px] p-4 flex gap-4" style={{ background: `linear-gradient(160deg, #e0233f, ${RED} 40%, #8f0b20)`, boxShadow: '0 30px 70px rgba(0,0,0,0.5), inset 0 -6px 0 rgba(0,0,0,0.25)' }}>
        {/* left half: screen */}
        <div className="w-[44%] shrink-0 flex flex-col gap-3 min-h-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-11 h-11 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #bff3ff, #1e9bd7 60%, #0b5a85)', boxShadow: '0 0 0 4px #fff' }} />
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="relative flex-1 min-h-0 rounded-2xl p-3" style={{ background: '#dedede', boxShadow: 'inset 0 0 0 3px #b5b5b5' }}>
            <div className="relative h-full rounded-lg overflow-hidden" style={{ background: `radial-gradient(circle at 50% 70%, ${ATTR_COLOR[attr]}55, #0b0b10 70%)` }}>
              <AnimatePresence mode="wait">
                <motion.div key={h.heroId} className="absolute inset-x-0 top-[8%] bottom-[18%]" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <HeroRender heroId={h.heroId} sizes="420px" />
                </motion.div>
              </AnimatePresence>
              <div className="absolute top-2 left-3 text-white/80 font-mono text-sm">#{String(h.heroId).padStart(3, '0')}</div>
              <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                <div className="text-3xl font-logik-extended-bold uppercase text-white leading-none" style={font}>{heroName(h.heroId)}</div>
                <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-white" style={{ background: ATTR_COLOR[attr] }}>{ATTR_NAME[attr]}</span>
              </div>
            </div>
          </div>
          {/* d-pad + strip */}
          <div className="shrink-0 flex items-center gap-3">
            <div className="grid grid-cols-3 grid-rows-3 w-[84px] h-[84px] shrink-0">
              <span /><span className="bg-[#222] rounded-t-md" /><span />
              <button type="button" aria-label="Poprzedni" onClick={() => go(-1)} className="bg-[#222] rounded-l-md text-white text-lg active:bg-black">‹</button>
              <span className="bg-[#222]" />
              <button type="button" aria-label="Następny" onClick={() => go(1)} className="bg-[#222] rounded-r-md text-white text-lg active:bg-black">›</button>
              <span /><span className="bg-[#222] rounded-b-md" /><span />
            </div>
            <div ref={stripRef} className="flex-1 min-w-0 flex gap-1.5 justify-center">
              {heroes.slice(start, start + per).map(x => (
                <button key={x.heroId} type="button" onClick={() => setI(heroes.indexOf(x))} className="rounded-md overflow-hidden shrink-0" style={{ boxShadow: x === h ? '0 0 0 3px #fff' : undefined, opacity: x === h ? 1 : 0.75 }}>
                  <HeroImg heroId={x.heroId} variant="icon" style={{ width: 42, height: 42 }} className="bg-black/40" />
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* right half: data */}
        <div className="flex-1 min-w-0 rounded-2xl p-4 flex flex-col gap-3 min-h-0" style={{ background: '#f2f2f2', color: '#111' }}>
          <div className="flex flex-col gap-1.5">
            <Bar label="Pick" value={h.pickRate} max={maxPick} text={`${Math.round(h.pickRate * 100)}%`} tip={`Wybrany w ${h.picks} z ${model.games.length} gier`} color="#3d8bfd" />
            <Bar label="Ban" value={h.banRate} max={maxBan || 1} text={`${Math.round(h.banRate * 100)}%`} tip={`Zbanowany ${h.bans} razy`} color="#7b5cd6" />
            <Bar label="Wygrane" value={h.wr} max={1} text={h.picks ? `${Math.round(h.wr * 100)}%` : '–'} tip={`${h.wins}–${h.picks - h.wins}`} color={wrColor(h.wr)} />
            <Bar label="Zabójstwa" value={h.avgK} max={maxK} text={h.avgK.toFixed(1)} tip="Średnio na grę" color="#e8505b" />
            <Bar label="Asysty" value={h.avgA} max={maxA} text={h.avgA.toFixed(1)} tip="Średnio na grę" color="#f9a826" />
            <Bar label="GPM" value={h.avgGpm} max={maxG} text={Math.round(h.avgGpm).toString()} tip="Średnie złoto na minutę" color="#d9b44a" />
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: '#666' }}>Trenerzy</div>
              <div className="flex flex-col gap-1.5">
                {trainers.map(t => (
                  <div key={t.player.id} className="flex items-center gap-2">
                    <Avatar player={t.player} size={34} />
                    <span className="flex-1 min-w-0 truncate text-sm font-bold">{t.player.name}</span>
                    <span className="text-xs tabular-nums" style={{ color: '#555' }}>{t.wins}–{t.games - t.wins}</span>
                  </div>
                ))}
                {!trainers.length && <span className="text-sm" style={{ color: '#666' }}>Tylko bany — nikt nim nie zagrał.</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div><div className="text-[10px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666' }}>Mocny przeciwko</div><div className="flex gap-1.5">{strong.length ? strong.map(x => chip(x.o, x.r, true)) : <span className="text-xs" style={{ color: '#888' }}>za mało gier</span>}</div></div>
              <div><div className="text-[10px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666' }}>Słaby przeciwko</div><div className="flex gap-1.5">{weak.length ? weak.map(x => chip(x.o, x.r, false)) : <span className="text-xs" style={{ color: '#888' }}>za mało gier</span>}</div></div>
              {partner?.r && (
                <Tip content={`Razem w jednej drużynie: ${partner.r.w}–${partner.r.n - partner.r.w}`}>
                  <div className="flex items-center gap-2 cursor-help"><span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#666' }}>Najlepszy partner</span><HeroImg heroId={partner.o.heroId} className="rounded-md" style={{ width: 58, height: 33 }} /><span className="text-sm font-bold">{heroName(partner.o.heroId)}</span></div>
                </Tip>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D69Herodex() {
  return <LabView><WithModel>{m => <Herodex model={m} />}</WithModel></LabView>;
}
