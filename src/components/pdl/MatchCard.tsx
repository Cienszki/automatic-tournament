// src/components/pdl/MatchCard.tsx
// Modern, animated match card with PDL styling

"use client";

import { useState, useEffect } from "react";
import type { Match } from "@/lib/definitions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  Calendar, Clock, Trophy, ExternalLink, 
  Swords, Flame, Target, Award 
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTournament } from "@/context/TournamentContext";

interface MatchCardProps {
  match: Match;
  index?: number;
}

export function MatchCard({ match, index = 0 }: MatchCardProps) {
  const [isClient, setIsClient] = useState(false);
  const { theme } = useTournament();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isCompleted = match.status === 'completed';
  const displayDate = match.scheduledFor ? new Date(match.scheduledFor) : new Date();
  
  const dateText = format(displayDate, "EEE, MMM d");
  const timeText = isClient ? format(displayDate, "HH:mm") : "--:--";

  const winnerId = isCompleted && match.teamA.score > match.teamB.score 
    ? match.teamA.id 
    : isCompleted && match.teamB.score > match.teamA.score 
    ? match.teamB.id 
    : null;

  const getStageLabel = () => {
    if (match.group_id) return match.group_id.replace(/-/g, ' ').replace(/\w/g, l => l.toUpperCase());
    if (match.playoff_round) return `Playoffs - Round ${match.playoff_round}`;
    if (match.round) return `Round ${match.round}`;
    return "Match";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card className={cn(
        "relative overflow-hidden bg-[#0a0a0f] border-[#8B1538]/30",
        "hover:border-[#8B1538] transition-all duration-300 group"
      )}>
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#8B1538]/5 via-transparent to-[#A91D45]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Diagonal stripes on hover */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              #8B1538 0px,
              #8B1538 2px,
              transparent 2px,
              transparent 12px
            )`,
          }}
        />

        <div className="relative z-10">
          {/* Header */}
          <div className="px-6 py-3 bg-[#8B1538]/10 border-b border-[#8B1538]/20">
            <div className="flex items-center justify-between">
              <Badge 
                variant="outline" 
                className="border-[#8B1538]/50 text-[#d4af37] font-logik text-xs uppercase tracking-wide"
              >
                <Flame className="h-3 w-3 mr-1.5" />
                {getStageLabel()}
              </Badge>
              
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5 font-logik">
                  <Calendar className="h-3 w-3" />
                  {dateText}
                </span>
                <span className="flex items-center gap-1.5 font-logik">
                  <Clock className="h-3 w-3" />
                  {timeText}
                </span>
              </div>
            </div>
          </div>

          {/* Match content */}
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              {/* Team A */}
              <motion.div 
                className="flex-1"
                whileHover={{ x: -5 }}
                transition={{ duration: 0.2 }}
              >
                <TeamDisplay 
                  team={match.teamA} 
                  isWinner={winnerId === match.teamA.id}
                  align="left"
                />
              </motion.div>

              {/* VS / Score */}
              <div className="flex flex-col items-center gap-2 min-w-[100px]">
                {isCompleted ? (
                  <>
                    {winnerId && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Trophy className="h-5 w-5 text-[#d4af37]" />
                      </motion.div>
                    )}
                    <div className="flex items-center gap-3">
                      <motion.span 
                        className="text-3xl font-bold text-white font-logik"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring" }}
                      >
                        {match.teamA.score}
                      </motion.span>
                      <span className="text-lg text-[#8B1538]">-</span>
                      <motion.span 
                        className="text-3xl font-bold text-white font-logik"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring" }}
                      >
                        {match.teamB.score}
                      </motion.span>
                    </div>
                  </>
                ) : (
                  <div className="relative">
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-0 bg-[#8B1538] blur-xl opacity-30"
                    />
                    <span className="relative text-2xl font-bold text-[#d4af37] font-logik">VS</span>
                  </div>
                )}
                <span className="text-xs text-gray-400 font-logik font-medium uppercase">
                  BO{match.bestOf || 2}
                </span>
              </div>

              {/* Team B */}
              <motion.div 
                className="flex-1"
                whileHover={{ x: 5 }}
                transition={{ duration: 0.2 }}
              >
                <TeamDisplay 
                  team={match.teamB} 
                  isWinner={winnerId === match.teamB.id}
                  align="right"
                />
              </motion.div>
            </div>

            {/* Match links */}
            {isCompleted && Array.isArray(match.game_ids) && match.game_ids.length > 0 && (
              <motion.div 
                className="mt-4 pt-4 border-t border-[#8B1538]/20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex flex-wrap gap-2 justify-center">
                  {match.game_ids.map((gameId: number | string, idx: number) => (
                    <a
                      key={gameId}
                      href={`https://www.opendota.com/matches/${gameId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                        "bg-[#8B1538]/10 border border-[#8B1538]/30",
                        "text-xs font-medium text-gray-300 font-logik",
                        "hover:bg-[#8B1538]/20 hover:border-[#8B1538]/50",
                        "hover:text-white transition-all duration-200"
                      )}
                    >
                      <Target className="h-3 w-3" />
                      Game {idx + 1}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Bottom accent line */}
          <motion.div 
            className="h-1 bg-gradient-to-r from-transparent via-[#8B1538] to-transparent"
            initial={{ scaleX: 0 }}
            whileHover={{ scaleX: 1 }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </Card>
    </motion.div>
  );
}

// Team display component
interface TeamDisplayProps {
  team: { id: string; name: string; logo?: string; score: number };
  isWinner: boolean;
  align: 'left' | 'right';
}

function TeamDisplay({ team, isWinner, align }: TeamDisplayProps) {
  return (
    <div className={cn(
      "flex items-center gap-3",
      align === 'right' && "flex-row-reverse"
    )}>
      {/* Team logo */}
      <div className={cn(
        "relative w-12 h-12 rounded-lg overflow-hidden",
        "bg-[#1a1a1f] border-2 shrink-0",
        isWinner ? "border-[#d4af37]" : "border-[#8B1538]/30",
        "group-hover:border-[#8B1538] transition-colors"
      )}>
        <Image
          src={team.logo || `https://placehold.co/48x48.png?text=${team.name.charAt(0)}`}
          alt={team.name}
          fill
          className="object-cover"
          unoptimized
        />
        {isWinner && (
          <div className="absolute inset-0 bg-[#d4af37]/20" />
        )}
      </div>

      {/* Team name */}
      <div className={cn("flex-1 min-w-0", align === 'right' && "text-right")}>
        <p className={cn(
          "font-bold truncate font-logik uppercase tracking-wide",
          isWinner ? "text-[#d4af37] text-base" : "text-white text-sm"
        )}>
          {team.name}
        </p>
        {isWinner && (
          <motion.p 
            className="text-xs text-[#d4af37]/70 font-logik uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Winner
          </motion.p>
        )}
      </div>
    </div>
  );
}
