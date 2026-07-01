// src/components/divisions/DivisionStandingsTable.tsx
// Leaderboard 2.0: Floating Glass Panels & Interactive Viz

'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Trophy, ArrowUp, ArrowDown, TrendingUp, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { useHomeNavigation } from '@/context/HomeNavigationContext';
import { TeamLogo } from './TeamLogo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import type { GroupHighlight } from '@/lib/definitions';

interface TeamStanding {
  position: number;
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  neustadtlScore: number;
  points: number;
  form?: ('W' | 'D' | 'L')[];
}

interface DivisionStandingsTableProps {
  standings: TeamStanding[];
  divisionColor: string;
  divisionName: string;
  currentRound?: number;
  matchday?: string;
  isElite: boolean;
  isLowest: boolean;
  theme: any;
  highlights?: GroupHighlight[];
}

function computeRowHighlightColor(
  position: number,
  totalTeams: number,
  highlights: GroupHighlight[]
): string | null {
  let topOffset = 0;
  let bottomOffset = 0;

  for (const h of highlights) {
    if (h.from === 'top') {
      if (position > topOffset && position <= topOffset + h.count) {
        return h.color;
      }
      topOffset += h.count;
    } else {
      const start = totalTeams - bottomOffset - h.count + 1;
      const end = totalTeams - bottomOffset;
      if (position >= start && position <= end) {
        return h.color;
      }
      bottomOffset += h.count;
    }
  }
  return null;
}

// Form bars: last 10 matches, recent on the right. W=tall green, D=medium yellow, L=short red
function FormBars({ form }: { form: ('W' | 'D' | 'L')[] }) {
  const recent = (form ?? []).slice(-10);
  if (recent.length === 0) {
    return (
      <div className="flex items-end gap-[3px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[5px] h-3 rounded-[2px] bg-white/5" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-[3px]">
      {recent.map((r, i) => {
        const isW = r === 'W';
        const isD = r === 'D';
        return (
          <div
            key={i}
            className="w-[5px] rounded-[2px] transition-all"
            style={{
              height: isW ? '20px' : isD ? '13px' : '7px',
              backgroundColor: isW ? '#10b981' : isD ? '#f59e0b' : '#ef4444',
              opacity: 0.75,
            }}
          />
        );
      })}
    </div>
  );
}

export function DivisionStandingsTable({
  standings,
  divisionColor,
  divisionName,
  isElite,
  isLowest,
  theme,
  highlights = [],
}: DivisionStandingsTableProps) {
  const { getTournamentPath } = useTournament();
  const { isHomeActive, goToTeam } = useHomeNavigation();
  const router = useRouter();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm">
        <div className="divide-y divide-white/[0.05]">
          {standings.map((team, index) => {
            const highlightColor = computeRowHighlightColor(team.position, standings.length, highlights);

            return (
              <motion.div
                key={team.teamId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="relative px-3 py-2.5 border-l-[3px]"
                style={{
                  borderLeftColor: highlightColor || 'rgba(255,255,255,0.12)',
                  background: highlightColor
                    ? `linear-gradient(90deg, ${highlightColor}12, transparent)`
                    : 'transparent',
                }}
              >
                <button
                  onClick={() => {
                    if (isHomeActive()) {
                      goToTeam(team.teamId);
                    } else {
                      router.push(getTournamentPath(`/?view=teams&team=${team.teamId}`));
                    }
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 shrink-0 text-center font-mono font-bold text-lg text-white/25">
                      {team.position < 10 ? `0${team.position}` : team.position}
                    </span>

                    <TeamLogo
                      src={team.teamLogoUrl}
                      name={team.teamName}
                      size={32}
                    />

                    <div className="min-w-0 flex-1">
                      <div
                        className="font-logik-extended-bold text-base leading-tight break-words"
                        style={{ color: 'var(--tournament-primary-text)' }}
                      >
                        {team.teamName}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div
                        className="text-xl font-logik-extended-bold leading-none"
                        style={{
                          color: index < 2 ? 'var(--tournament-primary-text)' : 'var(--tournament-heading)',
                        }}
                      >
                        {team.points}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--tournament-secondary-text)' }}>
                        pkt
                      </div>
                    </div>
                  </div>
                </button>

                <div className="mt-2 flex items-center justify-between pl-[52px] pr-0.5">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--tournament-secondary-text)' }}>M</div>
                      <div className="text-sm font-mono" style={{ color: 'var(--tournament-primary-text)' }}>{team.matchesPlayed}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--tournament-secondary-text)' }}>W</div>
                      <div className="text-sm font-mono text-emerald-500/90">{team.wins}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--tournament-secondary-text)' }}>D</div>
                      <div className="text-sm font-mono text-amber-500/90">{team.draws}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--tournament-secondary-text)' }}>L</div>
                      <div className="text-sm font-mono text-rose-500/70">{team.losses}</div>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono" style={{ color: 'var(--tournament-secondary-text)' }}>
                    N: {team.neustadtlScore.toFixed(2)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm">
      {/* Header Grid */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-logik-extended-bold uppercase tracking-[0.2em]" style={{ color: 'var(--tournament-secondary-text)' }}>
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-5">Drużyna</div>
        <div className="col-span-1 text-center">M</div>
        <div className="col-span-2 text-center grid grid-cols-3">
          <span>W</span><span>D</span><span>L</span>
        </div>
        <div className="col-span-1 text-center hidden md:block">Pkt</div>
        <div className="col-span-2 text-right hidden lg:block">Forma</div>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {standings.map((team, index) => {
          const highlightColor = computeRowHighlightColor(team.position, standings.length, highlights);

          return (
            <motion.div
              key={team.teamId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative grid grid-cols-12 gap-4 items-center px-6 py-2.5 rounded-r-xl border-l-[3px]"
              style={{
                borderLeftColor: highlightColor || 'rgba(255,255,255,0.08)',
                background: highlightColor
                  ? `linear-gradient(90deg, ${highlightColor}09, transparent)`
                  : 'transparent',
              }}
            >
              {/* Floating Rank Number */}
              <div className="col-span-1 flex justify-center">
                <span className="font-mono font-bold text-lg text-white/20">
                  {team.position < 10 ? `0${team.position}` : team.position}
                </span>
              </div>

              {/* Team Info */}
              <div className="col-span-5">
                <button
                  onClick={() => {
                    if (isHomeActive()) {
                      goToTeam(team.teamId);
                    } else {
                      router.push(getTournamentPath(`/?view=teams&team=${team.teamId}`));
                    }
                  }}
                  className="flex items-center gap-4 text-left"
                >
                  <TeamLogo
                    src={team.teamLogoUrl}
                    name={team.teamName}
                    size={40}
                  />
                  <div className="flex flex-col">
                    <span
                      className="font-logik-extended-bold font-bold text-base"
                      style={{ color: 'var(--tournament-primary-text)' }}
                    >
                      {team.teamName}
                    </span>
                  </div>
                </button>
              </div>

              {/* Matches Played */}
              <div className="col-span-1 text-center" style={{ color: 'var(--tournament-secondary-text)' }}>
                <span>{team.matchesPlayed}</span>
              </div>

              {/* W/D/L */}
              <div className="col-span-2 grid grid-cols-3 text-center font-bold text-base font-mono">
                <span className="text-emerald-500/80">{team.wins}</span>
                <span className="text-amber-500/80">{team.draws}</span>
                <span className="text-rose-500/50">{team.losses}</span>
              </div>

              {/* Points (Highlight) */}
              <div className="col-span-1 text-center hidden md:flex justify-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="font-bold text-xl cursor-default"
                        style={{
                          color: index < 2 ? 'var(--tournament-primary-text)' : 'var(--tournament-secondary-text)',
                        }}
                      >
                        {team.points}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Neustadtl: {team.neustadtlScore.toFixed(2)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Form Viz */}
              <div className="col-span-2 hidden lg:flex justify-end pr-2 opacity-50">
                <FormBars form={team.form || []} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
