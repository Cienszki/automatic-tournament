'use client';

// Version 1 — "Tablica": a football commentator's spotting board for Dota. Both line-ups face each
// other position by position (carry against carry, mid against mid), each player one row: face,
// nick, the stats the caster chose, signature heroes and their own one-line note. The series is on
// top, the things worth saying at the bottom. A click on a player opens the full dossier.

import React, { useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { C, ink, useHeaderFont } from '@/components/stats-lab/kit';
import { RoleTag } from '@/components/draft-prep/role';
import { cn } from '@/lib/utils';
import { ROLES } from '@/lib/stats-lab/season';
import { HEADER_FACT, type PlayerBrief, type TeamBrief } from '@/lib/caster-corner/brief';
import { noteKey, useCorner, useLocal } from '../data';
import { Crest, Face, FactRow, FitName, HeroChip, MatchSwitch, NoteField, usePinnedFirst, when } from '../ui';
import { FIELD_ORDER, FIELDS, Form, PlayerDossier, ProbBar, signature, teamLine, useTeamColors, type FieldKey } from '../parts';

const DEFAULT_FIELDS: FieldKey[] = ['score', 'record', 'kda', 'rank'];


function TeamHead({ t, right }: { t: TeamBrief; right?: boolean }) {
  const font = useHeaderFont();
  return (
    <div className={cn('flex items-center gap-6 min-w-0', right && 'flex-row-reverse text-right')}>
      <Crest t={t} size={96} />
      <div className="min-w-0 flex-1">
        <FitName text={t.name} max={38} min={20} lines={2} className="font-logik-extended-bold uppercase" style={{ color: '#fff', ...font }} />
        <div className="mt-2 text-[13px] text-white/70 truncate">{teamLine(t)}</div>
        <div className={cn('mt-2 flex', right && 'justify-end')}><Form t={t} /></div>
      </div>
    </div>
  );
}

function Cell({ p, side, fields, color, onOpen }: { p?: PlayerBrief; side: 'a' | 'b'; fields: FieldKey[]; color: string; onOpen: (p: PlayerBrief) => void }) {
  const { notes } = useCorner();
  const font = useHeaderFont();
  const right = side === 'b';
  if (!p) return <div className="flex-1" />;
  const say = notes[noteKey.say(p.id)];
  return (
    <div className={cn('group flex-1 min-w-0 flex items-center gap-4 cursor-pointer', right && 'flex-row-reverse text-right')} onClick={() => onOpen(p)}>
      <Face p={p} size={64} ring={p.standin ? '#ffd27a' : undefined} />
      <div className="min-w-0 w-[190px] shrink-0">
        <FitName text={p.name} max={23} min={13} className="font-logik-extended-bold uppercase group-hover:underline underline-offset-4 decoration-2" style={{ color: C.heading, textDecorationColor: color, ...font }} />
        <div className="mt-1.5 text-[12px] truncate" style={{ color: C.muted }}>
          {p.standin ? <span style={{ color: '#ffd27a' }}>standin za {p.standin.replacesName}{p.standin.status === 'pending' ? ' (prośba)' : ''}</span> : say ? <i>„{say}”</i> : p.games ? null : 'pierwsze gry w turnieju'}
        </div>
        <div onClick={e => e.stopPropagation()} className="mt-1">
          <NoteField k={noteKey.player(p.id)} rows={1} placeholder="+ notatka" className={cn('text-[12.5px] italic border-transparent focus:border-current', right && 'text-right')} style={{ color }} />
        </div>
      </div>
      <div className={cn('flex gap-4 shrink-0', right && 'flex-row-reverse')}>
        {fields.map(k => {
          const f = FIELDS[k]; const sub = f.sub?.(p);
          return (
            <div key={k} className="w-[60px]" title={f.name}>
              <div className="text-[9.5px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>{f.label}</div>
              <div className="font-bold text-[18px] tabular-nums leading-tight truncate" style={{ color: C.heading }}>{f.value(p)}</div>
              {sub && <div className="text-[10px] truncate" style={{ color: C.muted }}>{sub}</div>}
            </div>
          );
        })}
      </div>
      <div className={cn('flex gap-1.5 min-w-0 flex-1', right ? 'flex-row-reverse justify-end' : 'justify-end')}>
        {signature(p, 3).map(h => <HeroChip key={h.hero} hero={h.hero} g={h.g} w={h.w} size={50} tip={h.pub ? 'poza turniejem, ostatnie 90 dni' : undefined} />)}
      </div>
    </div>
  );
}

function FieldsMenu({ fields, setFields, showFact, setShowFact }: { fields: FieldKey[]; setFields: (f: FieldKey[]) => void; showFact: boolean; setShowFact: (v: boolean) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: C.muted }}>
          <SlidersHorizontal className="w-3.5 h-3.5" />Ustaw tablicę
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-4" style={{ background: 'var(--tournament-background, #0e0e14)', borderColor: ink(14), color: C.text }}>
        <div className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: C.muted }}>Liczby przy graczu (do 4)</div>
        {FIELD_ORDER.map(k => {
          const on = fields.includes(k);
          return (
            <button key={k} type="button" disabled={!on && fields.length >= 4}
              onClick={() => setFields(on ? fields.filter(x => x !== k) : FIELD_ORDER.filter(x => x === k || fields.includes(x)))}
              className="w-full flex items-center gap-2.5 py-1.5 text-left text-[13px] disabled:opacity-35">
              <span className="w-4 h-4 rounded-[3px] border flex items-center justify-center" style={{ borderColor: on ? C.primary : ink(30), background: on ? C.primary : 'transparent' }}>{on && <Check className="w-3 h-3 text-white" />}</span>
              {FIELDS[k].name}
            </button>
          );
        })}
        <div className="h-px my-3" style={{ background: ink(10) }} />
        <button type="button" onClick={() => setShowFact(!showFact)} className="w-full flex items-center gap-2.5 py-1.5 text-left text-[13px]">
          <span className="w-4 h-4 rounded-[3px] border flex items-center justify-center" style={{ borderColor: showFact ? C.primary : ink(30), background: showFact ? C.primary : 'transparent' }}>{showFact && <Check className="w-3 h-3 text-white" />}</span>
          Pasek z tematami pod składami
        </button>
      </PopoverContent>
    </Popover>
  );
}

export default function V1Board() {
  const { brief, store, match, pending } = useCorner();
  const colors = useTeamColors(brief);
  const font = useHeaderFont();
  const [fields, setFields] = useLocal<FieldKey[]>(`${store}:v1:fields`, DEFAULT_FIELDS);
  const [showFact, setShowFact] = useLocal<boolean>(`${store}:v1:fact`, true);
  const [open, setOpen] = useState<PlayerBrief | null>(null);

  // Rows by position; a team with extra people (pending standins) shows them after the five
  const byPos = (t: TeamBrief, i: number) => t.players.find(p => p.pos === i + 1 && p.standin?.status !== 'pending');
  const rows = ROLES.map((role, i) => ({ role, a: byPos(brief.a, i), b: byPos(brief.b, i) }));
  const extraA = brief.a.players.filter(p => !rows.some(r => r.a === p)); const extraB = brief.b.players.filter(p => !rows.some(r => r.b === p));
  for (let i = 0; i < Math.max(extraA.length, extraB.length); i++) rows.push({ role: extraA[i]?.role as typeof ROLES[number] ?? extraB[i]?.role, a: extraA[i], b: extraB[i] });

  const talk = usePinnedFirst(brief.facts.filter(f => !f.player && !HEADER_FACT.test(f.id))).slice(0, 6);
  const meta = [when(match.scheduledFor), `Bo${match.bestOf}`, brief.stage?.label].filter(Boolean).join(' · ');

  return (
    <div className="h-full flex flex-col">
      {/* The series */}
      <div className="relative shrink-0 overflow-hidden text-white" style={{ background: '#0b0b10' }}>
        {[brief.a, brief.b].map((t, i) => t.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.id} src={t.logoUrl} alt="" aria-hidden className="absolute top-1/2 -translate-y-1/2 w-[46%] object-cover opacity-60" style={{ [i ? 'right' : 'left']: '-6%', filter: 'blur(60px) saturate(1.6)', height: '260%' }} />
        ))}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.55))' }} />
        <div className="absolute inset-x-0 bottom-0 h-[3px] flex"><span className="flex-1" style={{ background: colors[0] }} /><span className="flex-1" style={{ background: colors[1] }} /></div>
        <div className="relative px-[var(--pad)] h-[180px] grid grid-cols-[minmax(0,1fr)_520px_minmax(0,1fr)] items-center gap-8">
          <TeamHead t={brief.a} />
          <div className="text-center min-w-0">
            <MatchSwitch big className="text-white" />
            <div className="mt-2 text-[13px] text-white/70">{meta}</div>
            {brief.stage?.stake && <div className="mt-1.5 text-[14px] font-bold text-white">{brief.stage.stake}</div>}
            {match.status === 'completed' && <div className="mt-1 font-logik-extended-bold text-[30px]" style={font}>{match.scoreA}:{match.scoreB}</div>}
            <ProbBar brief={brief} colors={colors} className="mt-3 max-w-[360px] mx-auto" />
          </div>
          <TeamHead t={brief.b} right />
        </div>
      </div>

      {/* Line-ups, position against position */}
      <div className="flex-1 min-h-0 px-[var(--pad)] pt-3 flex flex-col">
        <div className="flex items-center justify-end gap-4 h-6 text-[11px]" style={{ color: C.muted }}>
          {pending > 0 && <span>Wczytuję rankedy graczy…</span>}
          <FieldsMenu fields={fields} setFields={setFields} showFact={showFact} setShowFact={setShowFact} />
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          {rows.map((r, i) => (
            <div key={i} className="flex-1 min-h-0 flex items-center gap-4 border-b" style={{ borderColor: ink(8) }}>
              <Cell p={r.a} side="a" fields={fields} color={colors[0]} onOpen={setOpen} />
              <div className="w-[84px] shrink-0 flex flex-col items-center justify-center text-[11px] uppercase tracking-[0.16em]" style={{ color: C.muted }}>
                <span className="text-[22px] mb-1" style={{ color: C.heading }}><RoleTag role={r.role} label={false} /></span>
                {r.role === 'Soft Support' ? 'Soft sup.' : r.role === 'Hard Support' ? 'Hard sup.' : r.role ?? ''}
              </div>
              <Cell p={r.b} side="b" fields={fields} color={colors[1]} onOpen={setOpen} />
            </div>
          ))}
        </div>
      </div>

      {/* Worth saying */}
      {showFact && (
        <div className="shrink-0 px-[var(--pad)] pt-4 pb-5 grid grid-cols-3 gap-x-12 gap-y-2.5">
          {talk.map(f => <FactRow key={f.id} f={f} />)}
        </div>
      )}
      <PlayerDossier p={open} onClose={() => setOpen(null)} />
    </div>
  );
}
