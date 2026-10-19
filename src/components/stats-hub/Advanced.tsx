'use client';

// The advanced index: every view, four columns like the rankings view (players, teams, heroes &
// draft, records & data). Each row is a door with one live finding from its view, so even the
// index says something about the season.

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { Model, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { rankPlayers, topPerfs } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { METRIC_LIST, metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { buildFacts, eloTable } from '@/lib/stats-lab/teasers';
import { profiles, qualified, scored, seasonWeeks } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabView, TeamLogo, WithModel, ink, mix, onDark, useHeaderFont } from '@/components/stats-lab/kit';
import { GROUP_LABEL, PAGES, type PageGroup } from './catalog';
import { useStatsNav } from './nav';

export interface Finding { visual: React.ReactNode; line: React.ReactNode }

const COLUMNS: Array<{ group: PageGroup; ids: string[] }> = [
  { group: 'players', ids: ['dossier', 'gielda', 'tiery', 'blizniacy', 'wyscig'] },
  { group: 'teams', ids: ['elo', 'druzyna-tygodnia', 'odciski', 'kolekcja'] },
  { group: 'heroes', ids: ['bohaterowie', 'draft', 'meta', 'konstelacja'] },
  { group: 'records', ids: ['rekordy', 'liderzy', 'kronika', 'laboratorium'] },
];

const V = 52;
const av = (p?: PlayerX | null) => <Avatar player={p} size={V} />;
const lg = (t?: TeamX | null) => <TeamLogo team={t} size={V} />;
const hero = (id?: number) => (id != null ? <HeroImg heroId={id} className="rounded-lg" style={{ width: V * 1.5, height: V * 0.85 }} /> : null);
const B = ({ children }: { children: React.ReactNode }) => <b style={{ color: C.heading }}>{children}</b>;

/** One live finding per view, for the index rows (also used by overview variants) */
export function findings(model: Model): Record<string, Finding> {
  const out: Record<string, Finding> = {};
  const facts = buildFacts(model);
  const fact = (id: string) => facts.find(f => f.id === id);

  const mvp = rankPlayers(model, 'score', 'avg')[0];
  if (mvp) {
    out.dossier = { visual: av(mvp.player), line: <><B>{mvp.player.name}</B> — {mvp.value.toFixed(1)} pkt na grę, {mvp.player.games} gier</> };
    out.liderzy = { visual: av(mvp.player), line: <>MVP sezonu: <B>{mvp.player.name}</B></> };
  }
  // Form: last three scored games against the season average
  const risers = qualified(model).map(p => {
    const s = scored(p.perfs);
    const last = s.slice(-3);
    const avg = s.reduce((a, x) => a + x.score, 0) / Math.max(1, s.length);
    return { p, d: last.length ? last.reduce((a, x) => a + x.score, 0) / last.length - avg : 0 };
  }).sort((a, b) => b.d - a.d);
  if (risers[0]) out.gielda = { visual: av(risers[0].p), line: <>Największy wzrost formy: <B>{risers[0].p.name}</B> <span style={{ color: C.win }}>+{risers[0].d.toFixed(1)}</span></> };
  // S tier: smoothed win rate of heroes picked at least three times
  const sTier = model.heroes.filter(h => h.picks >= 3).map(h => ({ h, v: (h.wins + 2) / (h.picks + 4) })).sort((a, b) => b.v - a.v).slice(0, 3);
  if (sTier.length) out.tiery = {
    visual: <span className="flex -space-x-2">{sTier.map(x => <HeroImg key={x.h.heroId} heroId={x.h.heroId} variant="icon" className="w-8 h-8 rounded-full ring-2 ring-black" />)}</span>,
    line: <>Tier S: <B>{sTier.map(x => heroName(x.h.heroId)).join(', ')}</B></>,
  };
  // Twins: the two regulars with the closest percentile profiles
  const prof = profiles(model);
  const ids = [...prof.keys()];
  let pair: [string, string] | null = null; let best = Infinity;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = prof.get(ids[i])!; const b = prof.get(ids[j])!;
    const d = Object.keys(a).reduce((s, k) => s + (a[k] - b[k]) ** 2, 0);
    if (d < best) { best = d; pair = [ids[i], ids[j]]; }
  }
  if (pair) {
    const a = model.playerById.get(pair[0]); const b = model.playerById.get(pair[1]);
    out.blizniacy = { visual: <span className="flex -space-x-3"><Avatar player={a} size={40} ring="#000" /><Avatar player={b} size={40} ring="#000" /></span>, line: <><B>{a?.name}</B> gra prawie jak <B>{b?.name}</B></> };
  }
  const race = rankPlayers(model, 'score', 'total')[0];
  if (race) out.wyscig = { visual: av(race.player), line: <>Prowadzi <B>{race.player.name}</B> — {Math.round(race.value)} pkt łącznie</> };

  const elo = eloTable(model)[0];
  if (elo) out.elo = { visual: lg(elo.t), line: <>Na szczycie <B>{elo.t.name}</B> — {Math.round(elo.v)}</> };
  const weeks = seasonWeeks(model);
  const lastWeek = weeks[weeks.length - 1];
  const weekBest = lastWeek ? scored(lastWeek.perfs).sort((a, b) => b.score - a.score)[0] : undefined;
  if (weekBest?.player) out['druzyna-tygodnia'] = { visual: av(weekBest.player), line: <>Ostatni tydzień: <B>{weekBest.player.name}</B> na {heroName(weekBest.heroId)}</> };
  const fighters = [...model.teams].filter(t => t.games.length >= 2).sort((a, b) => b.avg.kills - a.avg.kills)[0];
  if (fighters) out.odciski = { visual: lg(fighters), line: <>Najbardziej krwawi: <B>{fighters.name}</B>, {fighters.avg.kills.toFixed(1)} zabójstw na grę</> };
  const pool = [...model.teams].sort((a, b) => b.heroPicks.length - a.heroPicks.length)[0];
  if (pool) out.kolekcja = { visual: lg(pool), line: <><B>{pool.name}</B> zagrali już {pool.heroPicks.length} bohaterami</> };

  const top = [...model.heroes].sort((a, b) => b.contest - a.contest)[0];
  if (top) out.bohaterowie = { visual: hero(top.heroId), line: <><B>{heroName(top.heroId)}</B> w {top.contest} draftach</> };
  const fp = fact('firstpick');
  if (fp) out.draft = { visual: <span className="text-2xl font-logik-extended-bold" style={{ color: C.heading }}>{fp.big}</span>, line: <>Tyle wygrywa drużyna z <B>pierwszym pickiem</B></> };
  // Hero of the last week: biggest share of drafts in it
  if (lastWeek) {
    const games = new Set(lastWeek.perfs.map(p => p.game));
    const count = new Map<number, number>();
    for (const g of games) for (const x of g.pb) count.set(x[0], (count.get(x[0]) ?? 0) + 1);
    const hot = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    if (hot) out.meta = { visual: hero(hot[0]), line: <>Bohater tygodnia: <B>{heroName(hot[0])}</B> w {hot[1]} z {games.size} draftów</> };
  }
  const duo = fact('duo');
  if (duo) out.konstelacja = { visual: hero(duo.heroId), line: <>Duet sezonu: <B>{duo.title}</B> — {duo.big}</> };

  const kills = topPerfs(model, 'kills', 1)[0];
  if (kills?.player) out.rekordy = { visual: av(kills.player), line: <>Rekord zabójstw: <B>{kills.kills}</B> — {kills.player.name}</> };
  // Most recently broken record
  let latest: { k: MetricKey; name: string; at: number } | null = null;
  for (const k of ['kills', 'assists', 'gpm', 'xpm', 'heroDamage', 'lastHits', 'netWorth', 'towerDamage'] as MetricKey[]) {
    const m = metric(k); let max = -Infinity;
    for (const p of [...model.perfs].filter(x => x.player).sort((a, b) => a.game.start - b.game.start)) {
      const v = m.get(p);
      if (v > max) { max = v; if (!latest || p.game.start > latest.at) latest = { k, name: p.player!.name, at: p.game.start }; }
    }
  }
  if (latest) out.kronika = { visual: <span className="text-xs font-bold uppercase tracking-widest text-center leading-tight" style={{ color: C.heading }}>{metric(latest.k).short}</span>, line: <>Ostatnio padł rekord: <B>{metric(latest.k).label.toLowerCase()}</B> — {latest.name}</> };
  out.laboratorium = { visual: <span className="text-2xl font-logik-extended-bold" style={{ color: C.heading }}>{METRIC_LIST.length}</span>, line: <>statystyk do zestawienia — gracze, drużyny, bohaterowie</> };
  return out;
}

function Row({ id, f, index }: { id: string; f?: Finding; index: number }) {
  const nav = useStatsNav();
  const font = useHeaderFont();
  const page = PAGES.find(p => p.id === id)!;
  const Icon = page.icon;
  return (
    <motion.button type="button" onClick={() => nav?.go(id)}
      className="group shrink-0 h-[clamp(84px,12.5vh,122px)] w-full flex items-center gap-3.5 px-2 rounded-xl text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]"
      style={{ borderBottom: `1px solid ${ink(7)}` }}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <div className="w-[78px] h-[52px] shrink-0 flex items-center justify-center rounded-lg" style={{ background: ink(4) }}>
        {f?.visual ?? <Icon className="w-6 h-6" style={{ color: C.heading }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: onDark(C.secondary, 70) }} />
          <span className="font-logik-extended-bold uppercase text-[15px] leading-tight truncate" style={{ color: C.heading, ...font }}>{page.title}</span>
        </div>
        <div className="text-[11px] leading-snug line-clamp-1 mt-0.5" style={{ color: C.muted }}>{page.blurb}</div>
        {f && <div className="text-xs leading-snug line-clamp-2 mt-1" style={{ color: C.text }}>{f.line}</div>}
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 opacity-30 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" style={{ color: C.heading }} />
    </motion.button>
  );
}

function AdvancedBody({ model }: { model: Model }) {
  const font = useHeaderFont();
  const f = useMemo(() => findings(model), [model]);
  return (
    <div className="flex-1 min-h-0 grid gap-6 max-xl:overflow-y-auto max-xl:auto-rows-max grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map(col => (
        <div key={col.group} className="min-h-0 flex flex-col">
          <div className="text-center mb-2 shrink-0">
            <h3 className="text-xs font-logik-extended-bold uppercase tracking-widest" style={{ color: C.heading, ...font }}>{GROUP_LABEL[col.group]}</h3>
            <div className="h-px mt-1.5" style={{ background: `linear-gradient(to right, transparent, ${mix(C.primary, 50)}, transparent)` }} />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {col.ids.map((id, k) => <Row key={id} id={id} f={f[id]} index={k} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Advanced() {
  return (
    <LabView className="!pt-0">
      <WithModel>{m => <AdvancedBody model={m} />}</WithModel>
    </LabView>
  );
}
