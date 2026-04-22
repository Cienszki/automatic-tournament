// src/components/divisions/DivisionStandingsTable.tsx
// Leaderboard 2.0: Floating Glass Panels & Interactive Viz

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Trophy, ArrowUp, ArrowDown, TrendingUp, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { TeamLogo } from './TeamLogo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  theme
}: DivisionStandingsTableProps) {
  const { getTournamentPath } = useTournament();

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.09] bg-gradient-to-b from-white/[0.04] via-black/15 to-black/25 backdrop-blur-xl">
      {/* Header Grid */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-logik-extended-bold uppercase tracking-[0.2em]" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.2)' }}>
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
          const isPlayoff = isElite && index < 4;
          const isPromotion = !isElite && index === 0;
          const isRelegation = !isLowest && index === standings.length - 1;
          const isTop3 = index < 3;

          let textShineClass = "";
          if (index === 0) { textShineClass = "text-shine-gold"; }
          else if (index === 1) { textShineClass = "text-shine-silver"; }
          else if (index === 2) { textShineClass = "text-shine-bronze"; }

          return (
            <motion.div
              key={team.teamId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ x: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}
              className="group relative grid grid-cols-12 gap-4 items-center px-6 py-3 rounded-r-xl border-l-2 transition-all duration-300"
              style={{
                borderLeftColor: isTop3
                  ? (index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32')
                  : (isPlayoff ? divisionColor : isPromotion ? '#10b981' : isRelegation ? '#ef4444' : 'rgba(255,255,255,0.05)'),
                background: isTop3 ? 'linear-gradient(90deg, rgba(255,255,255,0.03), transparent)' : 'transparent'
              }}
            >
              {/* Floating Rank Number */}
              <div className="col-span-1 flex justify-center">
                <span className={cn(
                  "font-mono font-bold text-lg",
                  isTop3 ? textShineClass : "text-white/20"
                )}>
                  {team.position < 10 ? `0${team.position}` : team.position}
                </span>
              </div>

              {/* Team Info */}
              <div className="col-span-5">
                <Link
                  href={getTournamentPath(`/teams/${team.teamId}`)}
                  className="flex items-center gap-4 group-hover:translate-x-2 transition-transform duration-300"
                >
                  <TeamLogo
                    src={team.teamLogoUrl}
                    name={team.teamName}
                    size={40}
                    className="transition-all duration-300"
                  />
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "font-logik-extended-bold font-bold text-base transition-all",
                        isTop3 ? textShineClass : ""
                      )}
                      style={!isTop3 ? { color: theme?.primaryTextColor || 'rgba(255,255,255,0.7)' } : undefined}
                    >
                      {team.teamName}
                    </span>
                  </div>
                </Link>
              </div>

              {/* Matches Played */}
              <div className="col-span-1 text-center" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
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
                        className={cn(
                          "font-bold text-xl cursor-default",
                        )}
                        style={{
                          color: isTop3 ? (theme?.primaryTextColor || 'white') : (theme?.secondaryTextColor || 'rgba(255,255,255,0.5)'),
                          textShadow: isTop3 ? `0 0 10px ${divisionColor}` : 'none'
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
              <div className="col-span-2 hidden lg:flex justify-end pr-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <FormBars form={team.form || []} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
