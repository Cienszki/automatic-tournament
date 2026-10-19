'use client';

// #46 — Wheel of fortune. Each slice is a category of the season (records, MVP, heroes, teams,
// drama…) with a face on it. Spin the wheel by dragging it or with the button; where it stops, a
// teaser from that category slides in next to it, with the way into the full page.

import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import type { Fact } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, LabTitle, TeamLogo, ink, mix, useHeaderFont, useSize } from '../kit';
import { FactCard, HubShell, useFacts } from '../hub';

interface Slice { label: string; facts: Fact[] }

const SLICE_COLORS = ['#e8505b', '#f9a826', '#14b1ab', '#7b5cd6', '#3d8bfd', '#2fbf71', '#ff7ab6', '#ffb000'];

function slicesOf(facts: Fact[]): Slice[] {
  const by = (pred: (f: Fact) => boolean) => facts.filter(pred);
  const s: Slice[] = [
    { label: 'Rekordy', facts: by(f => f.id.startsWith('rec-')) },
    { label: 'MVP', facts: by(f => ['mvp', 'race', 'collector', 'streak'].includes(f.id)) },
    { label: 'Bohaterowie', facts: by(f => ['hero', 'duo', 'firstpick'].includes(f.id)) },
    { label: 'Drużyny', facts: by(f => ['elo', 'side', 'fast'].includes(f.id)) },
    { label: 'Wpadki', facts: by(f => f.tone === 'roast') },
    { label: 'Mecze', facts: by(f => ['long', 'blood', 'rosh'].includes(f.id)) },
    { label: 'Osiągnięcia', facts: by(f => ['achlit', 'collector'].includes(f.id)) },
    { label: 'Niespodzianka', facts },
  ];
  return s.filter(x => x.facts.length > 0);
}

function polar(cx: number, cy: number, r: number, deg: number) { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }

function Wheel({ model, open }: { model: Model; open: (n: number) => void }) {
  const font = useHeaderFont();
  const facts = useFacts(model);
  const slices = useMemo(() => slicesOf(facts), [facts]);
  const n = slices.length;
  const seg = 360 / n;
  const rot = useMotionValue(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ slice: number; fact: Fact } | null>(null);
  const [ref, box] = useSize<HTMLDivElement>();
  const drag = useRef<{ a: number; r: number; t: number; v: number } | null>(null);

  const S = Math.min(box.h, box.w * 0.48);
  const R = S / 2 - 8;

  const land = (finalDeg: number) => {
    // pointer at top: slice under it is the one whose span contains -finalDeg
    const at = (((-finalDeg % 360) + 360) % 360);
    const i = Math.floor(at / seg) % n;
    const pool = slices[i].facts;
    setResult({ slice: i, fact: pool[Math.floor(Math.random() * pool.length)] });
    setSpinning(false);
  };
  const spin = (velocity = 900 + Math.random() * 500) => {
    if (spinning) return;
    setSpinning(true); setResult(null);
    const target = rot.get() + Math.max(540, velocity * 1.4) + Math.random() * seg;
    animate(rot, target, { duration: 3.2 + Math.random(), ease: [0.12, 0.7, 0.18, 1], onComplete: () => land(target) });
  };

  const angleAt = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const onDown = (e: React.PointerEvent) => { if (spinning) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { a: angleAt(e), r: rot.get(), t: performance.now(), v: 0 }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    let delta = angleAt(e) - d.a; if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
    const now = performance.now(); const dt = Math.max(1, now - d.t);
    d.v = (delta / dt) * 1000; d.a += delta; d.t = now; d.r += delta;
    rot.set(d.r);
  };
  const onUp = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    if (Math.abs(d.v) > 200) spin(Math.abs(d.v)); // a flick spins it
  };

  const f = result?.fact;
  const color = result ? SLICE_COLORS[result.slice % SLICE_COLORS.length] : C.secondary;

  return (
    <>
      <LabTitle sub={<span>zakręć kołem — przeciągnij je albo kliknij „Kręć”</span>}>Koło fortuny</LabTitle>
      <div ref={ref} className="flex-1 min-h-0 mt-3 flex items-center gap-8">
        {S > 0 && (
          <div className="relative shrink-0" style={{ width: S, height: S }}>
            {/* pointer */}
            <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-20" style={{ width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: `30px solid ${C.heading}`, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
            <motion.div className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing" style={{ rotate: rot }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <svg width={S} height={S} className="absolute inset-0">
                <circle cx={S / 2} cy={S / 2} r={R + 6} fill="#15151c" />
                {slices.map((s, i) => {
                  const [x1, y1] = polar(S / 2, S / 2, R, i * seg); const [x2, y2] = polar(S / 2, S / 2, R, (i + 1) * seg);
                  const won = result?.slice === i && !spinning;
                  return <path key={s.label} d={`M${S / 2},${S / 2} L${x1},${y1} A${R},${R} 0 ${seg > 180 ? 1 : 0} 1 ${x2},${y2} Z`} fill={SLICE_COLORS[i % SLICE_COLORS.length]} opacity={result && !won && !spinning ? 0.45 : 1} stroke="#15151c" strokeWidth={3} />;
                })}
                {Array.from({ length: n * 2 }, (_, i) => { const [x, y] = polar(S / 2, S / 2, R + 1, (i * seg) / 2); return <circle key={i} cx={x} cy={y} r={3.5} fill="#fff" opacity={0.85} />; })}
              </svg>
              {slices.map((s, i) => {
                const mid = (i + 0.5) * seg;
                const face = s.facts.find(x => x.player || x.team || x.heroId != null);
                const [x, y] = polar(S / 2, S / 2, R * 0.62, mid);
                return (
                  <div key={s.label} className="absolute flex flex-col items-center pointer-events-none" style={{ left: x, top: y, transform: `translate(-50%, -50%) rotate(${mid > 90 && mid < 270 ? mid + 180 : mid}deg)` }}>
                    <span className="font-logik-extended-bold uppercase text-white whitespace-nowrap" style={{ fontSize: Math.max(11, S * 0.032), textShadow: '0 2px 6px rgba(0,0,0,0.5)', ...font }}>{s.label}</span>
                    {face?.player ? <Avatar player={face.player} size={S * 0.09} ring="#fff" className="mt-1" />
                      : face?.team ? <span className="mt-1 rounded-full p-1 flex" style={{ background: '#15151c', boxShadow: '0 0 0 2px #fff' }}><TeamLogo team={face.team} size={S * 0.07} /></span>
                      : face?.heroId != null ? <HeroImg heroId={face.heroId} variant="icon" className="rounded-full mt-1" style={{ width: S * 0.09, height: S * 0.09, boxShadow: '0 0 0 2px #fff' }} /> : null}
                  </div>
                );
              })}
            </motion.div>
            <button type="button" onClick={() => spin()} disabled={spinning} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full font-logik-extended-bold uppercase text-white"
              style={{ width: S * 0.2, height: S * 0.2, background: C.primary, boxShadow: `0 0 0 6px #15151c, 0 0 30px ${mix(C.primary, 60)}`, fontSize: Math.max(13, S * 0.04), opacity: spinning ? 0.7 : 1, ...font }}>
              Kręć
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0 h-full flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {f ? (
              <motion.div key={f.id + result!.slice} className="flex flex-col gap-3 h-full max-h-[560px]" initial={{ opacity: 0, x: 60, rotate: 3 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ type: 'spring', stiffness: 160, damping: 18 }}>
                <div className="flex items-center gap-3">
                  <span className="rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-white" style={{ background: color }}>{slices[result!.slice].label}</span>
                  <span className="text-sm" style={{ color: C.muted }}>wylosowano</span>
                </div>
                <button type="button" onClick={() => open(f.page)} className="flex-1 min-h-0 rounded-3xl overflow-hidden text-left" style={{ boxShadow: `0 0 0 3px ${color}, 0 30px 60px rgba(0,0,0,0.45)` }}>
                  <FactCard f={f} size="lg" className="w-full h-full" />
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={() => open(f.page)} className="flex-1 rounded-xl py-3.5 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Otwórz: {REDESIGN_NAMES[f.page - 1]}</button>
                  <button type="button" onClick={() => spin()} className="rounded-xl px-6 py-3.5 text-sm font-bold uppercase tracking-widest" style={{ background: ink(8), color: C.text, border: `1px solid ${ink(16)}` }}>Jeszcze raz</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" className="flex flex-col gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-5xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{spinning ? 'Kręci się…' : 'Co dziś\nwylosujesz?'.split('\n').map(l => <div key={l}>{l}</div>)}</div>
                <div className="flex flex-wrap gap-2">
                  {slices.map((s, i) => (
                    <span key={s.label} className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm" style={{ background: ink(6), color: C.text }}>
                      <span className="w-3 h-3 rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />{s.label}<span style={{ color: C.muted }}>{s.facts.length}</span>
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D46Wheel() {
  return <HubShell render={(m, x) => <Wheel model={m} open={x.open} />} />;
}
