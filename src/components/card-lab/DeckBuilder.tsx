'use client';

// Deck building: 20 slots on screen — a few for each position, the rest free for any position (so
// what you pick is a choice, not just the highest numbers). Click a slot (empty "+" or a card to
// change it) and the cards that fit it slide in at the top. One card per player.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { C, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { ROLE_KEYS, avgOvr, deckProblem, type DeckRule, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { KEYWORD } from '@/lib/card-lab/outposts';
import { Action, CardFace, Heading, Label, RATIO } from './ui';

const W = 150;
const PICK_W = 150;
const PER_PAGE = 10;
const DIM = 'rgba(255,255,255,0.55)';

/** A slot: the position it is for (null = any position) */
interface SlotDef { key: string; role: RoleKey | null }

/** Which deck card sits in which slot: role slots first (best first), the rest in the free slots */
function placeCards(deck: GCard[], slots: SlotDef[], perRole: number): Map<string, GCard> {
  const out = new Map<string, GCard>();
  const extra: GCard[] = [];
  for (const r of ROLE_KEYS) {
    const cs = deck.filter(c => c.role === r).sort((a, b) => b.ovr - a.ovr);
    const mine = slots.filter(s => s.role === r);
    cs.slice(0, perRole).forEach((c, i) => out.set(mine[i].key, c));
    extra.push(...cs.slice(perRole));
  }
  const free = slots.filter(s => s.role === null);
  extra.forEach((c, i) => { if (free[i]) out.set(free[i].key, c); });
  return out;
}

export function DeckBuilder({ collection, rule, deck, setDeck }: { collection: GCard[]; rule: DeckRule; deck: GCard[]; setDeck: (d: GCard[]) => void }) {
  const font = useHeaderFont();
  const slots = useMemo<SlotDef[]>(() => [
    ...ROLE_KEYS.flatMap(r => Array.from({ length: rule.perRole }, (_, i): SlotDef => ({ key: `${r}-${i}`, role: r }))),
    ...Array.from({ length: Math.max(0, rule.size - ROLE_KEYS.length * rule.perRole) }, (_, i): SlotDef => ({ key: `free-${i}`, role: null })),
  ], [rule]);
  const freeSlots = slots.filter(s => !s.role);
  const pairs = Array.from({ length: Math.ceil(freeSlots.length / 2) }, (_, i) => freeSlots.slice(i * 2, i * 2 + 2));
  const placed = useMemo(() => placeCards(deck, slots, rule.perRole), [deck, slots, rule.perRole]);
  const [open, setOpen] = useState<SlotDef | null>(null);
  const problem = deckProblem(deck, rule);

  return (
    <div className="relative h-full flex flex-col gap-6 min-h-0">
      <div className="flex items-end gap-12 shrink-0">
        <div>
          <Label>Talia</Label>
          <Heading size={34}>{deck.length}<span style={{ color: C.muted }}> / {rule.size}</span></Heading>
        </div>
        <div>
          <Label>Średnia ocena</Label>
          <div className="font-logik-extended-bold text-[30px] tabular-nums leading-none" style={{ color: C.heading, ...font }}>{deck.length ? avgOvr(deck).toFixed(1) : '–'}</div>
        </div>
        <div className="text-[14px] font-bold pb-1" style={{ color: problem ? C.loss : C.win }}>{problem ?? 'Talia gotowa do gry'}</div>
        <div className="flex-1" />
        <Action onClick={() => setDeck([])}>Wyczyść</Action>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex justify-center gap-10">
          {ROLE_KEYS.map(r => (
            <div key={r} className="flex flex-col gap-2">
              <div className="font-logik-extended-bold uppercase text-[15px] text-center" style={{ color: C.heading, ...font }}>{KEYWORD[r].name}</div>
              <div className="flex gap-3">
                {slots.filter(s => s.role === r).map(sl => <Slot key={sl.key} card={placed.get(sl.key)} active={open?.key === sl.key} onClick={() => setOpen(sl)} />)}
              </div>
            </div>
          ))}
        </div>
        <div className="font-logik-extended-bold uppercase text-[15px] text-center mt-1" style={{ color: C.heading, ...font }}>
          Dowolna pozycja <span style={{ color: C.muted }}>· {freeSlots.length} miejsc na Twój wybór</span>
        </div>
        <div className="flex justify-center gap-10">
          {pairs.map((pair, i) => (
            <div key={i} className="flex gap-3">
              {pair.map(sl => <Slot key={sl.key} card={placed.get(sl.key)} active={open?.key === sl.key} onClick={() => setOpen(sl)} />)}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {open && <Picker key="picker" slot={open} current={placed.get(open.key)} collection={collection} deck={deck} setDeck={setDeck} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Slot({ card, active, onClick }: { card?: GCard; active: boolean; onClick: () => void }) {
  const font = useHeaderFont();
  const h = Math.round(W * RATIO);
  return (
    <button type="button" onClick={onClick} className="group relative" style={{ width: W, height: h }}>
      {card ? (
        <CardFace c={card} w={W} selected={active} tip={false}>
          {/* Inside the card, so it covers exactly the card */}
          <span className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-logik-extended-bold uppercase tracking-widest text-[15px] text-white"
            style={{ background: 'rgba(10,11,15,0.72)', ...font }}>Zmień</span>
        </CardFace>
      ) : (
        <span className="absolute left-0 top-0 flex flex-col items-center justify-center gap-2 rounded-[16px] transition-colors"
          style={{ width: W, height: h, border: `2px dashed ${active ? C.primary : mix(C.text, 28)}`, color: active ? C.primary : mix(C.text, 55) }}>
          <Plus className="w-10 h-10 transition-transform group-hover:scale-125" />
        </span>
      )}
    </button>
  );
}

/** The cards that fit a slot, sliding in at the top of the screen */
function Picker({ slot, current, collection, deck, setDeck, onClose }: { slot: SlotDef; current?: GCard; collection: GCard[]; deck: GCard[]; setDeck: (d: GCard[]) => void; onClose: () => void }) {
  const font = useHeaderFont();
  const [role, setRole] = useState<RoleKey>(slot.role ?? current?.role ?? 'Carry');
  const [page, setPage] = useState(0);
  useEffect(() => { setRole(slot.role ?? current?.role ?? 'Carry'); setPage(0); }, [slot.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const list = [...new Map(collection.map(c => [c.id, c])).values()].filter(c => c.role === role).sort((a, b) => b.ovr - a.ovr);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const choose = (c: GCard) => {
    // The new card takes the slot: out goes what was there and any other card of the same player
    setDeck([...deck.filter(d => d.id !== current?.id && d.pid !== c.pid), c]);
    onClose();
  };

  return (
    <>
      <motion.div className="absolute -inset-x-16 -bottom-6 -top-24 z-40" style={{ background: 'rgba(5,6,9,0.55)' }} onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="absolute -left-16 -right-16 -top-24 z-50 px-16 pt-6 pb-7 flex flex-col gap-4"
        style={{ background: 'linear-gradient(180deg, #0d0f15 85%, rgba(13,15,21,0.94))', boxShadow: `0 1px 0 ${mix(C.primary, 60)}, 0 30px 60px rgba(0,0,0,0.6)` }}
        initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
        <div className="flex items-center gap-6">
          <div className="font-logik-extended-bold uppercase text-[22px] text-white" style={font}>
            {current ? 'Zmień kartę' : 'Wybierz kartę'}<span style={{ color: DIM }}> · {slot.role ? KEYWORD[slot.role].name : 'dowolna pozycja'}</span>
          </div>
          {!slot.role && (
            <div className="flex items-center gap-1">
              {ROLE_KEYS.map(r => (
                <button key={r} type="button" onClick={() => { setRole(r); setPage(0); }} className="relative px-3 py-1 font-logik-extended-bold uppercase text-[13px]"
                  style={{ color: r === role ? '#fff' : DIM, ...font }}>
                  {KEYWORD[r].name}
                  {r === role && <span className="absolute left-2 right-2 -bottom-0.5 h-[3px] rounded-full" style={{ background: C.primary }} />}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1" />
          {current && <Action onDark onClick={() => { setDeck(deck.filter(d => d.id !== current.id)); onClose(); }}>Zdejmij z talii</Action>}
          <button type="button" aria-label="Zamknij" onClick={onClose} className="text-white opacity-70 hover:opacity-100"><X className="w-7 h-7" /></button>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Poprzednie" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-white disabled:opacity-15"><ChevronLeft className="w-9 h-9" /></button>
          <div className="flex-1 flex gap-4 justify-center" style={{ minHeight: Math.round(PICK_W * RATIO) + 22 }}>
            {list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map(c => {
              const here = c.id === current?.id;
              const used = !here && deck.some(d => d.id === c.id);
              const twin = !here && !used && deck.find(d => d.pid === c.pid);
              return (
                <div key={c.id} className="flex flex-col items-center gap-1.5">
                  <CardFace c={c} w={PICK_W} selected={here} dim={used} onClick={here || used ? undefined : () => choose(c)} />
                  <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: here ? '#fff' : twin ? '#f0b44c' : DIM }}>
                    {here ? 'W tym miejscu' : used ? 'Już w talii' : twin ? 'Zamieni inną kartę gracza' : ' '}
                  </span>
                </div>
              );
            })}
            {!list.length && <span className="self-center text-[15px]" style={{ color: DIM }}>Nie masz jeszcze kart na tej pozycji: otwórz paczkę w albumie.</span>}
          </div>
          <button type="button" aria-label="Następne" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="text-white disabled:opacity-15"><ChevronRight className="w-9 h-9" /></button>
        </div>
      </motion.div>
    </>
  );
}
