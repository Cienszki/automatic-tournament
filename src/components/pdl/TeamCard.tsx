// src/components/pdl/TeamCard.tsx
// Modern, animated team card with PDL styling

"use client";

import type { Team, PlayerRole } from "@/lib/definitions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Swords, Shield, Sparkles, HandHelping, Eye, 
  Trophy, Crown, TrendingUp, Users, MapPin, Calendar, Target
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useTournament } from "@/context/TournamentContext";

interface TeamCardProps {
  team: Team;
  divisionRanking?: number; // e.g., 2 for "#2 in Elite"
  nextOpponent?: { name: string; id: string; };
  headToHeadRecord?: { wins: number; losses: number; draws: number; }; // vs next opponent
}

const getRoleIcon = (role: PlayerRole) => {
  const iconClass = "h-3.5 w-3.5";
  switch (role) {
    case "Carry": return <Swords className={iconClass} />;
    case "Mid": return <Sparkles className={iconClass} />;
    case "Offlane": return <Shield className={iconClass} />;
    case "Soft Support": return <HandHelping className={iconClass} />;
    case "Hard Support": return <Eye className={iconClass} />;
    default: return null;
  }
};

const getRoleColor = (role: PlayerRole) => {
  switch (role) {
    case "Carry": return "text-red-400";
    case "Mid": return "text-blue-400";
    case "Offlane": return "text-green-400";
    case "Soft Support": return "text-yellow-400";
    case "Hard Support": return "text-cyan-400";
    default: return "text-gray-400";
  }
};

// Font variants for testing readability - each player gets a different font
const playerFontClasses = [
  "font-logik-extended-bold",  // Player 1 (Carry)
  "font-logik-wide-black",     // Player 2 (Mid)
  "font-logik-extended-8",     // Player 3 (Offlane)
  "font-logik-3",              // Player 4 (Soft Support)
  "font-logik-4",              // Player 5 (Hard Support)
];

export function TeamCard({ team, divisionRanking, nextOpponent, headToHeadRecord }: TeamCardProps) {
  const { t } = useTranslation();
  const { getTournamentPath } = useTournament();
  const players = team.players || [];

  // Sort players by role
  const roleOrder = ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"];
  const sortedPlayers = [...players].sort((a, b) => {
    const aIdx = roleOrder.indexOf(a.role);
    const bIdx = roleOrder.indexOf(b.role);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <Link href={getTournamentPath(`/teams/${team.id}`)}>
        <Card className={cn(
          "relative overflow-hidden bg-[#0a0a0f] border-[#8B1538]/30",
          "hover:border-[#8B1538] transition-all duration-300 group cursor-pointer h-full"
        )}>
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#8B1538]/10 via-transparent to-[#A91D45]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Scan line effect - extended range */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-transparent via-[#8B1538]/20 to-transparent h-32 -top-16"
            animate={{
              y: ['-100%', '300%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Content */}
          <div className="relative z-10 p-6">
            {/* Header with logo and name */}
            <div className="flex items-start gap-4 mb-6">
              {/* Logo */}
              <motion.div 
                className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#1a1a1f] border-2 border-[#8B1538]/50 shrink-0"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Image
                  src={team.logoUrl || `https://placehold.co/80x80.png?text=${team.name.charAt(0)}`}
                  alt={team.name}
                  fill
                  className="object-cover"
                />
                {/* Logo glow on hover */}
                <div className="absolute inset-0 bg-[#8B1538]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-logik font-bold text-white mb-1 truncate group-hover:text-[#d4af37] transition-colors">
                  {team.name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap text-sm text-gray-400">
                  {/* Division with ranking */}
                  {team.division && (
                    <Badge variant="outline" className="border-[#8B1538]/50 text-[#d4af37] text-xs font-logik">
                      {divisionRanking && `#${divisionRanking} `}{team.division}
                    </Badge>
                  )}
                  {/* Win/Loss Record */}
                  {(team.wins !== undefined || team.losses !== undefined) && (
                    <span className="flex items-center gap-1 font-logik">
                      <Trophy className="h-3 w-3 text-green-400" />
                      {team.wins || 0}W - {team.losses || 0}L
                    </span>
                  )}
                  {/* Points */}
                  {team.points !== undefined && (
                    <span className="flex items-center gap-1 font-logik text-[#d4af37]">
                      {team.points} pts
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats section */}
            <div className="space-y-3 mb-4">
              {/* Recent form */}
              {team.recentForm && team.recentForm.length > 0 && (
                <div className="p-3 rounded-lg bg-[#8B1538]/10 border border-[#8B1538]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-logik uppercase tracking-wide">Recent Form</span>
                    <div className="flex gap-1">
                      {team.recentForm.slice(0, 5).map((result, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                            result === 'W' ? "bg-green-500/20 text-green-400" :
                            result === 'D' ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-red-500/20 text-red-400"
                          )}
                        >
                          {result}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Next Match */}
              {nextOpponent && (
                <div className="p-3 rounded-lg bg-[#8B1538]/10 border border-[#8B1538]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-logik uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Next Match
                    </span>
                    <span className="text-sm text-white font-logik">vs {nextOpponent.name}</span>
                  </div>
                </div>
              )}
              
              {/* Head-to-Head */}
              {headToHeadRecord && nextOpponent && (
                <div className="p-3 rounded-lg bg-[#8B1538]/10 border border-[#8B1538]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-logik uppercase tracking-wide flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      H2H vs {nextOpponent.name}
                    </span>
                    <span className="text-sm font-logik">
                      <span className="text-green-400">{headToHeadRecord.wins}W</span>
                      {headToHeadRecord.draws > 0 && <span className="text-yellow-400"> {headToHeadRecord.draws}D</span>}
                      <span className="text-red-400"> {headToHeadRecord.losses}L</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Players list */}
            <div className="space-y-2">
              {sortedPlayers.slice(0, 5).map((player, idx) => (
                <motion.div
                  key={player.id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "flex items-center justify-between gap-3 p-2 rounded-lg",
                    "bg-[#1a1a1f]/50 border border-transparent",
                    "group-hover:border-[#8B1538]/20 transition-all"
                  )}
                >
                  {/* Role icon and name on left */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("shrink-0", getRoleColor(player.role))}>
                      {getRoleIcon(player.role)}
                    </div>
                    <p className="text-xs text-gray-400 font-logik uppercase tracking-wide whitespace-nowrap">
                      {player.role}
                    </p>
                  </div>
                  
                  {/* Player nickname on right in PDL red */}
                  <div className="text-right">
                    <p className="text-sm text-[#8B1538] truncate font-medium font-logik-wide-black">
                      {player.nickname}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Captain badge */}
              {team.captainId && (
                <div className="mt-3 pt-3 border-t border-[#8B1538]/20">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Crown className="h-3 w-3 text-[#d4af37]" />
                    <span className="font-logik uppercase tracking-wide">Captain</span>
                    <span className="text-white">
                      {players.find(p => p.id === team.captainId)?.nickname || 'Unknown'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Hover indicator */}
            <motion.div 
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8B1538] to-[#d4af37]"
              initial={{ scaleX: 0 }}
              whileHover={{ scaleX: 1 }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
