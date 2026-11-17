'use client';

// The prototypes' version switch: one small mark in a corner that opens into the three numbers.
import React, { useState } from 'react';
import { useHeaderFont } from '@/components/stats-lab/kit';
import { ACC_L, T } from './theme';

export function VersionPicker({ current, query }: { current: number; query: string }) {
  const font = useHeaderFont();
  const [open, setOpen] = useState(false);
  const href = (v: number) => { const q = new URLSearchParams(query); q.set('v', String(v)); return `?${q.toString()}`; };
  const cell: React.CSSProperties = { minWidth: 28, height: 28, fontSize: 11, letterSpacing: '0.08em', ...font };
  return (
    <div className="fixed left-0 top-0 flex items-center font-logik-extended-bold uppercase" style={{ zIndex: 120, padding: 4, color: T.muted }}>
      <button type="button" onClick={() => setOpen((x) => !x)} aria-label="Wersja prototypu" aria-expanded={open} className="flex items-center justify-center" style={{ ...cell, opacity: open ? 1 : 0.55 }}>v{current}</button>
      {open && [1, 2, 3].filter((v) => v !== current).map((v) => (
        <a key={v} href={href(v)} className="flex items-center justify-center" style={{ ...cell, color: ACC_L, borderLeft: `1px solid ${T.faint}` }}>{v}</a>
      ))}
    </div>
  );
}
