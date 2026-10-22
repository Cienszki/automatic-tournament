'use client';

// #7 — Team fingerprints. A pizza chart per team: each slice is a percentile against the other
// teams. Hover another logo to overlay it. Style tags, form, side split and the roster's share
// of the team's gold and kills complete the identity.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { fmtClock, fmtPct } from '@/lib/stats-lab/metrics';
import { pctRank, type Model, type TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, playerTip, useHeaderFont, useSize } from '../kit';
import { count } from '@/lib/plural';

interface Slice { key: string; label: string; desc: string; get: (t: TeamX) => number; fmt: (v: number) => string; invert?: boolean; color: string }

const SLICES: Slice[] = [
  { key: 'kills', label: 'Zabójstwa', desc: 'Średnio zabójstw na grę', get: t => t.avg.kills, fmt: v => v.toFixed(1), color: C.primary },
  { key: 'deaths', label: 'Przeżywalność', desc: 'Średnio śmierci na grę — mniej daje większy kawałek', get: t => t.avg.deaths, fmt: v => v.toFixed(1), invert: true, color: C.primary },
  { key: 'dmg', label: 'Obrażenia', desc: 'Obrażenia bohaterom na minutę gry (cała drużyna)', get: t => t.avg.heroDamage / Math.max(1, t.avg.duration / 60), fmt: v => String(Math.round(v)), color: C.primary },
  { key: 'fb', label: 'Pierwsza krew', desc: 'Odsetek gier z pierwszą krwią po stronie drużyny', get: t => t.avg.fbRate ?? 0, fmt: fmtPct, color: C.primary },
  { key: 'gpm', label: 'Złoto', desc: 'Łączne GPM drużyny', get: t => t.avg.gpm, fmt: v => String(Math.round(v)), color: C.secondary },
  { key: 'tempo', label: 'Tempo', desc: 'Średni czas wygranych gier — szybciej daje większy kawałek', get: t => t.avg.winDuration ?? 9e9, fmt: v => (v > 1e9 ? '–' : fmtClock(v)), invert: true, color: C.secondary },
  { key: 'bld', label: 'Oblężenie', desc: 'Obrażenia budynkom na grę', get: t => t.avg.towerDamage, fmt: v => `${(v / 1000).toFixed(1)}k`, color: C.secondary },
  { key: 'rosh', label: 'Roshany', desc: 'Zabite Roshany na grę', get: t => t.avg.roshans, fmt: v => v.toFixed(2), color: C.secondary },
  { key: 'wards', label: 'Wizja', desc: 'Postawione wardy na grę', get: t => t.avg.wards, fmt: v => v.toFixed(1), color: C.accent },
  { key: 'dew', label: 'Dewardy', desc: 'Zniszczone wrogie wardy na grę', get: t => t.avg.dewards, fmt: v => v.toFixed(1), color: C.accent },
  { key: 'stk', label: 'Stacki', desc: 'Zestackowane obozy na grę', get: t => t.avg.stacks, fmt: v => v.toFixed(1), color: C.accent },
  { key: 'heal', label: 'Leczenie', desc: 'Wyleczone zdrowie sojuszników na grę', get: t => t.avg.heroHealing, fmt: v => `${(v / 1000).toFixed(1)}k`, color: C.accent },
];

const TAGS: Array<{ key: string; name: string; desc: string; test: (p: Record<string, number>) => boolean }> = [
  { key: 'kills', name: 'Krwiożerczy', desc: 'Jedni z najwięcej zabijających', test: p => p.kills >= 0.75 },
  { key: 'deaths', name: 'Nie do zabicia', desc: 'Giną najrzadziej', test: p => p.deaths >= 0.75 },
  { key: 'tempo', name: 'Szybkie zamknięcia', desc: 'Wygrywają szybciej niż inni', test: p => p.tempo >= 0.75 },
  { key: 'gpm', name: 'Farmerzy', desc: 'Najwyższe tempo złota', test: p => p.gpm >= 0.75 },
  { key: 'wards', name: 'Wizjonerzy', desc: 'Najwięcej wardów', test: p => p.wards >= 0.75 },
  { key: 'dew', name: 'Czyściciele', desc: 'Najwięcej zniszczonych wardów', test: p => p.dew >= 0.75 },
  { key: 'stk', name: 'Stackerzy', desc: 'Najwięcej stacków', test: p => p.stk >= 0.75 },
  { key: 'rosh', name: 'Łowcy Roshana', desc: 'Najczęściej biją Roshana', test: p => p.rosh >= 0.75 },
  { key: 'bld', name: 'Burzyciele', desc: 'Najwięcej obrażeń budynkom', test: p => p.bld >= 0.75 },
  { key: 'fb', name: 'Pierwsza krew', desc: 'Najczęściej zaczynają od zabójstwa', test: p => p.fb >= 0.75 },
  { key: 'late', name: 'Gra na czas', desc: 'Ich wygrane trwają najdłużej', test: p => p.tempo <= 0.2 },
];

function percentiles(teams: TeamX[], t: TeamX) {
  const out: Record<string, number> = {};
  for (const s of SLICES) {
    const vals = teams.map(s.get);
    const r = pctRank(vals, s.get(t));
    out[s.key] = s.invert ? 1 - r : r;
  }
  return out;
}

function Pizza({ team, ghost, teams, size }: { team: TeamX; ghost: TeamX | null; teams: TeamX[]; size: number }) {
  const font = useHeaderFont();
  const P = useMemo(() => percentiles(teams, team), [teams, team]);
  const G = useMemo(() => (ghost ? percentiles(teams, ghost) : null), [teams, ghost]);
  const R = size / 2 - 46; const r0 = R * 0.16; const cx = size / 2; const cy = size / 2;
  const n = SLICES.length; const step = (Math.PI * 2) / n;
  const arc = (i: number, rad: number, pad = 0.025) => {
    const a0 = i * step - Math.PI / 2 + pad; const a1 = (i + 1) * step - Math.PI / 2 - pad;
    const p = (a: number, r: number) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    return `M${p(a0, r0)} L${p(a0, rad)} A${rad},${rad} 0 0 1 ${p(a1, rad)} L${p(a1, r0)} A${r0},${r0} 0 0 0 ${p(a0, r0)} Z`;
  };
  return (
    <svg width={size} height={size} className="overflow-visible">
      {[0.25, 0.5, 0.75, 1].map(f => <circle key={f} cx={cx} cy={cy} r={r0 + (R - r0) * f} fill="none" stroke={ink(f === 1 ? 14 : 7)} strokeDasharray={f === 1 ? undefined : '2 4'} />)}
      {SLICES.map((s, i) => {
        const rad = r0 + (R - r0) * Math.max(0.04, P[s.key]);
        const mid = (i + 0.5) * step - Math.PI / 2;
        const lx = cx + Math.cos(mid) * (R + 24); const ly = cy + Math.sin(mid) * (R + 24);
        const rank = [...teams].sort((a, b) => (s.invert ? s.get(a) - s.get(b) : s.get(b) - s.get(a))).findIndex(t => t.id === team.id) + 1;
        return (
          <g key={s.key}>
            <path d={arc(i, R)} fill={ink(3)} />
            <Tip content={<TipBody title={`${s.label}: ${s.fmt(s.get(team))}`}>{s.desc}. Miejsce {rank} z {teams.length}.</TipBody>}>
              <motion.path d={arc(i, rad)} initial={false} animate={{ d: arc(i, rad) }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                fill={s.color} fillOpacity={0.85} className="cursor-help" />
            </Tip>
            {G && <path d={arc(i, r0 + (R - r0) * Math.max(0.04, G[s.key]), 0.06)} fill="none" stroke={C.text} strokeWidth={1.5} strokeDasharray="3 2" pointerEvents="none" />}
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="currentColor" opacity={0.75} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</text>
            <text x={cx + Math.cos(mid) * (rad - 12)} y={cy + Math.sin(mid) * (rad - 12)} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="#fff" stroke="rgba(0,0,0,0.55)" strokeWidth={2.5} paintOrder="stroke" opacity={rad - r0 > 26 ? 0.95 : 0} pointerEvents="none">{Math.round(P[s.key] * 100)}</text>
          </g>
        );
      })}
      <foreignObject x={cx - r0} y={cy - r0} width={r0 * 2} height={r0 * 2}>
        <div className="w-full h-full flex items-center justify-center"><TeamLogo team={team} size={r0 * 1.4} /></div>
      </foreignObject>
      <text x={cx} y={size - 2} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.4} style={font}>percentyl wśród drużyn</text>
    </svg>
  );
}

function Fingerprints({ model }: { model: Model }) {
  const font = useHeaderFont();
  const teams = useMemo(() => model.teams.filter(t => t.games.length >= 2).sort((a, b) => b.wr - a.wr || b.wins - a.wins), [model]);
  const [sel, setSel] = useState(teams[0]?.id);
  const [hover, setHover] = useState<string | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const team = teams.find(t => t.id === sel) ?? teams[0];
  const ghost = hover && hover !== team?.id ? teams.find(t => t.id === hover) ?? null : null;
  const P = useMemo(() => (team ? percentiles(teams, team) : {}), [teams, team]);
  if (!team) return null;
  const tags = TAGS.filter(t => t.test(P));
  const goldTotal = team.players.reduce((s, p) => s + p.perfs.filter(x => x.tid === team.id).reduce((a, x) => a + x.totalGold, 0), 0) || 1;
  const killTotal = team.players.reduce((s, p) => s + p.perfs.filter(x => x.tid === team.id).reduce((a, x) => a + x.kills, 0), 0) || 1;
  const roster = team.players.filter(p => p.perfs.some(x => x.tid === team.id)).slice(0, 7);
  const palette = [C.primary, C.secondary, C.accent, '#7aa2f7', '#9ece6a', '#bb9af7', '#e0af68'];

  return (
    <>
      <LabTitle sub={<span>{count(teams.length, 'drużyna', 'drużyny', 'drużyn')}</span>}>Odciski drużyn</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Logo rail */}
        <div className="w-[248px] shrink-0 hidden md:grid grid-cols-4 content-start gap-2" onMouseLeave={() => setHover(null)}>
          {teams.map(t => (
            <Tip key={t.id} side="right" content={<TipBody title={t.name}>{t.wins}-{t.losses} w grach · najedź, by porównać</TipBody>}>
              <button type="button" onClick={() => setSel(t.id)} onMouseEnter={() => setHover(t.id)} className="aspect-square rounded-lg flex items-center justify-center transition-all"
                style={{ background: t.id === team.id ? mix(C.primary, 35) : ink(5), boxShadow: t.id === team.id ? `0 0 0 2px ${C.secondary}, 0 0 16px ${mix(C.secondary, 45)}` : undefined, outline: t.id === hover && t.id !== team.id ? `1px dashed ${C.text}` : 'none' }}>
                <TeamLogo team={t} size={46} />
              </button>
            </Tip>
          ))}
        </div>

        {/* Pizza */}
        <div ref={ref} className="flex-[1.2] min-w-0 min-h-0 flex items-center justify-center">
          {size.w > 0 && <Pizza team={team} ghost={ghost} teams={teams} size={Math.min(size.w, size.h)} />}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-[340px] max-w-[480px] flex flex-col justify-between gap-3 min-h-0">
          <div>
            <div className="flex items-center gap-3">
              <TeamLogo team={team} size={56} />
              <div className="text-3xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{team.name}</div>
            </div>
            {ghost && <div className="text-xs mt-1" style={{ color: C.muted }}>porównanie: <b style={{ color: C.text }}>{ghost.name}</b> (przerywana linia)</div>}
          </div>
          <div className="flex gap-4 items-end">
            <Tip content="Serie: wygrane – remisy – przegrane"><div className="cursor-help"><div className="text-4xl font-logik-extended-bold tabular-nums" style={font}>{team.series.w}-{team.series.d}-{team.series.l}</div><div className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>Serie</div></div></Tip>
            <Tip content="Pojedyncze gry: wygrane – przegrane"><div className="cursor-help"><div className="text-4xl font-logik-extended-bold tabular-nums" style={font}>{team.wins}-{team.losses}</div><div className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>Gry</div></div></Tip>
            <Tip content={`Radiant ${team.radiant.wins}/${team.radiant.games} · Dire ${team.dire.wins}/${team.dire.games} wygranych`}>
              <div className="flex-1 cursor-help">
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div style={{ width: `${(team.radiant.games / (team.games.length || 1)) * 100}%`, background: C.radiant, opacity: 0.4 + 0.6 * (team.radiant.games ? team.radiant.wins / team.radiant.games : 0) }} />
                  <div className="flex-1" style={{ background: C.dire, opacity: 0.4 + 0.6 * (team.dire.games ? team.dire.wins / team.dire.games : 0) }} />
                </div>
                <div className="flex justify-between text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}><span>Radiant</span><span>Dire</span></div>
              </div>
            </Tip>
          </div>
          <Tip content="Wszystkie gry po kolei"><div className="flex gap-0.5 cursor-help">{team.form.map((w, i) => <span key={i} className="flex-1 max-w-[18px] h-6 rounded" style={{ background: w ? C.win : C.loss }} />)}</div></Tip>
          <div className="flex flex-wrap gap-1.5 min-h-[26px]">
            {tags.map(t => <Tip key={t.key} content={t.desc}><span className="px-3.5 py-1.5 rounded-full text-sm font-semibold cursor-help" style={{ background: mix(C.primary, 22), border: `1px solid ${mix(C.primary, 55)}` }}>{t.name}</span></Tip>)}
          </div>
          {/* Economy share */}
          <div className="space-y-2.5">
            {[{ label: 'Złoto', total: goldTotal, get: (x: typeof roster[number]) => x.perfs.filter(q => q.tid === team.id).reduce((a, q) => a + q.totalGold, 0), desc: 'Udział w złocie drużyny' },
              { label: 'Zabójstwa', total: killTotal, get: (x: typeof roster[number]) => x.perfs.filter(q => q.tid === team.id).reduce((a, q) => a + q.kills, 0), desc: 'Udział w zabójstwach drużyny' }].map(row => (
              <div key={row.label}>
                <Tip content={row.desc}><div className="text-[10px] uppercase tracking-widest mb-1 cursor-help" style={{ color: C.muted }}>{row.label}</div></Tip>
                <div className="flex h-8 rounded-lg overflow-hidden">
                  {roster.map((p, i) => {
                    const share = row.get(p) / row.total;
                    return (
                      <Tip key={p.id} content={<TipBody title={p.name}>{fmtPct(share)} — {row.desc.toLowerCase()}</TipBody>}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} className="h-full text-[11px] font-bold flex items-center justify-center overflow-hidden text-black/75" style={{ background: palette[i % palette.length] }}>{share > 0.12 ? fmtPct(share) : ''}</motion.div>
                      </Tip>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
              {roster.map((p, i) => (
                <Tip key={p.id} content={playerTip(p)}>
                  <span className="flex items-center gap-2 text-sm min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: palette[i % palette.length] }} /><Avatar player={p} size={30} /><span className="truncate font-semibold">{p.name}</span></span>
                </Tip>
              ))}
            </div>
          </div>
          {/* Signature heroes / feared */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Tip content="Najczęściej wybierani bohaterowie drużyny"><div className="text-[10px] uppercase tracking-widest mb-1.5 cursor-help" style={{ color: C.muted }}>Ulubieni</div></Tip>
              <div className="grid grid-cols-2 gap-1.5">{team.heroPicks.slice(0, 4).map(h => <Tip key={h.heroId} content={`${heroName(h.heroId)} · ${h.wins}-${h.games - h.wins}`}><span className="relative"><HeroImg heroId={h.heroId} className="w-full aspect-video rounded-md" /><span className="absolute bottom-0 inset-x-0 text-center text-[10px] font-bold text-white bg-black/60 rounded-b-md">{h.games}×</span></span></Tip>)}</div>
            </div>
            <div>
              <Tip content="Bohaterowie najczęściej banowani przeciwko tej drużynie — rywale się ich boją"><div className="text-[10px] uppercase tracking-widest mb-1.5 cursor-help" style={{ color: C.muted }}>Banowani przeciw nim</div></Tip>
              <div className="grid grid-cols-2 gap-1.5">{team.bansAgainst.slice(0, 4).map(h => <Tip key={h.heroId} content={`${heroName(h.heroId)} · ${h.count}× ban`}><span className="relative"><HeroImg heroId={h.heroId} className="w-full aspect-video rounded-md grayscale-[40%]" /><span className="absolute bottom-0 inset-x-0 text-center text-[10px] font-bold text-white bg-black/60 rounded-b-md">{h.count}×</span></span></Tip>)}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D07Fingerprints() {
  return <LabView><WithModel>{m => <Fingerprints model={m} />}</WithModel></LabView>;
}
