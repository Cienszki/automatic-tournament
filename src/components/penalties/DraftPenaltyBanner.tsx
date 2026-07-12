'use client';

import { Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DraftPenalty } from '@/lib/definitions';
import { DRAFT_PENALTY_LEVELS } from '@/lib/definitions';

interface DraftPenaltyBannerProps {
  penalties?: DraftPenalty[];
  teamA?: { id?: string; name?: string };
  teamB?: { id?: string; name?: string };
  /**
   * When set, text is written from this team's perspective (own vs opponent). When omitted, a
   * neutral third-person label is used (for admin / match-detail views).
   */
  myTeamId?: string;
  className?: string;
}

/**
 * Renders admin-issued draft-time penalties for a match. Used in the match-detail modal (neutral)
 * and the my-team match card / notifications (captain perspective — different text for own vs
 * opponent penalties).
 */
export function DraftPenaltyBanner({ penalties, teamA, teamB, myTeamId, className }: DraftPenaltyBannerProps) {
  if (!penalties || penalties.length === 0) return null;

  const nameFor = (id: string): string =>
    id === teamA?.id ? (teamA?.name || 'Drużyna A')
      : id === teamB?.id ? (teamB?.name || 'Drużyna B')
        : id;

  return (
    <div className={cn('space-y-2', className)}>
      {penalties.map((p) => {
        const lvl = DRAFT_PENALTY_LEVELS[p.level];
        const gamesLabel = !p.games || p.games.length === 0 ? 'całą serię' : `gry ${p.games.join(', ')}`;
        const isMine = !!myTeamId && p.teamId === myTeamId;

        const text = myTeamId
          ? isMine
            ? `Twoja drużyna ma karę draftu (−${lvl.seconds}s czasu na draft) na ${gamesLabel}.`
            : `Przeciwnik (${nameFor(p.teamId)}) ma karę draftu (−${lvl.seconds}s czasu na draft) na ${gamesLabel}.`
          : `${nameFor(p.teamId)} — kara draftu −${lvl.seconds}s (${lvl.label}) na ${gamesLabel}.`;

        return (
          <div
            key={p.id}
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2',
              isMine ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10',
            )}
          >
            <Gavel className="w-4 h-4 mt-0.5 shrink-0" style={{ color: isMine ? '#f87171' : '#f59e0b' }} />
            <div className="text-xs leading-snug">
              <p className="font-logik-extended-bold">{text}</p>
              {p.reason ? <p className="opacity-70 mt-0.5">Powód: {p.reason}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
