'use client';

// Deck building: the collection by position on the left (click a card to add / remove it), the
// deck on the right. One card per player.

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Avatar, C, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { ROLE_KEYS, autoDeck, avgOvr, deckProblem, type DeckRule, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { KEYWORD } from '@/lib/card-lab/outposts';
import { Action, CardFace, Hairline, Heading, Label } from './ui';

const PAGE = 24;

export function DeckBuilder({ collection, rule, deck, setDeck, onPlay }: { collection: GCard[]; rule: DeckRule; deck: GCard[]; setDeck: (d: GCard[]) => void; onPlay: () => void }) {
  const font = useHeaderFont();
  const [role, setRole] = useState<RoleKey>('Carry');
  const [page, setPage] = useState(0);
  const uniq = useMemo(() => [...new Map(collection.map(c => [c.id, c])).values()], [collection]);
  const list = uniq.filter(c => c.role === role).sort((a, b) => b.ovr - a.ovr);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const problem = deckProblem(deck, rule);
  const inDeck = (c: GCard) => deck.some(d => d.id === c.id);
  const toggle = (c: GCard) => {
    if (inDeck(c)) setDeck(deck.filter(d => d.id !== c.id));
    else if (deck.length < rule.size || deck.some(d => d.pid === c.pid)) setDeck([...deck.filter(d => d.pid !== c.pid), c]);
  };
  const pick = (r: RoleKey) => { setRole(r); setPage(0); };

  return (
    <div className="h-full flex gap-10 min-h-0">
      <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
        <div className="flex items-center gap-1">
          {ROLE_KEYS.map(r => {
            const n = deck.filter(d => d.role === r).length;
            const on = r === role;
            return (
              <button key={r} type="button" onClick={() => pick(r)} className="relative px-5 py-2.5 text-left transition-colors">
                <div className="font-logik-extended-bold uppercase text-[15px]" style={{ color: on ? C.heading : C.muted, ...font }}>{KEYWORD[r].name}</div>
                <div className="text-[11px] tabular-nums" style={{ color: n >= rule.perRole ? C.win : C.loss }}>w talii {n} · min. {rule.perRole}</div>
                {on && <span className="absolute left-3 right-3 -bottom-0.5 h-[3px] rounded-full" style={{ background: C.secondary }} />}
              </button>
            );
          })}
          <div className="flex-1" />
          {pages > 1 && (
            <div className="flex items-center gap-1" style={{ color: C.heading }}>
              <button type="button" aria-label="Poprzednia" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="disabled:opacity-20"><ChevronLeft className="w-7 h-7" /></button>
              <span className="text-[12px] tabular-nums">{page + 1}/{pages}</span>
              <button type="button" aria-label="Następna" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="disabled:opacity-20"><ChevronRight className="w-7 h-7" /></button>
            </div>
          )}
        </div>
        <Hairline />
        <div className="grid grid-cols-8 gap-x-4 gap-y-3 content-start">
          {list.slice(page * PAGE, page * PAGE + PAGE).map(c => {
            const on = inDeck(c);
            const twin = !on && deck.some(d => d.pid === c.pid);
            return (
              <div key={c.id} className="flex flex-col items-center gap-1">
                <CardFace c={c} w={140} selected={on} dim={twin} onClick={() => toggle(c)} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: on ? C.secondary : C.muted }}>{on ? 'W talii' : twin ? 'Inna karta w talii' : ' '}</span>
              </div>
            );
          })}
          {!list.length && <span className="col-span-8 text-[13px]" style={{ color: C.muted }}>Nie masz jeszcze kart na tej pozycji — otwórz paczkę w albumie.</span>}
        </div>
      </div>

      <div className="w-[420px] shrink-0 flex flex-col gap-3 min-h-0">
        <div className="flex items-end justify-between">
          <div>
            <Label>Talia</Label>
            <Heading size={30}>{deck.length}<span style={{ color: C.muted }}> / {rule.size}</span></Heading>
          </div>
          <div className="text-right">
            <Label>Średnia ocena</Label>
            <div className="font-logik-extended-bold text-[26px] tabular-nums leading-none" style={{ color: C.heading, ...font }}>{deck.length ? avgOvr(deck).toFixed(1) : '–'}</div>
          </div>
        </div>
        <div className="text-[12px]" style={{ color: problem ? C.loss : C.win }}>{problem ?? 'Talia gotowa do gry'}</div>
        <Hairline />
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
          {ROLE_KEYS.map(r => {
            const cs = deck.filter(d => d.role === r).sort((a, b) => b.ovr - a.ovr);
            return (
              <div key={r}>
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] mb-0.5" style={{ color: C.muted }}>{KEYWORD[r].name}</div>
                {cs.map(c => (
                  <div key={c.id} className="group flex items-center gap-2.5 h-[30px] px-1 rounded-lg hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_6%,transparent)]">
                    <Avatar player={c.player} size={24} />
                    <span className="flex-1 min-w-0 truncate text-[13px] font-bold">{c.name}</span>
                    <span className="text-[11px] whitespace-nowrap" style={{ color: C.muted }}>{c.series.result} z {c.series.opp?.tag || c.series.opp?.name}</span>
                    <span className="w-8 text-right font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{c.ovr}</span>
                    <button type="button" aria-label="Usuń z talii" onClick={() => setDeck(deck.filter(d => d.id !== c.id))} className="opacity-0 group-hover:opacity-70 hover:!opacity-100"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {!cs.length && <div className="h-[30px] text-[12px] px-1 flex items-center" style={{ color: mix(C.loss, 80) }}>brak</div>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <Action onClick={() => setDeck(autoDeck(collection, rule))}>Ułóż najlepszą</Action>
          <Action onClick={() => setDeck([])}>Wyczyść</Action>
          <div className="flex-1" />
          <Action primary disabled={!!problem} onClick={onPlay}>Graj</Action>
        </div>
      </div>
    </div>
  );
}

