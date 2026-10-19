'use client';

// #41 — Dock. A macOS-style dock of pages along the bottom (icons magnify under the mouse).
// Pointing at an icon puts that page on the stage: its headline fact on the left and a live,
// scaled-down copy of the real page on the right. Click the stage or the icon to open it.
// Untouched, the stage moves to the next page every 7 s.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import type { Fact } from '@/lib/stats-lab/teasers';
import { STATS_REDESIGNS } from '../registry';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, LabTitle, TeamLogo, ink, mix, useHeaderFont, useSize } from '../kit';
import { FactCard, HubShell, useFacts } from '../hub';

const NEXT_MS = 7000;
const PAGES = [1, 2, 3, 4, 8, 12, 15, 17, 19, 22, 23, 27, 28, 30];

function Icon({ f, page, size }: { f?: Fact; page: number; size: number }) {
  if (f?.player) return <Avatar player={f.player} size={size} />;
  if (f?.team) return <span className="flex items-center justify-center rounded-2xl" style={{ width: size, height: size, background: '#15151c' }}><TeamLogo team={f.team} size={size * 0.8} /></span>;
  if (f?.heroId != null) return <HeroImg heroId={f.heroId} variant="icon" className="rounded-2xl" style={{ width: size, height: size, background: '#15151c' }} />;
  return <span className="flex items-center justify-center rounded-2xl font-logik-extended-bold" style={{ width: size, height: size, background: mix(C.primary, 60), fontSize: size * 0.35 }}>{page}</span>;
}

/** The real page, rendered small. Non-interactive; it is only a preview. */
function LivePreview({ page }: { page: number }) {
  const [ref, box] = useSize<HTMLDivElement>();
  const Page = STATS_REDESIGNS[page - 1];
  const scale = 0.5;
  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden rounded-2xl" style={{ background: 'var(--tournament-background, #0b0b10)', boxShadow: `0 0 0 1px ${ink(14)}` }}>
      {box.w > 0 && (
        <div className="absolute left-0 top-0 pointer-events-none" style={{ width: box.w / scale, height: box.h / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          <Page />
        </div>
      )}
    </div>
  );
}

function Dock({ model, open, isOpen }: { model: Model; open: (n: number) => void; isOpen: boolean }) {
  const font = useHeaderFont();
  const facts = useFacts(model);
  const items = useMemo(() => PAGES.map(p => ({ page: p, f: facts.find(x => x.page === p) })), [facts]);
  const [sel, setSel] = useState(0);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (touched || isOpen) return;
    const t = setTimeout(() => setSel(s => (s + 1) % items.length), NEXT_MS);
    return () => clearTimeout(t);
  }, [sel, touched, isOpen, items.length]);

  const it = items[sel];
  const base = 56; const maxBoost = 1.7; const reach = 150;
  const sizeFor = (el: HTMLElement | null) => {
    if (mouseX == null || !el) return base;
    const r = el.getBoundingClientRect();
    const d = Math.abs(mouseX - (r.left + r.width / 2));
    return base * (1 + (maxBoost - 1) * Math.max(0, 1 - d / reach));
  };
  const iconRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <>
      <LabTitle sub={<span>najedź na ikonę w doku · kliknij, by otworzyć</span>}>Dok</LabTitle>
      {/* Stage */}
      <AnimatePresence mode="wait">
        <motion.div key={it.page} role="button" tabIndex={0} onClick={() => open(it.page)} onKeyDown={e => { if (e.key === 'Enter') open(it.page); }} className="group flex-1 min-h-0 mt-3 flex gap-4 text-left cursor-pointer"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
          <div className={`${it.f ? 'w-[36%]' : 'w-[24%]'} shrink-0 flex flex-col gap-3 min-h-0 transition-[width]`}>
            <div>
              <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: C.muted }}>Strona {it.page}</div>
              <div className="text-4xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{REDESIGN_NAMES[it.page - 1]}</div>
            </div>
            {it.f ? <FactCard f={it.f} size="lg" className="flex-1 min-h-0 rounded-3xl" /> : (
              <span className="self-start rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Otwórz ›</span>
            )}
          </div>
          <div className="relative flex-1 min-w-0 min-h-0">
            <LivePreview page={it.page} />
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.35)' }}>
              <span className="rounded-full px-6 py-3 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 24px ${mix(C.primary, 50)}` }}>Otwórz</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      {/* Dock */}
      <div className="shrink-0 flex justify-center mt-3">
        <div ref={dockRef} className="flex items-end gap-2 px-4 pt-3 pb-2 rounded-3xl" style={{ background: ink(6), border: `1px solid ${ink(12)}`, backdropFilter: 'blur(8px)', height: base * maxBoost + 24 }}
          onMouseMove={e => setMouseX(e.clientX)} onMouseLeave={() => { setMouseX(null); clearTimeout(hoverTimer.current); }}>
          {items.map((x, i) => {
            const s = sizeFor(iconRefs.current[i]);
            return (
              <button key={x.page} ref={el => { iconRefs.current[i] = el; }} type="button" title={REDESIGN_NAMES[x.page - 1]}
                onMouseEnter={() => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => { setSel(i); setTouched(true); }, 120); }}
                onClick={() => open(x.page)} className="relative flex flex-col items-center transition-[width] duration-75" style={{ width: s }}>
                {mouseX != null && s > base * 1.45 && <span className="absolute -top-8 whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-bold text-white bg-black/80">{REDESIGN_NAMES[x.page - 1]}</span>}
                <Icon f={x.f} page={x.page} size={s} />
                <span className="mt-1 w-1.5 h-1.5 rounded-full" style={{ background: i === sel ? C.secondary : 'transparent' }} />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function D41Dock() {
  return <HubShell render={(m, x) => <Dock model={m} open={x.open} isOpen={x.isOpen} />} />;
}
