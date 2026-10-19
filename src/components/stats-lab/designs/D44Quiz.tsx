'use client';

// #44 — "Kto to?". A ten-question quiz built from the season's numbers: guess the player, hero
// or team from clues that unlock one by one (fewer clues = more points), or name the owner of a
// record. After each answer the reveal shows who it was and links to the page that explains it.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { rankPlayers } from '@/lib/stats-lab/derive';
import { eloTable } from '@/lib/stats-lab/teasers';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, HeroRender, LabTitle, TeamLogo, ink, mix, onDark, useHeaderFont } from '../kit';
import { HubShell, useFacts } from '../hub';

const ROUNDS = 10;
const CLUE_MS = 4500;
const GOOD = '#3ddc84';
const BAD = '#ff5d5d';

type Kind = 'player' | 'hero' | 'team' | 'record';
interface Choice { id: string; name: string; img: (size: number) => React.ReactNode; render?: number }
interface Question { kind: Kind; ask: string; clues: React.ReactNode[]; choices: Choice[]; answer: string; page: number; reveal: string }

function rng(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function shuffle<T>(a: T[], r: () => number) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function buildQuiz(model: Model, facts: ReturnType<typeof useFacts>, seed: number): Question[] {
  const r = rng(seed);
  const players = model.players.filter(p => p.games >= 3);
  const heroes = model.heroes.filter(h => h.picks >= 2);
  const teams = model.teams.filter(t => t.games.length > 0);
  const elo = eloTable(model);
  const score = rankPlayers(model, 'score', 'avg', 1);
  const pc = (p: (typeof players)[number]): Choice => ({ id: p.id, name: p.name, img: s => <Avatar player={p} size={s} className="!rounded-2xl" /> });
  const others = <T,>(pool: T[], not: T, n: number) => shuffle(pool.filter(x => x !== not), r).slice(0, n);
  const H = (id: number) => <span className="inline-flex items-center gap-2 align-middle"><HeroImg heroId={id} variant="icon" className="rounded" style={{ width: 44, height: 25 }} />{heroName(id)}</span>;

  const makers: Array<() => Question | null> = [
    () => {
      const p = players[Math.floor(r() * players.length)]; if (!p) return null;
      const s = score.find(x => x.player.id === p.id);
      return {
        kind: 'player', ask: 'Który to gracz?', page: 16, reveal: p.name, answer: p.id,
        clues: [
          <>{p.games} gier · {Math.round(p.wr * 100)}% wygranych</>,
          <>najczęściej gra {p.heroes[0] ? H(p.heroes[0].heroId) : '—'}</>,
          <>średnio {s ? s.value.toFixed(2) : '–'} pkt występu · KDA {p.agg.kda.avg?.toFixed(2) ?? '–'}</>,
          <>gra w <b>{p.team?.name ?? '—'}</b></>,
        ],
        choices: shuffle([pc(p), ...others(players, p, 3).map(pc)], r),
      };
    },
    () => {
      const h = heroes[Math.floor(r() * heroes.length)]; if (!h) return null;
      const top = [...h.players].sort((a, b) => b.games - a.games)[0];
      const hc = (x: typeof h): Choice => ({ id: String(x.heroId), name: heroName(x.heroId), img: s => <HeroImg heroId={x.heroId} className="rounded-2xl" style={{ width: s * 0.75, height: s }} />, render: x.heroId });
      return {
        kind: 'hero', ask: 'Jaki to bohater?', page: 3, reveal: heroName(h.heroId), answer: String(h.heroId),
        clues: [
          <>{h.picks} picków · {h.bans} banów</>,
          <>{Math.round(h.wr * 100)}% wygranych</>,
          <>średnio {h.avgK.toFixed(1)} / {h.avgD.toFixed(1)} / {h.avgA.toFixed(1)}</>,
          <>najczęściej grał nim <b>{top?.player.name ?? '—'}</b></>,
        ],
        choices: shuffle([hc(h), ...others(heroes, h, 3).map(hc)], r),
      };
    },
    () => {
      const t = teams[Math.floor(r() * teams.length)]; if (!t) return null;
      const e = elo.findIndex(x => x.t.id === t.id);
      const star = score.find(x => x.player.team?.id === t.id);
      const tc = (x: typeof t): Choice => ({ id: x.id, name: x.name, img: s => <span className="flex items-center justify-center rounded-2xl" style={{ width: s, height: s, background: '#15151c' }}><TeamLogo team={x} size={s * 0.8} /></span> });
      return {
        kind: 'team', ask: 'Która to drużyna?', page: 7, reveal: t.name, answer: t.id,
        clues: [
          <>{t.wins}–{t.losses} w grach</>,
          <>{e + 1}. miejsce w rankingu Elo</>,
          <>najczęściej wybiera {t.heroPicks[0] ? H(t.heroPicks[0].heroId) : '—'}</>,
          <>jej gwiazda: <b>{star?.player.name ?? '—'}</b></>,
        ],
        choices: shuffle([tc(t), ...others(teams, t, 3).map(tc)], r),
      };
    },
    () => {
      const recs = facts.filter(f => f.id.startsWith('rec-') && f.player);
      const f = recs[Math.floor(r() * recs.length)]; if (!f?.player) return null;
      const p = f.player;
      const pool = players.includes(p) ? players : [...players, p];
      return {
        kind: 'record', ask: 'Czyj to rekord?', page: 1, reveal: p.name, answer: p.id,
        clues: [
          <><b className="text-3xl">{f.big}</b> · {f.kicker.replace(/^Rekord · /, '').toLowerCase()} w jednej grze</>,
          <>{f.sub}</>,
          <>gra w <b>{p.team?.name ?? '—'}</b></>,
        ],
        choices: shuffle([pc(p), ...others(pool, p, 3).map(pc)], r),
      };
    },
  ];
  const long = [...model.games].sort((a, b) => b.duration - a.duration)[0];
  const out: Question[] = [];
  for (let i = 0; out.length < ROUNDS && i < 60; i++) {
    const q = makers[i % makers.length]();
    if (q && q.choices.length === 4 && !out.some(x => x.answer === q.answer)) out.push(q);
  }
  if (long && out.length > 6) out.splice(5, 0, {
    kind: 'team', ask: 'Kto wygrał najdłuższą grę?', page: 6, answer: long.winnerId, reveal: (long.radiantWin ? long.radiantTeam : long.direTeam)?.name ?? '',
    clues: [<>{fmtClock(long.duration)} gry</>, <>{long.kills} zabójstw</>, <>MVP grał {long.mvp ? H(long.mvp.heroId) : '—'}</>],
    choices: shuffle([long.radiantTeam, long.direTeam, ...others(teams.filter(t => t.id !== long.radiant && t.id !== long.dire), teams[0], 2)].filter(Boolean).slice(0, 4).map(x => ({ id: x!.id, name: x!.name, img: (s: number) => <span className="flex items-center justify-center rounded-2xl" style={{ width: s, height: s, background: '#15151c' }}><TeamLogo team={x} size={s * 0.8} /></span> })), r),
  });
  return out.slice(0, ROUNDS);
}

function Quiz({ model, open }: { model: Model; open: (n: number) => void }) {
  const font = useHeaderFont();
  const facts = useFacts(model);
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 1e6));
  const quiz = useMemo(() => buildQuiz(model, facts, seed), [model, facts, seed]);
  const [round, setRound] = useState(0);
  const [clues, setClues] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [hits, setHits] = useState<boolean[]>([]);
  const q = quiz[round];
  const done = round >= quiz.length;

  useEffect(() => {
    if (picked || done || !q || clues >= q.clues.length) return;
    const t = setTimeout(() => setClues(c => c + 1), CLUE_MS);
    return () => clearTimeout(t);
  }, [clues, picked, done, q]);

  const worth = q ? Math.max(1, q.clues.length + 1 - clues) : 0;
  const answer = (id: string) => {
    if (picked || !q) return;
    setPicked(id); setClues(q.clues.length);
    const ok = id === q.answer;
    setHits(h => [...h, ok]); if (ok) setPoints(p => p + worth);
  };
  const next = () => { setRound(r => r + 1); setClues(1); setPicked(null); };
  const restart = () => { setSeed(s => s + 7919); setRound(0); setClues(1); setPicked(null); setPoints(0); setHits([]); };
  const max = quiz.reduce((s, x) => s + x.clues.length, 0);

  const progress = (
    <div className="flex items-center gap-1.5">
      {quiz.map((_, i) => <span key={i} className="h-2.5 rounded-full transition-all" style={{ width: i === round ? 30 : 14, background: hits[i] == null ? (i === round ? C.secondary : ink(18)) : hits[i] ? GOOD : BAD }} />)}
      <span className="ml-3 font-logik-extended-bold tabular-nums text-xl" style={{ color: C.heading, ...font }}>{points}</span><span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>pkt</span>
    </div>
  );

  if (done) {
    const ok = hits.filter(Boolean).length;
    const verdict = ok >= 9 ? 'Analityk roku.' : ok >= 7 ? 'Znasz tę ligę.' : ok >= 4 ? 'Coś tam oglądałeś.' : 'Ty w ogóle grasz w tej lidze?';
    return (
      <>
        <LabTitle right={progress}>Kto to?</LabTitle>
        <motion.div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="text-[12px] uppercase tracking-[0.4em]" style={{ color: C.muted }}>Wynik</div>
          <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: 'clamp(80px, 16vh, 160px)', color: C.heading, ...font }}>{points}<span className="text-3xl" style={{ color: C.muted }}> / {max}</span></div>
          <div className="text-2xl font-bold" style={{ color: C.text }}>{ok} z {quiz.length} trafionych · {verdict}</div>
          <button type="button" onClick={restart} className="mt-2 rounded-xl px-8 py-4 text-base font-bold uppercase tracking-widest" style={{ background: C.primary, color: '#fff', boxShadow: `0 0 24px ${mix(C.primary, 45)}` }}>Nowy quiz</button>
        </motion.div>
      </>
    );
  }
  if (!q) return <LabTitle>Kto to?</LabTitle>;

  return (
    <>
      <LabTitle sub={<span>im mniej podpowiedzi, tym więcej punktów</span>} right={progress}>Kto to?</LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        {/* Clues */}
        <div className="w-[40%] shrink-0 flex flex-col gap-3 min-h-0">
          <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: C.muted }}>Pytanie {round + 1} / {quiz.length}</div>
          <div className="text-4xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{q.ask}</div>
          <div className="flex flex-col gap-2.5 mt-2">
            {q.clues.map((c, i) => (
              <AnimatePresence key={i}>
                {i < clues ? (
                  <motion.div className="rounded-xl px-4 py-3 text-lg flex items-center gap-3" style={{ background: ink(6), color: C.text, border: `1px solid ${ink(10)}` }}
                    initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}>
                    <span className="text-xs font-bold w-5 shrink-0" style={{ color: C.muted }}>{i + 1}</span><span className="min-w-0">{c}</span>
                  </motion.div>
                ) : (
                  <div className="rounded-xl px-4 py-3 text-lg" style={{ border: `1px dashed ${ink(14)}`, color: C.muted }}>
                    {i === clues && !picked ? <button type="button" onClick={() => setClues(c => c + 1)} className="text-sm uppercase tracking-widest font-bold hover:underline">Pokaż podpowiedź</button> : '···'}
                  </div>
                )}
              </AnimatePresence>
            ))}
          </div>
          {!picked && <div className="text-sm mt-auto" style={{ color: C.muted }}>Trafienie teraz: <b className="text-xl" style={{ color: C.heading }}>{worth}</b> pkt</div>}
        </div>
        {/* Choices / reveal */}
        <div className="relative flex-1 min-w-0 min-h-0">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-4">
            {q.choices.map(ch => {
              const isAns = ch.id === q.answer; const isPick = ch.id === picked;
              const ring = picked ? (isAns ? GOOD : isPick ? BAD : 'transparent') : 'transparent';
              return (
                <motion.button key={`${round}-${ch.id}`} type="button" onClick={() => answer(ch.id)} disabled={!!picked}
                  className="relative rounded-3xl overflow-hidden flex flex-col items-center justify-center gap-3 p-3"
                  style={{ background: ch.render != null ? '#0b0b10' : ink(5), boxShadow: `0 0 0 4px ${ring}, 0 14px 30px rgba(0,0,0,0.25)`, opacity: picked && !isAns && !isPick ? 0.35 : 1 }}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: picked && !isAns && !isPick ? 0.35 : 1, scale: picked && isAns ? 1.03 : 1 }} whileHover={picked ? undefined : { scale: 1.03 }}>
                  {ch.render != null ? (
                    <>
                      <HeroImg heroId={ch.render} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-50" />
                      <div className="absolute inset-x-0 top-2 bottom-12"><HeroRender heroId={ch.render} sizes="360px" /></div>
                      <span className="absolute bottom-3 inset-x-0 text-center text-xl font-bold text-white" style={font}>{ch.name}</span>
                    </>
                  ) : (
                    <>
                      {ch.img(130)}
                      <span className="text-xl font-bold max-w-full truncate" style={{ color: C.heading, ...font }}>{ch.name}</span>
                    </>
                  )}
                  {picked && isAns && <span className="absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-black" style={{ background: GOOD }}>{isPick ? `+${worth}` : 'to ten'}</span>}
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence>
            {picked && (
              <motion.div className="absolute inset-x-0 bottom-4 mx-auto w-max max-w-full z-10 flex items-center gap-3 rounded-2xl px-5 py-3"
                style={{ background: '#0b0b10', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', border: `1px solid ${picked === q.answer ? GOOD : BAD}` }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="text-lg font-bold whitespace-nowrap" style={{ color: picked === q.answer ? GOOD : BAD }}>{picked === q.answer ? 'Dobrze!' : `Nie — to ${q.reveal}`}</span>
                <button type="button" onClick={() => open(q.page)} className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.1)', color: onDark(C.secondary) }}>{REDESIGN_NAMES[q.page - 1]} ›</button>
                <button type="button" onClick={next} className="rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-widest text-white" style={{ background: C.primary }}>{round + 1 < quiz.length ? 'Dalej' : 'Wynik'}</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D44Quiz() {
  return <HubShell render={(m, x) => <Quiz model={m} open={x.open} />} />;
}
