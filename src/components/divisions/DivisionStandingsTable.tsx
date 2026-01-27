// src/components/divisions/DivisionStandingsTable.tsx
// Leaderboard 2.0: Floating Glass Panels & Interactive Viz

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Trophy, ArrowUp, ArrowDown, TrendingUp, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { TeamLogo } from './TeamLogo';

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

// Sparkline Component
function FormSparkline({ form, color }: { form: ('W' | 'D' | 'L')[], color: string }) {
  if (!form || form.length === 0) return <div className="h-8 w-24 bg-white/5 rounded opacity-20" />;

  const points = form.map((r, i) => {
    const val = r === 'W' ? 10 : r === 'D' ? 5 : 0;
    return `${i * 20},${10 - val}`; // Scale width by 20px per point
  }).join(' ');

  return (
    <div className="relative h-8 w-24 flex items-center">
      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-lg"
        />
        {form.map((r, i) => (
          <circle
            key={i}
            cx={i * 20}
            cy={10 - (r === 'W' ? 10 : r === 'D' ? 5 : 0)}
            r="2"
            fill={r === 'W' ? '#10b981' : r === 'D' ? '#fbbf24' : '#ef4444'}
            stroke="#1a1a1a"
            strokeWidth="1"
          />
        ))}
      </svg>
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
    <div className="space-y-4">
      {/* Header Grid - Transparent */}
      <div className="grid grid-cols-12 gap-4 px-6 py-2 text-[10px] font-logik-extended-bold text-white/20 uppercase tracking-[0.2em] mb-4">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-4">Drużyna</div>
        <div className="col-span-1 text-center">M</div>
        <div className="col-span-3 text-center grid grid-cols-3">
          <span>W</span><span>D</span><span>L</span>
        </div>
        <div className="col-span-1 text-center hidden md:block">Pkt</div>
        <div className="col-span-2 text-right hidden lg:block">Forma</div>
      </div>

      <div className="space-y-2">
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
              whileHover={{ x: 10, backgroundColor: 'rgba(255,255,255,0.03)' }}
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
              <div className="col-span-4">
                <Link
                  href={getTournamentPath(`/teams/${team.teamId}`)}
                  className="flex items-center gap-4 group-hover:translate-x-2 transition-transform duration-300"
                >
                  <TeamLogo
                    src={team.teamLogoUrl}
                    name={team.teamName}
                    size={40}
                    className="grayscale group-hover:grayscale-0 transition-all duration-300 opacity-70 group-hover:opacity-100"
                  />
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "font-logik-extended-bold font-bold text-base transition-all truncate",
                        isTop3 ? textShineClass : "text-white/70 group-hover:text-white"
                      )}
                    >
                      {team.teamName}
                    </span>
                  </div>
                </Link>
              </div>

              {/* Matches Played */}
              <div className="col-span-1 text-center font-mono text-white/40">
                {team.matchesPlayed}
              </div>

              {/* W/D/L */}
              <div className="col-span-3 grid grid-cols-3 text-center font-bold text-base font-mono">
                <span className="text-emerald-500/80">{team.wins}</span>
                <span className="text-amber-500/80">{team.draws}</span>
                <span className="text-rose-500/50">{team.losses}</span>
              </div>

              {/* Points (Highlight) */}
              <div className="col-span-1 text-center hidden md:flex justify-center">
                <span
                  className={cn(
                    "font-bold text-xl",
                    isTop3 ? "text-white" : "text-white/50"
                  )}
                  style={{
                    textShadow: isTop3 ? `0 0 10px ${divisionColor}` : 'none'
                  }}
                >
                  {team.points}
                </span>
              </div>

              {/* Form Viz */}
              <div className="col-span-2 hidden lg:flex justify-end pr-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <FormSparkline form={team.form || []} color={isTop3 ? (index === 0 ? '#d4af37' : index === 1 ? '#c0c0c0' : '#cd7f32') : divisionColor} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
