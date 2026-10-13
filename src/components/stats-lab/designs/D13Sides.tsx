'use client';

// #13 — War of the sides. The view is split like the Dota map: Radiant bottom-left, Dire
// top-right, with the river pushed toward the side that wins less. Each half carries its numbers
// and side-specialist heroes; the track below places every team by where it does better.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model, TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock, fmtPct } from '@/lib/stats-lab/metrics';
import { C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, mix, useHeaderFont, useSize } from '../kit';

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function sideStats(model: Model) {
  const gs = model.games;
  const parsed = gs.filter(g => g.parsed);
  const side = (radiant: boolean) => {
    const sum = (list: typeof gs, f: (p: (typeof gs)[number]['perfs'][number]) => number) => mean(list.map(g => g.perfs.filter(p => p.radiant === radiant).reduce((s, p) => s + f(p), 0)));
    const wins = gs.filter(g => g.radiantWin === radiant);
    const fb = parsed.filter(g => g.fbPerf);
    return {
      wins: wins.length,
      wr: gs.length ? wins.length / gs.length : 0,
      kills: sum(gs, p => p.kills),
      fb: fb.length ? fb.filter(g => g.fbPerf!.radiant === radiant).length / fb.length : 0,
      winDur: mean(wins.map(g => g.duration)),
      rosh: sum(parsed, p => p.roshanKills),
      towers: sum(parsed, p => p.towerKills),
      wards: sum(parsed, p => p.obsPlaced + p.senPlaced),
      nw: sum(gs, p => p.netWorth),
    };
  };
  const minPicks = 4;
  const heroes = model.heroes.filter(h => h.radiant.picks >= minPicks / 2 && h.dire.picks >= minPicks / 2)
    .map(h => ({ h, diff: h.radiant.wins / h.radiant.picks - h.dire.wins / h.dire.picks }));
  return {
    R: side(true), D: side(false),
    radiantHeroes: [...heroes].sort((a, b) => b.diff - a.diff).slice(0, 4),
    direHeroes: [...heroes].sort((a, b) => a.diff - b.diff).slice(0, 4),
  };
}

function StatLine({ label, value, desc, align }: { label: string; value: string; desc: string; align: 'left' | 'right' }) {
  const font = useHeaderFont();
  return (
    <Tip content={desc}>
      <div className={`flex items-baseline gap-2 cursor-help ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
        <span className="text-xl font-logik-extended-bold tabular-nums" style={font}>{value}</span>
        <span className="text-[10px] uppercase tracking-widest opacity-70">{label}</span>
      </div>
    </Tip>
  );
}

function Sides({ model }: { model: Model }) {
  const font = useHeaderFont();
  const s = useMemo(() => sideStats(model), [model]);
  const [hoverTeam, setHoverTeam] = useState<TeamX | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const shift = -(s.R.wr - 0.5) * 140; // % — river moves toward the weaker side
  const teams = useMemo(() => model.teams.filter(t => t.radiant.games >= 2 && t.dire.games >= 2)
    .map(t => ({ t, rwr: t.radiant.wins / t.radiant.games, dwr: t.dire.wins / t.dire.games }))
    .map(x => ({ ...x, diff: x.rwr - x.dwr })), [model]);

  const block = (radiant: boolean) => {
    const v = radiant ? s.R : s.D;
    const o = radiant ? s.D : s.R;
    const align = radiant ? 'left' : 'right';
    const color = radiant ? C.radiant : C.dire;
    const name = radiant ? 'Radiant' : 'Dire';
    const heroes = radiant ? s.radiantHeroes : s.direHeroes;
    return (
      <motion.div initial={{ opacity: 0, x: radiant ? -30 : 30 }} animate={{ opacity: 1, x: 0 }} className={`absolute flex flex-col gap-1.5 text-white ${radiant ? 'left-6 bottom-5 items-start' : 'right-6 top-5 items-end'}`}>
        <div className="text-[11px] uppercase tracking-[0.4em] opacity-80" style={{ color }}>{name}</div>
        <Tip content={`${name} wygrał ${v.wins} z ${model.games.length} gier`}>
          <div className="font-logik-extended-bold leading-none tabular-nums cursor-help" style={{ fontSize: 'clamp(48px, 9vh, 96px)', color, ...font }}>{fmtPct(v.wr)}</div>
        </Tip>
        <StatLine align={align} label="zabójstw / grę" value={v.kills.toFixed(1)} desc={`Średnio zabójstw strony ${name} (rywal: ${o.kills.toFixed(1)})`} />
        <StatLine align={align} label="pierwsza krew" value={fmtPct(v.fb)} desc={`Jak często ${name} zdobywa pierwszą krew`} />
        <StatLine align={align} label="czas wygranej" value={fmtClock(v.winDur)} desc={`Średni czas gry, którą wygrał ${name}`} />
        <StatLine align={align} label="wieże / grę" value={v.towers.toFixed(1)} desc={`Wieże zniszczone przez ${name} na grę`} />
        <StatLine align={align} label="roshany / grę" value={v.rosh.toFixed(2)} desc={`Roshany zabite przez ${name} na grę`} />
        <StatLine align={align} label="wardy / grę" value={v.wards.toFixed(1)} desc={`Wardy postawione przez ${name} na grę`} />
        {heroes.length > 0 && (
          <div className={`flex gap-1 mt-1 ${radiant ? '' : 'flex-row-reverse'}`}>
            {heroes.map(({ h, diff }) => (
              <Tip key={h.heroId} content={<TipBody title={heroName(h.heroId)}>Radiant {h.radiant.wins}/{h.radiant.picks} · Dire {h.dire.wins}/{h.dire.picks} — {Math.round(Math.abs(diff) * 100)} pkt % lepiej jako {name}</TipBody>}>
                <span><HeroImg heroId={h.heroId} className="w-12 h-7 rounded" style={{ boxShadow: `0 0 0 1.5px ${color}` }} /></span>
              </Tip>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  const W = size.w; const H = size.h;
  const y0 = (shift / 100) * H; const y1 = H + (shift / 100) * H;

  return (
    <>
      <LabTitle sub={<span>{model.games.length} gier</span>}>Wojna stron</LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-3 rounded-3xl overflow-hidden" style={{ background: '#0b0d0c' }}>
        <motion.div className="absolute inset-0" initial={false} animate={{ clipPath: `polygon(0% ${shift}%, 100% ${100 + shift}%, 100% 100%, 0% 100%)` }} transition={{ duration: 1.2 }}
          style={{ background: `radial-gradient(ellipse at 0% 100%, ${mix(C.radiant, 45)}, ${mix(C.radiant, 8)} 70%)` }} />
        <motion.div className="absolute inset-0" initial={false} animate={{ clipPath: `polygon(0% 0%, 100% 0%, 100% ${100 + shift}%, 0% ${shift}%)` }} transition={{ duration: 1.2 }}
          style={{ background: `radial-gradient(ellipse at 100% 0%, ${mix(C.dire, 45)}, ${mix(C.dire, 8)} 70%)` }} />
        {W > 0 && (
          <svg width={W} height={H} className="absolute inset-0 pointer-events-none">
            <line x1={0} y1={y0} x2={W} y2={y1} stroke="#7fc8ff" strokeOpacity={0.6} strokeWidth={10} style={{ filter: 'blur(6px)' }} />
            <line x1={0} y1={y0} x2={W} y2={y1} stroke="#bfe6ff" strokeOpacity={0.8} strokeWidth={2} />
          </svg>
        )}
        <Tip content={`Rzeka przesuwa się w stronę słabszej strony: Radiant ${fmtPct(s.R.wr)} · Dire ${fmtPct(s.D.wr)}`}>
          <div className="absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80 bg-black/50 cursor-help" style={{ top: `calc(${50 + shift}% - 12px)` }}>rzeka</div>
        </Tip>
        {block(true)}
        {block(false)}
      </div>

      {/* Team tug-of-war track */}
      <div className="shrink-0 mt-3 relative h-[58px]" onMouseLeave={() => setHoverTeam(null)}>
        <div className="absolute left-0 right-0 top-[27px] h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${C.dire}, rgba(255,255,255,0.15), ${C.radiant})` }} />
        <span className="absolute left-0 top-[38px] text-[9px] uppercase tracking-widest" style={{ color: C.dire }}>lepsi jako Dire</span>
        <span className="absolute right-0 top-[38px] text-[9px] uppercase tracking-widest" style={{ color: C.radiant }}>lepsi jako Radiant</span>
        {teams.map(({ t, rwr, dwr, diff }, i) => (
          <Tip key={t.id} content={<TipBody title={t.name}>Radiant {t.radiant.wins}/{t.radiant.games} ({fmtPct(rwr)}) · Dire {t.dire.wins}/{t.dire.games} ({fmtPct(dwr)})</TipBody>}>
            <motion.div className="absolute" initial={{ left: '50%' }} animate={{ left: `calc(${50 + diff * 50}% - 13px)` }} transition={{ type: 'spring', stiffness: 80, damping: 15, delay: i * 0.02 }}
              style={{ top: i % 2 ? 0 : 30, zIndex: hoverTeam?.id === t.id ? 10 : 1 }} onMouseEnter={() => setHoverTeam(t)}>
              <TeamLogo team={t} size={26} className="hover:scale-150 transition-transform" />
            </motion.div>
          </Tip>
        ))}
      </div>
    </>
  );
}

export default function D13Sides() {
  return <LabView><WithModel>{m => <Sides model={m} />}</WithModel></LabView>;
}
