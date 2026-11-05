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
import { LEVELS, type Level } from '@/lib/card-lab/outposts-ai';
import { FitScaleCtx, useFitScale } from './ui';
import { centreOf, pulseAt } from '@/components/tour/pulse';

type Tab = 'album' | 'talia' | 'gra';
const TABS: Array<{ id: Tab; label: string }> = [{ id: 'album', label: 'Album' }, { id: 'talia', label: 'Talia' }];
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
const LEVEL_KEY = 'card-lab:level';

/** The way into a match, where Dota players look for it: bottom right, big, in the tournament's colours */
/** `running` = the level of the match in progress (null = none). Picking another level makes the big
 *  button start a new match at that level; the running one stays one click away. */
function PlayButton({ problem, build, running, level, setLevel, onPlay, onResume, onBuild }: { problem: string | null; build: string; running: Level | null; level: Level; setLevel: (l: Level) => void; onPlay: () => void; onResume: () => void; onBuild: () => void }) {
  const resume = running === level;
  // No legal deck yet: the button takes you to build one (the tutorial brings its own)
  const needDeck = !!problem && !resume;
  const font = useHeaderFont();
  return (
    <div className="absolute right-16 bottom-6 z-30 flex flex-col items-stretch gap-2 w-[470px]">
      <div className="flex items-center justify-end gap-1 text-[12px] font-bold uppercase tracking-widest">
        <span className="mr-2" style={{ color: C.muted }}>Komputer</span>
        {(Object.keys(LEVELS) as Level[]).map(l => (
          <button key={l} type="button" onClick={() => setLevel(l)} className="px-3 py-1 rounded-full transition-colors"
            style={{ color: l === level ? '#fff' : C.muted, background: l === level ? mix(C.primary, 70) : 'transparent', boxShadow: l === level ? 'none' : `inset 0 0 0 1px ${mix(C.text, 18)}` }}>
            {LEVELS[l].name}
          </button>
        ))}
      </div>
      {LEVELS[level].note && <div className="text-right text-[12px] font-bold" style={{ color: C.muted }}>{LEVELS[level].note}</div>}
      <motion.button type="button" onClick={resume ? onResume : needDeck ? onBuild : onPlay} title={problem ?? undefined}
        className="relative h-[86px] overflow-hidden rounded-[6px] flex flex-col items-center justify-center text-white disabled:grayscale disabled:opacity-60"
        style={{ background: `linear-gradient(180deg, ${mix(C.primary, 100)}, ${mix(C.primary, 62)} 55%, ${mix(C.primary, 45)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -3px 0 rgba(0,0,0,0.35), 0 0 0 1px ${mix(C.primary, 80)}, 0 12px 40px ${mix(C.primary, 45)}` }}
        whileHover={{ filter: 'brightness(1.18)' }} whileTap={{ scale: 0.98 }}>
        {/* A slow sheen across the button */}
        <motion.span className="absolute inset-y-0 w-24 -skew-x-12" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)' }}
          animate={{ x: [-160, 460] }} transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }} />
        <span className="relative font-logik-extended-bold uppercase text-[34px] leading-none tracking-wider" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)', ...font }}>{resume ? 'Wróć do gry' : needDeck ? build : 'Graj'}</span>
        <span className="relative text-[11px] font-bold uppercase tracking-[0.3em] mt-1.5 opacity-85">{needDeck ? problem : level === 'tutorial' ? 'Samouczek · krok po kroku' : `Kontrola mapy · Komputer ${LEVELS[level].name}`}</span>
      </motion.button>
      {running && (resume
        ? <button type="button" onClick={onPlay} className="self-end text-[12px] font-bold uppercase tracking-widest underline-offset-4 hover:underline" style={{ color: C.muted }}>Nowy mecz</button>
        : <button type="button" onClick={onResume} className="self-end text-[12px] font-bold uppercase tracking-widest underline-offset-4 hover:underline" style={{ color: C.muted }}>Wróć do meczu · Komputer {LEVELS[running].name}</button>)}
    </div>
  );
}

/** The first-visit explanation: what you get, what to do — the game itself you learn by playing.
 *  Closing it flies it into the "?" button, so you know where it lives. */
function Intro({ onClose }: { onClose: () => void }) {
  const font = useHeaderFont();
  const k = useFitScale();
  const panel = useRef<HTMLDivElement>(null);
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const close = () => {
    const to = centreOf('[data-help="intro"]'); const r = panel.current?.getBoundingClientRect();
    if (!to || !r) { onClose(); return; }
    // The stage is scaled: screen px → layout px
    setFly({ x: (to.x - (r.left + r.width / 2)) / k, y: (to.y - (r.top + r.height / 2)) / k });
    setTimeout(() => { onClose(); pulseAt('[data-help="intro"]'); }, 560);
  };
  const steps = [
    { n: 1, title: 'Zbierasz karty graczy', text: `Każdy gracz turnieju ma kartę za każdą serię, którą zagrał. Im lepiej zagrał, tym mocniejsza karta. Na start masz ${START_PACKS} paczek: otwórz je w Albumie.` },
    { n: 2, title: 'Układasz talię', text: 'W zakładce Talia składasz talię z 20 kart: po 2 na każdą pozycję i 10 dowolnych. Wybieraj świadomie: liczy się siła, pozycja i drużyna.' },
    { n: 3, title: 'Grasz', text: "Kontrola mapy: wystawiaj karty i przejmuj objective'y na mapie. Zacznij od Samouczka (przycisk Graj w prawym dolnym rogu): krótki mecz krok po kroku." },
  ];
  return (
    <motion.div className="absolute inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(5,6,9,0.78)', backdropFilter: 'blur(6px)', pointerEvents: fly ? 'none' : undefined }}
      initial={{ opacity: 0 }} animate={{ opacity: fly ? 0 : 1 }} exit={{ opacity: 0 }} transition={fly ? { duration: 0.5, ease: 'easeIn' } : undefined}>
      <motion.div ref={panel} className="w-[1100px] flex flex-col items-center gap-10 text-white" initial={{ y: 20 }}
        animate={fly ? { x: fly.x, y: fly.y, scale: 0.03, rotate: -14, opacity: 0.5 } : { y: 0 }} transition={fly ? { duration: 0.55, ease: [0.6, 0, 0.9, 0.5] } : undefined}>
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
        <button type="button" onClick={close} className="rounded-full px-10 py-4 font-logik-extended-bold uppercase tracking-widest text-[16px] text-white" style={{ background: C.primary, boxShadow: `0 0 30px ${mix(C.primary, 60)}`, ...font }}>Zaczynamy</button>
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
  const [matchLevel, setMatchLevel] = useState<Level | null>(null);
  const [intro, setIntro] = useState(false);
  // New players start with the tutorial; the last choice is remembered
  const [level, setLevelState] = useState<Level>('tutorial');
  useEffect(() => { try { const l = localStorage.getItem(LEVEL_KEY) as Level | null; if (l && l in LEVELS) setLevelState(l); } catch { /* private mode */ } }, []);
  const setLevel = (l: Level) => { setLevelState(l); try { localStorage.setItem(LEVEL_KEY, l); } catch { /* private mode */ } };

  // Restore this browser's collection, show the intro once
  useEffect(() => {
    const v = load(key);
    if (v) {
      setCollection(v.ids.map(id => byId.get(id)).filter((c): c is GCard => !!c)); setPacks(v.packs);
      // The deck is the player's own work: never built for them
      if (v.deck) setDeck(v.deck.map(id => byId.get(id)).filter((c): c is GCard => !!c));
    }
    try { if (!localStorage.getItem(SEEN_KEY)) setIntro(true); } catch { setIntro(true); }
    setLoaded(true);
  }, [key, byId]);
  useEffect(() => { if (loaded) save(key, { ids: collection.map(c => c.id), packs, deck: deck.map(c => c.id) }); }, [loaded, key, collection, packs, deck]);
  // The tutorial needs no deck of yours: it brings one (from your cards if they make a legal deck)
  const tutorialDeck = useMemo(() => { const d = autoDeck(collection, OUTPOSTS_RULE); return deckProblem(d, OUTPOSTS_RULE) ? autoDeck(cards, OUTPOSTS_RULE) : d; }, [collection, cards]);
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
        <div className="flex items-center gap-1 -ml-4">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className="relative px-4 py-1.5 font-logik-extended-bold uppercase text-[15px] transition-colors" style={{ color: tab === t.id ? C.heading : C.muted, ...font }}>
              {t.label}
              {tab === t.id && <span className="absolute left-3 right-3 -bottom-1 h-[3px] rounded-full" style={{ background: C.primary }} />}
            </button>
          ))}
        </div>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${ink(14)}, transparent)` }} />
        <button type="button" data-help="intro" onClick={() => setIntro(true)} aria-label="Jak to działa" className="w-9 h-9 rounded-full font-logik-extended-bold text-[16px]" style={{ color: C.heading, boxShadow: `inset 0 0 0 1.5px ${mix(C.heading, 40)}`, ...font }}>?</button>
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'album' && <Album cards={cards} collection={collection} setCollection={setCollection} packs={packs} onPackOpened={() => setPacks(p => Math.max(0, p - 1))} />}
        {tab === 'talia' && <DeckBuilder collection={collection} rule={OUTPOSTS_RULE} deck={deck} setDeck={setDeck} />}
        {/* The match stays mounted while you look at the album */}
        <div className={tab === 'gra' ? 'h-full' : 'hidden'}>
          {!match ? null : matchLevel === 'tutorial' ? <OutpostsGame key={match} deck={ready ? deck : tutorialDeck} all={cards} level="tutorial" onBack={() => setTab('talia')} />
            : ready ? <OutpostsGame key={match} deck={deck} all={cards} level={matchLevel ?? level} onBack={() => setTab('talia')} /> : notReady}
        </div>
      </div>
      {tab !== 'gra' && (
        <PlayButton problem={level === 'tutorial' ? null : collection.length ? deckProblem(deck, OUTPOSTS_RULE) : 'Najpierw otwórz paczki w albumie'} build={collection.length ? 'Ułóż talię' : 'Otwórz paczki'}
          running={match > 0 && (ready || matchLevel === 'tutorial') ? matchLevel : null} level={level} setLevel={setLevel} onBuild={() => setTab(collection.length ? 'talia' : 'album')}
          onPlay={() => { setMatch(m => m + 1); setMatchLevel(level); setTab('gra'); }} onResume={() => setTab('gra')} />
      )}
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
