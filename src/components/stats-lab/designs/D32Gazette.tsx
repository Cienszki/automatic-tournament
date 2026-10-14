'use client';

// #32 — Tournament gazette. The stats as a newspaper front page: masthead, a lead story about the
// MVP, a "latest result" box, record column, the roast of the week, a mini table and the "weather
// on the map" (Radiant vs Dire). Every piece ends in "Więcej ›" which opens the full page here.

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import type { Model } from '@/lib/stats-lab/derive';
import { opponentOf, rankPlayers, topPerfs } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock, metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { BINGO_EVENTS, hitName } from '@/lib/stats-lab/bingo';
import { Avatar, C, HeroImg, HeroRender, LabView, TeamLogo, Tip, WithModel, ink, useHeaderFont } from '../kit';
import { useExpander } from '../hub';

const More = ({ n, open, label = 'Więcej' }: { n: number; open: (n: number) => void; label?: string }) => (
  <button type="button" onClick={() => open(n)} className="text-[11px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: C.primary }}>{label} ›</button>
);
const Rule = ({ thick }: { thick?: boolean }) => <div className="shrink-0" style={{ height: thick ? 3 : 1, background: thick ? C.text : ink(20) }} />;
const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-bold uppercase tracking-[0.3em] pb-1 mb-2" style={{ borderBottom: `1px solid ${ink(20)}` }}>{children}</div>
);

function elo(model: Model) {
  const r = new Map(model.teams.map(t => [t.id, 1500]));
  for (const g of model.games) {
    const a = r.get(g.radiant) ?? 1500; const b = r.get(g.dire) ?? 1500;
    const e = 1 / (1 + Math.pow(10, (b - a) / 400)); const s = g.radiantWin ? 1 : 0;
    r.set(g.radiant, a + 32 * (s - e)); r.set(g.dire, b + 32 * ((1 - s) - (1 - e)));
  }
  return model.teams.map(t => ({ t, v: r.get(t.id) ?? 1500 })).sort((x, y) => y.v - x.v);
}

function Gazette({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { tournament } = useTournament();
  const { open, node } = useExpander();

  const d = useMemo(() => {
    const mvp = rankPlayers(model, 'score', 'avg')[0];
    const mvpHero = mvp?.player.heroes[0]?.heroId;
    const last = model.games[model.games.length - 1];
    const records = (['kills', 'gpm', 'heroDamage', 'wards'] as MetricKey[]).map(k => ({ k, p: topPerfs(model, k, 1)[0] })).filter(x => x.p);
    const roasts = BINGO_EVENTS.filter(e => e.tone === 'roast').map(e => ({ e, hits: e.find(model) })).filter(x => x.hits.length);
    const roast = roasts.sort((a, b) => b.hits[b.hits.length - 1].game.start - a.hits[a.hits.length - 1].game.start)[0];
    const radiantWr = model.games.filter(g => g.radiantWin).length / Math.max(1, model.games.length);
    return { mvp, mvpHero, last, records, roast, table: elo(model).slice(0, 5), radiantWr, hero: model.heroes[0] };
  }, [model]);
  const today = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="relative h-full w-full">
      <LabView>
        {/* Masthead */}
        <div className="shrink-0 text-center">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em]" style={{ color: C.muted }}>
            <span>{today}</span><span>Wydanie nr {model.games.length}</span>
          </div>
          <div className="text-4xl md:text-5xl font-logik-extended-bold uppercase tracking-tight leading-none mt-1" style={{ color: C.title, ...font }}>Gazeta Turniejowa</div>
          <div className="text-[11px] uppercase tracking-[0.35em] mt-1" style={{ color: C.muted }}>{tournament?.name}</div>
        </div>
        <div className="mt-2 flex flex-col gap-[3px]"><Rule thick /><Rule /></div>

        <div className="flex-1 min-h-0 grid gap-5 mt-3" style={{ gridTemplateColumns: '1.55fr 1fr 1fr' }}>
          {/* Lead story */}
          {d.mvp && (
            <article className="min-h-0 flex flex-col">
              <Section>Temat numeru</Section>
              <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden" style={{ background: '#0d0d12' }}>
                {d.mvpHero && <HeroImg heroId={d.mvpHero} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-45" />}
                {d.mvpHero && <motion.div className="absolute top-3 bottom-0 right-[-8%] w-[82%]" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8 }}><HeroRender heroId={d.mvpHero} sizes="35vw" priority /></motion.div>}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(8,8,12,0.92), rgba(8,8,12,0.35) 60%, transparent), linear-gradient(0deg, rgba(8,8,12,0.9), transparent 45%)' }} />
                <div className="relative h-full flex flex-col justify-end p-5 text-white gap-2">
                  <Avatar player={d.mvp.player} size={76} ring={C.secondary} />
                  <h3 className="text-3xl xl:text-4xl font-logik-extended-bold uppercase leading-[1.05]" style={font}>{d.mvp.player.name} rządzi ligą</h3>
                  <p className="text-sm text-white/80 max-w-[55%] leading-snug">
                    {d.mvp.value.toFixed(2)} punktu występu na grę, {Math.round(d.mvp.player.wr * 100)}% wygranych w {d.mvp.player.games} grach{d.mvpHero ? `, a najczęściej na ${heroName(d.mvpHero)}` : ''}. {d.mvp.player.team ? `Filar drużyny ${d.mvp.player.team.name}.` : ''}
                  </p>
                  <div className="flex gap-4 mt-1"><More n={2} open={open} label="Pełny ranking" /><More n={16} open={open} label="Dossier" /></div>
                </div>
              </div>
            </article>
          )}

          {/* Middle column */}
          <div className="min-h-0 flex flex-col gap-4">
            {d.last && (
              <article>
                <Section>Z ostatniej chwili</Section>
                <div className="flex items-center justify-between gap-2">
                  {[d.last.radiantTeam, d.last.direTeam].map((t, i) => {
                    const won = (i === 0) === d.last.radiantWin;
                    return (
                      <div key={i} className="flex-1 min-w-0 flex flex-col items-center text-center gap-1" style={{ opacity: won ? 1 : 0.6 }}>
                        <TeamLogo team={t} size={52} />
                        <span className="text-sm font-bold truncate max-w-full">{t?.name}</span>
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: won ? C.win : C.muted }}>{won ? 'wygrana' : 'porażka'}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center text-sm mt-1" style={{ color: C.muted }}>{d.last.radiantKills}:{d.last.direKills} w zabójstwach · {fmtClock(d.last.duration)}{d.last.mvp?.player ? ` · MVP ${d.last.mvp.player.name}` : ''}</div>
                <div className="text-center mt-1"><More n={6} open={open} /></div>
              </article>
            )}
            <article className="flex-1 min-h-0 flex flex-col">
              <Section>Rekordy</Section>
              <div className="flex-1 min-h-0 flex flex-col justify-between">
                {d.records.map(({ k, p }) => {
                  const m = metric(k);
                  return (
                    <Tip key={k} content={`${heroName(p.heroId)} vs ${opponentOf(p)?.name ?? '?'}`}>
                      <div className="flex items-center gap-3">
                        <Avatar player={p.player} size={42} />
                        <div className="flex-1 min-w-0"><div className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>{m.label}</div><div className="text-sm font-bold truncate">{p.player?.name}</div></div>
                        <span className="text-2xl font-logik-extended-bold tabular-nums" style={font}>{m.fmt(m.get(p))}</span>
                      </div>
                    </Tip>
                  );
                })}
              </div>
              <div className="mt-2"><More n={1} open={open} label="Wszystkie rekordy" /></div>
            </article>
          </div>

          {/* Right column */}
          <div className="min-h-0 flex flex-col gap-4">
            {d.roast && (
              <article className="rounded-xl p-3" style={{ background: 'rgba(255,138,61,0.12)', border: '1px dashed rgba(255,138,61,0.6)' }}>
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#ff8a3d' }}>Wpadka tygodnia</div>
                <div className="flex items-center gap-3">
                  {d.roast.hits[d.roast.hits.length - 1].player ? <Avatar player={d.roast.hits[d.roast.hits.length - 1].player} size={50} ring="#ff8a3d" /> : <TeamLogo team={d.roast.hits[d.roast.hits.length - 1].team} size={50} />}
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{d.roast.e.label}</div>
                    <div className="text-sm italic leading-snug">„{d.roast.e.quip(hitName(d.roast.hits[d.roast.hits.length - 1]))}”</div>
                  </div>
                </div>
                <div className="mt-2"><More n={27} open={open} label="Całe bingo" /></div>
              </article>
            )}
            <article className="flex-1 min-h-0 flex flex-col">
              <Section>Ranking siły (Elo)</Section>
              <div className="flex-1 min-h-0 flex flex-col justify-between">
                {d.table.map((r, i) => (
                  <div key={r.t.id} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold tabular-nums" style={{ color: C.muted }}>{i + 1}</span>
                    <TeamLogo team={r.t} size={40} />
                    <span className="flex-1 truncate text-sm font-semibold">{r.t.name}</span>
                    <span className="text-lg font-bold tabular-nums" style={font}>{Math.round(r.v)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2"><More n={23} open={open} /></div>
            </article>
            <article>
              <Section>Pogoda na mapie</Section>
              <Tip content="Procent wygranych strony Radiant i Dire w całym turnieju">
                <div className="cursor-help">
                  <div className="flex h-4 rounded-full overflow-hidden"><div style={{ width: `${d.radiantWr * 100}%`, background: C.radiant }} /><div className="flex-1" style={{ background: C.dire }} /></div>
                  <div className="flex justify-between text-sm font-bold mt-1 tabular-nums"><span style={{ color: C.radiant }}>Radiant {Math.round(d.radiantWr * 100)}%</span><span style={{ color: C.dire }}>{Math.round((1 - d.radiantWr) * 100)}% Dire</span></div>
                </div>
              </Tip>
              <div className="mt-1"><More n={13} open={open} /></div>
            </article>
          </div>
        </div>
      </LabView>
      {node}
    </div>
  );
}

export default function D32Gazette() {
  return <div className="h-full w-full flex flex-col"><WithModel>{m => <Gazette model={m} />}</WithModel></div>;
}
