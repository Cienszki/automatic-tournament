'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Clock, Trophy, Zap, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { MatchDetailModal } from '@/components/divisions/MatchDetailModal';
import type { PlayoffMatch, Match } from '@/lib/definitions';
import { CARD_HEIGHT, CARD_WIDTH } from '@/lib/playoff-bracket-generator';

interface BracketMatchCardProps {
  match: PlayoffMatch;
  divisionColor?: string;
  teamASourceLabel?: string;
  teamBSourceLabel?: string;
  cardWidth?: number;
}

/** Convert a PlayoffMatch to a partial Match for the MatchDetailModal. */
function toScheduleMatch(pm: PlayoffMatch): Match {
  return {
    id: pm.matchId || pm.id,
    teamA: {
      id: pm.teamA?.id || '',
      name: pm.teamA?.name || 'TBD',
      score: pm.result?.teamAScore ?? 0,
      logoUrl: pm.teamA?.logoUrl || '',
    },
    teamB: {
      id: pm.teamB?.id || '',
      name: pm.teamB?.name || 'TBD',
      score: pm.result?.teamBScore ?? 0,
      logoUrl: pm.teamB?.logoUrl || '',
    },
    teams: [pm.teamA?.id || '', pm.teamB?.id || ''].filter(Boolean),
    status: pm.status === 'bye' ? 'completed' : pm.status === 'live' ? 'live' : pm.status === 'completed' ? 'completed' : 'scheduled',
    scheduledFor: pm.scheduledFor || '',
    schedulingStatus: 'confirmed',
    bestOf: pm.format === 'bo1' ? 1 : pm.format === 'bo3' ? 3 : 5,
    series_format: pm.format === 'bo1' ? 'bo1' : pm.format === 'bo3' ? 'bo3' : 'bo5',
    winnerId: pm.result?.winnerId,
  } as Match;
}

export function BracketMatchCard({ match, divisionColor = '#666', teamASourceLabel, teamBSourceLabel, cardWidth }: BracketMatchCardProps) {
  const { theme } = useTournament();
  const [modalOpen, setModalOpen] = useState(false);

  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const isBye = match.status === 'bye';
  const teamAWon = isCompleted && match.result?.winnerId === match.teamA?.id;
  const teamBWon = isCompleted && match.result?.winnerId === match.teamB?.id;
  const isFinal = match.bracketType === 'final';

  const hasBothTeams = !!match.teamA && !!match.teamB;
  const canOpenModal = hasBothTeams;

  const deadlineDate = match.deadline ? new Date(match.deadline) : null;
  const scheduledDate = match.scheduledFor ? new Date(match.scheduledFor) : null;
  const completedDate = isCompleted && match.result?.completedAt ? new Date(match.result.completedAt) : null;
  const displayDate = scheduledDate || deadlineDate || completedDate;

  return (
    <>
      <motion.div
        whileHover={canOpenModal ? { scale: 1.03, y: -1 } : undefined}
        whileTap={canOpenModal ? { scale: 0.98 } : undefined}
        onClick={() => canOpenModal && setModalOpen(true)}
        className={cn(
          'group relative overflow-hidden rounded-lg border backdrop-blur-md transition-all duration-300',
          canOpenModal ? 'cursor-pointer' : 'cursor-default',
          isLive
            ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
            : isFinal
              ? 'border-yellow-500/30'
              : 'border-white/10 hover:border-white/20',
        )}
        style={{
          width: cardWidth ?? CARD_WIDTH,
          height: CARD_HEIGHT,
          backgroundColor: 'rgba(255,255,255,0.05)',
          ...(isFinal ? { boxShadow: `0 0 24px ${theme?.primaryColor || '#FFD700'}15` } : {}),
        }}
      >

        {/* Live pulse */}
        {isLive && (
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent animate-pulse pointer-events-none" />
        )}

        {/* Match code + format badge — top-left */}
        {match.code && (
          <div
            className="absolute top-1 left-1.5 z-20 flex items-center gap-1.5 px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: isFinal ? `${theme?.primaryColor || '#d4af37'}30` : 'rgba(255,255,255,0.08)',
              color: isFinal ? (theme?.primaryColor || '#d4af37') : (theme?.secondaryTextColor || '#888'),
            }}
          >
            <span className="text-[9px] font-mono tracking-wider uppercase">{match.code}</span>
            {match.format && (
              <span className="text-[9px] font-mono opacity-50">· {match.format}</span>
            )}
          </div>
        )}

        {/* Status / deadline badge — top-right */}
        <div className="absolute top-1 right-1.5 z-20 flex items-center gap-1">
          {isLive ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
              <Zap className="w-2.5 h-2.5 text-red-500 animate-pulse" />
              <span className="text-[9px] font-bold text-red-400 uppercase">Live</span>
            </div>
          ) : displayDate ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06]">
              <Clock className="w-2.5 h-2.5" style={{ color: theme?.secondaryTextColor || '#666' }} />
              <span className="text-[9px] font-mono" style={{ color: theme?.secondaryTextColor || '#666' }}>
                {format(displayDate, "d MMM', 'HH:mm", { locale: pl })}
              </span>
            </div>
          ) : null}
        </div>

        {/* Grand final trophy */}
        {isFinal && (
          <Trophy
            className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-4 z-20 opacity-60"
            style={{ color: theme?.primaryColor || '#d4af37' }}
          />
        )}

        {/* Team rows */}
        <div className="relative z-10 h-full flex flex-col justify-center divide-y divide-white/5 pt-5">
          <TeamRow
            team={match.teamA}
            isWinner={teamAWon}
            isLoser={teamBWon}
            isCompleted={isCompleted}
            score={(isCompleted || isLive) ? match.result?.teamAScore : undefined}
            sourceLabel={teamASourceLabel}
            theme={theme}
          />
          <TeamRow
            team={match.teamB}
            isWinner={teamBWon}
            isLoser={teamAWon}
            isCompleted={isCompleted}
            score={(isCompleted || isLive) ? match.result?.teamBScore : undefined}
            sourceLabel={teamBSourceLabel}
            theme={theme}
          />
        </div>

        {/* Hover glow */}
        {canOpenModal && (
          <div
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ boxShadow: `inset 0 0 0 1px ${divisionColor}30, 0 0 16px ${divisionColor}10` }}
          />
        )}
      </motion.div>

      {canOpenModal && (
        <MatchDetailModal
          match={toScheduleMatch(match)}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          divisionColor={divisionColor}
        />
      )}
    </>
  );
}

function TeamRow({
  team,
  isWinner,
  isLoser,
  isCompleted,
  score,
  sourceLabel,
  theme,
}: {
  team?: { id: string; name: string; logoUrl?: string };
  isWinner: boolean;
  isLoser: boolean;
  isCompleted: boolean;
  score?: number;
  sourceLabel?: string;
  theme: ReturnType<typeof useTournament>['theme'];
}) {
  if (!team) {
    return (
      <div className="h-[42px] flex items-center gap-2.5 px-2.5">
        <div className="w-7 h-7 rounded border border-white/8 bg-white/5 shrink-0 flex items-center justify-center">
          <span className="text-[9px] font-mono" style={{ color: theme?.secondaryTextColor || '#4b5563' }}>?</span>
        </div>
        <span
          className="font-mono text-[9px] uppercase tracking-wider italic truncate"
          style={{ color: theme?.secondaryTextColor || '#4b5563' }}
        >
          {sourceLabel || 'TBD'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-[42px] flex items-center justify-between px-2.5 gap-1 transition-colors',
        isLoser && isCompleted && 'opacity-35',
      )}
      style={isWinner ? { background: `linear-gradient(to right, ${theme?.primaryColor || '#d4af37'}1a, transparent)` } : undefined}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="relative w-7 h-7 rounded bg-black/40 overflow-hidden shrink-0">
          <Image
            src={team.logoUrl || `https://placehold.co/28x28.png?text=${team.name.charAt(0)}`}
            alt={team.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <span
          className="font-logik-extended-bold text-[11px] truncate uppercase tracking-tight leading-tight"
          style={{
            color: isWinner
              ? (theme?.headingColor || theme?.primaryColor || '#d4af37')
              : isLoser && isCompleted
                ? (theme?.secondaryTextColor || '#6b7280')
                : (theme?.primaryTextColor || '#d1d5db'),
            fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
          }}
        >
          {team.name}
        </span>
      </div>
      {score !== undefined && (
        <span
          className="text-sm font-mono font-bold shrink-0 tabular-nums"
          style={{
            color: isWinner
              ? (theme?.headingColor || theme?.primaryColor || '#d4af37')
              : (theme?.secondaryTextColor || '#6b7280'),
          }}
        >
          {score}
        </span>
      )}
    </div>
  );
}
