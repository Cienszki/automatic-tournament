'use client';

// #10 — Stories. The tournament's best moments as auto-playing story slides: tap the right side
// for next, left for previous, hold to pause (← → keys work too). The strip below jumps anywhere.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { opponentOf, topPerfs, type GameX, type Model, type Perf, type PlayerX, type TeamX } from '@/lib/stats-lab/derive';
import { heroName, heroRender } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabView, TeamLogo, Tip, WithModel, mix, useHeaderFont } from '../kit';

const SLIDE_MS = 6500;

interface Story {
  id: string;
  kicker: string;
  big: string;
  title: string;
  sub?: string;
  heroId?: number;
  player?: PlayerX;
  team?: TeamX;
  game?: GameX;
  /** Extra visual under the text */
  extra?: React.ReactNode;
}

function Versus({ g }: { g: GameX }) {
  return (
    <div className="flex items-center gap-3">
      {[g.radiantTeam, g.direTeam].map((t, i) => {
        const won = (i === 0) === g.radiantWin;
        return (
          <React.Fragment key={i}>
            {i === 1 && <span className="text-xs opacity-50">vs</span>}
            <div className="flex items-center gap-2" style={{ opacity: won ? 1 : 0.55 }}>
              <TeamLogo team={t} size={34} />
              <div><div className="text-sm font-bold">{t?.name}</div><div className="text-[10px] uppercase tracking-widest" style={{ color: won ? C.win : 'rgba(255,255,255,0.5)' }}>{won ? 'wygrana' : 'porażka'} · {i === 0 ? g.radiantKills : g.direKills} K</div></div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function KillBar({ g }: { g: GameX }) {
  const t = g.kills || 1;
  return (
    <div className="w-full max-w-md">
      <div className="flex h-3 rounded-full overflow-hidden">
        <motion.div initial={{ width: '50%' }} animate={{ width: `${(g.radiantKills / t) * 100}%` }} transition={{ duration: 1 }} style={{ background: C.radiant }} />
        <div className="flex-1" style={{ background: C.dire }} />
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-widest mt-1 opacity-60"><span>{g.radiantTeam?.tag || 'Radiant'} {g.radiantKills}</span><span>{g.direKills} {g.direTeam?.tag || 'Dire'}</span></div>
    </div>
  );
}

function perfLine(p: Perf) {
  return `${heroName(p.heroId)} · ${p.kills}/${p.deaths}/${p.assists} · vs ${opponentOf(p)?.name ?? '?'}`;
}

function buildStories(model: Model): Story[] {
  const s: Story[] = [];
  const gs = model.games;
  const byDur = [...gs].sort((a, b) => b.duration - a.duration);
  const longest = byDur[0]; const shortest = byDur[byDur.length - 1];
  const mvpOf = (g: GameX) => g.mvp;

  if (longest) s.push({ id: 'long', kicker: 'Najdłuższa gra', big: fmtClock(longest.duration), title: `${longest.radiantTeam?.name} vs ${longest.direTeam?.name}`, heroId: mvpOf(longest)?.heroId, game: longest, extra: <Versus g={longest} /> });
  if (shortest && shortest !== longest) s.push({ id: 'short', kicker: 'Najszybsze zamknięcie', big: fmtClock(shortest.duration), title: `${(shortest.radiantWin ? shortest.radiantTeam : shortest.direTeam)?.name} — wygrana w rekordowym tempie`, heroId: mvpOf(shortest)?.heroId, game: shortest, extra: <Versus g={shortest} /> });
  const bloody = [...gs].sort((a, b) => b.kills - a.kills)[0];
  if (bloody) s.push({ id: 'blood', kicker: 'Najkrwawsza gra', big: `${bloody.kills}`, title: 'zabójstw w jednej grze', sub: fmtClock(bloody.duration), heroId: mvpOf(bloody)?.heroId, game: bloody, extra: <KillBar g={bloody} /> });
  const calm = [...gs].sort((a, b) => a.kills / a.duration - b.kills / b.duration)[0];
  if (calm && calm !== bloody) s.push({ id: 'calm', kicker: 'Najspokojniejsza gra', big: `${calm.kills}`, title: `zabójstw w ${fmtClock(calm.duration)}`, heroId: mvpOf(calm)?.heroId, game: calm, extra: <KillBar g={calm} /> });
  const fb = gs.filter(g => g.firstBlood >= 15 && g.fbPerf).sort((a, b) => a.firstBlood - b.firstBlood)[0];
  if (fb?.fbPerf) s.push({ id: 'fb', kicker: 'Najszybsza pierwsza krew', big: fmtClock(fb.firstBlood), title: fb.fbPerf.player?.name ?? '—', sub: perfLine(fb.fbPerf), heroId: fb.fbPerf.heroId, player: fb.fbPerf.player, game: fb });
  const stomp = [...gs].sort((a, b) => Math.abs(b.radiantNW - b.direNW) - Math.abs(a.radiantNW - a.direNW))[0];
  if (stomp) s.push({ id: 'stomp', kicker: 'Największa przewaga złota', big: `${Math.round(Math.abs(stomp.radiantNW - stomp.direNW) / 1000)}k`, title: 'różnicy wartości netto na koniec gry', heroId: mvpOf(stomp)?.heroId, game: stomp, extra: <Versus g={stomp} /> });

  const q = model.players.filter(p => p.games >= model.minGames);
  const mvp = [...q].sort((a, b) => (b.agg.fantasy.avg ?? 0) - (a.agg.fantasy.avg ?? 0))[0];
  if (mvp) s.push({ id: 'mvp', kicker: 'MVP turnieju', big: (mvp.agg.fantasy.avg ?? 0).toFixed(1), title: mvp.name, sub: `średnio punktów fantasy w ${mvp.games} grach · ${Math.round(mvp.wr * 100)}% wygranych`, heroId: mvp.heroes[0]?.heroId, player: mvp, team: mvp.team });
  const kills = topPerfs(model, 'kills', 1)[0];
  if (kills) s.push({ id: 'kills', kicker: 'Rekord zabójstw', big: `${kills.kills}`, title: kills.player?.name ?? '—', sub: perfLine(kills), heroId: kills.heroId, player: kills.player, team: kills.team });
  const gpm = topPerfs(model, 'gpm', 1)[0];
  if (gpm) s.push({ id: 'gpm', kicker: 'Złota rączka', big: `${gpm.gpm}`, title: gpm.player?.name ?? '—', sub: `złota na minutę · ${perfLine(gpm)}`, heroId: gpm.heroId, player: gpm.player, team: gpm.team });
  const immortal = model.perfs.filter(p => p.player && p.deaths === 0).sort((a, b) => b.kills + b.assists - (a.kills + a.assists))[0];
  if (immortal) s.push({ id: 'immortal', kicker: 'Nieśmiertelny', big: `${immortal.kills}/0/${immortal.assists}`, title: immortal.player!.name, sub: `ani jednej śmierci · ${heroName(immortal.heroId)} · ${fmtClock(immortal.game.duration)}`, heroId: immortal.heroId, player: immortal.player, team: immortal.team });
  const dmg = topPerfs(model, 'heroDamage', 1)[0];
  if (dmg) s.push({ id: 'dmg', kicker: 'Artyleria', big: `${(dmg.heroDamage / 1000).toFixed(1)}k`, title: dmg.player?.name ?? '—', sub: `obrażeń bohaterom · ${perfLine(dmg)}`, heroId: dmg.heroId, player: dmg.player, team: dmg.team });
  const wards = topPerfs(model, 'wards', 1)[0];
  if (wards) s.push({ id: 'wards', kicker: 'Oko na mapie', big: `${wards.obsPlaced + wards.senPlaced}`, title: wards.player?.name ?? '—', sub: `wardów w jednej grze · ${heroName(wards.heroId)}`, heroId: wards.heroId, player: wards.player, team: wards.team });
  const ramp = model.perfs.filter(p => p.rampages > 0 && p.player);
  if (ramp.length) s.push({ id: 'ramp', kicker: 'Rampage', big: `${ramp.reduce((n, p) => n + p.rampages, 0)}`, title: ramp.length === 1 ? ramp[0].player!.name : 'graczy zrobiło rampage', heroId: ramp[0].heroId, player: ramp.length === 1 ? ramp[0].player : undefined,
    extra: <div className="flex gap-2 flex-wrap">{ramp.slice(0, 10).map(p => <Tip key={p.idx} content={perfLine(p)}><span className="flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-0.5 bg-black/40"><Avatar player={p.player} size={24} /><span className="text-xs">{p.player!.name}</span><HeroImg heroId={p.heroId} variant="icon" className="w-4 h-4" /></span></Tip>)}</div> });

  const hero = model.heroes[0];
  if (hero) s.push({ id: 'hero', kicker: 'Bohater turnieju', big: `${hero.contest}`, title: heroName(hero.heroId), sub: `razy w drafcie · ${hero.picks} pick · ${hero.bans} ban · ${Math.round(hero.wr * 100)}% wygranych`, heroId: hero.heroId });
  const wrHero = [...model.heroes].filter(h => h.picks >= 5).sort((a, b) => b.wr - a.wr)[0];
  if (wrHero && wrHero !== hero) s.push({ id: 'wrhero', kicker: 'Pewniak', big: `${Math.round(wrHero.wr * 100)}%`, title: heroName(wrHero.heroId), sub: `wygranych w ${wrHero.picks} grach`, heroId: wrHero.heroId });
  const oneTrick = model.players.map(p => ({ p, h: p.heroes[0] })).filter(x => x.h).sort((a, b) => b.h.games - a.h.games)[0];
  if (oneTrick) s.push({ id: 'otp', kicker: 'Wierność', big: `${oneTrick.h.games}×`, title: oneTrick.p.name, sub: `na ${heroName(oneTrick.h.heroId)} · ${oneTrick.h.wins} wygranych`, heroId: oneTrick.h.heroId, player: oneTrick.p, team: oneTrick.p.team });
  const streak = [...model.players].sort((a, b) => b.bestWinStreak - a.bestWinStreak)[0];
  if (streak) s.push({ id: 'streak', kicker: 'Passa', big: `${streak.bestWinStreak}`, title: streak.name, sub: 'wygranych gier z rzędu', heroId: streak.heroes[0]?.heroId, player: streak, team: streak.team });
  const bestTeam = [...model.teams].sort((a, b) => b.wr - a.wr || b.wins - a.wins)[0];
  if (bestTeam) s.push({ id: 'team', kicker: 'Drużyna turnieju', big: `${bestTeam.wins}-${bestTeam.losses}`, title: bestTeam.name, sub: `w grach · serie ${bestTeam.series.w}-${bestTeam.series.d}-${bestTeam.series.l}`, heroId: bestTeam.heroPicks[0]?.heroId, team: bestTeam,
    extra: <div className="flex -space-x-2">{bestTeam.players.slice(0, 6).map(p => <Tip key={p.id} content={p.name}><span><Avatar player={p} size={34} ring="rgba(0,0,0,0.7)" /></span></Tip>)}</div> });
  return s;
}

const Stage = React.memo(function Stage({ story }: { story: Story }) {
  const font = useHeaderFont();
  return (
    <motion.div key={story.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      {story.heroId != null && (
        <>
          <HeroImg heroId={story.heroId} title={false} className="absolute inset-0 w-full h-full scale-110 blur-2xl opacity-60" />
          <motion.img src={heroRender(story.heroId)} alt={heroName(story.heroId)} draggable={false}
            className="absolute right-0 bottom-0 h-[115%] w-auto max-w-none object-contain pointer-events-none"
            initial={{ x: 60, opacity: 0, scale: 1.04 }} animate={{ x: 0, opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
        </>
      )}
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 75%), radial-gradient(ellipse at 0% 100%, ${mix(C.primary, 40)}, transparent 60%)` }} />
      <div className="relative h-full flex flex-col justify-center gap-3 px-8 md:px-14 max-w-[62%] text-white">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="text-xs md:text-sm uppercase tracking-[0.35em]" style={{ color: C.secondary }}>{story.kicker}</motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: 'spring', stiffness: 120 }} className="font-logik-extended-bold leading-[0.9] tabular-nums" style={{ fontSize: 'clamp(56px, 10vh, 120px)', ...font }}>{story.big}</motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-3">
          {story.player && <Avatar player={story.player} size={44} ring={C.secondary} />}
          {!story.player && story.team && <TeamLogo team={story.team} size={44} />}
          <div className="min-w-0">
            <div className="text-xl md:text-2xl font-bold leading-tight">{story.title}</div>
            {story.sub && <div className="text-sm text-white/65 mt-0.5">{story.sub}</div>}
          </div>
        </motion.div>
        {story.extra && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-2">{story.extra}</motion.div>}
      </div>
    </motion.div>
  );
});

function Stories({ model }: { model: Model }) {
  const stories = useMemo(() => buildStories(model), [model]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdRef = useRef<{ t: number; x: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const go = (d: number) => { setProgress(0); setI(x => (x + d + stories.length) % stories.length); };

  useEffect(() => {
    if (paused) return;
    const start = performance.now() - progress * SLIDE_MS;
    let raf = 0;
    const tick = (now: number) => {
      const p = (now - start) / SLIDE_MS;
      if (p >= 1) { setProgress(0); setI(x => (x + 1) % stories.length); return; }
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused, stories.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Preload the next slide's (large) render
  useEffect(() => {
    const next = stories[(i + 1) % stories.length]?.heroId;
    const src = next != null ? heroRender(next) : undefined;
    if (src) { const img = new Image(); img.src = src; }
  }, [i, stories]);

  const story = stories[i];
  if (!story) return null;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 rounded-3xl overflow-hidden select-none cursor-pointer"
        style={{ boxShadow: `0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px ${mix(C.text, 10)}`, background: '#0b0b10' }}
        onPointerDown={e => { holdRef.current = { t: Date.now(), x: e.clientX }; setPaused(true); }}
        onPointerUp={e => {
          const h = holdRef.current; holdRef.current = null; setPaused(false);
          if (!h || Date.now() - h.t > 350) return; // a hold just pauses
          const r = stageRef.current!.getBoundingClientRect();
          go(e.clientX - r.left < r.width * 0.35 ? -1 : 1);
        }}
        onPointerLeave={() => { if (holdRef.current) { holdRef.current = null; setPaused(false); } }}
      >
        <AnimatePresence mode="sync"><Stage key={story.id} story={story} /></AnimatePresence>
        {/* Progress segments */}
        <div className="absolute top-3 left-4 right-4 flex gap-1 z-10">
          {stories.map((st, k) => (
            <div key={st.id} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/25">
              <div className="h-full bg-white" style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        {paused && <div className="absolute top-7 right-5 z-10 text-white/70 text-xs tracking-widest">❚❚</div>}
        <div className="absolute bottom-4 right-5 z-10 text-white/40 text-[10px] uppercase tracking-[0.3em]">{i + 1} / {stories.length}</div>
      </div>
      {/* Thumbnail strip */}
      <div className="shrink-0 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stories.length}, minmax(0, 1fr))` }}>
        {stories.map((st, k) => (
          <Tip key={st.id} content={`${st.kicker}: ${st.big} · ${st.title}`}>
            <button type="button" onClick={() => { setProgress(0); setI(k); }} className="relative h-12 rounded-lg overflow-hidden transition-all" style={{ outline: k === i ? `2px solid ${C.secondary}` : 'none', opacity: k === i ? 1 : 0.55 }}>
              {st.heroId != null && <HeroImg heroId={st.heroId} title={false} className="absolute inset-0 w-full h-full" />}
              <div className="absolute inset-0 bg-black/50" />
              <span className="relative text-[11px] font-bold text-white tabular-nums">{st.big}</span>
            </button>
          </Tip>
        ))}
      </div>
    </div>
  );
}

export default function D10Stories() {
  return <LabView><WithModel>{m => <Stories model={m} />}</WithModel></LabView>;
}
