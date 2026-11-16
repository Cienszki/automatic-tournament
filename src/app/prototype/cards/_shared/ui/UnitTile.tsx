'use client';

// A figure: a unit on the board or a card in the hand, the same look at every size (the look of
// today's game: hero art, the strength in a drop-shaped badge, the side's colour). Below 80 px it
// drops the name and the avatar: numbers before pictures, detail on a long press.
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, Mountain, Shield, Sprout, Star, Sun, Swords, Users } from 'lucide-react';
import { Avatar, HeroImg, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { useFitText } from '@/components/teams-section/fit';
import { KEYWORD } from '@/lib/card-lab/outposts';
import type { UnitModel } from '../state/scene';
import { ACC, ACC_L, ROLE_ICON, T, sideColor, teamColor } from './theme';

export interface TileLook {
  /** Can still be given an order */
  glow?: boolean;
  picked?: boolean;
  /** May be hit, may be guarded, may make room for a card */
  lit?: 'hit' | 'guard' | 'room';
  dim?: boolean;
  /** Chosen as the target of the hit */
  aimed?: boolean;
  shield?: 'on' | 'blocked';
  /** Strength a hit just took */
  struck?: number;
  farmed?: boolean;
}

/** Counts the changes of a value after the first render, as a key for a one-shot animation */
function useChanges(value: number): number {
  const [n, setN] = useState(0);
  const prev = useRef(value);
  useEffect(() => { if (prev.current !== value) { prev.current = value; setN((x) => x + 1); } }, [value]);
  return n;
}

function Name({ text, size }: { text: string; size: number }) {
  const ref = useFitText<HTMLDivElement>(text, size, 9);
  return <div ref={ref} className="whitespace-nowrap overflow-hidden font-bold leading-tight">{text}</div>;
}

const RING: Record<NonNullable<TileLook['lit']>, string> = { hit: T.hit, guard: T.guard, room: T.hit };

export function UnitTile({ m, w, look = {}, dataRef, layoutId }: { m: UnitModel; w: number; look?: TileLook; dataRef?: string; layoutId?: string }) {
  const font = useHeaderFont();
  const h = Math.round(w * 1.42);
  const big = w >= 80;
  const k = w / 100;
  const badge = Math.max(26, Math.round(w * 0.34));
  const color = sideColor(m.side);
  const bumps = useChanges(m.strength);
  const Role = ROLE_ICON[m.card.role];
  const ring = look.picked ? ACC_L : look.aimed ? T.hit : look.lit ? RING[look.lit] : look.glow ? ACC_L : null;
  const chips = [
    { key: 'farm', v: m.parts.growth, Icon: Sprout, color: T.me },
    { key: 'aura', v: m.parts.aura, Icon: Sun, color: T.aura },
    { key: 'team', v: m.parts.team, Icon: Users, color: m.card.team ? teamColor(m.card.team.id) : T.text },
    { key: 'hg', v: m.parts.highGround, Icon: Mountain, color: T.hg },
  ].filter((c) => c.v > 0 && !m.faceDown);
  const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: Math.max(7, 11 * k), overflow: 'hidden' };
  return (
    <motion.div layoutId={layoutId} layout={layoutId ? 'position' : false} data-ref={dataRef} data-uid={m.uid}
      className="relative shrink-0 touch-none select-none" style={{ width: w, height: h, perspective: 600, zIndex: look.picked ? 30 : look.struck || look.aimed ? 20 : undefined }}
      initial={false} animate={{ y: look.picked ? -Math.max(6, 10 * k) : 0, rotate: m.out ? -9 : 0, scale: look.lit === 'hit' || look.aimed ? 1.05 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}>
      <motion.div className="absolute inset-0" style={{ transformStyle: 'preserve-3d', animation: look.struck !== undefined ? 'proto-shake 0.4s ease-out' : undefined }} initial={false} animate={{ rotateY: m.faceDown ? 180 : 0 }} transition={{ duration: 0.4, ease: [0.3, 1.1, 0.5, 1] }}>
        <div style={{
          ...face,
          background: `radial-gradient(120% 80% at 50% 100%, ${color}38, transparent 60%), linear-gradient(180deg, #1c1f29, #0a0b0f)`,
          boxShadow: ring ? `0 0 0 ${look.picked || look.aimed ? 3 : 2}px ${ring}, 0 0 ${look.picked ? 26 : 16}px ${look.picked || look.glow ? mix(ACC, 70) : `${ring}99`}` : `0 0 0 1.5px ${m.card.totw ? T.totw : `${color}99`}, 0 6px 14px rgba(0,0,0,0.55)`,
          filter: m.out ? 'grayscale(1) brightness(0.55)' : look.dim ? 'saturate(0.3) brightness(0.48)' : undefined, transition: 'box-shadow .2s, filter .25s',
        }}>
          <HeroImg heroId={m.card.heroId} title={false} className="absolute inset-0 w-full h-full" style={{ objectPosition: '50% 20%' }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(0deg, rgba(5,6,9,0.96) ${big ? 16 : 6}%, transparent ${big ? 60 : 46}%), linear-gradient(180deg, rgba(5,6,9,0.5), transparent 30%)` }} />
          {big && <span className="absolute" style={{ right: 6 * k, top: 6 * k }}><Avatar player={m.card.player} size={Math.round(26 * k)} ring="rgba(0,0,0,0.6)" /></span>}
          {big ? (
            <div className="absolute" style={{ left: 7 * k, right: 7 * k, bottom: 6 * k, color: T.text }}>
              <Name text={m.card.name} size={Math.max(11, 13 * k)} />
              <div className="flex items-center gap-1 font-bold uppercase tracking-wider whitespace-nowrap" style={{ fontSize: Math.max(9.5, 10 * k), color: ACC_L }}>
                <Role style={{ width: 12 * k + 1, height: 12 * k + 1 }} />{KEYWORD[m.card.role].name}
                {m.card.team && <span className="ml-auto rounded-full" style={{ width: 8, height: 8, background: teamColor(m.card.team.id) }} />}
              </div>
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between" style={{ padding: '0 4px 3px' }}>
              <Role style={{ width: 14, height: 14, color: T.text }} />
              {m.card.team && <span className="rounded-full" style={{ width: 8, height: 8, background: teamColor(m.card.team.id), boxShadow: '0 0 0 1.5px rgba(0,0,0,0.6)' }} />}
            </div>
          )}
          {m.out && <Swords className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: w * 0.42, height: w * 0.42, color: '#fff', opacity: 0.85 }} />}
          {look.struck !== undefined && <motion.div className="absolute inset-0" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ background: 'rgba(255,60,40,0.65)' }} />}
        </div>
        <div style={{ ...face, transform: 'rotateY(180deg)', background: `repeating-linear-gradient(45deg, ${mix(ACC, 45)} 0 ${8 * k + 3}px, ${mix(ACC, 26)} ${8 * k + 3}px ${16 * k + 6}px), #15151c`, boxShadow: `0 0 0 1.5px ${T.rival}99, 0 6px 14px rgba(0,0,0,0.5)` }} />
      </motion.div>
      {(look.glow || look.lit) && !look.picked && <span className="absolute pointer-events-none" style={{ inset: -3, borderRadius: Math.max(9, 13 * k), boxShadow: `0 0 0 1.5px ${ring}, 0 0 14px ${ring}`, animation: 'proto-pulse 1.5s ease-in-out infinite' }} />}
      {m.planned && <span className="absolute pointer-events-none" style={{ inset: -4, borderRadius: Math.max(10, 14 * k), border: `2px dashed ${ACC_L}` }} />}
      {!m.faceDown && (
        <motion.span key={bumps} className="absolute flex items-center justify-center font-logik-extended-bold leading-none tabular-nums"
          initial={bumps ? { scale: 1.7 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          style={{ left: -3, top: -3, width: badge, height: badge, fontSize: Math.round(badge * 0.64), borderRadius: '50% 50% 50% 12%', background: color, color: m.lost ? '#7a0c05' : '#07080b', boxShadow: m.lost ? '0 0 0 2px #ff3b2f, 0 0 10px #ff3b2f' : '0 2px 8px rgba(0,0,0,0.6)', ...font }}>{m.strength}</motion.span>
      )}
      {m.card.totw && !m.faceDown && <Star className="absolute" style={{ left: badge - 6, top: -4, width: 12, height: 12, color: T.totw, fill: T.totw, filter: 'drop-shadow(0 0 3px #000)' }} />}
      <div className="absolute flex flex-col items-end gap-px pointer-events-none" style={{ right: -3, top: big ? 36 * k : 1 }}>
        <AnimatePresence initial={false}>
          {chips.map((c) => (
            <motion.span key={c.key} className="flex items-center rounded-full font-bold leading-none tabular-nums" initial={{ scale: 0, x: 8 }} animate={{ scale: 1, x: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}
              style={{ fontSize: big ? 11 : 10, padding: '1.5px 4px 1.5px 3px', gap: 1, background: 'rgba(5,6,9,0.86)', color: c.color, boxShadow: `0 0 0 1px ${c.color}66` }}>
              <c.Icon style={{ width: big ? 10 : 9, height: big ? 10 : 9 }} />+{c.v}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      {look.aimed && <Crosshair className="absolute left-1/2 top-1/2 pointer-events-none" style={{ width: w * 0.7, height: w * 0.7, marginLeft: -w * 0.35, marginTop: -w * 0.35, color: T.hit, filter: 'drop-shadow(0 0 6px #000)', animation: 'proto-spin 6s linear infinite' }} />}
      <AnimatePresence>
        {look.shield && (
          <motion.span key="shield" className="absolute left-1/2 pointer-events-none flex items-center justify-center" style={{ bottom: -6, width: w * 0.62, height: w * 0.62, marginLeft: -w * 0.31 }}
            initial={{ scale: 0, y: 10 }} animate={{ scale: look.shield === 'blocked' ? [1, 1.7, 1.15] : 1, y: 0 }} exit={{ scale: 0, opacity: 0 }} transition={look.shield === 'blocked' ? { duration: 0.45, times: [0, 0.35, 1], ease: 'easeOut' } : { type: 'spring', stiffness: 380, damping: 18 }}>
            {look.shield === 'blocked' && <motion.span className="absolute rounded-full" style={{ inset: '-30%', boxShadow: `0 0 0 3px #fff, 0 0 18px ${T.guard}` }} initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} />}
            <Shield style={{ width: '100%', height: '100%', color: '#fff', fill: look.shield === 'blocked' ? '#fff' : T.guard, filter: `drop-shadow(0 0 ${look.shield === 'blocked' ? 14 : 7}px ${T.guard}) drop-shadow(0 2px 3px #000)` }} strokeWidth={1.6} />
          </motion.span>
        )}
        {look.struck !== undefined && (
          <span key="struck" className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '30%' }}>
            <motion.span className="font-logik-extended-bold whitespace-nowrap leading-none" style={{ fontSize: Math.max(26, w * 0.4), color: '#ff5a48', textShadow: '0 0 10px #000, 0 0 3px #000, 0 2px 4px #000', ...font }}
              initial={{ scale: 0.3, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>−{look.struck}</motion.span>
          </span>
        )}
        {look.farmed && (
          <span key="farm" className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ bottom: '24%' }}>
            <motion.span className="font-logik-extended-bold leading-none" style={{ fontSize: Math.max(20, w * 0.3), color: T.me, textShadow: `0 0 10px ${T.me}, 0 0 3px #000, 0 2px 4px #000`, ...font }}
              initial={{ y: 12, opacity: 0, scale: 0.5 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 16 }}>+1</motion.span>
          </span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
