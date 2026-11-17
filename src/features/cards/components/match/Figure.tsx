'use client';

// A card: in the hand, on the board, or in the ghost of a drag (same look everywhere). Hovering for
// 350 ms (or a long press) turns it over in 3D to show what it is and does; a rival card that is not
// turned over yet shows its back. Marks on top say what it can do or what happened to it.
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield, Swords, Wind } from 'lucide-react';
import type { GCard } from '@/lib/card-lab/cards';
import { mix, useHeaderFont } from '@/components/stats-lab/kit';
import type { CostMode } from '@/features/cards/domain/v2/rules';
import type { StrengthParts } from '@/features/cards/domain/v2/strength';
import type { Side } from '@/features/cards/domain/v2/types';
import { Back, Cover, Front } from './FigureFaces';
import type { Look } from './look';
import { ACC, ACC_L, AimIcon, T, sideColor } from './theme';

export interface FigureProps {
  card: GCard; side: Side; w: number; strength: number; parts?: StrengthParts; lost?: number;
  look?: Look; costMode: CostMode; note?: string;
  /** Hover (or a long press: `held`) turns it over; off while something is dragged */
  info?: boolean; held?: boolean;
  /** Which way it grows when it turns over */
  grow?: 'up' | 'down' | 'center';
  layoutId?: string; settle?: boolean; dataUid?: string; dataRef?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
}

const FLIP_DELAY = 350; const FLIP_SCALE = 1.55; const FLIP_W = 190;

function ring(side: Side, l: Look): string {
  if (l.picked) return `0 0 0 3px ${ACC_L}, 0 0 26px ${mix(ACC, 80)}`;
  if (l.lit === 'hit') return `0 0 0 3px ${T.hit}, 0 0 24px ${T.hit}aa`;
  if (l.lit === 'guard') return `0 0 0 3px ${T.guard}, 0 0 22px ${T.guard}99`;
  if (l.lit === 'room') return `0 0 0 3px ${T.warn}, 0 0 22px ${T.warn}99`;
  if (l.glow) return `0 0 0 2px ${ACC_L}, 0 0 18px ${mix(ACC, 55)}`;
  if (l.offer === 'smoke' || l.free === 'smoke') return `0 0 0 2px ${T.smoke}, 0 0 20px ${T.smoke}aa`;
  return `0 0 0 1.5px ${sideColor(side)}99, 0 10px 22px rgba(0,0,0,0.55)`;
}

export function Figure({ card, side, w, strength, parts, lost, look = {}, costMode, note, info, held, grow = 'center', layoutId, settle, dataUid, dataRef, onPointerDown }: FigureProps) {
  const font = useHeaderFont();
  const h = Math.round(w * 1.34);
  const k = w / 110;
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = () => { if (!info) return; timer.current = setTimeout(() => setHover(true), FLIP_DELAY); };
  const leave = () => { if (timer.current) clearTimeout(timer.current); setHover(false); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (!info) leave(); }, [info]);
  // Strength went up or down: a "+N" / "−N" rises from the card
  const prev = useRef(strength);
  const [bump, setBump] = useState<{ v: number; key: number } | null>(null);
  useEffect(() => {
    // A landed hit says its own "−N" (the mark below)
    if (strength !== prev.current && !look.faceDown && !look.struck) setBump({ v: strength - prev.current, key: Date.now() });
    prev.current = strength;
  }, [strength, look.faceDown, look.struck]);

  const reading = (hover || !!held) && !look.faceDown;
  const turned = reading || !!look.faceDown;
  const big = reading ? Math.max(FLIP_SCALE, FLIP_W / w) : 1;
  const origin = grow === 'up' ? '50% 100%' : grow === 'down' ? '50% 0%' : '50% 50%';
  const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' };
  const lean = look.lunge ? (side === 0 ? 34 : -34) : 0;
  return (
    <motion.div layoutId={layoutId} layout={!!layoutId} transition={{ type: 'spring', stiffness: 300, damping: 30 }} data-uid={dataUid} data-ref={dataRef}
      initial={settle ? { scale: 1.12, opacity: 1 } : side === 1 && look.faceDown ? { y: -70, opacity: 0, scale: 0.8 } : { opacity: 0, scale: 0.75 }}
      animate={{ opacity: look.ghost ? 0 : 1, scale: big, x: look.struck ? [lean, -12, 12, -7, 0] : lean, y: reading && grow === 'up' ? -46 : look.picked && !reading ? -8 : 0 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.3 } }}
      onMouseEnter={enter} onMouseLeave={leave}
      onPointerDown={(e) => { leave(); onPointerDown?.(e); }} className="relative shrink-0 touch-none select-none"
      style={{ width: w, height: h, cursor: onPointerDown ? 'grab' : 'default', zIndex: reading ? 80 : undefined, transformOrigin: origin, perspective: 900, filter: look.out ? 'grayscale(1) brightness(0.55)' : undefined }}>
      <motion.div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }} animate={{ rotateY: turned ? 180 : 0 }} transition={{ duration: 0.45, ease: [0.3, 1.1, 0.5, 1] }}>
        <div style={face}>
          <Front card={card} side={side} w={w} strength={strength} parts={parts} lost={lost} tired={look.tired} ring={ring(side, look)} roleColor={look.offer === 'smoke' ? T.smoke : undefined} />
        </div>
        <div style={{ ...face, transform: 'rotateY(180deg)' }}>
          {look.faceDown ? <Cover w={w} /> : reading ? <Back card={card} side={side} w={w} strength={strength} parts={parts} lost={lost} costMode={costMode} note={note} ring="" /> : null}
        </div>
      </motion.div>
      {!turned && <Marks look={look} k={k} side={side} />}
      <AnimatePresence>
        {bump && !turned && (
          <motion.span key={bump.key} className="absolute left-1/2 -translate-x-1/2 font-logik-extended-bold text-[24px] z-20 pointer-events-none whitespace-nowrap"
            style={{ top: -4, color: bump.v > 0 ? ACC_L : T.wound, textShadow: `0 0 12px ${bump.v > 0 ? ACC : '#000'}, 0 2px 4px #000`, ...font }}
            initial={{ y: 0, opacity: 0 }} animate={{ y: -36, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.5 }} onAnimationComplete={() => setBump(null)}>
            {bump.v > 0 ? '+' : '−'}{Math.abs(bump.v)}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** What the card can do or what happened to it, drawn over the front */
function Marks({ look, k, side }: { look: Look; k: number; side: Side }) {
  const font = useHeaderFont();
  const badge = (right: boolean, top: number, color: string, children: React.ReactNode, bg = 'rgba(0,0,0,0.78)') => (
    <span className="absolute z-10 rounded-full flex items-center justify-center pointer-events-none" style={{ [right ? 'right' : 'left']: 4 * k, top: top * k, width: 24 * k, height: 24 * k, background: bg, boxShadow: `0 0 0 1.5px ${color}` }}>{children}</span>
  );
  return (
    <>
      {look.planned && <span className="absolute pointer-events-none z-10" style={{ inset: -4, borderRadius: 14 * k, border: `2px dashed ${ACC_L}` }} />}
      {(look.offer === 'smoke' || look.free === 'smoke') && badge(true, 36, T.smoke, <Wind style={{ width: 14 * k, height: 14 * k, color: T.smoke }} />)}
      {look.tank && badge(true, 36, sideColor(side), <Shield style={{ width: 14 * k, height: 14 * k, color: sideColor(side) }} />, '#0b0c12')}
      {look.out && (
        <span className="absolute inset-x-0 z-10 flex items-center justify-center gap-1 font-logik-extended-bold uppercase pointer-events-none" style={{ top: '38%', fontSize: 12 * k, color: '#fff', background: 'rgba(0,0,0,0.7)', padding: `${3 * k}px 0`, ...font }}>
          <Swords style={{ width: 13 * k, height: 13 * k }} />Gank
        </span>
      )}
      {look.aimed && (
        <motion.span className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <AimIcon style={{ width: 54 * k, height: 54 * k, color: look.aimed === 'me' ? T.me : T.rival, filter: 'drop-shadow(0 0 8px #000)' }} strokeWidth={2.2} />
        </motion.span>
      )}
      <AnimatePresence>
        {look.shield && (
          <motion.span key={look.shield} className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            initial={{ scale: 0.4, opacity: 0 }} animate={look.shield === 'blocked' ? { scale: [1, 1.35, 1.6], opacity: [1, 1, 0] } : { scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }} transition={look.shield === 'blocked' ? { duration: 0.9, times: [0, 0.4, 1] } : { type: 'spring', stiffness: 300, damping: 18 }}>
            <Shield style={{ width: 62 * k, height: 62 * k, color: T.guard, fill: `${T.guard}55`, filter: `drop-shadow(0 0 12px ${T.guard})` }} strokeWidth={2} />
          </motion.span>
        )}
      </AnimatePresence>
      {look.struck != null && look.struck > 0 && (
        <>
          <motion.div className="absolute inset-0 z-20 pointer-events-none" style={{ borderRadius: 14 * k, background: 'rgba(255,60,40,0.6)' }} initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ duration: 0.5 }} />
          <motion.span className="absolute left-1/2 -translate-x-1/2 z-30 font-logik-extended-bold pointer-events-none" style={{ top: '30%', fontSize: 40 * k, color: '#ff6b5b', textShadow: '0 0 12px #000, 0 2px 4px #000', ...font }}
            initial={{ scale: 0.3, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25 }}>−{look.struck}</motion.span>
        </>
      )}
    </>
  );
}
