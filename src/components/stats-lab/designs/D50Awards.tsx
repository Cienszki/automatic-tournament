'use client';

// #50 — Awards night. The season's categories (MVP, best of each position, rookie, most improved,
// duo, hero of the year, game of the year — and two Golden Raspberries). Each one has its
// nominees on stage; open the envelope to crown the winner. The list on the left remembers who won.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameX, Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { avgScore, qualified, scored } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, Tip, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

type Face = { kind: 'player'; p: PlayerX } | { kind: 'duo'; a: PlayerX; b: PlayerX } | { kind: 'hero'; id: number } | { kind: 'game'; g: GameX };
interface Nominee { id: string; name: string; value: string; note: string; face: Face }
interface Category { id: string; title: string; desc: string; nominees: Nominee[]; roast?: boolean }

const GOLD = '#f2c94c';
const RASP = '#e0457b';

function buildCategories(model: Model): Category[] {
  const q = qualified(model);
  const cats: Category[] = [];
  const pl = (p: PlayerX, value: string, note: string): Nominee => ({ id: p.id, name: p.name, value, note, face: { kind: 'player', p } });
  const byScore = (list: PlayerX[]) => [...list].sort((a, b) => (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0));
  const scoreNom = (p: PlayerX) => pl(p, (p.agg.score.avg ?? 0).toFixed(2), `pkt na grę · ${p.games} gier`);

  cats.push({ id: 'mvp', title: 'MVP sezonu', desc: 'Najwyższa średnia punktów występu', nominees: byScore(q).slice(0, 4).map(scoreNom) });
  for (const [role, title] of [['Carry', 'Najlepszy carry'], ['Mid', 'Najlepszy mid'], ['Offlane', 'Najlepszy offlaner']] as const) {
    const n = byScore(q.filter(p => p.role === role)).slice(0, 4).map(scoreNom);
    if (n.length >= 2) cats.push({ id: role, title, desc: `Średnia punktów występu na pozycji ${role}`, nominees: n });
  }
  const sup = byScore(q.filter(p => p.role === 'Soft Support' || p.role === 'Hard Support')).slice(0, 4).map(scoreNom);
  if (sup.length >= 2) cats.push({ id: 'support', title: 'Najlepszy support', desc: 'Średnia punktów występu na pozycjach 4 i 5', nominees: sup });

  // Rookie: first game in the second half of the season
  const starts = model.games.map(g => g.start).sort((a, b) => a - b);
  const mid = starts[Math.floor(starts.length / 2)] ?? 0;
  const rookies = byScore(model.players.filter(p => p.perfs[0]?.game.start >= mid && scored(p.perfs).length >= Math.max(2, Math.round(model.minGames / 2)))).slice(0, 4);
  if (rookies.length >= 2) cats.push({ id: 'rookie', title: 'Odkrycie sezonu', desc: 'Najlepsi gracze, którzy zadebiutowali w drugiej połowie sezonu', nominees: rookies.map(scoreNom) });

  // Most improved: second half minus first half
  const imp = model.players.map(p => {
    const a = avgScore(p.perfs.filter(x => x.game.start < mid)); const b = avgScore(p.perfs.filter(x => x.game.start >= mid));
    const na = scored(p.perfs.filter(x => x.game.start < mid)).length; const nb = scored(p.perfs.filter(x => x.game.start >= mid)).length;
    return { p, d: a != null && b != null && na >= 3 && nb >= 3 ? b - a : -Infinity, a, b };
  }).filter(x => x.d > 0).sort((x, y) => y.d - x.d).slice(0, 4);
  if (imp.length >= 2) cats.push({ id: 'improved', title: 'Największy postęp', desc: 'Wzrost średniej punktów występu w drugiej połowie sezonu', nominees: imp.map(x => pl(x.p, `+${x.d.toFixed(2)}`, `${x.a!.toFixed(1)} → ${x.b!.toFixed(1)} pkt`)) });

  // Duo: teammates in the same games
  const pairs = new Map<string, { a: PlayerX; b: PlayerX; n: number; w: number }>();
  for (const g of model.games) {
    for (const side of [true, false]) {
      const ps = g.perfs.filter(p => p.radiant === side && p.player).map(p => p.player!).sort((x, y) => x.id.localeCompare(y.id));
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const k = ps[i].id + '|' + ps[j].id;
        const r = pairs.get(k) ?? { a: ps[i], b: ps[j], n: 0, w: 0 };
        r.n++; if (side === g.radiantWin) r.w++;
        pairs.set(k, r);
      }
    }
  }
  const duos = [...pairs.values()].filter(r => r.n >= Math.max(4, model.minGames)).sort((x, y) => (y.w + 1) / (y.n + 2) - (x.w + 1) / (x.n + 2) || y.n - x.n).slice(0, 4);
  if (duos.length >= 2) cats.push({ id: 'duo', title: 'Duet roku', desc: 'Para z jednej drużyny z najlepszym bilansem wspólnych gier', nominees: duos.map(d => ({ id: d.a.id + d.b.id, name: `${d.a.name} & ${d.b.name}`, value: `${d.w}–${d.n - d.w}`, note: `${Math.round((d.w / d.n) * 100)}% wygranych razem`, face: { kind: 'duo', a: d.a, b: d.b } })) });

  // Hero of the year
  const heroes = model.heroes.filter(h => h.picks >= 5).sort((a, b) => b.picks * (b.wr + 0.1) - a.picks * (a.wr + 0.1)).slice(0, 4);
  if (heroes.length >= 2) cats.push({ id: 'hero', title: 'Bohater roku', desc: 'Często wybierany i często wygrywający', nominees: heroes.map(h => ({ id: String(h.heroId), name: heroName(h.heroId), value: `${Math.round(h.wr * 100)}%`, note: `${h.picks} picków · ${h.bans} banów`, face: { kind: 'hero', id: h.heroId } })) });

  // Game of the year: lots of kills and a close finish
  const games = [...model.games].filter(g => g.radiantTeam && g.direTeam).sort((a, b) => (b.kills + b.duration / 60) - (a.kills + a.duration / 60)).slice(0, 4);
  if (games.length >= 2) cats.push({ id: 'game', title: 'Gra roku', desc: 'Najwięcej zabójstw i najdłuższa walka', nominees: games.map(g => ({ id: g.id, name: `${g.radiantTeam!.name} vs ${g.direTeam!.name}`, value: `${g.kills} zab.`, note: `${fmtClock(g.duration)} · MVP ${g.mvp?.player?.name ?? '?'}`, face: { kind: 'game', g } })) });

  // Golden Raspberries
  const deaths = [...q].sort((a, b) => (b.agg.deaths.avg ?? 0) - (a.agg.deaths.avg ?? 0)).slice(0, 4);
  cats.push({ id: 'rasp-deaths', roast: true, title: 'Złota Malina: Dawca', desc: 'Najwięcej śmierci na grę — ktoś musi karmić', nominees: deaths.map(p => pl(p, (p.agg.deaths.avg ?? 0).toFixed(1), 'śmierci na grę')) });
  const tourist = [...q].filter(p => p.agg.kp.avg != null).sort((a, b) => (a.agg.kp.avg ?? 1) - (b.agg.kp.avg ?? 1)).slice(0, 4);
  cats.push({ id: 'rasp-kp', roast: true, title: 'Złota Malina: Turysta', desc: 'Najmniejszy udział w zabójstwach drużyny — zwiedzał mapę', nominees: tourist.map(p => pl(p, `${Math.round((p.agg.kp.avg ?? 0) * 100)}%`, 'udziału w zabójstwach')) });
  return cats.filter(c => c.nominees.length >= 2);
}

function FaceView({ f, size, winner }: { f: Face; size: number; winner: boolean }) {
  const ring = winner ? GOLD : 'rgba(255,255,255,0.25)';
  if (f.kind === 'player') return <Avatar player={f.p} size={size} ring={ring} />;
  if (f.kind === 'duo') return <div className="flex -space-x-5"><Avatar player={f.a} size={size * 0.78} ring={ring} /><Avatar player={f.b} size={size * 0.78} ring={ring} /></div>;
  if (f.kind === 'hero') return <div className="relative" style={{ width: size * 1.2, height: size * 1.3 }}><HeroRender heroId={f.id} sizes="220px" /></div>;
  return <div className="flex items-center gap-2"><TeamLogo team={f.g.radiantTeam} size={size * 0.62} /><span className="text-xs opacity-60">vs</span><TeamLogo team={f.g.direTeam} size={size * 0.62} /></div>;
}

function Awards({ model }: { model: Model }) {
  const font = useHeaderFont();
  const cats = useMemo(() => buildCategories(model), [model]);
  const [ci, setCi] = useState(0);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const cat = cats[ci];
  const isOpen = !!opened[cat?.id];
  const accent = cat?.roast ? RASP : GOLD;
  const winner = cat?.nominees[0];
  const order = useMemo(() => {
    // stage order: a stable shuffle so the winner isn't always on the left
    if (!cat) return [];
    return [...cat.nominees].sort((a, b) => (a.id.charCodeAt(a.id.length - 1) % 7) - (b.id.charCodeAt(b.id.length - 1) % 7));
  }, [cat]);
  const open = () => setOpened(o => ({ ...o, [cat.id]: true }));
  const [stageRef, stage] = useSize<HTMLDivElement>();
  const face = Math.round(Math.max(64, Math.min(120, stage.h * 0.22)));

  if (!cat) return <LabTitle>Gala nagród</LabTitle>;
  return (
    <>
      <LabTitle sub={<span>{Object.keys(opened).length} / {cats.length} kopert otwartych</span>}
        right={<button type="button" onClick={() => setOpened(Object.fromEntries(cats.map(c => [c.id, true])))} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), border: `1px solid ${ink(14)}`, color: C.text }}>Otwórz wszystkie</button>}>
        Gala nagród
      </LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Categories */}
        <div className="w-[270px] shrink-0 flex flex-col gap-1.5 min-h-0">
          {cats.map((c, i) => {
            const on = i === ci; const w = opened[c.id] ? c.nominees[0] : null;
            return (
              <button key={c.id} type="button" onClick={() => setCi(i)} className="flex-1 min-h-0 max-h-14 flex items-center gap-3 rounded-xl px-3 text-left transition-all"
                style={on ? { background: mix(c.roast ? RASP : C.primary, 45), boxShadow: `0 0 0 2px ${c.roast ? RASP : C.secondary}` } : { background: ink(5) }}>
                <span className="w-1.5 self-stretch my-2.5 rounded-full shrink-0" style={{ background: c.roast ? RASP : GOLD }} />
                <span className="flex-1 min-w-0 truncate text-sm font-bold" style={{ color: C.heading }}>{c.title}</span>
                {w ? (w.face.kind === 'player' ? <Avatar player={w.face.p} size={30} ring={c.roast ? RASP : GOLD} /> : w.face.kind === 'hero' ? <HeroImg heroId={w.face.id} variant="icon" className="rounded-full" style={{ width: 30, height: 30 }} /> : w.face.kind === 'duo' ? <Avatar player={w.face.a} size={30} ring={GOLD} /> : <TeamLogo team={w.face.g.radiantWin ? w.face.g.radiantTeam : w.face.g.direTeam} size={30} />)
                  : <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>?</span>}
              </button>
            );
          })}
        </div>
        {/* Stage */}
        <div ref={stageRef} className="relative flex-1 min-w-0 min-h-0 rounded-3xl overflow-hidden flex flex-col" style={{ background: `radial-gradient(ellipse at 50% 0%, ${mix(accent, 22)}, transparent 60%), #0b0b10`, border: `1px solid ${mix(accent, 30)}` }}>
          {/* spotlights */}
          <div className="absolute -top-20 left-[15%] w-40 h-[140%] rotate-[18deg] pointer-events-none" style={{ background: `linear-gradient(180deg, ${mix(accent, 18)}, transparent)` }} />
          <div className="absolute -top-20 right-[15%] w-40 h-[140%] -rotate-[18deg] pointer-events-none" style={{ background: `linear-gradient(180deg, ${mix(accent, 18)}, transparent)` }} />
          <AnimatePresence mode="wait">
            <motion.div key={cat.id} className="relative flex-1 min-h-0 flex flex-col items-center px-6 pt-6 pb-5 text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-[11px] uppercase tracking-[0.4em]" style={{ color: accent }}>{cat.roast ? 'Antynagroda' : 'Kategoria'}</div>
              <div className="text-4xl font-logik-extended-bold uppercase text-center" style={font}>{cat.title}</div>
              <div className="text-sm text-white/60 mt-1">{cat.desc}</div>
              <div className="flex-1 min-h-0 w-full flex items-center justify-center gap-6">
                {order.map((n, i) => {
                  const win = isOpen && n === winner;
                  return (
                    <motion.div key={n.id} className="flex flex-col items-center gap-2 text-center rounded-3xl px-4 py-4 w-[220px]"
                      style={{ background: win ? mix(accent, 20) : 'rgba(255,255,255,0.04)', boxShadow: win ? `0 0 0 2px ${accent}, 0 0 60px ${mix(accent, 45)}` : undefined }}
                      initial={{ opacity: 0, y: 30 }} animate={{ opacity: isOpen && !win ? 0.35 : 1, y: 0, scale: win ? 1.04 : 1 }} transition={{ delay: isOpen ? 0 : i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}>
                      <div className="flex items-end justify-center" style={{ height: face * 1.25 }}><FaceView f={n.face} size={face} winner={win} /></div>
                      <div className="text-lg font-bold leading-tight line-clamp-2" style={font}>{n.name}</div>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="leading-tight">
                            <div className="text-2xl font-logik-extended-bold tabular-nums" style={{ color: win ? accent : '#fff', ...font }}>{n.value}</div>
                            <div className="text-[11px] text-white/60">{n.note}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {win && <motion.div className="text-xs font-bold uppercase tracking-[0.3em] px-3 py-1 rounded-full text-black" style={{ background: accent }} initial={{ scale: 0 }} animate={{ scale: 1 }}>{cat.roast ? 'Laureat' : 'Zwycięzca'}</motion.div>}
                    </motion.div>
                  );
                })}
              </div>
              {!isOpen ? (
                <motion.button type="button" onClick={open} className="rounded-2xl px-10 py-4 text-base font-bold uppercase tracking-[0.25em] text-black" style={{ background: accent, boxShadow: `0 0 40px ${mix(accent, 55)}` }}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Otwórz kopertę</motion.button>
              ) : (
                <div className="flex gap-3">
                  <Tip content="Poprzednia kategoria"><button type="button" disabled={ci === 0} onClick={() => setCi(ci - 1)} className="w-12 h-12 rounded-full text-2xl disabled:opacity-25" style={{ background: 'rgba(255,255,255,0.1)' }}>‹</button></Tip>
                  {ci < cats.length - 1 && <button type="button" onClick={() => setCi(ci + 1)} className="rounded-2xl px-8 py-3 text-sm font-bold uppercase tracking-[0.25em] text-white" style={{ background: C.primary, boxShadow: `0 0 20px ${mix(C.primary, 50)}` }}>Następna kategoria</button>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D50Awards() {
  return <LabView><WithModel>{m => <Awards model={m} />}</WithModel></LabView>;
}
