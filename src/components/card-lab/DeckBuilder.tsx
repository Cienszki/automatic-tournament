'use client';

// Deck building: 20 slots on screen — the top row two for each position (marked with the position's
// icon), the bottom row free for any position. Click a slot (empty, or a card to change it) and every
// card that fits opens over the page; the chosen card stays in exactly that slot. One card per player.

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { C, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { roleIcons } from '@/components/fantasy/roleIcons';
import { byStrength, deckKey, type DeckRule, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { slotDefs, type DeckSlots, type SlotDef } from '@/lib/card-lab/frozen';
import { KEYWORD } from '@/lib/card-lab/outposts';
import { Action, CardFace, RATIO } from './ui';

const W = 162;
const PICK_W = 196;
const DIM = 'rgba(255,255,255,0.55)';

export type { DeckSlots } from '@/lib/card-lab/frozen';

/** `w` = card width (the front page uses smaller cards); `room` = leave space at the bottom for the Play button */
export function DeckBuilder({ collection, rule, slots, setSlots, w = W, room = true }: { collection: GCard[]; rule: DeckRule; slots: DeckSlots; setSlots: (s: DeckSlots) => void; w?: number; room?: boolean }) {
  const defs = slotDefs(rule);
  const byId = new Map(collection.map(c => [c.id, c]));
  const cardIn = (key: string) => (slots[key] ? byId.get(slots[key]) : undefined);
  const [open, setOpen] = useState<SlotDef | null>(null);
  const pairs = (list: SlotDef[]) => Array.from({ length: Math.ceil(list.length / 2) }, (_, i) => list.slice(i * 2, i * 2 + 2));
  const row = (list: SlotDef[]) => (
    <div className="flex justify-center" style={{ gap: Math.round(w * 0.17) }}>
      {pairs(list).map((pair, i) => (
        <div key={i} className="flex" style={{ gap: Math.round(w * 0.06) }}>
          {pair.map(sl => <Slot key={sl.key} def={sl} card={cardIn(sl.key)} w={w} active={open?.key === sl.key} onClick={() => setOpen(sl)} />)}
        </div>
      ))}
    </div>
  );
  // The chosen card takes exactly this slot; another card of the same player AND team leaves the deck
  // (a player who also stood in for another team may be in it with each team)
  const choose = (key: string, c: GCard) => {
    const next: DeckSlots = {};
    for (const [k, id] of Object.entries(slots)) { const d = byId.get(id); if (k !== key && d && deckKey(d) !== deckKey(c)) next[k] = id; }
    next[key] = c.id;
    setSlots(next);
  };
  const remove = (key: string) => { const next = { ...slots }; delete next[key]; setSlots(next); };

  return (
    // Not `relative`: the card picker covers the whole page around the deck
    <div className={`h-full flex flex-col justify-center min-h-0 ${room ? 'gap-8 pb-[110px]' : 'gap-5'}`}>
      {row(defs.filter(d => d.role))}
      {row(defs.filter(d => !d.role))}
      <AnimatePresence>
        {open && <Picker key="picker" slot={open} current={cardIn(open.key)} collection={collection} deckIds={new Set(Object.values(slots))} deckPids={new Set(Object.values(slots).map(id => { const d = byId.get(id); return d ? deckKey(d) : undefined; }))}
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

function Slot({ def, card, w, active, onClick }: { def: SlotDef; card?: GCard; w: number; active: boolean; onClick: () => void }) {
  const font = useHeaderFont();
  const h = Math.round(w * RATIO);
  return (
    <button type="button" data-slot={def.key} onClick={onClick} className="group relative" style={{ width: w, height: h }}>
      {card ? (
        <CardFace c={card} w={w} selected={active}>
          {/* Inside the card, so it covers exactly the card */}
          <span className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity font-logik-extended-bold uppercase tracking-widest text-[15px] text-white"
            style={{ background: 'rgba(10,11,15,0.74)', ...font }}>
            <SlotIcon role={def.role} size={Math.round(w * 0.21)} />Zmień
          </span>
        </CardFace>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[16px] transition-colors"
          style={{ border: `2px dashed ${active ? C.primary : mix(C.text, 28)}`, color: active ? C.primary : mix(C.text, 50) }}>
          <span className="transition-transform group-hover:scale-110"><SlotIcon role={def.role} size={Math.round(w * (def.role ? 0.28 : 0.25))} /></span>
          {/* Which position the slot is for (the icons alone don't say) */}
          <span className="font-logik-extended-bold uppercase tracking-wider text-center leading-tight" style={{ fontSize: Math.max(11, Math.round(w * 0.085)), ...font }}>
            {def.role ? KEYWORD[def.role].name : 'Dowolna pozycja'}
          </span>
        </span>
      )}
    </button>
  );
}

/** Every card that fits a slot, over the whole page */
function Picker({ slot, current, collection, deckIds, deckPids, onChoose, onRemove, onClose }: {
  slot: SlotDef; current?: GCard; collection: GCard[]; deckIds: Set<string>; deckPids: Set<string | undefined>;
  onChoose: (c: GCard) => void; onRemove: () => void; onClose: () => void;
}) {
  const font = useHeaderFont();
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  // A position's slot: its cards; a free slot: every card, strongest first (no split by position)
  const list = [...new Map(collection.map(c => [c.id, c])).values()].filter(c => !slot.role || c.role === slot.role).sort(byStrength);

  // Over the whole page: every card that fits, at a size you can read
  return (
    <motion.div data-snap-lock className="absolute inset-0 z-50 flex flex-col px-10 pt-6 pb-6 gap-5"
      style={{ background: 'rgba(10,11,16,0.97)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.22 }}>
      <div className="shrink-0 flex items-center gap-6 text-white">
        {slot.role ? (
          <>
            <span className="flex items-center gap-2.5 font-logik-extended-bold uppercase text-[24px]" style={font}><SlotIcon role={slot.role} size={28} />{KEYWORD[slot.role].name}</span>
            <span className="text-[14px]" style={{ color: DIM }}>{KEYWORD[slot.role].ability}: {KEYWORD[slot.role].text}</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2.5 font-logik-extended-bold uppercase text-[24px]" style={font}><SlotIcon role={null} size={26} />Dowolna pozycja</span>
            <span className="text-[14px]" style={{ color: DIM }}>Tu pasuje karta z każdej pozycji.</span>
          </>
        )}
        <div className="flex-1" />
        {current && <Action onDark onClick={onRemove}>Zdejmij z talii</Action>}
        <button type="button" aria-label="Zamknij" onClick={onClose} className="opacity-70 hover:opacity-100"><X className="w-8 h-8" /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar" data-own-scroll>
        {/* Room above and at the sides: hovered cards lift and the chosen one glows past its edge */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-4 pt-4 px-3 pb-4">
          {list.map(c => {
            const here = c.id === current?.id;
            const used = !here && deckIds.has(c.id);
            const twin = !here && !used && deckPids.has(deckKey(c));
            return (
              <div key={c.id} className="flex flex-col items-center gap-1.5">
                <CardFace c={c} w={PICK_W} selected={here} dim={used} onClick={here || used ? undefined : () => onChoose(c)} />
                <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: here ? '#fff' : twin ? '#f0b44c' : DIM }}>
                  {here ? 'W tym miejscu' : used ? 'Już w talii' : twin ? 'Zamieni inną kartę gracza' : ' '}
                </span>
              </div>
            );
          })}
          {!list.length && <span className="self-center mt-24 text-[16px]" style={{ color: DIM }}>{slot.role ? 'Nie masz jeszcze kart na tej pozycji: otwórz paczkę.' : 'Nie masz jeszcze kart: otwórz paczkę.'}</span>}
        </div>
      </div>
    </motion.div>
  );
}
