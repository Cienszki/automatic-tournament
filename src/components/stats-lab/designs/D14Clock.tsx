'use client';

// #14 — Game clock. One full turn of the dial is 80 minutes of *game time*: wedges show when games
// end (or, zoomed to the first 8 minutes, when first blood falls). Pick a team to see when it wins
// and when it loses; the side panel sorts teams from fastest closers to late-game specialists.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameX, Model, TeamX } from '@/lib/stats-lab/derive';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { C, LabTitle, LabView, Seg, TeamLogo, TeamPicker, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

type Measure = 'end' | 'fb';
const DIALS: Record<Measure, { span: number; bucket: number; label: string; tip: string; value: (g: GameX) => number | null; ticks: number[] }> = {
  end: { span: 80 * 60, bucket: 150, label: 'Koniec gry', tip: 'W której minucie gry kończyły się mecze (jeden obrót = 80 minut)', value: g => g.duration, ticks: [0, 10, 20, 30, 40, 50, 60, 70] },
  fb: { span: 8 * 60, bucket: 30, label: 'Pierwsza krew', tip: 'Kiedy padało pierwsze zabójstwo (jeden obrót = 8 minut)', value: g => (g.firstBlood >= 5 ? g.firstBlood : null), ticks: [0, 1, 2, 3, 4, 5, 6, 7] },
};

function Clock({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [measure, setMeasure] = useState<Measure>('end');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const dial = DIALS[measure];
  const team = teamId ? model.teamById.get(teamId) ?? null : null;
  const nb = dial.span / dial.bucket;

  const buckets = useMemo(() => {
    const out = Array.from({ length: nb }, (_, i) => ({ i, all: [] as GameX[], win: [] as GameX[], loss: [] as GameX[] }));
    for (const g of model.games) {
      const v = dial.value(g);
      if (v == null) continue;
      const b = out[Math.min(nb - 1, Math.floor(v / dial.bucket))];
      b.all.push(g);
      if (team && (g.radiant === team.id || g.dire === team.id)) (g.winnerId === team.id ? b.win : b.loss).push(g);
    }
    return out;
  }, [model, dial, nb, team]);
  const vals = model.games.map(dial.value).filter((v): v is number => v != null).sort((a, b) => a - b);
  const median = vals[Math.floor(vals.length / 2)] ?? 0;
  const maxN = Math.max(1, ...buckets.map(b => b.all.length));
  const teamMax = Math.max(1, ...buckets.map(b => b.win.length + b.loss.length));

  // Teams by average winning time
  const pace = useMemo(() => model.teams
    .filter(t => t.wins >= 2 && t.avg.winDuration != null)
    .map(t => ({ t, win: t.avg.winDuration!, fastest: Math.min(...t.games.filter(g => g.winnerId === t.id).map(g => g.duration)) }))
    .sort((a, b) => a.win - b.win), [model]);

  const S = Math.min(size.w, size.h); const cx = size.w / 2; const cy = size.h / 2;
  const r0 = S * 0.2; const r1 = S / 2 - 30;
  const ang = (sec: number) => (sec / dial.span) * Math.PI * 2 - Math.PI / 2;
  const wedge = (i: number, rIn: number, rOut: number) => {
    const a0 = ang(i * dial.bucket) + 0.012; const a1 = ang((i + 1) * dial.bucket) - 0.012;
    const pt = (a: number, r: number) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    return `M${pt(a0, rIn)} L${pt(a0, rOut)} A${rOut},${rOut} 0 0 1 ${pt(a1, rOut)} L${pt(a1, rIn)} A${rIn},${rIn} 0 0 0 ${pt(a0, rIn)} Z`;
  };
  const h = hover != null ? buckets[hover] : null;
  const span = (i: number) => `${fmtClock(i * dial.bucket).replace(/^0:/, '0:')}–${fmtClock((i + 1) * dial.bucket)}`;

  return (
    <>
      <LabTitle sub={<span>czas gry, nie godzina · {vals.length} gier</span>}
        right={<Seg value={measure} onChange={v => { setMeasure(v); setHover(null); }} options={(Object.keys(DIALS) as Measure[]).map(k => ({ value: k, label: DIALS[k].label, tip: DIALS[k].tip }))} />}>
        Zegar meczu
      </LabTitle>
      <TeamPicker className="shrink-0 mt-3" teams={model.teams} value={teamId} onChange={setTeamId} allLabel="Wszyscy" size={36} />
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        <div ref={ref} className="relative flex-[1.3] min-w-0 min-h-0" onMouseLeave={() => setHover(null)}>
          {size.w > 0 && (
            <svg width={size.w} height={size.h} className="absolute inset-0">
              <circle cx={cx} cy={cy} r={r1} fill="none" stroke={ink(8)} strokeDasharray="2 6" />
              {buckets.map(b => {
                const tAll = b.all.length / maxN;
                const rAll = r0 + 4 + tAll * (r1 - r0 - 4);
                const dim = hover != null && hover !== b.i;
                if (team) {
                  const rw = r0 + 4 + (b.win.length / teamMax) * (r1 - r0 - 4);
                  const rl = rw + (b.loss.length / teamMax) * (r1 - r0 - 4);
                  return (
                    <g key={b.i} onMouseEnter={() => setHover(b.i)} className="cursor-pointer" opacity={dim ? 0.4 : 1}>
                      <path d={wedge(b.i, r0, r1)} fill={ink(3)} />
                      {b.win.length > 0 && <motion.path initial={false} animate={{ d: wedge(b.i, r0 + 2, rw) }} fill={C.win} />}
                      {b.loss.length > 0 && <motion.path initial={false} animate={{ d: wedge(b.i, rw, rl) }} fill={C.loss} />}
                    </g>
                  );
                }
                return (
                  <motion.path key={b.i} initial={false} animate={{ d: wedge(b.i, r0, Math.max(r0 + 2, rAll)) }} transition={{ type: 'spring', stiffness: 90, damping: 16 }}
                    fill={b.all.length ? `color-mix(in srgb, ${C.secondary} ${Math.round(tAll * 100)}%, ${C.primary})` : ink(5)}
                    opacity={dim ? 0.35 : 1} onMouseEnter={() => setHover(b.i)} className="cursor-pointer" />
                );
              })}
              {/* median hand */}
              <line x1={cx} y1={cy} x2={cx + Math.cos(ang(median)) * (r1 + 8)} y2={cy + Math.sin(ang(median)) * (r1 + 8)} stroke={C.text} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 4" />
              {dial.ticks.map(t => {
                const a = ang(t * 60);
                return <text key={t} x={cx + Math.cos(a) * (r1 + 18)} y={cy + Math.sin(a) * (r1 + 18)} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill="currentColor" opacity={0.75}>{t}′</text>;
              })}
            </svg>
          )}
          {size.w > 0 && (
            <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none" style={{ left: cx - r0, top: cy - r0, width: r0 * 2, height: r0 * 2 }}>
              {h ? (
                <>
                  <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: r0 * 0.32, color: C.heading, ...font }}>{span(h.i)}</div>
                  <div className="text-sm mt-1" style={{ color: C.muted }}>{team ? `${h.win.length} W · ${h.loss.length} P` : `${h.all.length} gier`}</div>
                </>
              ) : (
                <>
                  <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: r0 * 0.42, color: C.heading, ...font }}>{fmtClock(median)}</div>
                  <div className="text-[11px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>mediana</div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-[380px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          {team ? (
            <TeamPace t={team} />
          ) : (
            <>
              <Tip content="Średni czas gier, które drużyna wygrała (min. 2 wygrane)">
                <div className="text-lg font-logik-extended-bold uppercase inline-block cursor-help" style={{ color: C.heading, ...font }}>Szybkie zamknięcia</div>
              </Tip>
              <PaceList rows={pace.slice(0, 4)} onPick={setTeamId} />
              <Tip content="Drużyny, których wygrane trwają najdłużej — mistrzowie późnej gry">
                <div className="text-lg font-logik-extended-bold uppercase inline-block cursor-help mt-2" style={{ color: C.heading, ...font }}>Cierpliwi</div>
              </Tip>
              <PaceList rows={pace.slice(-4).reverse()} onPick={setTeamId} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PaceList({ rows, onPick }: { rows: Array<{ t: TeamX; win: number; fastest: number }>; onPick: (id: string) => void }) {
  const font = useHeaderFont();
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(r => (
        <Tip key={r.t.id} content={<TipBody title={r.t.name}>Najszybsza wygrana: {fmtClock(r.fastest)} · kliknij, by zobaczyć na zegarze</TipBody>}>
          <button type="button" onClick={() => onPick(r.t.id)} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left" style={{ background: ink(4) }}>
            <TeamLogo team={r.t} size={40} />
            <span className="flex-1 truncate text-sm font-semibold">{r.t.name}</span>
            <span className="text-xl font-logik-extended-bold tabular-nums" style={font}>{fmtClock(r.win)}</span>
          </button>
        </Tip>
      ))}
    </div>
  );
}

function TeamPace({ t }: { t: TeamX }) {
  const font = useHeaderFont();
  const wins = t.games.filter(g => g.winnerId === t.id);
  const losses = t.games.filter(g => g.winnerId !== t.id);
  const fastest = wins.length ? wins.reduce((a, g) => (g.duration < a.duration ? g : a)) : null;
  const longest = t.games.length ? t.games.reduce((a, g) => (g.duration > a.duration ? g : a)) : null;
  const stat = (label: string, v: string, tip: string, color?: string) => (
    <Tip content={tip}>
      <div className="rounded-xl px-3 py-2 cursor-help" style={{ background: ink(4) }}>
        <div className="text-2xl font-logik-extended-bold tabular-nums" style={{ color, ...font }}>{v}</div>
        <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{label}</div>
      </div>
    </Tip>
  );
  return (
    <motion.div key={t.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <TeamLogo team={t} size={60} />
        <div className="text-2xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{t.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stat('średnia wygrana', t.avg.winDuration != null ? fmtClock(t.avg.winDuration) : '–', 'Średni czas wygranych gier', C.win)}
        {stat('średnia porażka', t.avg.lossDuration != null ? fmtClock(t.avg.lossDuration) : '–', 'Średni czas przegranych gier', C.loss)}
        {stat('najszybsza wygrana', fastest ? fmtClock(fastest.duration) : '–', 'Najkrótsza wygrana gra')}
        {stat('najdłuższa gra', longest ? fmtClock(longest.duration) : '–', 'Najdłuższa gra drużyny')}
      </div>
      <Tip content="Gry drużyny od najkrótszej do najdłuższej">
        <div className="text-[10px] uppercase tracking-widest cursor-help self-start" style={{ color: C.muted }}>Gry według długości</div>
      </Tip>
      <div className="flex flex-col gap-1">
        {[...t.games].sort((a, b) => a.duration - b.duration).slice(0, 7).map(g => {
          const opp = g.radiant === t.id ? g.direTeam : g.radiantTeam;
          const won = g.winnerId === t.id;
          return (
            <div key={g.idx} className="flex items-center gap-2.5 h-9">
              <span className="w-1.5 h-7 rounded-sm" style={{ background: won ? C.win : C.loss }} />
              <TeamLogo team={opp} size={30} />
              <span className="flex-1 truncate text-sm">{opp?.name}</span>
              <span className="text-base font-bold tabular-nums" style={font}>{fmtClock(g.duration)}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function D14Clock() {
  return <LabView><WithModel>{m => <Clock model={m} />}</WithModel></LabView>;
}
