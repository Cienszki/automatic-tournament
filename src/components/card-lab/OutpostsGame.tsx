'use client';

// "Kontrola mapy" — the area-control game (rules: src/lib/card-lab/outposts.ts) vs the practice
// computer. Full-bleed dark table, game HUD:
//   top      score race to 10, the rival's hand, the combat log button
//   middle   the rival's base, three objectives (open arenas on their real map spot), your base
//   bottom   phase prompt + your hand, with the orders and the turn button right next to it
// Cards are dragged (the card sticks to the pointer where you grabbed it) or tapped and then sent by
// clicking anywhere on a target. Fights play as a scene; points fly to the score; the end is a show.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bot, CircleHelp, HeartCrack, Flag, Home, Moon, Mountain, Plus, ScrollText, Shield, Skull, Sprout, Sun, Swords, Users, Wind, X } from 'lucide-react';
import { Avatar, C, HeroRender, Tip, mix, onDark, useHeaderFont, useSize } from '@/components/stats-lab/kit';
import { useFitText } from '@/components/teams-section/fit';
import { avgOvr, cpuDeck, type DeckRule, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import {
  DECK_PER_ROLE, DECK_SIZE, KEYWORD, OBJECTIVES, ORDERS, PER_SIDE_AT_OBJECTIVE, WIN_POINTS, baseMight, canDeploy, canMove, cardStrength, clashes as clashesOf, deploy, endTurn, might, move, moveCost, newGame, resolve, RULES, smokeCovers, smokeLeft, startOrders, strengthParts, takePoints, type Ev, type Fight, type Gain, type Loc, type ObjId, type OState, type OUnit, type Part, type Side, duelAct, duelOver, duelTargets, startDuel, type Attack, type Duel, type DuelUnit,
} from '@/lib/card-lab/outposts';
import { applyAct, chooseAttack, cpuNextAction, LEVELS, type Level } from '@/lib/card-lab/outposts-ai';
import { CardBack, useFitScale } from './ui';
import { Tour, type TourStep } from '@/components/tour/Tour';
import { Hint } from '@/components/tour/Hint';
import { Coach, type CoachStep } from '@/components/tour/Coach';

export const OUTPOSTS_RULE: DeckRule = { size: DECK_SIZE, perRole: DECK_PER_ROLE, text: `${DECK_SIZE} kart, co najmniej ${DECK_PER_ROLE} na każdej pozycji, każdy gracz raz` };

// The table is always dark; highlights use the tournament's own colour
const ACC = C.primary;
const ACC_L = onDark(C.primary, 70);
const T = {
  bg: '#0c0e13', line: 'rgba(255,255,255,0.10)', text: '#ece9e3', muted: 'rgba(236,233,227,0.6)', faint: 'rgba(236,233,227,0.12)',
  me: '#4fd17b', rival: '#ff5d55', pts: '#f2c94c', warn: '#ffb347', smoke: '#b48cff', pos: '#5fd38d', neg: '#ff6b6b', zero: 'rgba(236,233,227,0.55)',
};
const sideColor = (s: Side) => (s === 0 ? T.me : T.rival);

/** Where each objective really is on the 7.41 map (fractions of the minimap image), read off the map:
 *  Roshan's river lair (top one), the corner Tormentor arena, the jungle Outpost, the Twin Gate on
 *  the map edge, the river mouth by the top lane (Lotus Pool), the Radiant high ground. */
const MAP_AT: Record<ObjId, [number, number]> = {
  roshan: [0.355, 0.375], tormentor: [0.135, 0.18], outpost: [0.293, 0.535],
  gates: [0.098, 0.36], lotus: [0.465, 0.13], highground: [0.24, 0.72],
};
/** The objective's model from the game files (renders from the Dota 2 wiki), served from /public */
const objModel = (id: string) => `/card-lab/objectives/${id}.webp`;
const MAP_VIEW = 0.3; // how much of the map's width an arena shows
const MAP_EDGE = [0.065, 0.935]; // the drawn map inside the image's black border

const PART_ICON: Partial<Record<Part['kind'], typeof Sun>> = { aura: Sun, farmer: Sprout, hg: Mountain, team: Users, wound: HeartCrack };
const PART_COLOR: Record<Part['kind'], string> = { card: T.text, role: T.text, aura: ACC_L, farmer: T.me, hg: '#6fb7ff', team: '#7fd3ff', wound: '#ff7a6b' };
const signColor = (v: number) => (v > 0 ? T.pos : v < 0 ? T.neg : T.zero);

function FitLine({ text, max, min, className, style }: { text: string; max: number; min: number; className?: string; style?: React.CSSProperties }) {
  const ref = useFitText<HTMLDivElement>(text, max, min);
  return <div ref={ref} className={`whitespace-nowrap overflow-hidden ${className ?? ''}`} style={style}>{text}</div>;
}

/** Order gem (the turn's currency); `pending` blinks: it would be spent by what is selected */
const BLINK_MS = 1100;
function Gem({ on = true, pending, size = 16 }: { on?: boolean; pending?: boolean; size?: number }) {
  // Every blinking gem shares one clock, so they blink together
  const anim = pending ? { animation: `karty-blink ${BLINK_MS}ms ease-in-out infinite`, animationDelay: `-${Date.now() % BLINK_MS}ms` } : {};
  return (
    <span className="inline-block rotate-45 shrink-0 align-middle"
      style={{ width: size, height: size, borderRadius: size * 0.22, background: on ? ACC_L : T.faint, boxShadow: on ? `0 0 ${size * 0.6}px ${mix(ACC, 70)}` : undefined, ...anim }} />
  );
}

// ── Effects ──────────────────────────────────────────────────────────────────

function SmokeFx() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 12 }, (_, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: `${4 + (i * 9) % 90}%`, top: `${12 + (i * 29) % 72}%`, width: 150, height: 100, marginLeft: -75, marginTop: -50, background: `radial-gradient(ellipse, ${T.smoke}cc, ${T.smoke}44 45%, transparent 70%)`, filter: 'blur(5px)' }}
          animate={{ x: [0, i % 2 ? 26 : -26, 0], y: [0, -14, 0], opacity: [0.45, 0.95, 0.45], scale: [1, 1.15, 1] }} transition={{ duration: 3.4 + (i % 3), repeat: Infinity, delay: i * 0.25 }} />
      ))}
    </div>
  );
}
/** A soft glow under a group with a Hard Supp, sparks rising */
function AuraFx() {
  return (
    <div className="absolute inset-x-[3%] inset-y-0 pointer-events-none">
      <motion.div className="absolute inset-0" style={{ background: `radial-gradient(55% 60% at 50% 60%, ${mix(ACC_L, 45)}, ${mix(ACC, 18)} 45%, transparent 75%)` }}
        animate={{ opacity: [0.5, 0.75, 0.5] }} transition={{ duration: 4, repeat: Infinity }} />
      {Array.from({ length: 14 }, (_, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: `${6 + i * 6.5}%`, bottom: '6%', width: 6, height: 6, background: '#fff', boxShadow: `0 0 10px ${ACC_L}, 0 0 4px #fff` }}
          animate={{ y: [0, -160], opacity: [0, 0.9, 0] }} transition={{ duration: 2.4 + (i % 3) * 0.5, repeat: Infinity, delay: i * 0.22 }} />
      ))}
    </div>
  );
}
const HG_COLOR = '#6fb7ff';
/** High Ground held: see-through towers standing on both sides of the three places */
function HgFx({ w }: { w: number }) {
  const span = 3 * w + 20; const tw = Math.round(w * 0.62);
  const tower = (right: boolean) => (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={objModel('highground')} alt="" className="absolute bottom-[6%] pointer-events-none select-none"
      style={{ height: '88%', width: tw, objectFit: 'contain', [right ? 'left' : 'right']: `calc(50% + ${span / 2 + 6}px)`, opacity: 0.42, transform: right ? 'scaleX(-1)' : undefined, filter: `drop-shadow(0 0 14px ${HG_COLOR}) saturate(0.7) brightness(1.25)` }} />
  );
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute left-1/2 bottom-[2%] -translate-x-1/2 rounded-[50%]" style={{ width: span + 2 * tw, height: 40, background: `radial-gradient(closest-side, ${HG_COLOR}55, transparent)` }} />
      {tower(false)}{tower(true)}
    </div>
  );
}
interface Effect { key: string; icon: typeof Sun; label: string; color: string; tip: React.ReactNode }
/** The effects working on a row, as short labels side by side; hover for what each does */
function EffectChips({ items, side }: { items: Effect[]; side: Side }) {
  if (!items.length) return null;
  return (
    <div className="absolute right-3 z-30 flex gap-1.5 pointer-events-auto" style={side === 0 ? { top: 8 } : { bottom: 8 }}>
      {items.map(e => (
        <Tip key={e.key} content={e.tip}>
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap cursor-help"
            style={{ background: e.color, color: '#07080b', boxShadow: `0 0 10px ${e.color}88` }}>
            <e.icon className="w-3.5 h-3.5" />{e.label}
          </span>
        </Tip>
      ))}
    </div>
  );
}
const SMOKE_TIP = () => (RULES.smoke === 'place' ? 'Raz na turę jedna grupa ruszająca stąd idzie bez rozkazu (Support nie musi iść).' : 'Raz na turę grupa z Supportem w środku idzie bez rozkazu.');
function effectsAt(s: OState, loc: Loc, side: Side): Effect[] {
  const here = s.units.filter(u => u.side === side && u.loc === loc);
  if (!here.length) return [];
  const out: Effect[] = [];
  if (side === 0 && s.active === 0 && s.phase === 'move' && here.some(u => !u.moved && !u.fresh && smokeCovers(s, [u.uid])))
    out.push({ key: 'smoke', icon: Wind, label: 'Smoke', color: T.smoke, tip: SMOKE_TIP() });
  if (loc !== 'base' && here.some(u => u.card.role === 'Hard Support'))
    out.push({ key: 'aura', icon: Sun, label: 'Aura', color: ACC_L, tip: 'Hard Supp: +1 siły dla każdej jednostki tutaj (także dla siebie).' });
  if (loc !== 'base' && s.objectives[loc].id === 'highground' && s.objectives[loc].owner === side)
    out.push({ key: 'hg', icon: Mountain, label: 'High Ground', color: HG_COLOR, tip: 'W obronie: +1 siły dla każdej jednostki właściciela.' });
  if (loc !== 'base' && here.some(u => strengthParts(s, u).some(p => p.kind === 'team')))
    out.push({ key: 'team', icon: Users, label: 'Drużyna', color: '#7fd3ff', tip: 'Gracze z tej samej drużyny stoją razem: każdy z nich +1 siły.' });
  return out;
}

// ── A figure: a unit, or a card in the hand (same look) ─────────────────────

interface FigProps {
  card: GCard; m: number; side: Side; w: number; layoutId?: string;
  parts?: Part[]; smoke?: boolean; bump?: { v: number; key: number } | null;
  selected?: boolean; tired?: boolean; planned?: boolean; glow?: boolean; ghost?: boolean; settle?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  /** Hover turns the card over and shows this on its back */
  info?: { parts?: Part[]; note?: string; showParts?: boolean };
  /** Which way the card grows when it turns over (hand: up, rival base: down) */
  grow?: 'up' | 'down' | 'center';
  dataId?: string;
}
const FLIP_DELAY = 350; const FLIP_SCALE = 1.55; const FLIP_W = 190;

function Figure({ card, m, side, w, layoutId, parts, smoke, bump, selected, tired, planned, glow, ghost, settle, onPointerDown, info, grow = 'center', dataId }: FigProps) {
  const font = useHeaderFont();
  const h = Math.round(w * 1.34);
  const k = w / 110;
  const buffs = (parts ?? []).filter(p => PART_ICON[p.kind]);
  const [flipped, setFlipped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = () => { if (!info) return; timer.current = setTimeout(() => setFlipped(true), FLIP_DELAY); };
  const leave = () => { if (timer.current) clearTimeout(timer.current); setFlipped(false); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const origin = grow === 'up' ? '50% 100%' : grow === 'down' ? '50% 0%' : '50% 50%';
  const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' };
  return (
    <motion.div layoutId={layoutId} layout={!!layoutId} transition={{ type: 'spring', stiffness: 300, damping: 30 }} data-uid={dataId}
      initial={settle ? { scale: 1.12, opacity: 1 } : { opacity: 0, scale: 0.75 }}
      animate={{ opacity: ghost ? 0 : 1, scale: flipped ? Math.max(FLIP_SCALE, FLIP_W / w) : 1, y: flipped && grow === 'up' ? -46 : selected && !flipped ? -8 : 0 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.3 } }}
      onMouseEnter={enter} onMouseLeave={leave}
      onPointerDown={e => { leave(); onPointerDown?.(e); }} onClick={e => e.stopPropagation()} className="relative shrink-0 touch-none select-none"
      style={{ width: w, height: h, cursor: onPointerDown ? 'grab' : 'default', zIndex: flipped ? 80 : undefined, transformOrigin: origin, perspective: 900 }}>
      <motion.div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.45, ease: [0.3, 1.1, 0.5, 1] }}>
        {/* Front */}
        <div style={face}>
          <div className="absolute inset-0 overflow-hidden" style={{
            borderRadius: 12 * k,
            background: `radial-gradient(120% 80% at 50% 100%, ${sideColor(side)}38, transparent 60%), linear-gradient(180deg, #1c1f29, #0a0b0f)`,
            boxShadow: selected ? `0 0 0 3px ${ACC_L}, 0 0 26px ${mix(ACC, 80)}`
              : glow ? `0 0 0 2px ${ACC_L}, 0 0 18px ${mix(ACC, 55)}`
              : smoke ? `0 0 0 2px ${T.smoke}, 0 0 20px ${T.smoke}aa`
              : `0 0 0 1.5px ${sideColor(side)}99, 0 10px 22px rgba(0,0,0,0.55)`,
            filter: tired ? 'saturate(0.3) brightness(0.72)' : undefined, transition: 'box-shadow .2s',
          }}>
            <div className="absolute inset-x-0" style={{ top: 6 * k, bottom: 30 * k }}><HeroRender heroId={card.heroId} sizes={`${Math.round(w * 1.4)}px`} /></div>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(5,6,9,0.97) 14%, transparent 58%)' }} />
            <span className="absolute" style={{ right: 6 * k, top: 6 * k }}><Avatar player={card.player} size={Math.round(26 * k)} ring="rgba(0,0,0,0.6)" /></span>
            <div className="absolute" style={{ left: 6 * k, right: 6 * k, bottom: 5 * k, color: T.text }}>
              <FitLine text={card.name} max={Math.max(11, 13 * k)} min={9} className="font-bold leading-tight" />
              <div className="font-bold uppercase tracking-wider flex items-center gap-1" style={{ fontSize: Math.max(10, 10 * k), color: smoke ? T.smoke : ACC_L }}>
                {KEYWORD[card.role].name}{tired && <Moon className="ml-auto" style={{ width: Math.max(11, 12 * k), height: Math.max(11, 12 * k), color: T.muted }} />}
              </div>
            </div>
          </div>
          {/* Badges sit outside the 3D faces (own transforms), so they would show through mirrored: hide them on the back */}
          {!flipped && <motion.span key={bump?.key ?? 'm'} className="absolute flex items-center justify-center font-logik-extended-bold leading-none z-10"
            initial={bump ? { scale: 1.8 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
            style={{ left: 5 * k, top: 5 * k, width: 34 * k, height: 34 * k, fontSize: 20 * k, borderRadius: '50% 50% 50% 10%', background: sideColor(side), color: '#07080b', boxShadow: bump ? `0 0 18px ${ACC_L}` : '0 2px 8px rgba(0,0,0,0.6)', ...font }}>{m}</motion.span>}
          {!flipped && buffs.length > 0 && (
            <div className="absolute flex flex-col gap-0.5 z-10" style={{ left: 5 * k, top: 42 * k }}>
              {buffs.map(p => {
                const Icon = PART_ICON[p.kind]!;
                return <span key={p.kind} className="flex items-center gap-0.5 rounded-full px-1 font-bold" style={{ fontSize: Math.max(10, 10 * k), background: 'rgba(0,0,0,0.78)', color: PART_COLOR[p.kind] }}><Icon style={{ width: 10 * k + 2, height: 10 * k + 2 }} />{p.v > 0 ? '+' : '−'}{Math.abs(p.v)}</span>;
              })}
            </div>
          )}
          {!flipped && planned && <span className="absolute pointer-events-none z-10" style={{ inset: -4, borderRadius: 14 * k, border: `2px dashed ${ACC_L}` }} />}
          {!flipped && smoke && <span className="absolute z-10 rounded-full flex items-center justify-center" style={{ right: 4 * k, top: 36 * k, width: 22 * k, height: 22 * k, background: 'rgba(0,0,0,0.75)' }}><Wind style={{ width: 13 * k, height: 13 * k, color: T.smoke }} /></span>}
        </div>
        {/* Back: what the card is and does */}
        {info && (
          <div style={{ ...face, transform: 'rotateY(180deg)' }}>
            <div className="absolute inset-0 overflow-hidden flex flex-col" style={{ borderRadius: 12 * k, padding: 7 * k, background: `linear-gradient(180deg, #1d2030, #0b0c12)`, boxShadow: `0 0 0 1.5px ${ACC_L}, 0 16px 40px rgba(0,0,0,0.7)`, color: T.text }}>
              <div className="font-bold leading-tight break-words" style={{ fontSize: 10.5 * k }}>{card.name}</div>
              <div className="leading-tight break-words" style={{ fontSize: 7 * k, color: T.muted }}>{card.team?.name}{card.series.opp ? ` vs ${card.series.opp.name}` : ''}</div>
              <div className="font-logik-extended-bold uppercase leading-none" style={{ fontSize: 9.5 * k, color: ACC_L, marginTop: 5 * k, ...font }}>{KEYWORD[card.role].name}</div>
              <div className="leading-tight" style={{ fontSize: 7.8 * k, marginTop: 2.5 * k }}>{KEYWORD[card.role].text}</div>
              <div className="mt-auto">
                {/* The breakdown flows on one or two lines, however many buffs there are */}
                {info.showParts && info.parts && (
                  <div className="flex flex-wrap uppercase" style={{ fontSize: 7 * k, columnGap: 5 * k, lineHeight: 1.25 }}>
                    {info.parts.map((p, i) => (
                      <span key={i} className="whitespace-nowrap">
                        <span style={{ color: T.muted }}>{p.kind === 'card' ? 'Karta' : p.label} </span>
                        <b style={{ color: p.kind === 'card' ? T.text : signColor(p.v) }}>{p.kind === 'card' ? p.v : `${p.v > 0 ? '+' : '−'}${Math.abs(p.v)}`}</b>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-baseline gap-1.5" style={{ marginTop: 2 * k }}>
                  <span className="uppercase font-bold" style={{ fontSize: 8.5 * k }}>Siła</span>
                  <span className="font-logik-extended-bold leading-none" style={{ fontSize: 16 * k, color: sideColor(side), ...font }}>{m}</span>
                </div>
                {info.note && <div className="leading-tight" style={{ fontSize: 6.5 * k, color: T.muted, marginTop: 2 * k }}>{info.note}</div>}
              </div>
            </div>
          </div>
        )}
      </motion.div>
      <AnimatePresence>
        {bump && (
          <motion.span key={bump.key} className="absolute left-1/2 -translate-x-1/2 font-logik-extended-bold text-[22px] z-20 pointer-events-none" style={{ top: -4, color: ACC_L, textShadow: `0 0 12px ${ACC}, 0 2px 4px #000`, ...font }}
            initial={{ y: 0, opacity: 0 }} animate={{ y: -34, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.6 }}>+{bump.v}</motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Board buffs (not the card's own value or the type's fixed ±1) — only these are worth a breakdown */
const hasBuffs = (parts?: Part[]) => !!parts?.some(p => p.kind !== 'card' && p.kind !== 'role');

/** Info about a card (used in the combat log): who, the type and what it does, strength */
function CardInfo({ card, parts, m, note }: { card: GCard; parts?: Part[]; m: number; note?: string }) {
  const kw = KEYWORD[card.role];
  return (
    <div className="w-[280px] text-[12px] leading-snug">
      <div className="text-[15px] font-bold break-words">{card.name}</div>
      <div className="break-words" style={{ color: T.muted }}>{card.team?.name}{card.series.opp ? ` vs ${card.series.opp.name}` : ''}</div>
      <div className="mt-2 font-logik-extended-bold uppercase text-[13px] tracking-wide" style={{ color: ACC_L }}>{kw.name}</div>
      <div className="text-[13px]" style={{ color: T.text }}>{kw.text}</div>
      {hasBuffs(parts) && (
        <div className="mt-2 flex flex-col gap-0.5">
          {parts!.map((p, i) => (
            <span key={i} className="flex items-baseline gap-1.5">
              <span className="uppercase tracking-wide" style={{ color: T.muted }}>{p.kind === 'card' ? 'Karta' : p.label}</span>
              <b style={{ color: p.kind === 'card' ? T.text : signColor(p.v) }}>{p.kind === 'card' ? p.v : `${p.v > 0 ? '+' : '−'}${Math.abs(p.v)}`}</b>
            </span>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex items-baseline gap-1.5 text-[14px]"><span className="uppercase tracking-wide font-bold">Siła</span><b className="font-logik-extended-bold">{m}</b></div>
      {note && <div className="mt-2" style={{ color: T.muted }}>{note}</div>}
    </div>
  );
}

// ── Where things may go ─────────────────────────────────────────────────────

/** `cost`: what the move adds to the plan (1, 0 when it joins a group or Smoke pays, −1 when it cancels) */
interface Target { ok: boolean; text: string; tone: 'good' | 'fight' | 'plain' | 'off'; cost: number; smoke?: boolean }
function powerIfMoved(s: OState, ids: string[], to: Loc) {
  const t: OState = { ...s, units: s.units.map(u => (ids.includes(u.uid) ? { ...u, loc: to } : u)) };
  return t.units.filter(u => u.side === 0 && u.loc === to).reduce((a, u) => a + might(t, u), 0);
}
function unitTarget(s: OState, ids: string[], to: Loc): Target {
  const why = canMove(s, ids, to);
  if (why) return { ok: false, text: why, tone: 'off', cost: 0 };
  const cost = moveCost(s, ids, to);
  const us = s.units.filter(u => ids.includes(u.uid));
  const smoke = cost === 0 && smokeCovers(s, ids);
  if (us.every(u => u.from === to)) return { ok: true, text: 'Cofnięcie ruchu', tone: 'plain', cost };
  if (to === 'base') return { ok: true, text: 'Do bazy', tone: 'plain', cost, smoke };
  const p = powerIfMoved(s, ids, to);
  if (s.units.some(u => u.side === 1 && u.loc === to)) return { ok: true, text: `Walka po zatwierdzeniu · Twoja siła ${p}`, tone: 'fight', cost, smoke };
  if (s.objectives[to].owner !== 0) return { ok: true, text: `Przejęcie · +${takePoints(s.objectives[to].id)} pkt`, tone: 'good', cost, smoke };
  return { ok: true, text: `Wzmocnienie · siła ${p}`, tone: 'plain', cost, smoke };
}
const TONE = { good: T.me, fight: T.warn, plain: T.text, off: T.muted };
const NO_TARGET: Target = { ok: false, text: '', tone: 'off', cost: 0 };

function Pill({ t }: { t: Target }) {
  return (
    <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-bold whitespace-nowrap pointer-events-none"
      style={{ background: TONE[t.tone], color: '#07080b', boxShadow: `0 0 18px ${TONE[t.tone]}66` }}>
      {t.cost < 0 ? 'zwalnia rozkaz'
        : t.smoke ? <><Wind className="w-4 h-4" />Smoke: bez rozkazu</>
        : t.cost === 0 ? 'bez kosztu: dołącza do grupy'
        : <>koszt {Array.from({ length: t.cost }, (_, k) => <Gem key={k} size={10} />)}</>}
    </motion.span>
  );
}

// ── Board areas ─────────────────────────────────────────────────────────────

interface AreaCtx {
  s: OState; sel: string[]; bumps: Record<string, { v: number; key: number }>; hidden: Set<string>; settled: Set<string>;
  pressUnit: (e: React.PointerEvent, u: OUnit) => void;
}

function unitFigure(u: OUnit, w: number, a: AreaCtx) {
  const { s } = a;
  const defending = u.loc !== 'base' && s.objectives[u.loc as number]?.owner === u.side;
  const m = might(s, u, defending);
  const mine = s.active === 0 && s.winner === null && u.side === 0;
  const ready = mine && s.phase === 'move' && !u.fresh;
  const smoke = mine && s.phase === 'move' && !u.moved && !u.fresh && smokeCovers(s, [u.uid]);
  const parts = u.side === 0 ? strengthParts(s, u, defending) : undefined;
  const note = u.side === s.active && u.fresh ? 'Wystawiony w tej turze: ruszy się w następnej.' : u.wounded ? 'Ranny: −1 siły, wyleczy się na początku tury w bazie.' : undefined;
  const settle = a.settled.has(u.uid);
  return (
    <Figure key={u.uid} layoutId={settle ? undefined : u.uid} settle={settle} card={u.card} m={m} side={u.side} w={w} parts={parts} smoke={smoke}
      bump={a.bumps[u.uid] ?? null} selected={a.sel.includes(u.uid)} tired={u.side === s.active && u.fresh} planned={u.side === s.active && u.moved && s.phase === 'move'} glow={ready && !u.moved && !a.sel.length && !smoke} ghost={a.hidden.has(u.uid)}
      onPointerDown={ready ? e => a.pressUnit(e, u) : undefined} dataId={u.uid}
      grow={u.loc === 'base' ? (u.side === 1 ? 'down' : 'up') : u.side === 1 ? 'down' : 'up'}
      info={{ parts: parts ?? strengthParts(s, u, defending), showParts: u.side === 0 && hasBuffs(parts), note }} />
  );
}

/** The arena background: the minimap, centred on where the objective really is */
function Arena({ id }: { id: ObjId }) {
  const [ref, box] = useSize<HTMLDivElement>();
  const D = box.w / MAP_VIEW;
  // Keep the view inside the drawn map (the image has a black border): objectives near the edge sit off-centre instead
  const clamp = (v: number, half: number) => Math.min(MAP_EDGE[1] - half, Math.max(MAP_EDGE[0] + half, v));
  const x = clamp(MAP_AT[id][0], MAP_VIEW / 2); const y = clamp(MAP_AT[id][1], box.h / D / 2 || 0);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      {box.w > 0 && <div className="absolute inset-0" style={{ backgroundImage: 'url(/stats-lab/minimap-741.webp)', backgroundSize: `${D}px ${D}px`, backgroundPosition: `${box.w / 2 - x * D}px ${box.h / 2 - y * D}px`, filter: 'saturate(0.9) brightness(0.62)' }} />}
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${T.bg}, transparent 12%, transparent 88%, ${T.bg}), linear-gradient(180deg, ${T.bg}, transparent 10%, transparent 90%, ${T.bg})` }} />
    </div>
  );
}

/** A free place on an objective (max 3 per side) */
function Slot({ w, side, tour }: { w: number; side: Side; tour?: boolean }) {
  return <div data-tour={tour ? 'slots' : undefined} className="shrink-0 rounded-[12px]" style={{ width: w, height: Math.round(w * 1.34), border: `1.5px dashed rgba(255,255,255,${side === 0 ? 0.3 : 0.2})` }} />;
}

function Objective({ i, a, target, onSend, rowRef, w }: { i: 0 | 1 | 2; a: AreaCtx; target: Target | null; onSend: () => void; rowRef?: React.Ref<HTMLDivElement>; w: number }) {
  const font = useHeaderFont();
  const { s } = a;
  const ob = s.objectives[i]; const def = OBJECTIVES[ob.id];
  const units = (side: Side) => s.units.filter(u => u.side === side && u.loc === i);
  const mineHere = units(0);
  const smokeHere = s.active === 0 && s.phase === 'move' && mineHere.some(u => !u.moved && !u.fresh && smokeCovers(s, [u.uid]));
  const auraHere = mineHere.some(u => u.card.role === 'Hard Support');
  const off = target && !target.ok;
  return (
    <div data-drop={i} data-obj={i} onClick={() => target?.ok && onSend()} className="relative flex-1 min-w-0 flex flex-col"
      style={{ filter: off ? 'grayscale(1) brightness(0.45)' : undefined, transition: 'filter .2s', cursor: target?.ok ? 'pointer' : undefined }}>
      <Arena id={ob.id} />
      {ob.owner != null && <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 50% at 50% ${ob.owner === 0 ? 80 : 20}%, ${sideColor(ob.owner)}30, transparent 70%)` }} />}
      {target?.ok && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${TONE[target.tone]}99`, background: `${TONE[target.tone]}14` }} />}
      <div ref={rowRef} className="relative flex-1 min-h-0 flex justify-center items-end gap-[10px] pb-2">
        {ob.id === 'highground' && ob.owner === 1 && units(1).length > 0 && <HgFx w={w} />}
        <EffectChips items={effectsAt(s, i, 1)} side={1} />
        <AnimatePresence>{units(1).map(u => unitFigure(u, w, a))}</AnimatePresence>
        {Array.from({ length: PER_SIDE_AT_OBJECTIVE - units(1).length }, (_, k) => <Slot key={k} w={w} side={1} />)}
      </div>
      <div className="relative text-center px-3 py-1 pointer-events-none">
        <div className="flex items-center justify-center gap-4">
          {/* The objective's own model from the game, beside its name and rules */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={objModel(ob.id)} alt="" className="h-[92px] w-[92px] shrink-0 object-contain -my-3" style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.9))' }} />
          <div className="text-left">
            <div className="font-logik-extended-bold uppercase text-[23px] leading-none" style={{ color: ob.owner == null ? T.text : sideColor(ob.owner), textShadow: '0 2px 10px #000', ...font }}>{def.name}</div>
            <div className="text-[13px] mt-1" style={{ color: T.text, textShadow: '0 1px 6px #000' }}>{def.rule}</div>
            <div className="flex gap-4 mt-1 text-[12px] font-bold uppercase tracking-wider pointer-events-auto" style={{ color: T.pts, textShadow: '0 1px 6px #000' }}>
              <Tip content="Gdy wejdziesz na objective, który nie jest Twój (jeśli ktoś na nim stoi, najpierw wygraj walkę)"><span className="cursor-help">przejęcie +{takePoints(ob.id)} pkt</span></Tip>
              <Tip content="Na początku Twojej tury: +1 pkt za każdy Twój objective, na którym stoi Twoja jednostka"><span className="cursor-help">trzymanie +1 pkt/turę</span></Tip>
            </div>
          </div>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 flex justify-center items-start gap-[10px] pt-2">
        {auraHere && <AuraFx />}
        {smokeHere && <SmokeFx />}
        {ob.id === 'highground' && ob.owner === 0 && mineHere.length > 0 && <HgFx w={w} />}
        <EffectChips items={effectsAt(s, i, 0)} side={0} />
        <AnimatePresence>{mineHere.map(u => unitFigure(u, w, a))}</AnimatePresence>
        {Array.from({ length: PER_SIDE_AT_OBJECTIVE - mineHere.length }, (_, k) => <Slot key={k} w={w} side={0} tour={i === 0 && k === 0} />)}
      </div>
      {target && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center z-20 px-3 pointer-events-none">
          {target.ok ? <Pill t={target} /> : <span className="text-center text-[12px] leading-snug font-bold" style={{ color: T.text, textShadow: '0 1px 4px #000' }}>{target.text}</span>}
        </div>
      )}
    </div>
  );
}

function BaseBand({ side, a, target, onSend, deployN }: { side: Side; a: AreaCtx; target?: Target | null; onSend?: () => void; deployN?: number }) {
  const font = useHeaderFont();
  const { s } = a;
  const units = s.units.filter(u => u.side === side && u.loc === 'base');
  const line: React.CSSProperties = side === 0 ? { top: 0 } : { bottom: 0 };
  const smokeHere = side === 0 && s.active === 0 && s.phase === 'move' && units.some(u => !u.moved && !u.fresh && smokeCovers(s, [u.uid]));
  const off = target && !target.ok;
  return (
    <div data-drop={side === 0 ? 'base' : undefined} data-tour={side === 0 ? 'base' : undefined} onClick={() => target?.ok && onSend?.()}
      className="relative h-[118px] shrink-0 flex items-center gap-3 px-6"
      style={{ background: `linear-gradient(90deg, ${sideColor(side)}${target?.ok ? '33' : '1a'}, transparent 60%)`, filter: off ? 'grayscale(1) brightness(0.45)' : undefined, transition: 'background .2s, filter .2s', cursor: target?.ok ? 'pointer' : undefined }}>
      <div className="absolute inset-x-0 h-px" style={{ ...line, background: `linear-gradient(90deg, ${sideColor(side)}66, transparent 70%)` }} />
      {target?.ok && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${TONE[target.tone]}99` }} />}
      <span className="font-logik-extended-bold uppercase text-[13px] tracking-[0.18em] w-[96px] shrink-0 leading-tight" style={{ color: sideColor(side), ...font }}>{side === 0 ? 'Twoja baza' : 'Baza rywala'}</span>
      <div className="relative flex items-center gap-3">
        {smokeHere && <SmokeFx />}
        {smokeHere && <EffectChips items={effectsAt(s, 'base', 0)} side={0} />}
        <AnimatePresence>{units.map(u => unitFigure(u, 80, a))}</AnimatePresence>
      </div>
      {deployN ? (
        <motion.div className="absolute inset-0 flex items-center justify-center gap-4 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.span className="font-logik-extended-bold uppercase text-[26px]" style={{ color: '#fff', textShadow: `0 0 18px ${T.me}, 0 2px 6px #000`, ...font }}
            animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
            Kliknij tutaj: wystaw {deployN} {deployN === 1 ? 'kartę' : deployN < 5 ? 'karty' : 'kart'}
          </motion.span>
          <span className="flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-bold" style={{ background: 'rgba(0,0,0,0.55)', color: T.text }}>
            koszt {Array.from({ length: deployN }, (_, k) => <Gem key={k} size={12} />)}
          </span>
        </motion.div>
      ) : target?.ok ? <div className="ml-auto pointer-events-none"><Pill t={target} /></div> : null}
    </div>
  );
}

function ScoreRace({ shown, win }: { shown: [number, number]; win: number }) {
  const font = useHeaderFont();
  const pips = (side: Side) => Array.from({ length: win }, (_, i) => {
    const lit = i < shown[side];
    return <span key={i} className="h-[10px] flex-1 rounded-full transition-all duration-500" style={{ background: lit ? sideColor(side) : T.faint, boxShadow: lit ? `0 0 8px ${sideColor(side)}` : undefined }} />;
  });
  return (
    <div data-tour="score" className="flex items-center gap-4 w-[760px]">
      <span data-score={0} className="font-logik-extended-bold text-[34px] w-12 text-right tabular-nums" style={{ color: T.me, ...font }}>{shown[0]}</span>
      <div className="flex-1 flex gap-1">{pips(0)}</div>
      <div className="text-center leading-none">
        <div className="font-logik-extended-bold text-[22px]" style={{ color: T.text, ...font }}>{win}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] mt-0.5" style={{ color: T.muted }}>pkt wygrywa</div>
      </div>
      <div className="flex-1 flex gap-1 flex-row-reverse">{pips(1)}</div>
      <span data-score={1} className="font-logik-extended-bold text-[34px] w-12 tabular-nums" style={{ color: T.rival, ...font }}>{shown[1]}</span>
    </div>
  );
}

// ── Combat log (icons and colours, little text) ─────────────────────────────

function Mini({ c, dead }: { c: GCard; dead?: boolean }) {
  return (
    <Tip content={<CardInfo card={c} m={baseMight(c)} parts={[{ kind: 'card', label: 'Karta', v: cardStrength(c) }]} />}>
      <span className="inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-0.5 cursor-help" style={{ background: 'rgba(255,255,255,0.06)', filter: dead ? 'grayscale(1) brightness(0.65)' : undefined }}>
        <span className="relative"><Avatar player={c.player} size={22} />{dead && <Skull className="absolute -right-1 -bottom-1 w-3.5 h-3.5" style={{ color: T.neg }} />}</span>
        <span className="font-bold text-[12px]" style={{ textDecoration: dead ? 'line-through' : undefined }}>{c.name}</span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: ACC_L }}>{KEYWORD[c.role].name}</span>
      </span>
    </Tip>
  );
}
/** An action icon that says what it means on hover */
function Act({ tip, children }: { tip: string; children: React.ReactNode }) {
  return <Tip content={tip}><span className="inline-flex cursor-help">{children}</span></Tip>;
}
function ObjTag({ s, at }: { s: OState; at: Loc }) {
  if (at === 'base') return <span className="inline-flex items-center gap-1" style={{ color: T.muted }}><Home className="w-4 h-4" />baza</span>;
  const d = OBJECTIVES[s.objectives[at].id];
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="inline-flex items-center gap-1.5 font-bold"><img src={objModel(s.objectives[at as number].id)} alt="" className="w-[30px] h-[30px] object-contain" />{d.name}</span>;
}
function EvRow({ s, e }: { s: OState; e: Ev }) {
  const font = useHeaderFont();
  const c = sideColor(e.side);
  switch (e.kind) {
    case 'turn': return null;
    case 'deploy':
      return <div className="flex items-center gap-2 flex-wrap"><Act tip="Wystawienie kart z ręki do bazy"><Plus className="w-4 h-4" style={{ color: c }} /></Act>{e.cards.map(x => <Mini key={x.id} c={x} />)}<ArrowRight className="w-4 h-4 opacity-50" /><ObjTag s={s} at="base" /></div>;
    case 'move':
      return <div className="flex items-center gap-2 flex-wrap"><Act tip={e.free ? 'Ruch bez rozkazu (soft support w grupie)' : 'Ruch grupy (1 rozkaz)'}>{e.free ? <Wind className="w-4 h-4" style={{ color: T.smoke }} /> : <ArrowRight className="w-4 h-4" style={{ color: c }} />}</Act>{e.cards.map(x => <Mini key={x.id} c={x} />)}<ObjTag s={s} at={e.from} /><ArrowRight className="w-4 h-4 opacity-50" /><ObjTag s={s} at={e.to} /></div>;
    case 'fight':
      return (
        <div className="flex items-center gap-2">
          <Act tip="Walka: siła atakujących kontra siła obrońców; czaszka = poległy"><Swords className="w-4 h-4" style={{ color: T.warn }} /></Act><ObjTag s={s} at={e.at} />
          <span className="font-logik-extended-bold text-[16px] tabular-nums" style={font}><span style={{ color: T.me }}>{e.power[0]}</span><span className="opacity-40"> : </span><span style={{ color: T.rival }}>{e.power[1]}</span></span>
          {e.died.length > 0 && <span className="flex gap-1 ml-1">{e.died.map(d => <Mini key={d.card.id + d.side} c={d.card} dead />)}</span>}
        </div>
      );
    case 'points':
      return <div className="flex items-center gap-2"><Act tip={e.why === 'take' ? 'Przejęcie objective\'u' : 'Trzymanie objective\'u na początku tury'}>{e.why === 'take' ? <Flag className="w-4 h-4" style={{ color: c }} /> : <Shield className="w-4 h-4" style={{ color: c }} />}</Act><ObjTag s={s} at={e.at} /><span className="font-logik-extended-bold" style={{ color: T.pts, ...font }}>+{e.pts}</span></div>;
  }
}
function CombatLog({ s, onClose }: { s: OState; onClose: () => void }) {
  const font = useHeaderFont();
  // Group by turn, newest first
  const turns: Array<{ side: Side; turn: number; evs: Ev[] }> = [];
  for (const e of s.events) {
    if (e.kind === 'turn') turns.push({ side: e.side, turn: e.turn, evs: [] });
    else turns[turns.length - 1]?.evs.push(e);
  }
  return (
    <motion.div className="absolute inset-0 z-[55] flex justify-center pt-16" style={{ background: 'rgba(5,6,9,0.6)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-[860px] max-h-[78%] overflow-y-auto rounded-[22px] px-7 py-5" style={{ background: '#11131a', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}
        initial={{ y: -30 }} animate={{ y: 0 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <ScrollText className="w-5 h-5" style={{ color: ACC_L }} />
          <span className="font-logik-extended-bold uppercase text-[20px]" style={font}>Przebieg meczu</span>
          <span className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Zamknij" className="opacity-60 hover:opacity-100"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex flex-col gap-3 text-[13px]">
          {[...turns].reverse().filter(t => t.evs.length).map(t => (
            <div key={t.turn} className="flex gap-4">
              <div className="w-[70px] shrink-0 pt-1">
                <div className="font-logik-extended-bold text-[13px] uppercase" style={{ color: sideColor(t.side), ...font }}>{t.side === 0 ? 'Ty' : 'Rywal'}</div>
                <div className="text-[11px]" style={{ color: T.muted }}>tura {Math.ceil(t.turn / 2)}</div>
              </div>
              <div className="flex-1 flex flex-col gap-1.5 pl-4" style={{ borderLeft: `2px solid ${sideColor(t.side)}55` }}>{t.evs.map((e, i) => <EvRow key={i} s={s} e={e} />)}</div>
            </div>
          ))}
          {!turns.some(t => t.evs.length) && <div style={{ color: T.muted }}>Jeszcze nic się nie wydarzyło.</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── The battle: one attack at a time, the attacker first ──────────────────────

type Pt = { x: number; y: number; w: number; h: number };
const BW = 148;

/**
 * One fight, played hit by hit. On your turn: click one of your units that has not attacked yet, then
 * an enemy (a line follows the pointer). The rival answers with one attack of its own. Damage stays
 * until the fight ends (the bar under each card). `onDone` gets every attack, to replay in the rules.
 */
function BattleScreen({ s, at, level, onDone }: { s: OState; at: 0 | 1 | 2; level: Level; onDone: (script: Attack[]) => void }) {
  const font = useHeaderFont();
  const fit = useFitScale();
  const [duel, setDuel] = useState<Duel>(() => startDuel(s, at));
  const [picked, setPicked] = useState<string | null>(null);
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const [hit, setHit] = useState<{ a: Attack; dmg: number; key: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<Record<string, Pt>>({});
  const area = useRef<HTMLDivElement>(null);
  const ob = s.objectives[at]; const def = OBJECTIVES[ob.id];
  const attacking = s.active === 0;
  const over = duelOver(duel);
  const myTurn = !over && !busy && duel.turn === 0;
  const legal = useMemo(() => duelTargets(duel, 0).map(u => u.uid), [duel]);

  const measure = useCallback(() => {
    const box = area.current?.getBoundingClientRect(); if (!box) return;
    const out: Record<string, Pt> = {};
    area.current!.querySelectorAll<HTMLElement>('[data-bu]').forEach(el => {
      const r = el.getBoundingClientRect();
      out[el.dataset.bu!] = { x: (r.left - box.left) / fit, y: (r.top - box.top) / fit, w: r.width / fit, h: r.height / fit };
    });
    setPos(out);
  }, [fit]);
  useLayoutEffect(() => { measure(); const t = setTimeout(measure, 450); return () => clearTimeout(t); }, [measure]);

  // An attack: the arrow flies, the hit lands, then the next side moves
  const attack = (a: Attack) => {
    const dmg = duel.units.find(u => u.uid === a.from)!.m;
    setPicked(null); setPtr(null); setBusy(true); setHit({ a, dmg, key: Date.now() });
    setTimeout(() => { setDuel(d => duelAct(d, a)); setBusy(false); }, 750);
  };
  // The rival's turn
  useEffect(() => {
    if (over || busy || duel.turn !== 1) return;
    const t = setTimeout(() => attack(chooseAttack(duel, level)), 800);
    return () => clearTimeout(t);
  }, [duel, busy, over]); // eslint-disable-line react-hooks/exhaustive-deps

  const local = (e: React.PointerEvent) => { const box = area.current!.getBoundingClientRect(); return { x: (e.clientX - box.left) / fit, y: (e.clientY - box.top) / fit }; };
  const unit = (uid: string) => duel.units.find(u => u.uid === uid)!;
  const centre = (uid: string, edge: 'top' | 'bottom') => { const p = pos[uid]; return p ? { x: p.x + p.w / 2, y: edge === 'top' ? p.y - 4 : p.y + p.h + 4 } : null; };

  const card = (du: DuelUnit) => {
    const u = s.units.find(x => x.uid === du.uid)!;
    const enemy = du.side === 1;
    const dead = du.hp <= 0;
    const canPick = myTurn && !enemy && !dead && !du.acted;
    const canHit = myTurn && enemy && !!picked && legal.includes(du.uid);
    const struck = hit && hit.a.to === du.uid;
    const striking = hit && hit.a.from === du.uid;
    const lunge = striking ? (du.side === 0 ? -40 : 40) : 0;
    return (
      <motion.div key={du.uid} data-bu={du.uid} className={`relative ${canPick || canHit ? '[&_*]:!cursor-pointer !cursor-pointer' : ''}`}
        // Pointer, not click: the card inside stops click events
        onPointerUp={() => { if (canPick) setPicked(p => (p === du.uid ? null : du.uid)); else if (canHit && picked) attack({ from: picked, to: du.uid }); }}
        animate={{ y: lunge, x: struck ? [0, -12, 12, -7, 0] : 0, opacity: dead ? 0.28 : du.acted && !striking ? 0.7 : 1, filter: dead ? 'grayscale(1) brightness(0.55)' : 'none', scale: canHit ? 1.04 : 1 }}
        transition={{ duration: striking ? 0.3 : 0.35 }}>
        <Figure card={u.card} m={du.m} side={du.side} w={BW} selected={picked === du.uid} glow={canPick && !picked || canHit} tired={du.acted && !dead} />
        {du.tank && !dead && (
          <Tip content="Zanim zaatakujesz kogoś innego, Offlane musi zostać zabity">
            <span className="absolute -right-3 -top-3 z-20 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#0b0c12', boxShadow: `0 0 0 2px ${sideColor(du.side)}` }}><Shield className="w-5 h-5" style={{ color: sideColor(du.side) }} /></span>
          </Tip>
        )}
        {/* Health left in this fight */}
        <div className="absolute left-2 right-2 -bottom-3 h-[7px] rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.7)', boxShadow: '0 0 0 1px rgba(255,255,255,0.15)' }}>
          <motion.div className="h-full" style={{ background: sideColor(du.side) }} animate={{ width: `${Math.max(0, du.hp) / du.m * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
        {du.acted && !dead && <span className="absolute left-1/2 -translate-x-1/2 -bottom-9 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: T.muted }}>uderzył</span>}
        <AnimatePresence>
          {struck && (
            <motion.span key={hit!.key} className="absolute left-1/2 -translate-x-1/2 top-8 font-logik-extended-bold text-[40px] z-20 pointer-events-none" style={{ color: '#ff6b5b', textShadow: '0 0 12px #000, 0 2px 4px #000', ...font }}
              initial={{ scale: 0.3, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.3, duration: 0.25 }}>−{hit!.dmg}</motion.span>
          )}
        </AnimatePresence>
        {struck && <motion.div className="absolute inset-0 rounded-[14px] pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ delay: 0.3, duration: 0.5 }} style={{ background: 'rgba(255,60,40,0.6)' }} />}
        {dead && (
          <motion.div className="absolute inset-0 rounded-[14px] pointer-events-none overflow-hidden" initial={{ opacity: 1 }} animate={{ opacity: 0.6 }}>
            <motion.div className="absolute inset-x-0 bottom-0" style={{ background: 'linear-gradient(0deg, #ff3d00, #ff9100cc 40%, #ffd60033 75%, transparent)', mixBlendMode: 'screen' }}
              initial={{ height: '0%' }} animate={{ height: ['0%', '110%', '110%'], opacity: [1, 1, 0.3] }} transition={{ duration: 0.9 }} />
            <Skull className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-white/80" />
          </motion.div>
        )}
      </motion.div>
    );
  };

  const outcome = over ? (() => {
    const left = duel.units.some(u => u.side === duel.attacker && u.hp > 0); const stay = duel.units.some(u => u.side !== duel.attacker && u.hp > 0);
    return left && !stay ? 'took' : left && stay ? 'repelled' : stay ? 'held' : 'wiped';
  })() : null;
  const outcomeText = outcome === 'took' ? (attacking ? 'Przejmujesz objective' : 'Rywal przejmuje objective')
    : outcome === 'held' ? (attacking ? 'Obrona rywala wytrzymała' : 'Twoja obrona wytrzymała')
    : outcome === 'repelled' ? (attacking ? 'Przeżyli obaj: wracasz do bazy' : 'Przeżyli obaj: rywal wraca do bazy') : 'Remis: polegli wszyscy';
  const good = (outcome === 'took' && attacking) || ((outcome === 'held' || outcome === 'repelled') && !attacking);
  const from = hit ? centre(hit.a.from, unit(hit.a.from).side === 0 ? 'top' : 'bottom') : null;
  const to = hit ? centre(hit.a.to, unit(hit.a.to).side === 0 ? 'top' : 'bottom') : null;
  const pick0 = picked ? centre(picked, 'top') : null;

  return (
    <motion.div className="absolute inset-0 z-[95] flex flex-col items-center justify-center gap-4"
      style={{ background: 'radial-gradient(circle at 50% 50%, rgba(40,20,14,0.9), rgba(5,6,9,0.95) 70%)', backdropFilter: 'blur(5px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onPointerMove={picked ? e => setPtr(local(e)) : undefined}>
      <motion.div className="flex items-center gap-3" initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={objModel(ob.id)} alt="" className="w-[84px] h-[84px] object-contain -my-5" style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.8))' }} />
        <span className="font-logik-extended-bold uppercase text-[32px]" style={{ color: T.text, ...font }}>{attacking ? 'Atakujesz' : 'Rywal atakuje'}: {def.name}</span>
      </motion.div>
      <div className="text-[14px]" style={{ color: T.muted }}>Uderzacie na zmianę, jedna jednostka naraz, zaczyna atakujący. Walka trwa, aż jedna strona padnie.</div>
      <div className="h-[30px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.div key={over ? 'o' : myTurn ? (picked ? 'p' : 'm') : 'r'} className="font-logik-extended-bold uppercase text-[18px] tracking-wider"
            style={{ color: over ? T.text : myTurn ? T.me : T.rival, ...font }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {duel.round > 1 && !over ? `Runda ${duel.round} · ` : ''}{over ? 'Koniec walki' : myTurn ? (picked ? 'Teraz kliknij cel rywala' : 'Twój ruch: kliknij swoją jednostkę') : duel.turn === 0 ? '…' : 'Ruch rywala…'}
          </motion.div>
        </AnimatePresence>
      </div>

      <div ref={area} className="relative flex flex-col items-center gap-[150px] py-6 px-10">
        <div className="flex gap-8">{duel.units.filter(u => u.side === 1).map(card)}</div>
        <div className="flex gap-8">{duel.units.filter(u => u.side === 0).map(card)}</div>
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          <defs>
            {([0, 1] as Side[]).map(sd => (
              <marker key={sd} id={`bh${sd}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={sideColor(sd)} />
              </marker>
            ))}
          </defs>
          {/* The attack being made */}
          {hit && from && to && (
            <motion.path key={hit.key} d={`M${from.x},${from.y} C${from.x},${(from.y + to.y) / 2} ${to.x},${(from.y + to.y) / 2} ${to.x},${to.y}`} fill="none"
              stroke={sideColor(unit(hit.a.from).side)} strokeWidth={6} strokeLinecap="round" markerEnd={`url(#bh${unit(hit.a.from).side})`}
              style={{ filter: `drop-shadow(0 0 8px ${sideColor(unit(hit.a.from).side)})` }}
              initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0] }} transition={{ duration: 0.75, times: [0, 0.6, 1] }} />
          )}
          {/* Your aim: a line from the picked unit to the pointer */}
          {picked && ptr && pick0 && (
            <path d={`M${pick0.x},${pick0.y} L${ptr.x},${ptr.y}`} stroke={T.me} strokeWidth={4} strokeDasharray="8 8" fill="none" markerEnd="url(#bh0)" />
          )}
        </svg>
      </div>

      <div className="h-[44px] flex items-center justify-center">
        {over && (
          <motion.div className="font-logik-extended-bold uppercase text-[30px]" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ color: outcome === 'wiped' ? T.text : good ? T.me : T.rival, textShadow: `0 0 24px ${outcome === 'wiped' ? T.muted : good ? T.me : T.rival}`, ...font }}>
            {outcomeText}{outcome === 'took' && duel.stake ? ` · +${duel.stake} pkt` : ''}
          </motion.div>
        )}
      </div>
      <div className="h-[52px] flex items-center gap-4">
        {over && (
          <motion.button type="button" onClick={() => onDone(duel.log.map(({ from: f, to: t }) => ({ from: f, to: t })))} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
            className="rounded-full px-10 py-3 font-logik-extended-bold uppercase tracking-widest text-[16px] text-white" style={{ background: ACC, boxShadow: `0 0 26px ${mix(ACC, 60)}`, ...font }}>Dalej</motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── The end ─────────────────────────────────────────────────────────────────

function EndScreen({ won, score, turns, rival, onRematch, onNew, onExit }: { won: boolean; score: [number, number]; turns: number; rival: string; onRematch: () => void; onNew: () => void; onExit?: () => void }) {
  const font = useHeaderFont();
  const color = won ? T.me : T.rival;
  const word = won ? 'Zwycięstwo' : 'Porażka';
  const parts = useMemo(() => Array.from({ length: 70 }, (_, i) => { const a = (i / 70) * Math.PI * 2 + Math.random() * 0.2; const r = 260 + Math.random() * 520; return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 4 + Math.random() * 8, d: Math.random() * 0.3 }; }), []);
  return (
    <motion.div className="absolute inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ background: won ? 'radial-gradient(circle, rgba(10,30,18,0.92), rgba(4,6,8,0.97) 70%)' : 'radial-gradient(circle, rgba(40,8,8,0.92), rgba(4,4,6,0.97) 70%)' }}>
      {/* Light rays */}
      <motion.div className="absolute left-1/2 top-1/2 w-[2600px] h-[2600px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ background: `repeating-conic-gradient(${color}${won ? '2e' : '18'} 0deg 7deg, transparent 7deg 18deg)`, maskImage: 'radial-gradient(circle, black 10%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 55%)' }}
        initial={{ scale: 0.2, rotate: 0, opacity: 0 }} animate={{ scale: 1, rotate: won ? 40 : -15, opacity: 1 }} transition={{ duration: won ? 6 : 4, ease: 'easeOut' }} />
      {/* Burst (victory) / falling ash (defeat) */}
      {parts.map((p, i) => won ? (
        <motion.span key={i} className="absolute left-1/2 top-1/2 rounded-full pointer-events-none" style={{ width: p.s, height: p.s, background: i % 3 ? color : T.pts, boxShadow: `0 0 10px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1.2 }} animate={{ x: p.x, y: p.y + 120, opacity: 0, scale: 0.4 }} transition={{ duration: 1.8 + p.d * 2, delay: 0.25 + p.d, ease: [0.1, 0.8, 0.3, 1] }} />
      ) : (
        <motion.span key={i} className="absolute top-0 rounded-full pointer-events-none" style={{ left: `${(i * 37) % 100}%`, width: p.s * 0.6, height: p.s * 0.6, background: 'rgba(160,150,140,0.7)' }}
          initial={{ y: -20, opacity: 0 }} animate={{ y: 980, opacity: [0, 0.8, 0] }} transition={{ duration: 4 + p.d * 6, delay: p.d * 3, repeat: Infinity }} />
      ))}
      <motion.div className="relative flex" initial={{ scale: 2.4, filter: 'blur(14px)' }} animate={{ scale: 1, filter: 'blur(0px)', x: [0, -12, 10, -6, 0] }} transition={{ duration: 0.7, x: { delay: 0.5, duration: 0.4 } }}>
        {word.split('').map((ch, i) => (
          <motion.span key={i} className="font-logik-extended-bold uppercase text-[120px] leading-none" style={{ color, textShadow: `0 0 50px ${color}, 0 0 120px ${color}88, 0 6px 20px #000`, ...font }}
            initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 260, damping: 14 }}>{ch}</motion.span>
        ))}
      </motion.div>
      <motion.div className="relative mt-5 font-logik-extended-bold uppercase tracking-[0.2em] text-[18px]" style={{ color: T.text, ...font }} initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ delay: 0.9 }}>
        vs {rival}
      </motion.div>
      <motion.div className="relative mt-2 font-logik-extended-bold text-[44px] tabular-nums" style={{ color: T.text, ...font }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
        <span style={{ color: T.me }}>{score[0]}</span><span className="opacity-40"> : </span><span style={{ color: T.rival }}>{score[1]}</span>
        <span className="text-[16px] ml-4 align-middle" style={{ color: T.muted }}>po {turns} turach</span>
      </motion.div>
      <motion.div className="relative flex gap-4 mt-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }}>
        <motion.button type="button" onClick={onRematch} whileHover={{ scale: 1.05 }} className="rounded-full px-9 py-3.5 font-logik-extended-bold uppercase tracking-widest text-white" style={{ background: ACC, boxShadow: `0 0 30px ${mix(ACC, 60)}`, ...font }}>Rewanż</motion.button>
        <motion.button type="button" onClick={onNew} whileHover={{ scale: 1.05 }} className="rounded-full px-9 py-3.5 font-logik-extended-bold uppercase tracking-widest text-white" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)', ...font }}>Nowy rywal</motion.button>
        {onExit && <motion.button type="button" onClick={onExit} whileHover={{ scale: 1.05 }} className="flex items-center gap-2 rounded-full px-9 py-3.5 font-logik-extended-bold uppercase tracking-widest text-white" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)', ...font }}><Home className="w-5 h-5" />Wyjdź</motion.button>}
      </motion.div>
    </motion.div>
  );
}

// ── The game ─────────────────────────────────────────────────────────────────

const TOUR_KEY = 'karty:tour-seen';
const HINTS_KEY = 'karty:hints';
/** A few short points instead of a paragraph */
const pts = (...items: React.ReactNode[]) => (
  <ul className="flex flex-col gap-1.5">
    {items.map((x, i) => <li key={i} className="flex gap-2"><span className="mt-[8px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACC_L }} /><span>{x}</span></li>)}
  </ul>
);
const TOUR: TourStep[] = [
  { target: '[data-tour="score"]', title: 'Cel gry', text: pts(<>Pierwszy do <b>10 punktów</b> wygrywa.</>, <><b>+1</b> za przejęcie objective&apos;u (Roshan <b>+2</b>).</>, <><b>+1</b> na początku Twojej tury za każdy objective, na którym stoisz.</>) },
  { target: '[data-tour="objectives"]', title: 'Objective\'y', text: pts('Trzy miejsca z mapy, każde z własną zasadą (pod nazwą).', 'Na dole stają Twoje jednostki, na górze rywala.', <>Maks. <b>3</b> Twoje jednostki na objectivie.</>) },
  { target: '[data-tour="hand"]', title: 'Twoje karty', text: pts(<>Liczba w rogu to <b>siła</b>.</>, 'Pod nazwą pozycja: Carry, Mid, Offlane, Support, Hard Supp.', <>Każda pozycja ma <b>umiejętność</b>: najedź na kartę, żeby ją odwrócić.</>, <><b>Drużyna:</b> gracze z tej samej drużyny na jednym objectivie dostają po <b>+1 siły</b>.</>) },
  { target: '[data-tour="orders"]', title: 'Rozkazy', text: pts(<><b>3 rozkazy</b> na turę, na wszystko.</>, <>Karta z ręki: <b>1</b>. Ruch grupy: <b>1</b>.</>, 'Grupa = jednostki z jednego miejsca w to samo miejsce, także przeciągane po kolei.', 'Nie musisz wystawiać wszystkich kart: możesz zostawić rozkazy na ruchy.') },
  { target: '[data-tour="base"]', title: 'Baza', text: pts('Tu wystawiasz karty z ręki; ruszą w następnej turze.', 'Między objective\'ami idzie się przez bazę (prosto tylko Mid i z Twin Gates).', 'Każda jednostka może ruszyć się raz na turę.') },
  { target: '[data-tour="objectives"]', title: 'Walka', text: pts(<>Uderzacie <b>na zmianę</b>, jedna jednostka naraz; zaczyna atakujący.</>, <>Jednostka bije wybrany cel za <b>tyle, ile ma siły</b>.</>, 'Obrażenia zostają do końca walki; ginie ten, kto dostanie tyle, ile ma siły.', 'Offlane rywala musi zginąć, zanim zaatakujesz kogoś innego.', 'Gdy wszyscy uderzą, zaczyna się kolejna runda: walka trwa, aż jedna strona padnie.') },
  { target: '[data-tour="turn"]', title: 'Tura', text: pts(<><b>1.</b> Wystawiasz karty.</>, <><b>2.</b> Planujesz ruchy (możesz je zmieniać).</>, <><b>3.</b> Zatwierdzasz: walki i przejęcia dzieją się naraz.</>) },
  { target: '[data-tour="help"]', title: 'Pomoc i przebieg', text: pts('Znak zapytania: ten przewodnik jeszcze raz.', 'Ikona obok: przebieg meczu.') },
];

/** A seeded random (the tutorial is the same match every time) */
const seeded = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** `when` = it applies now; `done` = its action happened (counts only once the step has been shown);
 *  `expire` = too late for it (the game moved on) */
interface TutStep extends CoachStep { when: () => boolean; done?: () => boolean; expire?: () => boolean; seq?: boolean }

interface Flyer { id: string; side: Side; pts: number; why: Gain['why']; from: { x: number; y: number }; to: { x: number; y: number } }
interface DragState { kind: 'card' | 'units'; ids: string[] }

export function OutpostsGame({ deck, all, onBack, level = 'easy', visible = true }: { deck: GCard[]; all: GCard[]; onBack?: () => void; level?: Level; visible?: boolean }) {
  const font = useHeaderFont();
  const fit = useFitScale();
  const [cpu, setCpu] = useState<GCard[]>([]);
  const [s, setS] = useState<OState | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [selCards, setSelCards] = useState<string[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<{ text: string; side: Side; key: number } | null>(null);
  // The fights of this phase 3, one battle screen each; all choices go to resolve() at the end
  const [battleQ, setBattleQ] = useState<{ base: OState; locs: Array<0 | 1 | 2>; i: number; chosen: Partial<Record<0 | 1 | 2, Attack[]>> } | null>(null);
  const scene = battleQ;
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [owed, setOwed] = useState<[number, number]>([0, 0]);
  const [note, setNote] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [hoverTo, setHoverTo] = useState<Loc | null>(null);
  const hoverRef = useRef<Loc | null>(null);
  const [tour, setTour] = useState(false);
  // Hints shown once each (remembered in this browser)
  const [seenHints, setSeenHints] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(HINTS_KEY) || '[]')); } catch { return new Set(); } });
  const markHint = (id: string) => setSeenHints(prev => {
    if (prev.has(id)) return prev;
    const next = new Set(prev).add(id);
    try { localStorage.setItem(HINTS_KEY, JSON.stringify([...next])); } catch { /* private mode */ }
    return next;
  });
  const closeTour = () => { setTour(false); try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private mode */ } };
  // The walk-me runs by itself the first time (the tutorial has its own coach instead)
  useEffect(() => { if (level === 'tutorial') return; try { if (!localStorage.getItem(TOUR_KEY)) setTour(true); } catch { /* private mode */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, gx: 0, gy: 0, tilt: 0, lastX: 0 });
  const [objEl, setObjEl] = useState<HTMLDivElement | null>(null);
  const [objBox, setObjBox] = useState({ w: 400, h: 300 });
  const seenFight = useRef(0); const seenGain = useRef(0); const pendingGains = useRef<Gain[]>([]);
  const prevMight = useRef<Record<string, number>>({});
  const stateRef = useRef<OState | null>(null);
  stateRef.current = s;

  // The difficulty is fixed when a match starts (a rematch keeps the rival as it was)
  const [gameLevel, setGameLevel] = useState<Level>(level);
  const [tutDone, setTutDone] = useState<Set<string>>(new Set());
  const [tutOff, setTutOff] = useState(false);
  const tutReached = useRef<Set<string>>(new Set());
  const start = (rematch = false) => {
    const lv = rematch && cpu.length ? gameLevel : level;
    setGameLevel(lv);
    const theirs = rematch && cpu.length ? cpu : cpuDeck(all, OUTPOSTS_RULE, avgOvr(deck) - LEVELS[lv].deckGap, new Set(deck.map(c => c.pid)));
    seenFight.current = 0; seenGain.current = 0; pendingGains.current = []; prevMight.current = {};
    let g = newGame([deck, theirs]);
    if (lv === 'tutorial') {
      // The same short match every time: three simple objectives, an opening hand that shows the positions
      g = newGame([deck, theirs], seeded(7), 6);
      g.objectives = (['lotus', 'roshan', 'outpost'] as ObjId[]).map(id => ({ id, owner: null }));
      const pool = [...g.sides[0].hand, ...g.sides[0].deck];
      const hand = (['Carry', 'Mid', 'Offlane', 'Hard Support'] as RoleKey[]).map(r => pool.find(c => c.role === r)).filter((c): c is GCard => !!c);
      g.sides[0].hand = hand; g.sides[0].deck = pool.filter(c => !hand.includes(c));
    }
    setTutDone(new Set()); setTutOff(false); tutReached.current = new Set();
    setCpu(theirs); setS(g); setSel([]); setSelCards([]); setBattleQ(null); setFlyers([]); setOwed([0, 0]);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { start(); }, [deck]);

  useEffect(() => {
    if (!objEl) return;
    const ro = new ResizeObserver(() => setObjBox({ w: objEl.clientWidth, h: objEl.clientHeight }));
    ro.observe(objEl); return () => ro.disconnect();
  }, [objEl]);
  const figW = Math.max(60, Math.min(140, (objBox.w - 40) / PER_SIDE_AT_OBJECTIVE, (objBox.h - 14) / 1.34));

  // New fight → scene; new points → fly once the scene is over
  useEffect(() => {
    if (!s) return;
    seenFight.current = s.fightKey;
    if (s.gainKey !== seenGain.current) {
      seenGain.current = s.gainKey;
      pendingGains.current = [...pendingGains.current, ...s.gains];
      setOwed(o => { const n: [number, number] = [o[0], o[1]]; s.gains.forEach(g => { n[g.side] += g.pts; }); return n; });
    }
  }, [s]);
  useEffect(() => {
    if (scene || !pendingGains.current.length || !boardRef.current) return;
    const board = boardRef.current; const root = board.getBoundingClientRect();
    const local = (r: DOMRect) => ({ x: (r.left + r.width / 2 - root.left) / fit, y: (r.top + r.height / 2 - root.top) / fit });
    const gains = pendingGains.current; pendingGains.current = [];
    setFlyers(f => [...f, ...gains.map((g, i) => {
      const o = board.querySelector(`[data-obj="${g.at}"]`); const sc = board.querySelector(`[data-score="${g.side}"]`);
      return { id: `${Date.now()}-${i}`, side: g.side, pts: g.pts, why: g.why, from: o ? local(o.getBoundingClientRect()) : { x: 0, y: 0 }, to: sc ? local(sc.getBoundingClientRect()) : { x: 0, y: 0 } };
    })]);
  }, [scene, s, fit]);
  const landed = (f: Flyer) => { setFlyers(x => x.filter(y => y.id !== f.id)); setOwed(o => { const n: [number, number] = [o[0], o[1]]; n[f.side] = Math.max(0, n[f.side] - f.pts); return n; }); };

  // Strength went up → a "+N" pop on that card
  const bumps = useMemo(() => {
    const out: Record<string, { v: number; key: number }> = {};
    if (!s) return out;
    for (const u of s.units) {
      if (u.side !== 0) continue;
      const def = u.loc !== 'base' && s.objectives[u.loc as number]?.owner === u.side;
      const m = might(s, u, def); const before = prevMight.current[u.uid];
      if (before != null && m > before) out[u.uid] = { v: m - before, key: Date.now() };
    }
    return out;
  }, [s]);
  useEffect(() => {
    if (!s) return;
    const next: Record<string, number> = {};
    for (const u of s.units) { const def = u.loc !== 'base' && s.objectives[u.loc as number]?.owner === u.side; next[u.uid] = might(s, u, def); }
    prevMight.current = next;
  }, [s]);

  const active = s?.active; const turn = s?.turn; const over = s ? s.winner !== null : false;
  const showBanner = (text: string, side: Side) => setBanner({ text, side, key: Date.now() });
  useEffect(() => { if (active != null && !over) showBanner(active === 0 ? 'Twoja tura' : 'Tura rywala', active); }, [active, turn, over]);
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 1150); return () => clearTimeout(t); }, [banner]);

  // The computer: one action at a time, waiting for scenes and flying points
  useEffect(() => {
    if (!s || s.active !== 1 || s.winner !== null || s.phase === 'fight' || scene || flyers.length || banner || logOpen || tour) return;
    const t = setTimeout(() => { const a = cpuNextAction(s, Math.random, gameLevel); if (a) setS(applyAct(s, a)); else openBattles(s); }, 900);
    return () => clearTimeout(t);
  }, [s, scene, flyers.length, banner, logOpen, tour]);

  // Phase 3 played out (scenes and points done): the turn passes
  useEffect(() => {
    if (!s || s.phase !== 'fight' || s.winner !== null || scene || flyers.length || banner || logOpen) return;
    const t = setTimeout(() => { const cur = stateRef.current; if (cur?.phase === 'fight') { setS(endTurn(cur)); setSel([]); setSelCards([]); } }, 700);
    return () => clearTimeout(t);
  }, [s, scene, flyers.length, banner, logOpen]);

  // Nothing (more) to do: move on by itself. Running out shows a big banner saying why. With moves
  // planned it waits for the player to confirm them (they may still want to change something).
  const autoKey = useRef('');
  useEffect(() => {
    if (!s || s.active !== 0 || s.winner !== null || scene || flyers.length || tour || logOpen || banner) return;
    const asMove = s.phase === 'deploy' ? startOrders(s) : s;
    const hasMove = asMove.units.some(u => u.side === 0 && !u.moved && !u.fresh && (['base', 0, 1, 2] as Loc[]).some(l => !canMove(asMove, [u.uid], l)));
    const planned = s.units.some(u => u.side === 0 && u.moved);
    let next: 'orders' | 'end' | null = null; let why: string | null = null;
    if (s.phase === 'deploy' && (s.orders === 0 || !s.sides[0].hand.length)) {
      if (hasMove) next = 'orders';
      else { next = 'end'; why = s.orders === 0 ? 'Brak rozkazów' : 'Brak ruchów'; }
    } else if (s.phase === 'move' && !hasMove && !planned) { next = 'end'; why = s.orders === 0 ? 'Brak rozkazów' : 'Brak ruchów'; }
    if (!next) return;
    const key = `${s.turn}-${s.phase}-${next}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    if (why) showBanner(why, 0);
    const turnNow = s.turn;
    setTimeout(() => {
      const cur = stateRef.current; if (!cur || cur.active !== 0 || cur.winner !== null || cur.turn !== turnNow) return;
      setS(next === 'orders' ? startOrders(cur) : endTurn(cur)); setSel([]); setSelCards([]);
    }, why ? 1300 : 250);
  }, [s, scene, flyers.length, tour, logOpen, banner]);

  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 2600); return () => clearTimeout(t); }, [note]);
  const lastHint = useRef<string | null>(null);
  useEffect(() => { if (!settled.size) return; const t = setTimeout(() => setSettled(new Set()), 700); return () => clearTimeout(t); }, [settled]);

  // ── Phase 3: one battle screen per fight (you attacking or defending), then everything resolves ──
  const openBattles = (cur: OState) => {
    const locs = clashesOf(cur);
    if (!locs.length) { setS(resolve(cur)); return; }
    setSel([]); setSelCards([]);
    setBattleQ({ base: cur, locs: [...locs], i: 0, chosen: {} });
  };
  const battleDone = (script: Attack[]) => {
    const b = battleQ; if (!b) return;
    const chosen = { ...b.chosen, [b.locs[b.i]]: script };
    const i = b.i + 1;
    if (i < b.locs.length) { setBattleQ({ ...b, i, chosen }); return; }
    setBattleQ(null); setS(resolve(b.base, chosen));
  };

  // ── Actions ──
  const doDeploy = (ids: string[]) => {
    let cur = stateRef.current; if (!cur) return;
    for (const id of ids) { if (canDeploy(cur, id)) { setNote(canDeploy(cur, id)); break; } cur = deploy(cur, id); }
    setS(cur); setSelCards([]);
  };
  const doMove = (ids: string[], to: Loc) => {
    const cur = stateRef.current; if (!cur) return;
    const why = canMove(cur, ids, to);
    if (why) setNote(why); else setS(move(cur, ids, to));
    setSel([]);
  };

  // ── Dragging: the card sticks to the pointer where you grabbed it (positioned on every frame by
  //    the browser, not by React), tilts with the motion, and drops where the pointer is ──
  const dropAt = (x: number, y: number): Loc | null => {
    const el = document.elementsFromPoint(x, y).find(e => (e as HTMLElement).dataset?.drop != null) as HTMLElement | undefined;
    const v = el?.dataset.drop; return v == null ? null : v === 'base' ? 'base' : (Number(v) as Loc);
  };
  useLayoutEffect(() => {
    if (!drag) return;
    let raf = 0;
    const paint = () => {
      const p = pointer.current; const g = ghostRef.current;
      if (g) {
        p.tilt = p.tilt * 0.82 + Math.max(-14, Math.min(14, (p.x - p.lastX) * 0.9)) * 0.18; p.lastX = p.x;
        g.style.transform = `translate3d(${p.x - p.gx}px, ${p.y - p.gy}px, 0) rotate(${p.tilt}deg) scale(1.06)`;
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [drag]);
  const press = (e: React.PointerEvent, kind: DragState['kind'], ids: string[]) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement; const r = el.getBoundingClientRect();
    const x0 = e.clientX; const y0 = e.clientY; let started = false;
    // Where inside the card it was grabbed (screen px), so it does not jump to the pointer
    pointer.current = { x: x0, y: y0, gx: x0 - r.left, gy: y0 - r.top, tilt: 0, lastX: x0 };
    const before = kind === 'card' ? selCards : sel;
    const onMove = (ev: PointerEvent) => {
      pointer.current.x = ev.clientX; pointer.current.y = ev.clientY;
      if (!started && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 9) {
        started = true;
        if (kind === 'units') setSel(ids); else setSelCards(ids);
        setDrag({ kind, ids });
      }
      if (started) { const t = dropAt(ev.clientX, ev.clientY); if (t !== hoverRef.current) { hoverRef.current = t; setHoverTo(t); } }
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      hoverRef.current = null; setHoverTo(null);
      if (!started) {
        // A tap selects (several cards / several units from one place)
        if (kind === 'card') setSelCards(c => (c.includes(ids[0]) ? c.filter(x => x !== ids[0]) : [...c, ids[0]]));
        else setSel(cur => {
          const id = ids[0]; const st = stateRef.current;
          if (cur.includes(id)) return cur.filter(x => x !== id);
          const u = st?.units.find(x => x.uid === id); const first = st?.units.find(x => x.uid === cur[0]);
          return first && u && first.loc === u.loc ? [...cur, id] : [id];
        });
        return;
      }
      const to = dropAt(ev.clientX, ev.clientY);
      const cur = stateRef.current;
      const ok = cur && to != null && (kind === 'card' ? to === 'base' : !canMove(cur, ids, to));
      if (ok) {
        setSettled(new Set(kind === 'units' ? ids : ids.map(id => `0:${id}`)));
        if (kind === 'card') doDeploy(ids); else doMove(ids, to!);
        setDrag(null);
      } else {
        // Not allowed there: fly back home
        const g = ghostRef.current;
        if (g) { g.style.transition = 'transform 220ms cubic-bezier(.2,.8,.3,1)'; g.style.transform = `translate3d(${r.left}px, ${r.top}px, 0) rotate(0deg) scale(1)`; }
        if (to != null && cur && kind === 'units') setNote(canMove(cur, ids, to));
        if (to != null && to !== 'base' && kind === 'card') setNote('Karty z ręki idą najpierw do bazy');
        // Back where it was, and so is the selection
        setTimeout(() => { setDrag(null); if (kind === 'units') setSel(before); else setSelCards(before); }, 230);
      }
    };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };
  const pressUnit = (e: React.PointerEvent, u: OUnit) => { setSelCards([]); press(e, 'units', sel.includes(u.uid) && sel.length > 1 ? sel : [u.uid]); };
  const pressCard = (e: React.PointerEvent, c: GCard) => { setSel([]); press(e, 'card', selCards.includes(c.id) && selCards.length > 1 ? selCards : [c.id]); };

  if (!s) return null;
  const mine = s.active === 0 && s.winner === null;
  const me = s.sides[0]; const rival = s.sides[1];
  const phase = s.phase;
  const movingUnits = drag?.kind === 'units' ? drag.ids : sel;
  const movingCards = drag?.kind === 'card' ? drag.ids : selCards;
  const hidden = new Set(drag?.kind === 'units' ? drag.ids : []);
  const ctx: AreaCtx = { s, sel, bumps, hidden, settled, pressUnit };

  // Targets for whatever is picked up
  const targetFor = (to: Loc): Target | null => {
    if (!mine) return null;
    if (movingCards.length) {
      if (to !== 'base') return { ok: false, text: 'Karty z ręki idą do bazy', tone: 'off', cost: 0 };
      const n = movingCards.length;
      return n <= s.orders ? { ok: true, text: `Wystaw · ${n} ${n === 1 ? 'rozkaz' : n < 5 ? 'rozkazy' : 'rozkazów'}`, tone: 'good', cost: n } : { ok: false, text: `Za mało rozkazów (${s.orders})`, tone: 'off', cost: 0 };
    }
    if (movingUnits.length && phase === 'move') {
      if (s.units.filter(u => movingUnits.includes(u.uid)).every(u => u.loc === to)) return null;
      return unitTarget(s, movingUnits, to);
    }
    return null;
  };
  const advance = () => { const cur = stateRef.current; if (!cur || cur.active !== 0 || cur.phase === 'fight' || selCards.length) return; if (cur.phase === 'deploy') setS(startOrders(cur)); else openBattles(cur); setSel([]); setSelCards([]); };
  const sendTo = (to: Loc) => { if (movingCards.length && to === 'base') doDeploy(movingCards); else if (sel.length) doMove(sel, to); };
  // What the picked-up units would cost (exactly, once the pointer is over a target)
  const hoverCost = hoverTo != null && movingUnits.length && phase === 'move' && !canMove(s, movingUnits, hoverTo) ? moveCost(s, movingUnits, hoverTo) : null;
  const pendingCost = movingCards.length ? movingCards.length : movingUnits.length && phase === 'move'
    ? Math.max(0, hoverCost ?? (smokeLeft(s) && s.units.some(u => movingUnits.includes(u.uid) && u.card.role === 'Soft Support') ? 0 : 1)) : 0;

  const rested = s.units.filter(u => u.side === 0 && !u.moved && !u.fresh);
  const canPlay = mine && phase === 'deploy' && s.orders > 0 && me.hand.length > 0;
  const canGo = mine && phase === 'move' && rested.some(u => (['base', 0, 1, 2] as Loc[]).some(l => !canMove(s, [u.uid], l)));
  const planned = s.units.some(u => u.side === 0 && u.moved);
  const clashes = ([0, 1, 2] as const).filter(i => s.units.some(u => u.side === 0 && u.loc === i) && s.units.some(u => u.side === 1 && u.loc === i)).length;
  const recommend = mine && !scene && ((phase === 'deploy' && !canPlay) || (phase === 'move' && !canGo));
  const shown: [number, number] = [s.sides[0].score - owed[0], s.sides[1].score - owed[1]];
  const lastRival = [...s.events].reverse().find(e => e.side === 1 && e.kind !== 'turn');

  const restedNow = rested.length > 0;
  const prompt = !mine ? null
    : phase === 'deploy'
      ? (movingCards.length ? 'Kliknij swoją bazę' : canPlay ? (restedNow ? 'Wybierz karty i postaw je w bazie. Możesz zostawić rozkazy na ruchy.' : 'Wybierz karty i postaw je w bazie. Każda kosztuje 1 rozkaz.') : 'Przejdź do ruchów')
      : phase === 'fight' ? 'Walki i przejęcia'
      : (movingUnits.length ? 'Kliknij objective albo bazę' : canGo ? "Przeciągnij jednostki na objective'y. Walki dopiero po zatwierdzeniu." : planned ? (clashes ? 'Zatwierdź ruchy: walcz' : 'Zatwierdź ruchy') : 'Zakończ turę');
  // A prompt that names an action is that action
  const promptAct = mine && !movingCards.length && !movingUnits.length && ((phase === 'deploy' && !canPlay) || (phase === 'move' && !canGo)) ? advance : null;
  const n = movingCards.length;

  // ── Just-in-time hints: one at a time, each once, pointing at the thing it is about ──
  const hint = (() => {
    if (!mine) return null;
    const out: Array<{ id: string; target: string; text: string; when: boolean; place?: 'left' | 'right' }> = [];
    const oneCard = movingCards.length === 1 ? me.hand.find(c => c.id === movingCards[0]) : undefined;
    const oneUnit = movingUnits.length === 1 ? s.units.find(u => u.uid === movingUnits[0]) : undefined;
    const role = oneCard?.role ?? oneUnit?.card.role;
    const roleTarget = oneCard ? `[data-uid="0:${oneCard.id}"]` : oneUnit ? `[data-uid="${oneUnit.uid}"]` : '';
    if (role) out.push({ id: `type:${role}`, target: roleTarget, text: `${KEYWORD[role].name}: ${KEYWORD[role].text}`, when: true, place: oneCard ? 'left' : undefined });
    out.push({ id: 'cost', target: '[data-tour="orders"]', text: 'Migające rozkazy to koszt. Na całą turę masz 3: na karty i na ruchy.', when: movingCards.length > 0 });
    out.push({ id: 'deploy-base', target: '[data-tour="base"]', text: 'Kliknij swoją bazę, żeby wystawić zaznaczone karty.', when: movingCards.length > 0 });
    out.push({ id: 'keep', target: '[data-hint="pass"]', text: 'Nie musisz wystawiać wszystkiego. Zostaw rozkazy na ruchy.', when: canPlay && !movingCards.length && restedNow, place: 'right' });
    const firstRested = rested[0];
    out.push({ id: 'move', target: firstRested ? `[data-uid="${firstRested.uid}"]` : '', text: 'Przeciągnij jednostkę na objective (albo kliknij ją, a potem objective). Ruch kosztuje 1 rozkaz.', when: phase === 'move' && canGo && !planned && !movingUnits.length && !!firstRested });
    const mate = oneUnit && rested.find(u => u.uid !== oneUnit.uid && u.loc === oneUnit.loc);
    out.push({ id: 'group', target: mate ? `[data-uid="${mate.uid}"]` : '', text: 'Jednostki idące z jednego miejsca w to samo miejsce to jedna grupa: razem 1 rozkaz, także gdy przeciągasz je po kolei.', when: phase === 'move' && !!mate });
    out.push({ id: 'confirm', target: '[data-tour="turn"]', text: 'To dopiero plan: możesz go zmieniać. Gdy skończysz, kliknij tutaj: wtedy rozegrają się walki i przejęcia.', when: phase === 'move' && planned && !movingUnits.length, place: 'left' });
    const onObj = movingUnits.length > 0 && s.units.filter(u => movingUnits.includes(u.uid)).every(u => u.loc !== 'base' && u.card.role !== 'Mid');
    out.push({ id: 'via-base', target: oneUnit ? `[data-uid="${oneUnit.uid}"]` : '[data-tour="base"]', text: "Z objective'u na inny idzie się przez bazę. Prosto potrafi tylko Mid (i każdy, kto stoi na Twin Gates).", when: phase === 'move' && onObj });
    const fightAt = ([0, 1, 2] as const).find(i => targetFor(i)?.tone === 'fight');
    out.push({ id: 'fight', target: `[data-obj="${fightAt}"]`, text: 'Tu stoi rywal: po zatwierdzeniu ruchów będzie walka. Uderzacie na zmianę, jedna jednostka naraz, a Ty wybierasz cele.', when: fightAt != null });
    const teamObj = ([0, 1, 2] as const).find(i => s.units.some(u => u.side === 0 && u.loc === i && strengthParts(s, u).some(p => p.kind === 'team')));
    out.push({ id: 'team', target: `[data-obj="${teamObj}"]`, text: 'Drużyna: gracze z tej samej drużyny na jednym objectivie dostają po +1 siły.', when: teamObj != null });
    const sinceTurn = s.events.slice(s.events.map(e => e.kind).lastIndexOf('turn'));
    out.push({ id: 'hold', target: '[data-tour="score"]', text: '+1 na początku Twojej tury za każdy objective, na którym stoisz.', when: phase === 'deploy' && sinceTurn.some(e => e.kind === 'points' && e.why === 'hold' && e.side === 0) });
    return out.find(h => h.when && h.target && !seenHints.has(h.id)) ?? null;
  })();
  const tutorial = gameLevel === 'tutorial' && !tutOff && s.winner === null;
  const hintBlocked = !!(scene || banner || tour || logOpen || drag || flyers.length || s.winner !== null || tutorial);

  // ── Tutorial coach: each step shows when it is true on the board; action steps wait for the action ──
  const coach = (() => {
    if (!tutorial) return null;
    const pointsFor = (why: 'take' | 'hold') => s.events.some(e => e.kind === 'points' && e.side === 0 && e.why === why);
    const auraAt = ([0, 1, 2] as const).find(i => s.units.some(u => u.side === 0 && u.loc === i && u.card.role === 'Hard Support'));
    const teamAt = ([0, 1, 2] as const).find(i => s.units.some(u => u.side === 0 && u.loc === i && strengthParts(s, u).some(p => p.kind === 'team')));
    const supp = mine && phase === 'move' && smokeLeft(s) ? rested.find(u => u.card.role === 'Soft Support') : undefined;
    const midU = mine && phase === 'move' ? rested.find(u => u.card.role === 'Mid' && u.loc !== 'base') : undefined;
    const mate = mine && phase === 'move' && planned && rested.some(u => s.units.some(q => q.side === 0 && q.moved && q.from === u.loc));
    const mineCount = s.units.filter(u => u.side === 0).length;
    const steps: TutStep[] = [
      { id: 'orders', target: '[data-tour="orders"]', align: 'right', title: 'Rozkazy to koszt', points: [<><b>3 rozkazy</b> na turę, na wszystko.</>, 'Migają te, które zapłacisz za zaznaczone karty.'], when: () => mine && phase === 'deploy' && movingCards.length > 0 && tutDone.has('cards') },
      { id: 'goal', seq: true, target: '[data-tour="score"]', title: 'Cel gry', points: [<>Zdobądź <b>6 punktów</b> (w zwykłej grze 10).</>, <><b>+1</b> za przejęcie objective&apos;u, Roshan <b>+2</b>.</>, <><b>+1</b> co turę za objective, na którym stoisz.</>], when: () => mine, expire: () => s.turn >= 3 },
      { id: 'objectives', seq: true, target: '[data-tour="objectives"]', title: 'Objective\'y', points: ['Trzy miejsca z mapy, każde z własną zasadą (pod nazwą).', 'Na dole Twoje miejsca, na górze rywala.'], when: () => mine, expire: () => s.turn >= 3 },
      { id: 'cards', seq: true, target: '[data-tour="hand"]', title: 'Twoje karty', points: [<>Liczba w rogu to <b>siła</b>.</>, 'Pod nazwą pozycja: każda ma umiejętność.', 'Najedź na kartę, żeby ją odwrócić i przeczytać.'], when: () => mine, expire: () => s.turn >= 3 },
      { id: 'deploy', seq: true, target: '[data-tour="hand"]', title: 'Wystaw karty', points: ['Karty z ręki idą najpierw do Twojej bazy.', 'Każda kosztuje 1 rozkaz.'], action: 'Kliknij 2 karty, potem swoją bazę', when: () => mine && phase === 'deploy', done: () => mineCount >= 2, expire: () => s.turn > 1 },
      { id: 'to-moves', seq: true, target: '[data-tour="turn"]', title: 'Dalej', points: ['Wystawione karty ruszą dopiero w następnej turze.', 'Teraz przejdź dalej: tura przejdzie do rywala.'], action: 'Kliknij Dalej', when: () => mine && phase === 'deploy' && s.turn === 1, done: () => phase !== 'deploy', expire: () => s.turn > 1 },
      { id: 'rival', seq: true, title: 'Tura rywala', points: ['Rywal robi to samo: wystawia karty i rusza jednostki.', 'Jego karty i bazę widzisz na górze.'], when: () => !mine && s.turn === 2, expire: () => s.turn > 2 },
      { id: 'turn2', seq: true, target: '[data-tour="turn"]', title: 'Twoja tura', points: [<>Na początku tury dobierasz <b>2 karty</b>.</>, 'Wystaw coś jeszcze albo od razu przejdź do ruchów.'], action: 'Kliknij Dalej, żeby przejść do ruchów', when: () => mine && phase === 'deploy' && s.turn >= 3, done: () => phase !== 'deploy', expire: () => s.turn >= 5 },
      { id: 'move', seq: true, target: rested[0] ? `[data-uid="${rested[0].uid}"]` : '[data-tour="base"]', title: 'Ruch na objective', points: ['Przeciągnij jednostkę na objective (albo kliknij ją, a potem objective).', 'Ruch kosztuje 1 rozkaz.', 'To dopiero plan: możesz go zmienić.'], action: 'Wyślij jednostkę na objective', when: () => mine && phase === 'move' && canGo, done: () => planned, expire: () => s.turn >= 5 },
      { id: 'group', target: '[data-tour="orders"]', title: 'Grupa płaci raz', points: ['Jednostki z jednego miejsca w to samo miejsce to jedna grupa.', 'Płacisz 1 rozkaz, nawet gdy przeciągasz je po kolei.'], when: () => !!mate },
      { id: 'confirm', seq: true, target: '[data-tour="turn"]', title: 'Zatwierdź', points: ['Teraz wszystko dzieje się naraz: walki i przejęcia.'], action: 'Kliknij Zatwierdź', when: () => mine && phase === 'move' && planned, done: () => s.events.some(e => e.kind === 'move' && e.side === 0), expire: () => s.turn >= 7 },
      { id: 'battle', title: 'Walka', points: [<>Uderzacie <b>na zmianę</b>, jedna jednostka naraz; zaczyna atakujący.</>, <>Kliknij swoją jednostkę, potem cel: bije <b>za tyle, ile ma siły</b>.</>, 'Obrażenia zostają do końca walki (pasek pod kartą).', 'Offlane rywala musi zginąć, zanim zaatakujesz kogoś innego.', 'Walka trwa runda po rundzie, aż jedna strona padnie.'], when: () => !!battleQ },
      { id: 'take', target: '[data-tour="score"]', title: 'Przejęcie!', points: [<><b>+1</b> za przejęcie (Roshan <b>+2</b>).</>, 'Ten objective jest teraz Twój.'], when: () => pointsFor('take') },
      { id: 'hold', target: '[data-tour="score"]', title: 'Trzymanie', points: [<>Na początku tury <b>+1</b> za każdy Twój objective, na którym stoisz.</>, 'Zostaw tam jednostkę, a punkty wpadają same.'], when: () => pointsFor('hold') },
      { id: 'team', target: teamAt != null ? `[data-obj="${teamAt}"]` : undefined, title: 'Drużyna +1', points: ['Na tym objectivie stoją gracze z tej samej drużyny.', <>Każdy z nich dostaje <b>+1 siły</b> (ikona z ludzikami na karcie).</>, 'Zbieraj karty całych drużyn, żeby to wykorzystać.'], when: () => teamAt != null && mine },
      { id: 'aura', target: auraAt != null ? `[data-obj="${auraAt}"]` : undefined, title: 'Hard Supp: Aura', points: [<>Każda Twoja jednostka na tym objectivie ma <b>+1 siły</b>.</>], when: () => auraAt != null && mine },
      { id: 'smoke', target: supp ? `[data-uid="${supp.uid}"]` : undefined, title: 'Support: Smoke', points: ['Raz na turę jedna grupa ruszająca z miejsca Supportu idzie bez rozkazu.', 'Support może zostać na miejscu.'], when: () => !!supp },
      { id: 'mid', target: midU ? `[data-uid="${midU.uid}"]` : undefined, title: 'Mid: Gank', points: ['Mid może iść prosto na inny objective, bez wracania do bazy.'], when: () => !!midU },
    ];
    const finish = (id: string) => queueMicrotask(() => setTutDone(d => (d.has(id) ? d : new Set(d).add(id))));
    let blocked = false;
    for (const st of steps) {
      if (tutDone.has(st.id)) continue;
      // During a fight only the fight is explained
      if (battleQ && st.id !== 'battle') continue;
      if (st.expire?.()) { finish(st.id); continue; }
      if (tutReached.current.has(st.id) && st.done?.()) { finish(st.id); continue; }
      if (st.seq && blocked) continue;
      if (!st.when()) { if (st.seq) blocked = true; continue; }
      if (st.done?.()) { finish(st.id); continue; }
      tutReached.current.add(st.id);
      return { st, n: steps.indexOf(st) + 1, total: steps.length };
    }
    return null;
  })();

  // A hint counts as seen once something else replaces it (the player acted on it)
  if (hint?.id !== lastHint.current && !hintBlocked) {
    const prev = lastHint.current; lastHint.current = hint?.id ?? null;
    if (prev) queueMicrotask(() => markHint(prev));
  }

  return (
    <div ref={boardRef} className="relative h-full flex flex-col overflow-hidden select-none" style={{ background: `radial-gradient(110% 80% at 45% 0%, #191c25, ${T.bg} 62%)`, color: T.text }}
      onClick={e => { if (e.target === e.currentTarget) { setSel([]); setSelCards([]); } }}>
      <style>{'@keyframes karty-blink{0%,100%{opacity:1}50%{opacity:.2}}'}</style>
      <LayoutGroup>
        {/* Top HUD */}
        <div className="h-[64px] shrink-0 flex items-center justify-center relative">
          {onBack && (
            <motion.button type="button" onClick={onBack} whileHover={{ x: -3 }} className="absolute left-5 flex items-center gap-1.5 rounded-full pl-2.5 pr-4 h-10 text-[13px] font-bold"
              style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }}><ArrowLeft className="w-4 h-4" />Album i talia</motion.button>
          )}
          <Tip content={`Rywal · na ręce: ${rival.hand.length} · w talii: ${rival.deck.length} · polegli: ${rival.grave.length}`}>
            <div className="absolute left-[200px] flex items-center gap-3 cursor-help">
              <div className="flex -space-x-5">{rival.hand.map((_, i) => <div key={i} style={{ transform: `rotate(${(i - rival.hand.length / 2) * 6}deg)` }}><CardBack w={28} /></div>)}</div>
              <span className="font-logik-extended-bold text-[22px]" style={{ color: T.rival, ...font }}>{rival.hand.length}</span>
              <span className="text-[11px] uppercase tracking-widest leading-tight" style={{ color: T.muted }}>kart na ręce<br />rywala</span>
            </div>
          </Tip>
          <ScoreRace shown={shown} win={s.win} />
          {/* Who you play against, on the rival's side of the score */}
          <div className="absolute right-[150px] flex items-center gap-2.5 whitespace-nowrap">
            <span className="font-logik-extended-bold uppercase text-[14px] leading-tight text-right" style={{ color: LEVELS[gameLevel].color, ...font }}>{gameLevel === 'tutorial' ? 'Samouczek' : `Komputer ${LEVELS[gameLevel].name}`}</span>
            <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: mix(LEVELS[gameLevel].color, 25), boxShadow: `0 0 0 2px ${LEVELS[gameLevel].color}` }}><Bot className="w-5 h-5" style={{ color: LEVELS[gameLevel].color }} /></span>
          </div>
          <div data-tour="help" className="absolute right-5 flex items-center gap-2">
            <Tip content="Samouczek">
              <motion.button type="button" data-help="tour" onClick={() => setTour(true)} whileHover={{ scale: 1.08 }} className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }} aria-label="Samouczek"><CircleHelp className="w-5 h-5" /></motion.button>
            </Tip>
            <Tip content="Przebieg meczu">
              <motion.button type="button" onClick={() => setLogOpen(true)} whileHover={{ scale: 1.08 }} className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }} aria-label="Przebieg meczu"><ScrollText className="w-5 h-5" /></motion.button>
            </Tip>
          </div>
        </div>
        <BaseBand side={1} a={ctx} target={movingCards.length || movingUnits.length ? NO_TARGET : null} />
        <div data-tour="objectives" className="relative flex-1 min-h-0 flex">
          {([0, 1, 2] as const).map(i => (
            <React.Fragment key={i}>
              {i > 0 && <div className="w-px shrink-0" style={{ background: `linear-gradient(180deg, transparent, ${T.line}, transparent)` }} />}
              <Objective i={i} a={ctx} target={targetFor(i)} onSend={() => sendTo(i)} w={figW} rowRef={i === 0 ? setObjEl : undefined} />
            </React.Fragment>
          ))}
        </div>
        <BaseBand side={0} a={ctx} target={targetFor('base')} onSend={() => sendTo('base')} deployN={mine && phase === 'deploy' && n > 0 && n <= s.orders ? n : 0} />

        {/* Bottom HUD: prompt + hand, the orders and the turn button right beside it */}
        <div className="relative h-[214px] shrink-0 flex">
          <div className="flex-1 min-w-0 flex flex-col items-center">
            <div className="relative z-50 h-[44px] mt-1 flex items-center">
              <AnimatePresence mode="wait">
                {mine && (note || prompt || n > s.orders) && (
                  <motion.div key={(note ?? '') + (prompt ?? '') + phase} onClick={!note && promptAct ? promptAct : undefined}
                    className={`flex items-center gap-3 px-5 h-[40px] rounded-full ${!note && promptAct ? 'cursor-pointer' : ''}`}
                    initial={{ opacity: 0, y: 14, scale: 1.08 }} animate={{ opacity: 1, y: 0, scale: 1, boxShadow: [`0 0 0 2px ${ACC_L}, 0 0 30px ${mix(ACC, 70)}`, `0 0 0 1px ${T.faint}, 0 0 0px transparent`] }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, boxShadow: { duration: 1.4 } }} whileHover={!note && promptAct ? { scale: 1.04 } : undefined}
                    style={{ background: !note && promptAct ? ACC : 'rgba(0,0,0,0.5)' }}>
                    <span className="font-logik-extended-bold uppercase text-[12px] tracking-widest whitespace-nowrap" style={{ color: !note && promptAct ? '#fff' : ACC_L, ...font }}>{phase === 'deploy' ? 'Faza 1/3 · Wystawianie' : phase === 'move' ? 'Faza 2/3 · Ruchy' : 'Faza 3/3 · Walki'}</span>
                    <span className="text-[14px] font-bold whitespace-nowrap" style={{ color: note || n > s.orders ? T.warn : T.text }}>{note ?? (n > s.orders ? `Za dużo kart: masz ${s.orders} ${s.orders === 1 ? 'rozkaz' : 'rozkazy'}` : prompt)}{!note && promptAct ? ' →' : ''}</span>
                  </motion.div>
                )}
                {!mine && s.winner === null && lastRival && (
                  <motion.div key={`r${s.events.length}`} className="flex items-center gap-3 px-5 h-[38px] rounded-full text-[13px]" style={{ background: 'rgba(0,0,0,0.5)', boxShadow: `0 0 0 1px ${T.rival}66` }}
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <span className="font-logik-extended-bold uppercase text-[12px] tracking-widest" style={{ color: T.rival, ...font }}>Rywal</span>
                    <EvRow s={s} e={lastRival} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative flex-1 w-full flex justify-center items-end pb-3">
              <div data-tour="hand" className="flex items-end">
              {me.hand.map((c, i) => {
                const n = me.hand.length; const off = i - (n - 1) / 2;
                const can = mine && !canDeploy(s, c.id);
                const picked = movingCards.includes(c.id);
                const dragged = drag?.kind === 'card' && drag.ids.includes(c.id);
                return (
                  <motion.div key={c.id} className="-mx-1.5 hover:!z-[70]" style={{ zIndex: picked ? 40 : i }}
                    animate={{ rotate: off * 3, y: Math.abs(off) * 3 + (picked ? -10 : 0), opacity: dragged ? 0 : 1 }}
                    whileHover={can && !drag ? { y: -14, scale: 1.05 } : undefined}>
                    <Figure card={c} layoutId={`0:${c.id}`} m={baseMight(c)} side={0} w={112} selected={picked} glow={can && !movingCards.length} tired={!can}
                      onPointerDown={can ? e => pressCard(e, c) : undefined} dataId={`0:${c.id}`} grow="up" info={drag ? undefined : { showParts: false }} />
                  </motion.div>
                );
              })}
              </div>
              {mine && phase === 'deploy' && me.hand.length > 0 && (
                <motion.button type="button" data-hint="pass" onClick={advance} whileHover={{ y: -10 }} className="ml-4 shrink-0 rounded-[12px] flex flex-col items-center justify-center gap-2 px-3 text-center"
                  style={{ width: 112, height: 150, border: `2px dashed ${mix(ACC_L, 60)}`, background: 'rgba(255,255,255,0.03)', color: T.text }}>
                  <ArrowRight className="w-6 h-6" style={{ color: ACC_L }} />
                  <span className="font-logik-extended-bold uppercase text-[12px] leading-tight" style={font}>Nie wystawiam więcej</span>
                  <span className="text-[11px] leading-snug" style={{ color: T.muted }}>Rozkazy zostają na ruchy</span>
                </motion.button>
              )}
              {!me.hand.length && <span className="text-[12px] mb-10" style={{ color: T.muted }}>Ręka pusta: na początku tury dobierasz 2 karty</span>}
          {/* Orders + turn button right beside the hand: short mouse trips */}
          <div className="ml-10 mb-1 shrink-0 flex items-center gap-5">
            <Tip content="Rozkazy to waluta tury: masz 3 na wszystko. Wystawienie karty kosztuje 1. Ruch kosztuje 1 na grupę: jednostki idące z jednego miejsca w to samo miejsce płacą razem. Migają te, które zapłacisz za to, co masz zaznaczone.">
              <div data-tour="orders" className="flex flex-col items-center gap-2 cursor-help">
                <div className="flex items-center gap-2.5">
                  {Array.from({ length: Math.max(s.budget, s.orders) }, (_, i) => <Gem key={i} size={20} on={mine && i < s.orders} pending={mine && i >= s.orders - pendingCost && i < s.orders} />)}
                </div>
                <span className="text-[11px] uppercase tracking-widest" style={{ color: T.muted }}>rozkazy · płacisz nimi</span>
              </div>
            </Tip>
            <motion.button type="button" data-tour="turn" disabled={!mine || movingCards.length > 0} onClick={advance} title={movingCards.length ? 'Najpierw wystaw zaznaczone karty (kliknij bazę) albo je odznacz' : undefined}
              className="relative w-[124px] h-[124px] rounded-full flex flex-col items-center justify-center font-logik-extended-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
              whileHover={mine ? { scale: 1.06, filter: 'brightness(1.35)' } : undefined}
              animate={recommend ? { boxShadow: [`0 0 0 3px ${ACC_L}, 0 0 8px ${mix(ACC, 60)}`, `0 0 0 3px ${ACC_L}, 0 0 40px ${ACC}`, `0 0 0 3px ${ACC_L}, 0 0 8px ${mix(ACC, 60)}`], backgroundColor: [mix(ACC, 70), ACC, mix(ACC, 70)] } : { boxShadow: `0 0 0 2px ${mine ? mix(ACC, 70) : T.faint}`, backgroundColor: mine ? mix(ACC, 30) : '#1a1c22' }}
              transition={recommend ? { duration: 1.8, repeat: Infinity } : { duration: 0.3 }}
              style={{ color: mine ? '#fff' : T.muted, ...font }}>
              <span className="text-[16px] leading-tight text-center">{!mine ? (s.winner === null ? 'Tura rywala' : 'Koniec') : phase === 'deploy' ? 'Dalej' : phase === 'fight' ? 'Walki' : clashes ? 'Walcz' : planned ? 'Zatwierdź' : 'Koniec tury'}</span>
              {mine && <span className="text-[9px] tracking-widest mt-1 opacity-80">{phase === 'deploy' ? 'do ruchów' : phase === 'fight' ? '' : planned ? 'zatwierdź ruchy' : 'oddaj ruch'}</span>}
            </motion.button>
          </div>
            </div>
          </div>
        </div>
      </LayoutGroup>

      {/* Points flying to the score */}
      <AnimatePresence>
        {flyers.map(f => (
          <motion.div key={f.id} className="absolute z-40 pointer-events-none font-logik-extended-bold whitespace-nowrap" style={{ left: 0, top: 0, color: T.pts, textShadow: `0 0 16px ${T.pts}, 0 2px 4px #000`, ...font }}
            initial={{ x: f.from.x - 60, y: f.from.y - 20, scale: 0.6, opacity: 0 }}
            animate={{ x: [f.from.x - 60, f.from.x - 60, f.to.x - 60], y: [f.from.y - 20, f.from.y - 60, f.to.y - 20], scale: [0.6, 1.4, 0.8], opacity: [0, 1, 1] }}
            transition={{ duration: 1.6, times: [0, 0.35, 1], ease: 'easeInOut' }} onAnimationComplete={() => landed(f)}>
            <span className="text-[30px]">+{f.pts}</span><span className="text-[13px] ml-1 uppercase tracking-widest">{f.why === 'take' ? 'przejęcie' : 'trzymanie'}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {banner && !scene && (
          <motion.div key={banner.key} className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="font-logik-extended-bold uppercase text-[64px]" initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              style={{ color: sideColor(banner.side), textShadow: `0 0 40px ${sideColor(banner.side)}, 0 4px 12px #000`, ...font }}>{banner.text}</motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{logOpen && <CombatLog s={s} onClose={() => setLogOpen(false)} />}</AnimatePresence>
      {visible && tour && !scene && <Tour steps={TOUR} onClose={closeTour} home='[data-help="tour"]' />}
      {visible && hint && !hintBlocked && <Hint target={hint.target} text={hint.text} place={hint.place} onClose={() => markHint(hint.id)} />}
      {visible && coach && !banner && !tour && (
        <Coach step={coach.st} n={Math.min(coach.n, coach.total)} total={coach.total} onSkip={() => setTutOff(true)}
          onNext={coach.st.action ? undefined : () => setTutDone(d => new Set(d).add(coach.st.id))} />
      )}
      <AnimatePresence>
        {battleQ && <BattleScreen key={`${battleQ.base.turn}-${battleQ.i}`} s={battleQ.base} at={battleQ.locs[battleQ.i]} level={gameLevel} onDone={battleDone} />}
      </AnimatePresence>
      <AnimatePresence>
        {s.winner !== null && !scene && !flyers.length && (
          <EndScreen won={s.winner === 0} score={[s.sides[0].score, s.sides[1].score]} turns={Math.ceil(s.turn / 2)} rival={gameLevel === 'tutorial' ? 'Samouczek' : `Komputer ${LEVELS[gameLevel].name}`} onRematch={() => start(true)} onNew={() => start()} onExit={onBack} />
        )}
      </AnimatePresence>

      {/* The picked-up card(s), outside the scaled stage so they follow the pointer exactly */}
      {drag && typeof document !== 'undefined' && createPortal(
        <div ref={ghostRef} className="fixed left-0 top-0 z-[100] pointer-events-none" style={{ transform: `translate3d(${pointer.current.x - pointer.current.gx}px, ${pointer.current.y - pointer.current.gy}px, 0)`, transformOrigin: `${pointer.current.gx}px ${pointer.current.gy}px`, filter: 'drop-shadow(0 24px 30px rgba(0,0,0,0.55))' }}>
          <div className="flex -space-x-10" style={{ transform: `scale(${fit})`, transformOrigin: '0 0' }}>
            {drag.kind === 'card'
              ? drag.ids.map(id => { const c = me.hand.find(x => x.id === id); return c ? <Figure key={id} card={c} m={baseMight(c)} side={0} w={112} selected /> : null; })
              : s.units.filter(u => drag.ids.includes(u.uid)).map(u => <Figure key={u.uid} card={u.card} m={might(s, u)} side={0} w={u.loc === 'base' ? 90 : figW} selected />)}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
