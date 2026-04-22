// src/components/divisions/FixtureCrossbox.tsx
// Premium Interactive Matrix

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar, Grid3x3, Info } from 'lucide-react';
import type { Match } from '@/lib/definitions';
import { MatchDetailModal } from './MatchDetailModal';
import { TeamLogo } from './TeamLogo';

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
  status: 'scheduled' | 'completed' | 'live';
  match: Match;
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
      match: match,
    };
  };

  const getCellContent = (result: MatchResult | null) => {
    if (!result) {
      return <div className="w-full h-full flex items-center justify-center opacity-10"><div className="w-1 h-1 rounded-full bg-white" /></div>;
    }

    const handleClick = () => {
      if (result.match) {
        setSelectedMatch(result.match);
        setIsModalOpen(true);
      }
    };

    if (result.status === 'scheduled') {
      const matchDate = result.date ? new Date(result.date) : null;
      return (
        <button
          onClick={handleClick}
          className="w-full h-full flex flex-col items-center justify-center gap-0.5 hover:bg-white/5 transition-colors group relative"
        >
          <Calendar className="h-3 w-3 text-white/30 group-hover:text-white/80 transition-colors" />
          <span className="text-[9px] font-mono tracking-tighter" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
            {matchDate && !isNaN(matchDate.getTime())
              ? format(matchDate, 'dd.MM', { locale: pl })
              : 'TBD'}
          </span>
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
    <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-xl">
      <div className="p-4 flex items-center gap-3 mb-1">
        <Grid3x3 className="w-5 h-5" style={{ color: displayColor }} />
        <h3 className="text-lg font-logik-extended-bold transition-all" style={{ color: theme?.headingColor || theme?.primaryTextColor || displayColor }}>Wyniki</h3>
      </div>

      <div className="overflow-auto max-h-[600px] relative custom-scrollbar">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-30 bg-black/40 backdrop-blur-md">
            <tr>
              <th className="sticky left-0 z-40 w-12 h-12 bg-black/40 backdrop-blur-md p-0 border-r border-b border-white/5">
                <div className="w-full h-full flex items-center justify-center opacity-20">
                  <Info className="w-3 h-3" />
                </div>
              </th>
              {standings.map((team) => (
                <th
                  key={`header-${team.teamId}`}
                  className={cn(
                    "w-12 min-w-[3rem] h-12 p-0 transition-colors",
                    hoveredCol === team.teamId ? "bg-white/5" : ""
                  )}
                  onMouseEnter={() => setHoveredCol(team.teamId)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <div className="flex justify-center items-center h-full">
                    <TeamLogo
                      src={team.teamLogoUrl}
                      name={team.teamName}
                      size={24}
                      fallbackClassName="text-[10px] opacity-70"
                      className="transition-all"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((homeTeam) => (
              <tr
                key={homeTeam.teamId}
                className="transition-colors group"
              >
                {/* Row header */}
                <td
                  className={cn(
                    "sticky left-0 z-20 w-12 h-12 bg-black/40 backdrop-blur-md p-0 transition-colors border-r border-white/5",
                    hoveredRow === homeTeam.teamId ? "bg-white/10" : ""
                  )}
                  onMouseEnter={() => setHoveredRow(homeTeam.teamId)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <div className="flex justify-center items-center h-full">
                    <TeamLogo
                      src={homeTeam.teamLogoUrl}
                      name={homeTeam.teamName}
                      size={24}
                      fallbackClassName="text-[10px] opacity-70"
                      className="transition-all"
                    />
                  </div>
                </td>

                {/* Cells */}
                {standings.map((awayTeam) => {
                  const isSameTeam = homeTeam.teamId === awayTeam.teamId;
                  const result = isSameTeam ? null : getMatchResult(homeTeam.teamId, awayTeam.teamId);
                  const isHovered = hoveredRow === homeTeam.teamId || hoveredCol === awayTeam.teamId;

                  return (
                    <td
                      key={`${homeTeam.teamId}-${awayTeam.teamId}`}
                      className={cn(
                        "w-12 h-12 p-0 text-center relative transition-colors duration-200 border border-white/[0.02]",
                        isSameTeam ? "bg-white/[0.02]" : "",
                        isHovered && !isSameTeam ? "bg-white/[0.03]" : ""
                      )}
                      onMouseEnter={() => {
                        setHoveredRow(homeTeam.teamId);
                        setHoveredCol(awayTeam.teamId);
                      }}
                      onMouseLeave={() => {
                        setHoveredRow(null);
                        setHoveredCol(null);
                      }}
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
  );
}
