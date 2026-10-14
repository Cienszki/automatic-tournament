'use client';

// #35 — Departures board. The stats as an airport split-flap board: every row is a fact with its
// "gate" (the page that explains it). Every 5 s one row flips to a new fact, letter by letter.
// Click a row to board that page.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Model } from '@/lib/stats-lab/derive';
import { buildFacts, pickFacts, type Fact } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, WithModel, useHeaderFont, useSize } from '../kit';
import { useExpander } from '../hub';

const FLIP_MS = 5000;
const CHARS = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ0123456789';
// A physical board: fixed colours, not theme colours
const AMBER = '#f5c518';
const ROAST = '#ff8a3d';

/** One split-flap string: on change, each letter rattles through random glyphs before settling */
function Flap({ text, width, color = AMBER, size = 18 }: { text: string; width: number; color?: string; size?: number }) {
  const target = text.toUpperCase().padEnd(width).slice(0, width);
  const [shown, setShown] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (prev.current === target) return;
    prev.current = target;
    let step = 0;
    const settleAt = (i: number) => 3 + i * 0.45; // letters settle left to right
    const last = settleAt(width);
    const id = setInterval(() => {
      step++;
      setShown(target.split('').map((ch, i) => (ch === ' ' || step >= settleAt(i) ? ch : CHARS[Math.floor(Math.random() * CHARS.length)])).join(''));
      if (step >= last) { clearInterval(id); setShown(target); }
    }, 55);
    return () => clearInterval(id);
  }, [target, width]);
  return (
    <span className="inline-flex gap-[2px]">
      {shown.split('').map((ch, i) => (
        <span key={i} className="relative inline-flex items-center justify-center font-mono font-bold rounded-[3px]"
          style={{ width: size * 0.78, height: size * 1.45, fontSize: size, color, background: 'linear-gradient(180deg, #1c1c20 0 49%, #0a0a0c 49% 51%, #17171a 51%)', boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04)' }}>
          {ch === ' ' ? '' : ch}
        </span>
      ))}
    </span>
  );
}

const strip = (s: string) => s;
const status = (f: Fact) => (f.tone === 'roast' ? 'WPADKA' : f.id.startsWith('rec-') ? 'REKORD' : f.tone === 'brag' ? 'LIDER' : 'INFO');

function Board({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { open, node, isOpen } = useExpander();
  // Interleave brags, records and roasts so the board never shows one kind only
  const facts = useMemo(() => { const all = buildFacts(model); const mixed = pickFacts(all, all.length); return [...mixed, ...all.filter(x => !mixed.includes(x))]; }, [model]);
  const [ref, box] = useSize<HTMLDivElement>();
  const rowsN = Math.max(4, Math.min(9, Math.floor((box.h - 40) / 64)));
  const [rows, setRows] = useState<Fact[]>([]);
  const [hover, setHover] = useState(false);
  const cursor = useRef(0);
  const nextIdx = useRef(0);

  useEffect(() => { setRows(facts.slice(0, rowsN)); nextIdx.current = rowsN; }, [facts, rowsN]);
  useEffect(() => {
    if (hover || isOpen || facts.length <= rowsN) return;
    const t = setInterval(() => {
      setRows(r => {
        const used = new Set(r.map(x => x.id));
        let n = nextIdx.current; let guard = 0;
        while (used.has(facts[n % facts.length].id) && guard++ < facts.length) n++;
        nextIdx.current = n + 1;
        const out = [...r]; out[cursor.current % r.length] = facts[n % facts.length];
        cursor.current++;
        return out;
      });
    }, FLIP_MS);
    return () => clearInterval(t);
  }, [hover, isOpen, facts, rowsN]);

  // Character widths scale with the board
  const cs = box.w > 1300 ? 18 : box.w > 1000 ? 15 : 12;
  const cols = { cat: 18, big: 7, who: box.w > 1300 ? 20 : 14, gate: 2, st: 7 };

  return (
    <div className="relative h-full w-full">
      <LabView>
        <LabTitle sub={<span>najedź, by zatrzymać · kliknij lot, by wejść na pokład</span>}>Tablica odlotów</LabTitle>
        <div ref={ref} className="flex-1 min-h-0 mt-3 rounded-2xl p-4 flex flex-col overflow-hidden" style={{ background: '#0c0c0e', boxShadow: '0 0 0 1px rgba(255,255,255,0.08), inset 0 0 60px rgba(0,0,0,0.8)' }}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <div className="flex items-center gap-4 pb-2 mb-2 text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.45)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ width: 52 }} />
            <span style={{ width: cols.cat * (cs * 0.78 + 2) }}>Kategoria</span>
            <span style={{ width: cols.big * (cs * 0.78 + 2) }}>Wynik</span>
            <span style={{ width: cols.who * (cs * 0.78 + 2) }}>Kto</span>
            <span style={{ width: Math.max(cols.gate * (cs * 0.78 + 2) + 8, 80) }}>Bramka</span>
            <span>Status</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-around">
            {rows.map((f, k) => (
              <Tip key={k} content={`${f.kicker}: ${f.big} — ${f.title}${f.sub ? ` · ${f.sub}` : ''} · otwiera „${REDESIGN_NAMES[f.page - 1]}”`}>
                <button type="button" onClick={() => open(f.page)} className="flex items-center gap-4 rounded-lg px-1 py-1 text-left hover:bg-white/[0.04] transition-colors">
                  <span className="shrink-0" style={{ width: 52 }}>
                    {f.player ? <Avatar player={f.player} size={48} /> : f.team ? <TeamLogo team={f.team} size={48} /> : f.heroId != null ? <HeroImg heroId={f.heroId} variant="icon" className="w-12 h-12 rounded-full" /> : null}
                  </span>
                  <Flap text={strip(f.kicker.replace(/^Rekord · /, 'Rek. ').replace(/^Wpadka · /, ''))} width={cols.cat} size={cs} />
                  <Flap text={strip(f.big)} width={cols.big} size={cs} color="#ffffff" />
                  <Flap text={strip(f.title)} width={cols.who} size={cs} />
                  <span className="flex items-center" style={{ width: Math.max(cols.gate * (cs * 0.78 + 2) + 8, 80) }}><Flap text={String(f.page)} width={cols.gate} size={cs} color="#7fd1ff" /></span>
                  <Flap text={status(f)} width={cols.st} size={cs} color={f.tone === 'roast' ? ROAST : '#7CFC9A'} />
                </button>
              </Tip>
            ))}
          </div>
        </div>
        <div className="shrink-0 flex items-center justify-between mt-2 text-xs" style={{ color: C.muted }}>
          <span>Bramka = numer strony ze szczegółami</span>
          <span className="font-logik-extended-bold tabular-nums" style={font}>{model.games.length} gier · {model.players.length} graczy</span>
        </div>
      </LabView>
      {node}
    </div>
  );
}

export default function D35Board() {
  return <div className="h-full w-full flex flex-col"><WithModel>{m => <Board model={m} />}</WithModel></div>;
}
