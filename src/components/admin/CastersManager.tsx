'use client';

// Admin panel: who casts this tournament. People who asked to cast (from their account page) wait
// at the top to be accepted or declined; any other account can be found by nick or Discord name
// and given the caster role; casters with Steam linked are let into every bot lobby (the bot's whitelist), the
// others are told to link Steam. Talks to /api/manage/casters.

import React, { useCallback, useEffect, useState } from 'react';
import { Mic, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { streamLabel } from '@/lib/stream-link';

interface Caster { uid: string; name: string; avatar: string | null; steamId64: string | null; discord: string | null; stream: string | null }
interface Found { uid: string; name: string; discord: string | null; avatar: string | null }
interface Request extends Caster { at: string }

function Pic({ src, name }: { src: string | null; name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover shrink-0" />
    : <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-white/10 text-sm font-bold">{name.slice(0, 1).toUpperCase()}</span>;
}

export function CastersManager() {
  const { user } = useAuth();
  const { tournament, theme } = useTournament();
  const [casters, setCasters] = useState<Caster[] | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (method: 'GET' | 'POST' | 'DELETE', arg?: string | object) => {
    const token = await user!.getIdToken();
    const qs = method === 'GET' ? `?tournamentId=${encodeURIComponent(tournament!.id)}${arg ? `&q=${encodeURIComponent(String(arg))}` : ''}` : '';
    const r = await fetch(`/api/manage/casters${qs}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify({ tournamentId: tournament!.id, ...(arg as object) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Coś poszło nie tak');
    return j;
  }, [user, tournament]);

  useEffect(() => {
    if (user && tournament?.id) call('GET').then(j => { setCasters(j.casters); setRequests(j.requests ?? []); }).catch(e => setError(e.message));
  }, [user, tournament?.id, call]);

  // Search as you type
  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) { setFound([]); return; }
    const t = setTimeout(() => call('GET', v).then(j => setFound(j.found ?? [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, call]);

  const act = async (method: 'POST' | 'DELETE', uid: string, request = false) => {
    setBusy(uid); setError(null);
    try {
      const j = await call(method, { uid, ...(request ? { request: true } : {}) });
      setCasters(j.casters); setRequests(j.requests ?? []);
      if (method === 'POST') { setQ(''); setFound([]); }
    }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const have = new Set(casters?.map(c => c.uid));
  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
          <Mic className="h-5 w-5" style={{ color: theme.primaryColor }} />
          Casterzy
        </CardTitle>
        <CardDescription className="font-logik">
          Casterzy sami wybierają mecze na stronie konta. Bot zaprasza ich do lobby tych meczów i nie wyrzuca z żadnego lobby turnieju, jeśli mają połączony Steam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: theme.primaryColor }}>Chcą castować</p>
            <div className="divide-y divide-border border-y border-border">
              {requests.map(r => (
                <div key={r.uid} className="flex items-center gap-3 py-2.5">
                  <Pic src={r.avatar} name={r.name} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold truncate">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[r.discord && `Discord @${r.discord}`, r.stream && streamLabel(r.stream), new Date(r.at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {busy === r.uid ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
                    <>
                      <button type="button" onClick={() => act('DELETE', r.uid, true)} className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-red-500">Odrzuć</button>
                      <button type="button" onClick={() => act('POST', r.uid)} className="text-xs font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: theme.primaryColor }}>Przyjmij</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="relative">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Nick albo nazwa na Discordzie…" className="font-logik" />
          {found.length > 0 && (
            <div className="mt-2 divide-y divide-border border-y border-border">
              {found.map(f => (
                <button key={f.uid} type="button" disabled={have.has(f.uid) || busy === f.uid} onClick={() => act('POST', f.uid)}
                  className="w-full flex items-center gap-3 py-2 text-left hover:bg-white/5 disabled:opacity-50">
                  <Pic src={f.avatar} name={f.name} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold truncate">{f.name}</span>
                    {f.discord && <span className="block text-xs text-muted-foreground">@{f.discord}</span>}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.primaryColor }}>
                    {have.has(f.uid) ? 'Już jest' : busy === f.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dodaj'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-sm font-bold text-red-500">{error}</p>}
        {!casters ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : casters.length === 0 ? (
          <p className="text-sm text-muted-foreground font-logik">Ten turniej nie ma jeszcze casterów.</p>
        ) : (
          <div className="divide-y divide-border">
            {casters.map(c => (
              <div key={c.uid} className="group flex items-center gap-3 py-2.5">
                <Pic src={c.avatar} name={c.name} />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[c.discord && `Discord @${c.discord}`, c.steamId64 && 'Steam połączony', c.stream && streamLabel(c.stream)].filter(Boolean).join(' · ')}
                  </span>
                  {(!c.steamId64 || !c.discord) && (
                    <span className="block text-xs text-amber-500">
                      {[!c.steamId64 && 'bez Steam: bot nie zaprosi do lobby ani nie wpuści', !c.discord && 'bez Discorda: wiadomości tylko na stronie'].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <button type="button" onClick={() => act('DELETE', c.uid)} disabled={busy === c.uid} aria-label={`Usuń ${c.name}`}
                  className="p-2 text-red-500 opacity-40 group-hover:opacity-100 hover:bg-red-500/10 rounded">
                  {busy === c.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
