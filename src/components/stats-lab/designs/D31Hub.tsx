'use client';

// #31 — Stats hub. A bento of live teasers, each a tiny version of one full page (hero of the
// tournament, leaders, records, achievements, team of the week, bingo, race, momentum, the game).
// Click a tile and that page opens full-size right here; "Wróć" brings you back.

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { rankPlayers, topPerfs } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { metric } from '@/lib/stats-lab/metrics';
import { computeAchievements, collectorRanking } from '@/lib/stats-lab/achievements';
import { BINGO_EVENTS, hitName } from '@/lib/stats-lab/bingo';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, WithModel, ink, mix, onDark, useHeaderFont, useMetals } from '../kit';
import { useExpander } from '../hub';

function Tile({ n, onOpen, className, children, dark, delay = 0 }: { n: number; onOpen: (n: number) => void; className?: string; children: React.ReactNode; dark?: boolean; delay?: number }) {
  return (
    <motion.button type="button" onClick={() => onOpen(n)}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 200, damping: 22 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={`group relative rounded-2xl overflow-hidden text-left min-h-0 min-w-0 ${className ?? ''}`}
      style={{ background: dark ? '#0d0d12' : ink(4), border: `1px solid ${ink(10)}`, color: dark ? '#fff' : undefined }}>
      {children}
      <span className="absolute bottom-2.5 right-3 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-full"
        style={{ background: C.primary, color: '#fff' }}>Otwórz</span>
    </motion.button>
  );
}

const Kicker = ({ children, light }: { children: React.ReactNode; light?: boolean }) => (
  <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: light ? 'rgba(255,255,255,0.7)' : C.muted }}>{children}</div>
);

function Hub({ model }: { model: Model }) {
  const font = useHeaderFont();
  const metals = useMetals();
  const { open, node } = useExpander();

  const d = useMemo(() => {
    const hero = model.heroes[0];
    const leaders = rankPlayers(model, 'score', 'avg').slice(0, 3);
    const rec = topPerfs(model, 'kills', 1)[0];
    const ach = computeAchievements(model);
    const lit = ach.reduce((s, a) => s + a.byTier.filter(Boolean).length, 0);
    const collector = collectorRanking(ach)[0];
    // Latest week's best player
    const lastStart = Math.max(...model.games.map(g => g.start));
    const recent = model.perfs.filter(p => p.game.start > lastStart - 7 * 86400 && Number.isFinite(p.score) && p.player);
    const byP = new Map<string, number[]>();
    recent.forEach(p => byP.set(p.pid, [...(byP.get(p.pid) ?? []), p.score]));
    const weekBest = [...byP.entries()].map(([pid, s]) => ({ p: model.playerById.get(pid)!, avg: s.reduce((a, b) => a + b, 0) / s.length })).sort((a, b) => b.avg - a.avg)[0];
    // A random-but-stable roast
    const roasts = BINGO_EVENTS.filter(e => e.tone === 'roast').map(e => ({ e, h: e.find(model)[0] })).filter(x => x.h);
    const roast = roasts[(model.games.length * 7) % Math.max(1, roasts.length)];
    const bingoLit = BINGO_EVENTS.filter(e => e.find(model).length > 0).length;
    // Race: top 3 cumulative score
    const race = rankPlayers(model, 'score', 'total').slice(0, 3);
    // Momentum: strongest edge
    const games = model.games.filter(g => g.parsed);
    const roshWin = games.filter(g => { const r = g.perfs.filter(p => p.radiant).reduce((s, p) => s + p.roshanKills, 0); const di = g.perfs.filter(p => !p.radiant).reduce((s, p) => s + p.roshanKills, 0); return r !== di; });
    const roshWr = roshWin.length ? roshWin.filter(g => { const r = g.perfs.filter(p => p.radiant).reduce((s, p) => s + p.roshanKills, 0); const di = g.perfs.filter(p => !p.radiant).reduce((s, p) => s + p.roshanKills, 0); return (r > di) === g.radiantWin; }).length / roshWin.length : 0;
    return { hero, leaders, rec, lit, total: ach.length * 3, collector, weekBest, roast, bingoLit, race, roshWr };
  }, [model]);

  return (
    <div className="relative h-full w-full">
      <LabView>
        <LabTitle sub={<span>{model.games.length} gier · {model.players.length} graczy · kliknij kafelek, by otworzyć</span>}>Statystyki</LabTitle>
        <div className="flex-1 min-h-0 mt-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gridTemplateRows: 'repeat(3, minmax(0, 1fr))' }}>

          {/* Hero of the tournament → #3 */}
          {d.hero && (
            <Tile n={3} onOpen={open} dark className="col-span-2 row-span-2">
              <HeroImg heroId={d.hero.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-50" />
              <div className="absolute top-4 bottom-0 right-0 w-[60%] transition-transform duration-500 group-hover:scale-105 origin-bottom"><HeroRender heroId={d.hero.heroId} sizes="40vw" priority /></div>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(8,8,12,0.92), rgba(8,8,12,0.4) 55%, transparent)' }} />
              <div className="relative h-full flex flex-col justify-end p-5 gap-2">
                <Kicker light>Bohater turnieju</Kicker>
                <div className="text-4xl xl:text-5xl font-logik-extended-bold uppercase leading-none" style={font}>{heroName(d.hero.heroId)}</div>
                <div className="flex gap-5 mt-1">
                  {[['picków', d.hero.picks], ['banów', d.hero.bans], ['wygranych', `${Math.round(d.hero.wr * 100)}%`]].map(([l, v]) => (
                    <div key={l as string}><div className="text-3xl font-logik-extended-bold tabular-nums" style={{ color: onDark(C.secondary), ...font }}>{v}</div><div className="text-[10px] uppercase tracking-widest text-white/60">{l}</div></div>
                  ))}
                </div>
              </div>
            </Tile>
          )}

          {/* Leaders → #2 */}
          <Tile n={2} onOpen={open} delay={0.05}>
            <div className="h-full flex flex-col p-4">
              <Kicker>Liderzy · punkty występu</Kicker>
              <div className="flex-1 flex items-end justify-center gap-3">
                {[1, 0, 2].map(i => d.leaders[i] && (
                  <div key={i} className="flex flex-col items-center" style={{ marginBottom: i === 0 ? 14 : 0 }}>
                    <Avatar player={d.leaders[i].player} size={i === 0 ? 64 : 50} ring={i === 0 ? C.secondary : metals[i === 1 ? 1 : 0]} />
                    <div className="text-xs font-bold truncate max-w-[80px] mt-1">{d.leaders[i].player.name}</div>
                    <div className="text-lg font-logik-extended-bold tabular-nums" style={{ color: i === 0 ? C.secondary : undefined, ...font }}>{d.leaders[i].value.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Tile>

          {/* Records → #1 */}
          {d.rec && (
            <Tile n={1} onOpen={open} dark delay={0.1}>
              <HeroImg heroId={d.rec.heroId} title={false} className="absolute inset-0 w-full h-full opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
              <div className="relative h-full flex flex-col justify-between p-4">
                <Kicker light>Rekord zabójstw</Kicker>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-logik-extended-bold tabular-nums leading-none" style={{ color: onDark(C.secondary), ...font }}>{metric('kills').fmt(d.rec.kills)}</span>
                  <div className="min-w-0 pb-1 flex items-center gap-2"><Avatar player={d.rec.player} size={40} ring={C.secondary} /><span className="text-sm font-bold truncate">{d.rec.player?.name}</span></div>
                </div>
              </div>
            </Tile>
          )}

          {/* Achievements → #8 */}
          <Tile n={8} onOpen={open} delay={0.15}>
            <div className="h-full flex items-center gap-4 p-4">
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={ink(10)} strokeWidth="3.5" />
                  <motion.circle cx="18" cy="18" r="15.9" fill="none" stroke={metals[2]} strokeWidth="3.5" strokeLinecap="round"
                    initial={{ strokeDasharray: '0 100' }} animate={{ strokeDasharray: `${(d.lit / d.total) * 100} 100` }} transition={{ duration: 1.2, delay: 0.3 }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xl font-logik-extended-bold tabular-nums" style={font}>{d.lit}</div>
              </div>
              <div className="min-w-0">
                <Kicker>Osiągnięcia</Kicker>
                <div className="text-sm mt-1" style={{ color: C.muted }}>{d.lit} z {d.total} progów zdobytych</div>
                {d.collector && <div className="flex items-center gap-2 mt-2"><Avatar player={d.collector.player} size={34} ring={metals[2]} /><span className="text-sm font-bold truncate">{d.collector.player.name}</span></div>}
              </div>
            </div>
          </Tile>

          {/* Team of the week → #15 */}
          {d.weekBest && (
            <Tile n={15} onOpen={open} dark delay={0.2}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/stats-lab/minimap-741.webp" alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/20" />
              <div className="relative h-full flex flex-col justify-between p-4">
                <Kicker light>Gracz tygodnia</Kicker>
                <div className="flex items-center gap-3">
                  <Avatar player={d.weekBest.p} size={60} ring={C.secondary} />
                  <div className="min-w-0"><div className="text-lg font-bold truncate">{d.weekBest.p.name}</div><div className="text-sm text-white/70 tabular-nums">{d.weekBest.avg.toFixed(1)} pkt / grę</div></div>
                </div>
              </div>
            </Tile>
          )}

          {/* Bingo → #27 */}
          <Tile n={27} onOpen={open} delay={0.25}>
            <div className="h-full flex flex-col p-4 gap-2">
              <div className="flex items-baseline justify-between"><Kicker>Bingo turnieju</Kicker><span className="text-xl font-logik-extended-bold tabular-nums" style={font}>{d.bingoLit}/{BINGO_EVENTS.length}</span></div>
              {d.roast && (
                <div className="flex-1 flex items-center gap-3">
                  {d.roast.h.player ? <Avatar player={d.roast.h.player} size={48} ring="#ff8a3d" /> : <TeamLogo team={d.roast.h.team} size={48} />}
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide" style={{ color: '#ff8a3d' }}>{d.roast.e.label}</div>
                    <div className="text-sm italic leading-snug line-clamp-3">„{d.roast.e.quip(hitName(d.roast.h))}”</div>
                  </div>
                </div>
              )}
            </div>
          </Tile>

          {/* Race → #17 */}
          <Tile n={17} onOpen={open} delay={0.3}>
            <div className="h-full flex flex-col p-4 gap-2">
              <Kicker>Wyścig · suma punktów</Kicker>
              <div className="flex-1 flex flex-col justify-center gap-2">
                {d.race.map((r, i) => (
                  <div key={r.player.id} className="flex items-center gap-2">
                    <Avatar player={r.player} size={30} />
                    <div className="flex-1 h-6 rounded-r-lg overflow-hidden" style={{ background: ink(5) }}>
                      <motion.div className="h-full rounded-r-lg flex items-center px-2 text-[11px] font-bold text-white truncate" initial={{ width: 0 }} animate={{ width: `${(r.value / d.race[0].value) * 100}%` }} transition={{ delay: 0.4 + i * 0.1, duration: 0.8 }}
                        style={{ background: `linear-gradient(90deg, ${mix(C.primary, 50)}, ${i === 0 ? C.secondary : C.primary})` }}>{r.player.name}</motion.div>
                    </div>
                    <span className="w-10 text-right text-sm font-bold tabular-nums" style={font}>{Math.round(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Tile>

          {/* Momentum → #28 */}
          <Tile n={28} onOpen={open} delay={0.35}>
            <div className="h-full flex flex-col justify-between p-4">
              <Kicker>Co wygrywa mecze</Kicker>
              <div>
                <div className="text-5xl font-logik-extended-bold tabular-nums leading-none" style={{ color: C.win, ...font }}>{Math.round(d.roshWr * 100)}%</div>
                <div className="text-sm mt-1" style={{ color: C.muted }}>wygranych ma drużyna, która zabiła więcej Roshanów</div>
              </div>
            </div>
          </Tile>

          {/* Higher / lower → #19 */}
          <Tile n={19} onOpen={open} delay={0.4}>
            <div className="h-full flex flex-col justify-between p-4" style={{ background: `radial-gradient(circle at 80% 20%, ${mix(C.primary, 30)}, transparent 70%)` }}>
              <Kicker>Zagraj</Kicker>
              <div>
                <div className="text-2xl font-logik-extended-bold uppercase leading-tight" style={font}>Wyżej czy niżej?</div>
                <div className="flex gap-2 mt-3">
                  <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white" style={{ background: C.win }}>Wyżej</span>
                  <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white" style={{ background: C.loss }}>Niżej</span>
                </div>
              </div>
            </div>
          </Tile>
        </div>
      </LabView>
      {node}
    </div>
  );
}

export default function D31Hub() {
  return <WithModelFull>{m => <Hub model={m} />}</WithModelFull>;
}

/** WithModel needs a flex column parent; the hub renders its own LabView once data is ready */
function WithModelFull({ children }: { children: (m: Model) => React.ReactNode }) {
  return <div className="h-full w-full flex flex-col"><WithModel>{children}</WithModel></div>;
}
