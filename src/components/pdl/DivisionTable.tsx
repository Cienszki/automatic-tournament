// src/components/pdl/DivisionTable.tsx
// Compact division standings table with enhanced styling

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
      className={cn(
        "rounded-xl overflow-hidden",
        "bg-gradient-to-br from-[#1e1e24] to-[#16161a]",
        "border border-[#2a2a32]",
        "shadow-lg shadow-black/30",
        "hover:border-[#3a3a42] transition-all duration-300"
      )}
    >
      {/* Header */}
      <Link 
        href={divisionId ? getTournamentPath(`/divisions/${divisionId}`) : '#'}
        className="block px-4 py-3 font-bold text-lg border-b border-[#2a2a32] relative overflow-hidden group cursor-pointer"
        style={{ 
          background: `linear-gradient(90deg, ${divisionColor}15 0%, transparent 75%)`,
        }}
      >
        {/* Animated shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full"
          animate={{ translateX: ['100%', '-100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
        />
        <span style={{ color: divisionColor }} className="relative z-10 flex items-center gap-2">
          <motion.span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: divisionColor }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {divisionName}
          {divisionId && (
            <motion.span
              className="ml-auto text-xs text-[#808090] opacity-0 group-hover:opacity-100"
              initial={{ x: -5 }}
              whileHover={{ x: 0 }}
            >
              Zobacz szczegóły →
            </motion.span>
          )}
        </span>
      </Link>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-[#606070] border-b border-[#2a2a32]/50">
              <th className="px-4 py-2 text-left w-12">#</th>
              <th className="px-4 py-2 text-left">Drużyna</th>
              <th className="px-4 py-2 text-center w-16">M</th>
              <th className="px-4 py-2 text-center w-16">PKT</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => (
              <motion.tr
                key={team.teamId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "border-b border-[#2a2a32]/30 last:border-0",
                  "hover:bg-white/[0.03] transition-colors cursor-pointer group"
                )}
              >
                <td className="px-4 py-2.5">
                  <span 
                    className={cn(
                      "text-sm font-bold",
                      index === 0 && "text-[#FFD700]",
                      index === 1 && "text-[#C0C0C0]",
                      index === 2 && "text-[#CD7F32]",
                      index > 2 && "text-[#606070]"
                    )}
                  >
                    {team.position}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Link 
                    href={getTournamentPath(`/teams/${team.teamId}`)}
                    className="font-medium text-white/90 group-hover:text-white transition-colors flex items-center gap-2"
                  >
                    {team.teamLogo && (
                      <Image
                        src={team.teamLogo}
                        alt={team.teamName}
                        width={20}
                        height={20}
                        className="rounded-sm"
                      />
                    )}
                    <span className="truncate">{team.teamName}</span>
                    <motion.span
                      className="opacity-0 group-hover:opacity-100 text-[#808090] text-xs"
                      initial={{ x: -5 }}
                      whileHover={{ x: 0 }}
                    >
                      →
                    </motion.span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-center text-sm text-[#808090]">
                  {team.gamesPlayed}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="font-bold text-base text-white">
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
