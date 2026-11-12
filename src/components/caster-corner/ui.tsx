'use client';

// Pieces every version of the caster corner shares: the series switcher, word pickers (the
// site's underlined words, never generic pills), notes, the "Zapytaj" question builder, hero
// chips, sparklines, talking-point rows and the hidden version picker.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Pin, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, C, HeroImg, ink, mix, TeamLogo, Tip, useHeaderFont } from '@/components/stats-lab/kit';
import { heroName } from '@/lib/stats-lab/heroes';
import { cn } from '@/lib/utils';
import { count } from '@/lib/plural';
import { answer, AGG_LABEL, ASK_METRICS, askMetric, defaultQuestion, scopeLabel, type AskAgg, type Question } from '@/lib/caster-corner/ask';
import { FACT_KIND_LABEL, lc, type Fact, type PlayerBrief, type TeamBrief } from '@/lib/caster-corner/brief';
import type { CornerMatch } from '@/lib/caster-corner/types';
import { useFitText } from '@/components/teams-section/fit';
import { useCorner } from './data';

export const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'bez terminu');
export const nf1 = (v: number) => v.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
export const nf0 = (v: number) => Math.round(v).toLocaleString('pl-PL');
export const crestOf = (t: Pick<TeamBrief, 'name' | 'tag' | 'logoUrl'>) => ({ name: t.name, tag: t.tag, logoUrl: t.logoUrl });

/** A name that shrinks until it fits its box (never "…") */
export function FitName({ text, max, min, lines = 1, className, style }: { text: string; max: number; min: number; lines?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useFitText<HTMLDivElement>(text, max, min, lines, 1.0);
  return <div ref={ref} className={cn('min-w-0 w-full', className)} style={style}>{text}</div>;
}

export function Face({ p, size = 48, ring, className }: { p: Pick<PlayerBrief, 'name' | 'avatar'>; size?: number; ring?: string; className?: string }) {
  return <Avatar player={{ name: p.name, avatar: p.avatar }} size={size} ring={ring} className={className} />;
}
export function Crest({ t, size = 40, className }: { t: Pick<TeamBrief, 'name' | 'tag' | 'logoUrl'>; size?: number; className?: string }) {
  return <TeamLogo team={crestOf(t)} size={size} className={className} />;
}

/** Hero portrait with a games / wins line under it */
export function HeroChip({ hero, g, w, size = 44, tip }: { hero: number; g?: number; w?: number; size?: number; tip?: React.ReactNode }) {
  return (
    <Tip content={tip ?? `${heroName(hero)}${g != null ? ` · ${count(g, 'gra', 'gry', 'gier')}${w != null ? `, ${w}:${g - w}` : ''}` : ''}`}>
      <span className="inline-flex flex-col items-center gap-0.5 shrink-0">
        <HeroImg heroId={hero} className="rounded-[3px]" style={{ width: size, height: Math.round(size * 0.5625) }} title={false} />
        {g != null && <span className="text-[10px] tabular-nums leading-none" style={{ color: C.muted }}>{w != null ? `${w}:${g - w}` : g}</span>}
      </span>
    </Tip>
  );
}

export function Spark({ values, w = 90, h = 22, color = C.primary }: { values: number[]; w?: number; h?: number; color?: string }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - lo) / span) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={pts.split(' ').pop()!.split(',')[1]} r={2.4} fill={color} />
    </svg>
  );
}

/** A word that opens a list: the site's underlined choice, chosen value in the tournament colour */
export function Pick<T extends string | number>({ value, options, onChange, placeholder, search, className, label }: {
  value: T | undefined;
  options: Array<{ value: T; label: React.ReactNode; text?: string; group?: string; icon?: React.ReactNode }>;
  onChange: (v: T | undefined) => void;
  placeholder: string;
  search?: boolean;
  className?: string;
  /** Shown instead of the chosen option's label */
  label?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const cur = options.find(o => o.value === value);
  const list = q ? options.filter(o => (o.text ?? String(o.label)).toLowerCase().includes(q.toLowerCase())) : options;
  let lastGroup: string | undefined;
  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQ(''); }}>
      <PopoverTrigger asChild>
        <button type="button" className={cn('inline-flex items-center gap-1 underline decoration-2 underline-offset-[6px] hover:decoration-[3px] whitespace-nowrap', className)}
          style={{ color: cur ? C.heading : C.muted, textDecorationColor: cur ? C.primary : ink(25) }}>
          {label ?? cur?.label ?? placeholder}<ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0 overflow-hidden" style={{ background: 'var(--tournament-background, #0e0e14)', borderColor: ink(14), color: C.text }}>
        {search && (
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: ink(10) }}>
            <Search className="w-3.5 h-3.5" style={{ color: C.muted }} />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj…" className="flex-1 bg-transparent outline-none text-[13px]" />
          </div>
        )}
        <div className="max-h-[340px] overflow-y-auto custom-scrollbar py-1">
          {value !== undefined && placeholder && (
            <button type="button" onClick={() => { onChange(undefined); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-white/5" style={{ color: C.muted }}>{placeholder}</button>
          )}
          {list.map(o => {
            const head = o.group && o.group !== lastGroup ? (lastGroup = o.group) : null;
            return (
              <React.Fragment key={String(o.value)}>
                {head && <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>{head}</div>}
                <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-1.5 text-[13px] hover:bg-white/5"
                  style={{ color: o.value === value ? C.heading : C.text, fontWeight: o.value === value ? 700 : 400 }}>
                  {o.icon}{o.label}{o.value === value && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: C.primary }} />}
                </button>
              </React.Fragment>
            );
          })}
          {!list.length && <div className="px-3 py-2 text-[12px]" style={{ color: C.muted }}>Nic nie pasuje</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Which series to prepare: the caster's own first, then the rest to come, then the played ones */
export function MatchSwitch({ className, big }: { className?: string; big?: boolean }) {
  const { data, match, setMatch } = useCorner();
  const font = useHeaderFont();
  const name = (id: string) => data.rosters.find(r => r.id === id)?.name ?? '?';
  const logo = (id: string) => data.rosters.find(r => r.id === id);
  const mine = (m: CornerMatch) => m.casters.some(c => c.uid === data.me);
  const soon = Date.now() - 3 * 3600_000;
  const up = data.matches.filter(m => m.status !== 'completed' && (!m.scheduledFor || Date.parse(m.scheduledFor) >= soon));
  const played = data.matches.filter(m => m.status === 'completed').reverse();
  const opts = [
    ...up.filter(mine).map(m => ({ m, group: 'Castujesz' })),
    ...up.filter(m => !mine(m)).map(m => ({ m, group: 'Nadchodzące' })),
    ...played.map(m => ({ m, group: 'Rozegrane' })),
  ];
  return (
    <Pick value={match.id} placeholder="" search className={cn(big ? 'text-[15px]' : 'text-[13px]', className)}
      label={<span className="font-logik-extended-bold uppercase" style={font}>{name(match.teamA)} <span style={{ color: C.muted }}>vs</span> {name(match.teamB)}</span>}
      options={opts.map(({ m, group }) => ({
        value: m.id, group, text: `${name(m.teamA)} ${name(m.teamB)}`,
        icon: <span className="flex -space-x-1.5 shrink-0"><TeamLogo team={logo(m.teamA) as never} size={20} /><TeamLogo team={logo(m.teamB) as never} size={20} /></span>,
        label: <span className="min-w-0 flex-1"><span className="block truncate">{name(m.teamA)} – {name(m.teamB)}</span><span className="block text-[11px]" style={{ color: C.muted }}>{m.status === 'completed' ? `${m.scoreA}:${m.scoreB}` : when(m.scheduledFor)}</span></span>,
      }))}
      onChange={v => v && setMatch(String(v))} />
  );
}

/** A note that saves as you type (this browser only) */
export function NoteField({ k, placeholder = 'Notatka…', className, rows = 2, style }: { k: string; placeholder?: string; className?: string; rows?: number; style?: React.CSSProperties }) {
  const { notes, setNote } = useCorner();
  const [v, setV] = useState(notes[k] ?? '');
  useEffect(() => { setV(notes[k] ?? ''); }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }, [v]);
  return (
    <textarea ref={ref} value={v} rows={rows} placeholder={placeholder} onChange={e => { setV(e.target.value); setNote(k, e.target.value); }}
      className={cn('w-full resize-none bg-transparent outline-none border-b border-dashed focus:border-solid text-[13px] leading-snug placeholder:opacity-40', className)}
      style={{ borderColor: ink(18), color: C.heading, ...style }} />
  );
}

/** One talking point: tick when said, pin to keep it on top */
export function FactRow({ f, showKind = true, big, className, extra }: { f: Fact; showKind?: boolean; big?: boolean; className?: string; extra?: React.ReactNode }) {
  const { used, toggleUsed, pins, togglePin } = useCorner();
  const done = used.has(f.id); const pinned = pins.includes(f.id);
  return (
    <div className={cn('group flex items-start gap-3', className)} style={{ opacity: done ? 0.42 : 1 }}>
      <button type="button" onClick={() => toggleUsed(f.id)} title={done ? 'Jeszcze nie powiedziane' : 'Powiedziane'}
        className="mt-[3px] w-4 h-4 rounded-full shrink-0 flex items-center justify-center border transition-colors"
        style={{ borderColor: done ? C.win : ink(30), background: done ? C.win : 'transparent' }}>
        {done && <Check className="w-3 h-3 text-black" />}
      </button>
      <div className="min-w-0 flex-1">
        {showKind && <span className="text-[10px] uppercase tracking-[0.2em] mr-2" style={{ color: C.primary }}>{FACT_KIND_LABEL[f.kind]}</span>}
        <span className={cn(big ? 'text-[17px] leading-snug' : 'text-[13.5px] leading-snug', done && 'line-through decoration-1')} style={{ color: C.heading }}>{f.text}</span>
        {extra}
      </div>
      <button type="button" onClick={() => togglePin(f.id)} title={pinned ? 'Odepnij' : 'Przypnij na górę'}
        className={cn('mt-0.5 shrink-0 transition-opacity', pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-50 hover:!opacity-100')}>
        <Pin className="w-3.5 h-3.5" style={{ color: pinned ? C.primary : C.muted, fill: pinned ? C.primary : 'none' }} />
      </button>
    </div>
  );
}

/** Pinned facts first, then by weight */
export function usePinnedFirst(list: Fact[]) {
  const { pins } = useCorner();
  return useMemo(() => [...list].sort((a, b) => (pins.includes(b.id) ? 1 : 0) - (pins.includes(a.id) ? 1 : 0) || b.weight - a.weight), [list, pins]);
}

// ── Zapytaj ──────────────────────────────────────────────────────────────

/**
 * The question builder: a sentence of underlined words — who · how · what · where — and the
 * answer next to it. Saved questions keep updating with every new game.
 */
export function AskBuilder({ initial, onSave, compact, className, autoSubject }: {
  initial?: Question; onSave?: (q: Question) => void; compact?: boolean; className?: string;
  /** Preselect this subject when it changes (clicking a player elsewhere) */
  autoSubject?: Question['subject'] | null;
}) {
  const { brief, model, careers } = useCorner();
  const first = brief.a.players[0] ?? brief.b.players[0];
  const [q, setQ] = useState<Question>(() => initial ?? defaultQuestion(first ? { kind: 'player', id: first.id } : { kind: 'team', id: brief.a.id }));
  useEffect(() => { if (autoSubject) setQ(p => ({ ...p, subject: autoSubject, hero: undefined })); }, [autoSubject?.kind, autoSubject?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const font = useHeaderFont();
  if (!model) return <div className={cn('text-[13px]', className)} style={{ color: C.muted }}>Statystyki się wczytują…</div>;

  const others = model.players.filter(p => ![...brief.a.players, ...brief.b.players].some(x => x.id === p.id));
  const subjects = [
    ...brief.a.players.map(p => ({ value: `player:${p.id}`, label: p.name, text: p.name, group: brief.a.name, icon: <Face p={p} size={20} /> })),
    ...brief.b.players.map(p => ({ value: `player:${p.id}`, label: p.name, text: p.name, group: brief.b.name, icon: <Face p={p} size={20} /> })),
    ...[brief.a, brief.b].map(t => ({ value: `team:${t.id}`, label: t.name, text: t.name, group: 'Drużyny', icon: <Crest t={t} size={20} /> })),
    ...model.teams.filter(t => t.id !== brief.a.id && t.id !== brief.b.id).map(t => ({ value: `team:${t.id}`, label: t.name, text: t.name, group: 'Inne drużyny', icon: <TeamLogo team={t} size={20} /> })),
    ...others.map(p => ({ value: `player:${p.id}`, label: p.name, text: p.name, group: 'Inni gracze', icon: <Avatar player={p} size={20} /> })),
  ];
  const isPlayer = q.subject.kind === 'player';
  const metrics = ASK_METRICS.filter(m => isPlayer || m.team);
  const m = askMetric(q.metric);
  const aggs = (m?.aggs ?? ['avg']) as AskAgg[];
  const px = isPlayer ? model.playerById.get(q.subject.id) : null;
  const heroes = isPlayer ? px?.heroes ?? [] : model.teamById.get(q.subject.id)?.heroPicks ?? [];
  const res = answer(q, model, careers);
  const set = (patch: Partial<Question>) => setQ(p => {
    const n = { ...p, ...patch };
    const nm = askMetric(n.metric); if (!nm.aggs.includes(n.agg)) n.agg = nm.aggs[0];
    if (n.subject.kind === 'team' && !nm.team) { n.metric = 'wr'; n.agg = 'avg'; }
    return n;
  });
  const hasCareer = isPlayer && careers.some(c => c.model.playerById.get(q.subject.id)?.games);

  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-2', compact ? 'text-[13px]' : 'text-[15px]')}>
        <Pick value={`${q.subject.kind}:${q.subject.id}`} options={subjects} search placeholder="" className="font-bold"
          onChange={v => { if (!v) return; const [kind, id] = String(v).split(':'); set({ subject: { kind: kind as 'player' | 'team', id }, hero: undefined, vs: undefined }); }} />
        <Pick value={q.agg} options={aggs.map(a => ({ value: a, label: AGG_LABEL[a] }))} placeholder="" onChange={v => v && set({ agg: v as AskAgg })} />
        <Pick value={q.metric} options={metrics.map(x => ({ value: x.key, label: x.label, text: x.label }))} search placeholder="" onChange={v => v && set({ metric: v as Question['metric'] })} />
        <Pick value={q.hero} placeholder="każdy bohater" search options={heroes.map(h => ({ value: h.heroId, label: heroName(h.heroId), text: heroName(h.heroId), icon: <HeroImg heroId={h.heroId} className="w-7 h-4 rounded-sm" title={false} /> }))} onChange={v => set({ hero: v as number | undefined })}
          label={q.hero != null ? `na ${heroName(q.hero)}` : undefined} />
        <Pick value={q.vs} placeholder="każdy rywal" search options={model.teams.filter(t => t.id !== q.subject.id && t.id !== px?.teamId).map(t => ({ value: t.id, label: t.name, text: t.name, icon: <TeamLogo team={t} size={18} /> }))} onChange={v => set({ vs: v as string | undefined })}
          label={q.vs ? `przeciw ${model.teamById.get(q.vs)?.name}` : undefined} />
        <Pick value={q.result} placeholder="wygrane i przegrane" options={[{ value: 'win', label: 'w wygranych' }, { value: 'loss', label: 'w przegranych' }]} onChange={v => set({ result: v as Question['result'] })} />
        <Pick value={q.last} placeholder="wszystkie gry" options={[3, 5, 10].map(n => ({ value: n, label: `ostatnie ${n}` }))} onChange={v => set({ last: v as number | undefined })} />
        {hasCareer && (
          <button type="button" onClick={() => set({ career: !q.career })} className="underline decoration-2 underline-offset-[6px]"
            style={{ color: q.career ? C.heading : C.muted, textDecorationColor: q.career ? C.primary : ink(25) }}>z poprzednimi turniejami</button>
        )}
      </div>
      <div className={cn('flex items-end gap-5', compact ? 'mt-3' : 'mt-5')}>
        <div className="shrink-0">
          <div className="font-logik-extended-bold leading-none tabular-nums" style={{ color: res.ok ? C.heading : C.muted, fontSize: compact ? 34 : 52, ...font }}>{res.text}</div>
          <div className="mt-1.5 text-[12px]" style={{ color: C.muted }}>
            {res.ok ? <>{count(res.n, 'gra', 'gry', 'gier')}{res.rank && <> · <b style={{ color: C.heading }}>{res.rank.rank}.</b> z {res.rank.of} {res.rank.among}</>}</> : 'brak gier w tym zakresie'}
          </div>
        </div>
        {res.series.length > 2 && q.metric !== 'games' && <Spark values={res.series} w={compact ? 80 : 120} h={compact ? 26 : 34} />}
        {onSave && res.ok && (
          <button type="button" onClick={() => onSave({ ...q, id: `q${Date.now().toString(36)}` })} className="ml-auto text-[11px] font-bold uppercase tracking-widest hover:underline underline-offset-4 shrink-0" style={{ color: C.primary }}>Zapisz pytanie</button>
        )}
      </div>
      {res.ok && !compact && <div className="mt-3 text-[13px] leading-snug" style={{ color: C.text }}>{res.sentence}</div>}
    </div>
  );
}

/** A saved question, answered live */
export function SavedQuestion({ q, onRemove, compact }: { q: Question; onRemove: () => void; compact?: boolean }) {
  const { model, careers } = useCorner();
  const font = useHeaderFont();
  if (!model) return null;
  const res = answer(q, model, careers);
  const name = q.subject.kind === 'player' ? model.playerById.get(q.subject.id)?.name : model.teamById.get(q.subject.id)?.name;
  const scope = scopeLabel(q, model);
  return (
    <div className="group flex items-center gap-4 py-2.5 border-b" style={{ borderColor: ink(8) }}>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate', compact ? 'text-[12.5px]' : 'text-[13.5px]')} style={{ color: C.heading }}><b>{name ?? '?'}</b> · {AGG_LABEL[q.agg]} · {lc(askMetric(q.metric)?.label ?? '')}</div>
        {scope && <div className="text-[11px] truncate" style={{ color: C.muted }}>{scope}</div>}
      </div>
      {res.series.length > 2 && !compact && <Spark values={res.series} w={64} h={20} />}
      <div className="text-right shrink-0">
        <div className="font-logik-extended-bold tabular-nums text-[20px] leading-none" style={{ color: C.heading, ...font }}>{res.text}</div>
        {res.rank && <div className="text-[10px] mt-1" style={{ color: C.muted }}>{res.rank.rank}. z {res.rank.of}</div>}
      </div>
      <button type="button" onClick={onRemove} aria-label="Usuń pytanie" className="opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ── Version picker (prototype only) ────────────────────────────────────────

/**
 * Collapsed into a faint dot in the bottom-right corner so it never takes space, never moves
 * anything and stays out of screenshots; click to open the list.
 */
export function VersionPicker({ versions, value, onChange }: { versions: Array<{ n: number; name: string }>; value: number; onChange: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-2 bottom-2 z-[60]" onMouseLeave={() => setOpen(false)}>
      {open ? (
        <div className="rounded-lg py-1.5 shadow-2xl text-[12px] min-w-[190px]" style={{ background: 'rgba(10,10,14,0.94)', border: `1px solid ${ink(12)}`, color: '#fff' }}>
          {versions.map(v => (
            <button key={v.n} type="button" onClick={() => { onChange(v.n); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-white/10" style={{ fontWeight: v.n === value ? 700 : 400 }}>
              <span className="w-4 tabular-nums opacity-60">{v.n}</span>{v.name}
              {v.n === value && <Check className="w-3.5 h-3.5 ml-auto" />}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} aria-label="Wersja" title="Wersja"
          className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center opacity-20 hover:opacity-90 transition-opacity"
          style={{ background: mix('#000', 60), color: '#fff', border: `1px solid ${ink(20)}` }}>{value}</button>
      )}
    </div>
  );
}
