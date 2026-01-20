// src/components/divisions/DivisionStandingsTable.tsx
// Enhanced division standings table with full details

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';

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
}

export function DivisionStandingsTable({ 
  standings, 
  divisionColor, 
  divisionName,
  currentRound,
  matchday,
  isElite,
  isLowest,
  theme
}: DivisionStandingsTableProps) {
  const { getTournamentPath } = useTournament();

  const getRowStyle = (index: number) => {
    const isPromotion = !isElite && index === 0;
    const isRelegation = !isLowest && index === standings.length - 1;
    const isPlayoff = isElite && index < 4;

    if (isPlayoff) {
      return { backgroundColor: 'rgba(234, 179, 8, 0.08)' };
    } else if (isPromotion) {
      return { backgroundColor: 'rgba(34, 197, 94, 0.08)' };
    } else if (isRelegation) {
      return { backgroundColor: 'rgba(239, 68, 68, 0.08)' };
    }
    return {};
  };

  const getPositionBadge = (index: number) => {
    const isPromotion = !isElite && index === 0;
    const isRelegation = !isLowest && index === standings.length - 1;
    const isPlayoff = isElite && index < 4;

    if (isPlayoff && index === 0) {
      return <Trophy className="h-3 w-3 text-yellow-500" />;
    } else if (isPromotion) {
      return <ArrowUp className="h-3 w-3 text-green-500" />;
    } else if (isRelegation) {
      return <ArrowDown className="h-3 w-3 text-red-500" />;
    }
    return null;
  };

  const getFormIcon = (result: 'W' | 'D' | 'L') => {
    switch (result) {
      case 'W':
        return <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[9px] font-bold text-white">W</div>;
      case 'D':
        return <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-[9px] font-bold text-white">D</div>;
      case 'L':
        return <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white">L</div>;
    }
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
      <CardHeader className="pb-2 px-3 pt-3 flex-shrink-0 relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${divisionColor}40 50%, transparent 100%)`
          }}
        />
        <div className="flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2">
            {currentRound && (
              <motion.span 
                className="text-[10px] text-muted-foreground font-semibold"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                Runda {currentRound} Kolejka {currentRound}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <motion.div 
              className="w-0.5 h-5 rounded-full"
              style={{ backgroundColor: divisionColor }}
              animate={{ 
                boxShadow: [`0 0 0px ${divisionColor}`, `0 0 12px ${divisionColor}80`, `0 0 0px ${divisionColor}`]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <CardTitle className="text-base font-bold" style={{ color: divisionColor }}>{divisionName}</CardTitle>
            </motion.div>
          </div>
          <div className="flex items-center gap-2">
            {matchday && (
              <motion.span 
                className="text-[10px] text-muted-foreground font-semibold"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                Mecze: {matchday}
              </motion.span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 text-center text-[10px] p-1">#</TableHead>
                <TableHead className="min-w-[120px] text-[10px] p-1">Drużyna</TableHead>
                <TableHead className="w-10 text-center text-[10px] p-1">M</TableHead>
                <TableHead className="w-10 text-center text-[10px] p-1">W</TableHead>
                <TableHead className="w-10 text-center text-[10px] p-1">R</TableHead>
                <TableHead className="w-10 text-center text-[10px] p-1">P</TableHead>
                <TableHead className="w-14 text-center text-[10px] p-1">Neu.</TableHead>
                <TableHead className="w-12 text-center font-bold text-[10px] p-1">PKT</TableHead>
                <TableHead className="w-20 text-center text-[10px] p-1">Forma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((team, index) => (
                <motion.tr
                  key={team.teamId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "group transition-all duration-300 border-b last:border-0 relative overflow-hidden cursor-pointer"
                  )}
                  style={{
                    ...getRowStyle(index),
                    background: index === 0 && isElite ? 
                      `linear-gradient(90deg, ${divisionColor}15 0%, ${divisionColor}05 100%)` :
                      index === 1 && isElite ?
                      `linear-gradient(90deg, ${divisionColor}12 0%, ${divisionColor}03 100%)` :
                      index === 0 && !isElite && !isLowest ?
                      `linear-gradient(90deg, #10b98115 0%, #10b98105 100%)` :
                      index === standings.length - 1 && !isLowest ?
                      `linear-gradient(90deg, #ef444415 0%, #ef444405 100%)` :
                      undefined
                  }}
                  whileHover={{ 
                    x: 4,
                    scale: 1.01,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                  }}
                >
                  {/* Position */}
                  <TableCell className="text-center font-bold p-1">
                    <div className="flex items-center justify-center gap-0.5">
                      {getPositionBadge(index)}
                      <span 
                        className={cn(
                          "text-xs",
                          index === 0 && "text-yellow-500",
                          index === 1 && "text-gray-400",
                          index === 2 && "text-orange-600"
                        )}
                      >
                        {team.position}
                      </span>
                    </div>
                  </TableCell>

                  {/* Team Name */}
                  <TableCell className="p-1">
                    <Link
                      href={getTournamentPath(`/teams/${team.teamId}`)}
                      className="flex items-center gap-1.5 group-hover:translate-x-1 transition-transform"
                    >
                      <motion.div whileHover={{ scale: 1.2, rotate: 5 }} transition={{ type: "spring" }}>
                        {team.teamLogoUrl ? (
                          <div className="relative">
                            <Image
                              src={team.teamLogoUrl}
                              alt={team.teamName}
                              width={16}
                              height={16}
                              className="rounded-sm transition-all duration-300 group-hover:shadow-lg"
                              style={{ filter: 'drop-shadow(0 0 0px transparent)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.filter = `drop-shadow(0 0 8px ${divisionColor}80)`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.filter = 'drop-shadow(0 0 0px transparent)';
                              }}
                            />
                          </div>
                        ) : (
                        <div className="w-4 h-4 bg-muted rounded-sm flex items-center justify-center text-[8px] font-bold">
                          {team.teamName.charAt(0)}
                        </div>
                      )}
                      </motion.div>
                      <span className="text-xs font-medium group-hover:text-primary transition-colors truncate">
                        {team.teamName}
                      </span>
                    </Link>
                  </TableCell>

                  {/* Matches Played */}
                  <TableCell className="text-center text-muted-foreground text-xs p-1">
                    {team.matchesPlayed}
                  </TableCell>

                  {/* Wins */}
                  <TableCell className="text-center font-semibold text-green-500 text-xs p-1">
                    {team.wins}
                  </TableCell>

                  {/* Draws */}
                  <TableCell className="text-center font-semibold text-yellow-500 text-xs p-1">
                    {team.draws}
                  </TableCell>

                  {/* Losses */}
                  <TableCell className="text-center font-semibold text-red-500 text-xs p-1">
                    {team.losses}
                  </TableCell>

                  {/* Neustadtl Score */}
                  <TableCell className="text-center text-muted-foreground font-mono text-[10px] p-1">
                    {team.neustadtlScore.toFixed(1)}
                  </TableCell>

                  {/* Points */}
                  <TableCell className="text-center p-1">
                    <Badge 
                      variant="outline" 
                      className="text-xs font-bold px-1.5 py-0.5"
                      style={{ 
                        borderColor: divisionColor,
                        color: divisionColor,
                        backgroundColor: `${divisionColor}15`
                      }}
                    >
                      {team.points}
                    </Badge>
                  </TableCell>

                  {/* Form */}
                  <TableCell className="p-1">
                    <div className="flex items-center justify-center gap-0.5">
                      {team.form && team.form.length > 0 ? (
                        team.form.slice(-5).map((result, i) => (
                          <motion.div 
                            key={i}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.05, type: "spring" }}
                            whileHover={{ 
                              scale: 1.4, 
                              rotate: 180,
                              boxShadow: result === 'W' ? '0 0 12px #10b981' : 
                                        result === 'D' ? '0 0 12px #eab308' :
                                        '0 0 12px #ef4444'
                            }}
                          >
                            {getFormIcon(result)}
                          </motion.div>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-[10px]">-</span>
                      )}
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
