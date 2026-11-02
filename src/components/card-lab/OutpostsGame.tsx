'use client';

// "Kontrola mapy" — the area-control game (rules: src/lib/card-lab/outposts.ts) vs the practice
// computer. Full-bleed dark table, game HUD:
//   top      score race to 10, the rival's hand, the combat log button
//   middle   the rival's base, three objectives (open arenas on their real map spot), your base
//   bottom   phase prompt + your hand, with the orders and the turn button right next to it
// Cards are dragged (the card sticks to the pointer where you grabbed it) or tapped and then sent by
// clicking anywhere on a target. Fights play as a scene; points fly to the score; the end is a show.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ArrowRight, Flag, Home, Moon, Mountain, Plus, ScrollText, Shield, Skull, Sprout, Sun, Swords, Users, Wind, X } from 'lucide-react';
import { Avatar, C, HeroRender, Tip, mix, onDark, useHeaderFont, useSize } from '@/components/stats-lab/kit';
import { useFitText } from '@/components/teams-section/fit';
import { avgOvr, cpuDeck, type DeckRule, type GCard } from '@/lib/card-lab/cards';
import {
  DECK_PER_ROLE, DECK_SIZE, KEYWORD, OBJECTIVES, ORDERS, PER_SIDE_AT_OBJECTIVE, WIN_POINTS,
  baseMight, canDeploy, canMove, cardStrength, deploy, endTurn, freeMove, itemIcon, might, move, newGame, startOrders, strengthParts, takePoints,
  type Ev, type Fight, type Gain, type Loc, type ObjId, type OState, type OUnit, type Part, type Side,
} from '@/lib/card-lab/outposts';
import { applyAct, cpuNextAction } from '@/lib/card-lab/outposts-ai';
import { CardBack, useFitScale } from './ui';

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
const MAP_VIEW = 0.3; // how much of the map's width an arena shows

const PART_ICON: Partial<Record<Part['kind'], typeof Sun>> = { aura: Sun, farmer: Sprout, hg: Mountain, team: Users };
const PART_COLOR: Record<Part['kind'], string> = { card: T.text, role: T.text, aura: ACC_L, farmer: T.me, hg: '#6fb7ff', team: '#7fd3ff' };
const signColor = (v: number) => (v > 0 ? T.pos : v < 0 ? T.neg : T.zero);

function FitLine({ text, max, min, className, style }: { text: string; max: number; min: number; className?: string; style?: React.CSSProperties }) {
  const ref = useFitText<HTMLDivElement>(text, max, min);
  return <div ref={ref} className={`whitespace-nowrap overflow-hidden ${className ?? ''}`} style={style}>{text}</div>;
}

/** Order gem (the turn's currency); `pending` blinks: it would be spent by what is selected */
function Gem({ on = true, pending, size = 16 }: { on?: boolean; pending?: boolean; size?: number }) {
  return (
    <motion.span className="inline-block rotate-45 shrink-0 align-middle" animate={pending ? { opacity: [1, 0.25, 1] } : { opacity: 1 }} transition={pending ? { duration: 1.1, repeat: Infinity } : undefined}
      style={{ width: size, height: size, borderRadius: size * 0.22, background: on ? ACC_L : T.faint, boxShadow: on ? `0 0 ${size * 0.6}px ${mix(ACC, 70)}` : undefined }} />
  );
}

// ── Effects ──────────────────────────────────────────────────────────────────

function SmokeFx() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 9 }, (_, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: `${8 + (i * 11) % 84}%`, bottom: `${(i * 23) % 60}%`, width: 70, height: 70, background: `radial-gradient(circle, ${T.smoke}55, transparent 70%)`, filter: 'blur(6px)' }}
          animate={{ y: [0, -18, 0], x: [0, i % 2 ? 10 : -10, 0], opacity: [0.25, 0.7, 0.25] }} transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.3 }} />
      ))}
    </div>
  );
}
/** A warm field under a group with an Aura, with motes rising — not on each card */
function AuraFx() {
  return (
    <div className="absolute inset-x-[8%] inset-y-0 pointer-events-none">
      <motion.div className="absolute inset-0" style={{ background: `radial-gradient(60% 55% at 50% 60%, ${mix(ACC, 45)}, transparent 75%)` }}
        animate={{ opacity: [0.55, 0.9, 0.55] }} transition={{ duration: 3.2, repeat: Infinity }} />
      {Array.from({ length: 8 }, (_, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: `${10 + i * 11}%`, bottom: '10%', width: 4, height: 4, background: ACC_L, boxShadow: `0 0 6px ${ACC_L}` }}
          animate={{ y: [0, -90], opacity: [0, 0.9, 0] }} transition={{ duration: 2.6 + (i % 3) * 0.6, repeat: Infinity, delay: i * 0.35 }} />
      ))}
    </div>
  );
}

// ── A figure: a unit, or a card in the hand (same look) ─────────────────────

interface FigProps {
  card: GCard; m: number; side: Side; w: number; layoutId?: string;
  parts?: Part[]; smoke?: boolean; bump?: { v: number; key: number } | null;
  selected?: boolean; tired?: boolean; glow?: boolean; ghost?: boolean; settle?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void; tip?: React.ReactNode;
}
function Figure({ card, m, side, w, layoutId, parts, smoke, bump, selected, tired, glow, ghost, settle, onPointerDown, tip }: FigProps) {
  const font = useHeaderFont();
  const h = Math.round(w * 1.34);
  const k = w / 110;
  const buffs = (parts ?? []).filter(p => PART_ICON[p.kind]);
  const body = (
    <motion.div layoutId={layoutId} layout={!!layoutId} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      initial={settle ? { scale: 1.12, opacity: 1 } : { opacity: 0, scale: 0.75 }} animate={{ opacity: ghost ? 0 : 1, scale: 1, y: selected ? -8 : 0 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.3 } }}
      onPointerDown={onPointerDown} onClick={e => e.stopPropagation()} className="relative shrink-0 touch-none select-none"
      style={{ width: w, height: h, cursor: onPointerDown ? 'grab' : 'default' }}>
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
      <motion.span key={bump?.key ?? 'm'} className="absolute flex items-center justify-center font-logik-extended-bold leading-none z-10"
        initial={bump ? { scale: 1.8 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
        style={{ left: 5 * k, top: 5 * k, width: 34 * k, height: 34 * k, fontSize: 20 * k, borderRadius: '50% 50% 50% 10%', background: sideColor(side), color: '#07080b', boxShadow: bump ? `0 0 18px ${ACC_L}` : '0 2px 8px rgba(0,0,0,0.6)', ...font }}>{m}</motion.span>
      {buffs.length > 0 && (
        <div className="absolute flex flex-col gap-0.5 z-10" style={{ left: 5 * k, top: 42 * k }}>
          {buffs.map(p => {
            const Icon = PART_ICON[p.kind]!;
            return <span key={p.kind} className="flex items-center gap-0.5 rounded-full px-1 font-bold" style={{ fontSize: Math.max(10, 10 * k), background: 'rgba(0,0,0,0.78)', color: PART_COLOR[p.kind] }}><Icon style={{ width: 10 * k + 2, height: 10 * k + 2 }} />+{p.v}</span>;
          })}
        </div>
      )}
      {smoke && <span className="absolute z-10 rounded-full flex items-center justify-center" style={{ right: 4 * k, top: 36 * k, width: 22 * k, height: 22 * k, background: 'rgba(0,0,0,0.75)' }}><Wind style={{ width: 13 * k, height: 13 * k, color: T.smoke }} /></span>}
      <AnimatePresence>
        {bump && (
          <motion.span key={bump.key} className="absolute left-1/2 -translate-x-1/2 font-logik-extended-bold text-[22px] z-20 pointer-events-none" style={{ top: -4, color: ACC_L, textShadow: `0 0 12px ${ACC}, 0 2px 4px #000`, ...font }}
            initial={{ y: 0, opacity: 0 }} animate={{ y: -34, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.6 }}>+{bump.v}</motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
  return tip ? <Tip content={tip}>{body}</Tip> : body;
}

/** Hover card: who, the type and what it does, and (for your cards) how the strength adds up */
function CardInfo({ card, parts, m, note }: { card: GCard; parts?: Part[]; m: number; note?: string }) {
  const kw = KEYWORD[card.role];
  return (
    <div className="min-w-[240px] max-w-[300px] text-[12px] leading-snug">
      <div className="text-[15px] font-bold">{card.name}</div>
      {card.team && <div style={{ color: T.muted }}>{card.team.name}</div>}
      {card.series.opp && <div style={{ color: T.muted }}>vs {card.series.opp.name}</div>}
      <div className="mt-2"><b className="uppercase">{kw.ability}</b> {kw.text}</div>
      {parts && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 uppercase tracking-wide">
          {parts.map((p, i) => (
            <React.Fragment key={i}>
              <span>{p.kind === 'card' ? 'Karta' : p.label}</span>
              <span className="text-right font-bold">{p.kind === 'card' ? p.v : <span style={{ color: signColor(p.v) }}>({p.v > 0 ? '+' : p.v < 0 ? '−' : ''}{Math.abs(p.v)})</span>}</span>
            </React.Fragment>
          ))}
          <span className="col-span-2 h-px my-1" style={{ background: T.faint }} />
          <span className="font-bold">Siła</span><span className="text-right font-bold" style={{ color: signColor(m) }}>({m})</span>
        </div>
      )}
      {!parts && <div className="mt-2 uppercase tracking-wide font-bold">Siła <span style={{ color: signColor(m) }}>({m})</span></div>}
      {note && <div className="mt-2" style={{ color: T.muted }}>{note}</div>}
    </div>
  );
}

// ── Where things may go ─────────────────────────────────────────────────────

interface Target { ok: boolean; text: string; tone: 'good' | 'fight' | 'plain' | 'off'; free: boolean }
function powerIfMoved(s: OState, ids: string[], to: Loc) {
  const t: OState = { ...s, units: s.units.map(u => (ids.includes(u.uid) ? { ...u, loc: to } : u)) };
  return t.units.filter(u => u.side === 0 && u.loc === to).reduce((a, u) => a + might(t, u), 0);
}
function unitTarget(s: OState, ids: string[], to: Loc): Target {
  const why = canMove(s, ids, to);
  if (why) return { ok: false, text: why, tone: 'off', free: false };
  const free = freeMove(s, ids);
  if (to === 'base') return { ok: true, text: 'Do bazy', tone: 'plain', free };
  const p = powerIfMoved(s, ids, to);
  if (s.units.some(u => u.side === 1 && u.loc === to)) return { ok: true, text: `Atak · Twoja siła ${p}`, tone: 'fight', free };
  if (s.objectives[to].owner !== 0) return { ok: true, text: `Przejęcie · +${takePoints(s.objectives[to].id)} pkt`, tone: 'good', free };
  return { ok: true, text: `Wzmocnienie · siła ${p}`, tone: 'plain', free };
}
const TONE = { good: T.me, fight: T.warn, plain: T.text, off: T.muted };

function Pill({ t }: { t: Target }) {
  return (
    <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-full pl-2.5 pr-4 py-1.5 text-[13px] font-bold whitespace-nowrap pointer-events-none"
      style={{ background: TONE[t.tone], color: '#07080b', boxShadow: `0 0 18px ${TONE[t.tone]}66` }}>
      {t.free ? <><Wind className="w-4 h-4" />Smoke: bez rozkazu ·</> : null}<span>{t.text}</span>
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
  const ready = mine && s.phase === 'move' && !u.moved && !u.fresh;
  const smoke = mine && s.phase === 'move' && s.freeRotation && !u.moved && !u.fresh && s.units.some(o => o.side === 0 && o.loc === u.loc && o.card.role === 'Soft Support' && !o.moved && !o.fresh);
  const parts = u.side === 0 ? strengthParts(s, u, defending) : undefined;
  const note = u.side === s.active && u.fresh ? 'Wystawiony w tej turze: ruszy się w następnej.' : u.side === s.active && u.moved ? 'Już się ruszył w tej turze.' : undefined;
  const settle = a.settled.has(u.uid);
  return (
    <Figure key={u.uid} layoutId={settle ? undefined : u.uid} settle={settle} card={u.card} m={m} side={u.side} w={w} parts={parts} smoke={smoke}
      bump={a.bumps[u.uid] ?? null} selected={a.sel.includes(u.uid)} tired={u.side === s.active && (u.moved || u.fresh)} glow={ready && !a.sel.length && !smoke} ghost={a.hidden.has(u.uid)}
      onPointerDown={ready ? e => a.pressUnit(e, u) : undefined} tip={<CardInfo card={u.card} parts={parts} m={m} note={note} />} />
  );
}

/** The arena background: the minimap, centred on where the objective really is, plus a marker */
function Arena({ id }: { id: ObjId }) {
  const [ref, box] = useSize<HTMLDivElement>();
  const [x, y] = MAP_AT[id];
  const D = box.w / MAP_VIEW;
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      {box.w > 0 && <div className="absolute inset-0" style={{ backgroundImage: 'url(/stats-lab/minimap-741.webp)', backgroundSize: `${D}px ${D}px`, backgroundPosition: `${box.w / 2 - x * D}px ${box.h / 2 - y * D}px`, filter: 'saturate(0.9) brightness(0.62)' }} />}
      <motion.span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 120, height: 120, boxShadow: `0 0 0 2px ${mix('#ffffff', 35)}` }}
        animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.5, 0.15, 0.5] }} transition={{ duration: 3, repeat: Infinity }} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${T.bg}, transparent 12%, transparent 88%, ${T.bg}), linear-gradient(180deg, ${T.bg}, transparent 10%, transparent 90%, ${T.bg})` }} />
    </div>
  );
}

function Objective({ i, a, target, onSend, rowRef, w }: { i: 0 | 1 | 2; a: AreaCtx; target: Target | null; onSend: () => void; rowRef?: React.Ref<HTMLDivElement>; w: number }) {
  const font = useHeaderFont();
  const { s } = a;
  const ob = s.objectives[i]; const def = OBJECTIVES[ob.id];
  const units = (side: Side) => s.units.filter(u => u.side === side && u.loc === i);
  const mineHere = units(0);
  const smokeHere = mineHere.some(u => u.card.role === 'Soft Support' && !u.moved && !u.fresh) && s.active === 0 && s.phase === 'move' && s.freeRotation;
  const auraHere = mineHere.some(u => u.card.role === 'Hard Support');
  const off = target && !target.ok;
  return (
    <div data-drop={i} data-obj={i} onClick={() => target?.ok && onSend()} className="relative flex-1 min-w-0 flex flex-col"
      style={{ filter: off ? 'grayscale(1) brightness(0.45)' : undefined, transition: 'filter .2s', cursor: target?.ok ? 'pointer' : undefined }}>
      <Arena id={ob.id} />
      {ob.owner != null && <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 50% at 50% ${ob.owner === 0 ? 80 : 20}%, ${sideColor(ob.owner)}30, transparent 70%)` }} />}
      {target?.ok && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${TONE[target.tone]}99`, background: `${TONE[target.tone]}14` }} />}
      <div ref={rowRef} className="relative flex-1 min-h-0 flex justify-center items-end gap-[10px] pb-2">
        <AnimatePresence>{units(1).map(u => unitFigure(u, w, a))}</AnimatePresence>
      </div>
      <div className="relative text-center px-3 py-1 pointer-events-none">
        <div className="flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={itemIcon(def.icon)} alt="" className="w-[38px] h-[28px] object-cover rounded-[5px]" style={{ boxShadow: '0 2px 10px #000' }} />
          <span className="font-logik-extended-bold uppercase text-[23px] leading-none" style={{ color: ob.owner == null ? T.text : sideColor(ob.owner), textShadow: '0 2px 10px #000', ...font }}>{def.name}</span>
        </div>
        <div className="text-[13px] mt-1" style={{ color: T.text, textShadow: '0 1px 6px #000' }}>{def.rule}</div>
        <div className="flex justify-center gap-4 mt-1 text-[12px] font-bold uppercase tracking-wider pointer-events-auto" style={{ color: T.pts, textShadow: '0 1px 6px #000' }}>
          <Tip content="Gdy wejdziesz na objective, który nie jest Twój (jeśli ktoś na nim stoi, najpierw wygraj walkę)"><span className="cursor-help">przejęcie +{takePoints(ob.id)} pkt</span></Tip>
          <Tip content="Na początku Twojej tury: +1 pkt za każdy Twój objective, na którym stoi Twoja jednostka"><span className="cursor-help">trzymanie +1 pkt/turę</span></Tip>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 flex justify-center items-start gap-[10px] pt-2">
        {auraHere && <AuraFx />}
        {smokeHere && <SmokeFx />}
        <AnimatePresence>{mineHere.map(u => unitFigure(u, w, a))}</AnimatePresence>
      </div>
      {target && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center z-20 px-3 pointer-events-none">
          {target.ok ? <Pill t={target} /> : <span className="text-center text-[12px] leading-snug font-bold" style={{ color: T.text, textShadow: '0 1px 4px #000' }}>{target.text}</span>}
        </div>
      )}
    </div>
  );
}

function BaseBand({ side, a, target, onSend }: { side: Side; a: AreaCtx; target?: Target | null; onSend?: () => void }) {
  const font = useHeaderFont();
  const { s } = a;
  const units = s.units.filter(u => u.side === side && u.loc === 'base');
  const line: React.CSSProperties = side === 0 ? { top: 0 } : { bottom: 0 };
  const smokeHere = side === 0 && units.some(u => u.card.role === 'Soft Support' && !u.moved && !u.fresh) && s.active === 0 && s.phase === 'move' && s.freeRotation;
  const off = target && !target.ok;
  return (
    <div data-drop={side === 0 ? 'base' : undefined} onClick={() => target?.ok && onSend?.()}
      className="relative h-[132px] shrink-0 flex items-center gap-3 px-6"
      style={{ background: `linear-gradient(90deg, ${sideColor(side)}${target?.ok ? '33' : '1a'}, transparent 60%)`, filter: off ? 'grayscale(1) brightness(0.45)' : undefined, transition: 'background .2s, filter .2s', cursor: target?.ok ? 'pointer' : undefined }}>
      <div className="absolute inset-x-0 h-px" style={{ ...line, background: `linear-gradient(90deg, ${sideColor(side)}66, transparent 70%)` }} />
      {target?.ok && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${TONE[target.tone]}99` }} />}
      <span className="font-logik-extended-bold uppercase text-[13px] tracking-[0.18em] w-[96px] shrink-0 leading-tight" style={{ color: sideColor(side), ...font }}>{side === 0 ? 'Twoja baza' : 'Baza rywala'}</span>
      <div className="relative flex items-center gap-3">
        {smokeHere && <SmokeFx />}
        <AnimatePresence>{units.map(u => unitFigure(u, 90, a))}</AnimatePresence>
      </div>
      {target?.ok && <div className="ml-auto pointer-events-none"><Pill t={target} /></div>}
    </div>
  );
}

function ScoreRace({ shown }: { shown: [number, number] }) {
  const font = useHeaderFont();
  const pips = (side: Side) => Array.from({ length: WIN_POINTS }, (_, i) => {
    const lit = i < shown[side];
    return <span key={i} className="h-[10px] flex-1 rounded-full transition-all duration-500" style={{ background: lit ? sideColor(side) : T.faint, boxShadow: lit ? `0 0 8px ${sideColor(side)}` : undefined }} />;
  });
  return (
    <div className="flex items-center gap-4 w-[760px]">
      <span data-score={0} className="font-logik-extended-bold text-[34px] w-12 text-right tabular-nums" style={{ color: T.me, ...font }}>{shown[0]}</span>
      <div className="flex-1 flex gap-1">{pips(0)}</div>
      <div className="text-center leading-none">
        <div className="font-logik-extended-bold text-[22px]" style={{ color: T.text, ...font }}>{WIN_POINTS}</div>
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
    <Tip content={`${c.name} · ${KEYWORD[c.role].name}`}>
      <span className="relative inline-block" style={{ filter: dead ? 'grayscale(1) brightness(0.6)' : undefined }}>
        <Avatar player={c.player} size={26} />
        {dead && <Skull className="absolute -right-1 -bottom-1 w-3.5 h-3.5" style={{ color: T.neg }} />}
      </span>
    </Tip>
  );
}
function ObjTag({ s, at }: { s: OState; at: Loc }) {
  if (at === 'base') return <span className="inline-flex items-center gap-1" style={{ color: T.muted }}><Home className="w-4 h-4" />baza</span>;
  const d = OBJECTIVES[s.objectives[at].id];
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="inline-flex items-center gap-1.5 font-bold"><img src={itemIcon(d.icon)} alt="" className="w-[26px] h-[19px] object-cover rounded-[3px]" />{d.name}</span>;
}
function EvRow({ s, e }: { s: OState; e: Ev }) {
  const font = useHeaderFont();
  const c = sideColor(e.side);
  switch (e.kind) {
    case 'turn': return null;
    case 'deploy':
      return <div className="flex items-center gap-2"><Plus className="w-4 h-4" style={{ color: c }} /><span className="flex -space-x-1.5">{e.cards.map(x => <Mini key={x.id} c={x} />)}</span><ArrowRight className="w-4 h-4 opacity-50" /><ObjTag s={s} at="base" /></div>;
    case 'move':
      return <div className="flex items-center gap-2">{e.free ? <Wind className="w-4 h-4" style={{ color: T.smoke }} /> : <ArrowRight className="w-4 h-4" style={{ color: c }} />}<span className="flex -space-x-1.5">{e.cards.map(x => <Mini key={x.id} c={x} />)}</span><ObjTag s={s} at={e.from} /><ArrowRight className="w-4 h-4 opacity-50" /><ObjTag s={s} at={e.to} /></div>;
    case 'fight':
      return (
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4" style={{ color: T.warn }} /><ObjTag s={s} at={e.at} />
          <span className="font-logik-extended-bold text-[16px] tabular-nums" style={font}><span style={{ color: T.me }}>{e.power[0]}</span><span className="opacity-40"> : </span><span style={{ color: T.rival }}>{e.power[1]}</span></span>
          {e.died.length > 0 && <span className="flex gap-1 ml-1">{e.died.map(d => <Mini key={d.card.id + d.side} c={d.card} dead />)}</span>}
        </div>
      );
    case 'points':
      return <div className="flex items-center gap-2">{e.why === 'take' ? <Flag className="w-4 h-4" style={{ color: c }} /> : <Shield className="w-4 h-4" style={{ color: c }} />}<ObjTag s={s} at={e.at} /><span className="font-logik-extended-bold" style={{ color: T.pts, ...font }}>+{e.pts}</span></div>;
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

// ── The fight scene ─────────────────────────────────────────────────────────

const HIT_AT = 1.5; const WAVE = 0.5;
function FightScene({ f, name, icon, onDone }: { f: Fight; name: string; icon: string; onDone: () => void }) {
  const font = useHeaderFont();
  const [t, setT] = useState(0);
  const done = useRef(onDone); done.current = onDone;
  // Both sides hit at the same time: the n-th hit of each side lands in the same wave
  const wave = useMemo(() => {
    const side = (uid: string) => f.lines.find(l => l.uid === uid)!.side;
    const n: Record<Side, number> = { 0: 0, 1: 0 };
    return f.hits.map(h => n[side(h.uid)]++);
  }, [f]);
  const waves = Math.max(0, ...wave.map(w => w + 1));
  const total = HIT_AT + waves * WAVE + 1.3;
  useEffect(() => {
    const start = performance.now(); let raf = 0;
    const tick = () => { const x = (performance.now() - start) / 1000; setT(x); if (x < total) raf = requestAnimationFrame(tick); else done.current(); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);
  const row = (side: Side) => f.lines.filter(l => l.side === side);
  const counted = (side: Side) => Math.round(f.power[side] * Math.min(1, Math.max(0, (t - 0.4) / 0.8)));
  const lunge = t > 1.15 && t < 1.5;
  const result = t > HIT_AT + waves * WAVE + 0.15;
  const outcomeText = f.outcome === 'took' ? (f.attacker === 0 ? 'Przejmujesz objective' : 'Rywal przejmuje objective')
    : f.outcome === 'held' ? (f.attacker === 0 ? 'Obrona rywala wytrzymała' : 'Twoja obrona wytrzymała')
    : f.outcome === 'repelled' ? 'Odparci: atakujący wracają do bazy' : 'Polegli wszyscy';
  const goodForMe = (f.outcome === 'took' && f.attacker === 0) || ((f.outcome === 'held' || f.outcome === 'repelled') && f.attacker === 1);

  const card = (l: Fight['lines'][number]) => {
    const i = f.hits.findIndex(h => h.uid === l.uid); const h = i >= 0 ? f.hits[i] : null;
    const hitT = HIT_AT + (i >= 0 ? wave[i] : 0) * WAVE;
    const hit = !!h && t > hitT; const burning = !!h?.died && t > hitT + 0.12;
    return (
      <motion.div key={l.uid} className="relative"
        animate={{ x: hit && t < hitT + 0.3 ? [0, -10, 10, -6, 0] : 0, y: lunge ? (l.side === 0 ? -34 : 34) : 0, opacity: burning && t > hitT + 0.8 ? 0.25 : 1, filter: burning ? 'grayscale(0.8) brightness(0.6)' : 'none' }}
        transition={{ duration: 0.25 }}>
        <Figure card={l.card} m={l.m} side={l.side} w={128} parts={l.parts} />
        <div className="absolute -bottom-7 inset-x-0 flex justify-center gap-1">
          {l.parts.map((p, j) => (
            <motion.span key={j} className="rounded-full px-1.5 text-[11px] font-bold whitespace-nowrap" style={{ background: 'rgba(0,0,0,0.78)', color: p.kind === 'card' ? T.text : signColor(p.v) }}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: t > 0.25 + j * 0.12 ? 1 : 0, y: t > 0.25 + j * 0.12 ? 0 : 6 }}>{j && p.v >= 0 ? '+' : ''}{p.v}{p.kind === 'card' ? '' : ` ${p.label}`}</motion.span>
          ))}
        </div>
        {hit && <motion.div className="absolute inset-0 rounded-[14px] pointer-events-none" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }} style={{ background: 'rgba(255,60,40,0.55)' }} />}
        {hit && (
          <motion.span className="absolute left-1/2 -translate-x-1/2 top-6 font-logik-extended-bold text-[34px] z-20" style={{ color: '#ff6b5b', textShadow: '0 0 12px #000, 0 2px 4px #000', ...font }}
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>−{h!.dmg}</motion.span>
        )}
        {burning && (
          <motion.div className="absolute inset-0 rounded-[14px] pointer-events-none overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="absolute inset-x-0 bottom-0" style={{ background: 'linear-gradient(0deg, #ff3d00, #ff9100cc 40%, #ffd60033 75%, transparent)', mixBlendMode: 'screen' }}
              initial={{ height: '0%' }} animate={{ height: ['0%', '110%', '110%'], opacity: [1, 1, 0.4] }} transition={{ duration: 0.8 }} />
            {Array.from({ length: 7 }, (_, j) => (
              <motion.span key={j} className="absolute rounded-full" style={{ left: `${10 + j * 12}%`, bottom: 0, width: 6, height: 6, background: '#ffb347', boxShadow: '0 0 8px #ff6d00' }}
                animate={{ y: [-10, -140], opacity: [1, 0] }} transition={{ duration: 0.9 + (j % 3) * 0.3, delay: j * 0.06 }} />
            ))}
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 cursor-pointer" onClick={() => done.current()}
      style={{ background: 'radial-gradient(circle at 50% 50%, rgba(40,20,14,0.88), rgba(5,6,9,0.94) 70%)', backdropFilter: 'blur(5px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="flex items-center gap-3" initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={itemIcon(icon)} alt="" className="w-[46px] h-[34px] object-cover rounded-md" />
        <span className="font-logik-extended-bold uppercase text-[34px]" style={{ color: T.text, ...font }}>Walka: {name}</span>
      </motion.div>
      {([1, 0] as Side[]).map(side => (
        <div key={side} className="flex items-center gap-8">
          <div className="w-[120px] text-right">
            <div className="font-logik-extended-bold text-[56px] leading-none tabular-nums" style={{ color: sideColor(side), textShadow: `0 0 20px ${sideColor(side)}`, ...font }}>{counted(side)}</div>
            <div className="text-[12px] uppercase tracking-widest" style={{ color: T.muted }}>{side === 0 ? 'Twoja siła' : 'Siła rywala'}</div>
          </div>
          <div className="flex gap-5 pb-7">{row(side).map(card)}</div>
        </div>
      ))}
      <div className="h-[64px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div key="r" className="font-logik-extended-bold uppercase text-[32px]" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ color: goodForMe ? T.me : T.rival, textShadow: `0 0 24px ${goodForMe ? T.me : T.rival}`, ...font }}>{outcomeText}{f.points ? ` · +${f.points} pkt` : ''}</motion.div>
          ) : (
            <motion.div key="h" className="text-[14px] max-w-[760px] text-center" style={{ color: T.muted }} exit={{ opacity: 0 }}>
              Każda strona zadaje tyle obrażeń, ile ma siły łącznie. Najpierw obrywa Offlane, potem najsłabsi. Ginie ten, kto dostanie tyle, ile sam ma siły.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="absolute bottom-4 text-[11px]" style={{ color: T.muted }}>kliknij, by pominąć</div>
    </motion.div>
  );
}

// ── The end ─────────────────────────────────────────────────────────────────

function EndScreen({ won, score, turns, onRematch, onNew }: { won: boolean; score: [number, number]; turns: number; onRematch: () => void; onNew: () => void }) {
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
      <motion.div className="relative mt-4 font-logik-extended-bold text-[44px] tabular-nums" style={{ color: T.text, ...font }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
        <span style={{ color: T.me }}>{score[0]}</span><span className="opacity-40"> : </span><span style={{ color: T.rival }}>{score[1]}</span>
        <span className="text-[16px] ml-4 align-middle" style={{ color: T.muted }}>po {turns} turach</span>
      </motion.div>
      <motion.div className="relative flex gap-4 mt-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }}>
        <motion.button type="button" onClick={onRematch} whileHover={{ scale: 1.05 }} className="rounded-full px-9 py-3.5 font-logik-extended-bold uppercase tracking-widest text-white" style={{ background: ACC, boxShadow: `0 0 30px ${mix(ACC, 60)}`, ...font }}>Rewanż</motion.button>
        <motion.button type="button" onClick={onNew} whileHover={{ scale: 1.05 }} className="rounded-full px-9 py-3.5 font-logik-extended-bold uppercase tracking-widest text-white" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)', ...font }}>Nowy rywal</motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── The game ─────────────────────────────────────────────────────────────────

interface Flyer { id: string; side: Side; pts: number; why: Gain['why']; from: { x: number; y: number }; to: { x: number; y: number } }
interface DragState { kind: 'card' | 'units'; ids: string[] }

export function OutpostsGame({ deck, all }: { deck: GCard[]; all: GCard[] }) {
  const font = useHeaderFont();
  const fit = useFitScale();
  const [cpu, setCpu] = useState<GCard[]>([]);
  const [s, setS] = useState<OState | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [selCards, setSelCards] = useState<string[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<{ text: string; side: Side; key: number } | null>(null);
  const [scene, setScene] = useState<Fight | null>(null);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [owed, setOwed] = useState<[number, number]>([0, 0]);
  const [note, setNote] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, gx: 0, gy: 0, tilt: 0, lastX: 0 });
  const [objEl, setObjEl] = useState<HTMLDivElement | null>(null);
  const [objBox, setObjBox] = useState({ w: 400, h: 300 });
  const seenFight = useRef(0); const seenGain = useRef(0); const pendingGains = useRef<Gain[]>([]);
  const prevMight = useRef<Record<string, number>>({});
  const stateRef = useRef<OState | null>(null);
  stateRef.current = s;

  const start = (rematch = false) => {
    const theirs = rematch && cpu.length ? cpu : cpuDeck(all, OUTPOSTS_RULE, avgOvr(deck), new Set(deck.map(c => c.pid)));
    seenFight.current = 0; seenGain.current = 0; pendingGains.current = []; prevMight.current = {};
    setCpu(theirs); setS(newGame([deck, theirs])); setSel([]); setSelCards([]); setScene(null); setFlyers([]); setOwed([0, 0]);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { start(); }, [deck]);

  useEffect(() => {
    if (!objEl) return;
    const ro = new ResizeObserver(() => setObjBox({ w: objEl.clientWidth, h: objEl.clientHeight }));
    ro.observe(objEl); return () => ro.disconnect();
  }, [objEl]);
  const figW = Math.max(60, Math.min(112, (objBox.w - 40) / PER_SIDE_AT_OBJECTIVE, (objBox.h - 14) / 1.34));

  // New fight → scene; new points → fly once the scene is over
  useEffect(() => {
    if (!s) return;
    if (s.fight && s.fight.key !== seenFight.current) { seenFight.current = s.fight.key; setScene(s.fight); }
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
  useEffect(() => {
    if (active == null || over) return;
    setBanner({ text: active === 0 ? 'Twoja tura' : 'Tura rywala', side: active, key: turn ?? 0 });
    const t = setTimeout(() => setBanner(null), 1100);
    return () => clearTimeout(t);
  }, [active, turn, over]);

  // The computer: one action at a time, waiting for scenes and flying points
  useEffect(() => {
    if (!s || s.active !== 1 || s.winner !== null || scene || flyers.length || banner || logOpen) return;
    const t = setTimeout(() => { const a = cpuNextAction(s); setS(a ? applyAct(s, a) : endTurn(s)); }, 900);
    return () => clearTimeout(t);
  }, [s, scene, flyers.length, banner, logOpen]);

  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 2600); return () => clearTimeout(t); }, [note]);
  useEffect(() => { if (!settled.size) return; const t = setTimeout(() => setSettled(new Set()), 700); return () => clearTimeout(t); }, [settled]);

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
    const onMove = (ev: PointerEvent) => {
      pointer.current.x = ev.clientX; pointer.current.y = ev.clientY;
      if (!started && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 4) {
        started = true;
        if (kind === 'units') setSel(ids); else setSelCards(ids);
        setDrag({ kind, ids });
      }
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
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
        setTimeout(() => { setDrag(null); if (kind === 'units') setSel([]); }, 230);
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
      if (to !== 'base') return { ok: false, text: 'Karty z ręki idą do bazy', tone: 'off', free: false };
      const n = movingCards.length;
      return n <= s.orders ? { ok: true, text: `Wystaw · ${n} ${n === 1 ? 'rozkaz' : n < 5 ? 'rozkazy' : 'rozkazów'}`, tone: 'good', free: false } : { ok: false, text: `Za mało rozkazów (${s.orders})`, tone: 'off', free: false };
    }
    if (movingUnits.length && phase === 'move') return unitTarget(s, movingUnits, to);
    return null;
  };
  const sendTo = (to: Loc) => { if (movingCards.length && to === 'base') doDeploy(movingCards); else if (sel.length) doMove(sel, to); };
  const pendingCost = movingCards.length ? movingCards.length : movingUnits.length && phase === 'move' ? (freeMove(s, movingUnits) ? 0 : 1) : 0;

  const rested = s.units.filter(u => u.side === 0 && !u.moved && !u.fresh);
  const canPlay = mine && phase === 'deploy' && s.orders > 0 && me.hand.length > 0;
  const canGo = mine && phase === 'move' && rested.some(u => (['base', 0, 1, 2] as Loc[]).some(l => !canMove(s, [u.uid], l)));
  const recommend = mine && !scene && ((phase === 'deploy' && !canPlay) || (phase === 'move' && !canGo));
  const shown: [number, number] = [s.sides[0].score - owed[0], s.sides[1].score - owed[1]];
  const lastRival = [...s.events].reverse().find(e => e.side === 1 && e.kind !== 'turn');

  const prompt = !mine ? null
    : phase === 'deploy'
      ? (movingCards.length ? 'Kliknij swoją bazę, by wystawić zaznaczone karty' : canPlay ? 'Wystaw karty z ręki do bazy. Każda kosztuje 1 rozkaz.' : 'Przejdź do rozkazów')
      : (movingUnits.length ? 'Kliknij objective albo bazę' : canGo ? 'Wyślij jednostki na objective. 1 rozkaz za grupę.' : 'Zakończ turę');

  return (
    <div ref={boardRef} className="relative h-full flex flex-col overflow-hidden select-none" style={{ background: `radial-gradient(110% 80% at 45% 0%, #191c25, ${T.bg} 62%)`, color: T.text }}
      onClick={e => { if (e.target === e.currentTarget) { setSel([]); setSelCards([]); } }}>
      <LayoutGroup>
        {/* Top HUD */}
        <div className="h-[64px] shrink-0 flex items-center justify-center relative">
          <Tip content={`Rywal · na ręce: ${rival.hand.length} · w talii: ${rival.deck.length} · polegli: ${rival.grave.length}`}>
            <div className="absolute left-6 flex items-center gap-3 cursor-help">
              <div className="flex -space-x-5">{rival.hand.map((_, i) => <div key={i} style={{ transform: `rotate(${(i - rival.hand.length / 2) * 6}deg)` }}><CardBack w={28} /></div>)}</div>
              <span className="font-logik-extended-bold text-[22px]" style={{ color: T.rival, ...font }}>{rival.hand.length}</span>
              <span className="text-[11px] uppercase tracking-widest leading-tight" style={{ color: T.muted }}>kart na ręce<br />rywala</span>
            </div>
          </Tip>
          <ScoreRace shown={shown} />
          <Tip content="Przebieg meczu">
            <motion.button type="button" onClick={() => setLogOpen(true)} whileHover={{ scale: 1.08 }} className="absolute right-6 w-11 h-11 rounded-full flex items-center justify-center"
              style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }} aria-label="Przebieg meczu"><ScrollText className="w-5 h-5" /></motion.button>
          </Tip>
        </div>
        <BaseBand side={1} a={ctx} target={movingCards.length || movingUnits.length ? { ok: false, text: '', tone: 'off', free: false } : null} />
        <div className="relative flex-1 min-h-0 flex">
          {([0, 1, 2] as const).map(i => (
            <React.Fragment key={i}>
              {i > 0 && <div className="w-px shrink-0" style={{ background: `linear-gradient(180deg, transparent, ${T.line}, transparent)` }} />}
              <Objective i={i} a={ctx} target={targetFor(i)} onSend={() => sendTo(i)} w={figW} rowRef={i === 0 ? setObjEl : undefined} />
            </React.Fragment>
          ))}
        </div>
        <BaseBand side={0} a={ctx} target={targetFor('base')} onSend={() => sendTo('base')} />

        {/* Bottom HUD: prompt + hand, the orders and the turn button right beside it */}
        <div className="relative h-[206px] shrink-0 flex">
          <div className="w-[300px] shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col items-center">
            <div className="relative z-30 h-[40px] mt-1 flex items-center">
              <AnimatePresence mode="wait">
                {mine && (note || prompt) && (
                  <motion.div key={(note ?? '') + (prompt ?? '') + phase} className="flex items-center gap-3 px-5 h-[38px] rounded-full"
                    initial={{ opacity: 0, y: 14, scale: 1.08 }} animate={{ opacity: 1, y: 0, scale: 1, boxShadow: [`0 0 0 2px ${ACC_L}, 0 0 30px ${mix(ACC, 70)}`, `0 0 0 1px ${T.faint}, 0 0 0px transparent`] }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, boxShadow: { duration: 1.4 } }} style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <span className="font-logik-extended-bold uppercase text-[12px] tracking-widest whitespace-nowrap" style={{ color: ACC_L, ...font }}>{phase === 'deploy' ? 'Faza 1/2 · Wystawianie' : 'Faza 2/2 · Rozkazy'}</span>
                    <span className="text-[14px] font-bold whitespace-nowrap" style={{ color: note ? T.warn : T.text }}>{note ?? prompt}</span>
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
              {me.hand.map((c, i) => {
                const n = me.hand.length; const off = i - (n - 1) / 2;
                const can = mine && !canDeploy(s, c.id);
                const picked = movingCards.includes(c.id);
                const dragged = drag?.kind === 'card' && drag.ids.includes(c.id);
                return (
                  <motion.div key={c.id} className="-mx-1.5" style={{ zIndex: picked ? 40 : i }}
                    animate={{ rotate: off * 3, y: Math.abs(off) * 3 + (picked ? -10 : 0), opacity: dragged ? 0 : 1 }}
                    whileHover={can && !drag ? { y: -14, scale: 1.05 } : undefined}>
                    <Figure card={c} layoutId={`0:${c.id}`} m={baseMight(c)} side={0} w={112} selected={picked} glow={can && !movingCards.length} tired={!can}
                      onPointerDown={can ? e => pressCard(e, c) : undefined} tip={drag ? undefined : <CardInfo card={c} parts={[{ kind: 'card', label: 'Karta', v: cardStrength(c) }, ...(baseMight(c) !== cardStrength(c) ? [{ kind: 'role' as const, label: c.role === 'Offlane' ? 'Offlane' : 'Support', v: baseMight(c) - cardStrength(c) }] : [])]} m={baseMight(c)} />} />
                  </motion.div>
                );
              })}
              {!me.hand.length && <span className="text-[12px] mb-10" style={{ color: T.muted }}>Ręka pusta: na początku tury dobierasz 1 kartę</span>}
            </div>
          </div>
          {/* Orders + turn button, right next to the hand */}
          <div className="w-[300px] shrink-0 flex items-center justify-center gap-5">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2.5">
                {Array.from({ length: Math.max(ORDERS, s.orders) }, (_, i) => <Gem key={i} size={20} on={mine && i < s.orders} pending={mine && i >= s.orders - pendingCost && i < s.orders} />)}
              </div>
              <span className="text-[11px] uppercase tracking-widest" style={{ color: T.muted }}>rozkazy{pendingCost ? ` · −${pendingCost}` : ''}</span>
            </div>
            <motion.button type="button" disabled={!mine}
              onClick={() => { const cur = stateRef.current; if (!cur) return; setS(cur.phase === 'deploy' ? startOrders(cur) : endTurn(cur)); setSel([]); setSelCards([]); }}
              className="relative w-[124px] h-[124px] rounded-full flex flex-col items-center justify-center font-logik-extended-bold uppercase text-white disabled:cursor-not-allowed"
              whileHover={mine ? { scale: 1.06, filter: 'brightness(1.35)' } : undefined}
              animate={recommend ? { boxShadow: [`0 0 0 3px ${ACC_L}, 0 0 8px ${mix(ACC, 60)}`, `0 0 0 3px ${ACC_L}, 0 0 40px ${ACC}`, `0 0 0 3px ${ACC_L}, 0 0 8px ${mix(ACC, 60)}`], backgroundColor: [mix(ACC, 70), ACC, mix(ACC, 70)] } : { boxShadow: `0 0 0 2px ${mine ? mix(ACC, 70) : T.faint}`, backgroundColor: mine ? mix(ACC, 30) : '#1a1c22' }}
              transition={recommend ? { duration: 1.8, repeat: Infinity } : { duration: 0.3 }}
              style={{ color: mine ? '#fff' : T.muted, ...font }}>
              <span className="text-[16px] leading-tight text-center">{!mine ? (s.winner === null ? 'Tura rywala' : 'Koniec') : phase === 'deploy' ? 'Dalej' : 'Koniec tury'}</span>
              {mine && <span className="text-[9px] tracking-widest mt-1 opacity-80">{phase === 'deploy' ? 'do rozkazów' : 'oddaj ruch'}</span>}
            </motion.button>
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
      <AnimatePresence>
        {scene && <FightScene key={scene.key} f={scene} name={OBJECTIVES[s.objectives[scene.at].id].name} icon={OBJECTIVES[s.objectives[scene.at].id].icon} onDone={() => setScene(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {s.winner !== null && !scene && !flyers.length && (
          <EndScreen won={s.winner === 0} score={[s.sides[0].score, s.sides[1].score]} turns={Math.ceil(s.turn / 2)} onRematch={() => start(true)} onNew={() => start()} />
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
