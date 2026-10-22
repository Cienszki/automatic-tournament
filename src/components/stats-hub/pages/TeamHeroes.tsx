'use client';

// Team hero collection (was #85, which did this per player). Every hero in the game is a slot,
// lit once the team has played it this season — with games, wins and which of its players brought
// it; the heroes it banned most and had banned against it ring the slots. The list on the left
// ranks the teams by how many heroes they have shown.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf, TeamX } from '@/lib/stats-lab/derive';
import { ATTR_COLOR, heroAttr, heroName, type HeroAttr } from '@/lib/stats-lab/heroes';
import { getAllHeroData } from '@/lib/hero-mapping';
import { fmtDay } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize } from '@/components/stats-lab/kit';
import { logo, portrait, type Asset } from '../assets';
import { count, plural } from '@/lib/plural';

const ATTRS: Array<{ a: HeroAttr; label: string }> = [{ a: 'str', label: 'Siła' }, { a: 'agi', label: 'Zręczność' }, { a: 'int', label: 'Inteligencja' }, { a: 'all', label: 'Uniwersalni' }];
const BAN = '#e5534b';

interface Slot { games: number; wins: number; players: Map<string, { name: string; n: number }>; first: Perf }

function teamSlots(t: TeamX): Map<number, Slot> {
  const m = new Map<number, Slot>();
  const perfs = t.games.flatMap(g => g.perfs.filter(p => p.tid === t.id)).sort((a, b) => a.game.start - b.game.start);
  for (const p of perfs) {
    const s = m.get(p.heroId) ?? { games: 0, wins: 0, players: new Map(), first: p };
    s.games++; if (p.win) s.wins++;
    const who = p.player?.name ?? '?';
    const e = s.players.get(p.pid) ?? { name: who, n: 0 }; e.n++; s.players.set(p.pid, e);
    m.set(p.heroId, s);
  }
  return m;
}

function TeamCollection({ model }: { model: Model }) {
  const font = useHeaderFont();
  const allHeroes = useMemo(() => Object.values(getAllHeroData()).map(h => h.id).sort((a, b) => heroName(a).localeCompare(heroName(b))), []);
  const groups = useMemo(() => ATTRS.map(g => ({ ...g, ids: allHeroes.filter(id => heroAttr(id) === g.a) })), [allHeroes]);
  const teams = useMemo(() => model.teams.filter(t => t.games.length > 0).sort((a, b) => b.heroPicks.length - a.heroPicks.length || b.games.length - a.games.length), [model]);
  const [selId, setSel] = useState<string | null>(null);
  const t = teams.find(x => x.id === selId) ?? teams[0];
  const [mode, setMode] = useState<'picks' | 'bans'>('picks');
  const [listRef, fit] = useFitCount<HTMLDivElement>(50, 4, 3);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(teams.length / fit)); const pg = Math.min(page, pages - 1);
  const slots = useMemo(() => (t ? teamSlots(t) : new Map<number, Slot>()), [t]);
  const bansBy = useMemo(() => new Map((t?.bansBy ?? []).map(b => [b.heroId, b.count])), [t]);
  const bansAgainst = useMemo(() => new Map((t?.bansAgainst ?? []).map(b => [b.heroId, b.count])), [t]);
  const newest = useMemo(() => [...slots.values()].sort((a, b) => b.first.game.start - a.first.game.start)[0], [slots]);
  const favourite = t?.heroPicks[0];
  const [ref, box] = useSize<HTMLDivElement>();
  let tw = 30;
  for (let w = 96; w >= 28; w -= 2) {
    const per = Math.max(1, Math.floor((box.w - 30 + 3) / (w + 3)));
    const h = groups.reduce((s, g) => s + Math.ceil(g.ids.length / per) * (w * 0.56 + 3) + 8, 0);
    if (h <= box.h) { tw = w; break; }
  }
  const pct = t ? slots.size / allHeroes.length : 0;

  return (
    <>
      <LabTitle sub={<span>{count(allHeroes.length, 'bohater', 'bohaterów', 'bohaterów')} w grze · iloma zagrała każda drużyna</span>}
        right={<Seg size="sm" value={mode} onChange={setMode} options={[{ value: 'picks', label: 'Zagrane', tip: 'Bohaterowie, którymi drużyna zagrała' }, { value: 'bans', label: 'Bany', tip: 'Kogo drużyna banuje (czerwona ramka) i kogo banują jej rywale (liczba)' }]} />}>
        Kolekcja bohaterów
      </LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div className="w-[270px] shrink-0 flex flex-col min-h-0">
          <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-1">
            {teams.slice(pg * fit, pg * fit + fit).map((x, k) => {
              const on = x === t;
              return (
                <button key={x.id} type="button" onClick={() => setSel(x.id)} className="h-[50px] shrink-0 flex items-center gap-2.5 rounded-xl px-2 text-left"
                  style={{ background: on ? mix(C.primary, 40) : ink(4), boxShadow: on ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                  <span className="w-5 text-xs font-bold tabular-nums" style={{ color: C.muted }}>{pg * fit + k + 1}</span>
                  <TeamLogo team={x} size={36} />
                  <span className="flex-1 min-w-0 truncate font-bold text-sm">{x.name}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: C.heading }}>{x.heroPicks.length}</span>
                </button>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2 mt-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-8 h-8 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-14 text-center" style={{ color: C.muted }}>{pg + 1} / {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-8 h-8 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          {t && (
            <AnimatePresence mode="wait">
              <motion.div key={t.id} className="shrink-0 flex items-center gap-5" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="relative w-[96px] h-[96px] shrink-0">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90"><circle cx="50" cy="50" r="46" fill="none" stroke={ink(10)} strokeWidth="6" /><motion.circle cx="50" cy="50" r="46" fill="none" stroke={C.secondary} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 46} initial={{ strokeDashoffset: 2 * Math.PI * 46 }} animate={{ strokeDashoffset: 2 * Math.PI * 46 * (1 - pct) }} transition={{ duration: 0.9 }} /></svg>
                  <div className="absolute inset-[14px] flex items-center justify-center"><TeamLogo team={t} size={68} /></div>
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{t.name}</div>
                  <div className="text-sm" style={{ color: C.muted }}>{t.games.length} {plural(t.games.length, 'gra', 'gry', 'gier')} · {t.wins}–{t.losses}</div>
                </div>
                <div className="ml-4"><div className="text-4xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{slots.size}<span className="text-xl" style={{ color: C.muted }}> / {allHeroes.length}</span></div><div className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>{Math.round(pct * 100)}% kolekcji</div></div>
                <div className="ml-auto flex items-center gap-3">
                  {favourite && (
                    <Tip content={`${count(favourite.games, 'gra', 'gry', 'gier')} · ${count(favourite.wins, 'wygrana', 'wygrane', 'wygranych')}`}>
                      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-help" style={{ background: ink(5) }}>
                        <HeroImg heroId={favourite.heroId} className="rounded-md" style={{ width: 72, height: 40 }} />
                        <div className="leading-tight"><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Ulubiony</div><div className="font-bold" style={{ color: C.heading }}>{heroName(favourite.heroId)}</div></div>
                      </div>
                    </Tip>
                  )}
                  {newest && (
                    <Tip content={`Pierwszy raz: ${fmtDay(newest.first.game.start)} · zagrał ${newest.first.player?.name ?? '?'}`}>
                      <div className="hidden xl:flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-help" style={{ background: ink(5) }}>
                        <HeroImg heroId={newest.first.heroId} className="rounded-md" style={{ width: 72, height: 40 }} />
                        <div className="leading-tight"><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Najnowszy</div><div className="font-bold" style={{ color: C.heading }}>{heroName(newest.first.heroId)}</div></div>
                      </div>
                    </Tip>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
          <div ref={ref} className="flex-1 min-h-0 flex flex-col">
            {box.w > 0 && groups.map(g => (
              <div key={g.a} className="flex gap-2 mb-2">
                <Tip content={`${g.label}: ${g.ids.filter(id => slots.has(id)).length} / ${g.ids.length}`}><div className="w-[22px] shrink-0 rounded-md cursor-help" style={{ background: `linear-gradient(180deg, ${ATTR_COLOR[g.a]}, transparent)` }} /></Tip>
                <div className="flex-1 flex flex-wrap gap-[3px]">
                  {g.ids.map(id => {
                    const s = slots.get(id);
                    const by = bansBy.get(id); const against = bansAgainst.get(id);
                    const lit = mode === 'picks' ? !!s : !!(by || against);
                    const who = s ? [...s.players.values()].sort((a, b) => b.n - a.n).map(p => `${p.name} (${p.n})`).join(', ') : '';
                    return (
                      <Tip key={id} content={
                        <TipBody title={heroName(id)}>
                          {s ? `${s.games} ${plural(s.games, 'gra', 'gry', 'gier')} · ${count(s.wins, 'wygrana', 'wygrane', 'wygranych')} · ${who}` : 'jeszcze nie zagrany'}
                          {(by || against) ? <><br />{by ? `banowany przez drużynę ${by}×` : ''}{by && against ? ' · ' : ''}{against ? `banowany przeciw niej ${against}×` : ''}</> : null}
                        </TipBody>
                      }>
                        <motion.span className="relative block rounded overflow-hidden" style={{ width: tw, height: tw * 0.56, boxShadow: mode === 'bans' && by ? `inset 0 0 0 2px ${BAN}` : undefined }}
                          initial={false} animate={{ opacity: lit ? 1 : 0.25 }} whileHover={{ scale: 1.2, zIndex: 5 }}>
                          <HeroImg heroId={id} className="w-full h-full" style={{ filter: lit ? undefined : 'grayscale(1)' }} />
                          {mode === 'picks' && s && s.games > 1 && <span className="absolute bottom-0 right-0 px-1 text-[9px] font-bold bg-black/75 text-white rounded-tl">{s.games}</span>}
                          {mode === 'bans' && against ? <span className="absolute bottom-0 right-0 px-1 text-[9px] font-bold text-white rounded-tl" style={{ background: 'rgba(229,83,75,0.85)' }}>{against}</span> : null}
                          {mode === 'picks' && s && s.players.size === 1 && tw >= 54 && (
                            <span className="absolute top-0.5 left-0.5"><Avatar player={model.playerById.get([...s.players.keys()][0])} size={Math.round(tw * 0.22)} /></span>
                          )}
                        </motion.span>
                      </Tip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function assets(model: Model): Asset[] {
  const ids = Object.values(getAllHeroData()).map(h => h.id);
  return [...model.teams.flatMap(logo), ...ids.flatMap(portrait)];
}

export default function TeamHeroes() {
  return <LabView><WithModel>{m => <TeamCollection model={m} />}</WithModel></LabView>;
}
