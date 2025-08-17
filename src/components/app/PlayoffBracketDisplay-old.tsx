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
    // Upper bracket: U1A, U1B, U1C, U1D (R1) -> U2A, U2B (R2) -> U3A (R3 - Upper Final)
    const pos = match.position || 1;
    const letterIndex = pos - 1; // 1-based to 0-based conversion
    const code = `U${match.round}${String.fromCharCode(65 + letterIndex)}`;
    console.log(`🎯 Upper: pos=${pos} → letterIndex=${letterIndex} → ${code}`);
    return code;
  } else if (bracket.type === 'lower') {
    // Lower bracket: L1A-L1D (R1) -> L2A-L2D (R2) -> L3A,L3B (R3) -> L4A,L4B (R4) -> L5A (R5) -> L6A (R6 - Lower Final)
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

// Enhanced team description system with accurate match flow for double elimination
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
      // Upper Bracket Round 1: 8 teams from groups
      const seedingMap = [
        ["1st in Group A", "2nd in Group D"],
        ["1st in Group B", "2nd in Group C"], 
        ["1st in Group C", "2nd in Group B"],
        ["1st in Group D", "2nd in Group A"]
      ];
      const matchIndex = (match.position || 1) - 1;
      const seeds = seedingMap[matchIndex] || ["Qualified Team", "Qualified Team"];
      return isTeamA ? seeds[0] : seeds[1];
    } else if (match.round === 2) {
      // Upper Round 2: 4 winners from R1 -> 2 matches
      // U2A: Winner of U1A vs Winner of U1B
      // U2B: Winner of U1C vs Winner of U1D
      const position = match.position || 1;
      const teamAMatch = `U1${String.fromCharCode(64 + (position - 1) * 2 + 1)}`;
      const teamBMatch = `U1${String.fromCharCode(64 + (position - 1) * 2 + 2)}`;
      return isTeamA ? `Winner of ${teamAMatch}` : `Winner of ${teamBMatch}`;
    } else if (match.round === 3) {
      // Upper Final: Winner of U2A vs Winner of U2B
      return isTeamA ? "Winner of U2A" : "Winner of U2B";
    }
  }
  else if (bracket.type === 'lower') {
    // Lower bracket: Complex double elimination structure
    const position = match.position || 1;
    
    if (match.round === 1) {
      // LB Round 1: 8 teams (6 direct + 2 wildcard winners) -> 4 matches
      // L1A: WC1 winner vs Direct seed 1
      // L1B: WC2 winner vs Direct seed 2  
      // L1C: Direct seed 3 vs Direct seed 4
      // L1D: Direct seed 5 vs Direct seed 6
      if (position === 1) {
        return isTeamA ? "Winner of WC1" : "Direct LB Seed 1";
      } else if (position === 2) {
        return isTeamA ? "Winner of WC2" : "Direct LB Seed 2";
      } else {
        return isTeamA ? `Direct LB Seed ${position * 2 - 1}` : `Direct LB Seed ${position * 2}`;
      }
    } else if (match.round === 2) {
      // LB Round 2: 4 LB R1 winners + 4 Upper R1 losers -> 4 matches
      // L2A: Winner of L1A vs Loser of U1A
      // L2B: Winner of L1B vs Loser of U1B
      // L2C: Winner of L1C vs Loser of U1C
      // L2D: Winner of L1D vs Loser of U1D
      const l1Match = `L1${String.fromCharCode(64 + position)}`;
      const upperLoser = `U1${String.fromCharCode(64 + position)}`;
      return isTeamA ? `Winner of ${l1Match}` : `Loser of ${upperLoser}`;
    } else if (match.round === 3) {
      // LB Round 3: 4 LB R2 winners -> 2 matches
      // L3A: Winner of L2A vs Winner of L2B
      // L3B: Winner of L2C vs Winner of L2D
      const teamAMatch = `L2${String.fromCharCode(64 + (position - 1) * 2 + 1)}`;
      const teamBMatch = `L2${String.fromCharCode(64 + (position - 1) * 2 + 2)}`;
      return isTeamA ? `Winner of ${teamAMatch}` : `Winner of ${teamBMatch}`;
    } else if (match.round === 4) {
      // LB Round 4: 2 LB R3 winners + 2 Upper R2 losers -> 2 matches  
      // L4A: Winner of L3A vs Loser of U2A
      // L4B: Winner of L3B vs Loser of U2B
      const l3Match = `L3${String.fromCharCode(64 + position)}`;
      const upperLoser = `U2${String.fromCharCode(64 + position)}`;
      return isTeamA ? `Winner of ${l3Match}` : `Loser of ${upperLoser}`;
    } else if (match.round === 5) {
      // LB Round 5: 2 LB R4 winners -> 1 match
      // L5A: Winner of L4A vs Winner of L4B
      return isTeamA ? "Winner of L4A" : "Winner of L4B";
    } else if (match.round === 6) {
      // LB Round 6 (Lower Final): LB R5 winner + Upper Final loser -> 1 match
      // L6A: Winner of L5A vs Loser of U3A
      return isTeamA ? "Winner of L5A" : "Loser of U3A";
    }
  }
  else if (bracket.type === 'final') {
    // Grand Final: Upper Final winner vs Lower Final winner
    return isTeamA ? "Winner of U3A" : "Winner of L6A";
  }
  
  return "TBD";
};

// Helper function to get proper round names - SIMPLIFIED
function getRoundName(bracketType: string, roundNum: number): string {
  if (bracketType === 'wildcard') return 'Wildcard';
  if (bracketType === 'upper') return `Round ${roundNum}`;
  if (bracketType === 'lower') return `Round ${roundNum}`;
  if (bracketType === 'final') return 'Grand Final';
  return `Round ${roundNum}`;
}

// Create rounds helper — ensures rounds 1..maxRound exist and matches are grouped by numeric round
function createRounds(bracket: PlayoffBracket | undefined): BracketRound[] {
  if (!bracket) return [];

  const roundsMap = new Map<number, PlayoffMatch[]>();
  let maxRound = 0;

  bracket.matches.forEach(match => {
    let roundNum = typeof match.round === 'number' ? match.round : Number((match as any).round);
    if (Number.isNaN(roundNum) || roundNum <= 0) {
      if (typeof window !== 'undefined') console.warn(`Playoff: match ${(match as any).id} has invalid round:`, (match as any).round);
      return;
    }
    roundNum = Math.floor(roundNum);
    maxRound = Math.max(maxRound, roundNum);

    if (!roundsMap.has(roundNum)) roundsMap.set(roundNum, []);
    roundsMap.get(roundNum)!.push(match);
  });

  const rounds: BracketRound[] = [];
  for (let r = 1; r <= Math.max(1, maxRound); r++) {
    const matches = (roundsMap.get(r) || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    rounds.push({ id: `${bracket.type}-round-${r}`, name: getRoundName(bracket.type, r), matches });
  }

  return rounds;
}

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

  // Debug: Log all existing match codes
  console.log('🔍 All existing match codes:', Array.from(matchCodeMap.keys()).sort());

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

      // Debug: Log team descriptions for this match
      if (typeof window !== 'undefined') {
        console.log(`🔍 Match ${getMatchCode(otherBracket, otherMatch)}: TeamA="${teamADesc}", TeamB="${teamBDesc}"`);
      }

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
  const [isExpanded, setIsExpanded] = useState(false);
  const teamAName = getTeamDisplayName(match.teamA?.id || null, teamADescription);
  const teamBName = getTeamDisplayName(match.teamB?.id || null, teamBDescription);
  const scoreA = match.result?.teamAScore ?? 0;
  const scoreB = match.result?.teamBScore ?? 0;
  const winnerId = match.result?.winnerId;
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  
  return (
    <Card 
      className={cn(
        "relative transition-all duration-200 border-2 hover:shadow-lg cursor-pointer",
        "min-w-[240px] max-w-[300px]",
        isLive && "border-green-500/50 shadow-green-500/25 bg-green-50/50 dark:bg-green-950/20",
        isCompleted && "border-blue-500/50 shadow-blue-500/25 bg-blue-50/50 dark:bg-blue-950/20",
        !isLive && !isCompleted && "border-border/50 hover:border-primary/50",
        isExpanded && "scale-105 z-50"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Status indicator */}
      {isLive && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-background" />
      )}
      
      <CardContent className="p-4 space-y-3">
        {/* Match header */}
        <div className="flex items-center justify-between">
          {matchCode && (
            <Badge 
              variant="secondary" 
              className="text-xs font-medium px-2 py-1 bg-primary/20 text-primary border border-primary/30"
            >
              {matchCode}
            </Badge>
          )}
          <div className="flex items-center gap-2">
            {isLive && (
              <Badge variant="default" className="text-xs bg-green-500 text-white">
                <Play className="h-3 w-3 mr-1" />
                LIVE
              </Badge>
            )}
            {isCompleted && (
              <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-600 border border-blue-500/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                DONE
              </Badge>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="space-y-2">
          {/* Team A */}
          <div 
            className={cn(
              "flex items-center justify-between p-2 rounded-lg transition-colors",
              winnerId === match.teamA?.id 
                ? "bg-primary/20 border border-primary/30 font-semibold" 
                : "bg-muted/50 hover:bg-muted/70"
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                winnerId === match.teamA?.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted-foreground/30 text-muted-foreground"
              )}>
                A
              </div>
              <span className="truncate text-sm">
                {teamAName}
              </span>
            </div>
            {isCompleted && (
              <span className={cn(
                "ml-2 font-bold tabular-nums text-sm",
                winnerId === match.teamA?.id && "text-primary"
              )}>
                {scoreA}
              </span>
            )}
          </div>

          {/* Team B */}
          <div 
            className={cn(
              "flex items-center justify-between p-2 rounded-lg transition-colors",
              winnerId === match.teamB?.id 
                ? "bg-primary/20 border border-primary/30 font-semibold" 
                : "bg-muted/50 hover:bg-muted/70"
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                winnerId === match.teamB?.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted-foreground/30 text-muted-foreground"
              )}>
                B
              </div>
              <span className="truncate text-sm">
                {teamBName}
              </span>
            </div>
            {isCompleted && (
              <span className={cn(
                "ml-2 font-bold tabular-nums text-sm",
                winnerId === match.teamB?.id && "text-primary"
              )}>
                {scoreB}
              </span>
            )}
          </div>
        </div>

        {/* Team descriptions - show when expanded */}
        {isExpanded && (teamADescription || teamBDescription) && (
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
            {teamADescription && (
              <div>A: {teamADescription}</div>
            )}
            {teamBDescription && (
              <div>B: {teamBDescription}</div>
            )}
          </div>
        )}

        {/* Additional details when expanded */}
        {isExpanded && (
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
            <div>Status: {match.status}</div>
            {match.format && <div>Format: {match.format}</div>}
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

  // Calculate responsive spacing
  const totalWidth = typeof window !== 'undefined' ? window.innerWidth - 100 : 1400; // Account for padding
  const roundWidth = Math.max(300, totalWidth / filteredRounds.length);
  
  return (
    <div className="relative w-full">
      {/* Tournament Bracket with Full Width Layout */}
      <div className="relative w-full overflow-x-auto">
        <div 
          className="relative flex items-start px-4 py-8 min-h-[600px]"
          style={{ 
            width: `${filteredRounds.length * roundWidth}px`,
            background: `
              radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.05) 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, hsl(var(--accent) / 0.05) 0%, transparent 50%)
            `
          }}
        >
          {/* Advanced Connection Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            <defs>
              <linearGradient id={`connectionGradient-${type}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              </linearGradient>
              <filter id={`glow-${type}`}>
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Smooth curved connections between rounds */}
            {filteredRounds.map((round, roundIndex) => 
              roundIndex < filteredRounds.length - 1 && (
                <g key={`connections-${roundIndex}`}>
                  {round.matches.map((match, matchIndex) => {
                    const startX = (roundIndex + 0.8) * roundWidth;
                    const startY = 150 + matchIndex * 180;
                    const endX = (roundIndex + 1.2) * roundWidth;
                    const nextRoundMatches = filteredRounds[roundIndex + 1]?.matches.length || 1;
                    const targetMatchIndex = Math.floor(matchIndex / 2);
                    const endY = 150 + targetMatchIndex * 180 + (nextRoundMatches > 1 ? 0 : 90);
                    
                    const midX = (startX + endX) / 2;
                    
                    return (
                      <path
                        key={`connection-${roundIndex}-${matchIndex}`}
                        d={`M ${startX} ${startY} Q ${midX} ${startY} ${midX} ${endY} Q ${midX} ${endY} ${endX} ${endY}`}
                        stroke={`url(#connectionGradient-${type})`}
                        strokeWidth="2"
                        fill="none"
                        filter={`url(#glow-${type})`}
                        className="transition-all duration-300 hover:stroke-[3]"
                        opacity="0.7"
                      />
                    );
                  })}
                </g>
              )
            )}
          </svg>

          {/* Rounds with responsive spacing */}
          {filteredRounds.map((round, roundIndex) => (
            <div 
              key={round.id} 
              className="relative flex flex-col justify-center space-y-6" 
              style={{ 
                width: `${roundWidth}px`,
                zIndex: 10 
              }}
            >
              {/* Matches positioned for optimal connection */}
              {round.matches.map((match, matchIndex) => {
                const bracket = { type, id: '', name: '', isActive: true, slots: [], matches: round.matches };
                const matchCode = getMatchCode(bracket as PlayoffBracket, match);
                const teamADesc = getTeamDescription(bracket as PlayoffBracket, match, true, allBrackets);
                const teamBDesc = getTeamDescription(bracket as PlayoffBracket, match, false, allBrackets);
                
                return (
                  <div
                    key={match.id}
                    className="relative flex justify-center"
                    style={{ 
                      marginTop: matchIndex === 0 ? '0' : '20px'
                    }}
                  >
                    <MatchCard
                      match={match}
                      showDetails={showDetails}
                      matchCode={matchCode}
                      teamADescription={teamADesc}
                      teamBDescription={teamBDesc}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Lower bracket visualizer — creative spiral/wave layout that ensures no matches are hidden
const LowerBracketVisualizer: React.FC<{
  title: string;
  bracket: PlayoffBracket;
  showDetails?: boolean;
  allBrackets?: PlayoffBracket[];
}> = ({ title, bracket, showDetails = false, allBrackets = [] }) => {
  // Build rounds using the same createRounds helper so round numbering is consistent
  const rounds = createRounds(bracket);

  return (
    <div className="relative w-full">

      {/* Full Width Wave-Pattern Layout */}
      <div className="relative w-full overflow-x-auto">
        <div 
          className="relative flex items-start px-4 py-8 min-h-[700px]"
          style={{ 
            width: `${Math.max(rounds.length * 280, typeof window !== 'undefined' ? window.innerWidth - 100 : 1400)}px`,
            background: `
              radial-gradient(ellipse at center, hsl(var(--destructive) / 0.1) 0%, transparent 50%),
              conic-gradient(from 0deg at 50% 50%, hsl(var(--primary) / 0.05), hsl(var(--accent) / 0.05), hsl(var(--primary) / 0.05))
            `
          }}
        >
          {/* Advanced Energy Grid Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            <defs>
              <radialGradient id="lowerBracketGradient">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="1" />
                <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
              </radialGradient>
              <filter id="energyGlow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Dynamic Connections Between Rounds */}
            {rounds.map((round, roundIndex) => 
              roundIndex < rounds.length - 1 && (
                <g key={`lower-connections-${roundIndex}`}>
                  {round.matches.map((match, matchIndex) => {
                    const roundWidth = Math.max(280, (typeof window !== 'undefined' ? window.innerWidth - 100 : 1400) / rounds.length);
                    const startX = (roundIndex + 0.85) * roundWidth;
                    const endX = (roundIndex + 1.15) * roundWidth;
                    
                    // Calculate Y positions with wave pattern
                    const currentRoundCenter = 350;
                    const startY = currentRoundCenter + (matchIndex - round.matches.length / 2) * 120;
                    
                    const nextRound = rounds[roundIndex + 1];
                    const nextRoundCenter = 350;
                    const targetMatchIndex = Math.floor(matchIndex / 2);
                    const endY = nextRoundCenter + (targetMatchIndex - nextRound.matches.length / 2) * 120;
                    
                    // Create smooth flowing connections
                    const controlPoint1X = startX + (endX - startX) * 0.3;
                    const controlPoint2X = startX + (endX - startX) * 0.7;
                    
                    return (
                      <path
                        key={`lower-connection-${roundIndex}-${matchIndex}`}
                        d={`M ${startX} ${startY} C ${controlPoint1X} ${startY} ${controlPoint2X} ${endY} ${endX} ${endY}`}
                        stroke="url(#lowerBracketGradient)"
                        strokeWidth="2.5"
                        fill="none"
                        filter="url(#energyGlow)"
                        className="transition-all duration-500 hover:stroke-[4]"
                        opacity="0.8"
                        style={{
                          animation: `energyFlow 2s ease-in-out infinite alternate`
                        }}
                      />
                    );
                  })}
                </g>
              )
            )}
          </svg>

          {/* Rounds with Responsive Spacing - No Round Headers */}
          {rounds.map((round, roundIndex) => {
            const roundWidth = Math.max(280, (typeof window !== 'undefined' ? window.innerWidth - 100 : 1400) / rounds.length);
            
            return (
              <div 
                key={round.id} 
                className="relative flex flex-col justify-center"
                style={{ 
                  width: `${roundWidth}px`,
                  zIndex: 10 
                }}
              >
                {/* Matches with Wave Formation */}
                <div className="flex flex-col items-center justify-center min-h-[600px] gap-4">
                  {round.matches.length === 0 ? (
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-muted/30 to-transparent blur-sm rounded-xl"></div>
                      <div className="relative p-8 rounded-xl border-2 border-dashed border-muted/40 bg-gradient-to-br from-muted/10 to-transparent backdrop-blur-sm">
                        <div className="text-center">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center border border-muted/30">
                            <div className="w-2 h-2 bg-muted/50 rounded-full animate-ping"></div>
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">Awaiting combatants</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">No matches in round {roundIndex + 1}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    round.matches.map((match, matchIndex) => {
                      const matchCode = getMatchCode(bracket, match);
                      const teamADesc = getTeamDescription(bracket, match, true, allBrackets);
                      const teamBDesc = getTeamDescription(bracket, match, false, allBrackets);
                      
                      // Wave positioning for visual flow
                      const waveOffset = Math.sin((matchIndex / round.matches.length) * Math.PI * 2) * 30;
                      const depthEffect = (matchIndex % 2) * 15;
                      
                      return (
                        <div
                          key={match.id}
                          className="relative group"
                          style={{ 
                            transform: `translateX(${waveOffset}px) translateZ(${depthEffect}px)`,
                            perspective: '1000px'
                          }}
                        >
                          {/* Energy Field Around Match */}
                          <div className="absolute inset-0 pointer-events-none">
                            <div 
                              className="absolute inset-0 rounded-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                              style={{
                                background: `conic-gradient(from ${matchIndex * 60}deg, hsl(var(--destructive) / 0.3), transparent, hsl(var(--accent) / 0.3), transparent)`,
                                animation: `rotate 6s linear infinite`
                              }}
                            />
                          </div>
                          
                          <MatchCard
                            match={match}
                            showDetails={showDetails}
                            matchCode={matchCode}
                            teamADescription={teamADesc}
                            teamBDescription={teamBDesc}
                          />
                          
                          {/* Flow Indicators */}
                          {roundIndex < rounds.length - 1 && (
                            <div className="absolute -right-6 top-1/2 transform -translate-y-1/2">
                              <div className="flex flex-col items-center gap-1">
                                {[...Array(3)].map((_, i) => (
                                  <div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-gradient-to-r from-destructive to-accent shadow-lg"
                                    style={{
                                      animation: `flowPulse ${1 + i * 0.2}s ease-in-out infinite`,
                                      animationDelay: `${i * 0.1}s`
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom CSS for Lower Bracket Animations */}
      <style jsx>{`
        @keyframes energyFlow {
          0% { opacity: 0.6; stroke-dasharray: 0, 20; }
          100% { opacity: 1; stroke-dasharray: 20, 0; }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes flowPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

const PlayoffBracketDisplay: React.FC<{ bracketData: PlayoffData }> = ({ bracketData }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [highlightPath, setHighlightPath] = useState(false);
  const [viewMode, setViewMode] = useState<'default' | 'compact' | 'detailed'>('default');
  const [autoRefresh, setAutoRefresh] = useState(false);

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
    let maxRound = 0;

    bracket.matches.forEach(match => {
      // Coerce round to number (defensive)
      let roundNum = typeof match.round === 'number' ? match.round : Number(match.round);
      if (Number.isNaN(roundNum) || roundNum <= 0) {
        // Log malformed rounds for debugging and skip grouping by bad round
        if (typeof window !== 'undefined') console.warn(`Playoff: match ${match.id} has invalid round:`, match.round);
        return;
      }
      roundNum = Math.floor(roundNum);
      maxRound = Math.max(maxRound, roundNum);

      if (!roundsMap.has(roundNum)) roundsMap.set(roundNum, []);
      roundsMap.get(roundNum)!.push(match);
    });

    // Ensure we return every round from 1..maxRound so the UI keeps columns consistent
    const rounds: BracketRound[] = [];
    for (let r = 1; r <= Math.max(1, maxRound); r++) {
      const matches = (roundsMap.get(r) || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
      rounds.push({
        id: `${bracket.type}-round-${r}`,
        name: getRoundName(bracket.type, r),
        matches
      });
    }

    return rounds;
  };

  // getRoundName is declared earlier

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

      {/* Epic Tournament Header - Improved */}
      <div className="relative overflow-hidden rounded-3xl shadow-2xl">
        {/* Simplified background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(120,119,198,0.3),_transparent_50%)]"></div>
        
        {/* Content with better spacing */}
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4 lg:gap-6">
              {/* Simplified trophy icon */}
              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg">
                <Trophy className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>

              {/* Tournament info with better typography */}
              <div className="space-y-2">
                <h1 className="text-2xl lg:text-4xl font-bold text-white tracking-tight">
                  {bracketData.name}
                </h1>
                
                {/* Cleaner stats display */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-200">
                    {totalMatches} matches
                  </div>
                  <div className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-200">
                    {completedMatches} completed
                  </div>
                  {liveMatches > 0 && (
                    <div className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-200 animate-pulse">
                      {liveMatches} live
                    </div>
                  )}
                </div>

                {/* Simplified subtitle */}
                <p className="text-slate-300 text-sm lg:text-base">
                  Tournament Brackets & Results
                </p>
              </div>
            </div>
            
            {/* Simplified control panel */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="default"
                onClick={() => setShowDetails(!showDetails)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all"
              >
                <div className="flex items-center gap-2">
                  {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showDetails ? 'Simple' : 'Details'}
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>

        {/* Debug information - hidden by default, can be toggled */}
      {showDetails && (
        <Card className="bg-muted/5 border-border/20 mt-4">
          <CardContent className="p-4">
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                🔧 Debug Information
              </summary>
              <div className="mt-2 text-xs text-muted-foreground space-y-2">
                <div>
                  <strong>Brackets:</strong> {bracketData.brackets.length} total
                </div>
                <div>
                  <strong>Total Matches:</strong> {totalMatches}
                </div>
                <div>
                  <strong>Completed:</strong> {completedMatches}/{totalMatches}
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Improved Search & Filter Controls */}
      <Card className="bg-card/95 backdrop-blur-sm shadow-lg">
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Enhanced search */}
            <div className="flex-1 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search teams, matches, or codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-background/50 border-2 border-border/50 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            {/* Improved filter buttons */}
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              {[
                { key: 'all', label: 'All', icon: Filter },
                { key: 'live', label: 'Live', icon: Play },
                { key: 'completed', label: 'Done', icon: CheckCircle },
                { key: 'scheduled', label: 'Pending', icon: Clock }
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={statusFilter === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "h-11 px-4 font-medium transition-all",
                    statusFilter === key
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-background/50 hover:bg-background border-border/50 hover:border-primary/50"
                  )}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Champions' Arena - Upper Bracket */}
      {upperBracket && (
        <div className="relative rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-blue-950/20 to-purple-950/30 backdrop-blur-sm min-h-[800px]">
          {/* Upper Bracket - Elite Energy Field */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_emerald-400_0%,_transparent_50%)] opacity-15"></div>
          <div className="absolute inset-0 bg-[linear-gradient(135deg,_transparent_40%,_emerald-500_50%,_transparent_60%)] opacity-10"></div>
          
          {/* Elegant upper bracket frame */}
          <div className="absolute inset-0 border border-emerald-400/30 rounded-3xl shadow-[inset_0_0_40px_8px_rgba(16,185,129,0.15)]"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-70"></div>
          
          <div className="relative z-10 p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-emerald-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                Champions' Arena
              </h2>
              <div className="mx-auto w-32 h-1 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full opacity-80"></div>
            </div>
            
            {/* Upper bracket content with no scrolling */}
            <div className="w-full min-h-[600px]">
              <BracketTree
                title=""
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
            </div>
          </div>
        </div>
      )}

      {/* Proving Grounds - Wildcard */}
      {actualWildcardBracket && (
        <div className="relative rounded-3xl border-2 border-orange-500/40 bg-gradient-to-br from-orange-950/30 via-red-950/20 to-yellow-950/30 backdrop-blur-sm min-h-[600px]">
          {/* Wildcard - Forge Energy Field */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,_orange-400_0%,_transparent_50%)] opacity-15"></div>
          <div className="absolute inset-0 bg-[linear-gradient(45deg,_transparent_35%,_orange-500_50%,_transparent_65%)] opacity-10"></div>
          
          {/* Fiery wildcard frame */}
          <div className="absolute inset-0 border border-orange-400/30 rounded-3xl shadow-[inset_0_0_40px_8px_rgba(251,146,60,0.15)]"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-70"></div>
          
          <div className="relative z-10 p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-orange-300 via-red-300 to-yellow-300 bg-clip-text text-transparent">
                Proving Grounds
              </h2>
              <div className="mx-auto w-32 h-1 bg-gradient-to-r from-orange-400 to-red-400 rounded-full opacity-80"></div>
            </div>
            
            <div className="w-full min-h-[400px]">
              <BracketTree
                title=""
                rounds={wildcardRounds}
                showDetails={showDetails}
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                type="lower"
                allBrackets={allBrackets}
              />
            </div>
          </div>
        </div>
      )}

      {/* The Crucible - Lower Bracket */}
      {actualLowerBracket && actualLowerBracket.matches.length > 0 && (
        <div className="relative rounded-3xl border-2 border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 via-blue-950/20 to-indigo-950/30 backdrop-blur-sm min-h-[1000px]">
          {/* Lower Bracket - Crucible Energy Field (toned down) */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_cyan-400_0%,_transparent_50%)] opacity-12"></div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,_transparent_40%,_cyan-500_50%,_transparent_60%)] opacity-8"></div>
          
          {/* Refined crucible frame with subtle energy */}
          <div className="absolute inset-0 border border-cyan-400/30 rounded-3xl shadow-[inset_0_0_40px_8px_rgba(6,182,212,0.15)]"></div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 animate-pulse"></div>
          
          <div className="relative z-10 p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
                The Crucible
              </h2>
              <div className="mx-auto w-32 h-1 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full opacity-80"></div>
            </div>
            
            <div className="w-full min-h-[800px]">
              <LowerBracketVisualizer
                title=""
                bracket={actualLowerBracket}
                showDetails={showDetails}
                allBrackets={allBrackets}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayoffBracketDisplay;
