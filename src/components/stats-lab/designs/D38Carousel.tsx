'use client';

// #38 — Carousel. The hub's teasers stand on a 3D ring. Drag sideways (or use the arrows / ← →)
// to spin it; it snaps to the nearest card and, when left alone, turns by itself every 6 s.
// The front card is live (full hero render); click it to open its page, click a side card to
// bring it to the front.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { pickFacts } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { C, LabTitle, ink, mix, useHeaderFont, useSize } from '../kit';
import { FactCard, HubShell, useFacts } from '../hub';

const AUTO_MS = 6000;

function Carousel({ model, open, isOpen }: { model: Model; open: (n: number) => void; isOpen: boolean }) {
  const font = useHeaderFont();
  const all = useFacts(model);
  const facts = useMemo(() => pickFacts(all, 10), [all]);
  const wasDrag = useRef(false);
  const n = facts.length;
  const step = 360 / Math.max(1, n);
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState<number | null>(null); // live drag offset in degrees
  const [hover, setHover] = useState(false);
  const start = useRef<{ x: number; moved: boolean } | null>(null);
  const [ref, box] = useSize<HTMLDivElement>();

  const cardH = Math.min(box.h * 0.82, 520);
  const cardW = cardH * 0.72;
  const radius = (cardW / 2) / Math.tan(Math.PI / Math.max(3, n)) * 1.12;
  const go = (d: number) => setIdx(i => i + d);
  const front = ((idx % n) + n) % n;

  useEffect(() => {
    if (hover || isOpen || drag != null) return;
    const t = setTimeout(() => go(1), AUTO_MS);
    return () => clearTimeout(t);
  }, [idx, hover, isOpen, drag]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const endDrag = () => {
    const d = drag ?? 0; const moved = !!start.current?.moved; wasDrag.current = moved; start.current = null; setDrag(null);
    if (moved) setIdx(i => i - Math.round(d / step));
  };
  const rot = -idx * step + (drag ?? 0);
  const f = facts[front];

  return (
    <>
      <LabTitle sub={<span>przeciągnij, by obrócić · kliknij przednią kartę, by otworzyć</span>}>Karuzela</LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-2 select-none touch-none" style={{ perspective: 1800, cursor: drag != null ? 'grabbing' : 'grab' }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onPointerDown={e => { start.current = { x: e.clientX, moved: false }; setDrag(0); }}
        onPointerMove={e => { if (!start.current) return; const dx = e.clientX - start.current.x; if (Math.abs(dx) > 4) start.current.moved = true; setDrag(dx * 0.25); }}
        onPointerUp={() => endDrag()}
        onPointerLeave={() => { if (start.current) endDrag(); }}>
        {box.w > 0 && (
          <motion.div className="absolute left-1/2 top-1/2" style={{ width: cardW, height: cardH, marginLeft: -cardW / 2, marginTop: -cardH / 2, transformStyle: 'preserve-3d' }}
            animate={{ rotateY: rot, z: -radius }} transition={drag != null ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 16 }}>
            {facts.map((x, i) => {
              const isFront = i === front;
              // angle of this card relative to the viewer (0 = front)
              const rel = ((((i * step + rot) % 360) + 540) % 360) - 180;
              const vis = Math.max(0, 1 - Math.abs(rel) / 150);
              return (
                <button key={x.id} type="button"
                  onClick={() => { if (wasDrag.current) { wasDrag.current = false; return; } if (isFront) open(x.page); else setIdx(idx + (((i - front + n + n / 2) % n) - n / 2)); }}
                  className="absolute inset-0 rounded-3xl overflow-hidden text-left transition-[filter] duration-300"
                  style={{ transform: `rotateY(${i * step}deg) translateZ(${radius}px)`, backfaceVisibility: 'hidden', filter: `brightness(${0.35 + vis * 0.65})`,
                    boxShadow: isFront ? `0 0 0 2px ${C.secondary}, 0 30px 70px rgba(0,0,0,0.55)` : '0 20px 40px rgba(0,0,0,0.4)' }}>
                  <FactCard f={x} size={isFront ? 'lg' : 'md'} render={Math.abs(rel) < 60} className="w-full h-full" />
                </button>
              );
            })}
          </motion.div>
        )}
        <button type="button" aria-label="Poprzednia" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full text-2xl" style={{ background: ink(10) }}>‹</button>
        <button type="button" aria-label="Następna" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full text-2xl" style={{ background: ink(10) }}>›</button>
      </div>
      <div className="shrink-0 flex items-center justify-center gap-4 mt-2">
        <div className="flex gap-1.5">
          {facts.map((x, i) => (
            <button key={x.id} type="button" aria-label={x.kicker} onClick={() => setIdx(idx + (((i - front + n + n / 2) % n) - n / 2))}
              className="rounded-full transition-all" style={{ width: i === front ? 26 : 8, height: 8, background: i === front ? C.secondary : ink(25) }} />
          ))}
        </div>
        {f && (
          <button type="button" onClick={() => open(f.page)} className="rounded-full px-5 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: C.primary, color: '#fff', boxShadow: `0 0 16px ${mix(C.primary, 45)}`, ...font }}>
            Otwórz: {REDESIGN_NAMES[f.page - 1]}
          </button>
        )}
      </div>
    </>
  );
}

export default function D38Carousel() {
  return <HubShell render={(m, x) => <Carousel model={m} open={x.open} isOpen={x.isOpen} />} />;
}
