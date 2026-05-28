// src/components/pdl/DivisionTable.tsx
// Compact division standings table with enhanced styling (Transparent / Minimal)

'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { listItem } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';
import { useHomeNavigation } from '@/context/HomeNavigationContext';
import { getDivisionTheme, getThemeColor, getThemeGradient } from '@/lib/division-themes';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TeamStanding {
  position: number;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  gamesPlayed: number;
  points: number;
  neustadtlScore?: number;
}

interface DivisionTableProps {
  divisionName: string;
  divisionColor: string;
  teams: TeamStanding[];
  divisionId?: string; // Add divisionId for linking to detail page
  divisionTheme?: string; // Theme ID
  medalUrl?: string; // Division medal
}

export function DivisionTable({ divisionName, divisionColor, teams, divisionId, divisionTheme, medalUrl }: DivisionTableProps) {
  const { getTournamentPath } = useTournament();
  const { goToGroup, isHomeActive } = useHomeNavigation();
  const router = useRouter();
  
  // Get theme if specified, otherwise use color
  const theme = getDivisionTheme(divisionTheme);
  const displayColor = theme?.primaryColor || divisionColor;
  const displayGradient = theme?.gradient || `linear-gradient(135deg, ${divisionColor} 0%, ${divisionColor} 100%)`;

  const handleContainerClick = () => {
    if (!divisionId) return;
    if (isHomeActive()) {
      goToGroup(divisionId);
    } else {
      router.push(getTournamentPath(`/divisions/${divisionId}`));
    }
  };

  return (
    <motion.div
      variants={listItem}
      className="rounded-none overflow-hidden group cursor-pointer"
      onClick={handleContainerClick}
    >
      {/* Header */}
      <div className="pb-4 mb-2 relative">
        <div className="flex items-center gap-3">
          {/* Medal if available */}
          {medalUrl && (
            <img 
              src={medalUrl} 
              alt={`${divisionName} medal`}
              className="h-8 w-8 object-contain"
            />
          )}
          
          <motion.h3
            className="text-2xl font-logik-extended-bold tracking-wide uppercase relative"
            style={{ color: displayColor }}
            animate={{
              textShadow: [
                `0 0 10px ${displayColor}00`,
                `0 0 20px ${displayColor}60`,
                `0 0 10px ${displayColor}00`
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {divisionName}
          </motion.h3>
          {divisionId && (
            <motion.span
              className="ml-auto text-xs font-mono uppercase tracking-widest text-[var(--tournament-secondary-text)] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Zobacz tabelę
            </motion.span>
          )}
        </div>
        {/* Animated underline with gradient support */}
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/10 overflow-hidden">
          <div
            className="absolute inset-0 w-full h-full -translate-x-full group-hover:translate-x-0 transition-transform duration-[400ms] ease-out"
            style={{ background: displayGradient }}
          />
        </div>
      </div>

      {/* Table - Transparent, just rows */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead></thead>
          <tbody>
            {teams.map((team, index) => (
              <motion.tr
                key={team.teamId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-2 py-3">
                  <div className="flex items-center gap-3 font-logik text-lg text-[var(--tournament-primary-text)] transition-colors">
                    {team.teamLogo && (
                      <Image
                        src={team.teamLogo}
                        alt={team.teamName}
                        width={24}
                        height={24}
                        className="rounded-sm opacity-80 transition-opacity"
                        unoptimized
                      />
                    )}
                    <span className="truncate tracking-wide">{team.teamName}</span>
                  </div>
                </td>
                <td className="px-2 py-3 text-center">
                  {team.neustadtlScore !== undefined ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-logik-extended-bold text-xl text-[var(--tournament-title)] group-hover:text-primary transition-colors cursor-default">
                            {team.points}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Neustadtl: {team.neustadtlScore.toFixed(2)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="font-logik-extended-bold text-xl text-[var(--tournament-title)] group-hover:text-primary transition-colors">
                      {team.points}
                    </span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
