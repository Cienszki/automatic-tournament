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
import { ROLE_KEYS, ROLE_SHORT, openPack, packPool, TOTW_CHANCE, type GCard } from '@/lib/card-lab/cards';
import { count } from '@/lib/plural';
import { Action, CardBack, CardFace, Heading, Label, RATIO } from './ui';

const PER_PAGE = 4;
const CELL = 124;

interface Slot { key: string; label: string; player?: PlayerX; cards: GCard[] }

function slotsOf(team: TeamX, collection: GCard[]): Slot[] {
  const mine = collection.filter(c => c.team?.id === team.id).sort((a, b) => b.ovr - a.ovr);
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

/** Pack opening: five face-down cards, click to turn (or turn all) */
function PackReveal({ cards, isNew, onClose }: { cards: GCard[]; isNew: (c: GCard) => boolean; onClose: () => void }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const all = open.size === cards.length;
  return (
    <motion.div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-8" style={{ background: 'rgba(5,5,10,0.82)', backdropFilter: 'blur(6px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Heading size={30}>Nowa paczka</Heading>
      <div className="flex gap-6">
        {cards.map((c, i) => (
          <motion.div key={i} className="relative" style={{ width: 210, height: Math.round(210 * RATIO), perspective: 1200 }}
            initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08, type: 'spring', stiffness: 150, damping: 17 }}>
            <motion.button type="button" className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }} onClick={() => setOpen(o => new Set(o).add(i))}
              animate={{ rotateY: open.has(i) ? 180 : 0 }} transition={{ duration: 0.55 }}>
              <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}><CardBack w={210} /></div>
              <div className="absolute inset-0" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}><CardFace c={c} w={210} tip={false} /></div>
            </motion.button>
            {open.has(i) && isNew(c) && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-black z-10" style={{ background: C.win }}>Nowy gracz</span>}
          </motion.div>
        ))}
      </div>
      {all ? <Action primary big onClick={onClose}>Do albumu</Action> : <Action onClick={() => setOpen(new Set(cards.map((_, i) => i)))}>Odkryj wszystkie</Action>}
    </motion.div>
  );
}

export function Album({ cards, collection, setCollection, packs, onPackOpened }: { cards: GCard[]; collection: GCard[]; setCollection: (c: GCard[]) => void; packs: number; onPackOpened: () => void }) {
  const teams = useMemo(() => [...new Map(cards.filter(c => c.team).map(c => [c.team!.id, c.team!])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pl')), [cards]);
  const pool = useMemo(() => packPool(cards), [cards]);
  const [page, setPage] = useState(0);
  const [pack, setPack] = useState<{ cards: GCard[]; before: Set<string> } | null>(null);
  const [focus, setFocus] = useState<Slot | null>(null);
  const pages = Math.max(1, Math.ceil(teams.length / PER_PAGE));
  const players = new Set(collection.map(c => c.pid));
  const allPlayers = new Set(cards.map(c => c.pid));
  const font = useHeaderFont();

  const rip = () => {
    if (packs <= 0) return;
    onPackOpened();
    const p = openPack(pool);
    setPack({ cards: p, before: new Set(collection.map(c => c.pid)) });
    setCollection([...collection, ...p]);
  };

  return (
    <div className="relative h-full flex flex-col gap-5 min-h-0">
      <div className="flex items-end gap-8">
        <div>
          <Label>Kolekcja</Label>
          <div className="font-logik-extended-bold text-[34px] leading-none tabular-nums" style={{ color: C.heading, ...font }}>{players.size}<span className="text-[18px]" style={{ color: C.muted }}> / {allPlayers.size} graczy</span></div>
        </div>
        <div className="text-[13px] pb-1" style={{ color: C.muted }}>{count(collection.length, 'karta', 'karty', 'kart')} · {count(new Set(collection.map(c => c.id)).size, 'różna', 'różne', 'różnych')} · {count(collection.filter(c => c.totw).length, 'karta drużyny kolejki', 'karty drużyny kolejki', 'kart drużyny kolejki')}</div>
        <div className="flex-1" />
        <div className="text-[12px] max-w-[440px] text-right pb-1" style={{ color: C.muted }}>
          Paczka: po jednej karcie na pozycję, z losowej drużyny, z jej ostatniego meczu. Gracz z drużyny kolejki: {Math.round(TOTW_CHANCE * 100)} % szans na jego kartę specjalną.
        </div>
        <Action primary big disabled={packs <= 0} onClick={rip}>{packs > 0 ? `Otwórz paczkę · ${packs}` : 'Brak paczek'}</Action>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center">
        <button type="button" aria-label="Poprzednia strona" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="absolute -left-2 z-10 p-2 disabled:opacity-15 transition-opacity" style={{ color: C.heading }}><ChevronLeft className="w-12 h-12" /></button>
        <AnimatePresence mode="wait">
          <motion.div key={page} className="w-full grid grid-cols-2 gap-x-20 gap-y-10 px-16"
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
            {teams.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map(t => <TeamBlock key={t.id} team={t} collection={collection} onOpen={setFocus} />)}
          </motion.div>
        </AnimatePresence>
        <button type="button" aria-label="Następna strona" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="absolute -right-2 z-10 p-2 disabled:opacity-15 transition-opacity" style={{ color: C.heading }}><ChevronRight className="w-12 h-12" /></button>
      </div>
      <div className="flex justify-center gap-2">
        {Array.from({ length: pages }, (_, i) => (
          <button key={i} type="button" aria-label={`Strona ${i + 1}`} onClick={() => setPage(i)} className="h-2 rounded-full transition-all" style={{ width: i === page ? 28 : 8, background: i === page ? C.secondary : ink(20) }} />
        ))}
      </div>

      <AnimatePresence>
        {pack && <PackReveal cards={pack.cards} isNew={c => !pack.before.has(c.pid)} onClose={() => setPack(null)} />}
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
