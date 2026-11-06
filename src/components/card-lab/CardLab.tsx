'use client';

// The card game (a section of the tournament's home page, under the stats): the
// collection lives on the account (/api/cards), and everything else is one front page (Home.tsx):
// packs, the deck, duels with other players, the computer, the ranking.
// Laid out once for 1920×900 and scaled to the screen (up and down), so nothing scrolls.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import type { Model } from '@/lib/stats-lab/derive';
import { C, WithModel, mix, useHeaderFont, useStatsKey } from '@/components/stats-lab/kit';
import { buildSeriesCards, byStrength, type GCard } from '@/lib/card-lab/cards';
import { type DeckSlots } from './DeckBuilder';
import { thawCard, type FrozenCard } from '@/lib/card-lab/frozen';
import { useAuth } from '@/context/AuthContext';
import { CardFace, FitScaleCtx, useFitScale } from './ui';
import { centreOf, pulseAt } from '@/components/tour/pulse';
import { CardsHome } from './Home';
import { SignIn } from './landing/SignIn';
import { NameStep } from './NameStep';

const BASE_W = 1920; const BASE_H = 900;

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

// ── The collection lives on the account (/api/cards): packs drawn there, cards frozen when issued ──
type Api = <T>(method: 'GET' | 'POST' | 'PUT', body?: object) => Promise<T>;
/** Starter packs of a new account (granted by the server; shown in the intro) */
const START_PACKS = 10;
const SEEN_KEY = 'card-lab:intro-seen';

/** What each part of a card means: a big example with numbered marks and the legend next to it.
 *  Marks sit on the card's own layout (CardFace is drawn on a 200-px grid, scaled). */
const PARTS: Array<{ x: number; y: number; side: 'left' | 'right'; title: string; text: string }> = [
  { x: 14, y: 35, side: 'left', title: 'Siła', text: 'Tyle karta bije w walce. Kolor koła to rzadkość: drewniana, brązowa, srebrna, złota, elitarna.' },
  { x: 24, y: 104, side: 'left', title: 'Drużyna', text: 'Gracze tej samej drużyny na jednym objectivie dostają po +1 siły.' },
  { x: 192, y: 66, side: 'right', title: 'Gracz', text: 'Karta jest za jedną serię tego gracza: im lepsza gra w tej serii, tym mocniejsza karta.' },
  { x: 32, y: 167, side: 'left', title: 'Pozycja i umiejętność', text: 'Każda pozycja ma swoją umiejętność (Farma, Gank, Tank, Smoke, Aura), opisaną pod spodem.' },
  { x: 50, y: 272, side: 'left', title: 'Bohater i rzadkość', text: 'Bohater z najlepszej gry tej serii. Karta drużyny kolejki ma tu wynik serii i +1 siły.' },
];
function CardAnatomy({ card }: { card: GCard }) {
  const font = useHeaderFont();
  const W = 330; const k = W / 200;
  return (
    <div className="flex items-center gap-16">
      {/* The marks stand beside the card, a thin line to the part they name (nothing on the card is covered) */}
      <div className="relative shrink-0 mx-12">
        <CardFace c={card} w={W} tip={false} />
        <svg className="absolute inset-0 overflow-visible pointer-events-none" width={W} height={Math.round(W * 1.42)}>
          {PARTS.map(p => {
            const mx = p.side === 'left' ? -34 : W + 34;
            return <line key={p.title} x1={mx} y1={p.y * k} x2={p.x * k} y2={p.y * k} stroke={C.primary} strokeWidth={2} strokeDasharray="4 3" />;
          })}
        </svg>
        {PARTS.map((p, i) => (
          <span key={p.title} className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center font-logik-extended-bold text-[15px] text-white"
            style={{ left: p.side === 'left' ? -34 : W + 34, top: p.y * k, background: C.primary, boxShadow: `0 0 0 3px #0b0b10, 0 0 16px ${mix(C.primary, 70)}`, ...font }}>{i + 1}</span>
        ))}
      </div>
      <div className="w-[560px] flex flex-col gap-5">
        {PARTS.map((p, i) => (
          <div key={p.title} className="flex gap-4">
            <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-logik-extended-bold text-[15px] text-white" style={{ background: C.primary, ...font }}>{i + 1}</span>
            <div>
              <div className="font-logik-extended-bold uppercase text-[18px]" style={font}>{p.title}</div>
              <div className="text-[15px] leading-relaxed opacity-80">{p.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The first-visit explanation: what a card shows, then what to do — the game itself you learn by
 *  playing. Closing it flies it into the "?" button, so you know where it lives. */
function Intro({ onClose, example }: { onClose: () => void; example: GCard | null }) {
  const font = useHeaderFont();
  const k = useFitScale();
  const panel = useRef<HTMLDivElement>(null);
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const [page, setPage] = useState(example ? 0 : 1);
  const close = () => {
    const to = centreOf('[data-help="intro"]'); const r = panel.current?.getBoundingClientRect();
    if (!to || !r) { onClose(); return; }
    // The stage is scaled: screen px → layout px
    setFly({ x: (to.x - (r.left + r.width / 2)) / k, y: (to.y - (r.top + r.height / 2)) / k });
    setTimeout(() => { onClose(); pulseAt('[data-help="intro"]'); }, 560);
  };
  const steps = [
    { n: 1, title: 'Zbierasz karty graczy', text: `Każdy gracz turnieju ma kartę za każdą rozegraną serię. Im lepsza gra, tym mocniejsza karta. Na start masz ${START_PACKS} paczek: otwierasz je u góry.` },
    { n: 2, title: 'Układasz talię', text: 'Talia to 20 kart: po 2 na każdą pozycję i 10 dowolnych. Kliknij miejsce w talii, żeby wybrać kartę. Liczy się siła, pozycja i drużyna.' },
    { n: 3, title: 'Grasz', text: 'Przycisk Graj w prawym dolnym rogu: z innym graczem (link albo wyzwanie po nicku), z komputerem albo Samouczek, krótki mecz krok po kroku.' },
  ];
  const button = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="rounded-full px-10 py-4 font-logik-extended-bold uppercase tracking-widest text-[16px] text-white" style={{ background: C.primary, boxShadow: `0 0 30px ${mix(C.primary, 60)}`, ...font }}>{label}</button>
  );
  return (
    <motion.div className="absolute inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(5,6,9,0.78)', backdropFilter: 'blur(6px)', pointerEvents: fly ? 'none' : undefined }}
      initial={{ opacity: 0 }} animate={{ opacity: fly ? 0 : 1 }} exit={{ opacity: 0 }} transition={fly ? { duration: 0.5, ease: 'easeIn' } : undefined}>
      <motion.div ref={panel} className="w-[1100px] flex flex-col items-center gap-10 text-white" initial={{ y: 20 }}
        animate={fly ? { x: fly.x, y: fly.y, scale: 0.03, rotate: -14, opacity: 0.5 } : { y: 0 }} transition={fly ? { duration: 0.55, ease: [0.6, 0, 0.9, 0.5] } : undefined}>
        <div className="font-logik-extended-bold uppercase text-[54px] leading-none" style={font}>{page === 0 ? 'Karta' : 'Gra karciana'}</div>
        {page === 0 && example ? (
          <>
            <CardAnatomy card={example} />
            {button('Dalej', () => setPage(1))}
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-12 w-full">
              {steps.map(st => (
                <div key={st.n} className="flex flex-col items-center text-center gap-3">
                  <span className="w-14 h-14 rounded-full flex items-center justify-center font-logik-extended-bold text-[24px] text-white" style={{ background: C.primary, boxShadow: `0 0 24px ${mix(C.primary, 60)}`, ...font }}>{st.n}</span>
                  <div className="font-logik-extended-bold uppercase text-[20px]" style={font}>{st.title}</div>
                  <div className="text-[15px] leading-relaxed opacity-80">{st.text}</div>
                </div>
              ))}
            </div>
            {button('Zaczynamy', close)}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Lab({ model, api, statsKey }: { model: Model; api: Api; statsKey: string }) {
  const { tournament } = useTournament();
  const cards = useMemo(() => buildSeriesCards(model, tournament?.type), [model, tournament?.type]);
  // The intro's example card: a strong one with a team (shows every part)
  const example = useMemo(() => [...cards].filter(c => !c.totw && !c.standin && c.team).sort(byStrength)[0] ?? null, [cards]);
  const [collection, setCollection] = useState<GCard[]>([]);
  const [packs, setPacks] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The deck as the player laid it out (slot → card)
  const [slots, setSlots] = useState<DeckSlots>({});
  const [intro, setIntro] = useState(false);
  // No nick and no Discord yet: pick a name first (then load again)
  const [needName, setNeedName] = useState(false);
  const [tries, setTries] = useState(0);

  // The account's collection (a new account gets its starter packs); the intro once per browser
  useEffect(() => {
    api<{ packs: number; cards: FrozenCard[]; slots: DeckSlots }>('GET')
      .then(v => { setCollection(v.cards.map(thawCard)); setPacks(v.packs); setSlots(v.slots); setNeedName(false); setLoaded(true); })
      .catch(e => { if (e.need === 'name') setNeedName(true); else setLoadError(e.message || 'Nie udało się wczytać kolekcji'); });
    try { if (!localStorage.getItem(SEEN_KEY)) setIntro(true); } catch { setIntro(true); }
  }, [api, tries]);
  // A pack found somewhere on the site (PackFinder)
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<{ t: string; packs: number }>).detail; if (d?.t === statsKey) setPacks(d.packs); };
    window.addEventListener('cards:packs', on);
    return () => window.removeEventListener('cards:packs', on);
  }, [statsKey]);
  const openPack = async (): Promise<GCard[] | null> => {
    try {
      const r = await api<{ opened: FrozenCard[]; packs: number }>('POST', { action: 'open' });
      const got = r.opened.map(thawCard);
      setCollection(c => [...c, ...got]); setPacks(r.packs);
      return got;
    } catch (e) { setLoadError((e as Error).message); return null; }
  };
  // Every deck change is saved to the account (shortly after the last click)
  const savedSlots = useRef<string>('');
  useEffect(() => {
    if (!loaded) return;
    const json = JSON.stringify(slots);
    if (!savedSlots.current) { savedSlots.current = json; return; }
    if (json === savedSlots.current) return;
    const t = setTimeout(() => { api('PUT', { slots }).then(() => { savedSlots.current = json; }).catch(e => setLoadError((e as Error).message)); }, 600);
    return () => clearTimeout(t);
  }, [slots, loaded, api]);
  const closeIntro = () => { setIntro(false); try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ } };

  if (needName) return <Centered><NameStep onDone={() => setTries(t => t + 1)} /></Centered>;
  if (!loaded) return <Centered>{loadError ? <>{loadError}<button type="button" onClick={() => location.reload()} className="mt-4 underline underline-offset-4">Spróbuj ponownie</button></> : 'Wczytuję kolekcję…'}</Centered>;
  return (
    <div className="relative h-full">
      <CardsHome statsKey={statsKey} cards={cards} collection={collection} packs={packs} slots={slots} setSlots={setSlots} onOpenPack={openPack} onHelp={() => setIntro(true)} />
      <AnimatePresence>{intro && <Intro onClose={closeIntro} example={example} />}</AnimatePresence>
      {loadError && <button type="button" onClick={() => setLoadError(null)} className="absolute left-1/2 -translate-x-1/2 bottom-6 z-40 rounded-full px-5 py-2 text-[14px] font-bold text-white" style={{ background: C.loss }}>{loadError} ✕</button>}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex flex-col items-center justify-center text-[16px] text-center" style={{ color: C.text }}>{children}</div>;
}

/** Signed in → the lab, talking to /api/cards for this tournament with the account's token */
function Gate() {
  const { user, loading } = useAuth();
  const key = useStatsKey();
  const api = useCallback<Api>(async <T,>(method: 'GET' | 'POST' | 'PUT', body?: object) => {
    const token = await user!.getIdToken();
    const res = await fetch(method === 'GET' ? `/api/cards?t=${encodeURIComponent(key!)}` : '/api/cards', {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify({ t: key, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.error || 'Błąd serwera'), { need: json.need as string | undefined });
    return json as T;
  }, [user, key]);
  if (loading || !key) return null;
  if (!user) return <WithModel>{m => <SignIn model={m} />}</WithModel>;
  return <WithModel>{m => <Lab key={user.uid} model={m} api={api} statsKey={key} />}</WithModel>;
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

/** The cards' frame (also the duel page's): fixed under the navbar, one 1920x900 screen scaled to fit; phones get a notice.
 *  `embedded` = a section of the home page: fills its box instead. */
export function CardStage({ children, embedded = false }: { children: React.ReactNode; embedded?: boolean }) {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 899px)');
    const on = () => setSmall(q.matches);
    on(); q.addEventListener('change', on); return () => q.removeEventListener('change', on);
  }, []);
  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
      {/* Fixed under the navbar and above the footer: the layout puts other pages in a padded container */}
      <div className={embedded ? 'relative w-full h-full' : 'fixed inset-x-0 bottom-0 top-14 z-[45]'} style={{ background: 'var(--tournament-background, #0b0b10)' }}>
        {small ? <SmallScreen /> : (
          <FitStage>
            {children}
          </FitStage>
        )}
      </div>
    </TooltipPrimitive.Provider>
  );
}

export default function CardLab() {
  return <CardStage><Gate /></CardStage>;
}

/** The home page's card section: mounted the first time it comes on screen (no collection is
 *  created and no intro pops up for visitors who never scroll down to it) */
export function CardsSection({ active }: { active: boolean }) {
  const [seen, setSeen] = useState(active);
  useEffect(() => { if (active) setSeen(true); }, [active]);
  return <CardStage embedded>{seen ? <Gate /> : null}</CardStage>;
}
