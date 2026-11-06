'use client';

// Before the first pack: rivals and the ranking see a name, so an account without its own nick
// and without Discord picks one here (saved to the account through /api/account) or links Discord.

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { C, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';

export function NameStep({ onDone, compact = false }: { onDone: () => void; compact?: boolean }) {
  const { user, linkDiscord, discordLogin } = useAuth();
  const font = useHeaderFont();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = name.trim().length >= 2;

  const save = async () => {
    if (!ok || !user) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/account', {
        method: 'PUT', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: name.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Nie udało się zapisać');
      onDone();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <div className={`flex flex-col ${compact ? 'gap-4' : 'items-center text-center gap-7'}`} style={{ color: C.text }}>
      <div>
        <div className={`font-logik-extended-bold uppercase leading-none ${compact ? 'text-[18px]' : 'text-[44px]'}`} style={{ color: C.heading, ...font }}>Jak cię nazywać?</div>
        <div className={`mt-2 ${compact ? 'text-[15px]' : 'text-[17px]'}`} style={{ color: C.muted }}>Twój nick zobaczą rywale i ranking.</div>
      </div>
      <form className="flex items-center gap-3" onSubmit={e => { e.preventDefault(); save(); }}>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder="Nick"
          className="h-[54px] w-[320px] rounded-[8px] px-4 text-[17px] outline-none bg-transparent"
          style={{ color: C.heading, boxShadow: `inset 0 0 0 1.5px ${ink(25)}` }} />
        <button type="submit" disabled={!ok || busy} className="h-[54px] px-8 rounded-[8px] font-logik-extended-bold uppercase tracking-widest text-[15px] text-white disabled:opacity-40 flex items-center gap-2"
          style={{ background: C.primary, boxShadow: ok ? `0 0 24px ${mix(C.primary, 50)}` : undefined, ...font }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Zapisz
        </button>
      </form>
      {discordLogin !== false && (
        <div className="flex items-center gap-3 text-[15px]" style={{ color: C.muted }}>
          albo
          <button type="button" onClick={() => linkDiscord()} className="h-[44px] px-5 rounded-[8px] font-semibold text-white" style={{ background: '#5865F2' }}>Połącz Discord</button>
        </div>
      )}
      {error && <div className="text-[14px] font-bold" style={{ color: C.loss }}>{error}</div>}
    </div>
  );
}
