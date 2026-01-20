// src/components/divisions/FixtureCrossbox.tsx
// Crossbox matrix showing all head-to-head fixtures

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import type { Match } from '@/lib/definitions';
import { MatchDetailModal } from './MatchDetailModal';

interface TeamStanding {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
}

interface FixtureCrossboxProps {
  matches: Match[];
  standings: TeamStanding[];
  divisionColor: string;
  theme: any;
}

interface MatchResult {
  homeScore: number;
  awayScore: number;
  date: string;
  status: 'scheduled' | 'completed' | 'live';
  match: Match; // Add the full match object
}

export function FixtureCrossbox({
  matches,
  standings,
  divisionColor,
  theme
}: FixtureCrossboxProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Build a matrix of match results
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
      date: match.scheduled_for || match.defaultMatchTime || '',
      status: match.status,
      match: match, // Store the full match object
    };
  };

  const getCellContent = (result: MatchResult | null) => {
    if (!result) {
      return <span className="text-muted-foreground text-xs">-</span>;
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
          className="flex flex-col items-center gap-1 hover:bg-accent/50 rounded p-1 transition-colors w-full"
        >
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {matchDate && !isNaN(matchDate.getTime()) 
              ? format(matchDate, 'dd MMM', { locale: pl })
              : 'TBD'}
          </span>
        </button>
      );
    }

    // Completed match
    const isWin = result.homeScore > result.awayScore;
    const isDraw = result.homeScore === result.awayScore;
    const matchDate = result.date ? new Date(result.date) : null;

    return (
      <button
        onClick={handleClick}
        className="flex flex-col items-center gap-1 hover:bg-accent/50 rounded p-1 transition-colors w-full"
      >
        <div className="flex items-center gap-1">
          <span 
            className={cn(
              "text-base font-bold",
              isWin && "text-green-500",
              isDraw && "text-yellow-500",
              !isWin && !isDraw && "text-red-500"
            )}
          >
            {result.homeScore}
          </span>
          <span className="text-muted-foreground text-sm">-</span>
          <span 
            className={cn(
              "text-base font-bold",
              !isWin && !isDraw && "text-green-500",
              isDraw && "text-yellow-500",
              isWin && "text-red-500"
            )}
          >
            {result.awayScore}
          </span>
        </div>
        {matchDate && (
          <span className="text-[10px] text-muted-foreground">
            {format(matchDate, 'dd MMM', { locale: pl })}
          </span>
        )}
      </button>
    );
  };

  return (
    <Card 
      style={{ 
        backgroundColor: theme.cardColor, 
        borderColor: divisionColor,
        borderWidth: '2px',
        height: '600px',
        boxShadow: `0 4px 20px ${divisionColor}15, 0 0 40px ${divisionColor}08`
      }}
      className="overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl"
    >
      <CardContent className="p-0 flex-1 min-h-0">
        <div className="h-full overflow-auto">
          <table className="w-full border-collapse">
              {/* Header Row */}
              <thead>
                <tr>
                  {/* Top-left corner cell */}
                  <th 
                    className="sticky left-0 z-20 w-8 min-w-[2rem] p-1 border-b border-r"
                    style={{ 
                      backgroundColor: theme.cardColor,
                      borderColor: `${divisionColor}40`
                    }}
                  >
                  </th>
                  {/* Team column headers */}
                  {standings.map((team) => (
                    <th
                      key={`header-${team.teamId}`}
                      className="w-14 min-w-[3.5rem] p-1 border-b border-r"
                      style={{ 
                        backgroundColor: `${divisionColor}08`,
                        borderColor: `${divisionColor}20`
                      }}
                    >
                      <div className="flex flex-col items-center">
                        {team.teamLogoUrl ? (
                          <Image
                            src={team.teamLogoUrl}
                            alt={team.teamName}
                            width={20}
                            height={20}
                            className="rounded-sm"
                          />
                        ) : (
                          <div className="w-5 h-5 bg-muted rounded-sm flex items-center justify-center text-[9px] font-bold">
                            {team.teamName.charAt(0)}
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((homeTeam, rowIndex) => (
                  <motion.tr
                    key={homeTeam.teamId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: rowIndex * 0.05 }}
                    className="hover:bg-accent/30 transition-colors"
                  >
                    {/* Row header - Home team */}
                    <td 
                      className="sticky left-0 z-10 w-8 min-w-[2rem] p-1 border-b border-r"
                      style={{ 
                        backgroundColor: theme.cardColor,
                        borderColor: `${divisionColor}40`
                      }}
                    >
                      <div className="flex items-center justify-center">
                        {homeTeam.teamLogoUrl ? (
                          <Image
                            src={homeTeam.teamLogoUrl}
                            alt={homeTeam.teamName}
                            width={20}
                            height={20}
                            className="rounded-sm"
                          />
                        ) : (
                          <div className="w-5 h-5 bg-muted rounded-sm flex items-center justify-center text-[9px] font-bold">
                            {homeTeam.teamName.charAt(0)}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Match cells */}
                    {standings.map((awayTeam) => {
                      const isSameTeam = homeTeam.teamId === awayTeam.teamId;
                      const result = isSameTeam ? null : getMatchResult(homeTeam.teamId, awayTeam.teamId);
                      
                      return (
                        <motion.td
                          key={`${homeTeam.teamId}-${awayTeam.teamId}`}
                          className={cn(
                            "w-14 min-w-[3.5rem] p-1 text-center border-b border-r cursor-pointer relative group",
                            isSameTeam && "bg-muted/50"
                          )}
                          style={{ 
                            borderColor: `${divisionColor}15`,
                            backgroundColor: isSameTeam ? `${divisionColor}05` : undefined
                          }}
                          onClick={() => !isSameTeam && handleClick(homeTeam.teamId, awayTeam.teamId)}
                          whileHover={!isSameTeam ? { 
                            scale: 1.15, 
                            zIndex: 10,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                          } : {}}
                          whileTap={!isSameTeam ? { scale: 0.95 } : {}}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          {isSameTeam ? (
                            <div className="flex items-center justify-center">
                              <div 
                                className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${divisionColor}20` }}
                              >
                                <span className="text-[10px] font-bold" style={{ color: divisionColor }}>
                                  —
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="relative overflow-hidden h-full flex items-center justify-center">
                              <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              <span className="relative z-10 group-hover:scale-110 transition-transform duration-200">
                                {getCellContent(result)}
                              </span>
                            </div>
                          )}
                        </motion.td>
                      );
                    })}
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="px-3 py-2 border-t bg-card sticky bottom-0" style={{ borderColor: `${divisionColor}20` }}>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <motion.div className="flex items-center gap-1" whileHover={{ scale: 1.05 }}>
                  <motion.div 
                    className="w-3 h-3 rounded bg-green-500/20 border border-green-500" 
                    animate={{ boxShadow: ['0 0 0px #10b981', '0 0 8px #10b981', '0 0 0px #10b981'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span>Wygrana (2-0)</span>
                </motion.div>
                <motion.div className="flex items-center gap-1" whileHover={{ scale: 1.05 }}>
                  <motion.div 
                    className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500"
                    animate={{ boxShadow: ['0 0 0px #eab308', '0 0 8px #eab308', '0 0 0px #eab308'] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  />
                  <span>Remis (1-1)</span>
                </motion.div>
                <motion.div className="flex items-center gap-1" whileHover={{ scale: 1.05 }}>
                  <motion.div 
                    className="w-3 h-3 rounded bg-red-500/20 border border-red-500"
                    animate={{ boxShadow: ['0 0 0px #ef4444', '0 0 8px #ef4444', '0 0 0px #ef4444'] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                  />
                  <span>Przegrana (0-2)</span>
                </motion.div>
                <motion.div className="flex items-center gap-1" whileHover={{ scale: 1.05 }}>
                  <Calendar className="h-3 w-3" />
                  <span>Zaplanowany mecz</span>
                </motion.div>
                <motion.div 
                  className="flex items-center gap-1"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span>💡 Kliknij na wynik</span>
                </motion.div>
              </div>
            </div>
        </div>
      </CardContent>

      {/* Match Detail Modal */}
      <MatchDetailModal
        match={selectedMatch}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMatch(null);
        }}
        divisionColor={divisionColor}
      />
    </Card>
  );
}
