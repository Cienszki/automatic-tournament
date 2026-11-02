'use client';

// Shared look of the card game: the card face (FUT-style, like the stats hub's Karty), the card
// back, piles, HP / mana bars and small text helpers. Sizes scale from the card width.

import React, { createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { Avatar, C, HeroImg, TeamLogo, Tip, TipBody, ink, mix, useHeaderFont, useMetals } from '@/components/stats-lab/kit';
import { useFitText } from '@/components/teams-section/fit';
import { ATTRS, ROLE_SHORT, TIER, tierOf, type GCard } from '@/lib/card-lab/cards';

export const RATIO = 1.42;

/** Scale of the card lab's fitted stage (1 = 1920×900 layout px per screen px) — for things portalled out of it */
export const FitScaleCtx = createContext(1);
export const useFitScale = () => useContext(FitScaleCtx);

/** Explains a card on hover */
export function CardTip({ c }: { c: GCard }) {
  return (
    <TipBody title={`${c.name} · ${ROLE_SHORT[c.role]} · ocena ${c.ovr}`}>
      <div>{c.team?.name ?? '—'} {c.series.result} z {c.series.opp?.name ?? '?'} · {c.series.games} {c.series.games === 1 ? 'gra' : 'gry'}{c.standin ? ' · jako standin' : ''}</div>
      {c.totw && <div style={{ color: TIER.totw.color }}>Drużyna kolejki{c.series.label ? ` (${c.series.label})` : ''}: +4 do wszystkiego</div>}
      <div className="mt-1 grid grid-cols-3 gap-x-3 tabular-nums">{ATTRS.map(a => <span key={a.abbr}>{a.name} <b>{c.attrs[a.abbr]}</b></span>)}</div>
    </TipBody>
  );
}

function FitName({ text, max, min }: { text: string; max: number; min: number }) {
  const ref = useFitText<HTMLDivElement>(text, max, min);
  const font = useHeaderFont();
  return <div ref={ref} className="font-logik-extended-bold uppercase whitespace-nowrap overflow-hidden text-center" style={font}>{text}</div>;
}

/**
 * The card. `w` = width in px (height = w × 1.42). Below ~130 px the attributes are left out.
 * `selected` glows in the secondary colour, `dim` fades it.
 */
export function CardFace({ c, w, selected, dim, onClick, tip = true, children }: {
  c: GCard; w: number; selected?: boolean; dim?: boolean; onClick?: () => void; tip?: boolean; children?: React.ReactNode;
}) {
  const h = Math.round(w * RATIO);
  const s = w / 200;
  const t = TIER[tierOf(c)];
  const full = w >= 130;
  const font = useHeaderFont();
  const face = (
    <motion.div onClick={onClick} whileHover={onClick ? { y: -6 } : undefined}
      className={`relative shrink-0 overflow-hidden text-white select-none ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        width: w, height: h, borderRadius: Math.max(8, 16 * s),
        background: c.totw
          ? `linear-gradient(160deg, ${mix(t.color, 35)}, transparent 40%, ${mix('#b072ff', 25)} 80%), linear-gradient(180deg, #10141c, #07080d)`
          : `linear-gradient(160deg, ${mix(t.color, 30)} 0%, transparent 45%), linear-gradient(180deg, #17171f, #0b0b10)`,
        boxShadow: selected
          ? `0 0 0 ${Math.max(2, 3 * s)}px ${C.secondary}, 0 0 ${24 * s}px ${mix(C.secondary, 70)}`
          : `0 0 0 ${Math.max(1, 1.5 * s)}px ${mix(t.color, 75)}, 0 ${10 * s}px ${26 * s}px rgba(0,0,0,0.45)`,
        opacity: dim ? 0.4 : 1, transition: 'opacity .2s, box-shadow .2s',
      }}>
      <HeroImg heroId={c.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-30" />
      <div className="absolute -right-8 -top-8 rounded-full blur-2xl" style={{ width: 120 * s, height: 120 * s, background: mix(t.color, 30) }} />
      {/* Rating, position, team */}
      <div className="absolute flex flex-col items-center" style={{ left: 12 * s, top: 12 * s, width: 50 * s }}>
        <span className="font-logik-extended-bold leading-none" style={{ fontSize: 40 * s, color: t.color, ...font }}>{c.ovr}</span>
        <span className="font-bold tracking-widest opacity-85" style={{ fontSize: 11 * s, marginTop: 3 * s }}>POZ {c.pos}</span>
        {c.team && <span style={{ marginTop: 6 * s }}><TeamLogo team={c.team} size={Math.round(26 * s)} /></span>}
      </div>
      <div className="absolute" style={{ right: 10 * s, top: 12 * s }}>
        <Avatar player={c.player} size={Math.round(108 * s)} ring={mix(t.color, 85)} />
      </div>
      {/* Name and the series the card comes from */}
      <div className="absolute inset-x-0 px-2" style={{ top: 126 * s }}>
        <div style={{ height: 24 * s }}><FitName text={c.name} max={21 * s} min={10 * s} /></div>
        <div className="h-px mx-5" style={{ background: `linear-gradient(90deg, transparent, ${t.color}, transparent)`, marginTop: 2 * s }} />
        <div className="text-center whitespace-nowrap overflow-hidden opacity-75" style={{ fontSize: 10.5 * s, marginTop: 3 * s }}>
          {c.series.result} z {c.series.opp?.name ?? '?'}
        </div>
      </div>
      {full && (
        <div className="absolute grid grid-cols-2 gap-x-4" style={{ top: 174 * s, left: 22 * s, right: 22 * s, rowGap: 0, lineHeight: 1.2 }}>
          {ATTRS.map(a => (
            <span key={a.abbr} className="flex items-baseline gap-1.5">
              <span className="font-logik-extended-bold tabular-nums text-right" style={{ width: 28 * s, fontSize: 16 * s, color: c.attrs[a.abbr] >= 80 ? t.color : undefined, ...font }}>{c.attrs[a.abbr]}</span>
              <span className="tracking-widest opacity-70" style={{ fontSize: 10 * s }}>{a.abbr}</span>
            </span>
          ))}
        </div>
      )}
      <div className="absolute inset-x-0 flex items-center justify-center gap-2 uppercase tracking-widest" style={{ bottom: 8 * s, fontSize: 9 * s }}>
        <HeroImg heroId={c.heroId} className="rounded" style={{ width: 34 * s, height: 19 * s }} />
        <span style={{ color: t.color }} className="font-bold">{c.totw ? 'Drużyna kolejki' : c.standin ? 'Standin' : t.label}</span>
      </div>
      {children}
    </motion.div>
  );
  return tip ? <Tip content={<CardTip c={c} />}>{face}</Tip> : face;
}

export function CardBack({ w }: { w: number }) {
  const s = w / 200;
  return (
    <div className="shrink-0" style={{
      width: w, height: Math.round(w * RATIO), borderRadius: Math.max(8, 16 * s),
      background: `repeating-linear-gradient(45deg, ${mix(C.primary, 45)} 0 ${10 * s}px, ${mix(C.primary, 28)} ${10 * s}px ${20 * s}px), #15151c`,
      boxShadow: `0 0 0 ${Math.max(1, 1.5 * s)}px ${ink(25)}, 0 ${6 * s}px ${16 * s}px rgba(0,0,0,0.35)`,
    }} />
  );
}

/** A filled bar (HP, mana, tower) with the numbers on hover */
export function Bar({ v, max, color, h = 6, w, tip }: { v: number; max: number; color: string; h?: number; w?: number | string; tip?: React.ReactNode }) {
  const bar = (
    <div className="relative overflow-hidden rounded-full" style={{ height: h, width: w ?? '100%', background: 'rgba(0,0,0,0.55)', boxShadow: '0 0 0 1px rgba(255,255,255,0.12)' }}>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(1, v / max)) * 100}%`, background: color, transition: 'width .5s' }} />
    </div>
  );
  return tip ? <Tip content={tip}><div>{bar}</div></Tip> : bar;
}

export const HP_COLOR = '#45c46a';
export const MANA_COLOR = '#3f8cff';
export const GOLD_COLOR = '#f2c94c';
/** Gold that stays readable on light themes (wiosenna) */
export function useGold() { return useMetals()[2]; }
export const ME_COLOR = '#45c46a';
export const RIVAL_COLOR = '#e5534b';

export function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[11px] font-bold uppercase tracking-[0.25em] ${className}`} style={{ color: C.muted }}>{children}</div>;
}

export function Heading({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  const font = useHeaderFont();
  return <div className="font-logik-extended-bold uppercase leading-tight" style={{ fontSize: size, color: C.heading, ...font }}>{children}</div>;
}

export function Hairline({ vertical }: { vertical?: boolean }) {
  return vertical
    ? <div className="w-px self-stretch shrink-0" style={{ background: `linear-gradient(180deg, transparent, ${ink(14)}, transparent)` }} />
    : <div className="h-px w-full shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${ink(14)}, transparent)` }} />;
}

/** Primary / plain action button in the site's style */
export function Action({ children, onClick, disabled, primary, big, title, onDark }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean; big?: boolean; title?: string; onDark?: boolean }) {
  const font = useHeaderFont();
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`rounded-full font-logik-extended-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${big ? 'px-8 py-3.5 text-[15px]' : 'px-5 py-2 text-xs'} ${primary ? 'hover:brightness-110' : 'hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_10%,transparent)]'}`}
      style={primary ? { background: C.primary, color: '#fff', boxShadow: `0 0 22px ${mix(C.primary, 50)}`, ...font } : onDark ? { border: '1px solid rgba(255,255,255,0.45)', color: '#fff', ...font } : { border: `1px solid ${ink(20)}`, color: C.heading, ...font }}>
      {children}
    </button>
  );
}

export { Tip, TipBody };
