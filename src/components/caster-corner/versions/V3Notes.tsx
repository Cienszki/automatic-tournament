'use client';

// Version 3 — "Raport": the game notes a sports PR office hands to broadcasters before a match.
// One readable document in chapters — the lead, the teams side by side, both line-ups as tables,
// lane duels, records and milestones, history, ranked form, trivia and the caster's notes. The
// caster decides which chapters it has and in what order; it copies as plain text (for a second
// screen or the co-caster) or prints. "Zapytaj" stays at hand in the margin.

import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Printer } from 'lucide-react';
import { C, HeroImg, ink, useHeaderFont } from '@/components/stats-lab/kit';
import { RoleTag } from '@/components/draft-prep/role';
import { heroName } from '@/lib/stats-lab/heroes';
import { count } from '@/lib/plural';
import { cn } from '@/lib/utils';
import { clock, HEADER_FACT, type Fact, type MatchBrief, type TeamBrief, laneTitle } from '@/lib/caster-corner/brief';
import { noteKey, useCorner, useLocal } from '../data';
import { AskBuilder, Crest, Face, FactRow, MatchSwitch, NoteField, SavedQuestion, nf0, nf1, when } from '../ui';
import { HeroCounts, ProbBar, useTeamColors } from '../parts';

type Ch = 'lead' | 'teams' | 'rosters' | 'lanes' | 'records' | 'history' | 'pubs' | 'trivia' | 'notes';
const CH_LABEL: Record<Ch, string> = { lead: 'Zapowiedź', teams: 'Drużyny', rosters: 'Składy', lanes: 'Pojedynki na liniach', records: 'Rekordy', history: 'Historia', pubs: 'Forma poza turniejem', trivia: 'Ciekawostki', notes: 'Moje notatki' };
const ALL: Ch[] = ['lead', 'teams', 'rosters', 'lanes', 'records', 'history', 'pubs', 'trivia', 'notes'];

const pickFacts = (b: MatchBrief, ch: Ch): Fact[] => {
  const k = (...kinds: Fact['kind'][]) => b.facts.filter(f => kinds.includes(f.kind));
  if (ch === 'lead') return b.facts.filter(f => (f.kind === 'stawka' || (f.kind === 'forma' && !f.player)) && !HEADER_FACT.test(f.id)).slice(0, 8);
  if (ch === 'records') return k('rekord');
  if (ch === 'history') return k('historia');
  if (ch === 'pubs') return k('rankedy');
  if (ch === 'trivia') return k('ciekawostka', 'draft');
  if (ch === 'lanes') return k('linia');
  return [];
};

/** Plain text of the chosen chapters (for the clipboard / print) */
function toText(b: MatchBrief, chapters: Ch[], notes: Record<string, string>): string {
  const L: string[] = [`${b.a.name} vs ${b.b.name}`, [when(b.match.scheduledFor), `Bo${b.match.bestOf}`, b.stage?.label].filter(Boolean).join(' · '), ''];
  for (const ch of chapters) {
    L.push(CH_LABEL[ch].toUpperCase());
    if (ch === 'teams') for (const t of [b.a, b.b]) L.push(`${t.name}: serie ${t.series.w}:${t.series.l}, gry ${t.games.w}:${t.games.l}${t.mmrAvg ? `, średni MMR ${nf0(t.mmrAvg)}` : ''}`);
    else if (ch === 'rosters') for (const t of [b.a, b.b]) {
      L.push(t.name);
      for (const p of t.players) L.push(`  ${p.role ?? '?'} — ${p.name}${p.mmr ? `, ${nf0(p.mmr)} MMR` : ''}${p.games ? `, ${count(p.games, 'gra', 'gry', 'gier')}, ${p.score != null ? `${nf1(p.score)} PF` : ''}` : ''}${p.heroes.length ? `, ${p.heroes.slice(0, 3).map(h => heroName(h.heroId)).join(', ')}` : ''}${notes[noteKey.say(p.id)] ? ` (wymowa: ${notes[noteKey.say(p.id)]})` : ''}`);
    }
    else if (ch === 'notes') for (const k of [noteKey.match(b.match.id), noteKey.team(b.a.id), noteKey.team(b.b.id), ...[...b.a.players, ...b.b.players].map(p => noteKey.player(p.id))]) { if (notes[k]) L.push(`- ${notes[k]}`); }
    for (const f of pickFacts(b, ch)) L.push(`- ${f.text}`);
    L.push('');
  }
  return L.join('\n');
}

function H({ id, children }: { id: string; children: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <h2 id={id} className="scroll-mt-6 mt-12 mb-4 flex items-center gap-4">
      <span className="font-logik-extended-bold uppercase text-[13px] tracking-[0.24em]" style={{ color: C.primary, ...font }}>{children}</span>
      <span className="flex-1 h-px" style={{ background: ink(12) }} />
    </h2>
  );
}

function TeamsTable({ b, colors }: { b: MatchBrief; colors: [string, string] }) {
  const v = (t: TeamBrief, f: (t: TeamBrief) => React.ReactNode) => f(t) ?? '–';
  const rows: Array<[string, (t: TeamBrief) => React.ReactNode]> = [
    ['Serie', t => `${t.series.w}:${t.series.l}`],
    ['Gry', t => `${t.games.w}:${t.games.l}`],
    ['Elo', t => (t.elo ? `${nf0(t.elo)} (${t.eloRank}.)` : '–')],
    ['Średni MMR', t => (t.mmrAvg ? nf0(t.mmrAvg) : '–')],
    ['Średni czas gry', t => (t.x?.games.length ? clock(t.x.avg.duration) : '–')],
    ['Zabójstwa na grę', t => (t.x?.games.length ? nf1(t.x.avg.kills) : '–')],
    ['First blood', t => (t.x?.avg.fbRate != null ? `${Math.round(t.x.avg.fbRate * 100)}%` : '–')],
    ['Radiant / Dire', t => (t.x?.games.length ? `${t.x.radiant.wins}:${t.x.radiant.games - t.x.radiant.wins} / ${t.x.dire.wins}:${t.x.dire.games - t.x.dire.wins}` : '–')],
    ['Picki', t => <HeroCounts list={t.picks.map(h => ({ heroId: h.heroId, games: h.games, wins: h.wins }))} n={4} size={44} />],
    ['Banowani', t => <HeroCounts list={t.bansAgainst} n={4} size={44} />],
  ];
  return (
    <table className="w-full text-[14px]">
      <thead><tr><th className="w-[200px]" />{[b.a, b.b].map((t, i) => <th key={t.id} className="text-left pb-2"><span className="flex items-center gap-2"><Crest t={t} size={24} /><b style={{ color: colors[i] }}>{t.name}</b></span></th>)}</tr></thead>
      <tbody>{rows.map(([label, f]) => (
        <tr key={label} className="border-t" style={{ borderColor: ink(8) }}>
          <td className="py-2 text-[12px] uppercase tracking-[0.12em]" style={{ color: C.muted }}>{label}</td>
          <td className="py-2 tabular-nums" style={{ color: C.heading }}>{v(b.a, f)}</td>
          <td className="py-2 tabular-nums" style={{ color: C.heading }}>{v(b.b, f)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function RosterTable({ t, color }: { t: TeamBrief; color: string }) {
  const { notes } = useCorner();
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2"><Crest t={t} size={30} /><b className="text-[16px]" style={{ color }}>{t.name}</b></div>
      <table className="w-full text-[13.5px]">
        <thead><tr className="text-[10px] uppercase tracking-[0.16em]" style={{ color: C.muted }}>
          <th className="text-left font-normal pb-1.5 w-[44px]" /><th className="text-left font-normal pb-1.5">Gracz</th><th className="text-right font-normal">MMR</th><th className="text-right font-normal">Ranga</th><th className="text-right font-normal">Gry</th><th className="text-right font-normal">PF</th><th className="text-right font-normal">KDA</th><th className="text-left font-normal pl-6">Bohaterowie</th>
        </tr></thead>
        <tbody>{t.players.map(p => (
          <tr key={p.id} className="border-t align-middle" style={{ borderColor: ink(8) }}>
            <td className="py-2"><Face p={p} size={34} /></td>
            <td className="py-2">
              <div className="flex items-center gap-2"><b style={{ color: C.heading }}>{p.name}</b><span style={{ color: C.muted }}><RoleTag role={p.role} label={false} /></span>{p.standin && <span className="text-[11px]" style={{ color: '#ffd27a' }}>za {p.standin.replacesName}</span>}</div>
              {notes[noteKey.say(p.id)] && <div className="text-[11.5px] italic" style={{ color: C.muted }}>wymowa: {notes[noteKey.say(p.id)]}</div>}
            </td>
            <td className="text-right tabular-nums" style={{ color: C.text }}>{p.mmr ? nf0(p.mmr) : '–'}</td>
            <td className="text-right" style={{ color: C.text }}>{p.pubs?.rank ?? '–'}</td>
            <td className="text-right tabular-nums" style={{ color: C.text }}>{p.games ? `${p.wins}:${p.games - p.wins}` : '–'}</td>
            <td className="text-right tabular-nums" style={{ color: C.heading }}>{p.score != null ? nf1(p.score) : '–'}{p.roleRank && <span className="text-[10.5px] ml-1" style={{ color: C.muted }}>({p.roleRank.rank}.)</span>}</td>
            <td className="text-right tabular-nums" style={{ color: C.text }}>{p.x?.agg.kda.avg != null ? nf1(p.x.agg.kda.avg) : '–'}</td>
            <td className="pl-6 py-1.5"><span className="flex gap-1">{(p.heroes.length ? p.heroes.slice(0, 4).map(h => h.heroId) : (p.pubs?.top ?? []).slice(0, 4).map(h => h.hero)).map(h => <HeroImg key={h} heroId={h} className="rounded-[3px] w-[44px] h-[25px]" />)}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function V3Notes() {
  const { brief, store, notes, questions, setQuestions, match, pending } = useCorner();
  const colors = useTeamColors(brief);
  const font = useHeaderFont();
  const [order, setOrder] = useLocal<Ch[]>(`${store}:v3:order`, ALL);
  const [off, setOff] = useLocal<Ch[]>(`${store}:v3:off`, []);
  const [copied, setCopied] = React.useState(false);
  const chapters = useMemo(() => [...order.filter(c => ALL.includes(c)), ...ALL.filter(c => !order.includes(c))], [order]);
  const shown = chapters.filter(c => !off.includes(c));
  const move = (c: Ch, d: -1 | 1) => setOrder(() => { const l = [...chapters]; const i = l.indexOf(c); const j = i + d; if (j < 0 || j >= l.length) return l; [l[i], l[j]] = [l[j], l[i]]; return l; });

  const copy = async () => { try { await navigator.clipboard.writeText(toText(brief, shown, notes)); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* */ } };
  const print = () => {
    const w = window.open('', '_blank', 'width=820,height=1000'); if (!w) return;
    const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(brief.a.name)} vs ${esc(brief.b.name)}</title><style>body{font:13px/1.5 system-ui,sans-serif;margin:32px;white-space:pre-wrap}</style><body>${esc(toText(brief, shown, notes))}</body>`);
    w.document.close(); w.focus(); w.print();
  };

  const facts = (ch: Ch) => pickFacts(brief, ch);
  const body = (ch: Ch) => {
    if (ch === 'lead') return (<>
      {brief.stage?.stake && <p className="text-[20px] leading-snug font-bold mb-4" style={{ color: C.heading }}>{brief.stage.stake}</p>}
      <ProbBar brief={brief} colors={colors} className="max-w-[420px] mb-4" />
      {facts(ch).map(f => <FactRow key={f.id} f={f} showKind={false} className="py-1.5" />)}
    </>);
    if (ch === 'teams') return <TeamsTable b={brief} colors={colors} />;
    if (ch === 'rosters') return <><RosterTable t={brief.a} color={colors[0]} /><RosterTable t={brief.b} color={colors[1]} /></>;
    if (ch === 'notes') return (
      <div className="space-y-5">
        <NoteField k={noteKey.match(brief.match.id)} rows={3} placeholder="Notatki do tego meczu…" />
        <div className="grid grid-cols-2 gap-8">
          {[brief.a, brief.b].map(t => <div key={t.id}><div className="text-[12px] mb-1" style={{ color: C.muted }}>{t.name}</div><NoteField k={noteKey.team(t.id)} rows={3} placeholder="Notatka o drużynie…" /></div>)}
        </div>
      </div>
    );
    if (ch === 'lanes') return (<>
      <div className="space-y-3 mb-4">{brief.lanes.map(l => (
        <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] items-center gap-4">
          <div className="flex justify-end gap-5">{l.a.map(p => <span key={p.id} className="flex items-center gap-2"><b style={{ color: C.heading }}>{p.name}</b><Face p={p} size={34} /></span>)}</div>
          <div className="text-center text-[11px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>{laneTitle(l)}</div>
          <div className="flex gap-5">{l.b.map(p => <span key={p.id} className="flex items-center gap-2"><Face p={p} size={34} /><b style={{ color: C.heading }}>{p.name}</b></span>)}</div>
        </div>
      ))}</div>
      {facts(ch).map(f => <FactRow key={f.id} f={f} showKind={false} className="py-1.5" />)}
    </>);
    const list = facts(ch);
    return list.length ? list.map(f => <FactRow key={f.id} f={f} showKind={ch === 'trivia'} className="py-1.5" />) : <p className="text-[13px]" style={{ color: C.muted }}>{ch === 'pubs' && pending ? 'Wczytuję gry graczy spoza turnieju…' : 'Nic wartego uwagi.'}</p>;
  };

  return (
    <div className="h-full grid grid-cols-[270px_minmax(0,1fr)_400px]">
      <nav className="min-h-0 overflow-y-auto custom-scrollbar px-8 py-8 border-r" style={{ borderColor: ink(10) }}>
        <MatchSwitch />
        <div className="mt-7 space-y-0.5">
          {chapters.map((c, i) => {
            const on = !off.includes(c);
            return (
              <div key={c} className="group flex items-center gap-2 py-1.5">
                <button type="button" onClick={() => setOff(on ? [...off, c] : off.filter(x => x !== c))} aria-label={on ? 'Ukryj rozdział' : 'Pokaż rozdział'}
                  className="w-4 h-4 rounded-[3px] border flex items-center justify-center shrink-0" style={{ borderColor: on ? C.primary : ink(30), background: on ? C.primary : 'transparent' }}>{on && <Check className="w-3 h-3 text-white" />}</button>
                <a href={`#ch-${c}`} className={cn('flex-1 text-[13.5px] hover:underline underline-offset-4 truncate', !on && 'line-through')} style={{ color: on ? C.heading : C.muted }}>{CH_LABEL[c]}</a>
                <span className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" disabled={i === 0} onClick={() => move(c, -1)} className="p-0.5 disabled:opacity-20" aria-label="Wyżej"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button type="button" disabled={i === chapters.length - 1} onClick={() => move(c, 1)} className="p-0.5 disabled:opacity-20" aria-label="Niżej"><ArrowDown className="w-3.5 h-3.5" /></button>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex flex-col items-start gap-3">
          <button type="button" onClick={copy} className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: C.primary }}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Skopiowano' : 'Kopiuj jako tekst'}</button>
          <button type="button" onClick={print} className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: C.primary }}><Printer className="w-4 h-4" />Drukuj</button>
        </div>
      </nav>

      <article className="min-h-0 overflow-y-auto custom-scrollbar px-16 pb-24">
        <header className="pt-10 pb-2">
          <div className="flex items-center gap-6">
            <Crest t={brief.a} size={72} />
            <h1 className="font-logik-extended-bold uppercase leading-[0.95] text-[44px] min-w-0" style={{ color: C.heading, ...font }}>
              <span style={{ color: colors[0] }}>{brief.a.name}</span> <span className="text-[22px] align-middle" style={{ color: C.muted }}>vs</span> <span style={{ color: colors[1] }}>{brief.b.name}</span>
            </h1>
            <Crest t={brief.b} size={72} />
          </div>
          <div className="mt-3 text-[14px]" style={{ color: C.muted }}>
            {[when(match.scheduledFor), `Bo${match.bestOf}`, brief.stage?.label, match.status === 'completed' && `wynik ${match.scoreA}:${match.scoreB}`, match.casters.length && `castują: ${match.casters.map(c => c.name).join(', ')}`].filter(Boolean).join(' · ')}
          </div>
        </header>
        {shown.map(c => <section key={c}><H id={`ch-${c}`}>{CH_LABEL[c]}</H>{body(c)}</section>)}
      </article>

      <aside className="min-h-0 flex flex-col border-l px-8 py-8" style={{ borderColor: ink(10) }}>
        <AskBuilder onSave={q => setQuestions(p => [q, ...p])} />
        <div className="mt-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {questions.map(q => <SavedQuestion key={q.id} q={q} onRemove={() => setQuestions(p => p.filter(x => x.id !== q.id))} />)}
          {!questions.length && <p className="text-[12.5px] leading-relaxed" style={{ color: C.muted }}>Zapisane pytania zostają tutaj i same się aktualizują po każdym meczu.</p>}
        </div>
      </aside>
    </div>
  );
}
