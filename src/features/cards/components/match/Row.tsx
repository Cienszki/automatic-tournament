'use client';

// One objective as a band across the board: the player's units on the left (toward their Ancient),
// the rival's on the right, and between them the objective's model, name, damage, rule and the
// two totals. The whole band is a drop target and a tap target.
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHeaderFont } from '@/components/stats-lab/kit';
import type { Side, Slot } from '@/features/cards/domain/v2/types';
import type { TargetInfo } from '@/features/cards/state/plan';
import type { ObjectiveModel, UnitModel } from '@/features/cards/state/scene';
import { Arena, AuraFx, EffectChips, HgFx, SmokeFx, type Effect } from './Arena';
import { CountUp, Pill } from './bits';
import { OBJECTIVE, T, objModel, sideColor } from './theme';

export interface RowFx { aura: [boolean, boolean]; smoke: boolean; hg: Side | null; effects: [Effect[], Effect[]] }

export interface RowProps {
  slot: Slot; o: ObjectiveModel; units: UnitModel[]; capacity: number; w: number; h: number;
  draw: (u: UnitModel) => React.ReactNode;
  target: TargetInfo | null;
  /** Who took the objective this round, while the reveal shows it */
  verdict?: Side | null;
  fx: RowFx;
  onTap: () => void;
}

export const CENTER_W = 330;

function Slots({ n, w, side }: { n: number; w: number; side: Side }) {
  return <>{Array.from({ length: Math.max(0, n) }, (_, k) => <div key={k} className="shrink-0 rounded-[12px]" style={{ width: w, height: Math.round(w * 1.34), border: `1.5px dashed rgba(255,255,255,${side === 0 ? 0.26 : 0.16})` }} />)}</>;
}

function Total({ v, side, verdict }: { v: number | null; side: Side; verdict?: Side | null }) {
  const font = useHeaderFont();
  const won = verdict === side; const lost = verdict !== undefined && verdict !== side;
  return (
    <motion.span className="w-[62px] h-[62px] shrink-0 rounded-full flex items-center justify-center font-logik-extended-bold text-[28px] tabular-nums"
      animate={{ scale: won ? 1.22 : lost ? 0.86 : 1, opacity: v === null ? 0 : lost ? 0.5 : 1 }} transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      style={{ background: '#0b0c12', color: sideColor(side), boxShadow: `0 0 0 2.5px ${sideColor(side)}${won ? '' : '99'}${won ? `, 0 0 26px ${sideColor(side)}` : ''}`, ...font }}>
      {v === null ? '' : <CountUp value={v} />}
    </motion.span>
  );
}

export function Row({ slot, o, units, capacity, w, h, draw, target, verdict, fx, onTap }: RowProps) {
  const font = useHeaderFont();
  const def = OBJECTIVE[o.id];
  const side = (s: Side) => units.filter((u) => u.side === s);
  const mine = side(0); const theirs = side(1);
  const holder = verdict !== undefined ? verdict : o.holder;
  const off = target?.kind === 'off';
  const go = target?.kind === 'ok' || target?.kind === 'replace';
  return (
    <div data-drop={slot} data-obj={slot} onClick={(e) => { e.stopPropagation(); onTap(); }} className="relative flex items-stretch"
      style={{ height: h, filter: off ? 'grayscale(1) brightness(0.45)' : undefined, transition: 'filter .2s', cursor: go ? 'pointer' : undefined }}>
      <Arena id={o.id} />
      {/* Who holds it: a glow on that side's half */}
      <AnimatePresence>
        {holder != null && (
          <motion.div key={holder} className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: `radial-gradient(45% 90% at ${holder === 0 ? 25 : 75}% 50%, ${sideColor(holder)}2e, transparent 75%)` }} />
        )}
      </AnimatePresence>
      {go && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${target!.kind === 'replace' ? T.warn : T.me}99`, background: `${target!.kind === 'replace' ? T.warn : T.me}12` }} />}

      <div className="relative flex-1 min-w-0 flex flex-row-reverse items-center gap-3 pr-5">
        {fx.aura[0] && <AuraFx />}
        {fx.smoke && <SmokeFx />}
        {fx.hg === 0 && mine.length > 0 && <HgFx height={h} />}
        <EffectChips items={fx.effects[0]} align="left" />
        <AnimatePresence>{mine.map(draw)}</AnimatePresence>
        <Slots n={capacity - mine.length} w={w} side={0} />
      </div>

      <div className="relative shrink-0 flex flex-col items-center justify-center pointer-events-none" style={{ width: CENTER_W }}>
        <div className="flex items-baseline gap-3">
          <span className="font-logik-extended-bold uppercase text-[21px] leading-none whitespace-nowrap" style={{ color: holder == null ? T.text : sideColor(holder), textShadow: '0 2px 10px #000', ...font }}>{def.name}</span>
          <span className="font-logik-extended-bold text-[17px] leading-none" style={{ color: T.pts, textShadow: '0 2px 8px #000', ...font }}>−{o.damage}</span>
        </div>
        <div className="flex items-center gap-2 my-1.5">
          <Total v={o.totals[0]} side={0} verdict={verdict} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={objModel(o.id)} alt="" className="w-[96px] h-[96px] object-contain -my-2" style={{ filter: `drop-shadow(0 6px 12px rgba(0,0,0,0.9))${holder != null ? ` drop-shadow(0 0 14px ${sideColor(holder)}88)` : ''}` }} />
          <Total v={o.totals[1]} side={1} verdict={verdict} />
        </div>
        <div className="h-[30px] flex items-center justify-center px-2">
          {target && target.kind !== 'here'
            ? (target.kind === 'off' ? <span className="text-[13px] font-bold" style={{ color: T.text, textShadow: '0 1px 4px #000' }}>{target.why}</span> : <Pill t={target} />)
            : <span className="text-[12.5px] leading-tight text-center" style={{ color: T.text, opacity: 0.85, textShadow: '0 1px 6px #000' }}>{def.rule}</span>}
        </div>
      </div>

      <div className="relative flex-1 min-w-0 flex items-center gap-3 pl-5">
        {fx.aura[1] && <AuraFx />}
        {fx.hg === 1 && theirs.length > 0 && <HgFx height={h} />}
        <EffectChips items={fx.effects[1]} align="right" />
        <AnimatePresence>{theirs.map(draw)}</AnimatePresence>
        <Slots n={capacity - theirs.length} w={w} side={1} />
      </div>
    </div>
  );
}
