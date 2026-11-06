'use client';

// A caster's view on the account page (when they don't captain a team): the banner's right side is
// their stream link (click to set it; any platform, a bare name means Twitch), then the matches they
// cast — with the lobby to look for — beside every match still to come. The first caster to take a
// match leads it (their stream is the match's stream); others join as co-casters, and the lead can
// be handed over. Talks to /api/casters.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { C, TeamLogo, ink, useHeaderFont } from '@/components/stats-lab/kit';
import { Act, Kicker, Label, dayTime } from '@/components/team/ui';
import { coCasters, mainCaster, type MatchCaster } from '@/lib/casters';
import { streamLabel } from '@/lib/stream-link';
import type { AccountBanner } from './AccountPage';

interface Side { id: string; name: string; tag: string | null; logoUrl: string | null }
interface CMatch { id: string; scheduledFor: string; teamA: Side; teamB: Side; casters: MatchCaster[]; round: number | null; lobby: { name: string; password: string | null } | null }
type Action = 'take' | 'drop' | { main: string };

const TL = 'color-mix(in srgb, var(--tournament-primary) 65%, #fff)';
const crest = (s: Side) => ({ name: s.name, tag: s.tag ?? undefined, logoUrl: s.logoUrl ?? undefined });

/** Main caster first, ringed in the tournament colour */
function Faces({ casters }: { casters: MatchCaster[] }) {
  const main = mainCaster(casters);
  return (
    <span className="flex -space-x-2">
      {[...(main ? [main] : []), ...coCasters(casters)].map(c => {
        const ring = c === main ? 'ring-2 ring-[var(--tournament-primary)]' : 'ring-2 ring-[var(--tournament-background,#0b0b10)]';
        const tip = c === main ? `${c.name} (prowadzi)` : `${c.name} (co-caster)`;
        return c.avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img key={c.uid} src={c.avatar} alt={c.name} title={tip} referrerPolicy="no-referrer" className={`w-7 h-7 rounded-full object-cover ${ring}`} />
          : <span key={c.uid} title={tip} className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-[#24242c] ${ring}`}>{c.name.slice(0, 1)}</span>;
      })}
    </span>
  );
}

function Teams({ m }: { m: CMatch }) {
  const font = useHeaderFont();
  return (
    <span className="flex items-center gap-2.5 min-w-0 font-logik-extended-bold uppercase text-[15px]" style={{ color: C.heading, ...font }}>
      <TeamLogo team={crest(m.teamA)} size={28} /><span className="truncate">{m.teamA.name}</span>
      <span className="text-[11px] shrink-0" style={{ color: C.muted }}>vs</span>
      <span className="truncate">{m.teamB.name}</span><TeamLogo team={crest(m.teamB)} size={28} />
    </span>
  );
}

export function CasterDesk({ banner, tournamentId, stream, onStream, hasSteam, uid }: {
  banner: AccountBanner; tournamentId: string; stream: string | null; uid: string; hasSteam: boolean;
  onStream: (v: string) => Promise<boolean>;
}) {
  const { user, connectSteam } = useAuth();
  const font = useHeaderFont();
  const [matches, setMatches] = useState<CMatch[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [link, setLink] = useState(stream ?? '');
  const field = useRef<HTMLInputElement>(null);

  const call = useCallback(async (method: 'GET' | 'POST', body?: object) => {
    const token = await user!.getIdToken();
    const r = await fetch(method === 'GET' ? `/api/casters?t=${encodeURIComponent(tournamentId)}` : '/api/casters', {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Coś poszło nie tak');
    return j;
  }, [user, tournamentId]);
  useEffect(() => { call('GET').then(j => setMatches(j.matches)).catch(e => setError(e.message)); }, [call]);
  useEffect(() => { if (editing) field.current?.select(); }, [editing]);
  useEffect(() => { setLink(stream ?? ''); }, [stream]);

  const act = async (m: CMatch, action: Action) => {
    setBusy(m.id); setError(null);
    try {
      const { casters } = await call('POST', { t: tournamentId, matchId: m.id, action });
      setMatches(ms => ms?.map(x => (x.id === m.id ? { ...x, casters } : x)) ?? null);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const saveLink = async () => {
    if (link.trim() === (stream ?? '')) { setEditing(false); return; }
    if (await onStream(link.trim())) setEditing(false);
  };

  const mine = matches?.filter(m => m.casters.some(c => c.uid === uid)) ?? [];
  const side = (
    <div className="min-w-0 lg:text-right">
      <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: TL }}>Caster · transmisja</div>
      {editing ? (
        <input ref={field} value={link} onChange={e => setLink(e.target.value)} onBlur={saveLink} maxLength={200}
          onKeyDown={e => { if (e.key === 'Enter') saveLink(); if (e.key === 'Escape') { setLink(stream ?? ''); setEditing(false); } }}
          placeholder="link albo kanał na Twitchu" aria-label="Link do transmisji"
          className="mt-1.5 w-full lg:w-[min(560px,40vw)] lg:text-right bg-transparent outline-none border-b-2 border-white/40 focus:border-white font-bold text-[22px]" />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="group mt-1.5 flex items-center gap-3 lg:ml-auto max-w-full" aria-label="Zmień link do transmisji">
          <Pencil className="w-5 h-5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity order-last lg:order-first" />
          <span className="font-logik-extended-bold uppercase leading-[0.95] truncate" style={{ fontSize: 'clamp(22px, 2.2vw, 40px)', ...font }}>
            {stream ? streamLabel(stream) : <span className="text-white/45">Dodaj link</span>}
          </span>
        </button>
      )}
      <div className="mt-2 text-[13px] text-white/65">
        {mine.length ? `Castujesz: ${mine.length} z ${matches!.length} nadchodzących meczów` : 'Wybierz mecze, które poprowadzisz'}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-1 lg:min-h-0" style={{ ['--team' as string]: C.primary }}>
      {banner(side)}
      <div className="px-[var(--pad)] pt-7 pb-5 lg:flex-1 lg:min-h-0 grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pr-1">
          <Label>Twoje mecze</Label>
          {!hasSteam && (
            <div className="mb-4 text-[13px]" style={{ color: C.text }}>
              Bot zaprosi cię do lobby, gdy <button type="button" onClick={connectSteam} className="font-bold underline underline-offset-4" style={{ color: C.primary }}>połączysz konto ze Steam</button>.
            </div>
          )}
          {!matches ? null : !mine.length ? (
            <div className="py-2 text-[13px]" style={{ color: C.muted }}>Weź mecz z listy obok. Kapitanowie dostaną powiadomienie, kto go poprowadzi.</div>
          ) : mine.map(m => {
            const main = mainCaster(m.casters)!;
            const lead = main.uid === uid;
            const others = m.casters.filter(c => c.uid !== uid);
            return (
              <div key={m.id} className="py-4 border-b" style={{ borderColor: ink(10) }}>
                <div className="flex items-center gap-3">
                  <Kicker>{dayTime(m.scheduledFor)} · {lead ? 'prowadzisz' : 'co-caster'}</Kicker>
                  <span className="ml-auto"><Act danger disabled={busy === m.id} onClick={() => act(m, 'drop')}>Rezygnuję</Act></span>
                </div>
                <div className="mt-2"><Teams m={m} /></div>
                {m.lobby && (
                  <div className="mt-2.5 text-[13px]" style={{ color: C.text }}>
                    <span style={{ color: C.muted }}>Lobby </span><b style={{ color: C.heading }}>{m.lobby.name}</b>
                    {m.lobby.password && <><span style={{ color: C.muted }}> · hasło </span><b style={{ color: C.heading }}>{m.lobby.password}</b></>}
                  </div>
                )}
                {!lead && (
                  <div className="mt-2 text-[13px]" style={{ color: C.muted }}>
                    Prowadzi <b style={{ color: C.heading }}>{main.name}</b>
                    {main.stream && <> · <a href={main.stream} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4" style={{ color: C.primary }}>{streamLabel(main.stream)}</a></>}
                  </div>
                )}
                {lead && others.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" style={{ color: C.muted }}>
                    <span>Co-caster:</span>
                    {others.map(c => (
                      <span key={c.uid} className="flex items-center gap-2">
                        <b style={{ color: C.heading }}>{c.name}</b>
                        <button type="button" disabled={busy === m.id} onClick={() => act(m, { main: c.uid })} title={`Prowadzenie i transmisja przejdą do: ${c.name}`}
                          className="text-[11px] font-bold uppercase tracking-widest hover:underline underline-offset-4 disabled:opacity-40" style={{ color: C.primary }}>Oddaj prowadzenie</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pr-1">
          <Label right={error ? <span className="font-bold" style={{ color: C.loss }}>{error}</span> : undefined}>Nadchodzące mecze</Label>
          {!matches ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.muted }} />
            : !matches.length ? <div className="py-2 text-[13px]" style={{ color: C.muted }}>Brak zaplanowanych meczów.</div>
            : matches.map(m => {
              const me = m.casters.find(c => c.uid === uid);
              const main = mainCaster(m.casters);
              return (
                // Phones: when, casters and the action on one line, the teams under them
                <div key={m.id} className="flex flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-2 py-3 border-b" style={{ borderColor: ink(8) }}>
                  <span className="lg:w-[118px] shrink-0 text-[12px] tabular-nums" style={{ color: C.muted }}>{dayTime(m.scheduledFor)}</span>
                  <span className="order-last lg:order-none basis-full lg:basis-auto lg:flex-1 min-w-0"><Teams m={m} /></span>
                  <span className="ml-auto lg:ml-0"><Faces casters={m.casters} /></span>
                  <span className="w-[110px] shrink-0 text-right">
                    {busy === m.id ? <Loader2 className="w-4 h-4 animate-spin inline" style={{ color: C.muted }} />
                      : me ? <span className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-widest" style={{ color: C.win }}><Check className="w-3.5 h-3.5" />{me.main ? 'Prowadzisz' : 'Co-caster'}</span>
                      : main ? <Act onClick={() => act(m, 'take')}>Co-caster</Act>
                      : <Act onClick={() => act(m, 'take')}>Castuję</Act>}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
