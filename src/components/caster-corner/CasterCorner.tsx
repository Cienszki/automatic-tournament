'use client';

// The caster corner (/[slug]/caster): everything a caster needs to talk about a series as if
// they had followed the whole tournament. Five prototype versions share one brief (see
// src/lib/caster-corner/brief.ts) and differ in how it is laid out and used; the picker is a faint
// dot in the corner. Casters and admins of the tournament only — anyone else can ask to cast.

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { C, useHeaderFont } from '@/components/stats-lab/kit';
import { FitStage } from '@/components/team/ui';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CornerProvider } from './data';
import { VersionPicker } from './ui';

const VERSIONS = [
  { n: 1, name: 'Tablica', C: dynamic(() => import('./versions/V1Board')) },
  { n: 2, name: 'Scenariusz', C: dynamic(() => import('./versions/V2RunSheet')) },
  { n: 3, name: 'Raport', C: dynamic(() => import('./versions/V3Notes')) },
  { n: 4, name: 'Analityk', C: dynamic(() => import('./versions/V4Desk')) },
  { n: 5, name: 'Fiszki', C: dynamic(() => import('./versions/V5Cards')) },
];
const VKEY = 'caster-corner:version';

function useVersion(): [number, (n: number) => void] {
  const [v, setV] = useState(1);
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get('v'));
    let saved = 0; try { saved = Number(localStorage.getItem(VKEY)); } catch { /* */ }
    const n = [q, saved].find(x => VERSIONS.some(y => y.n === x));
    if (n) setV(n);
  }, []);
  const set = useCallback((n: number) => {
    setV(n);
    try { localStorage.setItem(VKEY, String(n)); } catch { /* */ }
    const u = new URL(window.location.href); u.searchParams.set('v', String(n)); window.history.replaceState(null, '', u.toString());
  }, []);
  return [v, set];
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex flex-col items-center justify-center gap-5 text-center px-6" style={{ color: C.muted }}>{children}</div>;
}

/** Not a caster: one click asks the organisers */
function AskToCast({ error }: { error: string }) {
  const { user } = useAuth();
  const { tournament } = useTournament();
  const font = useHeaderFont();
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const send = async () => {
    setState('busy'); setMsg(null);
    try {
      const r = await fetch('/api/caster-requests', { method: 'POST', headers: { Authorization: `Bearer ${await user!.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ t: tournament!.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Nie udało się wysłać zgłoszenia');
      setState('sent');
    } catch (e) { setMsg((e as Error).message); setState('idle'); }
  };
  return (
    <Centered>
      <div className="font-logik-extended-bold uppercase text-[28px]" style={{ color: C.heading, ...font }}>{error}</div>
      {state === 'sent' ? <div className="text-[15px]">Zgłoszenie wysłane. Dostaniesz powiadomienie, gdy organizatorzy je przyjmą.</div> : (
        <button type="button" onClick={send} disabled={state === 'busy'} className="rounded-full px-8 py-3 font-bold uppercase tracking-widest text-white text-[13px] disabled:opacity-50" style={{ background: C.primary }}>
          Zgłoś się na castera
        </button>
      )}
      {msg && <div className="text-[13px] font-bold" style={{ color: C.loss }}>{msg}</div>}
    </Centered>
  );
}

export default function CasterCorner() {
  const { user, loading, signIn } = useAuth();
  const [v, setV] = useVersion();
  const font = useHeaderFont();
  const Version = VERSIONS.find(x => x.n === v)!.C;
  const frame = (children: React.ReactNode) => <div className="w-full" style={{ height: 'calc(100svh - 3.5rem)' }}>{children}</div>;
  if (loading) return null;
  if (!user) {
    return frame(
      <Centered>
        <button type="button" onClick={signIn} className="rounded-full px-10 py-4 font-logik-extended-bold uppercase tracking-widest text-white text-[15px]" style={{ background: C.primary, ...font }}>Zaloguj się</button>
      </Centered>,
    );
  }
  return frame(
    <TooltipProvider delayDuration={120}>
      <CornerProvider fallback={s => (
        s.state === 'denied' ? <AskToCast error={s.error} />
          : s.state === 'error' ? <Centered><span style={{ color: C.loss }}>{s.error}</span></Centered>
          : <Centered><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: C.primary }} /></Centered>
      )}>
        {() => (
          <>
            <FitStage><Version /></FitStage>
            <VersionPicker versions={VERSIONS} value={v} onChange={setV} />
          </>
        )}
      </CornerProvider>
    </TooltipProvider>,
  );
}

