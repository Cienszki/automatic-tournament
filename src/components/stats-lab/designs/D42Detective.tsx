'use client';

// #42 — Investigation board. A detective's cork board: polaroids of the suspects (players and
// teams), sticky notes with the evidence (facts) and case files (the pages), tied together with
// red string. Everything can be dragged around; click a note to follow its strings, click a case
// file to open it.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { pickFacts, type Fact } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, LabTitle, TeamLogo, useHeaderFont, useSize } from '../kit';
import { HubShell, useFacts } from '../hub';

type Kind = 'photo' | 'note' | 'case';
interface Item { id: string; kind: Kind; x: number; y: number; rot: number; z?: number; fact?: Fact; player?: PlayerX; team?: TeamX; page?: number }

// Physical board: fixed paper colours
const CORK = 'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.12) 0 2px, transparent 3px) 0 0/23px 23px, radial-gradient(circle at 70% 60%, rgba(255,255,255,0.07) 0 1.5px, transparent 2.5px) 0 0/17px 17px, linear-gradient(135deg, #9a6b3f, #7d5530)';
const NOTE = ['#fff27a', '#ffd1e8', '#c9f2ff', '#d6ffbf'];
const STRING = '#d62828';

function seeded(n: number) { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }

function layout(facts: Fact[]): Item[] {
  const notes = facts.filter(f => f.player || f.team).slice(0, 8);
  const photos: Item[] = [];
  const seen = new Set<string>();
  for (const f of notes) {
    const key = f.player ? `p-${f.player.id}` : `t-${f.team!.id}`;
    if (seen.has(key) || photos.length >= 6) continue;
    seen.add(key);
    photos.push({ id: key, kind: 'photo', x: 0, y: 0, rot: 0, player: f.player, team: f.player ? undefined : f.team });
  }
  const pages = [...new Set(notes.map(f => f.page))].slice(0, 5);
  const cases: Item[] = pages.map((p, i) => ({ id: `c-${p}`, kind: 'case', x: 8 + i * (84 / Math.max(1, pages.length - 1 || 1)), y: 87, rot: (seeded(p) - 0.5) * 6, page: p }));
  photos.forEach((p, i) => { p.x = 10 + i * (80 / Math.max(1, photos.length - 1 || 1)); p.y = 14 + (i % 2) * 6; p.rot = (seeded(i + 3) - 0.5) * 10; });
  const noteItems: Item[] = notes.map((f, i) => ({ id: `n-${f.id}`, kind: 'note', x: 9 + (i % 4) * 27 + (seeded(i) - 0.5) * 6, y: 42 + Math.floor(i / 4) * 21 + (seeded(i + 9) - 0.5) * 4, rot: (seeded(i + 20) - 0.5) * 9, fact: f }));
  return [...cases, ...photos, ...noteItems];
}

function Detective({ model, open }: { model: Model; open: (n: number) => void }) {
  const font = useHeaderFont();
  const all = useFacts(model);
  const facts = useMemo(() => pickFacts(all, 14), [all]);
  const [items, setItems] = useState<Item[]>(() => layout(facts));
  useEffect(() => { setItems(layout(facts)); }, [facts]);
  const [focus, setFocus] = useState<string | null>(null);
  const [ref, box] = useSize<HTMLDivElement>();
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const zTop = useRef(10);

  // everything is designed for a ~620px tall board; smaller boards shrink the paper, not the layout
  const k = box.h > 0 ? Math.min(1, Math.max(0.6, box.h / 620)) : 1;
  const px = (it: Item) => ({ x: (it.x / 100) * box.w, y: (it.y / 100) * box.h });
  const links = useMemo(() => {
    const out: Array<{ a: string; b: string; note: string }> = [];
    for (const it of items) {
      if (it.kind !== 'note' || !it.fact) continue;
      const who = it.fact.player ? `p-${it.fact.player.id}` : it.fact.team ? `t-${it.fact.team.id}` : null;
      if (who && items.some(x => x.id === who)) out.push({ a: it.id, b: who, note: it.id });
      if (items.some(x => x.id === `c-${it.fact!.page}`)) out.push({ a: it.id, b: `c-${it.fact.page}`, note: it.id });
    }
    return out;
  }, [items]);
  const lit = (id: string) => !focus || focus === id || links.some(l => l.note === focus && (l.a === id || l.b === id));

  useEffect(() => {
    const up = () => { setTimeout(() => { drag.current = null; }, 0); };
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d || !ref.current) return;
      if (e.buttons === 0) { up(); return; } // missed the release (e.g. outside the window)
      const r = ref.current.getBoundingClientRect();
      d.moved = true;
      const x = Math.max(3, Math.min(97, ((e.clientX - r.left - d.dx) / r.width) * 100));
      const y = Math.max(5, Math.min(95, ((e.clientY - r.top - d.dy) / r.height) * 100));
      setItems(list => list.map(it => (it.id === d.id ? { ...it, x, y } : it)));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [ref]);

  const startDrag = (it: Item) => (e: React.PointerEvent) => {
    e.preventDefault(); // no native image drag / text selection
    const r = ref.current!.getBoundingClientRect(); const p = px(it);
    drag.current = { id: it.id, dx: e.clientX - r.left - p.x, dy: e.clientY - r.top - p.y, moved: false };
    // bring to front (z-index, not re-ordering: moving the DOM node would swallow the click)
    const z = ++zTop.current; setItems(list => list.map(x => (x.id === it.id ? { ...x, z } : x)));
  };
  const clicked = (fn: () => void) => () => { if (drag.current?.moved) return; fn(); };

  return (
    <>
      <LabTitle sub={<span>przeciągaj dowody · kliknij notatkę, by pójść po sznurku · kliknij akta, by je otworzyć</span>}>Śledztwo</LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-3 rounded-2xl overflow-hidden select-none" style={{ background: CORK, boxShadow: 'inset 0 0 0 10px #5b3b1e, inset 0 0 40px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.4)' }}
        onClick={e => { if (e.target === e.currentTarget) setFocus(null); }}>
        {box.w > 0 && (
          <svg className="absolute inset-0 pointer-events-none" width={box.w} height={box.h}>
            {links.map((l, k) => {
              const a = items.find(x => x.id === l.a); const b = items.find(x => x.id === l.b);
              if (!a || !b) return null;
              const pa = px(a); const pb = px(b); const on = !focus || focus === l.note;
              const mx = (pa.x + pb.x) / 2; const my = Math.max(pa.y, pb.y) + 30; // string sags
              return <path key={k} d={`M${pa.x},${pa.y - 18} Q${mx},${my} ${pb.x},${pb.y - 18}`} fill="none" stroke={STRING} strokeWidth={on ? 2.5 : 1.5} opacity={on ? 0.95 : 0.25} />;
            })}
          </svg>
        )}
        {box.w > 0 && items.map(it => {
          const p = px(it);
          const dim = !lit(it.id);
          const common = { left: p.x, top: p.y, x: '-50%', y: '-50%', rotate: it.rot, scale: k, opacity: dim ? 0.35 : 1, zIndex: it.z ?? (it.kind === 'photo' ? 3 : it.kind === 'note' ? 2 : 1), touchAction: 'none' as const };
          const pin = <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full z-10" style={{ background: 'radial-gradient(circle at 35% 35%, #ff6b6b, #a00)', boxShadow: '0 2px 3px rgba(0,0,0,0.5)' }} />;
          if (it.kind === 'photo') return (
            <motion.div key={it.id} className="absolute cursor-grab active:cursor-grabbing" style={common} onPointerDown={startDrag(it)} whileHover={{ scale: k * 1.05 }}>
              {pin}
              <div className="bg-white p-2 pb-1 shadow-[0_8px_18px_rgba(0,0,0,0.45)]">
                {it.player ? <Avatar player={it.player} size={110} className="!rounded-none" /> : <div className="flex items-center justify-center" style={{ width: 110, height: 110, background: '#222' }}><TeamLogo team={it.team} size={90} /></div>}
                <div className="text-center text-sm font-bold text-neutral-800 mt-1 max-w-[110px] truncate" style={{ fontFamily: 'cursive' }}>{it.player?.name ?? it.team?.name}</div>
              </div>
            </motion.div>
          );
          if (it.kind === 'case') return (
            <motion.div key={it.id} className="absolute cursor-grab active:cursor-grabbing" style={common} onPointerDown={startDrag(it)} whileHover={{ scale: k * 1.05 }}>
              {pin}
              <button type="button" onClick={clicked(() => open(it.page!))} className="block text-left px-4 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.45)]" style={{ background: '#e9d8b4', width: 190, borderTop: '14px solid #c9a96e' }}>
                <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-600">Akta nr {it.page}</div>
                <div className="text-base font-bold uppercase text-neutral-900 leading-tight" style={font}>{REDESIGN_NAMES[it.page! - 1]}</div>
                <div className="text-[11px] text-red-700 font-bold mt-1 uppercase tracking-wider">Otwórz akta ›</div>
              </button>
            </motion.div>
          );
          const f = it.fact!;
          return (
            <motion.div key={it.id} className="absolute cursor-grab active:cursor-grabbing" style={common} onPointerDown={startDrag(it)} whileHover={{ scale: k * 1.05 }}>
              {pin}
              <button type="button" onClick={clicked(() => setFocus(x => (x === it.id ? null : it.id)))} onDoubleClick={() => open(f.page)}
                className="block text-left p-3 shadow-[0_8px_18px_rgba(0,0,0,0.4)]" style={{ background: NOTE[Math.abs(f.id.length) % NOTE.length], width: 200, outline: focus === it.id ? `3px solid ${STRING}` : 'none' }}>
                <div className="text-[10px] uppercase tracking-widest text-neutral-600">{f.kicker}</div>
                <div className="text-3xl font-bold text-neutral-900 leading-none my-1" style={{ fontFamily: 'cursive' }}>{f.big}</div>
                <div className="text-sm text-neutral-800 leading-snug line-clamp-2" style={{ fontFamily: 'cursive' }}>{f.tone === 'roast' ? f.sub : `${f.title}${f.sub ? ` — ${f.sub}` : ''}`}</div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

export default function D42Detective() {
  return <HubShell render={(m, x) => <Detective model={m} open={x.open} />} />;
}
