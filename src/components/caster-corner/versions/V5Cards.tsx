'use client';

// Version 5 — "Fiszki": for the caster who does not know these players yet. Learn them one card at
// a time (face, nick and how to say it, team, position, signature hero, the three things worth
// knowing; turn the card for the rest), test yourself (who is this? who plays mid? whose fact is
// this?), then cast with the cheat sheet — ten faces with one line each. ← → move, space turns,
// Enter marks a player as known.

import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { C, HeroRender, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { RoleTag } from '@/components/draft-prep/role';
import { roleLabel } from '@/lib/draft-prep/engine';
import { heroName } from '@/lib/stats-lab/heroes';
import { count } from '@/lib/plural';
import { cn } from '@/lib/utils';
import { FACT_KIND_LABEL, factsAbout, type Fact, type FactKind, type PlayerBrief, type TeamBrief } from '@/lib/caster-corner/brief';
import { noteKey, useCorner, useLocal } from '../data';
import { AskBuilder, Crest, Face, FactRow, FitName, HeroChip, MatchSwitch, NoteField, nf0, nf1, when } from '../ui';
import { signature, useTeamColors } from '../parts';

type Mode = 'learn' | 'quiz' | 'sheet';
const MODE_LABEL: Record<Mode, string> = { learn: 'Nauka', quiz: 'Sprawdź się', sheet: 'Ściąga' };
const FRONT_KINDS: FactKind[] = ['forma', 'rekord', 'draft', 'historia', 'rankedy', 'ciekawostka', 'linia'];

function useDeck() {
  const { brief } = useCorner();
  return useMemo(() => [...brief.a.players, ...brief.b.players], [brief]);
}
const teamOf = (p: PlayerBrief, a: TeamBrief, b: TeamBrief) => (p.side === 'a' ? a : b);

function Card({ p, flipped, colors, kinds, onFlip }: { p: PlayerBrief; flipped: boolean; colors: [string, string]; kinds: FactKind[]; onFlip: () => void }) {
  const { brief } = useCorner();
  const font = useHeaderFont();
  const t = teamOf(p, brief.a, brief.b);
  const color = colors[p.side === 'a' ? 0 : 1];
  const all = factsAbout(brief, p.side, p.id);
  const front = all.filter(f => kinds.includes(f.kind)).slice(0, 3);
  const sig = signature(p, 1)[0];
  return (
    <div className="relative w-full h-full rounded-[22px] overflow-hidden text-white" style={{ background: '#0b0b10', boxShadow: `0 30px 80px -30px ${mix(color, 60)}` }}>
      {t.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.logoUrl} alt="" aria-hidden className="absolute -left-[10%] top-1/2 -translate-y-1/2 w-[70%] h-[160%] object-cover opacity-55" style={{ filter: 'blur(70px) saturate(1.7)' }} />
      )}
      {sig && <div className="absolute right-0 bottom-0 w-[48%] h-[96%] opacity-[0.22]"><HeroRender heroId={sig.hero} sizes="600px" /></div>}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(0,0,0,0.25), rgba(0,0,0,0.82) 48%, rgba(0,0,0,0.7))' }} />
      <div className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ background: color }} />

      <div className="relative h-full grid grid-cols-[420px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center px-10 text-center">
          <Face p={p} size={230} ring={p.standin ? '#ffd27a' : 'rgba(255,255,255,0.18)'} />
          <FitName text={p.name} max={46} min={24} lines={2} className="mt-6 font-logik-extended-bold uppercase text-center" style={font} />
          <div className="mt-2 w-full max-w-[300px]"><NoteField k={noteKey.say(p.id)} rows={1} placeholder="Jak to wymówić?" className="text-center text-[15px] italic" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} /></div>
          <div className="mt-4 flex items-center gap-2.5 text-[14px] text-white/80"><Crest t={t} size={26} />{t.name}</div>
          <div className="mt-2 text-[14px] text-white/80"><RoleTag role={p.role} /></div>
          {p.standin && <div className="mt-2 text-[13px]" style={{ color: '#ffd27a' }}>standin za {p.standin.replacesName}</div>}
        </div>

        <div className="min-w-0 flex flex-col justify-center pr-14 py-10">
          {!flipped ? (
            <>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-white/70">
                {p.mmr && <span><b className="text-white text-[22px] mr-1.5 tabular-nums">{nf0(p.mmr)}</b>MMR</span>}
                {p.pubs?.rank && <span><b className="text-white text-[22px] mr-1.5">{p.pubs.rank}</b></span>}
                {p.games > 0 && <span><b className="text-white text-[22px] mr-1.5 tabular-nums">{p.wins}:{p.games - p.wins}</b>w turnieju</span>}
                {p.score != null && <span><b className="text-white text-[22px] mr-1.5 tabular-nums">{nf1(p.score)}</b>PF{p.roleRank && ` (${p.roleRank.rank}. z ${p.roleRank.of})`}</span>}
              </div>
              {sig && <div className="mt-6 text-[15px] text-white/80">Znak rozpoznawczy: <b className="text-white">{heroName(sig.hero)}</b> <span className="text-white/55">({count(sig.g, 'gra', 'gry', 'gier')}{sig.pub ? ' poza turniejem' : `, ${sig.w}:${sig.g - sig.w}`})</span></div>}
              <div className="mt-8 space-y-5">
                {front.length ? front.map(f => <p key={f.id} className="text-[21px] leading-snug font-bold text-white">{f.text}</p>)
                  : <p className="text-[19px] text-white/60">{p.games ? 'Bez wyróżniających się liczb — zajrzyj na drugą stronę.' : 'Pierwsze gry na tej stronie. Notatka poniżej to dobre miejsce na to, co powiedział kapitan.'}</p>}
              </div>
              <div className="mt-8"><NoteField k={noteKey.player(p.id)} rows={2} placeholder="Twoja notatka…" className="text-[15px]" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} /></div>
            </>
          ) : (
            <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 max-h-full">
              {p.heroes.length > 0 && <div><Kick>W turnieju</Kick><div className="flex flex-wrap gap-2.5">{p.heroes.slice(0, 7).map(h => <HeroChip key={h.heroId} hero={h.heroId} g={h.games} w={h.wins} size={62} />)}</div></div>}
              {p.pubs && <div><Kick>Poza turniejem · {count(p.pubs.d30, 'gra', 'gry', 'gier')} w 30 dni</Kick><div className="flex flex-wrap gap-2.5">{p.pubs.top.map(h => <HeroChip key={h.hero} hero={h.hero} g={h.g} w={h.w} size={62} />)}</div></div>}
              {p.career.length > 0 && <div><Kick>Wcześniej</Kick>{p.career.map(c => <div key={c.key} className="text-[15px] text-white/85 py-0.5"><b className="text-white">{c.teamName}</b> · {c.tournament} · {count(c.games, 'gra', 'gry', 'gier')}, {Math.round(c.wins / c.games * 100)}% wygranych</div>)}</div>}
              <div><Kick>Wszystko o graczu</Kick><div className="space-y-1.5 [&_*]:!text-white">{all.map(f => <FactRow key={f.id} f={f} />)}</div></div>
            </div>
          )}
        </div>
      </div>
      <button type="button" onClick={onFlip} className="absolute right-6 bottom-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/70 hover:text-white">
        <RotateCcw className="w-3.5 h-3.5" />{flipped ? 'Przód' : 'Odwróć'}
      </button>
    </div>
  );
}
const Kick = ({ children }: { children: React.ReactNode }) => <div className="text-[10px] uppercase tracking-[0.22em] text-white/55 mb-2">{children}</div>;

function Learn({ colors, kinds }: { colors: [string, string]; kinds: FactKind[] }) {
  const { store, brief } = useCorner();
  const deck = useDeck();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useLocal<string[]>(`${store}:v5:known`, []);
  const p = deck[Math.min(i, deck.length - 1)];
  const go = (n: number) => { setI(((n % deck.length) + deck.length) % deck.length); setFlipped(false); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return;
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
      if (e.key === 'Enter' && p) setKnown(x => (x.includes(p.id) ? x : [...x, p.id]));
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  if (!p) return null;
  const isKnown = known.includes(p.id);
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 px-[calc(var(--pad)+40px)]"><Card p={p} flipped={flipped} colors={colors} kinds={kinds} onFlip={() => setFlipped(f => !f)} /></div>
      <div className="shrink-0 px-[var(--pad)] pt-6 flex items-center gap-8">
        {[brief.a, brief.b].map((t, ti) => (
          <div key={t.id} className="flex items-center gap-3">
            <Crest t={t} size={30} />
            {deck.map((q, qi) => q.side !== t.side ? null : (
              <button key={q.id} type="button" onClick={() => go(qi)} className="relative" title={q.name}>
                <Face p={q} size={qi === i ? 58 : 46} ring={qi === i ? colors[ti] : undefined} className={cn('transition-all', qi !== i && 'opacity-60 hover:opacity-100')} />
                {known.includes(q.id) && <span className="absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: C.win }}><Check className="w-2.5 h-2.5 text-black" /></span>}
              </button>
            ))}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-6">
          <span className="text-[13px] tabular-nums" style={{ color: C.muted }}>Znasz {known.filter(k => deck.some(d => d.id === k)).length} z {deck.length}</span>
          <button type="button" onClick={() => setKnown(x => (isKnown ? x.filter(k => k !== p.id) : [...x, p.id]))} className="inline-flex items-center gap-2 h-10 px-6 rounded-full text-[12px] font-bold uppercase tracking-widest text-white" style={{ background: isKnown ? C.win : C.primary }}>
            <Check className="w-4 h-4" />{isKnown ? 'Znam' : 'Zapamiętane'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────

type Q = { kind: 'face'; p: PlayerBrief; options: PlayerBrief[] } | { kind: 'role'; p: PlayerBrief; options: string[] } | { kind: 'fact'; p: PlayerBrief; f: Fact; options: PlayerBrief[] };
const shuffle = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

function makeQ(deck: PlayerBrief[], facts: Fact[]): Q | null {
  if (deck.length < 4) return null;
  const p = deck[Math.floor(Math.random() * deck.length)];
  const others = shuffle(deck.filter(q => q.id !== p.id)).slice(0, 3);
  const r = Math.random();
  const pf = facts.filter(f => f.player === p.id && f.text.includes(p.name));
  if (r < 0.34 && pf.length) return { kind: 'fact', p, f: pf[Math.floor(Math.random() * pf.length)], options: shuffle([p, ...others]) };
  if (r < 0.6 && p.role) return { kind: 'role', p, options: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] };
  return { kind: 'face', p, options: shuffle([p, ...others]) };
}

function Quiz({ colors }: { colors: [string, string] }) {
  const { brief } = useCorner();
  const font = useHeaderFont();
  const deck = useDeck();
  const [q, setQ] = useState<Q | null>(() => makeQ(deck, brief.facts));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ ok: 0, all: 0 });
  useEffect(() => { setQ(makeQ(deck, brief.facts)); setPicked(null); }, [deck, brief.facts]);
  if (!q) return <div className="h-full flex items-center justify-center" style={{ color: C.muted }}>Za mało graczy na quiz.</div>;
  const right = q.kind === 'role' ? q.p.role! : q.p.id;
  const choose = (v: string) => {
    if (picked) return;
    setPicked(v); setScore(s => ({ ok: s.ok + (v === right ? 1 : 0), all: s.all + 1 }));
    setTimeout(() => { setQ(makeQ(deck, brief.facts)); setPicked(null); }, v === right ? 900 : 2200);
  };
  const t = teamOf(q.p, brief.a, brief.b);
  const state = (v: string) => (!picked ? 'idle' : v === right ? 'right' : v === picked ? 'wrong' : 'dim');
  const ring = (v: string) => ({ right: C.win, wrong: C.loss, dim: 'transparent', idle: 'transparent' }[state(v)]);
  return (
    <div className="h-full flex flex-col items-center justify-center px-[var(--pad)]">
      <div className="text-[13px] tabular-nums mb-6" style={{ color: C.muted }}>{score.all ? `${score.ok} z ${score.all} dobrze` : 'Pytania z dziesięciu graczy tego meczu'}</div>
      {q.kind === 'face' && (<>
        <Face p={q.p} size={220} />
        <div className="mt-4 flex items-center gap-2 text-[15px]" style={{ color: C.text }}><Crest t={t} size={24} />{t.name}</div>
        <div className="mt-2 font-logik-extended-bold uppercase text-[26px]" style={{ color: C.heading, ...font }}>Kto to?</div>
        <div className="mt-6 flex gap-4">
          {q.options.map(o => (
            <button key={o.id} type="button" onClick={() => choose(o.id)} className="h-14 px-8 rounded-full text-[17px] font-bold transition-colors"
              style={{ background: state(o.id) === 'right' ? C.win : state(o.id) === 'wrong' ? C.loss : ink(8), color: state(o.id) === 'right' || state(o.id) === 'wrong' ? '#000' : C.heading, opacity: state(o.id) === 'dim' ? 0.4 : 1 }}>{o.name}</button>
          ))}
        </div>
      </>)}
      {q.kind === 'role' && (<>
        <Face p={q.p} size={160} />
        <div className="mt-5 font-logik-extended-bold uppercase text-[30px] text-center" style={{ color: C.heading, ...font }}>Na jakiej pozycji gra {q.p.name}?</div>
        <div className="mt-2 flex items-center gap-2 text-[14px]" style={{ color: C.muted }}><Crest t={t} size={20} />{t.name}</div>
        <div className="mt-7 flex gap-4">
          {q.options.map(o => (
            <button key={o} type="button" onClick={() => choose(o)} className="h-14 px-7 rounded-full text-[16px] font-bold"
              style={{ background: state(o) === 'right' ? C.win : state(o) === 'wrong' ? C.loss : ink(8), color: state(o) === 'right' || state(o) === 'wrong' ? '#000' : C.heading, opacity: state(o) === 'dim' ? 0.4 : 1 }}>
              <RoleTag role={o} label={false} /> {roleLabel(o)}
            </button>
          ))}
        </div>
      </>)}
      {q.kind === 'fact' && (<>
        <div className="font-logik-extended-bold uppercase text-[22px]" style={{ color: C.muted, ...font }}>O kim to?</div>
        <p className="mt-5 max-w-[980px] text-center text-[30px] leading-snug font-bold" style={{ color: C.heading }}>{q.f.text.split(q.p.name).join(picked ? q.p.name : '_____')}</p>
        <div className="mt-9 flex gap-10">
          {q.options.map(o => (
            <button key={o.id} type="button" onClick={() => choose(o.id)} className="flex flex-col items-center gap-2.5" style={{ opacity: state(o.id) === 'dim' ? 0.35 : 1 }}>
              <Face p={o} size={120} ring={ring(o.id)} />
              <span className="text-[15px] font-bold" style={{ color: C.heading }}>{o.name}</span>
              <span className="text-[12px]" style={{ color: colors[o.side === 'a' ? 0 : 1] }}>{teamOf(o, brief.a, brief.b).name}</span>
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}

// ── Cheat sheet ───────────────────────────────────────────────────────────

function Sheet({ colors, kinds }: { colors: [string, string]; kinds: FactKind[] }) {
  const { brief, notes } = useCorner();
  const font = useHeaderFont();
  return (
    <div className="h-full flex flex-col gap-5 px-[var(--pad)]">
      {[brief.a, brief.b].map((t, ti) => (
        <div key={t.id} className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-3 mb-3"><Crest t={t} size={34} /><span className="font-logik-extended-bold uppercase text-[20px]" style={{ color: colors[ti], ...font }}>{t.name}</span><span className="flex-1 h-px" style={{ background: ink(10) }} /></div>
          <div className="flex-1 min-h-0 grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.max(5, t.players.length)}, minmax(0,1fr))` }}>
            {t.players.map(p => {
              const facts = factsAbout(brief, p.side, p.id).filter(f => kinds.includes(f.kind));
              const sig = signature(p, 3);
              return (
                <div key={p.id} className="min-w-0 min-h-0 flex flex-col">
                  <div className="flex items-center gap-3">
                    <Face p={p} size={76} ring={p.standin ? '#ffd27a' : undefined} />
                    <div className="min-w-0 flex-1">
                      <FitName text={p.name} max={21} min={12} className="font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }} />
                      <div className="mt-1 text-[12px] truncate" style={{ color: C.muted }}><RoleTag role={p.role} /></div>
                      {notes[noteKey.say(p.id)] && <div className="text-[12px] italic truncate" style={{ color: colors[ti] }}>„{notes[noteKey.say(p.id)]}”</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1.5">{sig.map(h => <HeroChip key={h.hero} hero={h.hero} g={h.g} w={h.w} size={50} />)}</div>
                  {notes[noteKey.player(p.id)] && <div className="mt-2.5 text-[13.5px] italic leading-snug" style={{ color: colors[ti] }}>{notes[noteKey.player(p.id)]}</div>}
                  <div className="mt-2.5 space-y-2 min-h-0 overflow-hidden">
                    {facts.slice(0, 3).map((f, fi) => <div key={f.id} className="text-[13.5px] leading-snug line-clamp-3" style={{ color: fi ? C.muted : C.text }}>{f.text}</div>)}
                    {!facts.length && !p.games && <div className="text-[13.5px]" style={{ color: C.muted }}>Pierwsze gry w turnieju.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function V5Cards() {
  const { brief, store, match } = useCorner();
  const colors = useTeamColors(brief);
  const [mode, setMode] = useLocal<Mode>(`${store}:v5:mode`, 'learn');
  const [kinds, setKinds] = useLocal<FactKind[]>(`${store}:v5:kinds`, FRONT_KINDS);
  const [ask, setAsk] = useState(false);
  return (
    <div className="h-full flex flex-col py-6">
      <div className="shrink-0 px-[var(--pad)] flex items-center gap-8 mb-5">
        <MatchSwitch big />
        <span className="text-[12px]" style={{ color: C.muted }}>{when(match.scheduledFor)} · Bo{match.bestOf}</span>
        <div className="flex gap-6 text-[15px] ml-6">
          {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="font-bold underline decoration-2 underline-offset-[7px]" style={{ color: mode === m ? C.heading : C.muted, textDecorationColor: mode === m ? C.primary : 'transparent' }}>{MODE_LABEL[m]}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-x-3 text-[12px]">
          {mode !== 'quiz' && FRONT_KINDS.map(k => {
            const on = kinds.includes(k);
            return <button key={k} type="button" onClick={() => setKinds(on ? kinds.filter(x => x !== k) : [...kinds, k])} className="underline decoration-2 underline-offset-[5px]" style={{ color: on ? C.heading : C.muted, textDecorationColor: on ? C.primary : 'transparent' }}>{FACT_KIND_LABEL[k]}</button>;
          })}
          <button type="button" onClick={() => setAsk(a => !a)} className="ml-4 font-bold uppercase tracking-widest text-[11px] hover:underline underline-offset-4" style={{ color: C.primary }}>{ask ? 'Zamknij' : 'Zapytaj'}</button>
        </div>
      </div>
      {ask && <div className="shrink-0 px-[var(--pad)] pb-5 mb-2 border-b" style={{ borderColor: ink(10) }}><AskBuilder compact /></div>}
      <div className="flex-1 min-h-0">
        {mode === 'learn' && <Learn colors={colors} kinds={kinds} />}
        {mode === 'quiz' && <Quiz colors={colors} />}
        {mode === 'sheet' && <Sheet colors={colors} kinds={kinds} />}
      </div>
    </div>
  );
}
