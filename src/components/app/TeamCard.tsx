
"use client";

import type { Team, PlayerRole } from "@/lib/definitions";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { Sigma, Shield, Swords, Sparkles, HandHelping, Eye, ListChecks, UserX, ShieldQuestion, PlayCircle, Trophy, X } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useTournament } from "@/context/TournamentContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TeamCardProps {
  team: Team;
}

const getRoleIcon = (role: PlayerRole) => {
  switch (role) {
    case "Carry":
      return <Swords className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Mid":
      return <Sparkles className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Offlane":
      return <Shield className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Soft Support":
      return <HandHelping className="h-4 w-4 text-primary mr-2 shrink-0" />;
    case "Hard Support":
      return <Eye className="h-4 w-4 text-primary mr-2 shrink-0" />;
    default:
      return <ListChecks className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />;
  }
};

const getStatusBadge = (status?: string, t?: any, theme?: any) => {
  switch (status) {
    case "pending":
      return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/40 hover:bg-gray-500/30 text-xs"><ShieldQuestion className="h-3 w-3 mr-1.5" />{t('teams.notVerified')}</Badge>;
    case "verified":
      return <Badge className="bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30 text-xs"><PlayCircle className="h-3 w-3 mr-1.5" />{t('teams.verified')}</Badge>;
    case "warning":
        return <Badge variant="destructive" className="text-xs"><UserX className="h-3 w-3 mr-1.5" />{t('teams.warning')}</Badge>;
    case "banned":
      return <Badge className="bg-red-400/20 text-red-300 border-red-500/40 hover:bg-red-400/30 text-xs"><Trophy className="h-3 w-3 mr-1.5" />{t('teams.banned')}</Badge>;
    case "eliminated":
      return <Badge className="bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30 text-xs"><X className="h-3 w-3 mr-1.5" />{t('teams.eliminated')}</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};

export function TeamCard({ team }: TeamCardProps) {
  const { t } = useTranslation();
  const { theme, getTournamentPath } = useTournament();
  const players = team.players || [];
  const totalMMR = players.reduce((sum, player) => sum + player.mmr, 0);

  // Sort players by role: Carry, Mid, Offlane, Soft Support, Hard Support
  const roleOrder = ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"];
  const sortedPlayers = [...players].sort((a, b) => {
    const aIdx = roleOrder.indexOf(a.role);
    const bIdx = roleOrder.indexOf(b.role);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  return (
    <Card 
      className={cn(
        "flex flex-col h-full transition-all duration-300 hover:scale-[1.02] relative overflow-hidden group",
        team.status === 'banned' && "opacity-60",
        team.status === 'eliminated' && "opacity-75"
      )}
      style={{
        backgroundColor: theme.cardColor,
        borderColor: theme.borderColor,
        borderWidth: '1px',
        boxShadow: `0 4px 12px ${theme.primaryColor}15`
      }}
    >
      {/* Animated border effect on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}20, ${theme.secondaryColor}20, ${theme.accentColor}20)`,
          borderRadius: 'inherit'
        }}
      />
      <CardHeader className="flex flex-row items-start space-x-4 pb-4 relative z-10">
        <div className="relative">
          <Image 
            src={team.logoUrl || `https://placehold.co/96x96.png?text=${team.name.charAt(0)}`} 
            alt={`${team.name} logo`} 
            width={80} 
            height={80} 
            className="rounded-lg object-cover border-2 shadow-lg transition-transform group-hover:scale-105"
            style={{ borderColor: theme.primaryColor }}
            unoptimized={team.logoUrl?.endsWith('.gif')}
          />
          {/* Logo glow effect */}
          <div 
            className="absolute inset-0 rounded-lg blur-xl opacity-0 group-hover:opacity-50 transition-opacity"
            style={{ backgroundColor: theme.primaryColor }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle 
            className="text-2xl leading-tight font-bold"
            style={{ color: theme.primaryColor }}
          >
            {team.name}
          </CardTitle>
          {team.motto && (
            <p className="text-sm italic mt-2 line-clamp-2 text-muted-foreground">"{team.motto}"</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow px-6 py-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-3">
          {/* Column 1: Team Stats */}
          <div className="space-y-3">
            <div className="flex justify-start mb-1.5">{getStatusBadge(team.status, t, theme)}</div>
            <div 
              className="flex items-center text-sm p-2 rounded-lg backdrop-blur-sm"
              style={{ 
                backgroundColor: `${theme.primaryColor}10`,
                borderLeft: `3px solid ${theme.primaryColor}`
              }}
            >
              <Sigma className="h-4 w-4 mr-2 shrink-0" style={{ color: theme.primaryColor }} />
              <span style={{ color: theme.textColor }}>
                {t('teams.totalMMR')}: <strong style={{ color: theme.primaryColor }}>{formatNumber(totalMMR)}</strong>
              </span>
            </div>
            {/* Team match record */}
            <div 
              className="flex items-center text-sm p-2 rounded-lg backdrop-blur-sm"
              style={{ 
                backgroundColor: `${theme.secondaryColor}10`,
                borderLeft: `3px solid ${theme.secondaryColor}`
              }}
            >
              <ListChecks className="h-4 w-4 mr-2 shrink-0" style={{ color: theme.secondaryColor }} />
              <span style={{ color: theme.textColor }}>
                <span style={{ color: '#10b981' }}>{team.wins || 0}W</span> / 
                <span style={{ color: '#f59e0b' }}>{team.draws || 0}D</span> / 
                <span style={{ color: '#ef4444' }}>{team.losses || 0}L</span>
              </span>
            </div>
          </div>

          {/* Column 2: Player List */}
          <div className="space-y-1">
            <TooltipProvider delayDuration={100}>
              <ul className="space-y-2">
                {sortedPlayers.slice(0, 5).map((player, idx) => (
                  <li key={player.id} className="flex items-center group/player">
                    <div 
                      className="w-1 h-6 rounded-full mr-2 transition-all group-hover/player:h-8"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    {getRoleIcon(player.role)}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link 
                          href={getTournamentPath(`/teams/${team.id}/players/${player.id}`)}
                          className="truncate text-sm transition-all"
                          style={{ color: theme.textColor }}
                          onMouseEnter={(e) => e.currentTarget.style.color = theme.accentColor}
                          onMouseLeave={(e) => e.currentTarget.style.color = theme.textColor || ''}
                        >
                          {player.nickname}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="top" 
                        className="text-xs p-2"
                        style={{ 
                          backgroundColor: theme.cardColor,
                          borderColor: theme.primaryColor 
                        }}
                      >
                        <p style={{ color: theme.textColor }}>MMR: <strong style={{ color: theme.primaryColor }}>{formatNumber(player.mmr)}</strong></p>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4 relative z-10">
        <Button 
          asChild 
          className="w-full transition-all font-semibold"
          style={{
            backgroundColor: theme.primaryColor,
            color: '#ffffff',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.accentColor;
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 8px 16px ${theme.primaryColor}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.primaryColor;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Link href={getTournamentPath(`/teams/${team.id}`)}>{t('teams.viewProfile')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
