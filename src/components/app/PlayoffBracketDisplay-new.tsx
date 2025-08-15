"use client";

import React, { useState, useMemo } from 'react';
import type { PlayoffData, PlayoffMatch, PlayoffBracket } from '@/lib/definitions';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Trophy, 
  Clock, 
  CheckCircle, 
  Play, 
  Users, 
  Calendar,
  Star,
  TrendingUp,
  Crown,
  Zap,
  Search,
  Filter,
  Eye,
  EyeOff,
  ArrowRight
} from "lucide-react";
import { StandinInfoCompact } from './StandinInfoDisplay';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  match: PlayoffMatch;
  showDetails?: boolean;
  matchCode?: string;
  teamADescription?: string;
  teamBDescription?: string;
}

interface BracketRound {
  id: string;
  name: string;
  matches: PlayoffMatch[];
}

interface BracketTreeProps {
  title: string;
  rounds: BracketRound[];
  showDetails?: boolean;
  searchTerm?: string;
  statusFilter?: string;
  type: 'upper' | 'lower' | 'final';
}

// Helper function to get team display name with better descriptions
const getTeamDisplayName = (teamId: string | null, description?: string): string => {
  if (!teamId) {
    return description || 'TBD';
  }
  // In a real app, you'd look up the team name from teamId
  return `Team ${teamId}`; // For now, format team ID nicely
};

// Helper function to generate match codes
const getMatchCode = (bracket: PlayoffBracket, match: PlayoffMatch): string => {
  if (bracket.type === 'upper') {
    return `U${match.round}${String.fromCharCode(65 + (match.position || 0))}`;
  } else if (bracket.type === 'lower') {
    return `L${match.round}${String.fromCharCode(65 + (match.position || 0))}`;
  } else if (bracket.type === 'final') {
    return 'GF';
  } else if (bracket.type === 'wildcard') {
    return `WC${match.position || 1}`;
  }
  return `M${match.id}`;
};

// Helper function to get team descriptions based on bracket position
const getTeamDescription = (bracket: PlayoffBracket, match: PlayoffMatch, isTeamA: boolean): string => {
  if (bracket.type === 'wildcard') {
    return isTeamA ? "3rd in Group A" : "3rd in Group B";
  } else if (bracket.type === 'upper' && match.round === 1) {
    const groupLabels = ["1st in Group A", "2nd in Group A", "1st in Group B", "2nd in Group B", 
                        "1st in Group C", "2nd in Group C", "1st in Group D", "2nd in Group D"];
    const index = (match.position || 0) * 2 + (isTeamA ? 0 : 1);
    return groupLabels[index] || "Qualified Team";
  } else if (bracket.type === 'lower' && match.round === 1) {
    return isTeamA ? "Winner of WC1" : "Loser of U1A";
  } else if (bracket.type === 'lower' && match.round > 1) {
    const prevRound = match.round - 1;
    return isTeamA ? `Winner of L${prevRound}A` : `Loser of U${Math.ceil(prevRound/2)}A`;
  } else if (bracket.type === 'upper' && match.round > 1) {
    const prevRound = match.round - 1;
    return isTeamA ? `Winner of U${prevRound}A` : `Winner of U${prevRound}B`;
  } else if (bracket.type === 'final') {
    return isTeamA ? "Winner of Upper Bracket" : "Winner of Lower Bracket";
  }
  return "TBD";
};

const MatchCard: React.FC<MatchCardProps> = ({ 
  match, 
  showDetails = false, 
  matchCode,
  teamADescription,
  teamBDescription 
}) => {
  const teamAName = getTeamDisplayName(match.teamA?.id || null, teamADescription);
  const teamBName = getTeamDisplayName(match.teamB?.id || null, teamBDescription);
  const scoreA = match.result?.teamAScore ?? 0;
  const scoreB = match.result?.teamBScore ?? 0;
  const winnerId = match.result?.winnerId;
  
  const getStatusIcon = () => {
    switch (match.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'live':
        return <Play className="h-4 w-4 text-red-600 animate-pulse" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (match.status) {
      case 'completed': return 'border-green-200 bg-green-50';
      case 'live': return 'border-red-200 bg-red-50';
      case 'scheduled': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Card className={cn("w-64 transition-all hover:shadow-md", getStatusColor())}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {matchCode && (
              <Badge variant="outline" className="text-xs font-mono">
                {matchCode}
              </Badge>
            )}
          </div>
          <Badge variant={match.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
            {match.status}
          </Badge>
        </div>

        {/* Team A */}
        <div className={cn(
          "flex items-center justify-between p-2 rounded mb-1",
          winnerId === match.teamA?.id ? "bg-green-100 border-green-300 border-2" : "bg-background border"
        )}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 bg-primary/10 rounded-full flex-shrink-0 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">A</span>
            </div>
            <span className="text-sm font-medium truncate">{teamAName}</span>
          </div>
          {match.status === 'completed' && (
            <span className="text-sm font-bold ml-2">{scoreA}</span>
          )}
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center my-1">
          <span className="text-xs text-muted-foreground font-medium">VS</span>
        </div>

        {/* Team B */}
        <div className={cn(
          "flex items-center justify-between p-2 rounded mb-2",
          winnerId === match.teamB?.id ? "bg-green-100 border-green-300 border-2" : "bg-background border"
        )}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 bg-secondary/10 rounded-full flex-shrink-0 flex items-center justify-center">
              <span className="text-xs font-bold text-secondary-foreground">B</span>
            </div>
            <span className="text-sm font-medium truncate">{teamBName}</span>
          </div>
          {match.status === 'completed' && (
            <span className="text-sm font-bold ml-2">{scoreB}</span>
          )}
        </div>

        {/* Match Details */}
        {showDetails && (
          <div className="space-y-2 pt-2 border-t">
            {match.scheduledFor && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{new Date(match.scheduledFor).toLocaleString()}</span>
              </div>
            )}
            {match.format && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Trophy className="h-3 w-3" />
                <span>{match.format}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const BracketTree: React.FC<BracketTreeProps> = ({ 
  title, 
  rounds, 
  showDetails = false, 
  searchTerm = '', 
  statusFilter = 'all',
  type 
}) => {
  // Filter matches based on search and status
  const filteredRounds = useMemo(() => {
    return rounds.map(round => ({
      ...round,
      matches: round.matches.filter(match => {
        const matchesSearch = searchTerm === '' || 
          (match.teamA?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (match.teamB?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || match.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
    })).filter(round => round.matches.length > 0);
  }, [rounds, searchTerm, statusFilter]);

  if (filteredRounds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {type === 'upper' && <TrendingUp className="h-5 w-5 text-blue-600" />}
        {type === 'lower' && <Zap className="h-5 w-5 text-orange-600" />}
        {type === 'final' && <Crown className="h-5 w-5 text-yellow-600" />}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="relative">
        {/* Bracket Tree Layout */}
        <div className="flex gap-8 overflow-x-auto pb-4">
          {filteredRounds.map((round, roundIndex) => (
            <div key={round.id} className="flex flex-col items-center space-y-4 min-w-fit">
              <div className="text-center">
                <Badge variant="outline" className="text-sm font-medium">
                  {round.name}
                </Badge>
              </div>
              
              <div className="space-y-6">
                {round.matches.map((match, matchIndex) => {
                  const bracket = { type, id: '', name: '', isActive: true, slots: [], matches: round.matches };
                  const matchCode = getMatchCode(bracket as PlayoffBracket, match);
                  const teamADesc = getTeamDescription(bracket as PlayoffBracket, match, true);
                  const teamBDesc = getTeamDescription(bracket as PlayoffBracket, match, false);
                  
                  return (
                    <div key={match.id} className="relative">
                      <MatchCard
                        match={match}
                        showDetails={showDetails}
                        matchCode={matchCode}
                        teamADescription={teamADesc}
                        teamBDescription={teamBDesc}
                      />
                      
                      {/* Connection lines to next round */}
                      {roundIndex < filteredRounds.length - 1 && (
                        <div className="absolute top-1/2 -right-4 w-8 h-px bg-border">
                          <ArrowRight className="h-3 w-3 absolute -right-1 -top-1.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PlayoffBracketDisplay: React.FC<{ bracketData: PlayoffData }> = ({ bracketData }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  if (!bracketData || !Array.isArray(bracketData.brackets) || bracketData.brackets.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Playoff Brackets</h3>
          <p className="text-sm text-muted-foreground">
            The playoff brackets have not been set up yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Organize brackets
  const upperBracket = bracketData.brackets.find(b => b.type === 'upper');
  const lowerBracket = bracketData.brackets.find(b => b.type === 'lower');
  const wildcardBracket = bracketData.brackets.find(b => b.type === 'wildcard');
  const finalBracket = bracketData.brackets.find(b => b.type === 'final');

  // Create rounds for each bracket type
  const createRounds = (bracket: PlayoffBracket | undefined): BracketRound[] => {
    if (!bracket) return [];
    
    const roundsMap = new Map<number, PlayoffMatch[]>();
    bracket.matches.forEach(match => {
      const round = match.round;
      if (!roundsMap.has(round)) {
        roundsMap.set(round, []);
      }
      roundsMap.get(round)!.push(match);
    });

    return Array.from(roundsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([roundNum, matches]) => ({
        id: `${bracket.type}-round-${roundNum}`,
        name: bracket.type === 'wildcard' ? 'Wildcard' : `Round ${roundNum}`,
        matches: matches.sort((a, b) => (a.position || 0) - (b.position || 0))
      }));
  };

  // Merge wildcard into lower bracket as first round
  const lowerRounds = createRounds(lowerBracket);
  const wildcardRounds = createRounds(wildcardBracket);
  const mergedLowerRounds = wildcardRounds.length > 0 
    ? [{ ...wildcardRounds[0], name: 'Round 1 (Wildcard)' }, ...lowerRounds.map(r => ({ ...r, name: `Round ${parseInt(r.name.split(' ')[1]) + 1}` }))]
    : lowerRounds;

  // Calculate some statistics
  const allMatches = bracketData.brackets.flatMap(b => b.matches);
  const totalMatches = allMatches.length;
  const completedMatches = allMatches.filter(m => m.status === 'completed').length;
  const liveMatches = allMatches.filter(m => m.status === 'live').length;

  return (
    <div className="space-y-8">
      {/* Tournament Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-xl font-bold">{bracketData.name}</h2>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>{totalMatches} matches</span>
                  <span>•</span>
                  <span>{completedMatches} completed</span>
                  {liveMatches > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-red-500 font-medium">{liveMatches} live</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2"
              >
                {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search teams or matches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="flex items-center gap-1"
              >
                <Filter className="h-3 w-3" />
                All
              </Button>
              <Button
                variant={statusFilter === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('live')}
                className="flex items-center gap-1"
              >
                <Play className="h-3 w-3" />
                Live
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
                className="flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                Done
              </Button>
              <Button
                variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('scheduled')}
                className="flex items-center gap-1"
              >
                <Clock className="h-3 w-3" />
                Upcoming
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upper Bracket with Grand Final as last round */}
      {upperBracket && (
        <Card>
          <CardContent className="p-6">
            <BracketTree
              title="Upper Bracket"
              rounds={[
                ...createRounds(upperBracket),
                ...(finalBracket ? [{
                  id: 'grand-final',
                  name: 'Grand Final',
                  matches: finalBracket.matches
                }] : [])
              ]}
              showDetails={showDetails}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              type="upper"
            />
          </CardContent>
        </Card>
      )}

      {/* Lower Bracket (with integrated wildcard) */}
      {(lowerBracket || wildcardBracket) && (
        <Card>
          <CardContent className="p-6">
            <BracketTree
              title="Lower Bracket"
              rounds={mergedLowerRounds}
              showDetails={showDetails}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              type="lower"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlayoffBracketDisplay;
