'use client';

// Bigger shared pieces: the two teams' colours (from their crests), the win-chance bar, player
// stat fields a caster can pick, and the player dossier drawer every version opens on a click.

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { C, HeroImg, ink, mix, onDark, useHeaderFont } from '@/components/stats-lab/kit';
import { useLogoColor } from '@/components/teams-section/fit';
import { RoleTag } from '@/components/draft-prep/role';
import { heroName } from '@/lib/stats-lab/heroes';
import { metric } from '@/lib/stats-lab/metrics';
import { count, plural } from '@/lib/plural';
import { cn } from '@/lib/utils';
import { factsAbout, kdaLine, type MatchBrief, type PlayerBrief, type TeamBrief } from '@/lib/caster-corner/brief';
import { noteKey, useCorner } from './data';
import { AskBuilder, Crest, Face, FactRow, HeroChip, NoteField, nf0, nf1, usePinnedFirst } from './ui';

/** Each team's colour from its crest (lifted so it reads on dark), else the theme's */
export function useTeamColors(brief: MatchBrief): [string, string] {
  const a = useLogoColor(brief.a.logoUrl); const b = useLogoColor(brief.b.logoUrl);
  return [a ? onDark(a, 80) : C.primary, b ? onDark(b, 80) : onDark(C.secondary, 70)];
}

export function ProbBar({ brief, colors, className, labels = true }: { brief: MatchBrief; colors: [string, string]; className?: string; labels?: boolean }) {
  if (brief.pA == null) return null;
  const a = Math.round(brief.pA * 100);
  return (
    <div className={cn('w-full', className)} title="Szansa na wygranie gry według Elo z tego turnieju">
      {labels && (
        <div className="flex justify-between text-[11px] tabular-nums mb-1" style={{ color: C.muted }}>
          <span><b style={{ color: colors[0] }}>{a}%</b></span><span className="uppercase tracking-[0.2em] text-[9px]">Elo</span><span><b style={{ color: colors[1] }}>{100 - a}%</b></span>
        </div>
      )}
      <div className="flex h-[5px] rounded-full overflow-hidden" style={{ background: ink(10) }}>
        <span style={{ width: `${a}%`, background: colors[0] }} />
        <span className="w-[2px]" />
        <span className="flex-1" style={{ background: colors[1] }} />
      </div>
    </div>
  );
}

export const teamLine = (t: TeamBrief) => {
  if (!t.x?.games.length) return 'pierwszy mecz w turnieju';
  return [`serie ${t.series.w}:${t.series.l}`, `gry ${t.games.w}:${t.games.l}`, t.eloRank && `${t.eloRank}. w Elo`, t.streak && t.streak.n >= 2 && `${t.streak.n} ${t.streak.win ? plural(t.streak.n, 'wygrana', 'wygrane', 'wygranych') : plural(t.streak.n, 'porażka', 'porażki', 'porażek')} z rzędu`].filter(Boolean).join(' · ');
};

/** Last series as W/L marks, oldest first */
export function Form({ t, size = 18 }: { t: TeamBrief; size?: number }) {
  return (
    <span className="inline-flex gap-1">
      {t.results.slice(-5).map(r => (
        <span key={r.id} title={`${r.us}:${r.them} z ${r.oppName}`} className="rounded-[3px] flex items-center justify-center font-bold text-[10px] text-black"
          style={{ width: size, height: size, background: r.win ? C.win : r.win === false ? C.loss : ink(40) }}>{r.win ? 'W' : r.win === false ? 'P' : 'R'}</span>
      ))}
    </span>
  );
}

// ── Player stat fields (the spotting board lets the caster choose) ───────────

export type FieldKey = 'score' | 'record' | 'kda' | 'gpm' | 'kp' | 'wards' | 'mmr' | 'rank' | 'pub7' | 'career';
export const FIELDS: Record<FieldKey, { label: string; name: string; value: (p: PlayerBrief) => string; sub?: (p: PlayerBrief) => string }> = {
  score: { label: 'PF', name: 'Punkty fantasy na grę', value: p => (p.score != null ? nf1(p.score) : '–'), sub: p => (p.roleRank ? `${p.roleRank.rank}. z ${p.roleRank.of}` : '') },
  record: { label: 'Gry', name: 'Gry w turnieju (wygrane:przegrane)', value: p => (p.games ? `${p.wins}:${p.games - p.wins}` : '–') },
  kda: { label: 'KDA', name: 'KDA na grę', value: p => (p.x?.agg.kda.avg != null ? nf1(p.x.agg.kda.avg) : '–') },
  gpm: { label: 'GPM', name: 'Złoto na minutę', value: p => (p.x?.agg.gpm.avg != null ? nf0(p.x.agg.gpm.avg) : '–') },
  kp: { label: 'KP', name: 'Udział w zabójstwach', value: p => (p.x?.agg.kp.avg != null ? `${Math.round(p.x.agg.kp.avg * 100)}%` : '–') },
  wards: { label: 'Wardy', name: 'Postawione wardy na grę', value: p => (p.x?.agg.wards.avg != null ? nf1(p.x.agg.wards.avg) : '–') },
  mmr: { label: 'MMR', name: 'MMR ze zgłoszenia', value: p => (p.mmr ? nf0(p.mmr) : '–') },
  rank: { label: 'Ranga', name: 'Ranga na rankedach', value: p => (p.pubs?.rank ? p.pubs.rank.replace(/^(\w{3})\w*/, '$1') : '–') },
  pub7: { label: '7 dni', name: 'Gry poza turniejem w ostatnim tygodniu', value: p => (p.pubs ? String(p.pubs.d7) : '–') },
  career: { label: 'Wcześniej', name: 'Poprzedni turniej na stronie', value: p => p.career[0]?.short ?? '–', sub: p => p.career[0]?.teamName ?? '' },
};
export const FIELD_ORDER = Object.keys(FIELDS) as FieldKey[];

/** Signature heroes: tournament picks, else ranked ones */
export function signature(p: PlayerBrief, n = 3): Array<{ hero: number; g: number; w: number; pub?: boolean }> {
  const t = p.heroes.slice(0, n).map(h => ({ hero: h.heroId, g: h.games, w: h.wins }));
  if (t.length >= n || !p.pubs) return t;
  return [...t, ...p.pubs.top.filter(h => !t.some(x => x.hero === h.hero)).slice(0, n - t.length).map(h => ({ ...h, pub: true }))];
}

// ── Player dossier (drawer) ──────────────────────────────────────────────────

export function PlayerDossier({ p, onClose }: { p: PlayerBrief | null; onClose: () => void }) {
  const { brief } = useCorner();
  const font = useHeaderFont();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!p) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [p, onClose]);
  const team = p ? (p.side === 'a' ? brief.a : brief.b) : null;
  const facts = usePinnedFirst(p ? factsAbout(brief, p.side, p.id) : []);
  if (!mounted || !p || !team) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end" onClick={onClose} style={{ background: 'rgba(0,0,0,0.45)' }}>
      <aside onClick={e => e.stopPropagation()} className="h-full w-[min(560px,100vw)] overflow-y-auto custom-scrollbar shadow-2xl"
        style={{ background: 'var(--tournament-background, #0d0d12)', color: C.text, borderLeft: `1px solid ${ink(12)}` }}>
        <div className="relative px-7 pt-7 pb-6 overflow-hidden" style={{ background: '#0b0b10' }}>
          {p.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-150" style={{ filter: 'blur(40px) brightness(0.45) saturate(1.4)' }} />
          )}
          <button type="button" onClick={onClose} aria-label="Zamknij" className="absolute right-4 top-4 opacity-60 hover:opacity-100 text-white"><X className="w-5 h-5" /></button>
          <div className="relative flex items-center gap-5 text-white">
            <Face p={p} size={104} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[12px] text-white/70"><Crest t={team} size={20} />{team.name}</div>
              <div className="font-logik-extended-bold uppercase leading-[0.95] text-[34px] break-words" style={font}>{p.name}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[12.5px] text-white/75">
                <RoleTag role={p.role} />{p.mmr && <span>{nf0(p.mmr)} MMR</span>}{p.pubs?.rank && <span>{p.pubs.rank}</span>}
                {p.standin && <span style={{ color: '#ffd27a' }}>standin za {p.standin.replacesName}</span>}
              </div>
            </div>
          </div>
          <div className="relative mt-4"><NoteField k={noteKey.say(p.id)} rows={1} placeholder="Jak wymówić nick…" className="text-white" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }} /></div>
        </div>

        <div className="px-7 py-6 space-y-7">
          <Section title="Do powiedzenia">
            {facts.length ? facts.map(f => <FactRow key={f.id} f={f} className="py-1.5" />) : <Muted>Brak danych o tym graczu w turniejach na stronie.</Muted>}
          </Section>

          {p.x && (
            <Section title="W turnieju">
              <div className="grid grid-cols-4 gap-y-3 gap-x-4">
                {(['score', 'kda', 'gpm', 'kp', 'xpm', 'heroDamage', 'wards', 'deaths'] as const).map(k => {
                  const a = p.x!.agg[k]; const m = metric(k);
                  return (
                    <div key={k}>
                      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>{m.short}</div>
                      <div className="font-bold text-[17px] tabular-nums" style={{ color: C.heading }}>{a.avg == null ? '–' : k === 'kp' ? `${Math.round(a.avg * 100)}%` : a.avg.toLocaleString('pl-PL', { maximumFractionDigits: m.avgDigits ? 1 : 0 })}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">{p.heroes.slice(0, 8).map(h => <HeroChip key={h.heroId} hero={h.heroId} g={h.games} w={h.wins} size={56} />)}</div>
              {p.best && <div className="mt-3 text-[13px]" style={{ color: C.text }}>Najlepsza gra: <b style={{ color: C.heading }}>{kdaLine(p.best)}</b> na {heroName(p.best.heroId)}, {nf1(p.best.score)} PF</div>}
            </Section>
          )}

          {p.career.length > 0 && (
            <Section title="Wcześniej">
              {p.career.map(c => (
                <div key={c.key} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: ink(8) }}>
                  {c.team && <Crest t={c.team} size={26} />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] truncate" style={{ color: C.heading }}><b>{c.teamName}</b> · {c.tournament}</div>
                    <div className="text-[12px]" style={{ color: C.muted }}>{count(c.games, 'gra', 'gry', 'gier')} · {Math.round(c.wins / c.games * 100)}% wygranych{c.score != null && ` · ${nf1(c.score)} PF`}</div>
                  </div>
                  {c.top && <HeroChip hero={c.top.heroId} g={c.top.games} w={c.top.wins} size={44} />}
                </div>
              ))}
            </Section>
          )}

          {p.pubs && (
            <Section title="Poza turniejem">
              <div className="text-[13px]" style={{ color: C.text }}>
                {count(p.pubs.d7, 'gra', 'gry', 'gier')} w 7 dni · {count(p.pubs.d30, 'gra', 'gry', 'gier')} w 30 dni{p.pubs.d30 ? ` (${Math.round(p.pubs.w30 / p.pubs.d30 * 100)}% wygranych)` : ''}
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">{p.pubs.top.map(h => <HeroChip key={h.hero} hero={h.hero} g={h.g} w={h.w} size={56} tip={`${heroName(h.hero)} · ostatnie 90 dni`} />)}</div>
            </Section>
          )}

          <Section title="Notatka"><NoteField k={noteKey.player(p.id)} rows={3} placeholder="Co warto pamiętać…" /></Section>
          <Section title="Zapytaj"><AskBuilder compact autoSubject={{ kind: 'player', id: p.id }} /></Section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export function Section({ title, children, right, className }: { title: React.ReactNode; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  const font = useHeaderFont();
  return (
    <section className={className}>
      <div className="flex items-center gap-3 mb-2.5">
        <h3 className="text-[11px] font-logik-extended-bold uppercase tracking-[0.22em]" style={{ color: C.primary, ...font }}>{title}</h3>
        <span className="flex-1 h-px" style={{ background: ink(10) }} />
        {right}
      </div>
      {children}
    </section>
  );
}
export const Muted = ({ children }: { children: React.ReactNode }) => <div className="text-[13px]" style={{ color: C.muted }}>{children}</div>;

/** Hero icon list (picks / bans) with counts */
export function HeroCounts({ list, n = 5, size = 40, label }: { list: Array<{ heroId: number; count?: number; games?: number; wins?: number }>; n?: number; size?: number; label?: (h: { heroId: number; count?: number; games?: number; wins?: number }) => string }) {
  if (!list.length) return <span className="text-[12px]" style={{ color: C.muted }}>–</span>;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {list.slice(0, n).map(h => (
        <span key={h.heroId} className="inline-flex flex-col items-center gap-0.5" title={`${heroName(h.heroId)} · ${label ? label(h) : h.count ?? h.games}`}>
          <HeroImg heroId={h.heroId} className="rounded-[3px]" style={{ width: size, height: Math.round(size * 0.5625) }} title={false} />
          <span className="text-[10px] tabular-nums leading-none" style={{ color: C.muted }}>{label ? label(h) : `${h.count ?? h.games}×`}</span>
        </span>
      ))}
    </span>
  );
}

export const tint = (c: string, p: number) => mix(c, p);
