// src/components/divisions/FixtureCrossbox.tsx
// Premium Interactive Matrix

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Grid3x3, Info } from 'lucide-react';
import type { Match } from '@/lib/definitions';
import { MatchDetailModal } from './MatchDetailModal';
import { TeamLogo } from './TeamLogo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TeamStanding {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
}

interface FixtureCrossboxProps {
  matches: Match[];
  standings: TeamStanding[];
  divisionColor: string;
  divisionTier?: number;
  theme: any;
  divisionTheme?: string;
}

interface MatchResult {
  homeScore: number;
  awayScore: number;
  date: string;
  status: 'pending' | 'scheduled' | 'completed' | 'live';
  schedulingStatus: string;
  match: Match;
}

function getTeamAbbr(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 3) return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

export function FixtureCrossbox({
  matches,
  standings,
  divisionColor,
  divisionTier,
  theme,
  divisionTheme
}: FixtureCrossboxProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  const getTierClass = (tier?: number) => {
    if (tier === 1) return { text: 'text-shine-gold', border: 'border-shine-gold' };
    if (tier === 2) return { text: 'text-shine-silver', border: 'border-shine-silver' };
    if (tier === 3) return { text: 'text-shine-bronze', border: 'border-shine-bronze' };
    return { text: 'pdl-gradient-text', border: '' };
  };

  const tierStyle = getTierClass(divisionTier);
  
  // Get theme color
  const displayColor = divisionTheme ? require('@/lib/division-themes').getDivisionTheme(divisionTheme)?.primaryColor || divisionColor : divisionColor;

  // Adaptive cell size based on team count (for 8-10 teams the matrix needs to be more compact)
  const teamCount = standings.length;
  const cellSize = teamCount >= 9 ? 56 : teamCount >= 7 ? 64 : 72;
  const cellClass = teamCount >= 9 ? 'w-14 h-14' : teamCount >= 7 ? 'w-16 h-16' : 'w-[72px] h-[72px]';
  const logoSize = teamCount >= 7 ? 32 : 36;

  const getMatchResult = (homeTeamId: string, awayTeamId: string): MatchResult | null => {
    const match = matches.find(m =>
      (m.teamA.id === homeTeamId && m.teamB.id === awayTeamId) ||
      (m.teamA.id === awayTeamId && m.teamB.id === homeTeamId)
    );

    if (!match) return null;

    const isHomeTeamA = match.teamA.id === homeTeamId;

    return {
      homeScore: isHomeTeamA ? match.teamA.score : match.teamB.score,
      awayScore: isHomeTeamA ? match.teamB.score : match.teamA.score,
      date: match.scheduledFor || '',
      status: match.status,
      schedulingStatus: match.schedulingStatus || 'unscheduled',
      match: match,
    };
  };

  const getCellContent = (result: MatchResult | null) => {
    if (!result) {
      return <div className="w-full h-full flex items-center justify-center opacity-10"><div className="w-1 h-1 rounded-full bg-white" /></div>;
    }

    const isCompleted = result.status === 'completed' || result.status === 'live';

    // Not yet scheduled — show nothing
    if (!isCompleted && !result.date) {
      return <div className="w-full h-full" />;
    }

    const handleClick = () => {
      if (result.match) {
        setSelectedMatch(result.match);
        setIsModalOpen(true);
      }
    };

    // Show scheduled date/time when match has a date but isn't completed yet
    if (!isCompleted) {
      const matchDate = result.date ? new Date(result.date) : null;
      const isValidDate = matchDate && !isNaN(matchDate.getTime());
      return (
        <button
          onClick={handleClick}
          className="w-full h-full flex flex-col items-center justify-center gap-0 hover:bg-white/5 transition-colors group relative"
        >
          <span className="text-[11px] font-mono font-semibold tracking-tight leading-tight" style={{ color: 'var(--tournament-secondary-text)' }}>
            {isValidDate ? format(matchDate, 'dd.MM', { locale: pl }) : 'TBD'}
          </span>
          {isValidDate && (
            <span className="text-[11px] font-mono font-semibold tracking-tight leading-tight" style={{ color: 'var(--tournament-secondary-text)' }}>
              {format(matchDate, 'HH:mm', { locale: pl })}
            </span>
          )}
        </button>
      );
    }

    // Completed match
    const isWin = result.homeScore > result.awayScore;
    const isDraw = result.homeScore === result.awayScore;

    return (
      <button
        onClick={handleClick}
        className="w-full h-full flex items-center justify-center transition-all group relative overflow-hidden"
      >
        <div className={cn(
          "absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20",
          isWin ? "bg-emerald-500" : isDraw ? "bg-amber-500" : "bg-rose-500"
        )} />

        <div className="flex items-baseline gap-0.5 z-10 font-black text-sm tracking-tight">
          <span className={cn(isWin ? "text-emerald-400" : isDraw ? "text-amber-400" : "text-rose-400")}>
            {result.homeScore}
          </span>
          <span className="text-white/20 text-[10px]">:</span>
          <span className={cn(!isWin && !isDraw ? "text-emerald-400" : isDraw ? "text-amber-400" : "text-rose-400")}>
            {result.awayScore}
          </span>
        </div>
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="rounded-2xl overflow-hidden bg-white/[0.04] backdrop-blur-sm" style={{ border: `1px solid ${displayColor}20` }}>

      <div className="overflow-auto max-h-[800px] relative custom-scrollbar">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-30 backdrop-blur-md">
            <tr>
              <th className={cn(
                    "sticky left-0 z-40 backdrop-blur-md p-0 border-r border-b border-white/5",
                    cellClass
                  )}>
                <div className="w-full h-full flex items-center justify-center opacity-20">
                  <Info className="w-3 h-3" />
                </div>
              </th>
              {standings.map((team) => (
                <th
                  key={`header-${team.teamId}`}
                  className={cn(
                    "p-0",
                    cellClass
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex justify-center items-center h-full cursor-default">
                        <TeamLogo
                          src={team.teamLogoUrl}
                          name={team.teamName}
                          size={logoSize}
                          fallbackClassName="text-[10px] opacity-70"
                          className={cn("transition-[filter,transform] duration-100", hoveredCol === team.teamId ? "brightness-150 scale-110" : "")}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs font-medium">{team.teamName}</p>
                    </TooltipContent>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((homeTeam) => (
              <tr
                key={homeTeam.teamId}
              >
                {/* Row header */}
                <td
                  className="sticky left-0 z-20 backdrop-blur-md border-r border-white/5 w-14 p-0"

                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 cursor-default">
                        <TeamLogo
                          src={homeTeam.teamLogoUrl}
                          name={homeTeam.teamName}
                          size={logoSize}
                          fallbackClassName="text-[10px] opacity-70"
                          className={cn("transition-[filter,transform] duration-100", hoveredRow === homeTeam.teamId ? "brightness-150 scale-110" : "")}
                        />
                        <span className="text-[7px] font-mono uppercase tracking-wider leading-none opacity-40">
                          {getTeamAbbr(homeTeam.teamName)}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="text-xs font-medium">{homeTeam.teamName}</p>
                    </TooltipContent>
                  </Tooltip>
                </td>

                {/* Cells */}
                {standings.map((awayTeam) => {
                  const isSameTeam = homeTeam.teamId === awayTeam.teamId;
                  const result = isSameTeam ? null : getMatchResult(homeTeam.teamId, awayTeam.teamId);

                  return (
                    <td
                      key={`${homeTeam.teamId}-${awayTeam.teamId}`}
                      className={cn(
                        "p-0 text-center relative border border-white/[0.02]",
                        cellClass,
                        isSameTeam ? "bg-white/[0.02]" : ""
                      )}
                      onMouseEnter={() => { setHoveredRow(homeTeam.teamId); setHoveredCol(awayTeam.teamId); }}
                      onMouseLeave={() => { setHoveredRow(null); setHoveredCol(null); }}
                    >
                      {isSameTeam ? (
                        <div className="w-full h-full opacity-[0.03]" style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #fff 2px, #fff 4px)'
                        }} />
                      ) : (
                        getCellContent(result)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MatchDetailModal
        match={selectedMatch}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMatch(null);
        }}
        divisionColor={divisionColor}
      />
    </div>
    </TooltipProvider>
  );
}
