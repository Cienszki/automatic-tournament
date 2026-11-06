'use client';

// The card game's one front page (/[slug]/cards — and later a home page view): one screen, nothing
// behind tabs.
//   top      "Talia", packs waiting to be opened (a foil pack in the middle of the row) and how much
//            of the tournament you've collected (the album opens over the page); help in the corner
//   middle   your deck across the whole width — edited where it is shown: click a card or an empty
//            place and every card that fits opens over the page
//   bottom   the ranking · challenges waiting for you, matches in progress and your last duels ·
//            the play hub: pick who you play (a player, a rematch, the computer, the tutorial) and
//            press Graj. Against a person the button becomes the lobby — the link, the wait, who
//            took it — and the match takes over the screen when both are in.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Link2, Loader2, Search, Swords, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { C, Tip, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { howToText } from '@/lib/card-lab/settings';
import { autoDeck, deckProblem, type GCard } from '@/lib/card-lab/cards';
import { type DeckSlots } from '@/lib/card-lab/frozen';
import { LEVELS, type Level } from '@/lib/card-lab/outposts-ai';
import type { Person } from '@/lib/card-lab/pvp';
import { pulseAt } from '@/components/tour/pulse';
import { count } from '@/lib/plural';
import { Album, PackReveal } from './Album';
import { DeckBuilder } from './DeckBuilder';
import { FoilPack, GOLD } from './FoilPack';
import { OUTPOSTS_RULE, OutpostsGame } from './OutpostsGame';
import { duelPost, useDuel } from './duel/useDuel';

type Who = 'player' | 'rematch' | 'cpu' | 'tutorial';
interface Ranked { uid: string; name: string; avatar: string | null; rating: number; games: number; wins: number; losses: number }
interface Played { id: string; opp: Person; won: boolean; score: [number, number]; delta: number; at: number }
interface Mine { invites: Array<{ id: string; host: Person }>; hosting: Array<{ id: string; status: string }>; live: Array<{ id: string; rival: Person }> }

const MODE_KEY = 'card-lab:play';
/** The deck takes the whole width: 10 cards a row */
const CARD_W = 166;
const HUB_W = 420;

function Pic({ p, size = 30 }: { p: { name: string; avatar: string | null }; size?: number }) {
  return p.avatar
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <span className="rounded-full shrink-0 flex items-center justify-center font-bold" style={{ width: size, height: size, fontSize: size * 0.42, background: ink(8), color: C.muted }}>{p.name.slice(0, 1).toUpperCase()}</span>;
}
function Head({ children }: { children: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <div className="shrink-0 mb-1">
      <h3 className="text-[12px] font-logik-extended-bold uppercase tracking-[0.22em]" style={{ color: C.primary, ...font }}>{children}</h3>
      <div className="relative h-px mt-1.5" style={{ background: ink(12) }}><span className="absolute left-0 top-0 h-px w-10" style={{ background: C.primary }} /></div>
    </div>
  );
}
const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!on) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [on]);
  return now;
}

// ── Packs: a foil pack in the title row while there are any ──────────────────

function PacksPopup({ packs, opening, onOpen }: { packs: number; opening: boolean; onOpen: () => void }) {
  const font = useHeaderFont();
  const shown = Math.min(packs, 3);
  return (
    <AnimatePresence>
      {packs > 0 && (
        <motion.button type="button" onClick={onOpen} disabled={opening} aria-label={`Otwórz paczkę (${packs})`}
          className="group relative rounded-full p-[1.5px] overflow-hidden disabled:opacity-70"
          initial={{ y: -24, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          {/* A light running around the edge */}
          <motion.span className="absolute left-1/2 top-1/2 w-[600px] h-[600px] -ml-[300px] -mt-[300px]"
            style={{ background: `conic-gradient(from 0deg, transparent 0 55%, ${GOLD} 70%, ${mix(C.primary, 100)} 85%, transparent 100%)` }}
            animate={{ rotate: 360 }} transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }} />
          <span className="relative flex items-center gap-4 h-[50px] pl-3 pr-2 rounded-full" style={{ background: 'linear-gradient(180deg, #17121a, #0b0a0f)' }}>
            {/* The packs, fanned, gently floating */}
            <motion.span className="relative" style={{ width: 26 + (shown - 1) * 8, height: 38 }} animate={{ y: [0, -3, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
              {Array.from({ length: shown }, (_, i) => (
                <span key={i} className="absolute top-0" style={{ left: i * 8, transform: `rotate(${(i - (shown - 1) / 2) * 9}deg)`, transformOrigin: '50% 90%' }}>
                  <FoilPack w={26} delay={i * 0.25} />
                </span>
              ))}
              {/* Sparkles */}
              {[[-7, 0], [28 + (shown - 1) * 8, 4], [10, 30]].map(([x, y], i) => (
                <motion.span key={i} className="absolute text-[10px]" style={{ left: x, top: y, color: GOLD }} animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6 }}>✦</motion.span>
              ))}
            </motion.span>
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: GOLD }}>Do otwarcia</span>
              <span className="block font-logik-extended-bold uppercase text-[15px] text-white" style={font}>{count(packs, 'paczka', 'paczki', 'paczek')}</span>
            </span>
            <span className="ml-1 h-[36px] px-5 rounded-full flex items-center font-logik-extended-bold uppercase text-[13px] tracking-widest text-white transition-[filter] group-hover:brightness-125"
              style={{ background: `linear-gradient(180deg, ${mix(C.primary, 100)}, ${mix(C.primary, 70)})`, boxShadow: `0 0 18px ${mix(C.primary, 60)}, inset 0 1px 0 rgba(255,255,255,0.3)`, ...font }}>
              {opening ? 'Otwieram…' : 'Otwórz'}
            </span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ── Bottom: ranking · what's waiting and your duels ─────────────────────────

function RankingList({ ranking, me }: { ranking: Ranked[] | null; me?: string }) {
  const font = useHeaderFont();
  const myRank = ranking ? ranking.findIndex(p => p.uid === me) : -1;
  const top = ranking?.slice(0, 5) ?? [];
  const rows = myRank >= 5 ? [...top.slice(0, 4), ranking![myRank]] : top;
  return (
    <div className="min-w-0 flex flex-col">
      <Head>Ranking</Head>
      {!ranking ? <Loader2 className="w-4 h-4 animate-spin mt-2" style={{ color: C.muted }} />
        : !rows.length ? <div className="py-2 text-[13px]" style={{ color: C.muted }}>Wygraj pojedynek i wejdź na listę. Każdy zaczyna z 1000.</div>
        : rows.map(p => {
          const i = ranking.indexOf(p);
          return (
            <div key={p.uid} className="flex items-center gap-3 py-1.5 border-b" style={{ borderColor: ink(7), background: p.uid === me ? mix(C.primary, 9) : undefined }}>
              <span className="w-6 text-right font-logik-extended-bold text-[14px] tabular-nums" style={{ color: i < 3 ? C.heading : C.muted, ...font }}>{i + 1}</span>
              <Pic p={p} size={26} />
              <span className="flex-1 min-w-0 truncate font-bold text-[14px]" style={{ color: C.heading }}>{p.name}</span>
              <span className="text-[12px] tabular-nums" style={{ color: C.muted }}>{p.wins}–{p.losses}</span>
              <span className="w-[58px] text-right font-logik-extended-bold text-[16px] tabular-nums" style={{ color: C.heading, ...font }}>{p.rating}</span>
            </div>
          );
        })}
    </div>
  );
}

function Waiting({ mine, games, busy, onAccept, onResume }: { mine: Mine | null; games: Played[]; busy: string | null; onAccept: (id: string) => void; onResume: (id: string) => void }) {
  const font = useHeaderFont();
  const calls = [
    ...(mine?.invites ?? []).map(x => ({ id: x.id, p: x.host, text: 'wyzywa cię', act: 'Przyjmij', go: () => onAccept(x.id) })),
    ...(mine?.live ?? []).map(x => ({ id: x.id, p: x.rival, text: 'mecz trwa', act: 'Wróć', go: () => onResume(x.id) })),
  ];
  return (
    <div className="min-w-0 flex flex-col">
      <Head>Pojedynki</Head>
      <AnimatePresence>
        {calls.map(x => (
          <motion.button key={x.id} type="button" onClick={x.go} disabled={!!busy} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            className="shrink-0 flex items-center gap-3 my-1 py-2 pl-3 pr-4 text-left rounded-[6px]" style={{ background: mix(C.primary, 14), boxShadow: `inset 3px 0 0 ${C.primary}` }}>
            <Pic p={x.p} size={32} />
            <span className="flex-1 min-w-0">
              <span className="block font-bold truncate" style={{ color: C.heading }}>{x.p.name}</span>
              <span className="block text-[12px]" style={{ color: C.muted }}>{x.text}</span>
            </span>
            <span className="flex items-center gap-1.5 font-logik-extended-bold uppercase text-[13px] tracking-widest" style={{ color: C.primary, ...font }}>
              {busy === x.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}{x.act}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
      {games.slice(0, Math.max(0, 5 - calls.length)).map(g => (
        <div key={g.id} className="flex items-center gap-3 py-1.5 border-b" style={{ borderColor: ink(7) }}>
          <span className="w-[3px] h-6 rounded-full" style={{ background: g.won ? C.win : C.loss }} />
          <Pic p={g.opp} size={26} />
          <span className="flex-1 min-w-0 truncate text-[14px] font-bold" style={{ color: C.heading }}>{g.opp.name}</span>
          <span className="font-logik-extended-bold tabular-nums text-[14px]" style={{ color: C.heading, ...font }}>{g.score[0]}:{g.score[1]}</span>
          <span className="w-9 text-right text-[12px] font-bold tabular-nums" style={{ color: g.delta >= 0 ? C.win : C.loss }}>{g.delta >= 0 ? '+' : ''}{g.delta}</span>
        </div>
      ))}
      {!calls.length && !games.length && <div className="py-2 text-[13px]" style={{ color: C.muted }}>Tu pojawią się wyzwania od innych graczy i twoje mecze.</div>}
    </div>
  );
}

// ── The play hub ────────────────────────────────────────────────────────────

function BigButton({ title, sub, onClick, busy, waiting }: { title: string; sub?: string; onClick: () => void; busy?: boolean; waiting?: boolean }) {
  const font = useHeaderFont();
  return (
    <motion.button type="button" onClick={onClick} disabled={busy} data-play
      className="relative w-full h-[86px] overflow-hidden rounded-[6px] flex flex-col items-center justify-center text-white"
      style={{ background: `linear-gradient(180deg, ${mix(C.primary, 100)}, ${mix(C.primary, 62)} 55%, ${mix(C.primary, 45)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -3px 0 rgba(0,0,0,0.35), 0 0 0 1px ${mix(C.primary, 80)}, 0 12px 40px ${mix(C.primary, 45)}` }}
      whileHover={{ filter: 'brightness(1.15)' }} whileTap={{ scale: 0.98 }}>
      {/* Sheen; while waiting for a rival it sweeps faster, like a queue */}
      <motion.span className="absolute inset-y-0 w-24 -skew-x-12" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)' }}
        animate={{ x: [-160, 560] }} transition={{ duration: waiting ? 1.4 : 2.6, repeat: Infinity, repeatDelay: waiting ? 0.2 : 1.4, ease: 'easeInOut' }} />
      <span className="relative flex items-center gap-3 font-logik-extended-bold uppercase text-[32px] leading-none tracking-wider" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)', ...font }}>
        {busy && <Loader2 className="w-7 h-7 animate-spin" />}{title}
      </span>
      {sub && <span className="relative max-w-full px-4 truncate text-[11px] font-bold uppercase tracking-[0.25em] mt-2 opacity-85">{sub}</span>}
    </motion.button>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <button type="button" onClick={onClick} className="relative px-2 py-1 font-logik-extended-bold uppercase text-[13px] whitespace-nowrap transition-colors" style={{ color: on ? C.heading : C.muted, ...font }}>
      {children}
      {on && <motion.span layoutId="play-choice" className="absolute left-1.5 right-1.5 -bottom-0.5 h-[3px] rounded-full" style={{ background: C.primary }} />}
    </button>
  );
}

/** Who to play: anyone with a link or a chosen player, the last rival again, the computer (and how hard), the tutorial */
function PlayHub({ statsKey, who, setWho, level, setLevel, target, setTarget, lastRival, problem, cpuRunning, onPlay, onResumeCpu, lobby }: {
  statsKey: string; who: Who; setWho: (w: Who) => void; level: Level; setLevel: (l: Level) => void; target: Person | null; setTarget: (p: Person | null) => void;
  lastRival: Person | null; problem: { text: string; fix: string; onFix: () => void } | null; cpuRunning: Level | null; onPlay: () => void; onResumeCpu: () => void;
  lobby: React.ReactNode | null;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Person[]>([]);
  useEffect(() => {
    const v = q.trim();
    if (!user || !v) { setFound([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/cards/duel?t=${encodeURIComponent(statsKey)}&q=${encodeURIComponent(v)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      setFound((await r.json().catch(() => ({}))).found ?? []);
    }, 180);
    return () => clearTimeout(t);
  }, [q, user, statsKey]);

  if (lobby) return <div className="shrink-0">{lobby}</div>;
  const needsDeck = problem && who !== 'tutorial';
  const resume = who === 'cpu' && cpuRunning === level;
  const rival = who === 'rematch' ? lastRival : target;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end">
        <Choice on={who === 'player'} onClick={() => setWho('player')}>Gracz</Choice>
        {lastRival && <Choice on={who === 'rematch'} onClick={() => setWho('rematch')}>Rewanż</Choice>}
        <Choice on={who === 'cpu'} onClick={() => setWho('cpu')}>Komputer</Choice>
        <Choice on={who === 'tutorial'} onClick={() => setWho('tutorial')}>Samouczek</Choice>
      </div>
      {/* The second choice belongs to the first: whom exactly, or how hard */}
      <div className="h-[32px] flex items-center justify-end">
        {who === 'cpu' && (Object.keys(LEVELS) as Level[]).filter(l => l !== 'tutorial').map(l => (
          <button key={l} type="button" onClick={() => setLevel(l)} className="px-2 text-[13px] font-bold transition-colors" style={{ color: l === level ? LEVELS[l].color : C.muted }}>{LEVELS[l].name}</button>
        ))}
        {who === 'rematch' && lastRival && <span className="flex items-center gap-2.5 text-[14px]" style={{ color: C.heading }}><Pic p={lastRival} size={24} /><b>{lastRival.name}</b></span>}
        {who === 'player' && (target ? (
          <span className="flex items-center gap-2.5 text-[14px]" style={{ color: C.heading }}>
            <Pic p={target} size={24} /><b>{target.name}</b>
            <button type="button" aria-label="Każdy z linkiem" onClick={() => setTarget(null)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
          </span>
        ) : (
          <div className="relative w-full flex items-center gap-2">
            <Search className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nick, albo graj z każdym przez link"
              onKeyDown={e => { if (e.key === 'Enter' && found[0]) { setTarget(found[0]); setQ(''); } }}
              className="flex-1 min-w-0 bg-transparent border-b py-1 text-[14px] outline-none focus:border-[var(--tournament-primary)]" style={{ borderColor: ink(18), color: C.heading }} />
            {found.length > 0 && (
              <div className="absolute right-0 left-6 bottom-full mb-2 z-20 flex flex-col rounded-[6px] overflow-hidden" style={{ background: 'var(--tournament-background, #0b0b10)', boxShadow: `0 0 0 1px ${ink(14)}, 0 18px 40px rgba(0,0,0,0.35)` }}>
                {found.map(p => (
                  <button key={p.uid} type="button" onClick={() => { setTarget(p); setQ(''); }} className="flex items-center gap-3 px-3 py-2 text-left hover:bg-[color-mix(in_srgb,var(--tournament-primary)_12%,transparent)]">
                    <Pic p={p} size={26} /><span className="font-bold text-[14px]" style={{ color: C.heading }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {needsDeck ? <BigButton title={problem.fix} sub={problem.text} onClick={problem.onFix} />
        : resume ? <BigButton title="Wróć do gry" sub={`Komputer · ${LEVELS[level].name}`} onClick={onResumeCpu} />
        : <BigButton title="Graj" sub={who === 'tutorial' ? 'Krótki mecz krok po kroku' : who === 'cpu' ? `Komputer · ${LEVELS[level].name}` : rival ? `${who === 'rematch' ? 'Rewanż' : 'Wyzwanie'}: ${rival.name}` : 'Link dla każdego'} onClick={onPlay} />}
    </div>
  );
}

/** The play hub while you host a duel: the link, the wait, who took it */
function LobbyHub({ view, link, offset, onCancel }: { view: NonNullable<ReturnType<typeof useDuel>['view']>; link: string; offset: number; onCancel: () => void }) {
  const font = useHeaderFont();
  const [copied, setCopied] = useState(false);
  const now = useNow(true) + offset;
  const seated = view.status === 'seated' && view.guest;
  const copy = () => navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  const waited = now - (view.expiresAt - 30 * 60_000);
  return (
    <motion.div className="flex flex-col gap-2.5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-3">
        {seated ? <Pic p={view.guest!} size={36} /> : view.invited ? <Pic p={view.invited} size={36} /> : <Link2 className="w-6 h-6" style={{ color: C.primary }} />}
        <div className="flex-1 min-w-0">
          <div className="font-logik-extended-bold uppercase text-[17px] leading-tight truncate" style={{ color: C.heading, ...font }}>
            {seated ? `${view.guest!.name} szykuje talię` : view.invited ? `Czekasz na: ${view.invited.name}` : 'Czekasz na rywala'}
          </div>
          <div className="text-[12px] mt-0.5 truncate" style={{ color: C.muted }}>
            {seated ? `Mecz zacznie się, gdy będzie gotowy · ${fmt((view.seatUntil ?? now) - now)}` : view.invited ? 'Powiadomienie wysłane. Czeka, dopóki tu jesteś.' : 'Wyślij link albo wrzuć na kanał. Czeka, dopóki tu jesteś.'}
          </div>
        </div>
      </div>
      {!view.invited && !seated && (
        <button type="button" onClick={copy} className="flex items-center gap-3 h-[38px] pl-4 pr-3 rounded-full text-[13px] text-left" style={{ background: ink(6), color: C.heading }}>
          <span className="flex-1 min-w-0 truncate tabular-nums">{link.replace(/^https?:\/\//, '')}</span>
          <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest" style={{ color: copied ? C.win : C.primary }}>{copied ? <><Check className="w-4 h-4" />Skopiowany</> : <><Copy className="w-4 h-4" />Kopiuj</>}</span>
        </button>
      )}
      <BigButton title={seated ? 'Rywal prawie gotowy' : `Szukam · ${fmt(waited)}`} sub="Kliknij, żeby anulować" onClick={onCancel} waiting />
    </motion.div>
  );
}

// ── The page ────────────────────────────────────────────────────────────────

export function CardsHome({ statsKey, cards, collection, packs, slots, setSlots, onOpenPack, onHelp }: {
  statsKey: string; cards: GCard[]; collection: GCard[]; packs: number; slots: DeckSlots; setSlots: (s: DeckSlots) => void;
  onOpenPack: () => Promise<GCard[] | null>; onHelp: () => void;
}) {
  const { user } = useAuth();
  const { tournament, getTournamentPath } = useTournament();
  const font = useHeaderFont();
  const byId = useMemo(() => new Map(collection.map(c => [c.id, c])), [collection]);
  const deck = useMemo(() => Object.values(slots).map(id => byId.get(id)).filter((c): c is GCard => !!c), [slots, byId]);
  const problem = collection.length ? deckProblem(deck, OUTPOSTS_RULE) : null;

  // What the play button does (remembered in this browser)
  const [who, setWhoState] = useState<Who>('tutorial');
  const [level, setLevelState] = useState<Level>('easy');
  const [target, setTarget] = useState<Person | null>(null);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(MODE_KEY) || 'null'); if (v?.who && v.who !== 'rematch') setWhoState(v.who); if (v?.level && v.level in LEVELS) setLevelState(v.level); } catch { /* private mode */ } }, []);
  const save = (w: Who, l: Level) => { try { localStorage.setItem(MODE_KEY, JSON.stringify({ who: w, level: l })); } catch { /* private mode */ } };
  const setWho = (w: Who) => { setWhoState(w); save(w, level); };
  const setLevel = (l: Level) => { setLevelState(l); save(who, l); };

  // Ranking (public), your duels and what's waiting for you (signed in)
  const [refresh, setRefresh] = useState(0);
  const [ranking, setRanking] = useState<Ranked[] | null>(null);
  const [games, setGames] = useState<Played[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const authed = useCallback(async (q: string) => {
    const r = await fetch(`/api/cards/duel?t=${encodeURIComponent(statsKey)}&${q}`, { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    return r.json();
  }, [statsKey, user]);
  useEffect(() => {
    fetch(`/api/cards/duel?t=${encodeURIComponent(statsKey)}&ranking=1`).then(r => r.json()).then(j => setRanking(j.players ?? [])).catch(() => setRanking([]));
    if (user) authed('history=1').then(j => setGames(j.games ?? [])).catch(() => {});
  }, [statsKey, user, authed, refresh]);
  useEffect(() => {
    if (!user) return;
    const load = () => authed('mine=1').then(setMine).catch(() => {});
    load();
    const t = setInterval(load, 12_000);
    return () => clearInterval(t);
  }, [user, authed, refresh]);
  const lastRival = games[0]?.opp ?? null;

  // Over the page: the album, a pack being opened, a match
  const [album, setAlbum] = useState(false);
  const [pack, setPack] = useState<{ cards: GCard[]; before: Set<string>; n: number } | null>(null);
  const [opening, setOpening] = useState(false);
  const [cpu, setCpu] = useState<{ level: Level; n: number } | null>(null);
  const [cpuShown, setCpuShown] = useState(false);
  const [duelId, setDuelId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const duel = useDuel(duelId, user);

  const rip = async () => {
    if (packs <= 0 || opening) return;
    setOpening(true);
    const before = new Set(collection.map(c => c.pid));
    const got = await onOpenPack();
    setOpening(false);
    if (got) setPack(p => ({ cards: got, before, n: (p?.n ?? 0) + 1 }));
  };

  // The tutorial brings a deck (yours if it's legal, else the best from your cards or the tournament)
  const tutorialDeck = useMemo(() => {
    if (!problem && deck.length) return deck;
    const d = autoDeck(collection, OUTPOSTS_RULE);
    return deckProblem(d, OUTPOSTS_RULE) ? autoDeck(cards, OUTPOSTS_RULE) : d;
  }, [problem, deck, collection, cards]);

  const challenge = async (to: Person | null) => {
    if (!user) return;
    setBusy('create'); setError(null);
    const r = await duelPost<{ id: string }>(user, { action: 'create', t: statsKey, ...(to ? { to: to.uid } : {}) });
    setBusy(null);
    if (r.error) setError(r.error); else setDuelId(r.data!.id);
  };
  const play = () => {
    setError(null);
    if (who === 'tutorial') { setCpu(c => ({ level: 'tutorial', n: (c?.n ?? 0) + 1 })); setCpuShown(true); return; }
    if (who === 'cpu') { setCpu(c => ({ level, n: (c?.n ?? 0) + 1 })); setCpuShown(true); return; }
    challenge(who === 'rematch' ? lastRival : target);
  };
  const accept = async (id: string) => {
    if (!user) return;
    if (problem) { setError(`Najpierw talia: ${problem}`); return; }
    setBusy(id); setError(null);
    const took = await duelPost(user, { id, action: 'take' });
    const started = took.error ? took : await duelPost(user, { id, action: 'start' });
    setBusy(null);
    if (started.error) setError(started.error); else setDuelId(id);
  };
  const leaveDuel = async () => {
    if (duel.view && (duel.view.status === 'open' || duel.view.status === 'seated')) await duel.post({ action: 'leave' });
    setDuelId(null); setRefresh(r => r + 1);
  };
  // A lobby that ended without a match (expired, closed): back to the page
  useEffect(() => { if (duel.view && (duel.view.status === 'expired' || duel.view.status === 'cancelled')) { setDuelId(null); setError('Wyzwanie wygasło'); } }, [duel.view]);

  const fix = !collection.length ? { text: 'Najpierw karty', fix: 'Otwórz paczkę', onFix: rip }
    : problem ? { text: problem, fix: 'Uzupełnij talię', onFix: () => pulseAt('[data-deck]') } : null;
  const link = typeof window !== 'undefined' && duelId ? `${window.location.origin}${getTournamentPath(`/cards/duel/${duelId}`)}` : '';
  const hosting = duel.view && duel.view.me === 'host' && (duel.view.status === 'open' || duel.view.status === 'seated');
  const playing = duel.view?.game && duel.view.players && (duel.view.status === 'play' || duel.view.status === 'done');
  const have = new Set(collection.map(c => c.pid)).size;
  const all = new Set(cards.map(c => c.pid)).size;

  return (
    <div className="relative h-full flex flex-col px-10 pt-5 pb-5" style={{ color: C.text }}>
      <button type="button" data-help="intro" onClick={onHelp} aria-label="Jak to działa" className="absolute right-4 top-4 z-20 w-9 h-9 rounded-full font-logik-extended-bold text-[16px]"
        style={{ color: C.heading, boxShadow: `inset 0 0 0 1.5px ${mix(C.heading, 40)}`, ...font }}>?</button>

      {/* The deck, across the whole width */}
      <div className="shrink-0 h-[44px] flex items-baseline gap-5 pr-12" data-deck>
        <span className="font-logik-extended-bold uppercase text-[30px] leading-none" style={{ color: C.heading, ...font }}>Talia</span>
        {!collection.length || problem ? (
          <span className="text-[14px]" style={{ color: problem ? C.loss : C.muted }}>{problem ?? 'Otwórz paczki, żeby mieć z czego ją ułożyć.'}</span>
        ) : (
          // What the organisers wrote in Admin → Karty (or the default)
          <Tip side="bottom" content={<div className="max-w-[360px] whitespace-pre-line leading-relaxed">{howToText(tournament as Parameters<typeof howToText>[0])}</div>}>
            <span className="text-[14px] cursor-help underline decoration-dotted underline-offset-4" style={{ color: C.muted }}>Jak zdobyć więcej kart?</span>
          </Tip>
        )}
        <span className="flex-1 flex justify-center self-center"><PacksPopup packs={packs} opening={opening} onOpen={rip} /></span>
        <button type="button" onClick={() => setAlbum(true)} className="group flex items-baseline gap-2" title="Album: wszyscy gracze turnieju">
          <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: C.muted }}>Kolekcja</span>
          <span className="font-logik-extended-bold text-[18px] tabular-nums group-hover:underline underline-offset-4" style={{ color: C.heading, ...font }}>{have}</span>
          <span className="text-[13px]" style={{ color: C.muted }}>/ {count(all, 'gracza', 'graczy', 'graczy')}</span>
        </button>
      </div>
      <div className="shrink-0 mt-4" style={{ height: Math.round(CARD_W * 1.42) * 2 + 22 }}>
        <DeckBuilder collection={collection} rule={OUTPOSTS_RULE} slots={slots} setSlots={setSlots} w={CARD_W} room={false} />
      </div>

      {/* Under it: ranking · duels · play */}
      <div className="flex-1 min-h-0 mt-5 flex gap-12">
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden"><RankingList ranking={ranking} me={user?.uid} /></div>
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden"><Waiting mine={mine} games={games} busy={busy} onAccept={accept} onResume={id => setDuelId(id)} /></div>
        <div className="shrink-0 flex flex-col justify-end gap-2" style={{ width: HUB_W }}>
          {error && <button type="button" onClick={() => setError(null)} className="text-left text-[13px] font-bold" style={{ color: C.loss }}>{error}</button>}
          <PlayHub statsKey={statsKey} who={who} setWho={setWho} level={level} setLevel={setLevel} target={target} setTarget={setTarget} lastRival={lastRival}
            problem={fix} cpuRunning={cpu && cpu.level !== 'tutorial' ? cpu.level : null} onPlay={busy ? () => {} : play} onResumeCpu={() => setCpuShown(true)}
            lobby={hosting ? <LobbyHub view={duel.view!} link={link} offset={duel.offset} onCancel={leaveDuel} /> : null} />
        </div>
      </div>

      {/* Over the page */}
      <AnimatePresence>
        {album && (
          <motion.div key="album" data-snap-lock className="absolute inset-0 z-40 px-16 pt-6 pb-6" style={{ background: 'var(--tournament-background, #0b0b10)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <button type="button" aria-label="Zamknij album" onClick={() => setAlbum(false)} className="absolute right-6 top-5 z-50 p-2 opacity-70 hover:opacity-100" style={{ color: C.heading }}><X className="w-8 h-8" /></button>
            <Album cards={cards} collection={collection} packs={packs} onOpenPack={onOpenPack} />
          </motion.div>
        )}
        {pack && <PackReveal key={pack.n} cards={pack.cards} isNew={c => !pack.before.has(c.pid)} onClose={() => setPack(null)} left={packs} onNext={rip} />}
      </AnimatePresence>
      {/* A match against the computer stays mounted while you look at the page */}
      {cpu && (
        // data-snap-lock: on the home page, the wheel doesn't scroll away from a match
        <div className={cpuShown ? 'absolute inset-0 z-50' : 'hidden'} data-snap-lock={cpuShown ? '' : undefined}>
          <OutpostsGame key={cpu.n} deck={cpu.level === 'tutorial' ? tutorialDeck : deck} all={cards} level={cpu.level} visible={cpuShown}
            onBack={() => { setCpuShown(false); if (cpu.level === 'tutorial') setCpu(null); }} />
        </div>
      )}
      {playing && (
        <div className="absolute inset-0 z-50" data-snap-lock>
          <OutpostsGame key={duelId!} deck={[]} all={[]} onBack={() => { setDuelId(null); setRefresh(r => r + 1); }}
            net={{ game: duel.view!.game!, players: duel.view!.players!, result: duel.view!.result, offset: duel.offset, send: duel.send, onRematch: () => challenge(duel.view!.players![1]) }} />
        </div>
      )}
    </div>
  );
}
