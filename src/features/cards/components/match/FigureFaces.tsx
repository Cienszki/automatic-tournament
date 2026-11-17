'use client';

// The two faces of a card: the front (today's look: hero, avatar, name, position, strength badge,
// bonus chips) and the back, which is either what the card is and does (hover or long press) or,
// for a rival card not yet turned over, the card back.
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon } from 'lucide-react';
import type { GCard } from '@/lib/card-lab/cards';
import { Avatar, HeroRender, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { useFitText } from '@/components/teams-section/fit';
import { cost } from '@/features/cards/domain/v2/deck';
import type { CostMode } from '@/features/cards/domain/v2/rules';
import type { StrengthParts } from '@/features/cards/domain/v2/strength';
import type { Side } from '@/features/cards/domain/v2/types';
import { ABILITY, ACC, ACC_L, PART, PART_KEYS, ROLE, T, sideColor, signColor, signed, type PartKey } from './theme';

function FitLine({ text, max, min, className, style }: { text: string; max: number; min: number; className?: string; style?: React.CSSProperties }) {
  const ref = useFitText<HTMLDivElement>(text, max, min);
  return <div ref={ref} className={`whitespace-nowrap overflow-hidden ${className ?? ''}`} style={style}>{text}</div>;
}

/** The bonuses worth a chip: everything but the card's own strength, and what a hit took */
export function chips(parts?: StrengthParts, lost = 0): Array<{ key: PartKey; v: number }> {
  const out: Array<{ key: PartKey; v: number }> = [];
  if (parts) for (const k of PART_KEYS) if (k !== 'hit' && parts[k] > 0) out.push({ key: k, v: parts[k] });
  if (lost > 0) out.push({ key: 'hit', v: -lost });
  return out;
}

export interface FaceProps { card: GCard; side: Side; w: number; strength: number; parts?: StrengthParts; lost?: number; tired?: boolean; ring: string; roleColor?: string }

export function Front({ card, side, w, strength, parts, lost, tired, ring, roleColor }: FaceProps) {
  const font = useHeaderFont();
  const k = w / 110;
  const list = chips(parts, lost);
  return (
    <>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: 12 * k, background: `radial-gradient(120% 80% at 50% 100%, ${sideColor(side)}38, transparent 60%), linear-gradient(180deg, #1c1f29, #0a0b0f)`,
        boxShadow: ring, filter: tired ? 'saturate(0.3) brightness(0.72)' : undefined, transition: 'box-shadow .2s, filter .2s',
      }}>
        <div className="absolute inset-x-0" style={{ top: 6 * k, bottom: 30 * k }}><HeroRender heroId={card.heroId} sizes={`${Math.round(w * 1.4)}px`} /></div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(5,6,9,0.97) 14%, transparent 58%)' }} />
        <span className="absolute" style={{ right: 6 * k, top: 6 * k }}><Avatar player={card.player} size={Math.round(26 * k)} ring="rgba(0,0,0,0.6)" /></span>
        <div className="absolute" style={{ left: 6 * k, right: 6 * k, bottom: 5 * k, color: T.text }}>
          <FitLine text={card.name} max={Math.max(11, 13 * k)} min={9} className="font-bold leading-tight" />
          <div className="font-bold uppercase tracking-wider flex items-center gap-1" style={{ fontSize: Math.max(10, 10 * k), color: roleColor ?? ACC_L }}>
            {ROLE[card.role].name}{tired && <Moon className="ml-auto" style={{ width: Math.max(11, 12 * k), height: Math.max(11, 12 * k), color: T.muted }} />}
          </div>
        </div>
      </div>
      <motion.span key={strength} className="absolute flex items-center justify-center font-logik-extended-bold leading-none z-10"
        initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
        style={{ left: 5 * k, top: 5 * k, width: 34 * k, height: 34 * k, fontSize: 20 * k, borderRadius: '50% 50% 50% 10%', background: sideColor(side), color: '#07080b', boxShadow: '0 2px 8px rgba(0,0,0,0.6)', ...font }}>{strength}</motion.span>
      <div className="absolute flex flex-col gap-0.5 z-10" style={{ left: 5 * k, top: 42 * k }}>
        <AnimatePresence>
          {list.map(({ key, v }) => {
            const p = PART[key]; const Icon = p.icon;
            return (
              <motion.span key={key} className="flex items-center gap-0.5 rounded-full px-1 font-bold" style={{ fontSize: Math.max(10, 10 * k), background: 'rgba(0,0,0,0.78)', color: p.color }}
                initial={{ scale: 0, x: -10, opacity: 0 }} animate={{ scale: 1, x: 0, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}>
                <Icon style={{ width: 10 * k + 2, height: 10 * k + 2 }} />{signed(v)}
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}

/** What the card is and does, with its strength part by part (only when it has bonuses) */
export function Back({ card, side, w, strength, parts, lost, costMode, note }: FaceProps & { costMode: CostMode; note?: string }) {
  const font = useHeaderFont();
  const k = w / 110;
  const role = ROLE[card.role];
  const list = chips(parts, lost);
  return (
    <div className="absolute inset-0 overflow-hidden flex flex-col" style={{ borderRadius: 12 * k, padding: 7 * k, background: 'linear-gradient(180deg, #1d2030, #0b0c12)', boxShadow: `0 0 0 1.5px ${ACC_L}, 0 16px 40px rgba(0,0,0,0.7)`, color: T.text }}>
      <div className="font-bold leading-tight break-words" style={{ fontSize: 10.5 * k }}>{card.name}</div>
      <div className="leading-tight break-words" style={{ fontSize: 7 * k, color: T.muted }}>{card.team?.name}{card.series.opp ? ` vs ${card.series.opp.name}` : ''}</div>
      <div className="font-logik-extended-bold uppercase leading-none whitespace-nowrap" style={{ fontSize: 7.6 * k, color: ACC_L, marginTop: 5 * k, ...font }}>{role.name} · {role.ability}</div>
      <div className="leading-tight" style={{ fontSize: 7.4 * k, marginTop: 2.5 * k }}>{ABILITY[card.role]}</div>
      <div className="mt-auto">
        {list.length > 0 && parts && (
          <div className="flex flex-wrap uppercase" style={{ fontSize: 7 * k, columnGap: 5 * k, lineHeight: 1.25 }}>
            <span className="whitespace-nowrap"><span style={{ color: T.muted }}>Karta </span><b>{parts.base}</b></span>
            {list.map(({ key, v }) => (
              <span key={key} className="whitespace-nowrap"><span style={{ color: T.muted }}>{PART[key].label} </span><b style={{ color: signColor(v) }}>{signed(v)}</b></span>
            ))}
          </div>
        )}
        <div className="flex items-baseline gap-1.5" style={{ marginTop: 2 * k }}>
          <span className="uppercase font-bold" style={{ fontSize: 8.5 * k }}>Siła</span>
          <span className="font-logik-extended-bold leading-none" style={{ fontSize: 16 * k, color: sideColor(side), ...font }}>{strength}</span>
          <span className="ml-auto uppercase" style={{ fontSize: 7 * k, color: T.muted }}>Koszt <b style={{ color: T.text }}>{cost(card, costMode)}</b></span>
        </div>
        {note && <div className="leading-tight" style={{ fontSize: 6.5 * k, color: T.muted, marginTop: 2 * k }}>{note}</div>}
      </div>
    </div>
  );
}

/** A card not turned over yet (today's card back) */
export function Cover({ w }: { w: number }) {
  const s = w / 200;
  return (
    <div className="absolute inset-0" style={{
      borderRadius: 12 * (w / 110),
      background: `repeating-linear-gradient(45deg, ${mix(ACC, 45)} 0 ${10 * s}px, ${mix(ACC, 28)} ${10 * s}px ${20 * s}px), #15151c`,
      boxShadow: `0 0 0 1.5px ${T.rival}99, 0 10px 22px rgba(0,0,0,0.55)`,
    }} />
  );
}
