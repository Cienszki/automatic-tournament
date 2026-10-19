'use client';

// #48 — Ranks. Every regular gets a Dota ranked medal from their average performance score: the
// bottom 10% are Heralds, the top 5% Immortals (numbered like the real leaderboard), with 1–5
// stars inside each medal. Click a player to see how far the next medal is — and who to pass.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { POS_OF, ROLE_LABEL, qualified } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';
import { MEDALS, Medal } from '../medal';


interface Ranked { p: PlayerX; avg: number; medal: number; stars: number; place: number }

function assign(players: PlayerX[]): Ranked[][] {
  const sorted = [...players].sort((a, b) => (a.agg.score.avg ?? 0) - (b.agg.score.avg ?? 0));
  const n = sorted.length;
  const cols: Ranked[][] = MEDALS.map(() => []);
  // cut points from the top so Immortal always has someone
  const counts = MEDALS.map(m => Math.round(m.share * n));
  counts[7] = Math.max(1, counts[7]);
  let diff = n - counts.reduce((a, b) => a + b, 0);
  for (let i = 3; diff !== 0; i = (i + 1) % 7) { const d = Math.sign(diff); if (counts[i] + d >= 0) { counts[i] += d; diff -= d; } }
  let k = 0;
  counts.forEach((c, mi) => {
    for (let j = 0; j < c; j++, k++) {
      const p = sorted[k];
      cols[mi].push({ p, avg: p.agg.score.avg ?? 0, medal: mi, stars: Math.min(5, 1 + Math.floor((j / Math.max(1, c)) * 5)), place: n - k });
    }
  });
  return cols.map(c => c.reverse());
}


function Column({ list, medal, sel, onSel }: { list: Ranked[]; medal: number; sel: string | null; onSel: (id: string) => void }) {
  const [ref, box] = useSize<HTMLDivElement>();
  const n = list.length;
  // largest avatar for which every member fits in the column
  let size = 24;
  for (let s = 96; s >= 24; s -= 2) {
    const per = Math.max(1, Math.floor((box.w + 6) / (s + 6)));
    if (Math.ceil(n / per) * (s + 6) <= box.h) { size = s; break; }
  }
  const m = MEDALS[medal];
  return (
    <div ref={ref} className="flex-1 min-h-0 flex flex-wrap content-start justify-center gap-[6px]">
      {box.w > 0 && list.map(r => (
        <Tip key={r.p.id} content={<TipBody title={r.p.name}>{m.name} {medal < 7 ? '★'.repeat(r.stars) : `#${r.place}`} · {r.avg.toFixed(2)} pkt na grę · {r.p.games} gier</TipBody>}>
          <motion.button type="button" onClick={() => onSel(r.p.id)} layout className="rounded-full" whileHover={{ scale: 1.12 }}
            style={{ boxShadow: sel === r.p.id ? `0 0 0 3px ${C.secondary}, 0 0 20px ${mix(C.secondary, 60)}` : `0 0 0 2px ${mix(m.color, 70)}` }}>
            <Avatar player={r.p} size={size} />
          </motion.button>
        </Tip>
      ))}
    </div>
  );
}

function Ranks({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [pos, setPos] = useState('all');
  const players = useMemo(() => qualified(model).filter(p => pos === 'all' || String(POS_OF[p.role ?? '']) === pos), [model, pos]);
  const cols = useMemo(() => assign(players), [players]);
  const flat = useMemo(() => cols.flat().sort((a, b) => a.place - b.place), [cols]);
  const [selId, setSel] = useState<string | null>(null);
  const sel = flat.find(r => r.p.id === selId) ?? flat[Math.floor(flat.length * 0.4)] ?? null;
  // the next step: one star up, or the next medal
  const above = sel ? flat.find(r => r.place === sel.place - 1) : null;
  const nextMedal = sel && sel.medal < 7 ? cols[sel.medal + 1][cols[sel.medal + 1].length - 1] : null;

  return (
    <>
      <LabTitle
        sub={<Tip content={`Medal z percentyla średnich punktów występu wśród graczy z co najmniej ${model.minGames} grami. Immortal to najlepsze 5% — z numerem miejsca.`}><span className="cursor-help">{players.length} graczy z rangą</span></Tip>}
        right={<Seg value={pos} onChange={v => { setPos(v); setSel(null); }} options={[{ value: 'all', label: 'Wszyscy' }, ...Object.entries(POS_OF).map(([r, n]) => ({ value: String(n), label: `Poz. ${n}`, tip: ROLE_LABEL[r] }))]} />}
      >Rangi</LabTitle>

      <div className="flex-1 min-h-0 flex gap-2 mt-3">
        {MEDALS.map((m, mi) => (
          <div key={m.name} className="flex-1 min-w-0 flex flex-col rounded-2xl px-1.5 pb-2" style={{ background: `linear-gradient(180deg, ${mix(m.color, 16)}, transparent 70%)`, border: `1px solid ${mix(m.color, 25)}`, marginTop: `${(7 - mi) * 1.6}%` }}>
            <div className="flex flex-col items-center -mt-1">
              <Medal medal={mi} stars={5} size={64} />
              <div className="font-logik-extended-bold uppercase text-sm tracking-wide" style={{ color: m.color, ...font }}>{m.name}</div>
              <div className="text-[10px] mb-2" style={{ color: C.muted }}>{cols[mi].length}</div>
            </div>
            <Column list={cols[mi]} medal={mi} sel={sel?.p.id ?? null} onSel={setSel} />
          </div>
        ))}
      </div>

      {/* Selected player: medal, stars and the next step */}
      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.p.id} className="shrink-0 mt-3 flex items-center gap-5 rounded-2xl px-4 py-3" style={{ background: ink(5), border: `1px solid ${mix(MEDALS[sel.medal].color, 40)}` }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Avatar player={sel.p} size={72} ring={MEDALS[sel.medal].color} />
            <div className="min-w-0 w-56">
              <div className="text-2xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{sel.p.name}</div>
              <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}><TeamLogo team={sel.p.team} size={20} />{sel.p.team?.name}{sel.p.role ? ` · ${ROLE_LABEL[sel.p.role]}` : ''}</div>
            </div>
            <Medal medal={sel.medal} stars={sel.stars} size={84} number={sel.place} />
            <div className="w-40">
              <div className="text-xl font-logik-extended-bold" style={{ color: MEDALS[sel.medal].color, ...font }}>{MEDALS[sel.medal].name} {sel.medal < 7 ? sel.stars : ''}</div>
              <div className="text-sm" style={{ color: C.text }}><b className="tabular-nums">{sel.avg.toFixed(2)}</b> pkt / grę · #{sel.place}</div>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-4">
              {above ? (
                <Tip content={<TipBody title="Następny do wyprzedzenia">Tyle punktów występu średnio brakuje do miejsca wyżej</TipBody>}>
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2 cursor-help" style={{ background: ink(5) }}>
                    <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Do wyprzedzenia</span>
                    <Avatar player={above.p} size={44} />
                    <div className="leading-tight"><div className="font-bold">{above.p.name}</div><div className="text-xs tabular-nums" style={{ color: C.muted }}>+{(above.avg - sel.avg).toFixed(2)} pkt</div></div>
                  </div>
                </Tip>
              ) : <div className="text-lg font-bold" style={{ color: MEDALS[7].color }}>Numer 1 ligi</div>}
              {nextMedal && (
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-1" style={{ color: C.muted }}><span>do {MEDALS[sel.medal + 1].name}</span><span className="tabular-nums">brakuje {Math.max(0, nextMedal.avg - sel.avg).toFixed(2)} pkt</span></div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: ink(8) }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (sel.avg / Math.max(0.01, nextMedal.avg)) * 100)}%`, background: `linear-gradient(90deg, ${MEDALS[sel.medal].color}, ${MEDALS[sel.medal + 1].color})` }} />
                  </div>
                </div>
              )}
              {sel.p.heroes[0] && <Tip content={`Najczęściej: ${heroName(sel.p.heroes[0].heroId)}`}><span><HeroImg heroId={sel.p.heroes[0].heroId} className="rounded-lg" style={{ width: 88, height: 50 }} /></span></Tip>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function D48Ranks() {
  return <LabView><WithModel>{m => <Ranks model={m} />}</WithModel></LabView>;
}
