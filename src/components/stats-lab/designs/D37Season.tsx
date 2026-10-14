'use client';

// #37 — Season. The tournament week by week: pick a week on the timeline (dot size = games
// played) and see its player of the week, game of the week, the biggest climber in the Elo
// ranking and the all-time records set that week (rotating every 5 s when there are several).
// Every card opens its full page.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameX, Model, Perf, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { metric, fmtClock, type MetricKey } from '@/lib/stats-lab/metrics';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, WithModel, ink, mix, onDark, useHeaderFont } from '../kit';
import { useExpander } from '../hub';

const ROTATE_MS = 5000;
const REC_KEYS: MetricKey[] = ['kills', 'assists', 'gpm', 'xpm', 'heroDamage', 'lastHits', 'wards', 'stacks', 'netWorth', 'score'];
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
function mondayOf(unix: number) {
  const d = new Date(dayFmt.format(new Date(unix * 1000)) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const fmtShort = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

interface Week {
  key: string;
  games: GameX[];
  player?: { p: PlayerX; avg: number; n: number };
  game?: GameX;
  mover?: { t: TeamX; gain: number };
  records: Array<{ k: MetricKey; perf: Perf; value: number }>;
}

function buildWeeks(model: Model): Week[] {
  const map = new Map<string, GameX[]>();
  for (const g of model.games) { const k = mondayOf(g.start); if (!map.has(k)) map.set(k, []); map.get(k)!.push(g); }
  // All-time record breaks, tagged by week
  const breaks: Array<{ k: MetricKey; perf: Perf; value: number; week: string }> = [];
  for (const k of REC_KEYS) {
    const m = metric(k); let cur = -Infinity;
    for (const p of [...model.perfs].filter(x => x.player && (!m.parsedOnly || x.parsed) && Number.isFinite(m.get(x))).sort((a, b) => a.game.start - b.game.start)) {
      const v = m.get(p); if (v > cur) { cur = v; breaks.push({ k, perf: p, value: v, week: mondayOf(p.game.start) }); }
    }
  }
  // Elo through the season
  const elo = new Map(model.teams.map(t => [t.id, 1500]));
  const weeks: Week[] = [];
  for (const [key, games] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const before = new Map(elo);
    for (const g of games) {
      const a = elo.get(g.radiant) ?? 1500; const b = elo.get(g.dire) ?? 1500;
      const e = 1 / (1 + Math.pow(10, (b - a) / 400)); const s = g.radiantWin ? 1 : 0;
      elo.set(g.radiant, a + 32 * (s - e)); elo.set(g.dire, b + 32 * ((1 - s) - (1 - e)));
    }
    const moverId = [...elo.keys()].sort((x, y) => ((elo.get(y)! - before.get(y)!) - (elo.get(x)! - before.get(x)!)))[0];
    const scores = new Map<string, number[]>();
    for (const g of games) for (const p of g.perfs) if (p.player && Number.isFinite(p.score)) scores.set(p.pid, [...(scores.get(p.pid) ?? []), p.score]);
    const best = [...scores.entries()].map(([pid, s]) => ({ p: model.playerById.get(pid)!, avg: s.reduce((a, b) => a + b, 0) / s.length, n: s.length }))
      .sort((a, b) => (b.n >= 2 ? 1 : 0) - (a.n >= 2 ? 1 : 0) || b.avg - a.avg)[0];
    const game = [...games].sort((a, b) => (b.mvp?.score ?? 0) - (a.mvp?.score ?? 0))[0];
    weeks.push({
      key, games, player: best, game,
      mover: moverId ? { t: model.teamById.get(moverId)!, gain: elo.get(moverId)! - before.get(moverId)! } : undefined,
      records: breaks.filter(b => b.week === key).sort((a, b) => b.perf.game.start - a.perf.game.start),
    });
  }
  return weeks;
}

function Card({ kicker, onOpen, children, heroId, delay }: { kicker: string; onOpen: () => void; children: React.ReactNode; heroId?: number; delay: number }) {
  return (
    <motion.button type="button" onClick={onOpen} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      whileHover={{ y: -4 }} className="group relative rounded-2xl overflow-hidden text-left text-white min-h-0 flex flex-col" style={{ background: '#0b0b10', boxShadow: `0 0 0 1px ${ink(10)}` }}>
      {heroId != null && <HeroImg heroId={heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-45" />}
      {heroId != null && <div className="absolute top-8 bottom-[38%] left-0 right-0"><HeroRender heroId={heroId} sizes="300px" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10" />
      <div className="relative p-4 text-[11px] uppercase tracking-[0.3em] text-white/75">{kicker}</div>
      <div className="relative flex-1" />
      <div className="relative p-4 flex flex-col gap-1.5">{children}</div>
      <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: C.primary }}>Otwórz</span>
    </motion.button>
  );
}

function Season({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { open, node, isOpen } = useExpander();
  const weeks = useMemo(() => buildWeeks(model), [model]);
  const [wi, setWi] = useState(weeks.length - 1);
  const [ri, setRi] = useState(0);
  const w = weeks[wi];
  useEffect(() => { setRi(0); }, [wi]);
  useEffect(() => {
    if (isOpen || !w || w.records.length < 2) return;
    const t = setTimeout(() => setRi(x => (x + 1) % w.records.length), ROTATE_MS);
    return () => clearTimeout(t);
  }, [ri, w, isOpen]);
  if (!w) return null;
  const maxGames = Math.max(...weeks.map(x => x.games.length));
  const rec = w.records[ri % Math.max(1, w.records.length)];
  const accent = onDark(C.secondary);

  return (
    <div className="relative h-full w-full">
      <LabView>
        <LabTitle sub={<span>tydzień od {fmtShort(w.key)} · {w.games.length} gier</span>}>Sezon tydzień po tygodniu</LabTitle>
        {/* Timeline */}
        <div className="shrink-0 relative mt-5 mb-2 h-[86px]">
          <div className="absolute left-0 right-0 top-[30px] h-[3px] rounded-full" style={{ background: ink(12) }} />
          <motion.div className="absolute left-0 top-[30px] h-[3px] rounded-full" style={{ background: C.primary }} animate={{ width: `${(wi / Math.max(1, weeks.length - 1)) * 100}%` }} />
          {weeks.map((x, k) => {
            const on = k === wi;
            const d = 16 + (x.games.length / maxGames) * 22;
            return (
              <button key={x.key} type="button" onClick={() => setWi(k)} className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${weeks.length > 1 ? (k / (weeks.length - 1)) * 96 + 2 : 50}%`, top: 31 - d / 2 }}>
                <span className="rounded-full transition-all flex items-center justify-center text-[11px] font-bold" style={{ width: d, height: d, background: on ? C.secondary : k < wi ? C.primary : ink(20), color: on ? '#000' : '#fff', boxShadow: on ? `0 0 0 4px ${mix(C.secondary, 30)}, 0 0 18px ${C.secondary}` : undefined }}>{x.games.length}</span>
                <span className="mt-1.5 text-xs font-semibold whitespace-nowrap" style={{ color: on ? C.text : C.muted }}>{fmtShort(x.key)}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={w.key} className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {w.player && (
              <Card kicker="Gracz tygodnia" onOpen={() => open(15)} heroId={w.player.p.heroes[0]?.heroId} delay={0}>
                <Avatar player={w.player.p} size={72} ring={accent} />
                <div className="text-2xl font-logik-extended-bold uppercase leading-tight truncate" style={font}>{w.player.p.name}</div>
                <div className="text-sm text-white/75"><b className="text-xl tabular-nums" style={{ color: accent }}>{w.player.avg.toFixed(1)}</b> pkt / grę · {w.player.n} {w.player.n === 1 ? 'gra' : 'gry'}</div>
              </Card>
            )}
            {w.game && (
              <Card kicker="Gra tygodnia" onOpen={() => open(6)} heroId={w.game.mvp?.heroId} delay={0.05}>
                <div className="flex items-center gap-3">
                  <span className="rounded-xl p-1.5 bg-white/15"><TeamLogo team={w.game.radiantTeam} size={48} /></span><span className="text-white/50 text-sm">vs</span><span className="rounded-xl p-1.5 bg-white/15"><TeamLogo team={w.game.direTeam} size={48} /></span>
                </div>
                <div className="text-lg font-bold leading-tight">{(w.game.radiantWin ? w.game.radiantTeam : w.game.direTeam)?.name} wygrywa</div>
                <div className="text-sm text-white/75">{w.game.radiantKills}:{w.game.direKills} · {fmtClock(w.game.duration)}{w.game.mvp?.player ? ` · MVP ${w.game.mvp.player.name} (${heroName(w.game.mvp.heroId)})` : ''}</div>
              </Card>
            )}
            <Card kicker={w.records.length ? `Rekordy tygodnia · ${w.records.length}` : 'Rekordy tygodnia'} onOpen={() => open(26)} heroId={rec?.perf.heroId} delay={0.1}>
              <AnimatePresence mode="wait">
                {rec ? (
                  <motion.div key={`${rec.k}-${rec.perf.idx}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-1.5">
                    <div className="text-xs uppercase tracking-widest" style={{ color: accent }}>{metric(rec.k).label}</div>
                    <div className="text-5xl font-logik-extended-bold tabular-nums leading-none" style={font}>{metric(rec.k).fmt(rec.value)}</div>
                    <div className="flex items-center gap-2"><Avatar player={rec.perf.player} size={44} ring={accent} /><span className="text-lg font-bold truncate">{rec.perf.player?.name}</span></div>
                  </motion.div>
                ) : <div className="text-sm text-white/70">W tym tygodniu żaden rekord nie padł.</div>}
              </AnimatePresence>
              {w.records.length > 1 && (
                <div className="flex gap-1 mt-1">{w.records.map((_, k) => <span key={k} className="h-1 flex-1 rounded-full" style={{ background: k === ri ? accent : 'rgba(255,255,255,0.2)' }} />)}</div>
              )}
            </Card>
            {w.mover && (
              <Card kicker="Awans tygodnia (Elo)" onOpen={() => open(23)} heroId={w.mover.t.heroPicks[0]?.heroId} delay={0.15}>
                <span className="self-start rounded-xl p-1.5 bg-white/15"><TeamLogo team={w.mover.t} size={72} /></span>
                <div className="text-2xl font-logik-extended-bold uppercase leading-tight" style={font}>{w.mover.t.name}</div>
                <div className="text-sm text-white/75"><b className="text-xl tabular-nums" style={{ color: C.win }}>+{Math.round(w.mover.gain)}</b> punktów Elo w tygodniu</div>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </LabView>
      {node}
    </div>
  );
}

export default function D37Season() {
  return <div className="h-full w-full flex flex-col"><WithModel>{m => <Season model={m} />}</WithModel></div>;
}
