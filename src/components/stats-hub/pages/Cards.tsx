'use client';

// Cards — player cards (#4), team cards (#58) and card packs (#45) merged into one game:
//   Paczki     rip open a pack of five; the glow of a face-down card betrays its rarity
//   Album      every card of the season, the missing ones as silhouettes (secrets only hint)
//   Pojedynek  Top Trumps with your own player cards against the computer; a win earns a pack
// Six rarities: bronze, silver, gold (by rating), legendary, cursed (the roasts) and mythic —
// secret cards that only exist because something rare happened this season. Any card can drop
// as a shiny foil. Packs refill over time; the collection lives in this browser.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import type { Model } from '@/lib/stats-lab/derive';
import { POS_OF, plural } from '@/lib/stats-lab/season';
import { metric } from '@/lib/stats-lab/metrics';
import {
  Avatar, C, HeroImg, HeroRender, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize, useStatsKey,
} from '@/components/stats-lab/kit';
import { useStored } from '../nav';
import { avatar, logo, render, type Asset } from '../assets';
import {
  DUEL_ATTRS, MAX_STORED_PACKS, PACK_EVERY_MS, RARITIES, RARITY, buildCards, cardsKey, emptyCollection, openPack, refill,
  type Card, type Collection, type PlayerCard, type Pull, type Rarity,
} from '../cards-data';
import { count } from '@/lib/plural';

const CARD_RENDER = '320px';
const RATIO = 0.7;

// ── Card faces ──────────────────────────────────────────────────────────

function Foil() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none mix-blend-color-dodge"
      style={{ background: 'linear-gradient(115deg, transparent 20%, rgba(255,120,220,0.45) 35%, rgba(120,220,255,0.5) 45%, rgba(255,240,140,0.45) 55%, transparent 70%)', backgroundSize: '260% 100%' }}
      animate={{ backgroundPosition: ['100% 0', '-100% 0'] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }} />
  );
}

function frameStyle(r: Rarity): React.CSSProperties {
  const color = RARITY[r].color;
  return {
    position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    background: r === 'mythic'
      ? 'linear-gradient(160deg, rgba(94,240,255,0.25), transparent 35%, rgba(176,114,255,0.25) 70%, transparent), linear-gradient(180deg, #10131c, #07080d)'
      : `linear-gradient(160deg, ${mix(color, 28)} 0%, transparent 42%), linear-gradient(180deg, #15151c, #0b0b10)`,
    border: `1.5px solid ${mix(color, 75)}`,
    boxShadow: `0 18px 44px rgba(0,0,0,0.5), inset 0 0 40px ${mix(color, 12)}`,
  };
}

function RarityTag({ r, s }: { r: Rarity; s: number }) {
  return <span className="font-bold uppercase" style={{ fontSize: Math.max(8, 10 * s), letterSpacing: '0.2em', color: RARITY[r].color }}>{RARITY[r].label}</span>;
}

function AttrGrid({ attrs, s, color, pick, picked }: { attrs: PlayerCard['attrs']; s: number; color: string; pick?: (abbr: string) => void; picked?: string | null }) {
  const font = useHeaderFont();
  return (
    <div className="relative grid grid-cols-2 gap-x-5 gap-y-1 px-6" style={{ marginTop: 10 * s }}>
      {attrs.map(a => {
        const on = picked === a.abbr;
        const body = (
          <span className="flex items-center gap-2">
            <span className="font-logik-extended-bold tabular-nums text-right" style={{ width: 30 * s, fontSize: 19 * s, color: a.score >= 80 ? color : undefined, ...font }}>{a.score}</span>
            <span className="tracking-widest opacity-75" style={{ fontSize: 11 * s }}>{a.abbr}</span>
          </span>
        );
        return pick ? (
          <button key={a.abbr} type="button" onClick={e => { e.stopPropagation(); pick(a.abbr); }}
            className="rounded-lg px-1 -mx-1 transition-all hover:bg-white/15" style={on ? { background: mix(color, 35), boxShadow: `0 0 0 1px ${color}` } : undefined}>
            {body}
          </button>
        ) : (
          <Tip key={a.abbr} content={<TipBody title={a.name}>{a.desc}. Średnio {a.shown} — lepiej niż {Math.round(((a.score - 30) / 69) * 100)}%.</TipBody>}>
            <span className="cursor-help">{body}</span>
          </Tip>
        );
      })}
    </div>
  );
}

function CardFront({ card, w, h, foil, pick, picked }: { card: Card; w: number; h: number; foil?: boolean; pick?: (abbr: string) => void; picked?: string | null }) {
  const font = useHeaderFont();
  const s = h / 460;
  const r = RARITY[card.rarity];
  const inner = (() => {
    if (card.kind === 'player' || card.kind === 'team') {
      const isP = card.kind === 'player';
      const heroes = isP ? card.player.heroes.slice(0, 4) : card.team.heroPicks.slice(0, 4);
      return (
        <div className="flex flex-col h-full">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full blur-3xl" style={{ background: mix(r.color, 25) }} />
          <div className="relative flex px-4 pt-4" style={{ height: h * 0.44 }}>
            <div className="flex flex-col items-center pt-1 shrink-0" style={{ width: 62 * s }}>
              <span className="font-logik-extended-bold leading-none" style={{ fontSize: 38 * s, color: r.color, ...font }}>{card.ovr}</span>
              <span className="mt-1 font-bold tracking-widest opacity-80" style={{ fontSize: 11 * s }}>
                {isP ? `POZ ${POS_OF[card.player.role ?? ''] ?? '–'}` : (card.team.tag ?? 'DRU')}
              </span>
              <div className="mt-2">{isP ? <TeamLogo team={card.player.team} size={Math.round(28 * s)} /> : null}</div>
              {!isP && <div className="mt-1 flex flex-col gap-0.5">{card.team.form.slice(-5).map((x, i) => <span key={i} className="rounded-full" style={{ width: 22 * s, height: 5 * s, background: x ? C.win : C.loss }} />)}</div>}
            </div>
            <div className="flex-1 flex items-end justify-center">
              {isP ? <Avatar player={card.player} size={Math.round(148 * s)} ring={mix(r.color, 80)} /> : <TeamLogo team={card.team} size={Math.round(156 * s)} />}
            </div>
          </div>
          <div className="relative text-center px-3" style={{ marginTop: 6 * s }}>
            <div className="font-logik-extended-bold uppercase truncate" style={{ fontSize: 21 * s, ...font }}>{card.name}</div>
            <div className="h-px mx-6 mt-1" style={{ background: `linear-gradient(90deg, transparent, ${r.color}, transparent)` }} />
          </div>
          <AttrGrid attrs={card.attrs} s={s} color={r.color} pick={pick} picked={picked} />
          <div className="flex-1" />
          <div className="relative flex justify-center gap-1.5" style={{ marginBottom: 6 * s }}>
            {heroes.map(hu => <HeroImg key={hu.heroId} heroId={hu.heroId} className="rounded-md" style={{ width: 42 * s, height: 24 * s }} />)}
          </div>
          <div className="relative flex justify-center items-center gap-3 uppercase tracking-widest opacity-75" style={{ fontSize: 9.5 * s, paddingBottom: 10 * s }}>
            <RarityTag r={card.rarity} s={s} />
            <span>{isP ? `${count(card.player.games, 'gra', 'gry', 'gier')} · ${Math.round(card.player.wr * 100)}% W` : `${card.team.wins}–${card.team.losses}`}</span>
          </div>
        </div>
      );
    }
    // Moment and secret cards: the hero of the moment, the number, who it is about
    const big = card.kind === 'moment' ? card.fact.big : card.big;
    const title = card.kind === 'moment' ? card.fact.title : card.title;
    const sub = card.kind === 'moment' ? card.fact.sub : card.sub;
    const kicker = card.kind === 'moment' ? card.fact.kicker : card.name;
    const player = card.kind === 'moment' ? card.fact.player : card.player;
    const team = card.kind === 'moment' ? card.fact.team : card.team;
    return (
      <>
        {card.heroId != null && <HeroImg heroId={card.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-45" />}
        {card.heroId != null && <div className="absolute inset-x-0 top-[8%] bottom-[30%]"><HeroRender heroId={card.heroId} sizes={CARD_RENDER} /></div>}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.95), rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.05))' }} />
        <div className="relative h-full flex flex-col justify-end gap-1" style={{ padding: 16 * s }}>
          <RarityTag r={card.rarity} s={s} />
          <div className="uppercase tracking-[0.25em] text-white/75" style={{ fontSize: 10 * s }}>{kicker}</div>
          <div className="font-logik-extended-bold tabular-nums leading-[0.95]" style={{ fontSize: (card.kind === 'secret' && big.length > 6 ? 34 : 46) * s, color: card.rarity === 'mythic' ? r.color : undefined, ...font }}>{big}</div>
          <div className="flex items-center gap-2 min-w-0 mt-1">
            {player ? <Avatar player={player} size={Math.round(40 * s)} ring={r.color} /> : team ? <TeamLogo team={team} size={Math.round(40 * s)} /> : null}
            <div className="min-w-0">
              <div className="font-bold leading-tight truncate" style={{ fontSize: 15 * s }}>{title}</div>
              {sub && <div className="text-white/70 line-clamp-2" style={{ fontSize: 10.5 * s }}>{sub}</div>}
            </div>
          </div>
        </div>
      </>
    );
  })();
  return (
    <div style={{ ...frameStyle(card.rarity), width: w, height: h, position: 'relative' }} className="text-white">
      {inner}
      {(foil || card.rarity === 'mythic') && <Foil />}
      {foil && <span className="absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-black" style={{ background: 'linear-gradient(90deg,#ffd1f5,#c8f4ff,#fff3b0)' }}>foil</span>}
    </div>
  );
}

function CardBack({ r, w, h }: { r: Rarity; w: number; h: number }) {
  const { theme } = useTournament();
  const color = RARITY[r].color;
  const glow = r === 'mythic' ? 60 : r === 'legendary' || r === 'cursed' ? 44 : r === 'epic' ? 28 : 14;
  return (
    <div className="relative rounded-[20px] overflow-hidden" style={{ width: w, height: h, background: `repeating-linear-gradient(45deg, ${mix(C.primary, 45)} 0 10px, ${mix(C.primary, 28)} 10px 20px), #15151c`, boxShadow: `0 0 0 3px ${color}, 0 0 ${glow}px ${color}` }}>
      <div className="absolute inset-3 rounded-xl flex flex-col items-center justify-center gap-3" style={{ border: '2px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.25)' }}>
        {theme.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logoUrl} alt="" className="object-contain opacity-90" style={{ width: w * 0.42, height: w * 0.42 }} />
        )}
        <span className="text-[11px] uppercase tracking-[0.35em] text-white/80">Odkryj</span>
      </div>
      {r === 'mythic' && <Foil />}
    </div>
  );
}

/** A card that flips from its back to its front */
function FlipCard({ pull, w, h, flipped, onClick, delay = 0, rot = 0 }: { pull: Pull; w: number; h: number; flipped: boolean; onClick: () => void; delay?: number; rot?: number }) {
  return (
    <motion.div className="relative shrink-0" style={{ width: w, height: h, perspective: 1200 }}
      initial={{ y: 280, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1, rotate: flipped ? 0 : rot }}
      transition={{ delay, type: 'spring', stiffness: 140, damping: 16 }} whileHover={{ y: -10 }}>
      <motion.button type="button" onClick={onClick} className="absolute inset-0 text-left" style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.6, ease: [0.3, 1.2, 0.5, 1] }}>
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}><CardBack r={pull.card.rarity} w={w} h={h} /></div>
        <div className="absolute inset-0" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <CardFront card={pull.card} w={w} h={h} foil={pull.foil} />
        </div>
      </motion.button>
      {flipped && pull.isNew && (
        <motion.span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black" style={{ background: '#3fbf7f' }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.45 }}>Nowa</motion.span>
      )}
    </motion.div>
  );
}

// ── Packs ───────────────────────────────────────────────────────────────

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
const fmtLeft = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function PackTab({ cards, col, setCol }: { cards: Card[]; col: Collection; setCol: (f: (c: Collection) => Collection) => void }) {
  const font = useHeaderFont();
  const { theme } = useTournament();
  const [hand, setHand] = useState<Pull[] | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [packNo, setPackNo] = useState(0);
  const [flash, setFlash] = useState(false);
  const [poke, setPoke] = useState(0);
  const [ref, box] = useSize<HTMLDivElement>();
  const now = useNow();

  const owned = useMemo(() => new Set(Object.keys(col.owned)), [col.owned]);
  const rip = () => {
    if (col.packs <= 0) return;
    const pulls = openPack(cards, owned, Math.random, !!col.secretCode);
    setCol(c => ({
      ...c,
      packs: c.packs - 1,
      lastRefill: c.packs >= MAX_STORED_PACKS ? Date.now() : c.lastRefill,
      opened: c.opened + 1,
      secretCode: false,
      owned: pulls.reduce((o, p) => ({ ...o, [p.card.id]: (o[p.card.id] ?? 0) + 1 }), c.owned),
      foils: [...new Set([...c.foils, ...pulls.filter(p => p.foil).map(p => p.card.id)])],
    }));
    setHand(pulls); setFlipped(new Set()); setPackNo(n => n + 1); setPoke(0);
  };
  const flip = (i: number) => {
    if (!hand || flipped.has(i)) return;
    setFlipped(s => new Set(s).add(i));
    if (hand[i].card.rarity === 'mythic') { setFlash(true); setTimeout(() => setFlash(false), 900); }
  };
  const flipAll = () => hand && hand.forEach((_, i) => setTimeout(() => flip(i), i * 160));
  const allFlipped = hand != null && flipped.size === hand.length;

  const gap = 16;
  // Leave room for the fan's rotation and the hover lift
  const ch = Math.min(box.h * 0.86, ((box.w * 0.94 - gap * 4) / 5) / RATIO);
  const cw = ch * RATIO;
  const nextIn = col.packs >= MAX_STORED_PACKS ? null : col.lastRefill + PACK_EVERY_MS - now;
  const mythicHere = hand?.some((p, i) => p.card.rarity === 'mythic' && flipped.has(i));

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div ref={ref} className="relative flex-1 min-h-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!hand ? (
            <motion.div key="pack" className="flex items-center gap-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              {/* The pack: shakes when there is one, sits greyed out otherwise */}
              <motion.button type="button" onClick={rip} disabled={col.packs <= 0}
                onMouseDown={() => setPoke(p => p + 1)}
                className="relative rounded-[28px] overflow-hidden flex flex-col items-center justify-center gap-4 disabled:cursor-not-allowed"
                style={{ width: Math.min(300, box.h * 0.6), height: Math.min(440, box.h * 0.9), filter: col.packs > 0 ? undefined : 'grayscale(0.8) brightness(0.6)', background: `linear-gradient(135deg, ${mix(C.primary, 85)}, ${mix(C.secondary, 70)} 60%, ${mix(C.primary, 90)})`, boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 60px ${mix(C.secondary, 40)}` }}
                animate={col.packs > 0 ? { rotate: [0, -1.5, 1.5, 0] } : undefined} transition={{ rotate: { repeat: Infinity, duration: 2.4 } }} whileHover={col.packs > 0 ? { scale: 1.05 } : undefined}>
                <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 45%, transparent 60%)', backgroundSize: '250% 100%' }} animate={{ backgroundPosition: ['100% 0', '-100% 0'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} />
                <div className="absolute top-0 inset-x-0 h-10" style={{ background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 6px, transparent 6px 12px)' }} />
                {theme.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={theme.logoUrl} alt="" className="relative object-contain" style={{ width: '55%', height: '30%' }} />
                )}
                <div className="relative text-3xl font-logik-extended-bold uppercase text-white text-center leading-tight" style={font}>Paczka<br />sezonu</div>
                <div className="relative text-xs uppercase tracking-[0.3em] text-white/80">5 kart · ostatnia zawsze wyjątkowa</div>
                {col.packs > 0 && <span className="absolute top-4 right-4 rounded-full min-w-[34px] h-[34px] px-2 flex items-center justify-center text-sm font-bold text-black" style={{ background: '#fff' }}>×{col.packs}</span>}
              </motion.button>
              <div className="max-w-[300px] flex flex-col gap-3">
                <div className="text-4xl font-logik-extended-bold" style={{ color: C.heading, ...font }}>{col.packs} {plural(col.packs, 'paczka', 'paczki', 'paczek')}</div>
                <div className="text-sm leading-relaxed" style={{ color: C.text }}>
                  {col.packs > 0 ? 'Kliknij paczkę, żeby ją rozerwać. Poświata zakrytej karty zdradza jej rzadkość.' : 'Paczki skończyły się — następna darmowa już się szykuje. Albo wygraj pojedynek.'}
                </div>
                {nextIn != null && <div className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Darmowa paczka za <b className="tabular-nums" style={{ color: C.heading }}>{fmtLeft(nextIn)}</b> · max {MAX_STORED_PACKS}</div>}
                <div className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Wygrany pojedynek = +1 paczka</div>
                {poke >= 7 && col.packs > 0 && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm italic" style={{ color: C.muted }}>Spokojnie, paczka nie ucieknie.</motion.div>}
              </div>
            </motion.div>
          ) : (
            <motion.div key={`hand-${packNo}`} className="flex items-center" style={{ gap }} exit={{ opacity: 0, y: 40 }}>
              {hand.map((p, i) => <FlipCard key={`${packNo}-${i}`} pull={p} w={cw} h={ch} rot={(i - 2) * 2.5} delay={0.12 + i * 0.1} flipped={flipped.has(i)} onClick={() => flip(i)} />)}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {flash && <motion.div className="absolute inset-0 pointer-events-none z-20" style={{ background: 'radial-gradient(circle, rgba(94,240,255,0.55), transparent 65%)' }} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} />}
        </AnimatePresence>
        {mythicHere && (
          <motion.div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 rounded-full px-5 py-1.5 text-sm font-logik-extended-bold uppercase tracking-[0.3em] text-black"
            style={{ background: 'linear-gradient(90deg,#5ef0ff,#b072ff,#ffd36e)', ...font }} initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }}>
            Mityczna karta!
          </motion.div>
        )}
      </div>
      <div className="shrink-0 h-12 flex items-center justify-center gap-3 mt-2">
        {hand && !allFlipped && <button type="button" onClick={flipAll} className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), color: C.text, border: `1px solid ${ink(16)}` }}>Odkryj wszystkie</button>}
        {hand && allFlipped && (
          col.packs > 0
            ? <button type="button" onClick={rip} className="rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Następna paczka ({col.packs})</button>
            : <button type="button" onClick={() => setHand(null)} className="rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), color: C.text }}>Gotowe</button>
        )}
      </div>
    </div>
  );
}

// ── Album ───────────────────────────────────────────────────────────────

type Kind = 'all' | Card['kind'];
const KIND_LABEL: Record<Kind, string> = { all: 'Wszystkie', player: 'Gracze', team: 'Drużyny', moment: 'Momenty', secret: 'Sekrety' };

function MiniCard({ card, have, foil, onOpen }: { card: Card; have: boolean; foil: boolean; onOpen: () => void }) {
  const font = useHeaderFont();
  const r = RARITY[card.rarity];
  if (!have) {
    const tip = card.kind === 'secret' ? <TipBody title="Sekretna karta">{card.hint}</TipBody> : <TipBody title={`${r.label} karta`}>Jeszcze jej nie masz.</TipBody>;
    return (
      <Tip content={tip}>
        <div className="relative h-full rounded-xl flex flex-col items-center justify-center gap-1 cursor-help" style={{ background: ink(4), boxShadow: `inset 0 0 0 1.5px ${mix(r.color, 35)}` }}>
          <span className="text-2xl font-logik-extended-bold" style={{ color: mix(r.color, 55), ...font }}>{card.kind === 'secret' ? '???' : '?'}</span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: mix(r.color, 60) }}>{r.label}</span>
        </div>
      </Tip>
    );
  }
  const face = card.kind === 'player' ? <Avatar player={card.player} size={52} />
    : card.kind === 'team' ? <TeamLogo team={card.team} size={52} />
      : card.heroId != null ? <HeroImg heroId={card.heroId} className="w-full h-full absolute inset-0 opacity-60" /> : null;
  const top = card.kind === 'player' || card.kind === 'team' ? String(card.ovr) : card.kind === 'moment' ? card.fact.big : card.big;
  return (
    <button type="button" onClick={onOpen} className="relative h-full rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1 text-white transition-transform hover:-translate-y-1"
      style={{ background: `linear-gradient(160deg, ${mix(r.color, 30)}, #0b0b10 60%)`, boxShadow: `inset 0 0 0 1.5px ${r.color}` }}>
      {card.kind === 'moment' || card.kind === 'secret' ? <>{face}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" /></> : face}
      <span className="relative font-logik-extended-bold tabular-nums leading-none truncate max-w-full px-1" style={{ fontSize: 15, color: r.color, ...font }}>{top}</span>
      <span className="relative text-[10px] font-bold truncate max-w-full px-1.5">{card.kind === 'moment' ? card.fact.title : card.name}</span>
      {foil && <Foil />}
    </button>
  );
}

function AlbumTab({ cards, col }: { cards: Card[]; col: Collection }) {
  const font = useHeaderFont();
  const [kind, setKind] = useState<Kind>('all');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Card | null>(null);
  const [ref, box] = useSize<HTMLDivElement>();
  // Owned first, rarest first; undiscovered secrets only show (as hints) under "Sekrety"
  const list = useMemo(() => cards.filter(c => (kind === 'all' || c.kind === kind) && (kind === 'secret' || c.kind !== 'secret' || col.owned[c.id]))
    .sort((a, b) => Number(!col.owned[a.id]) - Number(!col.owned[b.id]) || RARITY[b.rarity].order - RARITY[a.rarity].order || a.name.localeCompare(b.name)), [cards, kind, col.owned]);
  const cw = 96; const chh = 128; const g = 8;
  const cols = Math.max(1, Math.floor((box.w + g) / (cw + g)));
  const rows = Math.max(1, Math.floor((box.h + g) / (chh + g)));
  const per = cols * rows;
  const pages = Math.max(1, Math.ceil(list.length / per)); const pg = Math.min(page, pages - 1);
  useEffect(() => setPage(0), [kind]);
  const ownedCount = cards.filter(c => col.owned[c.id]).length;
  const kinds: Kind[] = ['all', 'player', 'team', 'moment', 'secret'];

  return (
    <div className="flex-1 min-h-0 flex gap-6">
      <div className="w-[230px] shrink-0 flex flex-col gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>Kolekcja</div>
          <div className="text-4xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{ownedCount}<span className="text-xl" style={{ color: C.muted }}> / {cards.length}</span></div>
          <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: ink(8) }}><div className="h-full" style={{ width: `${(ownedCount / Math.max(1, cards.length)) * 100}%`, background: C.secondary }} /></div>
        </div>
        <div className="flex flex-col gap-2">
          {RARITIES.map(r => {
            const all = cards.filter(c => c.rarity === r); const got = all.filter(c => col.owned[c.id]).length;
            if (!all.length) return null;
            return (
              <div key={r} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: RARITY[r].color, boxShadow: `0 0 6px ${RARITY[r].color}` }} />
                <span className="flex-1" style={{ color: C.text }}>{RARITY[r].label}</span>
                <span className="tabular-nums font-bold" style={{ color: C.heading }}>{r === 'mythic' && got < all.length ? `${got} / ?` : `${got} / ${all.length}`}</span>
              </div>
            );
          })}
        </div>
        <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
          {col.opened} {plural(col.opened, 'paczka otwarta', 'paczki otwarte', 'paczek otwartych')} · {col.foils.length} foil · pojedynki {col.duels.won}–{col.duels.lost}
        </div>
        <div className="text-[11px] italic leading-relaxed" style={{ color: C.muted }}>Sekretne karty istnieją tylko wtedy, gdy w sezonie wydarzyło się coś naprawdę rzadkiego.</div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="shrink-0 flex items-center justify-between mb-3">
          <Seg size="sm" value={kind} onChange={setKind} options={kinds.map(k => ({ value: k, label: KIND_LABEL[k] }))} />
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-8 h-8 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-14 text-center" style={{ color: C.muted }}>{pg + 1} / {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-8 h-8 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
        <div ref={ref} className="relative flex-1 min-h-0">
          <div className="absolute inset-0 grid content-start" style={{ gridTemplateColumns: `repeat(${cols}, ${cw}px)`, gridAutoRows: `${chh}px`, gap: g }}>
            {list.slice(pg * per, pg * per + per).map(c => <MiniCard key={c.id} card={c} have={!!col.owned[c.id]} foil={col.foils.includes(c.id)} onOpen={() => setOpen(c)} />)}
          </div>
          <AnimatePresence>
            {open && (
              <motion.div className="absolute inset-0 z-20 flex items-center justify-center gap-8" style={{ background: 'color-mix(in srgb, var(--tournament-background, #0b0b10) 88%, transparent)' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
                <motion.div initial={{ scale: 0.8, rotateY: 90 }} animate={{ scale: 1, rotateY: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 18 }}>
                  <CardFront card={open} w={Math.min(box.h * 0.92, 470) * RATIO} h={Math.min(box.h * 0.92, 470)} foil={col.foils.includes(open.id)} />
                </motion.div>
                <div className="max-w-[260px] text-sm flex flex-col gap-2" style={{ color: C.text }}>
                  <div className="text-xs uppercase tracking-[0.3em]" style={{ color: RARITY[open.rarity].color }}>{RARITY[open.rarity].label} karta</div>
                  <div>Masz <b>{col.owned[open.id]}</b> {plural(col.owned[open.id] ?? 0, 'kopię', 'kopie', 'kopii')}.</div>
                  {(open.kind === 'player') && open.records.length > 0 && <div>Rekordy: {open.records.map(k => metric(k).label).join(', ')}</div>}
                  <div className="text-xs" style={{ color: C.muted }}>Kliknij, żeby zamknąć</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Duel ────────────────────────────────────────────────────────────────

const HAND = 5;
interface Round { mine: PlayerCard; theirs: PlayerCard; attr: string; won: boolean | null }

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function DuelTab({ cards, col, setCol, goPacks }: { cards: Card[]; col: Collection; setCol: (f: (c: Collection) => Collection) => void; goPacks: () => void }) {
  const font = useHeaderFont();
  const mine = useMemo(() => cards.filter((c): c is PlayerCard => c.kind === 'player' && !!col.owned[c.id]), [cards, col.owned]);
  const all = useMemo(() => cards.filter((c): c is PlayerCard => c.kind === 'player'), [cards]);
  const [hand, setHand] = useState<PlayerCard[]>([]);
  const [cpu, setCpu] = useState<PlayerCard[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [sel, setSel] = useState<PlayerCard | null>(null);
  const [ref, box] = useSize<HTMLDivElement>();

  const deal = useCallback(() => {
    const h = shuffle(mine).slice(0, HAND);
    const avg = h.reduce((s, c) => s + c.ovr, 0) / Math.max(1, h.length);
    // The computer gets a hand of similar strength, never your own cards
    const pool = all.filter(c => !h.includes(c) && Math.abs(c.ovr - avg) <= 9);
    setHand(h); setCpu(shuffle(pool.length >= HAND ? pool : all.filter(c => !h.includes(c))).slice(0, HAND)); setRounds([]); setSel(null);
  }, [mine, all]);
  useEffect(() => { if (mine.length >= HAND && !hand.length) deal(); }, [mine.length, hand.length, deal]);

  const wins = rounds.filter(r => r.won === true).length; const losses = rounds.filter(r => r.won === false).length;
  const over = rounds.length === HAND || wins >= 3 || losses >= 3;
  const last = rounds[rounds.length - 1];
  const played = new Set(rounds.map(r => r.mine.id));
  const cpuPlayed = new Set(rounds.map(r => r.theirs.id));

  const play = (attr: string) => {
    if (!sel || over) return;
    const left = cpu.filter(c => !cpuPlayed.has(c.id));
    const theirs = left[Math.floor(Math.random() * left.length)];
    const a = sel.attrs.find(x => x.abbr === attr)!.score; const b = theirs.attrs.find(x => x.abbr === attr)!.score;
    const r: Round = { mine: sel, theirs, attr, won: a === b ? null : a > b };
    const next = [...rounds, r];
    setRounds(next); setSel(null);
    const w = next.filter(x => x.won === true).length; const l = next.filter(x => x.won === false).length;
    if (w >= 3 || l >= 3 || next.length === HAND) {
      const won = w > l;
      setCol(c => {
        const streak = won ? c.duels.streak + 1 : 0;
        return { ...c, packs: won ? c.packs + 1 : c.packs, duels: { won: c.duels.won + (won ? 1 : 0), lost: c.duels.lost + (won ? 0 : 1), streak, best: Math.max(c.duels.best, streak) } };
      });
    }
  };

  if (mine.length < HAND) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 text-center">
        <div className="text-3xl font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>Potrzebujesz {HAND} kart graczy</div>
        <div className="text-sm max-w-md" style={{ color: C.text }}>Masz {mine.length}. Otwórz kilka paczek — w pojedynku grasz własnymi kartami przeciwko komputerowi, a za wygraną dostajesz paczkę.</div>
        <button type="button" onClick={goPacks} className="rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary }}>Do paczek</button>
      </div>
    );
  }

  const h = Math.min(box.h * 0.92, 440); const w = h * RATIO;
  const final = over ? (wins > losses ? 'win' : 'loss') : null;
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="shrink-0 flex items-center justify-center gap-6">
        <span className="text-xs uppercase tracking-[0.3em]" style={{ color: C.muted }}>Ty</span>
        <span className="text-4xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{wins} : {losses}</span>
        <span className="text-xs uppercase tracking-[0.3em]" style={{ color: C.muted }}>Komputer</span>
        <span className="text-xs" style={{ color: C.muted }}>· do 3 wygranych rund · seria {col.duels.streak} (rekord {col.duels.best})</span>
      </div>
      <div ref={ref} className="relative flex-1 min-h-0 flex items-center justify-center gap-10">
        {box.h > 0 && (
          <>
            {/* Your card: pick it from the hand below, then an attribute on it */}
            <div className="flex flex-col items-center gap-2">
              {sel ? <CardFront card={sel} w={w} h={h} pick={play} />
                : last ? <div className="relative"><CardFront card={last.mine} w={w} h={h} picked={last.attr} /><Verdict won={last.won} /></div>
                  : <div className="rounded-[20px] flex items-center justify-center text-center text-sm p-6" style={{ width: w, height: h, border: `2px dashed ${ink(16)}`, color: C.muted }}>Wybierz kartę z ręki,<br />potem cechę, którą grasz</div>}
              {sel && <div className="text-xs uppercase tracking-widest" style={{ color: C.heading }}>Kliknij cechę na karcie</div>}
            </div>
            <div className="text-2xl font-logik-extended-bold" style={{ color: C.muted, ...font }}>VS</div>
            <div className="flex flex-col items-center gap-2">
              {last && !sel ? (
                <motion.div key={last.theirs.id} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.5 }}>
                  <CardFront card={last.theirs} w={w} h={h} picked={last.attr} />
                </motion.div>
              ) : <CardBack r="epic" w={w} h={h} />}
              {last && !sel && <div className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>{DUEL_ATTRS.find(a => a.abbr === last.attr)?.name}: {last.mine.attrs.find(a => a.abbr === last.attr)?.score} vs {last.theirs.attrs.find(a => a.abbr === last.attr)?.score}</div>}
            </div>
            <AnimatePresence>
              {final && (
                <motion.div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4" style={{ background: 'color-mix(in srgb, var(--tournament-background, #0b0b10) 82%, transparent)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="text-6xl font-logik-extended-bold uppercase" style={{ color: final === 'win' ? C.win : C.loss, ...font }}>{final === 'win' ? 'Wygrana!' : 'Porażka'}</div>
                  <div className="text-lg" style={{ color: C.text }}>{final === 'win' ? '+1 paczka do otwarcia' : 'Komputer tym razem lepszy. Rewanż?'}</div>
                  <div className="flex gap-3">
                    <button type="button" onClick={deal} className="rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary }}>Nowy pojedynek</button>
                    {final === 'win' && <button type="button" onClick={goPacks} className="rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-widest" style={{ background: ink(8), color: C.text }}>Otwórz paczkę</button>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
      {/* Hand */}
      <div className="shrink-0 flex justify-center gap-2">
        {hand.map(c => {
          const used = played.has(c.id); const on = sel?.id === c.id;
          return (
            <button key={c.id} type="button" disabled={used || over} onClick={() => setSel(c)}
              className="flex items-center gap-2 rounded-xl pl-1 pr-3 py-1 transition-all disabled:opacity-30"
              style={{ background: on ? mix(C.primary, 40) : ink(6), boxShadow: on ? `0 0 0 2px ${C.secondary}` : `inset 0 0 0 1px ${mix(RARITY[c.rarity].color, 60)}` }}>
              <Avatar player={c.player} size={38} />
              <span className="text-left leading-tight">
                <span className="block text-sm font-bold truncate max-w-[110px]">{c.name}</span>
                <span className="block text-[11px] font-bold tabular-nums" style={{ color: RARITY[c.rarity].color }}>{c.ovr}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Verdict({ won }: { won: boolean | null }) {
  const font = useHeaderFont();
  return (
    <motion.span className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 rounded-full px-4 py-1 text-sm font-logik-extended-bold uppercase text-black"
      style={{ background: won == null ? '#c9d1db' : won ? C.win : C.loss, ...font }} initial={{ scale: 0 }} animate={{ scale: 1 }}>
      {won == null ? 'Remis' : won ? 'Runda dla Ciebie' : 'Runda przegrana'}
    </motion.span>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function CardsGame({ model }: { model: Model }) {
  const statsKey = useStatsKey();
  const cards = useMemo(() => buildCards(model), [model]);
  const [stored, setStored] = useStored<Collection>(statsKey ? cardsKey(statsKey) : null, emptyCollection());
  const [tab, setTab] = useState<'packs' | 'album' | 'duel'>('packs');
  const [toast, setToast] = useState<string | null>(null);
  const col = useMemo(() => refill(stored), [stored]);
  const setCol = useCallback((f: (c: Collection) => Collection) => setStored(prev => f(refill(prev))), [setStored]);
  // Keep the free-pack counter moving while the page is open
  useEffect(() => { const t = setInterval(() => setStored(prev => refill(prev)), 20000); return () => clearInterval(t); }, [setStored]);

  // ↑↑↓↓←→←→BA: the next pack's last card is mythic
  const seq = useRef<string[]>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      seq.current = [...seq.current, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length);
      if (seq.current.join() === KONAMI.join()) {
        seq.current = [];
        setCol(c => ({ ...c, secretCode: true, packs: Math.max(c.packs, 1) }));
        setToast('Kod przyjęty. Następna paczka… jest wyjątkowa.');
        setTimeout(() => setToast(null), 3500);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCol]);

  const owned = cards.filter(c => col.owned[c.id]).length;
  return (
    <>
      <LabTitle sub={<span>kolekcja {owned} / {cards.length} · {col.packs} {plural(col.packs, 'paczka', 'paczki', 'paczek')} do otwarcia</span>}
        right={<Seg value={tab} onChange={setTab} options={[{ value: 'packs', label: 'Paczki' }, { value: 'album', label: 'Album' }, { value: 'duel', label: 'Pojedynek', tip: 'Twoje karty graczy przeciwko komputerowi — wygrana daje paczkę' }]} />}>
        Karty
      </LabTitle>
      <div className="relative flex-1 min-h-0 flex flex-col mt-3">
        {tab === 'packs' && <PackTab cards={cards} col={col} setCol={setCol} />}
        {tab === 'album' && <AlbumTab cards={cards} col={col} />}
        {tab === 'duel' && <DuelTab cards={cards} col={col} setCol={setCol} goPacks={() => setTab('packs')} />}
        <AnimatePresence>
          {toast && <motion.div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 rounded-full px-5 py-2 text-sm font-bold text-black" style={{ background: 'linear-gradient(90deg,#5ef0ff,#b072ff)' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{toast}</motion.div>}
        </AnimatePresence>
      </div>
    </>
  );
}

export function assets(model: Model): Asset[] {
  return buildCards(model).flatMap(c =>
    c.kind === 'player' ? avatar(c.player) : c.kind === 'team' ? logo(c.team) : [...render(c.heroId, CARD_RENDER), ...avatar(c.kind === 'moment' ? c.fact.player : c.player)]);
}

export default function Cards() {
  return <LabView><WithModel>{m => <CardsGame model={m} />}</WithModel></LabView>;
}
