// src/components/pdl/DivisionTable.tsx
// Compact division standings table with enhanced styling (Transparent / Minimal)

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { listItem } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

interface TeamStanding {
  position: number;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  gamesPlayed: number;
  points: number;
}

interface DivisionTableProps {
  divisionName: string;
  divisionColor: string;
  teams: TeamStanding[];
  divisionId?: string; // Add divisionId for linking to detail page
}

export function DivisionTable({ divisionName, divisionColor, teams, divisionId }: DivisionTableProps) {
  const { getTournamentPath } = useTournament();

  return (
    <motion.div
      variants={listItem}
      className="rounded-none overflow-hidden"
    >
      {/* Header - Minimal Text with Indicator */}
      <Link
        href={divisionId ? getTournamentPath(`/divisions/${divisionId}`) : '#'}
        className="block pb-4 mb-2 relative group cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <motion.h3
            className="text-2xl font-logik-extended-bold tracking-wide uppercase relative"
            style={{ color: divisionColor }}
            animate={{
              textShadow: [
                `0 0 10px ${divisionColor}00`,
                `0 0 20px ${divisionColor}60`,
                `0 0 10px ${divisionColor}00`
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {divisionName}
          </motion.h3>
          {divisionId && (
            <motion.span
              className="ml-auto text-xs font-mono uppercase tracking-widest text-white/30 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Zobacz tabelę
            </motion.span>
          )}
        </div>
        {/* Animated underline */}
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/10 overflow-hidden">
          <motion.div
            className="absolute inset-0 w-full h-full"
            style={{ backgroundColor: divisionColor }}
            initial={{ x: '-100%' }}
            whileHover={{ x: '0%' }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </Link>

      {/* Table - Transparent, just rows */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] font-mono uppercase tracking-widest text-white/30">
              <th className="px-2 py-2 text-left">Drużyna</th>
              <th className="px-2 py-2 text-center w-12 text-white/50">PKT</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => (
              <motion.tr
                key={team.teamId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "border-b border-white/5 last:border-0",
                  "hover:bg-white/[0.02] transition-colors cursor-pointer group"
                )}
              >
                <td className="px-2 py-3">
                  <Link
                    href={getTournamentPath(`/teams/${team.teamId}`)}
                    className="flex items-center gap-3 font-logik text-lg text-white/80 group-hover:text-white transition-colors"
                  >
                    {team.teamLogo && (
                      <Image
                        src={team.teamLogo}
                        alt={team.teamName}
                        width={24}
                        height={24}
                        className="rounded-sm opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                    <span className="truncate tracking-wide">{team.teamName}</span>
                  </Link>
                </td>
                <td className="px-2 py-3 text-center">
                  <span className="font-logik-extended-bold text-xl text-white group-hover:text-primary transition-colors">
                    {team.points}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
