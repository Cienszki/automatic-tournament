'use client';

// Shared pieces of the team views on the account page (teams-section language: rules and type)

import React from 'react';
import type { Match } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { C, ink, useHeaderFont } from '@/components/stats-lab/kit';

/** The team's colour (from its crest, else the theme's), set on the root as a CSS variable */
export const T = 'var(--team)';

/** Heading on a rule that starts in the team colour (as in the teams section) */
export function Label({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  const font = useHeaderFont();
  return (
    <div className={cn('shrink-0 mb-3', className)}>
      <div className="flex items-center gap-3 min-h-[20px]">
        <h3 className="text-[11px] font-logik-extended-bold uppercase tracking-[0.22em]" style={{ color: T, ...font }}>{children}</h3>
        {right && <div className="ml-auto flex items-center gap-3 text-[11px]" style={{ color: C.muted }}>{right}</div>}
      </div>
      <div className="relative h-px mt-1.5" style={{ background: ink(12) }}>
        <span className="absolute left-0 top-0 h-px w-10" style={{ background: T }} />
      </div>
    </div>
  );
}

/** A text action in the team colour (or red for destructive ones) */
export function Act({ children, onClick, danger, disabled, className }: { children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline whitespace-nowrap', className)}
      style={{ color: danger ? C.loss : T }}>{children}</button>
  );
}

export const dayTime = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
};

/** Our score and theirs in a played match */
export function seriesScore(m: Match, myTeamId: string) {
  const a = m.teamA?.id === myTeamId;
  const us = (a ? m.teamA?.score : m.teamB?.score) ?? 0;
  const them = (a ? m.teamB?.score : m.teamA?.score) ?? 0;
  return { us, them, color: us > them ? C.win : us < them ? C.loss : C.muted };
}

