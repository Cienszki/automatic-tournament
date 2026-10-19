'use client';

// #70 — Team dossier. The team version of the player dossier: pick a team and see its identity
// card (record, Elo, form), the roster with each player's performance, every series it played,
// its hero pool, the heroes opponents ban against it, and its best and worst opponents.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { eloTable } from '@/lib/stats-lab/teasers';
import { ROLE_LABEL, POS_OF, fmtDay, gamesOf } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, TeamPicker, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, wrColor } from '../kit';

function TeamDossier({ model }: { model: Model }) {
  const font = useHeaderFont();
  const elo = useMemo(() => eloTable(model), [model]);
  const [teamId, setTeam] = useState<string | null>(elo[0]?.t.id ?? null);
  const t: TeamX | undefined = model.teamById.get(teamId ?? '') ?? model.teams[0];
  const series = useMemo(() => t ? model.ds.matches.filter(m => (m.teamA === t.id || m.teamB === t.id) && gamesOf(model, m.id).length).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)) : [], [model, t]);
  const opp = useMemo(() => {
    const m = new Map<string, { o: TeamX; w: number; l: number }>();
    for (const g of t?.games ?? []) { const oid = g.radiant === t!.id ? g.dire : g.radiant; const o = model.teamById.get(oid); if (!o) continue; const r = m.get(oid) ?? { o, w: 0, l: 0 }; g.winnerId === t!.id ? r.w++ : r.l++; m.set(oid, r); }
    return [...m.values()];
  }, [model, t]);
  const [serRef, serFit] = useFitCount<HTMLDivElement>(44, 4, 3);
  if (!t) return <LabTitle>Dossier drużyny</LabTitle>;
  const eloRank = elo.findIndex(e => e.t.id === t.id);
  const roster = [...t.players].filter(p => p.games > 0).sort((a, b) => Number(!!a.standin) - Number(!!b.standin) || (POS_OF[a.role ?? ''] ?? 9) - (POS_OF[b.role ?? ''] ?? 9)).slice(0, 7);
  const best = [...opp].filter(x => x.w > 0).sort((a, b) => b.w - b.l - (a.w - a.l) || b.w - a.w)[0];
  const worst = [...opp].filter(x => x.l > 0).sort((a, b) => b.l - b.w - (a.l - a.w) || b.l - a.l)[0];

  return (
    <>
      <LabTitle sub={<span>wybierz drużynę</span>}>Dossier drużyny</LabTitle>
      <TeamPicker className="shrink-0 mt-2" teams={model.teams} value={t.id} onChange={id => id && setTeam(id)} size={38} />
      <AnimatePresence mode="wait">
        <motion.div key={t.id} className="flex-1 min-h-0 grid grid-cols-[1fr_1.05fr_0.95fr] gap-4 mt-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {/* identity + roster */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="rounded-3xl p-4 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${mix(C.primary, 40)}, ${ink(3)})`, border: `1px solid ${ink(10)}` }}>
              <TeamLogo team={t} size={96} />
              <div className="min-w-0">
                <div className="text-2xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{t.name}</div>
                <div className="flex gap-4 mt-1.5">
                  <Tip content="Gry wygrane–przegrane"><div className="cursor-help"><div className="text-xl font-bold tabular-nums" style={{ color: wrColor(t.wr) }}>{t.wins}–{t.losses}</div><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>gry</div></div></Tip>
                  <Tip content="Mecze: wygrane–remisy–porażki"><div className="cursor-help"><div className="text-xl font-bold tabular-nums" style={{ color: C.heading }}>{t.series.w}–{t.series.d}–{t.series.l}</div><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>mecze</div></div></Tip>
                  <Tip content="Ranking Elo ligi"><div className="cursor-help"><div className="text-xl font-bold tabular-nums" style={{ color: C.heading }}>{Math.round(elo[eloRank]?.v ?? 1500)}</div><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Elo · #{eloRank + 1}</div></div></Tip>
                </div>
                <div className="flex gap-1 mt-2">{t.form.slice(-12).map((w, i) => <span key={i} className="w-3 h-4 rounded-sm" style={{ background: w ? C.win : C.loss }} />)}</div>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col gap-1.5">
              {roster.slice(0, 6).map(p => (
                <Tip key={p.id} content={<TipBody title={p.name}>{p.games} gier · {Math.round(p.wr * 100)}% wygranych{p.heroes[0] ? ` · najczęściej ${heroName(p.heroes[0].heroId)}` : ''}</TipBody>}>
                  <div className="flex-1 min-h-0 max-h-[60px] flex items-center gap-3 rounded-xl px-2.5 cursor-help overflow-hidden" style={{ background: ink(4) }}>
                    <Avatar player={p} size={40} />
                    <span className="flex-1 min-w-0"><span className="block truncate font-bold">{p.name}</span><span className="block text-[11px]" style={{ color: C.muted }}>{p.standin ? 'stand-in' : p.role ? ROLE_LABEL[p.role] : '—'} · {p.games} gier</span></span>
                    {p.heroes[0] && <HeroImg heroId={p.heroes[0].heroId} className="rounded" style={{ width: 52, height: 29 }} />}
                    <span className="w-12 text-right text-lg font-bold tabular-nums" style={{ color: C.heading }}>{p.agg.score.avg != null ? p.agg.score.avg.toFixed(1) : '–'}</span>
                  </div>
                </Tip>
              ))}
            </div>
          </div>
          {/* series */}
          <div className="flex flex-col min-h-0">
            <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5 shrink-0" style={{ color: C.muted }}>Mecze · {series.length}</div>
            <div ref={serRef} className="flex-1 min-h-0 flex flex-col gap-1">
              {series.slice(0, serFit).map(m => {
                const home = m.teamA === t.id; const o = model.teamById.get(home ? m.teamB : m.teamA);
                const my = home ? m.scoreA : m.scoreB; const their = home ? m.scoreB : m.scoreA;
                const res = my > their ? 'W' : my < their ? 'P' : 'R';
                const gs = gamesOf(model, m.id);
                return (
                  <Tip key={m.id} content={<TipBody title={`vs ${o?.name}`}>{gs.map((g, k) => `Gra ${k + 1}: ${g.winnerId === t.id ? 'wygrana' : 'porażka'} (${fmtClock(g.duration)})`).join(' · ')}</TipBody>}>
                    <div className="h-[44px] shrink-0 flex items-center gap-2.5 rounded-xl px-2.5 cursor-help" style={{ background: ink(4) }}>
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: res === 'W' ? C.win : res === 'P' ? C.loss : '#777' }}>{res}</span>
                      <TeamLogo team={o} size={28} />
                      <span className="flex-1 min-w-0 truncate text-sm font-bold">{o?.name}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: C.heading }}>{my}:{their}</span>
                      <span className="w-14 text-right text-[11px]" style={{ color: C.muted }}>{gs[0] ? fmtDay(gs[0].start) : ''}</span>
                    </div>
                  </Tip>
                );
              })}
            </div>
          </div>
          {/* heroes + opponents */}
          <div className="flex flex-col gap-3 min-h-0">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: C.muted }}>Pula bohaterów</div>
              <div className="grid grid-cols-4 gap-1.5">
                {t.heroPicks.slice(0, 8).map(h => (
                  <Tip key={h.heroId} content={<TipBody title={heroName(h.heroId)}>{h.games} gier · {h.wins} wygranych</TipBody>}>
                    <div className="relative rounded-lg overflow-hidden cursor-help"><HeroImg heroId={h.heroId} className="w-full aspect-video" /><span className="absolute bottom-0 inset-x-0 text-center text-[11px] font-bold bg-black/70 text-white">{h.wins}–{h.games - h.wins}</span></div>
                  </Tip>
                ))}
              </div>
            </div>
            <div>
              <Tip content="Bohaterowie najczęściej banowani przez rywali przeciwko tej drużynie"><div className="text-[10px] uppercase tracking-[0.3em] mb-1.5 cursor-help inline-block" style={{ color: C.muted }}>Rywale się boją</div></Tip>
              <div className="flex gap-1.5">{t.bansAgainst.slice(0, 5).map(b => <Tip key={b.heroId} content={`${heroName(b.heroId)} · ${b.count} banów`}><span className="relative"><HeroImg heroId={b.heroId} className="rounded-md" style={{ width: 64, height: 36, filter: 'grayscale(0.6)' }} /><span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold px-1 rounded bg-black text-white">{b.count}</span></span></Tip>)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-auto">
              {[{ x: best, label: 'Ulubiony rywal', good: true }, { x: worst, label: 'Zmora', good: false }].map(({ x, label, good }) => x && (
                <div key={label} className="rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center" style={{ background: mix(good ? C.win : C.loss, 14), border: `1px solid ${mix(good ? C.win : C.loss, 35)}` }}>
                  <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: good ? C.win : C.loss }}>{label}</div>
                  <TeamLogo team={x.o} size={60} />
                  <div className="text-sm font-bold truncate max-w-full" style={{ color: C.heading }}>{x.o.name}</div>
                  <div className="text-lg font-bold tabular-nums" style={{ color: C.heading }}>{x.w}–{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default function D70TeamDossier() {
  return <LabView><WithModel>{m => <TeamDossier model={m} />}</WithModel></LabView>;
}
