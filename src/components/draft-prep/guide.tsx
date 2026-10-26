'use client';

// Help for captains who have never prepared a draft: a one-screen intro the first time the tool
// opens (reopened from "Jak korzystać"), and a Captains Mode explainer drawn from the real order.

import React, { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { motion } from 'framer-motion';
import { C, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { draftOrder, draftPhases } from '@/lib/draft-prep/engine';
import { count } from '@/lib/plural';

const INTRO_KEY = 'draft-prep:intro-seen';

/** Whether the intro is open: on the first visit, and whenever the captain asks for it */
export function useIntro() {
  const [open, setOpen] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem(INTRO_KEY)) setOpen(true); } catch { /* storage blocked: skip the intro */ } }, []);
  const close = () => { setOpen(false); try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ } };
  return { open, show: () => setOpen(true), close };
}

const STEPS: Array<[string, string]> = [
  ['Składy', 'Sprawdź, kto zagra po obu stronach. Stand-ina wstawisz przyciskiem „Stand-iny” u góry, a klik w nick otwiera profil na Dotabuffie.'],
  ['Rywale', 'Każdy rywal osobno: jego bohaterowie, kiedy zwykle wybiera i co mu zbanować. Obok — ich drafty z tego turnieju.'],
  ['Plan banów', 'Cały draft krok po kroku: nasze propozycje i najbardziej prawdopodobne ruchy rywali.'],
  ['Symulacja', 'Przećwicz draft: klikaj bohaterów, a narzędzie podpowiada nasze ruchy i przewiduje ich.'],
  ['Ściąga', 'Kolejność i bohaterowie obu drużyn — popraw je, jeśli wiesz lepiej — i gotowy tekst na Discorda w obu wariantach.'],
];

export function Intro({ onClose }: { onClose: () => void }) {
  const font = useHeaderFont();
  return (
    <motion.div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,6,10,0.82)', backdropFilter: 'blur(6px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="w-full max-w-[880px] max-h-full overflow-y-auto rounded-2xl p-6 lg:p-8" style={{ background: '#12131a', boxShadow: `inset 0 0 0 1px ${ink(12)}` }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: C.secondary }}>Nowość · beta</div>
        <h2 className="font-logik-extended-bold uppercase mt-1" style={{ color: C.heading, fontSize: 'clamp(22px, 3.4vh, 34px)', ...font }}>Jak przygotować się do meczu</h2>
        <p className="mt-2 max-w-[640px]" style={{ color: C.text }}>Narzędzie zbiera gry twoich rywali i podpowiada, co banować i czego się spodziewać. Przejdź pięć kroków po kolei — zajmie to kilka minut.</p>
        <ol className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="font-logik-extended-bold tabular-nums shrink-0 w-6" style={{ color: C.secondary, fontSize: 20, ...font }}>{i + 1}</span>
              <span><span className="block font-bold uppercase tracking-wider text-sm" style={{ color: C.heading }}>{t}</span><span className="block text-sm" style={{ color: C.text }}>{d}</span></span>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 text-sm" style={{ color: C.text }}>
          <div>
            <div className="font-bold uppercase tracking-wider text-xs mb-1" style={{ color: C.muted }}>Skąd dane</div>
            Gry w tym turnieju, inne mecze ligowe i turniejowe oraz rankedy (OpenDota, STRATZ). Nowsze gry i gry na pozycji, na której gracz występuje w turnieju, ważą więcej.
          </div>
          <div>
            <div className="font-bold uppercase tracking-wider text-xs mb-1" style={{ color: C.muted }}>Jak to czytać</div>
            Procenty to szacunki, nie pewniki. Kropka przy graczu mówi, ile o nim wiemy — <span style={{ color: '#ff6b6b' }}>czerwona</span> to brak danych (np. prywatny profil). Najedź na element, by zobaczyć uzasadnienie.
          </div>
        </div>
        <div className="mt-6 flex items-center gap-6">
          <button type="button" onClick={onClose} className="px-6 py-3 font-bold uppercase tracking-[0.25em] text-white text-sm" style={{ background: C.primary }}>Zaczynamy</button>
          <span className="text-xs" style={{ color: C.muted }}>Wrócisz tu przyciskiem „Jak korzystać”.</span>
        </div>
      </div>
    </motion.div>
  );
}

/** "Jak działa draft?" — the Captains Mode order as phases, from the same table the simulator uses */
export function CmExplainer() {
  const phases = draftPhases(draftOrder());
  return (
    <Popover.Root>
      <Popover.Trigger asChild><button type="button" className="text-xs font-bold uppercase tracking-widest hover:underline">Jak działa draft?</button></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="end" className="z-[9999] w-[440px] rounded-xl p-4 shadow-2xl text-white text-sm" style={{ background: '#15151c', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="text-[11px] uppercase tracking-[0.3em] font-bold mb-2" style={{ color: C.secondary }}>Captains Mode</div>
          <p className="text-white/80 mb-3">24 ruchy na zmianę. Każda drużyna ma 7 banów i 5 picków. Drużyna, która zaczyna (A), wykonuje pierwszy ruch; kto zaczyna, ustala się w poczekalni przed grą.</p>
          <div className="flex flex-col gap-1.5">
            {phases.map(ph => (
              <div key={ph.from} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs tabular-nums text-white/50">{ph.from + 1}–{ph.to + 1}</span>
                <span className="w-20 shrink-0 font-bold" style={{ color: ph.pick ? C.heading : C.loss }}>{count(ph.seq.length, ph.pick ? 'pick' : 'ban', ph.pick ? 'picki' : 'bany', ph.pick ? 'picków' : 'banów')}</span>
                <span className="flex gap-1">{ph.seq.map((a, k) => <span key={k} className="w-6 h-5 rounded-sm text-[10px] font-bold flex items-center justify-center" style={{ background: mix(a ? C.radiant : C.dire, 30), color: C.heading }}>{a ? 'A' : 'B'}</span>)}</span>
              </div>
            ))}
          </div>
          <p className="text-white/60 mt-3 text-xs">Ważne: picki rywala przed twoją następną fazą banów możesz zablokować tylko teraz — dlatego narzędzie celuje banami w graczy, którzy wybierają wcześnie.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
