'use client';

// When captains can play scrims: add your own windows, see everyone's on a week calendar. A window
// that overlaps one of yours by at least an hour is marked; clicking another team's window copies
// its captain's Discord.

import React from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, X } from 'lucide-react';
import { DateInput } from '@/components/ui/date-time-input';
import { cn } from '@/lib/utils';
import { C, Tip, TipBody, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { Label, T } from './ui';

export interface ScrimSlot {
  id: string;
  teamId: string;
  teamName: string;
  divisionId?: string;
  captainDiscord: string;
  startAt: string;
  endAt: string;
  boFormat: 'bo1' | 'bo2';
  notes?: string;
  status?: 'active' | 'filled' | 'expired';
  createdAt?: string;
  updatedAt?: string;
}

export interface AvailabilityProps {
  isCaptain: boolean;
  /** This team's windows that haven't ended */
  mine: ScrimSlot[];
  /** Every team's windows that haven't ended */
  all: ScrimSlot[];
  weekStart: Date;
  setWeekStart: (d: Date) => void;
  copied: string | null;
  onCopy: (discord: string) => void;
  onDelete: (slotId: string) => void;
  onCreate: () => void;
  saving: boolean;
  form: {
    date: string; setDate: (v: string) => void;
    start: string; setStart: (v: string) => void;
    end: string; setEnd: (v: string) => void;
    bo: 'bo1' | 'bo2'; setBo: (v: 'bo1' | 'bo2') => void;
    notes: string; setNotes: (v: string) => void;
  };
}

const HOUR_HEIGHT = 46;
const CAL_START = 14;
const CAL_END = 24;
const CAL_HOURS = CAL_END - CAL_START;
const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];
const ONE_HOUR = 60 * 60 * 1000;

const normalizeTime = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`; };
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const field = 'bg-transparent border-0 border-b-2 rounded-none px-0 h-10 text-[16px] outline-none focus:border-[var(--team)]';

/** Side-by-side columns for windows that overlap on one day */
function layoutSlots(slots: ScrimSlot[]): Map<string, { col: number; cols: number }> {
  const sorted = [...slots].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const ends: number[] = [];
  const at = new Map<string, number>();
  for (const s of sorted) {
    const start = new Date(s.startAt).getTime(), end = new Date(s.endAt).getTime();
    let c = ends.findIndex(e => e <= start);
    if (c < 0) { c = ends.length; ends.push(end); } else ends[c] = end;
    at.set(s.id, c);
  }
  return new Map([...at].map(([id, col]) => [id, { col, cols: ends.length }]));
}

const overlapsMine = (slot: ScrimSlot, mine: ScrimSlot[]) => {
  const s = new Date(slot.startAt).getTime(), e = new Date(slot.endAt).getTime();
  return mine.some(m => Math.min(e, new Date(m.endAt).getTime()) - Math.max(s, new Date(m.startAt).getTime()) >= ONE_HOUR);
};

export function Availability(p: AvailabilityProps) {
  const font = useHeaderFont();
  const { form } = p;
  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(p.weekStart); d.setDate(p.weekStart.getDate() + i); return d; }), [p.weekStart]);
  const shift = (n: number) => { const d = new Date(p.weekStart); d.setDate(d.getDate() + n * 7); p.setWeekStart(d); };
  const range = `${days[0].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`;
  const now = new Date();
  const nowFrac = now.getHours() + now.getMinutes() / 60;
  const ready = !!form.date && /^\d\d:\d\d$/.test(form.start) && /^\d\d:\d\d$/.test(form.end);

  return (
    <div className="flex flex-col gap-10">
      {p.isCaptain && (
        <section>
          <Label>Dodaj swoje okno</Label>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Dzień</span>
              <DateInput aria-label="Dzień" value={form.date} onChange={form.setDate} className="w-[190px] bg-transparent" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Od</span>
              <input inputMode="numeric" placeholder="20:00" value={form.start} onChange={e => form.setStart(normalizeTime(e.target.value))} className={cn(field, 'w-[80px] tabular-nums')} style={{ borderColor: ink(20), color: C.heading }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Do</span>
              <input inputMode="numeric" placeholder="22:00" value={form.end} onChange={e => form.setEnd(normalizeTime(e.target.value))} className={cn(field, 'w-[80px] tabular-nums')} style={{ borderColor: ink(20), color: C.heading }} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Format</span>
              <div className="flex h-10 items-center -ml-2">
                {(['bo2', 'bo1'] as const).map(b => (
                  <button key={b} type="button" onClick={() => form.setBo(b)} className="relative px-2 py-1 font-logik-extended-bold uppercase text-[15px]" style={{ color: form.bo === b ? C.heading : C.muted, ...font }}>
                    {b.toUpperCase()}
                    {form.bo === b && <span className="absolute left-1.5 right-1.5 -bottom-0.5 h-[3px] rounded-full" style={{ background: T }} />}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Notatka</span>
              <input value={form.notes} onChange={e => form.setNotes(e.target.value)} maxLength={120} className={cn(field, 'w-full')} style={{ borderColor: ink(20), color: C.heading }} />
            </label>
            <button type="button" onClick={p.onCreate} disabled={p.saving || !ready}
              className="inline-flex items-center gap-2 h-10 px-6 rounded-full text-[12px] font-bold uppercase tracking-widest text-white transition-[filter] hover:brightness-110 disabled:opacity-40"
              style={{ background: T }}>
              {p.saving && <Loader2 className="w-4 h-4 animate-spin" />}Dodaj
            </button>
          </div>
        </section>
      )}

      <section>
        <Label right={
          <>
            <span className="hidden sm:flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[2px]" style={{ background: T }} />Twoje</span>
            <span className="hidden sm:flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[2px]" style={{ background: C.win }} />Pasuje do Twojego</span>
            <span className="hidden sm:flex items-center gap-1.5 mr-3"><i className="w-2.5 h-2.5 rounded-[2px]" style={{ background: ink(35) }} />Inne</span>
            <button type="button" onClick={() => shift(-1)} aria-label="Poprzedni tydzień" className="p-1 opacity-70 hover:opacity-100"><ChevronLeft className="w-4 h-4" /></button>
            <span className="tabular-nums font-bold" style={{ color: C.heading }}>{range}</span>
            <button type="button" onClick={() => shift(1)} aria-label="Następny tydzień" className="p-1 opacity-70 hover:opacity-100"><ChevronRight className="w-4 h-4" /></button>
          </>
        }>Tydzień</Label>

        <div className="overflow-x-auto -mx-4 px-4">
          <div className="min-w-[680px]">
            <div className="flex pl-11">
              {days.map((d, i) => {
                const today = d.toDateString() === now.toDateString();
                return (
                  <div key={i} className="flex-1 text-center pb-2 select-none">
                    <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>{DAYS[i]}</div>
                    <div className="font-logik-extended-bold text-[16px]" style={{ color: today ? T : C.heading, ...font }}>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex">
              <div className="w-11 shrink-0 relative" style={{ height: HOUR_HEIGHT * CAL_HOURS }}>
                {Array.from({ length: CAL_HOURS / 2 + 1 }, (_, k) => CAL_START + k * 2).map(h => (
                  <div key={h} className="absolute right-2 text-[10px] tabular-nums -translate-y-1/2" style={{ top: (h - CAL_START) * HOUR_HEIGHT, color: C.muted }}>{h === 24 ? '00' : h}:00</div>
                ))}
              </div>
              {days.map((day, di) => {
                const slots = p.all.filter(s => new Date(s.startAt).toDateString() === day.toDateString());
                const lay = layoutSlots(slots);
                const today = day.toDateString() === now.toDateString();
                return (
                  <div key={di} className="flex-1 relative" style={{ height: HOUR_HEIGHT * CAL_HOURS, borderLeft: `1px solid ${ink(8)}`, background: today ? mix(T, 5) : undefined }}>
                    {Array.from({ length: CAL_HOURS + 1 }, (_, i) => (
                      <div key={i} className="absolute inset-x-0" style={{ top: i * HOUR_HEIGHT, borderTop: `1px solid ${ink(i % 2 ? 4 : 9)}` }} />
                    ))}
                    {today && nowFrac >= CAL_START && nowFrac <= CAL_END && (
                      <div className="absolute inset-x-0 z-10 h-[2px] pointer-events-none" style={{ top: (nowFrac - CAL_START) * HOUR_HEIGHT, background: C.loss }} />
                    )}
                    {slots.map(slot => {
                      const l = lay.get(slot.id)!;
                      const sd = new Date(slot.startAt), ed = new Date(slot.endAt);
                      const sf = sd.getHours() + sd.getMinutes() / 60;
                      const raw = ed.getHours() + ed.getMinutes() / 60;
                      const ef = raw < sf ? CAL_END : raw; // past midnight
                      // Outside the shown hours: a one-hour tile at the nearest edge
                      const [a, b] = ef <= CAL_START ? [CAL_START, CAL_START + 1] : sf >= CAL_END ? [CAL_END - 1, CAL_END] : [Math.max(sf, CAL_START), Math.min(ef, CAL_END)];
                      const mine = slot.teamId === p.mine[0]?.teamId || p.mine.some(m => m.id === slot.id);
                      const fits = !mine && overlapsMine(slot, p.mine);
                      const tone = mine ? T : fits ? C.win : ink(45);
                      const copiedThis = !mine && p.copied === slot.captainDiscord;
                      return (
                        <Tip key={slot.id} content={
                          <TipBody title={slot.teamName}>
                            {hm(sd)}–{hm(ed)} · {slot.boFormat.toUpperCase()}{slot.notes ? <><br />{slot.notes}</> : null}
                            {!mine && slot.captainDiscord ? <><br />Kliknij, by skopiować Discord: {slot.captainDiscord}</> : null}
                          </TipBody>
                        }>
                          <div role={mine ? undefined : 'button'} tabIndex={mine ? undefined : 0}
                            onClick={() => { if (!mine) p.onCopy(slot.captainDiscord); }}
                            onKeyDown={e => { if (!mine && (e.key === 'Enter' || e.key === ' ')) p.onCopy(slot.captainDiscord); }}
                            className={cn('group absolute z-[2] rounded-[4px] overflow-hidden flex flex-col px-2 py-1 text-left transition-[filter]', !mine && 'cursor-pointer hover:brightness-125')}
                            style={{
                              top: (a - CAL_START) * HOUR_HEIGHT + 1, height: Math.max((b - a) * HOUR_HEIGHT - 2, 18),
                              left: `calc(${(l.col / l.cols) * 100}% + 2px)`, width: `calc(${100 / l.cols}% - 4px)`,
                              background: mix(tone, mine || fits ? 22 : 12), boxShadow: `inset 3px 0 0 ${tone}`,
                            }}>
                            <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: C.heading }}>{slot.teamName}</span>
                            <span className="text-[10px] tabular-nums truncate" style={{ color: C.text }}>{hm(sd)}–{hm(ed)} · {slot.boFormat.toUpperCase()}</span>
                            <span className="absolute right-1 bottom-1">
                              {mine ? (
                                <button type="button" onClick={e => { e.stopPropagation(); p.onDelete(slot.id); }} aria-label="Usuń okno"
                                  className="p-0.5 rounded opacity-60 hover:opacity-100" style={{ color: C.loss }}>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : copiedThis ? <Check className="w-3.5 h-3.5" style={{ color: C.win }} /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-70" />}
                            </span>
                          </div>
                        </Tip>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
