// src/components/letnia/GroupStandingsPreview.tsx
// Group standings preview for Letnia home page

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { fadeInUp } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';
import { ChevronRight } from 'lucide-react';

interface TeamStanding {
  position: number;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  points: number;
}

interface GroupStandingsPreviewProps {
  groupName: string;
  groupColor?: string;
  teams: TeamStanding[];
}

export function GroupStandingsPreview({ 
  groupName, 
  groupColor,
  teams 
}: GroupStandingsPreviewProps) {
  const { theme, getTournamentPath } = useTournament();
  const color = groupColor || theme.primaryColor;

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div 
        className="px-4 py-2.5 border-b border-border/30 flex items-center justify-between"
        style={{ 
          background: `linear-gradient(90deg, ${color}20 0%, transparent 100%)`
        }}
      >
        <h3 
          className="font-bold"
          style={{ color, textShadow: `0 0 10px ${color}40` }}
        >
          {groupName}
        </h3>
        <Link 
          href={getTournamentPath('/groups')}
          className="text-xs text-[var(--tournament-secondary-text)] hover:text-[var(--tournament-title)] transition-colors flex items-center gap-1"
        >
          <span>Zobacz tabelę</span>
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[var(--tournament-secondary-text)] border-b border-border/20">
              <th className="text-left px-3 py-2 w-8">#</th>
              <th className="text-left px-3 py-2">Drużyna</th>
              <th className="text-center px-2 py-2 w-10">M</th>
              <th className="text-center px-2 py-2 w-10">W</th>
              <th className="text-center px-2 py-2 w-10">L</th>
              <th className="text-center px-3 py-2 w-12">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {teams.slice(0, 4).map((team, idx) => (
              <tr 
                key={team.teamId}
                className="border-b border-border/10 last:border-0 hover:bg-white/5 transition-colors"
              >
                <td 
                  className="px-3 py-2 font-medium"
                  style={{ color: idx < 2 ? color : undefined }}
                >
                  {team.position}
                </td>
                <td className="px-3 py-2 font-medium truncate max-w-[120px]">
                  {team.teamName}
                </td>
                <td className="text-center px-2 py-2 text-muted-foreground">
                  {team.gamesPlayed}
                </td>
                <td className="text-center px-2 py-2 text-green-400">
                  {team.wins}
                </td>
                <td className="text-center px-2 py-2 text-red-400">
                  {team.losses}
                </td>
                <td 
                  className="text-center px-3 py-2 font-bold"
                  style={{ color, textShadow: `0 0 8px ${color}40` }}
                >
                  {team.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
