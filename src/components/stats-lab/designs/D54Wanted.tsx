'use client';

// #54 — Wanted. Wild West posters for the season's "crimes": the most generous feeder, the map
// tourist, the support who steals farm, the blind warder, the courier hunter… The prime suspect
// is on the front; flip a poster for the lineup of the other suspects.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { qualified } from '@/lib/stats-lab/season';
import { Avatar, C, LabTitle, LabView, TeamLogo, WithModel, ink, useHeaderFont, useSize } from '../kit';

interface Suspect { p: PlayerX; v: number; label: string }
interface Crime { id: string; title: string; charge: string; evidence: (s: Suspect) => string; list: Suspect[] }

const PAPER = '#ead9b0';
const INK = '#3b2a17';
const RED = '#9b2a1a';
const SUP = new Set(['Soft Support', 'Hard Support']);

function crimes(model: Model): Crime[] {
  const q = qualified(model);
  const avg = (p: PlayerX, k: keyof PlayerX['agg']) => p.agg[k].avg ?? 0;
  const make = (id: string, title: string, charge: string, pool: PlayerX[], val: (p: PlayerX) => number, label: (v: number) => string, low = false): Crime => {
    const list = pool.map(p => ({ p, v: val(p) })).filter(x => Number.isFinite(x.v) && (low || x.v > 0)).sort((a, b) => (low ? a.v - b.v : b.v - a.v)).slice(0, 6).map(x => ({ ...x, label: label(x.v) }));
    return { id, title, charge, list, evidence: s => s.label };
  };
  const out = [
    make('feed', 'Dawca złota', 'karmienie wroga na skalę przemysłową', q, p => avg(p, 'deaths'), v => `${v.toFixed(1)} śmierci na grę`),
    make('tour', 'Turysta', 'zwiedzanie mapy w trakcie walk drużyny', q.filter(p => p.agg.kp.avg != null), p => avg(p, 'kp'), v => `tylko ${Math.round(v * 100)}% udziału w zabójstwach`, true),
    make('steal', 'Złodziej farmy', 'support podbierający creepy własnemu carry', q.filter(p => SUP.has(p.role ?? '')), p => avg(p, 'lastHits'), v => `${v.toFixed(0)} last hitów na grę jako support`),
    make('blind', 'Ślepiec', 'support, który zapomniał o wardach', q.filter(p => SUP.has(p.role ?? '') && p.agg.wards.n >= 3), p => avg(p, 'wards'), v => `${v.toFixed(1)} warda na grę`, true),
    make('courier', 'Postrach kurierów', 'seryjne mordowanie kurierów', model.players, p => p.agg.courierKills.total, v => `${v} zabitych kurierów`),
    make('bb', 'Buybackoholik', 'wykupywanie się z martwych za wszelką cenę', model.players, p => p.agg.buybacks.total, v => `${v} buybacków`),
    make('killer', 'Seryjny zabójca', 'zabójstwa z zimną krwią', model.players, p => p.agg.kills.total, v => `${v} zabójstw w sezonie`),
    make('runes', 'Rabuś run', 'kradzież run z rzeki', model.players, p => p.agg.runes.total, v => `${v} podniesionych run`),
    make('towers', 'Podpalacz', 'umyślne niszczenie budynków', q, p => avg(p, 'towerDamage'), v => `${Math.round(v).toLocaleString('pl-PL')} obrażeń budynkom na grę`),
  ];
  return out.filter(c => c.list.length >= 2);
}

function Poster({ c, w, h, flipped, onFlip, tilt }: { c: Crime; w: number; h: number; flipped: boolean; onFlip: () => void; tilt: number }) {
  const font = useHeaderFont();
  const s = c.list[0];
  const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: `radial-gradient(ellipse at center, ${PAPER} 55%, #c9ae78)`, color: INK, boxShadow: '0 18px 40px rgba(0,0,0,0.5)' };
  const k = h / 520;
  const hero = s.p.heroes[0];
  return (
    <motion.button type="button" onClick={onFlip} className="relative shrink-0 text-center" style={{ width: w, height: h, perspective: 1200 }}
      initial={{ y: 40, opacity: 0, rotate: tilt }} animate={{ y: 0, opacity: 1, rotate: tilt }} whileHover={{ rotate: 0, scale: 1.03 }}>
      <motion.div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.55 }}>
        {/* front */}
        <div style={face} className="flex flex-col items-center px-4 py-3">
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full" style={{ background: '#555', boxShadow: '0 1px 2px #000' }} />
          <div className="font-logik-extended-bold uppercase tracking-wider leading-none mt-2" style={{ fontSize: 34 * k, ...font }}>Poszukiwany</div>
          <div className="uppercase tracking-[0.3em] mt-1 font-bold" style={{ fontSize: 11 * k, color: RED }}>{c.title}</div>
          <div className="my-3 p-1.5" style={{ background: '#d8c08a', boxShadow: `inset 0 0 0 2px ${INK}` }}>
            <div style={{ filter: 'sepia(0.85) contrast(1.1) brightness(0.95)' }}><Avatar player={s.p} size={Math.round(170 * k)} className="!rounded-none" /></div>
          </div>
          <div className="font-logik-extended-bold uppercase truncate max-w-full" style={{ fontSize: 26 * k, ...font }}>{s.p.name}</div>
          <div className="italic leading-snug mt-1" style={{ fontSize: 12 * k }}>za {c.charge}</div>
          <div className="mt-auto w-full border-t-2 border-dashed pt-2 flex flex-col gap-0.5" style={{ borderColor: INK, fontSize: 12 * k }}>
            <div><b>Dowód:</b> {c.evidence(s)}</div>
            <div className="flex items-center justify-center gap-1.5"><b>Szajka:</b> <TeamLogo team={s.p.team} size={Math.round(18 * k)} /> {s.p.team?.name ?? '—'}</div>
            {hero && <div><b>Ostatnio widziany jako</b> {heroName(hero.heroId)}</div>}
          </div>
        </div>
        {/* back: the lineup */}
        <div style={{ ...face, transform: 'rotateY(180deg)' }} className="flex flex-col px-4 py-4">
          <div className="font-logik-extended-bold uppercase leading-none" style={{ fontSize: 24 * k, ...font }}>Kartoteka</div>
          <div className="uppercase tracking-[0.25em] font-bold mb-3" style={{ fontSize: 10 * k, color: RED }}>{c.title} · podejrzani</div>
          <div className="flex-1 flex flex-col justify-around">
            {c.list.map((x, i) => (
              <div key={x.p.id} className="flex items-center gap-2.5 text-left">
                <span className="font-bold w-4" style={{ fontSize: 13 * k }}>{i + 1}</span>
                <span style={{ filter: 'sepia(0.85)' }}><Avatar player={x.p} size={Math.round(40 * k)} /></span>
                <span className="flex-1 min-w-0"><span className="block truncate font-bold" style={{ fontSize: 14 * k }}>{x.p.name}</span><span className="block truncate" style={{ fontSize: 11 * k }}>{x.label}</span></span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.button>
  );
}

function Wanted({ model }: { model: Model }) {
  const list = useMemo(() => crimes(model), [model]);
  const [ref, box] = useSize<HTMLDivElement>();
  const gap = 22;
  const h = Math.min(box.h - 10, 560);
  const w = h * 0.68;
  const per = Math.max(1, Math.min(list.length, Math.floor((box.w + gap) / (w + gap))));
  const pages = Math.ceil(list.length / per);
  const [page, setPage] = useState(0);
  const [flip, setFlip] = useState<Record<string, boolean>>({});
  const shown = list.slice(page * per, page * per + per);

  return (
    <>
      <LabTitle sub={<span>kliknij list, by zobaczyć innych podejrzanych</span>}
        right={pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="w-11 h-11 rounded-full text-2xl disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
            <span className="text-sm tabular-nums w-12 text-center" style={{ color: C.muted }}>{page + 1} / {pages}</span>
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="w-11 h-11 rounded-full text-2xl disabled:opacity-25" style={{ background: ink(8) }}>›</button>
          </div>
        )}>Listy gończe</LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-3 rounded-3xl flex items-center justify-center" style={{ background: 'repeating-linear-gradient(90deg, #5a3d22 0 70px, #4d331c 70px 72px, #63442a 72px 140px)', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6)' }}>
        <AnimatePresence mode="wait">
          <motion.div key={page} className="flex items-center" style={{ gap }} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            {box.w > 0 && shown.map((c, i) => (
              <Poster key={c.id} c={c} w={w} h={h} tilt={((i * 37) % 7) - 3} flipped={!!flip[c.id]} onFlip={() => setFlip(f => ({ ...f, [c.id]: !f[c.id] }))} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

export default function D54Wanted() {
  return <LabView><WithModel>{m => <Wanted model={m} />}</WithModel></LabView>;
}
