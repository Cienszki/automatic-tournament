'use client';

// The prep tool on a phone: read-only and scrolling. A captain opening the link from Discord gets
// the two things they need on the go — who the rivals are (with their heroes) and the cheat sheet.
// The plan board and the simulator need a big screen and say so.

import React, { useState } from 'react';
import { Avatar, C, HeroImg, TeamLogo, ink, useHeaderFont } from '@/components/stats-lab/kit';
import { heroName } from '@/lib/stats-lab/heroes';
import { count } from '@/lib/plural';
import { SOURCES, roleLabel } from '@/lib/draft-prep/engine';
import { useDP } from './state';
import { DataChip, LoadBanner, RULE } from './ui';
import { useCheatSheet } from './sheet';

function TeamPick({ side }: { side: 'us' | 'them' }) {
  const dp = useDP(); const font = useHeaderFont();
  const value = side === 'us' ? dp.us : dp.them;
  return (
    <label className="flex items-center gap-3 min-w-0">
      <TeamLogo team={value} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>{side === 'us' ? 'Moja drużyna' : dp.match ? 'Najbliższy rywal' : 'Rywal'}</span>
        <select value={value?.id ?? ''} onChange={e => (side === 'us' ? dp.setUs : dp.setThem)(e.target.value)} className="w-full bg-transparent font-logik-extended-bold uppercase outline-none"
          style={{ color: side === 'us' ? C.radiant : C.dire, fontSize: 18, ...font }}>
          {dp.teams.filter(t => side === 'us' || t.id !== dp.us?.id).map(t => <option key={t.id} value={t.id} style={{ background: '#15151c', color: '#fff' }}>{t.name}</option>)}
        </select>
      </span>
    </label>
  );
}

function Rivals() {
  const dp = useDP(); const sheet = useCheatSheet();
  if (!sheet) return null;
  return (
    <div className="flex flex-col">
      {sheet.order.map(o => {
        const pm = o.pm;
        return (
          <div key={pm.p.key} className="py-3 border-b" style={{ borderColor: RULE }}>
            <div className="flex items-center gap-3">
              <span className="w-6 font-bold" style={{ color: C.dire }}>{o.k + 1}.</span>
              <Avatar player={{ name: pm.p.name, avatar: dp.lineThem.find(s => s.key === pm.p.key)?.avatar }} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold truncate" style={{ color: C.heading }}>{pm.p.name}</span>
                <span className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>{roleLabel(pm.p.role)}<DataChip pm={pm} /></span>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {sheet.heroesOf(pm.p.key).map(h => {
                const st = pm.p.heroes.get(h);
                const g = st ? SOURCES.reduce((a, s) => a + st.cells[s].all.g, 0) : 0;
                return (
                  <span key={h} className="min-w-0">
                    <HeroImg heroId={h} className="rounded-sm w-full aspect-video" />
                    <span className="block truncate text-[10px] mt-0.5" style={{ color: C.text }}>{heroName(h)}</span>
                    <span className="block text-[10px]" style={{ color: C.muted }}>{g ? count(g, 'gra', 'gry', 'gier') : 'rola / meta'}</span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="pt-3 text-xs" style={{ color: C.muted }}>Numer przy graczu to przewidywana kolejność wyboru w ich drużynie.</p>
    </div>
  );
}

function Sheet() {
  const sheet = useCheatSheet();
  const [copied, setCopied] = useState(false);
  if (!sheet) return null;
  return (
    <div className="flex flex-col gap-1 text-sm" style={{ color: C.text }}>
      {sheet.lines.map((l, k) => <div key={k} className={l ? '' : 'h-2'} style={l.startsWith('**') ? { color: C.heading, fontWeight: 700 } : undefined}>{l.replace(/\*\*/g, '').replace(/_\((.*)\)_/, '($1)')}</div>)}
      <button type="button" onClick={() => { navigator.clipboard?.writeText(sheet.lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
        className="mt-3 py-3 font-bold uppercase tracking-[0.3em] text-white" style={{ background: C.primary }}>{copied ? 'Skopiowano' : 'Kopiuj na Discorda'}</button>
    </div>
  );
}

export function MobilePrep() {
  const dp = useDP();
  const [tab, setTab] = useState<'rivals' | 'sheet'>('rivals');
  const when = dp.match?.scheduledFor ? new Date(dp.match.scheduledFor).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="flex flex-col gap-3 pb-8">
      <div className="flex flex-col gap-2 pb-3 border-b" style={{ borderColor: RULE }}>
        <TeamPick side="us" />
        <div className="text-xs pl-[52px]" style={{ color: C.muted }}>vs · {dp.match ? `${when ?? 'termin nieustalony'}${dp.match.bestOf ? ` · Bo${dp.match.bestOf}` : ''}` : 'bez zaplanowanego meczu'}</div>
        <TeamPick side="them" />
        {!dp.loggedIn && <div className="text-xs" style={{ color: C.muted }}>Zaloguj się, a narzędzie samo wybierze twoją drużynę.</div>}
      </div>
      <LoadBanner />
      <div className="flex gap-6 text-sm font-bold uppercase tracking-wider">
        {([['rivals', 'Rywale'], ['sheet', 'Ściąga']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="pb-1 border-b-2" style={{ borderColor: tab === k ? C.secondary : 'transparent', color: tab === k ? C.heading : C.muted }}>{l}</button>
        ))}
      </div>
      {tab === 'rivals' ? <Rivals /> : <Sheet />}
      <div className="mt-2 rounded-lg p-3 text-xs" style={{ background: ink(6), color: C.muted }}>Plan banów, symulacja draftu i drafty rywali są dostępne na komputerze.</div>
    </div>
  );
}
