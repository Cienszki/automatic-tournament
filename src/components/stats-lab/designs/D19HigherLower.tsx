'use client';

// #19 — Higher or lower. A game on the tournament's real numbers: is the right value higher or
// lower than the left one? A correct guess slides the right card over and draws a new one; the
// category changes every few rounds. Best streak is remembered in this browser.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { fmtClock, fmtPct, metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { opponentOf, type Model } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, WithModel, mix, useHeaderFont, HeroRender } from '../kit';
import { count } from '@/lib/plural';

interface Fact {
  id: string;
  name: string;
  sub?: string;
  value: number;
  visual: { kind: 'player'; player: Model['players'][number]; heroId?: number } | { kind: 'hero'; heroId: number } | { kind: 'team'; team: Model['teams'][number] };
}
interface Deck { id: string; question: string; desc: string; fmt: (v: number) => string; facts: Fact[] }

function buildDecks(model: Model): Deck[] {
  const decks: Deck[] = [];
  const q = model.players.filter(p => p.games >= model.minGames);
  const avgKeys: MetricKey[] = ['score', 'kills', 'assists', 'deaths', 'gpm', 'xpm', 'lastHits', 'hdpm', 'wards'];
  for (const k of avgKeys) {
    const m = metric(k);
    decks.push({ id: `avg-${k}`, question: `${m.label} — średnio na grę`, desc: m.desc, fmt: v => v.toLocaleString('pl-PL', { maximumFractionDigits: m.avgDigits }),
      facts: q.filter(p => p.agg[k].n).map(p => ({ id: p.id, name: p.name, sub: p.team?.name, value: p.agg[k].avg ?? 0, visual: { kind: 'player', player: p, heroId: p.heroes[0]?.heroId } })) });
  }
  const bestKeys: MetricKey[] = ['kills', 'assists', 'gpm', 'heroDamage', 'netWorth', 'lastHits'];
  for (const k of bestKeys) {
    const m = metric(k);
    decks.push({ id: `best-${k}`, question: `${m.label} — najlepsza gra`, desc: m.desc, fmt: m.fmt,
      facts: q.filter(p => p.agg[k].best).map(p => { const b = p.agg[k].best!; return { id: p.id, name: p.name, sub: `${heroName(b.heroId)} vs ${opponentOf(b)?.name ?? '?'}`, value: m.get(b), visual: { kind: 'player', player: p, heroId: b.heroId } }; }) });
  }
  const heroes = model.heroes.filter(h => h.contest > 0);
  decks.push({ id: 'h-picks', question: 'Ile razy wybrany', desc: 'Liczba picków bohatera w turnieju', fmt: v => String(v), facts: heroes.map(h => ({ id: String(h.heroId), name: heroName(h.heroId), value: h.picks, visual: { kind: 'hero', heroId: h.heroId } })) });
  decks.push({ id: 'h-bans', question: 'Ile razy zbanowany', desc: 'Liczba banów bohatera w turnieju', fmt: v => String(v), facts: heroes.map(h => ({ id: String(h.heroId), name: heroName(h.heroId), value: h.bans, visual: { kind: 'hero', heroId: h.heroId } })) });
  decks.push({ id: 'h-wr', question: 'Procent wygranych', desc: 'Bohaterowie z co najmniej 5 grami', fmt: fmtPct, facts: heroes.filter(h => h.picks >= 5).map(h => ({ id: String(h.heroId), name: heroName(h.heroId), sub: `${count(h.picks, 'gra', 'gry', 'gier')}`, value: h.wr, visual: { kind: 'hero', heroId: h.heroId } })) });
  const teams = model.teams.filter(t => t.games.length >= 2);
  decks.push({ id: 't-kills', question: 'Zabójstwa drużyny na grę', desc: 'Średnia liczba zabójstw drużyny', fmt: v => v.toFixed(1), facts: teams.map(t => ({ id: t.id, name: t.name, value: t.avg.kills, visual: { kind: 'team', team: t } })) });
  decks.push({ id: 't-dur', question: 'Średni czas gry', desc: 'Jak długo trwają gry drużyny', fmt: fmtClock, facts: teams.map(t => ({ id: t.id, name: t.name, value: t.avg.duration, visual: { kind: 'team', team: t } })) });
  decks.push({ id: 't-wr', question: 'Procent wygranych gier', desc: 'Wygrane gry drużyny', fmt: fmtPct, facts: teams.map(t => ({ id: t.id, name: t.name, sub: `${t.wins}-${t.losses}`, value: t.wr, visual: { kind: 'team', team: t } })) });
  return decks.filter(d => d.facts.length >= 6);
}

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function pickPair(deck: Deck, left?: Fact): [Fact, Fact] {
  const L = left ?? rnd(deck.facts);
  const span = Math.max(...deck.facts.map(f => f.value)) - Math.min(...deck.facts.map(f => f.value));
  const pool = deck.facts.filter(f => f.id !== L.id && Math.abs(f.value - L.value) >= span * 0.04);
  return [L, rnd(pool.length ? pool : deck.facts.filter(f => f.id !== L.id))];
}

function CountUp({ to, fmt }: { to: number; fmt: (v: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => { const c = animate(0, to, { duration: 0.9, ease: 'easeOut', onUpdate: setV }); return () => c.stop(); }, [to]);
  return <>{fmt(v)}</>;
}

function Card({ f, deck, hidden, side, verdict }: { f: Fact; deck: Deck; hidden: boolean; side: 'L' | 'R'; verdict?: 'ok' | 'bad' }) {
  const font = useHeaderFont();
  const heroId = f.visual.kind === 'hero' ? f.visual.heroId : f.visual.kind === 'player' ? f.visual.heroId : undefined;
  return (
    <motion.div layout initial={{ opacity: 0, x: side === 'R' ? 80 : -80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -120 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
      className="relative flex-1 min-w-0 rounded-3xl overflow-hidden text-white flex flex-col items-center justify-center gap-3 p-6"
      style={{ background: '#0c0c11', boxShadow: verdict ? `inset 0 0 0 3px ${verdict === 'ok' ? C.win : C.loss}` : `inset 0 0 0 1px rgba(255,255,255,0.08)` }}>
      {heroId != null && <HeroImg heroId={heroId} title={false} className="absolute inset-0 w-full h-full scale-110 blur-xl opacity-40" />}
      {f.visual.kind === 'team' && f.visual.team.logoUrl && (
        <div className="absolute inset-0 scale-125 blur-3xl opacity-40 bg-center bg-cover" style={{ backgroundImage: `url(${f.visual.team.logoUrl})` }} />
      )}
      {f.visual.kind === 'hero' && (
        <div className="absolute left-[10%] right-[10%] top-[12%] bottom-0 opacity-70"><HeroRender heroId={f.visual.heroId} sizes="40vw" /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        {f.visual.kind === 'player' && <Avatar player={f.visual.player} size={110} ring="rgba(255,255,255,0.7)" />}
        {f.visual.kind === 'team' && <TeamLogo team={f.visual.team} size={110} />}
        {f.visual.kind === 'hero' && <div style={{ height: 70 }} />}
        <div className="text-2xl md:text-3xl font-logik-extended-bold uppercase leading-tight max-w-[90%]" style={font}>{f.name}</div>
        {f.sub && <div className="text-sm text-white/60">{f.sub}</div>}
        <div className="text-xs uppercase tracking-[0.3em] text-white/50 mt-2">{deck.question}</div>
        <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: 'clamp(40px, 8vh, 80px)', color: hidden ? 'rgba(255,255,255,0.25)' : C.secondary, ...font }}>
          {hidden ? '?' : side === 'R' ? <CountUp to={f.value} fmt={deck.fmt} /> : deck.fmt(f.value)}
        </div>
      </div>
    </motion.div>
  );
}

function Game({ model }: { model: Model }) {
  const font = useHeaderFont();
  const decks = useMemo(() => buildDecks(model), [model]);
  const [deck, setDeck] = useState(() => rnd(decks));
  const [pair, setPair] = useState<[Fact, Fact]>(() => pickPair(deck));
  const [phase, setPhase] = useState<'ask' | 'ok' | 'bad'>('ask');
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [round, setRound] = useState(0);

  useEffect(() => { try { setBest(Number(localStorage.getItem('statslab-hl-best')) || 0); } catch { /* storage blocked */ } }, []);

  const guess = (higher: boolean) => {
    if (phase !== 'ask') return;
    const [L, R] = pair;
    const ok = R.value === L.value || (higher ? R.value > L.value : R.value < L.value);
    setPhase(ok ? 'ok' : 'bad');
    if (ok) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) { setBest(s); try { localStorage.setItem('statslab-hl-best', String(s)); } catch { /* storage blocked */ } }
      setTimeout(() => {
        const r = round + 1; setRound(r);
        if (r % 4 === 0) { const d = rnd(decks.filter(x => x.id !== deck.id)); setDeck(d); setPair(pickPair(d)); }
        else setPair(pickPair(deck, R));
        setPhase('ask');
      }, 1500);
    }
  };
  const restart = () => { const d = rnd(decks); setDeck(d); setPair(pickPair(d)); setStreak(0); setRound(0); setPhase('ask'); };
  const [L, R] = pair;

  return (
    <>
      <LabTitle
        sub={<span>{deck.desc}</span>}
        right={
          <div className="flex items-center gap-4">
            <div className="text-center"><div className="text-3xl font-logik-extended-bold tabular-nums leading-none" style={{ color: C.secondary, ...font }}>{streak}</div><div className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>seria</div></div>
            <div className="text-center"><div className="text-3xl font-logik-extended-bold tabular-nums leading-none" style={{ color: C.heading, ...font }}>{best}</div><div className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>rekord</div></div>
          </div>
        }
      >
        Wyżej czy niżej
      </LabTitle>
      <div className="relative flex-1 min-h-0 flex gap-4 mt-3">
        <AnimatePresence mode="popLayout" initial={false}>
          <Card key={`L-${deck.id}-${L.id}`} f={L} deck={deck} hidden={false} side="L" />
          <Card key={`R-${deck.id}-${R.id}`} f={R} deck={deck} hidden={phase === 'ask'} side="R" verdict={phase === 'ask' ? undefined : phase} />
        </AnimatePresence>

        {/* Centre controls */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-3">
          {phase === 'ask' && (
            <>
              <motion.button type="button" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={() => guess(true)}
                className="w-28 h-12 rounded-full font-bold uppercase tracking-widest text-sm text-white" style={{ background: C.win, boxShadow: `0 0 24px ${mix(C.win, 50)}` }}>Wyżej</motion.button>
              <div className="w-14 h-14 rounded-full flex items-center justify-center font-logik-extended-bold text-white bg-black/80 border border-white/20" style={font}>VS</div>
              <motion.button type="button" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={() => guess(false)}
                className="w-28 h-12 rounded-full font-bold uppercase tracking-widest text-sm text-white" style={{ background: C.loss, boxShadow: `0 0 24px ${mix(C.loss, 50)}` }}>Niżej</motion.button>
            </>
          )}
          {phase === 'ok' && <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }} className="w-16 h-16 rounded-full" style={{ background: C.win, boxShadow: `0 0 40px ${C.win}` }} />}
          {phase === 'bad' && (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3 rounded-3xl px-8 py-6 bg-black/90 border border-white/15 text-white">
              <div className="text-sm uppercase tracking-widest text-white/60">Seria</div>
              <div className="text-5xl font-logik-extended-bold tabular-nums" style={{ color: C.secondary, ...font }}>{streak}</div>
              <button type="button" onClick={restart} className="mt-2 rounded-full px-6 py-2 font-bold uppercase tracking-widest text-sm" style={{ background: C.primary }}>Jeszcze raz</button>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}

export default function D19HigherLower() {
  return <LabView><WithModel>{m => <Game model={m} />}</WithModel></LabView>;
}
