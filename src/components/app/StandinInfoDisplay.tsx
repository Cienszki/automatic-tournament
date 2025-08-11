import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRightLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { Match, Standin, Team, Player } from "@/lib/definitions";

interface StandinInfoDisplayProps {
  match: Match;
  standins?: Standin[];
  teams?: Team[];
  size?: 'sm' | 'md' | 'lg';
}

export function StandinInfoDisplay({ match, standins = [], teams = [], size = 'md' }: StandinInfoDisplayProps) {
  const { t } = useTranslation();
  if (!match.standinInfo) return null;

  const teamIds = Object.keys(match.standinInfo);
  if (teamIds.length === 0) return null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4', 
    lg: 'h-5 w-5'
  };

  const getPlayerName = (playerId: string, teamId: string): string => {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      const player = team.players.find(p => p.id === playerId);
      if (player) return player.nickname;
    }
    return t('standins.unknownPlayer');
  };

  const getStandinName = (standinId: string): string => {
    const standin = standins.find(s => s.id === standinId);
    return standin?.nickname || t('standins.unknownStandin');
  };

  return (
    <div className="flex flex-col gap-3 mt-2">
      {teamIds.map(teamId => {
        const standinInfo = match.standinInfo![teamId];
        const team = match.teamA.id === teamId ? match.teamA : match.teamB;
        
        return (
          <div key={teamId} className="bg-muted/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge 
                variant="secondary" 
                className={`${sizeClasses[size]} bg-orange-500/20 text-orange-300 border-orange-500/40`}
              >
                <Users className={`${iconSizes[size]} mr-1`} />
                {team.name}
              </Badge>
            </div>
            
            {/* Show each standin replacement */}
            <div className="space-y-2">
              {standinInfo.standins.map((standinId, index) => {
                const unavailablePlayerId = standinInfo.unavailablePlayers[index];
                return (
                  <div key={`${standinId}-${index}`} className="flex items-center gap-2 text-sm">
                    <Badge 
                      variant="outline" 
                      className={`${sizeClasses[size]} bg-red-500/20 text-red-300 border-red-500/40`}
                    >
                      {unavailablePlayerId ? getPlayerName(unavailablePlayerId, teamId) : 'Player'}
                    </Badge>
                    
                    <ArrowRightLeft className={`${iconSizes[size]} text-muted-foreground`} />
                    
                    <Badge 
                      variant="outline" 
                      className={`${sizeClasses[size]} bg-blue-500/20 text-blue-300 border-blue-500/40`}
                    >
                      {getStandinName(standinId)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compact version for small displays
export function StandinInfoCompact({ match, standins = [], teams = [] }: { 
  match: Match; 
  standins?: Standin[];
  teams?: Team[];
}) {
  const { t } = useTranslation();
  if (!match.standinInfo) return null;

  const standinCount = Object.values(match.standinInfo).reduce(
    (total, info) => total + info.standins.length, 
    0
  );
  
  if (standinCount === 0) return null;

  const getStandinName = (standinId: string): string => {
    const standin = standins.find(s => s.id === standinId);
    return standin?.nickname || t('standins.unknown');
  };

  const getPlayerName = (playerId: string, teamId: string): string => {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      const player = team.players.find(p => p.id === playerId);
      if (player) return player.nickname;
    }
    return t('standins.unknown');
  };

  // Get the first standin info for display
  const firstTeamId = Object.keys(match.standinInfo)[0];
  const firstStandinInfo = match.standinInfo[firstTeamId];
  const hasMultipleTeams = Object.keys(match.standinInfo).length > 1;

  return (
    <div className="space-y-1">
      <Badge 
        variant="secondary" 
        className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-xs"
      >
        <Users className="h-3 w-3 mr-1" />
        {standinCount} {standinCount === 1 ? t('standins.standin').toLowerCase() : t('standins.standins').toLowerCase()}
      </Badge>
      
      {/* Show first replacement as example */}
      {firstStandinInfo.standins.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {getStandinName(firstStandinInfo.standins[0])} → {
            firstStandinInfo.unavailablePlayers[0] 
              ? getPlayerName(firstStandinInfo.unavailablePlayers[0], firstTeamId)
              : t('standins.player')
          }
          {(standinCount > 1 || hasMultipleTeams) && ` +${t('standins.more')}`}
        </div>
      )}
    </div>
  );
}
