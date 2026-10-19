'use client';

// #86 — Loading screen. Any game of the season shown like the Dota loading screen: ten tall cards,
// Radiant on the left and Dire on the right — hero, player, their rank medal and what they averaged
// this season. Press "Wynik" to reveal how it ended: the winning side lights up and every card
// gets its K/D/A and performance points, the MVP a crown. Browse games with the arrows.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameX, Model, Perf } from '@/lib/stats-lab/derive';
import { pctRank } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { fmtDay, qualified } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';
import { MEDALS, Medal, medalOfPct } from '../medal';

const GOLD = '#f2c94c';

function Card({ p, w, h, reveal, won, mvp, medal, i }: { p: Perf; w: number; h: number; reveal: boolean; won: boolean; mvp: boolean; medal: { medal: number; stars: number } | null; i: number }) {
  const font = useHeaderFont();
  const side = p.radiant ? C.radiant : C.dire;
  return (
    <motion.div className="relative rounded-xl overflow-hidden text-white shrink-0" style={{ width: w, height: h, background: `linear-gradient(180deg, ${mix(side, 30)}, #0b0b10 55%)`, boxShadow: reveal && won ? `0 0 0 2px ${GOLD}, 0 0 26px ${mix(GOLD, 45)}` : '0 0 0 1px rgba(255,255,255,0.12)' }}
      initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: reveal && !won ? 0.55 : 1 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 180, damping: 20 }}>
      <HeroImg heroId={p.heroId} title={false} className="absolute inset-0 w-full h-full scale-150 blur-xl opacity-35" />
      <div className="absolute -inset-x-[45%] top-[2%] bottom-[38%]"><HeroRender heroId={p.heroId} sizes="260px" /></div>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 25%, transparent 60%)' }} />
      {reveal && mvp && <motion.div className="absolute top-2 inset-x-0 flex justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }}><span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest text-black" style={{ background: GOLD }}>MVP</span></motion.div>}
      <div className="absolute inset-x-0 bottom-0 p-2 flex flex-col items-center gap-1 text-center">
        <div className="text-[11px] uppercase tracking-wider text-white/75 truncate max-w-full">{heroName(p.heroId)}</div>
        <div className="flex items-center gap-1.5 max-w-full"><Avatar player={p.player} size={26} /><span className="text-sm font-bold truncate" style={font}>{p.player?.name ?? 'anonim'}</span></div>
        {medal ? <Tip content={<TipBody title={`${MEDALS[medal.medal].name} ${medal.stars}`}>ranga ze średnich punktów występu w sezonie</TipBody>}><span><Medal medal={medal.medal} stars={medal.stars} size={Math.min(54, w * 0.45)} /></span></Tip> : <span className="text-[10px] text-white/50 h-[40px] flex items-center">bez rangi</span>}
        <AnimatePresence mode="wait">
          {reveal ? (
            <motion.div key="r" className="leading-tight" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-lg font-bold tabular-nums">{p.kills}/{p.deaths}/{p.assists}</div>
              <div className="text-[11px] tabular-nums" style={{ color: GOLD }}>{Number.isFinite(p.score) ? `${p.score.toFixed(1)} pkt` : '–'}</div>
            </motion.div>
          ) : (
            <motion.div key="s" className="leading-tight" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-sm font-bold tabular-nums">{p.player?.agg.score.avg != null ? p.player.agg.score.avg.toFixed(1) : '–'}</div>
              <div className="text-[10px] text-white/60">śr. pkt w sezonie</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Loading({ model }: { model: Model }) {
  const font = useHeaderFont();
  const games = useMemo(() => [...model.games].filter(g => g.perfs.length >= 10).sort((a, b) => b.start - a.start), [model]);
  const medals = useMemo(() => {
    const q = qualified(model); const pool = q.map(p => p.agg.score.avg!);
    return new Map(q.map(p => [p.id, medalOfPct(pctRank(pool, p.agg.score.avg!))]));
  }, [model]);
  const [gi, setGi] = useState(0);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { setReveal(false); }, [gi]);
  const g: GameX | undefined = games[gi];
  const [ref, box] = useSize<HTMLDivElement>();
  const gap = 8; const mid = 90;
  const w = Math.max(80, (box.w - mid - gap * 8) / 10);
  const h = Math.min(box.h, w * 3.4);
  if (!g) return <LabTitle>Ekran ładowania</LabTitle>;
  const rad = g.perfs.filter(p => p.radiant); const dire = g.perfs.filter(p => !p.radiant);

  return (
    <>
      <LabTitle sub={<span>{fmtDay(g.start)} · gra {games.length - gi} z {games.length}</span>}
        right={
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Wcześniejsza gra" disabled={gi >= games.length - 1} onClick={() => setGi(gi + 1)} className="w-11 h-11 rounded-full text-2xl disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
            <button type="button" onClick={() => setGi(Math.floor(Math.random() * games.length))} className="rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), border: `1px solid ${ink(14)}`, color: C.text }}>Losowa gra</button>
            <button type="button" aria-label="Późniejsza gra" disabled={gi === 0} onClick={() => setGi(gi - 1)} className="w-11 h-11 rounded-full text-2xl disabled:opacity-25" style={{ background: ink(8) }}>›</button>
          </div>
        }>Ekran ładowania</LabTitle>
      <div className="shrink-0 flex items-center justify-between mt-2">
        <div className="flex items-center gap-2"><TeamLogo team={g.radiantTeam} size={34} /><span className="text-lg font-bold" style={{ color: C.radiant }}>{g.radiantTeam?.name}</span>{reveal && g.radiantWin && <span className="text-xs font-bold px-2 py-0.5 rounded text-black" style={{ background: GOLD }}>ZWYCIĘZCA</span>}</div>
        <div className="flex items-center gap-2">{reveal && !g.radiantWin && <span className="text-xs font-bold px-2 py-0.5 rounded text-black" style={{ background: GOLD }}>ZWYCIĘZCA</span>}<span className="text-lg font-bold" style={{ color: C.dire }}>{g.direTeam?.name}</span><TeamLogo team={g.direTeam} size={34} /></div>
      </div>
      <div ref={ref} className="flex-1 min-h-0 mt-2 flex items-center justify-center" style={{ gap }}>
        {box.w > 0 && (
          <AnimatePresence mode="wait">
            <motion.div key={g.id} className="flex items-center" style={{ gap }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {rad.map((p, i) => <Card key={p.idx} p={p} w={w} h={h} i={i} reveal={reveal} won={g.radiantWin} mvp={g.mvp === p} medal={p.player ? medals.get(p.player.id) ?? null : null} />)}
              <div className="flex flex-col items-center justify-center gap-3" style={{ width: mid }}>
                <span className="text-3xl font-logik-extended-bold" style={{ color: C.heading, ...font }}>VS</span>
                {reveal ? (
                  <div className="text-center leading-tight"><div className="text-xl font-bold tabular-nums"><span style={{ color: C.radiant }}>{g.radiantKills}</span>:<span style={{ color: C.dire }}>{g.direKills}</span></div><div className="text-xs" style={{ color: C.muted }}>{fmtClock(g.duration)}</div></div>
                ) : (
                  <motion.button type="button" onClick={() => setReveal(true)} className="rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 50)}` }} whileHover={{ scale: 1.06 }}>Wynik</motion.button>
                )}
              </div>
              {dire.map((p, i) => <Card key={p.idx} p={p} w={w} h={h} i={i + 5} reveal={reveal} won={!g.radiantWin} mvp={g.mvp === p} medal={p.player ? medals.get(p.player.id) ?? null : null} />)}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </>
  );
}

export default function D86Loading() {
  return <LabView><WithModel>{m => <Loading model={m} />}</WithModel></LabView>;
}
