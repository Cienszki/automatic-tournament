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
  ArrowRight,
  AlertTriangle
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
  allBrackets?: PlayoffBracket[]; // Add this for better team descriptions
}

// Helper function to get team display name with better descriptions
const getTeamDisplayName = (teamId: string | null, description?: string): string => {
  if (!teamId) {
    return description || 'TBD';
  }
  // In a real app, you'd look up the team name from teamId
  return `Team ${teamId}`; // For now, format team ID nicely
};

// Helper function to generate match codes - FIXED WILDCARD DETECTION
const getMatchCode = (bracket: PlayoffBracket, match: PlayoffMatch): string => {
  // Log data for debugging
  if (typeof window !== 'undefined') {
    console.log(`🎯 Match Code Gen - Bracket: ${bracket.type}, Round: ${match.round}, Position: ${match.position}, ID: ${match.id}`);
  }
  
  // SPECIAL CASE: Detect wildcard matches by ID even if they're in wrong bracket
  if (match.id && (match.id.startsWith('wc-') || match.id.includes('wildcard'))) {
    const pos = match.position || 1;
    const code = `WC${pos}`;
    console.log(`🎯 Wildcard (by ID): pos=${pos} → ${code}`);
    return code;
  }
  
  if (bracket.type === 'wildcard') {
    // Wildcard bracket: WC1, WC2
    const pos = match.position || 1;
    const code = `WC${pos}`;
    console.log(`🎯 Wildcard: pos=${pos} → ${code}`);
    return code;
  } else if (bracket.type === 'upper') {
    // Upper bracket: U1A, U1B, U1C, U1D -> U2A, U2B -> U3A
    const pos = match.position || 1;
    const letterIndex = pos - 1; // 1-based to 0-based conversion
    const code = `U${match.round}${String.fromCharCode(65 + letterIndex)}`;
    console.log(`🎯 Upper: pos=${pos} → letterIndex=${letterIndex} → ${code}`);
    return code;
  } else if (bracket.type === 'lower') {
    // Lower bracket: L1A, L1B, L1C, L1D... 
    // BUT skip wildcard matches that ended up here
    if (match.id && (match.id.startsWith('wc-') || match.id.includes('wildcard'))) {
      const pos = match.position || 1;
      const code = `WC${pos}`;
      console.log(`🎯 Lower→Wildcard (by ID): pos=${pos} → ${code}`);
      return code;
    }
    
    const pos = match.position || 1;
    const letterIndex = pos - 1; // 1-based to 0-based conversion  
    const code = `L${match.round}${String.fromCharCode(65 + letterIndex)}`;
    console.log(`🎯 Lower: pos=${pos} → letterIndex=${letterIndex} → ${code}`);
    return code;
  } else if (bracket.type === 'final') {
    const code = 'GF';
    console.log(`🎯 Final: → ${code}`);
    return code; // Grand Final - should always show GF
  }
  // Fallback
  const fallback = `M${match.id}`;
  console.log(`🎯 Fallback: → ${fallback}`);
  return fallback;
};

// Enhanced team description system with accurate match flow
const getTeamDescription = (bracket: PlayoffBracket, match: PlayoffMatch, isTeamA: boolean, allBrackets: PlayoffBracket[]): string => {
  const matchCode = getMatchCode(bracket, match);
  
  // Handle wildcard matches (detect by ID)
  if (match.id && (match.id.startsWith('wc-') || match.id.includes('wildcard'))) {
    return isTeamA ? "3rd in Group A" : "3rd in Group B";
  }
  
  if (bracket.type === 'wildcard') {
    return isTeamA ? "3rd in Group A" : "3rd in Group B";
  } 
  else if (bracket.type === 'upper') {
    if (match.round === 1) {
      // Initial seeding from groups - expanded for full bracket
      const seedingMap = [
        ["1st in Group A", "2nd in Group D"],
        ["1st in Group B", "2nd in Group C"], 
        ["1st in Group C", "2nd in Group B"],
        ["1st in Group D", "2nd in Group A"]
      ];
      const matchIndex = (match.position || 1) - 1;
      const seeds = seedingMap[matchIndex] || ["Qualified Team", "Qualified Team"];
      return isTeamA ? seeds[0] : seeds[1];
    } else {
      // Upper bracket progression - properly handle all positions
      const prevRound = match.round - 1;
      const position = match.position || 1;
      
      if (match.round === 2) {
        // Round 2: Winners from round 1
        // U2A gets winners from U1A and U1B
        // U2B gets winners from U1C and U1D  
        const teamAMatch = `U${prevRound}${String.fromCharCode(64 + (position - 1) * 2 + 1)}`;
        const teamBMatch = `U${prevRound}${String.fromCharCode(64 + (position - 1) * 2 + 2)}`;
        return isTeamA ? `Winner of ${teamAMatch}` : `Winner of ${teamBMatch}`;
      } else if (match.round === 3) {
        // Round 3: Upper Final - winners from round 2
        const teamAMatch = `U${prevRound}${String.fromCharCode(64 + (position - 1) * 2 + 1)}`;
        const teamBMatch = `U${prevRound}${String.fromCharCode(64 + (position - 1) * 2 + 2)}`;
        return isTeamA ? `Winner of ${teamAMatch}` : `Winner of ${teamBMatch}`;
      } else {
        // Higher rounds - generic progression
        const teamAMatch = `U${prevRound}${String.fromCharCode(64 + (position - 1) * 2 + 1)}`;
        const teamBMatch = `U${prevRound}${String.fromCharCode(64 + (position - 1) * 2 + 2)}`;
        return isTeamA ? `Winner of ${teamAMatch}` : `Winner of ${teamBMatch}`;
      }
    }
  }
  else if (bracket.type === 'lower') {
    // Lower bracket flow (more complex) - expanded for full bracket
    if (match.round === 1) {
      // First round of lower bracket: wildcard winners + direct seeds
      const position = match.position || 1;
      if (position <= 2) {
        return isTeamA ? "Winner of WC1" : "Winner of WC2";
      } else {
        // Direct lower bracket seeds (teams that didn't make upper bracket)
        return `Direct Lower Bracket Seed ${position}`;
      }
    } else if (match.round === 2) {
      // Round 2: L1 winners + upper R1 losers
      const position = match.position || 1;
      if (position <= 4) {
        // L1 winners vs Upper R1 losers
        const l1Match = `L1${String.fromCharCode(64 + position)}`;
        const upperLoser = `U1${String.fromCharCode(64 + position)}`;
        return isTeamA ? `Winner of ${l1Match}` : `Loser of ${upperLoser}`;
      } else {
        // Additional L2 matches
        const l1Match = `L1${String.fromCharCode(64 + position - 4)}`;
        return `Winner of ${l1Match}`;
      }
    } else if (match.round === 3) {
      // Round 3: L2 winners
      const position = match.position || 1;
      const l2MatchA = `L2${String.fromCharCode(64 + (position - 1) * 2 + 1)}`;
      const l2MatchB = `L2${String.fromCharCode(64 + (position - 1) * 2 + 2)}`;
      return isTeamA ? `Winner of ${l2MatchA}` : `Winner of ${l2MatchB}`;
    } else if (match.round === 4) {
      // Round 4: L3 winners + upper R2 losers
      const position = match.position || 1;
      const l3Match = `L3${String.fromCharCode(64 + position)}`;
      const upperLoser = `U2${String.fromCharCode(64 + position)}`;
      return isTeamA ? `Winner of ${l3Match}` : `Loser of ${upperLoser}`;
    } else if (match.round === 5) {
      // Round 5: L4 winners
      const position = match.position || 1;
      const l4MatchA = `L4${String.fromCharCode(64 + (position - 1) * 2 + 1)}`;
      const l4MatchB = `L4${String.fromCharCode(64 + (position - 1) * 2 + 2)}`;
      return isTeamA ? `Winner of ${l4MatchA}` : `Winner of ${l4MatchB}`;
    } else if (match.round === 6) {
      // Round 6: Lower bracket final + upper final loser
      return isTeamA ? `Winner of L5A` : `Loser of U3A`;
    }
  }
  else if (bracket.type === 'final') {
    return isTeamA ? "Upper Bracket Champion" : "Lower Bracket Champion";
  }
  
  return "TBD";
};

// Bracket validation function to check for dead ends
const validateBracketStructure = (allBrackets: PlayoffBracket[]): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];
  const allMatches = allBrackets.flatMap(b => b.matches);

  // Create a map of all match codes to their matches
  const matchCodeMap = new Map<string, PlayoffMatch>();
  allMatches.forEach(match => {
    const bracket = allBrackets.find(b => b.matches.includes(match));
    if (bracket) {
      const code = getMatchCode(bracket, match);
      matchCodeMap.set(code, match);
    }
  });

  // Precompute max round per bracket type (so we can map "Upper Bracket Champion" -> upper final)
  const maxRoundByType = new Map<string, number>();
  allBrackets.forEach(b => {
    const maxRound = b.matches.reduce((acc, m) => Math.max(acc, m.round || 0), 0);
    maxRoundByType.set(b.type, maxRound);
  });

  // Check each match for proper progression
  allMatches.forEach(match => {
    const bracket = allBrackets.find(b => b.matches.includes(match));
    if (!bracket) return;

    const matchCode = getMatchCode(bracket, match);

    // Skip Grand Final - it's the end
    if (matchCode === 'GF') return;

    // Check if this match is referenced by any other match's team description.
    // Accept any mention of the match code (not only 'Winner of ...') to reduce false positives
    // and treat special phrases like 'Upper Bracket Champion' as references to the upper final.
    let hasNextMatch = false;

    allMatches.forEach(otherMatch => {
      const otherBracket = allBrackets.find(b => b.matches.includes(otherMatch));
      if (!otherBracket) return;

      const teamADesc = getTeamDescription(otherBracket, otherMatch, true, allBrackets);
      const teamBDesc = getTeamDescription(otherBracket, otherMatch, false, allBrackets);

      // Direct mention of the match code (covers 'Winner of X', 'Loser of X', or plain 'X')
      if (teamADesc.includes(matchCode) || teamBDesc.includes(matchCode)) {
        hasNextMatch = true;
        return;
      }

      // Map 'Upper/Lower Bracket Champion' to the corresponding final match
      if (bracket.type === 'upper') {
        const upperMax = maxRoundByType.get('upper') || 0;
        if (match.round === upperMax) {
          if (teamADesc.includes('Upper Bracket Champion') || teamBDesc.includes('Upper Bracket Champion')) {
            hasNextMatch = true;
            return;
          }
        }
      }
      if (bracket.type === 'lower') {
        const lowerMax = maxRoundByType.get('lower') || 0;
        if (match.round === lowerMax) {
          if (teamADesc.includes('Lower Bracket Champion') || teamBDesc.includes('Lower Bracket Champion')) {
            hasNextMatch = true;
            return;
          }
        }
      }
    });

    // Additional logic: Don't flag matches as dead ends if they're the final matches in their bracket type
    // or if they're clearly end-of-bracket positions that would go to Grand Final
    if (!hasNextMatch) {
      // Check if this is the final match in its bracket type
      const isUpperFinal = bracket.type === 'upper' && match.round === maxRoundByType.get('upper');
      const isLowerFinal = bracket.type === 'lower' && match.round === maxRoundByType.get('lower');
      
      // Check if this match should logically have a next match
      // For upper bracket: all non-final matches should have progression
      // For lower bracket: all non-final matches should have progression  
      // But be more lenient for complex bracket structures
      const shouldHaveNextMatch = !isUpperFinal && !isLowerFinal && matchCode !== 'GF';
      
      // Additional check: if this is a bracket position that typically ends
      // (like the last positions in each round), be more lenient
      const isEndPosition = (
        // Upper bracket: only the final should not progress
        (bracket.type === 'upper' && isUpperFinal) ||
        // Lower bracket: only the final should not progress  
        (bracket.type === 'lower' && isLowerFinal) ||
        // Wildcard: matches should progress to lower bracket
        (bracket.type === 'wildcard' && false) || // wildcards should always progress
        // Final bracket: grand final has no progression
        (bracket.type === 'final')
      );
      
      if (shouldHaveNextMatch && !isEndPosition) {
        issues.push(`⚠️  Match ${matchCode} winner has no next match to advance to`);
      }
    }
  });

  return {
    isValid: issues.length === 0,
    issues
  };
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
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  
  return (
    <Card className="w-64 bg-gradient-to-br from-card via-card/80 to-muted border-border/20 shadow-none transition-all duration-300 hover:shadow-[0_0_20px_4px_#b86fc644] hover:border-primary/30">
      <CardContent className="p-2">
        {/* Compact Header with Match Code and Live Status */}
        <div className="flex items-center justify-between mb-2">
          {matchCode && (
            <Badge className="bg-primary/90 text-primary-foreground font-mono text-xs px-2 py-0.5 border-0 shadow-[0_0_8px_0_#b86fc644]">
              {matchCode}
            </Badge>
          )}
          {isLive && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-[0_0_6px_0_#0ff0fc]"></div>
              <span className="text-accent font-medium text-xs">LIVE</span>
            </div>
          )}
        </div>

        {/* Compact Team A Row */}
        <div className={cn(
          "flex items-center justify-between p-2 rounded mb-1 transition-all duration-200",
          winnerId === match.teamA?.id 
            ? "bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/50 shadow-[0_0_8px_0_#b86fc666]" 
            : "bg-muted/30 border border-border/50 hover:bg-muted/50"
        )}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={cn(
              "w-5 h-5 rounded flex-shrink-0 flex items-center justify-center font-bold text-xs",
              winnerId === match.teamA?.id 
                ? "bg-primary text-primary-foreground shadow-[0_0_4px_0_#b86fc666]"
                : "bg-gradient-to-r from-primary/10 to-accent/10 text-foreground"
            )}>
              A
            </div>
            <span className={cn(
              "text-xs font-medium truncate",
              winnerId === match.teamA?.id ? "text-primary font-semibold" : "text-foreground"
            )}>
              {teamAName}
            </span>
          </div>
          {(isCompleted || isLive) && (
            <span className={cn(
              "text-sm font-bold ml-2 min-w-[20px] text-center",
              winnerId === match.teamA?.id ? "text-primary drop-shadow-[0_0_4px_#b86fc666]" : "text-muted-foreground"
            )}>
              {scoreA}
            </span>
          )}
        </div>

        {/* Compact Team B Row */}
        <div className={cn(
          "flex items-center justify-between p-2 rounded transition-all duration-200",
          winnerId === match.teamB?.id 
            ? "bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/50 shadow-[0_0_8px_0_#b86fc666]" 
            : "bg-muted/30 border border-border/50 hover:bg-muted/50"
        )}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={cn(
              "w-5 h-5 rounded flex-shrink-0 flex items-center justify-center font-bold text-xs",
              winnerId === match.teamB?.id 
                ? "bg-primary text-primary-foreground shadow-[0_0_4px_0_#b86fc666]"
                : "bg-gradient-to-r from-accent/10 to-primary/10 text-foreground"
            )}>
              B
            </div>
            <span className={cn(
              "text-xs font-medium truncate",
              winnerId === match.teamB?.id ? "text-primary font-semibold" : "text-foreground"
            )}>
              {teamBName}
            </span>
          </div>
          {(isCompleted || isLive) && (
            <span className={cn(
              "text-sm font-bold ml-2 min-w-[20px] text-center",
              winnerId === match.teamB?.id ? "text-primary drop-shadow-[0_0_4px_#b86fc666]" : "text-muted-foreground"
            )}>
              {scoreB}
            </span>
          )}
        </div>

        {/* Minimal Match Details */}
        {showDetails && match.scheduledFor && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 px-1">
            <Calendar className="h-3 w-3" />
            <span className="truncate">{new Date(match.scheduledFor).toLocaleDateString()}</span>
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
  type,
  allBrackets = []
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

  // Upper bracket uses fixed 7x4 grid, lower bracket uses 7x7 grid
  const isUpperBracket = type === 'upper';
  const isLowerBracket = type === 'lower';
  const gridRows = isUpperBracket ? 7 : (isLowerBracket ? 7 : 16);
  const gridCols = filteredRounds.length;
  
  return (
    <div className="space-y-6">
      {/* Bracket Title */}
      <div className="flex items-center gap-3">
        {type === 'upper' && <TrendingUp className="h-5 w-5 text-primary drop-shadow-[0_0_4px_#b86fc666]" />}
        {type === 'lower' && <Zap className="h-5 w-5 text-accent drop-shadow-[0_0_4px_#0ff0fc66]" />}
        {type === 'final' && <Crown className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_4px_#fbbf2466]" />}
        <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {title}
        </h3>
      </div>

      {/* Round Labels - Outside of Grid */}
      <div className="flex gap-4 justify-start mb-4">
        {filteredRounds.map((round, roundIndex) => (
          <div key={`label-${round.id}`} className="flex-shrink-0" style={{ width: '280px', marginRight: roundIndex < filteredRounds.length - 1 ? '36px' : '0' }}>
            <Badge className="bg-muted/80 text-foreground border-border/50 text-sm px-3 py-1 backdrop-blur-sm">
              {round.name}
            </Badge>
          </div>
        ))}
      </div>

      {/* Tournament Tree - Grid Layout */}
      <div 
        className="grid gap-4 items-center justify-items-center w-full"
        style={{ 
          gridTemplateColumns: `repeat(${gridCols}, 280px)`,
          gridTemplateRows: `repeat(${gridRows}, minmax(${isUpperBracket ? '80px' : '100px'}, auto))`,
          minWidth: `${gridCols * 320}px`,
          minHeight: `${gridRows * (isUpperBracket ? 80 : 100)}px`
        }}
      >
        {filteredRounds.map((round, roundIndex) => (
          <React.Fragment key={round.id}>
            {/* Matches in grid positions */}
            {round.matches.map((match, matchIndex) => {
              const bracket = { type, id: '', name: '', isActive: true, slots: [], matches: round.matches };
              const matchCode = getMatchCode(bracket as PlayoffBracket, match);
              const teamADesc = getTeamDescription(bracket as PlayoffBracket, match, true, allBrackets);
              const teamBDesc = getTeamDescription(bracket as PlayoffBracket, match, false, allBrackets);
              
              // Calculate grid position - REDESIGNED SYSTEMATIC APPROACH
              let gridRowStart: number;
              
              if (isUpperBracket) {
                // Upper Bracket: Tournament-style positioning
                const upperPositions = {
                  0: [2, 4, 6, 8], // Round 1: spread out
                  1: [3, 7],       // Round 2: converge  
                  2: [5],          // Round 3: center
                  3: [5]           // Grand Final: center
                };
                const positions = upperPositions[roundIndex as keyof typeof upperPositions] || [5];
                gridRowStart = positions[matchIndex] || 5;
              } else if (isLowerBracket) {
                // Lower Bracket: Systematic approach
                const lowerPositions = {
                  0: [1, 2, 6, 7], // Round 1: corners + middle
                  1: [2, 6],       // Round 2: mid-spread
                  2: [3, 5],       // Round 3: closer
                  3: [4],          // Round 4: center-up  
                  4: [4]           // Round 5: center
                };
                const positions = lowerPositions[roundIndex as keyof typeof lowerPositions] || [4];
                gridRowStart = positions[matchIndex] || 4;
              } else {
                // Dynamic layout for other bracket types
                const availableRows = gridRows - 2;
                const spacing = Math.max(1, Math.floor(availableRows / round.matches.length));
                gridRowStart = 2 + matchIndex * spacing;
              }
              
              return (
                <div
                  key={match.id}
                  className="relative flex justify-center items-center w-full"
                  style={{ 
                    gridColumn: roundIndex + 1,
                    gridRow: gridRowStart
                  }}
                >
                  <MatchCard
                    match={match}
                    showDetails={showDetails}
                    matchCode={matchCode}
                    teamADescription={teamADesc}
                    teamBDescription={teamBDesc}
                  />
                  
                  {/* Connection Lines to Next Round */}
                  {roundIndex < filteredRounds.length - 1 && (
                    <svg 
                      className="absolute left-full top-1/2 -translate-y-1/2 pointer-events-none z-10"
                      style={{ 
                        width: '32px', 
                        height: '2px'
                      }}
                    >
                      <defs>
                        <linearGradient id={`lineGradient-${roundIndex}-${matchIndex}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
                        </linearGradient>
                      </defs>
                      <line 
                        x1="0" 
                        y1="1"
                        x2="32" 
                        y2="1"
                        stroke={`url(#lineGradient-${roundIndex}-${matchIndex})`}
                        strokeWidth="2"
                        className="drop-shadow-[0_0_2px_#b86fc644]"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const PlayoffBracketDisplay: React.FC<{ bracketData: PlayoffData }> = ({ bracketData }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Debug: Log the data structure
  console.log('🔍 PlayoffBracketDisplay received data:', bracketData);

  if (!bracketData || !Array.isArray(bracketData.brackets) || bracketData.brackets.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-card via-card/80 to-muted border-border/20">
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

  // Debug: Log each bracket structure  
  bracketData.brackets.forEach((bracket, index) => {
    console.log(`🔍 Bracket ${index} (${bracket.type}):`, bracket);
    bracket.matches.forEach((match, matchIndex) => {
      console.log(`  🎯 Match ${matchIndex}:`, match);
    });
  });

  // Organize brackets - FIXED TO HANDLE MISPLACED WILDCARD MATCHES
  const upperBracket = bracketData.brackets.find(b => b.type === 'upper');
  const lowerBracket = bracketData.brackets.find(b => b.type === 'lower');
  const wildcardBracket = bracketData.brackets.find(b => b.type === 'wildcard');
  const finalBracket = bracketData.brackets.find(b => b.type === 'final');

  // SPECIAL FIX: Extract wildcard matches from lower bracket if they ended up there
  let actualWildcardBracket = wildcardBracket;
  let actualLowerBracket = lowerBracket;
  
  if (lowerBracket && !wildcardBracket) {
    // Check if lower bracket contains wildcard matches (by ID)
    const wildcardMatches = lowerBracket.matches.filter(m => 
      m.id && (m.id.startsWith('wc-') || m.id.includes('wildcard'))
    );
    const realLowerMatches = lowerBracket.matches.filter(m => 
      !m.id || (!m.id.startsWith('wc-') && !m.id.includes('wildcard'))
    );
    
    if (wildcardMatches.length > 0) {
      // Create synthetic wildcard bracket
      actualWildcardBracket = {
        ...lowerBracket,
        type: 'wildcard' as const,
        matches: wildcardMatches
      };
      
      // Update lower bracket without wildcard matches
      actualLowerBracket = {
        ...lowerBracket,
        matches: realLowerMatches
      };
      
      console.log(`🔧 Fixed bracket organization: Moved ${wildcardMatches.length} wildcard matches from lower bracket`);
    }
  }

  // Create rounds for each bracket type with proper naming
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
        name: getRoundName(bracket.type, roundNum),
        matches: matches.sort((a, b) => (a.position || 0) - (b.position || 0))
      }));
  };

  // Helper function to get proper round names - SIMPLIFIED
  const getRoundName = (bracketType: string, roundNum: number): string => {
    if (bracketType === 'wildcard') {
      return 'Wildcard';
    } else if (bracketType === 'upper') {
      return `Round ${roundNum}`;
    } else if (bracketType === 'lower') {
      return `Round ${roundNum}`;
    } else if (bracketType === 'final') {
      return 'Grand Final';
    }
    return `Round ${roundNum}`;
  };

  // Create rounds for each bracket type
  const upperRounds = createRounds(upperBracket);
  const lowerRounds = createRounds(actualLowerBracket); // Use corrected lower bracket
  const wildcardRounds = createRounds(actualWildcardBracket); // Use corrected wildcard bracket
  
  // Prepare all brackets for team descriptions
  const allBrackets: PlayoffBracket[] = [
    ...(upperBracket ? [upperBracket] : []),
    ...(actualLowerBracket ? [actualLowerBracket] : []),
    ...(actualWildcardBracket ? [actualWildcardBracket] : []),
    ...(finalBracket ? [finalBracket] : [])
  ];
  
  // Validate bracket structure
  const validation = validateBracketStructure(allBrackets);
  
  // Calculate some statistics
  const allMatches = bracketData.brackets.flatMap(b => b.matches);
  const totalMatches = allMatches.length;
  const completedMatches = allMatches.filter(m => m.status === 'completed').length;
  const liveMatches = allMatches.filter(m => m.status === 'live').length;

  return (
    <div className="space-y-8">
      {/* Bracket Validation Issues */}
      {!validation.isValid && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Bracket Structure Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {validation.issues.map((issue, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  {issue}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tournament Header */}
      <Card className="bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]">
        <div className="absolute -top-8 -right-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
          <Trophy size={96} className="text-primary drop-shadow-[0_0_8px_#b86fc6] rotate-12" />
        </div>
        <CardContent className="py-6 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center shadow-[0_0_20px_4px_#b86fc644]">
                <Trophy className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-wide">
                  {bracketData.name}
                </h2>
                <div className="flex flex-wrap gap-2 text-sm text-foreground/80 mt-1">
                  <span className="bg-muted/30 px-2 py-1 rounded text-xs">{totalMatches} matches</span>
                  <span>•</span>
                  <span className="bg-muted/30 px-2 py-1 rounded text-xs">{completedMatches} completed</span>
                  {liveMatches > 0 && (
                    <>
                      <span>•</span>
                      <span className="bg-accent/20 text-accent px-2 py-1 rounded text-xs font-medium animate-pulse">
                        {liveMatches} live
                      </span>
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
                className="flex items-center gap-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 transition-all duration-200"
              >
                {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-gradient-to-r from-card/90 to-muted/50 border-border/30">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search teams or matches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background/50 border-border/50 focus:border-primary/50 focus:shadow-[0_0_8px_0_#b86fc644]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "flex items-center gap-1 transition-all duration-200",
                  statusFilter === 'all' 
                    ? "bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_0_#b86fc644]" 
                    : "border-border/50 hover:border-primary/30 hover:bg-primary/10"
                )}
              >
                <Filter className="h-3 w-3" />
                All
              </Button>
              <Button
                variant={statusFilter === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('live')}
                className={cn(
                  "flex items-center gap-1 transition-all duration-200",
                  statusFilter === 'live' 
                    ? "bg-gradient-to-r from-accent to-primary shadow-[0_0_12px_0_#0ff0fc44]" 
                    : "border-border/50 hover:border-accent/30 hover:bg-accent/10"
                )}
              >
                <Play className="h-3 w-3" />
                Live
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
                className={cn(
                  "flex items-center gap-1 transition-all duration-200",
                  statusFilter === 'completed' 
                    ? "bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_0_#b86fc644]" 
                    : "border-border/50 hover:border-primary/30 hover:bg-primary/10"
                )}
              >
                <CheckCircle className="h-3 w-3" />
                Done
              </Button>
              <Button
                variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('scheduled')}
                className={cn(
                  "flex items-center gap-1 transition-all duration-200",
                  statusFilter === 'scheduled' 
                    ? "bg-gradient-to-r from-accent to-primary shadow-[0_0_12px_0_#0ff0fc44]" 
                    : "border-border/50 hover:border-accent/30 hover:bg-accent/10"
                )}
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
        <Card className="bg-gradient-to-br from-[#181c2f] via-[#2d1b3c] to-[#3a295a] shadow-none border-0">
          <CardContent className="p-6">
            <BracketTree
              title="Upper Bracket"
              rounds={[
                ...upperRounds,
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
              allBrackets={allBrackets}
            />
          </CardContent>
        </Card>
      )}

      {/* Wildcard bracket */}
      {actualWildcardBracket && (
        <Card className="bg-gradient-to-br from-[#2a1f3d] via-[#3d2c4a] to-[#1a1d33] shadow-none border-0">
          <CardContent className="p-6">
            <BracketTree
              title="Wildcard"
              rounds={wildcardRounds}
              showDetails={showDetails}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              type="lower"
              allBrackets={allBrackets}
            />
          </CardContent>
        </Card>
      )}

      {/* Lower Bracket */}
      {actualLowerBracket && actualLowerBracket.matches.length > 0 && (
        <Card className="bg-gradient-to-br from-[#2d1b3c] via-[#3a295a] to-[#181c2f] shadow-none border-0">
          <CardContent className="p-6">
            <BracketTree
              title="Lower Bracket"
              rounds={lowerRounds}
              showDetails={showDetails}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              type="lower"
              allBrackets={allBrackets}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlayoffBracketDisplay;
