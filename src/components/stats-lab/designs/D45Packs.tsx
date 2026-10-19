'use client';

// #45 — Card packs. Rip open a season pack: five face-down cards fan out, their glow betrays the
// rarity (records are legendary, roasts are cursed). Flip them one by one, click a revealed card
// to open its page. Every card goes into the collection strip; the next pack prefers cards you
// don't have yet.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import type { Model } from '@/lib/stats-lab/derive';
import type { Fact } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, LabTitle, TeamLogo, ink, mix, useHeaderFont, useSize } from '../kit';
import { FactCard, HubShell, useFacts } from '../hub';

type Rarity = 'legend' | 'epic' | 'rare' | 'cursed';
const RARITY: Record<Rarity, { label: string; color: string }> = {
  legend: { label: 'Legendarna', color: '#f2c94c' },
  epic: { label: 'Epicka', color: '#b072ff' },
  rare: { label: 'Rzadka', color: '#4fa3ff' },
  cursed: { label: 'Przeklęta', color: '#ff8a3d' },
};
const EPIC = new Set(['mvp', 'collector', 'elo', 'streak', 'race', 'hero', 'duo']);
const rarityOf = (f: Fact): Rarity => (f.tone === 'roast' ? 'cursed' : f.id.startsWith('rec-') ? 'legend' : EPIC.has(f.id) ? 'epic' : 'rare');
const PACK = 5;

function drawPack(facts: Fact[], owned: Set<string>): Fact[] {
  const fresh = facts.filter(f => !owned.has(f.id));
  const pool = fresh.length >= PACK ? fresh : facts;
  const rnd = [...pool].sort(() => Math.random() - 0.5);
  const legend = rnd.find(f => rarityOf(f) === 'legend') ?? facts.find(f => rarityOf(f) === 'legend');
  const out = legend ? [legend] : [];
  for (const f of rnd) { if (out.length >= PACK) break; if (!out.includes(f)) out.push(f); }
  // rarest last, like a real pack
  const order: Rarity[] = ['rare', 'cursed', 'epic', 'legend'];
  return out.sort((a, b) => order.indexOf(rarityOf(a)) - order.indexOf(rarityOf(b)));
}

function Card({ f, w, h, flipped, onFlip, onOpen, i }: { f: Fact; w: number; h: number; flipped: boolean; onFlip: () => void; onOpen: () => void; i: number }) {
  const font = useHeaderFont();
  const { theme } = useTournament();
  const r = RARITY[rarityOf(f)];
  const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 18, overflow: 'hidden' };
  return (
    <motion.div className="relative shrink-0" style={{ width: w, height: h, perspective: 1200 }}
      initial={{ y: 260, opacity: 0, rotate: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, rotate: (i - 2) * 2.5, scale: 1 }}
      transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 140, damping: 16 }}
      whileHover={{ y: -10, rotate: 0 }}>
      <motion.button type="button" onClick={flipped ? onOpen : onFlip} className="absolute inset-0 text-left" style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.6, ease: [0.3, 1.2, 0.5, 1] }}>
        {/* back */}
        <div style={{ ...face, background: `repeating-linear-gradient(45deg, ${mix(C.primary, 45)} 0 10px, ${mix(C.primary, 30)} 10px 20px), #15151c`, boxShadow: `0 0 0 3px ${r.color}, 0 0 ${rarityOf(f) === 'legend' ? 50 : 26}px ${r.color}` }}>
          <div className="absolute inset-3 rounded-xl flex flex-col items-center justify-center gap-3" style={{ border: '2px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.25)' }}>
            {theme.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="object-contain opacity-90" style={{ width: w * 0.42, height: w * 0.42 }} />
            )}
            <span className="text-[11px] uppercase tracking-[0.35em] text-white/80">Odkryj</span>
          </div>
        </div>
        {/* front */}
        <div style={{ ...face, transform: 'rotateY(180deg)', boxShadow: `0 0 0 3px ${r.color}, 0 18px 40px rgba(0,0,0,0.5)` }}>
          <FactCard f={f} size="md" className="w-full h-full" />
          <div className="absolute top-0 inset-x-0 flex justify-between items-center px-3 py-2" style={{ background: `linear-gradient(180deg, ${mix(r.color, 55)}, transparent)` }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white" style={font}>{r.label}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/70">#{f.page}</span>
          </div>
          {rarityOf(f) === 'legend' && <motion.div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,240,180,0.35) 45%, transparent 60%)', backgroundSize: '250% 100%' }} animate={{ backgroundPosition: ['100% 0', '-100% 0'] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }} />}
        </div>
      </motion.button>
    </motion.div>
  );
}

function Packs({ model, open }: { model: Model; open: (n: number) => void }) {
  const font = useHeaderFont();
  const { theme } = useTournament();
  const facts = useFacts(model);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [hand, setHand] = useState<Fact[] | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [packNo, setPackNo] = useState(0);
  const [ref, box] = useSize<HTMLDivElement>();

  const rip = () => { const h = drawPack(facts, owned); setHand(h); setFlipped(new Set()); setPackNo(n => n + 1); };
  const flip = (i: number) => {
    if (!hand) return;
    setFlipped(s => new Set(s).add(i));
    setOwned(o => new Set(o).add(hand[i].id));
  };
  const flipAll = () => { if (!hand) return; setFlipped(new Set(hand.map((_, i) => i))); setOwned(o => { const n = new Set(o); hand.forEach(f => n.add(f.id)); return n; }); };
  const allFlipped = hand != null && flipped.size === hand.length;

  const gap = 18;
  const ch = Math.min(box.h * 0.92, ((box.w - gap * (PACK - 1)) / PACK) / 0.68);
  const cw = ch * 0.68;
  const collection = useMemo(() => [...facts].sort((a, b) => ['legend', 'epic', 'rare', 'cursed'].indexOf(rarityOf(a)) - ['legend', 'epic', 'rare', 'cursed'].indexOf(rarityOf(b))), [facts]);

  return (
    <>
      <LabTitle sub={<span>{hand ? 'kliknij kartę, by ją odkryć · odkrytą, by otworzyć stronę' : 'kliknij paczkę, by ją rozerwać'}</span>}
        right={hand && (
          <div className="flex gap-2">
            {!allFlipped && <button type="button" onClick={flipAll} className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), color: C.text, border: `1px solid ${ink(16)}` }}>Odkryj wszystkie</button>}
            <button type="button" onClick={rip} className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: C.primary, color: '#fff', boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Następna paczka</button>
          </div>
        )}>Paczki kart</LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-3 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!hand ? (
            <motion.button key="pack" type="button" onClick={rip} className="relative rounded-[28px] overflow-hidden flex flex-col items-center justify-center gap-4"
              style={{ width: Math.min(300, box.h * 0.6), height: Math.min(440, box.h * 0.9), background: `linear-gradient(135deg, ${mix(C.primary, 85)}, ${mix(C.secondary, 70)} 60%, ${mix(C.primary, 90)})`, boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 60px ${mix(C.secondary, 40)}` }}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: [0, -1.5, 1.5, 0] }} exit={{ scale: 1.3, opacity: 0, rotate: 8, transition: { duration: 0.3 } }}
              transition={{ rotate: { repeat: Infinity, duration: 2.4 } }} whileHover={{ scale: 1.05 }}>
              <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 45%, transparent 60%)', backgroundSize: '250% 100%' }} animate={{ backgroundPosition: ['100% 0', '-100% 0'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} />
              <div className="absolute top-0 inset-x-0 h-10" style={{ background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 6px, transparent 6px 12px)' }} />
              {theme.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={theme.logoUrl} alt="" className="relative object-contain" style={{ width: '55%', height: '30%' }} />
              )}
              <div className="relative text-3xl font-logik-extended-bold uppercase text-white text-center leading-tight" style={font}>Paczka<br />sezonu</div>
              <div className="relative text-xs uppercase tracking-[0.3em] text-white/80">{PACK} kart · 1 legendarna</div>
            </motion.button>
          ) : (
            <motion.div key={`hand-${packNo}`} className="flex items-center" style={{ gap }} initial={{ opacity: 1 }} exit={{ opacity: 0, y: 40 }}>
              {hand.map((f, i) => (
                <Card key={f.id} f={f} w={cw} h={ch} i={i} flipped={flipped.has(i)} onFlip={() => flip(i)} onOpen={() => open(f.page)} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Collection strip */}
      <div className="shrink-0 mt-3 flex items-center gap-3">
        <div className="shrink-0">
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>Kolekcja</div>
          <div className="text-xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{owned.size}<span style={{ color: C.muted }}>/{facts.length}</span></div>
        </div>
        <div className="flex-1 min-w-0 flex gap-1 overflow-hidden">
          {collection.map(f => {
            const has = owned.has(f.id); const r = RARITY[rarityOf(f)];
            return (
              <button key={f.id} type="button" disabled={!has} onClick={() => open(f.page)} title={has ? `${f.kicker} · ${f.big} · ${f.title} — ${REDESIGN_NAMES[f.page - 1]}` : r.label}
                className="relative flex-1 min-w-0 max-w-[40px] rounded-lg overflow-hidden flex items-center justify-center" style={{ height: 52, background: has ? '#15151c' : ink(5), boxShadow: `inset 0 0 0 2px ${has ? r.color : mix(r.color, 30)}` }}>
                {has ? (f.player ? <Avatar player={f.player} size={26} /> : f.team ? <TeamLogo team={f.team} size={24} /> : f.heroId != null ? <HeroImg heroId={f.heroId} variant="icon" className="w-full h-full" /> : <span className="text-[10px] font-bold text-white">{f.big}</span>) : <span className="text-xs" style={{ color: mix(r.color, 60) }}>?</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function D45Packs() {
  return <HubShell render={(m, x) => <Packs model={m} open={x.open} />} />;
}
