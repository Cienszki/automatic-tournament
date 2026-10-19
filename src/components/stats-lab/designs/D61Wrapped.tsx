'use client';

// #61 — Your season. A "Wrapped" for any player: pick a team and a player, and their season plays
// as story slides — hours in game, their hero, best game, superpower (best percentile), nemesis
// team, best teammate and the final ranking. Tap the right half for next, left for back; it
// advances by itself unless the mouse is on it.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { opponentOf, pctRank } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { fmtDay, plural, qualified, scored } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, TeamPicker, WithModel, mix, useHeaderFont } from '../kit';

const SLIDE_MS = 6000;
const POWERS: MetricKey[] = ['kills', 'assists', 'kda', 'kp', 'gpm', 'xpm', 'lastHits', 'hdpm', 'heroHealing', 'towerDamage', 'wards', 'dewards', 'stacks', 'runes'];
const BG = ['#7b2ff7', '#f107a3', '#ff6a2b', '#00b894', '#0984e3', '#e84393', '#fdcb6e'];

interface Slide { id: string; kicker: string; big: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; heroId?: number; visual?: React.ReactNode }

function slidesFor(model: Model, p: PlayerX): Slide[] {
  const s: Slide[] = [];
  const hours = p.perfs.reduce((a, x) => a + x.game.duration, 0) / 3600;
  s.push({ id: 'intro', kicker: 'Twój sezon', big: `${p.games}`, title: plural(p.games, 'gra', 'gry', 'gier'), sub: `${hours.toFixed(1)} godziny w grze · ${p.wins} wygranych`, visual: <Avatar player={p} size={150} ring="#fff" /> });
  const h = p.heroes[0];
  if (h) s.push({ id: 'hero', kicker: 'Twój bohater', big: heroName(h.heroId), title: `${h.games} ${plural(h.games, 'gra', 'gry', 'gier')} · ${h.wins} ${plural(h.wins, 'wygrana', 'wygrane', 'wygranych')}`, sub: `to ${Math.round((h.games / p.games) * 100)}% wszystkich Twoich gier`, heroId: h.heroId });
  const best = scored(p.perfs).sort((a, b) => b.score - a.score)[0];
  if (best) s.push({ id: 'best', kicker: 'Twoja najlepsza gra', big: `${best.kills}/${best.deaths}/${best.assists}`, title: `${heroName(best.heroId)} vs ${opponentOf(best)?.name ?? '?'}`, sub: `${best.score.toFixed(1)} pkt występu · ${fmtDay(best.game.start)} · ${best.win ? 'wygrana' : 'porażka'}`, heroId: best.heroId });
  const q = model.players.filter(x => x.games >= model.minGames);
  const powers = POWERS.map(k => {
    const a = p.agg[k]; if (a.avg == null || a.n < 2) return null;
    const pool = q.map(x => x.agg[k].avg).filter((v): v is number => v != null);
    return { k, pr: pctRank(pool, a.avg), v: a.avg };
  }).filter((x): x is { k: MetricKey; pr: number; v: number } => !!x).sort((a, b) => b.pr - a.pr);
  if (powers[0]) {
    const m = metric(powers[0].k);
    s.push({ id: 'power', kicker: 'Twoja supermoc', big: m.label, title: `lepiej niż ${Math.round(powers[0].pr * 100)}% graczy`, sub: `średnio ${m.key === 'kp' ? m.fmt(powers[0].v) : powers[0].v.toFixed(m.avgDigits)} na grę`, heroId: (p.agg[powers[0].k].best ?? best)?.heroId });
  }
  const vs = new Map<string, { t: TeamX; w: number; l: number }>();
  for (const x of p.perfs) { const o = opponentOf(x); if (!o) continue; const r = vs.get(o.id) ?? { t: o, w: 0, l: 0 }; x.win ? r.w++ : r.l++; vs.set(o.id, r); }
  const nemesis = [...vs.values()].sort((a, b) => b.l - a.l || a.w - b.w)[0];
  if (nemesis && nemesis.l > 0) s.push({ id: 'nemesis', kicker: 'Twoja zmora', big: `${nemesis.w}–${nemesis.l}`, title: nemesis.t.name, sub: 'z nikim nie przegrałeś więcej razy', visual: <TeamLogo team={nemesis.t} size={150} /> });
  const mates = new Map<string, { m: PlayerX; n: number; w: number }>();
  for (const x of p.perfs) for (const o of x.game.perfs) if (o.radiant === x.radiant && o.pid !== p.id && o.player) { const r = mates.get(o.pid) ?? { m: o.player, n: 0, w: 0 }; r.n++; if (x.win) r.w++; mates.set(o.pid, r); }
  const mate = [...mates.values()].filter(r => r.n >= 3).sort((a, b) => (b.w + 1) / (b.n + 2) - (a.w + 1) / (a.n + 2))[0];
  if (mate) s.push({ id: 'mate', kicker: 'Twój najlepszy partner', big: `${Math.round((mate.w / mate.n) * 100)}%`, title: mate.m.name, sub: `wygranych w ${mate.n} wspólnych grach`, visual: <div className="flex -space-x-8"><Avatar player={p} size={120} ring="#fff" /><Avatar player={mate.m} size={120} ring="#fff" /></div> });
  const ranked = qualified(model).sort((a, b) => (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0));
  const place = ranked.findIndex(x => x.id === p.id);
  s.push({ id: 'end', kicker: 'Podsumowanie', big: place >= 0 ? `#${place + 1}` : `${p.wins}–${p.losses}`, title: place >= 0 ? `z ${ranked.length} w rankingu punktów występu` : 'bilans gier w sezonie', sub: place >= 0 ? `${(p.agg.score.avg ?? 0).toFixed(2)} pkt na grę · ${p.wins}–${p.losses}` : 'za mało gier, by wejść do rankingu',
    visual: <div className="flex gap-1 flex-wrap justify-center max-w-[260px]">{p.perfs.slice(-20).map(x => <span key={x.idx} className="w-3 h-5 rounded-sm" style={{ background: x.win ? '#3fbf7f' : '#e5534b' }} />)}</div> });
  return s;
}

function Wrapped({ model }: { model: Model }) {
  const font = useHeaderFont();
  const teams = useMemo(() => model.teams.filter(t => t.players.length > 0), [model]);
  // start on the season's best player
  const star = useMemo(() => qualified(model).sort((a, b) => (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0))[0], [model]);
  const [teamId, setTeam] = useState<string | null>(star?.teamId ?? teams[0]?.id ?? null);
  const team = teams.find(t => t.id === teamId) ?? teams[0];
  const roster = useMemo(() => (team?.players ?? []).filter(p => p.games > 0).slice(0, 8), [team]);
  const [pid, setPid] = useState<string | null>(star?.id ?? null);
  const player = roster.find(p => p.id === pid) ?? roster[0];
  const slides = useMemo(() => (player ? slidesFor(model, player) : []), [model, player]);
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => { setI(0); }, [player]);
  useEffect(() => {
    if (hold || !slides.length) return;
    const t = setTimeout(() => setI(x => (x + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, hold, slides.length]);
  const sl = slides[Math.min(i, slides.length - 1)];
  const color = BG[i % BG.length];

  return (
    <>
      <LabTitle sub={<span>wybierz drużynę i gracza · kliknij prawą stronę historii, by przejść dalej</span>}>Twój sezon</LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        {/* chooser */}
        <div className="w-[34%] shrink-0 flex flex-col gap-4 min-h-0">
          <TeamPicker teams={teams} value={team?.id ?? null} onChange={id => { if (id) { setTeam(id); setPid(null); } }} size={40} rows={3} />
          <div className="grid grid-cols-4 gap-3">
            {roster.map(p => {
              const on = p.id === player?.id;
              return (
                <button key={p.id} type="button" onClick={() => setPid(p.id)} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-all"
                  style={{ background: on ? mix(C.primary, 40) : 'transparent', boxShadow: on ? `0 0 0 2px ${C.secondary}` : undefined }}>
                  <Avatar player={p} size={72} />
                  <span className="text-xs font-bold truncate max-w-full" style={{ color: C.heading }}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* story */}
        <div className="flex-1 min-w-0 flex items-center justify-center min-h-0">
          {sl && player && (
            <div className="relative h-full aspect-[9/14] max-w-full rounded-[28px] overflow-hidden text-white select-none" style={{ background: '#0b0b10', boxShadow: '0 30px 70px rgba(0,0,0,0.55)' }}
              onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
              <AnimatePresence mode="wait">
                <motion.div key={`${player.id}-${sl.id}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 20%, ${color}, transparent 60%), radial-gradient(circle at 80% 90%, ${BG[(i + 3) % BG.length]}, transparent 55%), #0b0b10` }} />
                  {sl.heroId != null && <motion.div className="absolute inset-x-0 top-[12%] bottom-[38%]" initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }}><HeroRender heroId={sl.heroId} sizes="400px" /></motion.div>}
                  {sl.visual && <motion.div className="absolute inset-x-0 top-[16%] flex justify-center" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}>{sl.visual}</motion.div>}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.85), transparent 55%)' }} />
                  <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col gap-1.5">
                    <motion.div className="text-[11px] uppercase tracking-[0.4em] font-bold" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>{sl.kicker}</motion.div>
                    <motion.div className="font-logik-extended-bold uppercase leading-[0.95] break-words" style={{ fontSize: 'clamp(34px, 6.5vh, 64px)', ...font }} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>{sl.big}</motion.div>
                    <motion.div className="text-xl font-bold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>{sl.title}</motion.div>
                    {sl.sub && <motion.div className="text-sm text-white/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>{sl.sub}</motion.div>}
                  </div>
                </motion.div>
              </AnimatePresence>
              {/* progress */}
              <div className="absolute top-3 inset-x-3 flex gap-1 z-10">
                {slides.map((x, k) => (
                  <div key={x.id} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
                    {k < i && <div className="h-full w-full bg-white" />}
                    {k === i && <motion.div key={`${player.id}-${i}-${hold}`} className="h-full bg-white" initial={{ width: 0 }} animate={{ width: hold ? undefined : '100%' }} transition={{ duration: SLIDE_MS / 1000, ease: 'linear' }} />}
                  </div>
                ))}
              </div>
              <div className="absolute top-7 left-4 flex items-center gap-2 z-10"><Avatar player={player} size={30} ring="#fff" /><span className="text-sm font-bold">{player.name}</span></div>
              <button type="button" aria-label="Poprzedni slajd" className="absolute left-0 top-0 bottom-0 w-1/3 z-10" onClick={() => setI(x => Math.max(0, x - 1))} />
              <button type="button" aria-label="Następny slajd" className="absolute right-0 top-0 bottom-0 w-2/3 z-10" onClick={() => setI(x => (x + 1) % slides.length)} />
            </div>
          )}
        </div>
        {/* slide index */}
        <div className="w-[220px] shrink-0 hidden lg:flex flex-col justify-center gap-1.5">
          {slides.map((x, k) => (
            <button key={x.id} type="button" onClick={() => setI(k)} className="rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-all"
              style={k === i ? { background: C.primary, color: '#fff', boxShadow: `0 0 16px ${mix(C.primary, 45)}` } : { background: mix(C.text, 5), color: C.text }}>
              {x.kicker}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function D61Wrapped() {
  return <LabView><WithModel>{m => <Wrapped model={m} />}</WithModel></LabView>;
}
