'use client';

// Deck building: 20 slots on screen — the top row two for each position (marked with the position's
// icon), the bottom row free for any position. Click a slot (empty, or a card to change it) and the
// cards that fit slide in at the top; the chosen card stays in exactly that slot. One card per player.

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { C, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { roleIcons } from '@/app/fantasy/roleIcons';
import { ROLE_KEYS, type DeckRule, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { KEYWORD } from '@/lib/card-lab/outposts';
import { Action, CardFace, RATIO } from './ui';

const W = 162;
const PICK_W = 168;
const PER_PAGE = 9;
const DIM = 'rgba(255,255,255,0.55)';

/** Slot key → card id (the deck as the player laid it out) */
export type DeckSlots = Record<string, string>;
/** A slot: the position it is for (null = any position) */
interface SlotDef { key: string; role: RoleKey | null }

export function slotDefs(rule: DeckRule): SlotDef[] {
  return [
    ...ROLE_KEYS.flatMap(r => Array.from({ length: rule.perRole }, (_, i): SlotDef => ({ key: `${r}-${i}`, role: r }))),
    ...Array.from({ length: Math.max(0, rule.size - ROLE_KEYS.length * rule.perRole) }, (_, i): SlotDef => ({ key: `free-${i}`, role: null })),
  ];
}

/** A layout for a deck saved without one: position slots first (best first), the rest in the free slots */
export function slotsFromDeck(deck: GCard[], rule: DeckRule): DeckSlots {
  const slots = slotDefs(rule); const out: DeckSlots = {}; const extra: GCard[] = [];
  for (const r of ROLE_KEYS) {
    const cs = deck.filter(c => c.role === r).sort((a, b) => b.ovr - a.ovr);
    const mine = slots.filter(s => s.role === r);
    cs.slice(0, rule.perRole).forEach((c, i) => { out[mine[i].key] = c.id; });
    extra.push(...cs.slice(rule.perRole));
  }
  slots.filter(s => !s.role).forEach((s, i) => { if (extra[i]) out[s.key] = extra[i].id; });
  return out;
}

export function DeckBuilder({ collection, rule, slots, setSlots }: { collection: GCard[]; rule: DeckRule; slots: DeckSlots; setSlots: (s: DeckSlots) => void }) {
  const defs = slotDefs(rule);
  const byId = new Map(collection.map(c => [c.id, c]));
  const cardIn = (key: string) => (slots[key] ? byId.get(slots[key]) : undefined);
  const [open, setOpen] = useState<SlotDef | null>(null);
  const pairs = (list: SlotDef[]) => Array.from({ length: Math.ceil(list.length / 2) }, (_, i) => list.slice(i * 2, i * 2 + 2));
  const row = (list: SlotDef[]) => (
    <div className="flex justify-center gap-7">
      {pairs(list).map((pair, i) => (
        <div key={i} className="flex gap-2.5">
          {pair.map(sl => <Slot key={sl.key} def={sl} card={cardIn(sl.key)} active={open?.key === sl.key} onClick={() => setOpen(sl)} />)}
        </div>
      ))}
    </div>
  );
  // The chosen card takes exactly this slot; any other card of the same player leaves the deck
  const choose = (key: string, c: GCard) => {
    const next: DeckSlots = {};
    for (const [k, id] of Object.entries(slots)) { const d = byId.get(id); if (k !== key && d && d.pid !== c.pid) next[k] = id; }
    next[key] = c.id;
    setSlots(next);
  };
  const remove = (key: string) => { const next = { ...slots }; delete next[key]; setSlots(next); };

  return (
    <div className="relative h-full flex flex-col justify-center gap-8 min-h-0 pb-[110px]">
      {row(defs.filter(d => d.role))}
      {row(defs.filter(d => !d.role))}
      <AnimatePresence>
        {open && <Picker key="picker" slot={open} current={cardIn(open.key)} collection={collection} deckIds={new Set(Object.values(slots))} deckPids={new Set(Object.values(slots).map(id => byId.get(id)?.pid))}
          onChoose={c => { choose(open.key, c); setOpen(null); }} onRemove={() => { remove(open.key); setOpen(null); }} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}

/** The position's icon, or a plus for a free slot */
function SlotIcon({ role, size }: { role: RoleKey | null; size: number }) {
  const Icon = role ? roleIcons[role] : Plus;
  return <Icon style={{ width: size, height: size }} />;
}

function Slot({ def, card, active, onClick }: { def: SlotDef; card?: GCard; active: boolean; onClick: () => void }) {
  const font = useHeaderFont();
  const h = Math.round(W * RATIO);
  return (
    <button type="button" data-slot={def.key} onClick={onClick} className="group relative" style={{ width: W, height: h }}>
      {card ? (
        <CardFace c={card} w={W} selected={active}>
          {/* Inside the card, so it covers exactly the card */}
          <span className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity font-logik-extended-bold uppercase tracking-widest text-[15px] text-white"
            style={{ background: 'rgba(10,11,15,0.74)', ...font }}>
            <SlotIcon role={def.role} size={34} />Zmień
          </span>
        </CardFace>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[16px] transition-colors"
          style={{ border: `2px dashed ${active ? C.primary : mix(C.text, 28)}`, color: active ? C.primary : mix(C.text, 50) }}>
          <span className="transition-transform group-hover:scale-110"><SlotIcon role={def.role} size={def.role ? 46 : 40} /></span>
          {def.role && <Plus className="w-5 h-5 opacity-70" />}
        </span>
      )}
    </button>
  );
}

/** The cards that fit a slot, sliding in at the top of the screen */
function Picker({ slot, current, collection, deckIds, deckPids, onChoose, onRemove, onClose }: {
  slot: SlotDef; current?: GCard; collection: GCard[]; deckIds: Set<string>; deckPids: Set<string | undefined>;
  onChoose: (c: GCard) => void; onRemove: () => void; onClose: () => void;
}) {
  const font = useHeaderFont();
  const [role, setRole] = useState<RoleKey>(slot.role ?? current?.role ?? 'Carry');
  const [page, setPage] = useState(0);
  useEffect(() => { setRole(slot.role ?? current?.role ?? 'Carry'); setPage(0); }, [slot.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const list = [...new Map(collection.map(c => [c.id, c])).values()].filter(c => c.role === role).sort((a, b) => b.ovr - a.ovr);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));

  return (
    <>
      <motion.div className="absolute -inset-x-16 -bottom-6 -top-24 z-40" style={{ background: 'rgba(5,6,9,0.55)' }} onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="absolute -left-16 -right-16 -top-24 z-50 px-16 pt-6 pb-7 flex flex-col gap-4"
        style={{ background: 'linear-gradient(180deg, #0d0f15 85%, rgba(13,15,21,0.94))', boxShadow: `0 1px 0 ${mix(C.primary, 60)}, 0 30px 60px rgba(0,0,0,0.6)` }}
        initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
        <div className="flex items-center gap-6 text-white">
          {slot.role
            ? <span className="flex items-center gap-2.5 font-logik-extended-bold uppercase text-[22px]" style={font}><SlotIcon role={slot.role} size={26} />{KEYWORD[slot.role].name}</span>
            : (
              <div className="flex items-center gap-1">
                {ROLE_KEYS.map(r => (
                  <button key={r} type="button" onClick={() => { setRole(r); setPage(0); }} className="relative flex items-center gap-2 px-3 py-1.5 font-logik-extended-bold uppercase text-[14px]"
                    style={{ color: r === role ? '#fff' : DIM, ...font }}>
                    <SlotIcon role={r} size={18} />{KEYWORD[r].name}
                    {r === role && <span className="absolute left-2 right-2 -bottom-0.5 h-[3px] rounded-full" style={{ background: C.primary }} />}
                  </button>
                ))}
              </div>
            )}
          <div className="flex-1" />
          {current && <Action onDark onClick={onRemove}>Zdejmij z talii</Action>}
          <button type="button" aria-label="Zamknij" onClick={onClose} className="opacity-70 hover:opacity-100"><X className="w-7 h-7" /></button>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Poprzednie" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-white disabled:opacity-15"><ChevronLeft className="w-9 h-9" /></button>
          <div className="flex-1 flex gap-4 justify-center" style={{ minHeight: Math.round(PICK_W * RATIO) + 22 }}>
            {list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map(c => {
              const here = c.id === current?.id;
              const used = !here && deckIds.has(c.id);
              const twin = !here && !used && deckPids.has(c.pid);
              return (
                <div key={c.id} className="flex flex-col items-center gap-1.5">
                  <CardFace c={c} w={PICK_W} selected={here} dim={used} onClick={here || used ? undefined : () => onChoose(c)} />
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
