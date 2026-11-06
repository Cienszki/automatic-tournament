'use client';

// Shared look of the card game: the card face (what it does in the game), the card
// back, piles, HP / mana bars and small text helpers. Sizes scale from the card width.

import React, { createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { Avatar, C, HeroImg, TeamLogo, Tip, TipBody, ink, mix, useHeaderFont, useMetals } from '@/components/stats-lab/kit';
import { useFitText } from '@/components/teams-section/fit';
import { TIER, tierOf, type GCard } from '@/lib/card-lab/cards';
import { KEYWORD, baseMight } from '@/lib/card-lab/outposts';

export const RATIO = 1.42;

/** Scale of the card lab's fitted stage (1 = 1920×900 layout px per screen px) — for things portalled out of it */
export const FitScaleCtx = createContext(1);
export const useFitScale = () => useContext(FitScaleCtx);

/** Explains a card on hover: what it does in the game, and where it comes from */
export function CardTip({ c }: { c: GCard }) {
  const k = KEYWORD[c.role];
  return (
    <TipBody title={`${c.name} · ${k.name} · siła ${baseMight(c)}`}>
      <div><b>{k.ability}:</b> {k.text}</div>
      {c.team && <div className="mt-1"><b>Drużyna:</b> +1 siły, gdy stoi na objectivie z graczem z {c.team.name}.</div>}
      <div className="mt-1 opacity-70">Za serię {c.series.result} z {c.series.opp?.name ?? '?'}{c.standin ? ' (jako standin)' : ''} · ocena {c.ovr}</div>
      {c.totw && <div className="mt-1" style={{ color: TIER.totw.color }}>Drużyna kolejki{c.series.label ? ` (${c.series.label})` : ''}: karta mocniejsza niż zwykła</div>}
    </TipBody>
  );
}

function FitName({ text, max, min }: { text: string; max: number; min: number }) {
  const ref = useFitText<HTMLDivElement>(text, max, min);
  const font = useHeaderFont();
  return <div ref={ref} className="font-logik-extended-bold uppercase whitespace-nowrap overflow-hidden text-center" style={font}>{text}</div>;
}

const FOIL_CSS = `
@keyframes karty-foil { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }
@keyframes karty-twinkle { 0%, 100% { opacity: 0; transform: scale(.4) } 50% { opacity: 1; transform: scale(1) } }`;

/**
 * The card, showing what matters in the game: strength (big), position with its ability, the team (for
 * the team bonus). `w` = width in px (height = w × 1.42); below ~130 px the ability text is left out.
 * The rarity follows the strength (wooden grain, bronze, silver, gold, elite);
 * team-of-the-round cards are holographic: moving foil, a ribbon, a double frame and sparkles.
 * `selected` glows in the secondary colour, `dim` fades it; `children` are drawn on top (inside the card).
 */
export function CardFace({ c, w, selected, dim, onClick, tip = true, children }: {
  c: GCard; w: number; selected?: boolean; dim?: boolean; onClick?: () => void; tip?: boolean; children?: React.ReactNode;
}) {
  const h = Math.round(w * RATIO);
  const s = w / 200;
  const tier = tierOf(c);
  const t = TIER[tier];
  const full = w >= 130;
  const font = useHeaderFont();
  const k = KEYWORD[c.role];
  const special = !!c.totw;
  const r = Math.max(8, 16 * s);
  const face = (
    <motion.div onClick={onClick} whileHover={onClick ? { y: -6 } : undefined}
      className={`relative shrink-0 overflow-hidden text-white select-none ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        width: w, height: h, borderRadius: r,
        background: special
          ? `radial-gradient(120% 70% at 50% 0%, ${mix(t.color, 40)}, transparent 60%), linear-gradient(180deg, #0f1a26, #06080d)`
          : `linear-gradient(160deg, ${mix(t.color, 30)} 0%, transparent 45%), linear-gradient(180deg, #17171f, #0b0b10)`,
        boxShadow: selected
          ? `0 0 0 ${Math.max(2, 3 * s)}px ${C.secondary}, 0 0 ${24 * s}px ${mix(C.secondary, 70)}`
          : special
            ? `0 0 0 ${Math.max(2, 2.5 * s)}px ${t.color}, 0 0 0 ${Math.max(4, 5 * s)}px #f2c94c, 0 0 ${30 * s}px ${t.color}, 0 ${10 * s}px ${26 * s}px rgba(0,0,0,0.5)`
            : `0 0 0 ${Math.max(1, 1.5 * s)}px ${mix(t.color, 75)}, 0 ${10 * s}px ${26 * s}px rgba(0,0,0,0.45)`,
        opacity: dim ? 0.4 : 1, transition: 'opacity .2s, box-shadow .2s',
      }}>
      {special && <style>{FOIL_CSS}</style>}
      {/* Wooden: a dull grain */}
      {tier === 'wood' && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'repeating-linear-gradient(97deg, rgba(156,122,88,0.16) 0 3px, transparent 3px 12px), repeating-linear-gradient(93deg, rgba(70,45,22,0.22) 0 1px, transparent 1px 8px), linear-gradient(180deg, rgba(110,80,50,0.18), transparent 70%)',
        }} />
      )}
      <HeroImg heroId={c.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-30" />
      <div className="absolute -right-8 -top-8 rounded-full blur-2xl" style={{ width: 120 * s, height: 120 * s, background: mix(t.color, 30) }} />
      {/* Holographic foil sweeping across the whole card */}
      {special && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(115deg, transparent 20%, rgba(255,90,200,0.35) 30%, rgba(90,240,255,0.4) 38%, rgba(255,240,120,0.35) 46%, transparent 56%)',
          backgroundSize: '300% 100%', mixBlendMode: 'color-dodge', animation: 'karty-foil 4s linear infinite',
        }} />
      )}
      {/* Strength (what it hits for in the game) and team */}
      <div className="absolute flex flex-col items-center" style={{ left: 10 * s, top: special ? 30 * s : 10 * s, width: 56 * s }}>
        <span className="flex items-center justify-center font-logik-extended-bold leading-none"
          style={{ width: 50 * s, height: 50 * s, fontSize: 32 * s, borderRadius: '50% 50% 50% 12%', background: t.color, color: '#07080b', boxShadow: `0 0 ${14 * s}px ${mix(t.color, 70)}`, ...font }}>{baseMight(c)}</span>
        <span className="font-bold tracking-widest opacity-85" style={{ fontSize: 9 * s, marginTop: 3 * s }}>SIŁA</span>
        {c.team && <span style={{ marginTop: 5 * s }}><TeamLogo team={c.team} size={Math.round(26 * s)} /></span>}
      </div>
      <div className="absolute" style={{ right: 10 * s, top: special ? 30 * s : 12 * s }}>
        <Avatar player={c.player} size={Math.round((special ? 96 : 108) * s)} ring={mix(t.color, 85)} />
      </div>
      {/* Team of the round ribbon */}
      {special && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-1.5 font-logik-extended-bold uppercase tracking-widest text-black"
          style={{ height: 22 * s, fontSize: 10 * s, background: `linear-gradient(90deg, #f2c94c, ${t.color}, #f2c94c)`, ...font }}>
          <span>★</span>Drużyna kolejki<span>★</span>
        </div>
      )}
      {/* Name, position + ability, what the ability does */}
      <div className="absolute inset-x-0 px-2" style={{ top: 128 * s }}>
        <div style={{ height: 24 * s }}><FitName text={c.name} max={21 * s} min={10 * s} /></div>
        <div className="h-px mx-5" style={{ background: `linear-gradient(90deg, transparent, ${t.color}, transparent)`, marginTop: 2 * s }} />
        <div className="text-center font-logik-extended-bold uppercase tracking-wider" style={{ fontSize: 12 * s, marginTop: 4 * s, color: t.color, ...font }}>
          {k.name} <span className="opacity-70">· {k.ability}</span>
        </div>
        {full && <div className="text-center leading-snug opacity-90" style={{ fontSize: 10.5 * s, marginTop: 3 * s, paddingInline: 6 * s }}>{k.text}</div>}
      </div>
      <div className="absolute inset-x-0 flex items-center justify-center gap-2 uppercase tracking-widest" style={{ bottom: 8 * s, fontSize: 9 * s }}>
        <HeroImg heroId={c.heroId} className="rounded" style={{ width: 34 * s, height: 19 * s }} />
        <span style={{ color: t.color }} className="font-bold">{special ? `Seria ${c.series.result}` : c.standin ? 'Standin' : t.label}</span>
      </div>
      {/* Sparkles */}
      {special && [[18, 40], [82, 22], [70, 64], [26, 78], [90, 84]].map(([x, y], i) => (
        <span key={i} className="absolute pointer-events-none" style={{ left: `${x}%`, top: `${y}%`, width: 8 * s, height: 8 * s, background: '#fff', clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)', animation: `karty-twinkle ${1.6 + i * 0.4}s ease-in-out ${i * 0.5}s infinite` }} />
      ))}
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
