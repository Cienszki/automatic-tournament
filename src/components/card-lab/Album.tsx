'use client';

// The album: a few teams per page, six places per team (five roster players + the standin slot).
// The best card of a player sits on top, the others pile up underneath; a missing player is a
// faded photo, like an empty sticker spot. Collectors can complete every player, not every card.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Avatar, C, TeamLogo, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { useFitText, useLogoColor } from '@/components/teams-section/fit';
import type { PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { byStrength, ROLE_KEYS, ROLE_SHORT, TIER, tierOf, type GCard, type Tier } from '@/lib/card-lab/cards';
import { useTournament } from '@/context/TournamentContext';
import { count } from '@/lib/plural';
import { Action, CardBack, CardFace, Heading, Label, RATIO } from './ui';

const PER_PAGE = 4;
const CELL = 112;

interface Slot { key: string; label: string; player?: PlayerX; cards: GCard[] }

function slotsOf(team: TeamX, collection: GCard[]): Slot[] {
  const mine = collection.filter(c => c.team?.id === team.id).sort(byStrength);
  const roster = ROLE_KEYS.map(r => ({ r, p: team.players.find(p => !p.standin && p.role === r) }));
  const rosterIds = new Set(roster.map(x => x.p?.id).filter(Boolean));
  return [
    ...roster.map(({ r, p }) => ({ key: r, label: ROLE_SHORT[r], player: p, cards: p ? mine.filter(c => !c.standin && c.pid === p.id) : [] })),
    { key: 'standin', label: 'Standin', cards: mine.filter(c => c.standin || !rosterIds.has(c.pid)) },
  ];
}

function TeamName({ team, color }: { team: TeamX; color: string }) {
  const ref = useFitText<HTMLDivElement>(team.name, 26, 14);
  const font = useHeaderFont();
  return <div ref={ref} className="font-logik-extended-bold uppercase whitespace-nowrap overflow-hidden" style={{ color, ...font }}>{team.name}</div>;
}

function Cell({ slot, onOpen }: { slot: Slot; onOpen: () => void }) {
  const top = slot.cards[0];
  const pile = Math.min(slot.cards.length - 1, 3);
  const h = Math.round(CELL * RATIO);
  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: CELL }}>
      <div className="relative" style={{ width: CELL, height: h + pile * 5 }}>
        {Array.from({ length: pile }, (_, i) => (
          <div key={i} className="absolute left-0" style={{ top: (pile - i) * 5 }}><CardBack w={CELL} /></div>
        ))}
        <div className="absolute left-0 top-0">
          {top ? <CardFace c={top} w={CELL} onClick={onOpen} /> : (
            <div className="relative flex flex-col items-center justify-center gap-2 rounded-[10px]" style={{ width: CELL, height: h, border: `1.5px dashed ${ink(18)}`, background: ink(3) }}>
              {slot.player ? <div style={{ filter: 'grayscale(1)', opacity: 0.3 }}><Avatar player={slot.player} size={64} /></div> : <span className="text-3xl opacity-20">?</span>}
            </div>
          )}
        </div>
        {slot.cards.length > 1 && (
          <span className="absolute -right-2 -top-2 z-10 rounded-full px-2 py-0.5 text-[11px] font-bold text-black" style={{ background: C.secondary, boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
            ×{slot.cards.length > 9 ? '9+' : slot.cards.length}
          </span>
        )}
      </div>
      <div className="text-center leading-tight w-full">
        <div className="text-[12px] font-bold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: top ? C.heading : C.muted }}>{slot.player?.name ?? (slot.key === 'standin' ? (top?.name ?? 'Standin') : '—')}</div>
        <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{slot.label}</div>
      </div>
    </div>
  );
}

function TeamBlock({ team, collection, onOpen }: { team: TeamX; collection: GCard[]; onOpen: (s: Slot) => void }) {
  const color = useLogoColor(team.logoUrl) ?? C.heading;
  const slots = slotsOf(team, collection);
  const have = slots.slice(0, 5).filter(s => s.cards.length).length;
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-4">
        <TeamLogo team={team} size={54} />
        <div className="flex-1 min-w-0"><TeamName team={team} color={color} /></div>
        <span className="text-[13px] tabular-nums font-bold" style={{ color: have === 5 ? C.win : C.muted }}>{have}/5</span>
      </div>
      <div className="h-px" style={{ background: `linear-gradient(90deg, ${mix(color, 60)}, transparent)` }} />
      <div className="flex gap-3">{slots.map(s => <Cell key={s.key} slot={s} onOpen={() => onOpen(s)} />)}</div>
    </div>
  );
}

/** The sealed pack: tournament colours, logo, a foil sheen. Shakes harder and harder, then bursts. */
function Pack({ phase, onOpen }: { phase: 'idle' | 'shake' | 'burst'; onOpen: () => void }) {
  const { tournament } = useTournament();
  const font = useHeaderFont();
  const logo = tournament?.theme?.logoUrl;
  const W = 280; const H = 420; const TEAR = H * 0.2;
  const half = (top: boolean) => (
    <motion.div className="absolute inset-x-0 overflow-hidden" style={{ top: top ? 0 : TEAR, height: top ? TEAR : H - TEAR }}
      animate={phase === 'burst' ? (top ? { y: -260, x: 80, rotate: 28, opacity: 0 } : { y: 340, opacity: 0, scale: 0.9 }) : {}}
      transition={{ duration: 0.6, ease: 'easeIn' }}>
      <div className="absolute inset-x-0" style={{ top: top ? 0 : -TEAR, height: H }}>
        <div className="absolute inset-0 rounded-[18px]" style={{ background: `linear-gradient(155deg, ${C.primary}, ${mix(C.primary, 55)} 45%, #0b0c12 100%)`, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.22)' }} />
        <div className="absolute inset-0 rounded-[18px] opacity-40" style={{ background: 'repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,0.08) 22px 24px)' }} />
        <div className="absolute inset-x-0 flex flex-col items-center gap-4" style={{ top: H * 0.3 }}>
          {logo ? <img src={logo} alt="" className="w-[130px] h-[130px] object-contain" style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }} /> : null}
          <div className="font-logik-extended-bold uppercase text-[34px] leading-none text-white" style={{ textShadow: '0 3px 10px rgba(0,0,0,0.5)', ...font }}>Karty</div>
          <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/80">5 kart · 1 na pozycję</div>
        </div>
        {/* The tear line */}
        <div className="absolute inset-x-3 border-t-2 border-dashed border-white/40" style={{ top: TEAR }} />
      </div>
    </motion.div>
  );
  return (
    <motion.button type="button" onClick={phase === 'idle' ? onOpen : undefined} className="relative" style={{ width: W, height: H, cursor: phase === 'idle' ? 'pointer' : 'default' }}
      initial={{ y: -500, rotate: -8, opacity: 0 }}
      animate={phase === 'shake'
        ? { y: 0, opacity: 1, rotate: [0, -3, 3, -5, 5, -8, 8, -10, 10, 0], scale: [1, 1.02, 1.02, 1.05, 1.05, 1.08, 1.08, 1.12, 1.12, 1.15] }
        : { y: 0, rotate: 0, opacity: 1, scale: phase === 'burst' ? 1.15 : 1 }}
      transition={phase === 'shake' ? { duration: 0.9, ease: 'easeIn' } : { type: 'spring', stiffness: 120, damping: 14 }}
      whileHover={phase === 'idle' ? { scale: 1.04, rotate: -1.5 } : undefined}>
      {/* Glow under the pack, growing as it shakes */}
      <motion.div className="absolute -inset-10 rounded-full blur-3xl -z-10" style={{ background: mix(C.primary, 60) }}
        animate={phase === 'idle' ? { opacity: [0.35, 0.6, 0.35] } : { opacity: phase === 'burst' ? 0 : 1, scale: 1.4 }}
        transition={phase === 'idle' ? { duration: 2.2, repeat: Infinity } : { duration: phase === 'burst' ? 0.3 : 0.9 }} />
      {half(true)}{half(false)}
      {/* Foil sheen */}
      {phase !== 'burst' && (
        <div className="absolute inset-0 rounded-[18px] overflow-hidden pointer-events-none">
          <motion.div className="absolute -inset-y-10 w-24 -skew-x-12" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
            animate={{ x: [-140, W + 140] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.8 }} />
        </div>
      )}
    </motion.button>
  );
}

/** Light rays turning behind the cards */
function Rays({ color, size = 1300 }: { color: string; size?: number }) {
  const mask = 'radial-gradient(circle, black 10%, transparent 65%)';
  return (
    <motion.div className="absolute pointer-events-none" style={{ width: size, height: size, left: '50%', top: '50%', marginLeft: -size / 2, marginTop: -size / 2,
      background: `repeating-conic-gradient(from 0deg, ${mix(color, 20)} 0deg 7deg, transparent 7deg 20deg)`, maskImage: mask, WebkitMaskImage: mask }}
      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1, rotate: 360 }} exit={{ opacity: 0 }}
      transition={{ opacity: { duration: 0.5 }, scale: { duration: 0.6 }, rotate: { duration: 40, repeat: Infinity, ease: 'linear' } }} />
  );
}

/** Sparks flying out of a card when it turns */
function Sparks({ color, n = 16 }: { color: string; n?: number }) {
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; const d = 140 + Math.random() * 120;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 4 + Math.random() * 6 };
  }), [n]);
  return (
    <div className="absolute left-1/2 top-1/2 pointer-events-none">
      {bits.map((b, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ width: b.s, height: b.s, marginLeft: -b.s / 2, marginTop: -b.s / 2, background: color, boxShadow: `0 0 10px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: b.x, y: b.y, opacity: 0, scale: 0.3 }} transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }} />
      ))}
    </div>
  );
}

const RANK: Record<Tier, number> = { wood: 0, bronze: 1, silver: 2, gold: 3, elite: 4, totw: 5 };

/**
 * Pack opening: the pack drops in, shakes and bursts; five cards fly out face down, all alike (nothing
 * gives a card away before it is turned); click to turn one (or all). Better cards get a
 * bigger flare, elite and team-of-the-round cards flash the whole screen.
 */
export function PackReveal({ cards, isNew, onClose, left, onNext }: { cards: GCard[]; isNew: (c: GCard) => boolean; onClose: () => void; left: number; onNext: () => void }) {
  const font = useHeaderFont();
  const [phase, setPhase] = useState<'idle' | 'shake' | 'burst' | 'cards'>('idle');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<{ color: string; k: number } | null>(null);
  const all = open.size === cards.length;
  const bestTier = cards.reduce<Tier>((b, c) => (RANK[tierOf(c)] > RANK[b] ? tierOf(c) : b), 'wood');

  const tear = () => {
    setPhase('shake');
    setTimeout(() => { setPhase('burst'); setFlash({ color: '#ffffff', k: Date.now() }); }, 900);
    setTimeout(() => setPhase('cards'), 1350);
  };
  const turn = (i: number) => {
    setOpen(o => {
      if (o.has(i)) return o;
      const t = tierOf(cards[i]);
      if (RANK[t] >= RANK.elite) setTimeout(() => setFlash({ color: TIER[t].color, k: Date.now() }), 250);
      return new Set(o).add(i);
    });
  };
  const turnAll = () => cards.forEach((_, i) => setTimeout(() => turn(i), i * 260));

  return (
    <motion.div data-snap-lock className="absolute -inset-x-16 -top-24 -bottom-6 z-40 flex flex-col items-center justify-center gap-10 overflow-hidden"
      style={{ background: 'radial-gradient(70% 70% at 50% 50%, rgba(18,18,28,0.95), rgba(4,4,8,0.98))' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <AnimatePresence>{(phase === 'burst' || phase === 'cards') && <Rays key="rays" color={all ? TIER[bestTier].color : '#ffffff'} />}</AnimatePresence>
      <AnimatePresence>
        {flash && (
          <motion.div key={flash.k} className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, ${flash.color}, transparent 70%)` }}
            initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} onAnimationComplete={() => setFlash(null)} />
        )}
      </AnimatePresence>

      <div className="relative font-logik-extended-bold uppercase text-[30px] text-white" style={font}>
        {phase === 'cards' ? (all ? 'Twoja paczka' : 'Kliknij karty, żeby je odkryć') : 'Kliknij paczkę, żeby ją otworzyć'}
      </div>

      <div className="relative flex items-center justify-center" style={{ height: 460, width: 5 * 210 + 4 * 24 }}>
        {phase !== 'cards' && <Pack phase={phase} onOpen={tear} />}
        {phase === 'cards' && cards.map((c, i) => {
          const t = tierOf(c); const col = TIER[t].color; const turned = open.has(i);
          const x = (i - (cards.length - 1) / 2) * 234;
          return (
            <motion.div key={i} className="absolute" style={{ width: 210, height: Math.round(210 * RATIO), perspective: 1200, zIndex: turned ? 2 : 1 }}
              initial={{ x: 0, y: 30, scale: 0.3, rotate: (i - 2) * 25, opacity: 0 }} animate={{ x, y: 0, scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: i * 0.07, type: 'spring', stiffness: 170, damping: 18 }}>
              {/* Glow: the same soft pulse on every card while face down (nothing gives the card away),
                  the card's own rarity colour once it is turned */}
              <motion.div className="absolute -inset-4 rounded-[28px] blur-xl" style={{ background: turned ? col : '#ffffff' }}
                animate={turned ? { opacity: RANK[t] >= 2 ? 0.55 : 0.15 } : { opacity: [0.06, 0.16, 0.06] }}
                transition={turned ? { duration: 0.4 } : { duration: 1.6, repeat: Infinity }} />
              <motion.button type="button" className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }} onClick={() => turn(i)}
                whileHover={!turned ? { y: -10 } : undefined}
                animate={turned ? { rotateY: 180, scale: [1, 1.18, 1] } : { rotateY: 0, scale: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}><CardBack w={210} /></div>
                <div className="absolute inset-0" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}><CardFace c={c} w={210} tip={false} /></div>
              </motion.button>
              {turned && <Sparks color={col} n={8 + RANK[t] * 6} />}
              {turned && RANK[t] >= 2 && (
                <motion.div className="absolute inset-0 rounded-[16px] pointer-events-none" style={{ boxShadow: `0 0 0 3px ${col}, 0 0 40px ${col}` }}
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6] }} transition={{ duration: 0.8, delay: 0.3 }} />
              )}
              {turned && RANK[t] >= 3 && (
                <motion.span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-black z-10"
                  style={{ background: col, boxShadow: `0 0 18px ${col}` }} initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.45, type: 'spring', stiffness: 400, damping: 14 }}>
                  {TIER[t].label}
                </motion.span>
              )}
              {turned && isNew(c) && (
                <motion.span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-black z-10" style={{ background: C.win }}
                  initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.5, type: 'spring', stiffness: 500, damping: 12 }}>
                  Nowy gracz
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="relative h-[60px] flex items-center">
        {phase === 'cards' && (all
          ? <motion.div className="flex items-center gap-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              {left > 0 && <Action primary big onClick={onNext}>Otwórz kolejną · {left}</Action>}
              <Action big onDark={left > 0} primary={left === 0} onClick={onClose}>Do albumu</Action>
            </motion.div>
          : <Action onDark onClick={turnAll}>Odkryj wszystkie</Action>)}
      </div>
    </motion.div>
  );
}

export function Album({ cards, collection }: { cards: GCard[]; collection: GCard[] }) {
  const teams = useMemo(() => [...new Map(cards.filter(c => c.team).map(c => [c.team!.id, c.team!])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pl')), [cards]);
  const [page, setPage] = useState(0);
  const [focus, setFocus] = useState<Slot | null>(null);
  const pages = Math.max(1, Math.ceil(teams.length / PER_PAGE));
  const players = new Set(collection.map(c => c.pid));
  const allPlayers = new Set(cards.map(c => c.pid));
  const font = useHeaderFont();

  return (
    <div className="relative h-full flex flex-col gap-5 min-h-0">
      <div className="flex items-end gap-8">
        <div>
          <Label>Kolekcja</Label>
          <div className="font-logik-extended-bold text-[34px] leading-none tabular-nums" style={{ color: C.heading, ...font }}>{players.size}<span className="text-[18px]" style={{ color: C.muted }}> / {allPlayers.size} graczy</span></div>
        </div>
      </div>

      {/* Room at the bottom right for the Play button */}
      <div className="relative flex-1 min-h-0 flex items-center pb-[140px]">
        <button type="button" aria-label="Poprzednia strona" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="absolute -left-2 z-10 p-2 disabled:opacity-15 transition-opacity" style={{ color: C.heading }}><ChevronLeft className="w-12 h-12" /></button>
        <AnimatePresence mode="wait">
          <motion.div key={page} className="w-full grid grid-cols-2 gap-x-20 gap-y-8 px-16"
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
            {teams.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map(t => <TeamBlock key={t.id} team={t} collection={collection} onOpen={setFocus} />)}
          </motion.div>
        </AnimatePresence>
        <button type="button" aria-label="Następna strona" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="absolute -right-2 z-10 p-2 disabled:opacity-15 transition-opacity" style={{ color: C.heading }}><ChevronRight className="w-12 h-12" /></button>
      </div>
      <div className="absolute left-0 right-0 bottom-8 flex justify-center gap-2">
        {Array.from({ length: pages }, (_, i) => (
          <button key={i} type="button" aria-label={`Strona ${i + 1}`} onClick={() => setPage(i)} className="h-2 rounded-full transition-all" style={{ width: i === page ? 28 : 8, background: i === page ? C.secondary : ink(20) }} />
        ))}
      </div>

      <AnimatePresence>
        {focus && focus.cards.length > 0 && (
          <motion.div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6" style={{ background: 'rgba(5,5,10,0.85)', backdropFilter: 'blur(6px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFocus(null)}>
            <div className="flex items-center gap-4 text-white">
              <Heading size={28}>{focus.cards[0].name}</Heading>
              <span className="text-sm opacity-70">{count(focus.cards.length, 'karta', 'karty', 'kart')}</span>
              <button type="button" aria-label="Zamknij" className="ml-4 opacity-70 hover:opacity-100"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex flex-wrap justify-center gap-5 max-w-[1500px]" onClick={e => e.stopPropagation()}>
              {focus.cards.map((c, i) => <CardFace key={`${c.id}-${i}`} c={c} w={focus.cards.length > 6 ? 170 : 200} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
