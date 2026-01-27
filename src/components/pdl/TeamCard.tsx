// src/components/pdl/TeamCard.tsx
// Modern, animated team card with PDL styling

"use client";

import type { Team, PlayerRole } from "@/lib/definitions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Swords, Shield, Sparkles, HandHelping, Eye,
  Trophy, Crown, TrendingUp, Users, MapPin, Calendar, Target, MessageSquare
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useRef, MouseEvent } from 'react';
import { useTournament } from "@/context/TournamentContext";

// Division tier colors matching the premium theme
const DIVISION_TIER_STYLES: Record<string, { gradient: string; glow: string; text: string; lightBorder: string; foil: string }> = {
  elite: {
    gradient: 'from-amber-500/20 via-yellow-400/10 to-transparent',
    glow: 'rgba(255, 215, 0, 0.4)',
    text: 'text-pdl-gold',
    lightBorder: 'border-pdl-gold/40',
    foil: 'bg-gradient-to-tr from-[#FFD700]/20 via-[#FDB931]/10 to-transparent'
  },
  challenger: {
    gradient: 'from-slate-400/20 via-gray-300/10 to-transparent',
    glow: 'rgba(192, 192, 192, 0.4)',
    text: 'text-pdl-silver',
    lightBorder: 'border-pdl-silver/40',
    foil: 'bg-gradient-to-tr from-[#E0E0E0]/20 via-[#B0B0B0]/10 to-transparent'
  },
  adept: {
    gradient: 'from-orange-700/20 via-amber-600/10 to-transparent',
    glow: 'rgba(205, 127, 50, 0.4)',
    text: 'text-pdl-bronze',
    lightBorder: 'border-pdl-bronze/40',
    foil: 'bg-gradient-to-tr from-[#CD7F32]/20 via-[#8B4513]/10 to-transparent'
  }
};

interface TeamCardProps {
  team: Team;
  divisionRanking?: number; // e.g., 2 for "#2 in Elite"
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

export function TeamCard({ team, divisionRanking }: TeamCardProps) {
  const { t } = useTranslation();
  const { getTournamentPath } = useTournament();
  const players = team.players || [];

  // 3D Tilt Logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-7deg", "7deg"]);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseXFromCenter = e.clientX - rect.left - width / 2;
    const mouseYFromCenter = e.clientY - rect.top - height / 2;

    x.set(mouseXFromCenter / width);
    y.set(mouseYFromCenter / height);
  };

  const onMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Determine division style
  const divisionKey = (team.divisionId || team.division || '').toLowerCase();
  const validKey = ['elite', 'challenger', 'adept'].includes(divisionKey) ? divisionKey : '';
  const style = validKey ? DIVISION_TIER_STYLES[validKey] : {
    gradient: 'from-gray-500/20 via-gray-400/10 to-transparent',
    glow: 'rgba(128, 128, 128, 0.4)',
    text: 'text-gray-400',
    lightBorder: 'border-gray-400/40',
    foil: 'bg-gradient-to-tr from-gray-500/20 via-gray-400/10 to-transparent'
  };

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
      <Link href={getTournamentPath(`/teams/${team.id}`)} className="block h-full perspective-1000">
        <motion.div
          style={{
            rotateX,
            rotateY,
          }}
          onMouseMove={onMouseMove}
          onMouseEnter={(e) => {
            if (validKey) {
              e.currentTarget.style.backgroundColor = `${style.glow}15`;
            } else {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            onMouseLeave();
          }}
          className={cn(
            "relative overflow-hidden transition-all duration-300 group cursor-pointer h-full rounded-2xl p-6",
            "border border-none",
            "hover:backdrop-blur-md",
            "[transform-style:preserve-3d]"
          )}
        >
          {/* Noise Texture Overlay */}
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
          />

          {/* Hover Glow Effect */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
            style={{
              boxShadow: `inset 0 0 60px ${style.glow}, 0 0 20px -5px ${style.glow}`,
              border: `1px solid ${style.glow}`
            }}
          />

          {/* Holographic Foil Gradient */}
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-soft-light",
            style.foil
          )} />

          {/* Animated Sheen */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer z-10 pointer-events-none"
          />

          {/* Content */}
          <div className="relative z-20 p-6 flex flex-col h-full transform-gpu" style={{ transform: "translateZ(20px)" }}>

            {/* Header with logo and name */}
            <div className="flex items-start gap-5 mb-4">
              {/* Logo - Larger */}
              <motion.div
                className={cn(
                  "relative w-24 h-24 rounded-2xl overflow-hidden bg-black/40 shrink-0",
                  "border border-white/10 group-hover:border-white/40 transition-colors shadow-xl"
                )}
                whileHover={{ scale: 1.05, rotate: 3 }}
                style={{
                  // Removed glow
                }}
              >
                <Image
                  src={team.logoUrl || `https://placehold.co/96x96.png?text=${team.name.charAt(0)}`}
                  alt={team.name}
                  fill
                  className="object-cover"
                />
              </motion.div>

              {/* Team info */}
              <div className="flex-1 min-w-0 pt-2">
                <h3 className={cn(
                  "text-2xl font-logik-extended-bold mb-2 leading-tight drop-shadow-md",
                  style.text // Always division color
                )}>
                  {team.name}
                </h3>
                {/* Division Badge */}
                {team.division && (
                  <Badge variant="outline" className={cn(
                    "w-fit text-xs px-2 py-0.5 font-logik border-white/10 bg-white/5",
                    style.text, style.lightBorder // Division colors
                  )}>
                    {divisionRanking && <span className="mr-1 opacity-75">#{divisionRanking}</span>}
                    {team.division}
                  </Badge>
                )}
              </div>
            </div>

            {/* Body Content - Side by Side */}
            <div className="flex items-start justify-between gap-4 mt-2 relative">
              {/* Left Column: Player List */}
              <div className="flex-1 space-y-1 min-w-0">
                {sortedPlayers.slice(0, 5).map((player, idx) => (
                  <div
                    key={player.id || idx}
                    className="flex items-center gap-3 p-1 pl-1"
                  >
                    <div className="shrink-0 text-white/40">
                      {getRoleIcon(player.role)}
                    </div>
                    <p className="text-xs text-gray-400 font-logik uppercase tracking-wide truncate">
                      {player.nickname}
                    </p>
                  </div>
                ))}

                {/* Captain Discord */}
                {(team.captainDiscordUsername || team.discordUsername) && (
                  <div className="mt-2 pt-2 border-t border-white/10 w-fit">
                    <div className="flex items-center gap-2 text-xs">
                      <MessageSquare className={cn("h-3 w-3", style.text)} />
                      <span className="font-logik uppercase tracking-wide text-[10px] text-gray-400">DISCORD</span>
                      <span className="text-white text-[10px] font-logik">
                        {team.captainDiscordUsername || team.discordUsername}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Recent Form (Bottom-right) */}
              {team.recentForm && team.recentForm.length > 0 && (
                <div className="flex flex-col items-end gap-1 absolute bottom-0 right-0">
                  <div className="flex gap-2 h-12 items-end">
                    {team.recentForm.slice(0, 5).reverse().map((result, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "w-2 rounded-full shadow-sm",
                          result === 'W' ? "bg-green-500 h-full" :
                            result === 'D' ? "bg-yellow-500 h-8" :
                              "bg-red-500 h-5"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] text-gray-500 font-logik uppercase tracking-widest">Form</span>
                </div>
              )}
            </div>

            {/* Hover indicator - transformed to bottom glow bar */}
            <motion.div
              className={cn("absolute bottom-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 shadow-[0_-2px_10px_rgba(255,255,255,0.3)]", style.gradient)}
              initial={{ scaleX: 0 }}
              whileHover={{ scaleX: 1 }}
              transition={{ duration: 0.4, ease: "circOut" }}
            />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
