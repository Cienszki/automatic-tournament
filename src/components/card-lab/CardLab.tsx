'use client';

// The card game test build (/[slug]/karty, not linked from the site — testers get the link):
// per-series player cards from this tournament, 10 unopened packs (opened in the album, kept in this
// browser), deck building and "Kontrola mapy" against the practice computer.
// Laid out once for 1920×900 and scaled to the screen (up and down), so nothing scrolls.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import type { Model } from '@/lib/stats-lab/derive';
import { C, WithModel, ink, mix, useHeaderFont, useStatsKey } from '@/components/stats-lab/kit';
import { autoDeck, buildSeriesCards, deckProblem, type GCard } from '@/lib/card-lab/cards';
import { Album } from './Album';
import { DeckBuilder } from './DeckBuilder';
import { OUTPOSTS_RULE, OutpostsGame } from './OutpostsGame';
import { FitScaleCtx } from './ui';

type Tab = 'album' | 'talia' | 'gra';
const TABS: Array<{ id: Tab; label: string }> = [{ id: 'album', label: 'Album' }, { id: 'talia', label: 'Talia' }, { id: 'gra', label: 'Kontrola mapy' }];
const BASE_W = 1920; const BASE_H = 900;
const START_PACKS = 10;

/** Scales a 1920×900 layout to the box it gets, up or down */
function FitStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: BASE_W, h: BASE_H });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const calc = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    calc(); const ro = new ResizeObserver(calc); ro.observe(el); return () => ro.disconnect();
  }, []);
  const k = Math.min(box.w / BASE_W, box.h / BASE_H);
  const w = box.w / k; const h = box.h / k;
  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden">
      <div className="absolute left-0 top-0" style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0' }}><FitScaleCtx.Provider value={k}>{children}</FitScaleCtx.Provider></div>
    </div>
  );
}

// ── Saved in this browser: which cards you opened and how many packs are left ──
interface Saved { ids: string[]; packs: number; deck?: string[] }
const storeKey = (k: string) => `card-lab:${k}:v1`;
function load(k: string): Saved | null { try { const v = localStorage.getItem(storeKey(k)); return v ? JSON.parse(v) as Saved : null; } catch { return null; } }
function save(k: string, v: Saved) { try { localStorage.setItem(storeKey(k), JSON.stringify(v)); } catch { /* private mode */ } }
const SEEN_KEY = 'card-lab:intro-seen';

/** The first-visit explanation: what you get, what to do — the game itself you learn by playing */
function Intro({ onClose }: { onClose: () => void }) {
  const font = useHeaderFont();
  const steps = [
    { n: 1, title: 'Zbierasz karty graczy', text: `Każdy gracz turnieju ma kartę za każdą serię, którą zagrał. Im lepiej zagrał, tym mocniejsza karta. Na start masz ${START_PACKS} paczek: otwórz je w Albumie.` },
    { n: 2, title: 'Układasz talię', text: 'W zakładce Talie wybierasz karty do gry (albo klikasz „Ułóż najlepszą”).' },
    { n: 3, title: 'Grasz', text: "Kontrola mapy: wystawiaj karty i przejmuj objective'y na mapie. Pierwszy do 10 punktów wygrywa. Reszty dowiesz się, grając." },
  ];
  return (
    <motion.div className="absolute inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(5,6,9,0.78)', backdropFilter: 'blur(6px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="w-[1100px] flex flex-col items-center gap-10 text-white" initial={{ y: 20 }} animate={{ y: 0 }}>
        <div className="text-center">
          <div className="text-[12px] uppercase tracking-[0.35em] opacity-60">Wersja testowa</div>
          <div className="font-logik-extended-bold uppercase text-[54px] leading-none mt-2" style={font}>Karty</div>
        </div>
        <div className="grid grid-cols-3 gap-12 w-full">
          {steps.map(st => (
            <div key={st.n} className="flex flex-col items-center text-center gap-3">
              <span className="w-14 h-14 rounded-full flex items-center justify-center font-logik-extended-bold text-[24px] text-white" style={{ background: C.primary, boxShadow: `0 0 24px ${mix(C.primary, 60)}`, ...font }}>{st.n}</span>
              <div className="font-logik-extended-bold uppercase text-[20px]" style={font}>{st.title}</div>
              <div className="text-[15px] leading-relaxed opacity-80">{st.text}</div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="rounded-full px-10 py-4 font-logik-extended-bold uppercase tracking-widest text-[16px] text-white" style={{ background: C.primary, boxShadow: `0 0 30px ${mix(C.primary, 60)}`, ...font }}>Zaczynamy</button>
      </motion.div>
    </motion.div>
  );
}

function Lab({ model }: { model: Model }) {
  const { tournament } = useTournament();
  const key = useStatsKey() ?? 'x';
  const font = useHeaderFont();
  const cards = useMemo(() => buildSeriesCards(model, tournament?.type), [model, tournament?.type]);
  const byId = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const [collection, setCollection] = useState<GCard[]>([]);
  const [packs, setPacks] = useState(START_PACKS);
  const [loaded, setLoaded] = useState(false);
  const [deck, setDeck] = useState<GCard[]>([]);
  const [tab, setTab] = useState<Tab>('album');
  const [match, setMatch] = useState(0);
  const [intro, setIntro] = useState(false);

  // Restore this browser's collection, show the intro once
  useEffect(() => {
    const v = load(key);
    if (v) {
      setCollection(v.ids.map(id => byId.get(id)).filter((c): c is GCard => !!c)); setPacks(v.packs);
      if (v.deck) setDeck(v.deck.map(id => byId.get(id)).filter((c): c is GCard => !!c));
    }
    try { if (!localStorage.getItem(SEEN_KEY)) setIntro(true); } catch { setIntro(true); }
    setLoaded(true);
  }, [key, byId]);
  useEffect(() => { if (loaded) save(key, { ids: collection.map(c => c.id), packs, deck: deck.map(c => c.id) }); }, [loaded, key, collection, packs, deck]);
  // A deck that is not legal yet is rebuilt from the collection (a legal one is left alone)
  useEffect(() => { setDeck(d => (deckProblem(d, OUTPOSTS_RULE) ? autoDeck(collection, OUTPOSTS_RULE) : d)); }, [collection]);
  const closeIntro = () => { setIntro(false); try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ } };

  const ready = !deckProblem(deck, OUTPOSTS_RULE);
  const notReady = (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-[16px]" style={{ color: C.text }}>
      <div>{collection.length ? `Talia jeszcze niegotowa: ${deckProblem(deck, OUTPOSTS_RULE)}.` : 'Najpierw otwórz paczki w Albumie.'}</div>
      <button type="button" onClick={() => setTab(collection.length ? 'talia' : 'album')} className="rounded-full px-6 py-2.5 font-logik-extended-bold uppercase tracking-widest text-white" style={{ background: C.primary, ...font }}>
        {collection.length ? 'Do talii' : 'Do albumu'}
      </button>
    </div>
  );

  return (
    <div className={`relative h-full flex flex-col ${tab === 'gra' ? '' : 'px-16 pt-5 pb-6 gap-5'}`} style={{ color: C.text }}>
      {/* During a match the whole screen is the board: the game has its own back button and help */}
      <div className={`flex items-center gap-10 shrink-0 ${tab === 'gra' ? 'hidden' : ''}`}>
        <div className="font-logik-extended-bold uppercase text-[28px] leading-none" style={{ color: C.heading, ...font }}>Karty</div>
        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className="relative px-4 py-1.5 font-logik-extended-bold uppercase text-[15px] transition-colors" style={{ color: tab === t.id ? C.heading : C.muted, ...font }}>
              {t.label}
              {tab === t.id && <span className="absolute left-3 right-3 -bottom-1 h-[3px] rounded-full" style={{ background: C.primary }} />}
            </button>
          ))}
        </div>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${ink(14)}, transparent)` }} />
        <button type="button" onClick={() => setIntro(true)} aria-label="Jak to działa" className="w-9 h-9 rounded-full font-logik-extended-bold text-[16px]" style={{ color: C.heading, boxShadow: `inset 0 0 0 1.5px ${mix(C.heading, 40)}`, ...font }}>?</button>
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'album' && <Album cards={cards} collection={collection} setCollection={setCollection} packs={packs} onPackOpened={() => setPacks(p => Math.max(0, p - 1))} />}
        {tab === 'talia' && <DeckBuilder collection={collection} rule={OUTPOSTS_RULE} deck={deck} setDeck={setDeck} onPlay={() => { setMatch(m => m + 1); setTab('gra'); }} />}
        {/* The match stays mounted while you look at the album */}
        <div className={tab === 'gra' ? 'h-full' : 'hidden'}>
          {ready ? <OutpostsGame key={match} deck={deck} all={cards} onBack={() => setTab('talia')} /> : notReady}
        </div>
      </div>
      <AnimatePresence>{intro && <Intro onClose={closeIntro} />}</AnimatePresence>
    </div>
  );
}

/** The game is built for a computer screen (drag and drop, 1920×900 layout) */
function SmallScreen() {
  const font = useHeaderFont();
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center" style={{ color: C.text }}>
      <div className="font-logik-extended-bold uppercase text-[28px]" style={{ color: C.heading, ...font }}>Karty</div>
      <div className="text-[16px] max-w-[360px]">Wersja testowa działa na komputerze. Otwórz ten link na PC lub laptopie.</div>
    </div>
  );
}

export default function CardLab() {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 899px)');
    const on = () => setSmall(q.matches);
    on(); q.addEventListener('change', on); return () => q.removeEventListener('change', on);
  }, []);
  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
      {/* Fixed under the navbar and above the footer: the layout puts other pages in a padded container */}
      <div className="fixed inset-x-0 bottom-0 top-14 z-[45]" style={{ background: 'var(--tournament-background, #0b0b10)' }}>
        {small ? <SmallScreen /> : (
          <FitStage>
            <WithModel>{m => <Lab model={m} />}</WithModel>
          </FitStage>
        )}
      </div>
    </TooltipPrimitive.Provider>
  );
}
