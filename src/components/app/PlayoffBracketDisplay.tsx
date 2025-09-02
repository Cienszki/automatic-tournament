"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlayoffData, PlayoffBracket, PlayoffMatch } from '@/lib/definitions';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  Trophy, 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  Eye, 
  EyeOff,
  AlertTriangle,
  Play
} from 'lucide-react';

// Component interfaces
interface MatchCardProps {
  match: PlayoffMatch;
  matchCode?: string;
  teamADescription?: string;
  teamBDescription?: string;
  teamsMap?: Map<string, any>;
  allBrackets?: PlayoffBracket[];
}

interface BracketTreeProps {
  title: string;
  rounds: BracketRound[];
  type: 'upper' | 'lower' | 'final' | 'wildcard';
  allBrackets?: PlayoffBracket[];
  t: (key: string) => string;
  teamsMap?: Map<string, any>;
}

interface BracketRound {
  id: string;
  name: string;
  matches: PlayoffMatch[];
  dateRange?: string;
}

// Mapping from user-friendly match codes to database match IDs
const getMatchIdFromCode = (matchCode: string): string | null => {
  const mappings: { [key: string]: string } = {
    // Wildcard matches
    'WCA': 'wc-m1',
    'WCB': 'wc-m2',
    // Upper bracket matches
    'U1A': 'ub-r1-m1',
    'U1B': 'ub-r1-m2', 
    'U1C': 'ub-r1-m3',
    'U1D': 'ub-r1-m4',
    'U2A': 'ub-r2-m1',
    'U2B': 'ub-r2-m2',
    'U3A': 'ub-final',
    // Lower bracket matches
    'L1A': 'lb-r1-m1',
    'L1B': 'lb-r1-m2',
    'L1C': 'lb-r1-m3',
    'L1D': 'lb-r1-m4',
    'L2A': 'lb-r2-m1',
    'L2B': 'lb-r2-m2',
    'L2C': 'lb-r2-m3',
    'L2D': 'lb-r2-m4',
    'L3A': 'lb-r3-m1',
    'L3B': 'lb-r3-m2',
    'L4A': 'lb-r4-m1',
    'L4B': 'lb-r4-m2',
    'L5A': 'lb-r5-m1',
    'L6A': 'lb-final'
  };
  return mappings[matchCode] || null;
};

// Helper functions to resolve team names and progression
const resolveTeamFromMatch = (matchId: string, allBrackets: PlayoffBracket[], isWinner: boolean, teamsMap?: Map<string, any>): string | null => {
  for (const bracket of allBrackets) {
    const match = bracket.matches.find(m => m.id === matchId);
    if (match && match.result) {
      const winnerId = match.result.winnerId;
      const loserId = winnerId === match.teamA?.id ? match.teamB?.id : match.teamA?.id;
      const targetTeamId = isWinner ? winnerId : loserId;
      
      if (targetTeamId && teamsMap?.has(targetTeamId)) {
        return teamsMap.get(targetTeamId)?.name || null;
      }
      return targetTeamId ? `Team ${targetTeamId}` : null;
    }
  }
  return null;
};

const getTeamDisplayName = (teamId: string | null, description?: string, teamsMap?: Map<string, any>): string => {
  if (teamId && teamsMap?.has(teamId)) {
    const team = teamsMap.get(teamId);
    return team?.name || `Team ${teamId}`;
  }
  if (teamId) return `Team ${teamId}`;
  if (description) return description;
  return 'TBD';
};

const getResolvedTeamName = (
  match: PlayoffMatch, 
  isTeamA: boolean, 
  description: string, 
  allBrackets: PlayoffBracket[],
  teamsMap?: Map<string, any>
): string => {
  const team = isTeamA ? match.teamA : match.teamB;
  
  // If we have the actual team data, use it
  if (team?.name) return team.name;
  if (team?.id && teamsMap?.has(team.id)) {
    return teamsMap.get(team.id)?.name || `Team ${team.id}`;
  }
  
  // Try to resolve from match progression descriptions
  const winnerPattern = /Winner of (U\d+[A-Z]|L\d+[A-Z]|WC[A-Z])/i;
  const loserPattern = /Loser of (U\d+[A-Z]|L\d+[A-Z])/i;
  const matchWinnerPattern = /meczu (U\d+[A-Z]|L\d+[A-Z])/i;
  const wildcardPattern = /(WC[A-Z])\b/i; // Match WCA or WCB anywhere in the text
  
  let matchResult = description.match(winnerPattern);
  if (matchResult) {
    const matchCode = matchResult[1];
    const matchId = getMatchIdFromCode(matchCode);
    if (matchId) {
      const resolvedName = resolveTeamFromMatch(matchId, allBrackets, true, teamsMap);
      if (resolvedName) return resolvedName;
    }
  }
  
  matchResult = description.match(loserPattern);
  if (matchResult) {
    const matchCode = matchResult[1];
    const matchId = getMatchIdFromCode(matchCode);
    if (matchId) {
      const resolvedName = resolveTeamFromMatch(matchId, allBrackets, false, teamsMap);
      if (resolvedName) return resolvedName;
    }
  }
  
  // Handle "Zwycięzca meczu U1A" pattern
  matchResult = description.match(matchWinnerPattern);
  if (matchResult) {
    const matchCode = matchResult[1];
    const matchId = getMatchIdFromCode(matchCode);
    if (matchId) {
      const resolvedName = resolveTeamFromMatch(matchId, allBrackets, true, teamsMap);
      if (resolvedName) return resolvedName;
    }
  }
  
  // Handle wildcard patterns - match WCA or WCB anywhere in the text
  matchResult = description.match(wildcardPattern);
  if (matchResult) {
    const matchCode = matchResult[1];
    const matchId = getMatchIdFromCode(matchCode);
    if (matchId) {
      const resolvedName = resolveTeamFromMatch(matchId, allBrackets, true, teamsMap);
      if (resolvedName) return resolvedName;
    }
  }
  
  return description;
};

const getMatchCode = (bracket: PlayoffBracket, match: PlayoffMatch): string => {
  if (bracket.type === 'final') return 'GF';
  // Wildcard matches should be WCA, WCB
  if (bracket.type === 'wildcard') {
    const pos = (match.position || 1) - 1; // Convert to 0-based index
    return `WC${String.fromCharCode(65 + pos)}`; // WCA, WCB
  }
  if (bracket.type === 'upper') {
    const pos = (match.position || 1) - 1; // Convert to 0-based index
    return `U${match.round}${String.fromCharCode(65 + pos)}`;
  }
  if (bracket.type === 'lower') {
    const pos = (match.position || 1) - 1; // Convert to 0-based index
    return `L${match.round}${String.fromCharCode(65 + pos)}`;
  }
  return `${match.round}${match.position || ''}`;
};

const getTeamDescription = (bracket: PlayoffBracket, match: PlayoffMatch, isTeamA: boolean, allBrackets: PlayoffBracket[], t: (key: string) => string): string => {
  if (bracket.type === 'wildcard') {
    // WCA: A3 vs B3
    // WCB: C3 vs D3  
    if (match.position === 1) { // WCA
      return isTeamA ? `${t('playoffs.groupThird')} ${t('playoffs.groupA')}` : `${t('playoffs.groupThird')} ${t('playoffs.groupB')}`;
    } else { // WCB
      return isTeamA ? `${t('playoffs.groupThird')} ${t('playoffs.groupC')}` : `${t('playoffs.groupThird')} ${t('playoffs.groupD')}`;
    }
  }
  
  if (bracket.type === 'upper') {
    if (match.round === 1) {
      const matchPos = match.position || 1;
      if (matchPos === 1) { // U1A: A1 vs F2
        return isTeamA ? `${t('playoffs.groupWinner')} ${t('playoffs.groupA')}` : `${t('playoffs.groupSecond')} ${t('playoffs.groupF')}`;
      } else if (matchPos === 2) { // U1B: D1 vs E1
        return isTeamA ? `${t('playoffs.groupWinner')} ${t('playoffs.groupD')}` : `${t('playoffs.groupWinner')} ${t('playoffs.groupE')}`;
      } else if (matchPos === 3) { // U1C: B1 vs E2
        return isTeamA ? `${t('playoffs.groupWinner')} ${t('playoffs.groupB')}` : `${t('playoffs.groupSecond')} ${t('playoffs.groupE')}`;
      } else if (matchPos === 4) { // U1D: C1 vs F1
        return isTeamA ? `${t('playoffs.groupWinner')} ${t('playoffs.groupC')}` : `${t('playoffs.groupWinner')} ${t('playoffs.groupF')}`;
      }
    } else if (match.round === 2) {
      // U2A: Winner of U1A vs Winner of U1B
      // U2B: Winner of U1C vs Winner of U1D
      const matchPos = match.position || 1;
      let teamAMatch = '', teamBMatch = '';
      if (matchPos === 1) {
        teamAMatch = 'U1A';
        teamBMatch = 'U1B';
      } else if (matchPos === 2) {
        teamAMatch = 'U1C';
        teamBMatch = 'U1D';
      } else {
        teamAMatch = 'U1?';
        teamBMatch = 'U1?';
      }
      return isTeamA ? `${t('playoffs.matchWinner')} ${teamAMatch}` : `${t('playoffs.matchWinner')} ${teamBMatch}`;
    } else {
      // Upper Final: Winner of U2A vs Winner of U2B
      const matchPos = match.position || 1;
      let teamAMatch = '', teamBMatch = '';
      if (matchPos === 1) {
        teamAMatch = 'U2A';
        teamBMatch = 'U2B';
      } else {
        teamAMatch = 'U2?';
        teamBMatch = 'U2?';
      }
      return isTeamA ? `${t('playoffs.matchWinner')} ${teamAMatch}` : `${t('playoffs.matchWinner')} ${teamBMatch}`;
    }
  }
  
  if (bracket.type === 'lower') {
    if (match.round === 1) {
      const matchPos = match.position || 1;
      if (matchPos === 1) { // L1A: F3 vs Winner of WCA
        return isTeamA ? `${t('playoffs.groupThird')} ${t('playoffs.groupF')}` : `${t('playoffs.wildcardWinner')} WCA`;
      } else if (matchPos === 2) { // L1B: C2 vs D2
        return isTeamA ? `${t('playoffs.groupSecond')} ${t('playoffs.groupC')}` : `${t('playoffs.groupSecond')} ${t('playoffs.groupD')}`;
      } else if (matchPos === 3) { // L1C: Winner of WCB vs A2
        return isTeamA ? `${t('playoffs.wildcardWinner')} WCB` : `${t('playoffs.groupSecond')} ${t('playoffs.groupA')}`;
      } else if (matchPos === 4) { // L1D: B2 vs E3
        return isTeamA ? `${t('playoffs.groupSecond')} ${t('playoffs.groupB')}` : `${t('playoffs.groupThird')} ${t('playoffs.groupE')}`;
      }
    } else if (match.round === 2) {
      const matchPos = match.position || 1;
      if (isTeamA) {
        // Team A is always the winner from L1
        const l1MatchCode = `L1${String.fromCharCode(64 + matchPos)}`;
        return `${t('playoffs.matchWinner')} ${l1MatchCode}`;
      } else {
        // Team B is the loser from U1
        const u1MatchCode = `U1${String.fromCharCode(64 + matchPos)}`;
        return `${t('playoffs.matchLoser')} ${u1MatchCode}`;
      }
    } else if (match.round === 3) {
      // L3A and L3B
      const matchPos = match.position || 1;
      const l2MatchOffset = (matchPos - 1) * 2 + 1;
      if (isTeamA) {
        const l2MatchCode = `L2${String.fromCharCode(64 + l2MatchOffset)}`;
        return `${t('playoffs.matchWinner')} ${l2MatchCode}`;
      } else {
        const l2MatchCode = `L2${String.fromCharCode(64 + l2MatchOffset + 1)}`;
        return `${t('playoffs.matchWinner')} ${l2MatchCode}`;
      }
    } else if (match.round === 4) {
      // L4A and L4B
      const matchPos = match.position || 1;
      if (isTeamA) {
        const l3MatchCode = `L3${String.fromCharCode(64 + matchPos)}`;
        return `${t('playoffs.matchWinner')} ${l3MatchCode}`;
      } else {
        // Loser from U2
        const u2MatchCode = `U2${String.fromCharCode(64 + matchPos)}`;
        return `${t('playoffs.matchLoser')} ${u2MatchCode}`;
      }
    } else if (match.round === 5) {
      // L5A
      if (isTeamA) {
        return `${t('playoffs.matchWinner')} L4A`;
      } else {
        return `${t('playoffs.matchWinner')} L4B`;
      }
    } else if (match.round === 6) {
      // Lower Bracket Final
      if (isTeamA) {
        return `${t('playoffs.matchWinner')} L5A`;
      } else {
        return `${t('playoffs.matchLoser')} U3A`; // Upper bracket final loser
      }
    }
  }
  
  if (bracket.type === 'final') {
    // Wielki finał: Team A = zwycięzca U3A, Team B = zwycięzca L6A
    return isTeamA
      ? `${t('playoffs.matchWinner')} U3A`
      : `${t('playoffs.matchWinner')} L6A`;
  }
  
  return t('playoffs.toBeDetermined');
};

function createRounds(bracket: PlayoffBracket | undefined, t?: (key: string) => string): BracketRound[] {
  if (!bracket) return [];

  const roundsMap = new Map<number, PlayoffMatch[]>();
  let maxRound = 0;

  bracket.matches.forEach(match => {
    let roundNum = typeof match.round === 'number' ? match.round : Number(match.round);
    if (Number.isNaN(roundNum) || roundNum <= 0) return;
    roundNum = Math.floor(roundNum);
    maxRound = Math.max(maxRound, roundNum);

    if (!roundsMap.has(roundNum)) roundsMap.set(roundNum, []);
    roundsMap.get(roundNum)!.push(match);
  });

  const rounds: BracketRound[] = [];
  for (let r = 1; r <= Math.max(1, maxRound); r++) {
    const matches = (roundsMap.get(r) || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    // Do not show any round label for wildcard rounds
    let name = '';
    let dateRange = '';
    
    if (bracket.type === 'wildcard') {
      dateRange = '01.09 - 03.09';
    } else if (bracket.type === 'final') {
      name = t ? t('playoffs.grandFinal') : 'Wielki Finał';
      dateRange = '05.10';
    } else if (bracket.type === 'upper') {
      // Upper bracket: Round 1 -> "Runda 1", Round 2 -> "Runda 2", Round 3 -> "Runda 4"
      const displayRound = r === 3 ? 4 : r;
      name = t ? `${t('playoffs.round')} ${displayRound}` : `Runda ${displayRound}`;
      if (r === 1) dateRange = '04.09 - 10.09';
      else if (r === 2) dateRange = '15.09 - 20.09';
      else if (r === 3) dateRange = '26.09 - 30.09'; // This is actually round 4
    } else if (bracket.type === 'lower') {
      name = t ? `${t('playoffs.round')} ${r}` : `Runda ${r}`;
      if (r === 1) dateRange = '04.09 - 10.09';
      else if (r === 2) dateRange = '15.09 - 20.09';
      else if (r === 3) dateRange = '21.09 - 25.09';
      else if (r === 4) dateRange = '26.09 - 30.09';
      else if (r === 5) dateRange = '01.10 - 03.10';
      else if (r === 6) {
        name = 'Finał Dolnej Drabinki';
        dateRange = '04.10';
      }
    }
    
    rounds.push({ 
      id: `${bracket.type}-round-${r}`, 
      name, 
      matches,
      dateRange 
    } as BracketRound & { dateRange?: string });
  }

  return rounds;
}

const MatchCard: React.FC<MatchCardProps> = ({ 
  match, 
  matchCode,
  teamADescription,
  teamBDescription,
  teamsMap,
  allBrackets = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [liveResult, setLiveResult] = useState<any>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Try multiple resolution strategies for team names
  let teamAName = match.teamA?.name;
  let teamBName = match.teamB?.name;
  
  if (!teamAName) {
    teamAName = getResolvedTeamName(match, true, teamADescription || 'TBD', allBrackets, teamsMap);
  }
  
  if (!teamBName) {
    teamBName = getResolvedTeamName(match, false, teamBDescription || 'TBD', allBrackets, teamsMap);
  }

  useEffect(() => {
    let ignore = false;
    async function fetchResult() {
      setLoading(true);
      try {
        const docRef = doc(db, 'matches', match.id);
        const docSnap = await getDoc(docRef);
        if (!ignore && docSnap.exists()) {
          const data = docSnap.data();
          setLiveResult(data.result || null);
          setLiveStatus(data.status || null);
        } else if (!ignore) {
          setLiveResult(null);
          setLiveStatus(null);
        }
      } catch (e) {
        if (!ignore) {
          setLiveResult(null);
          setLiveStatus(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchResult();
    return () => { ignore = true; };
  }, [match.id]);

  const scoreA = liveResult?.teamAScore ?? null;
  const scoreB = liveResult?.teamBScore ?? null;
  const winnerId = liveResult?.winnerId ?? null;
  const isCompleted = liveStatus === 'completed';

  return (
    <Card 
      className={cn(
        "relative transition-all duration-300 border cursor-pointer w-full max-w-[300px] group",
        "transform hover:scale-105 hover:-translate-y-1 hover:rotate-0.5",
        "shadow-lg hover:shadow-2xl backdrop-blur-sm",
        "bg-gradient-to-br from-card via-card/95 to-background/90",
        "border-border/40 hover:border-primary/60",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-transparent before:via-primary/5 before:to-transparent before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 before:rounded-lg",
        isCompleted && "border-primary/40 shadow-primary/20 ring-1 ring-primary/30",
        isExpanded && "scale-110 z-50 rotate-1"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Enhanced neon depth shadow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-lg transform translate-x-0.5 translate-y-0.5 -z-10 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-300" />
      
      {/* Neon glowing border effect */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 via-accent/15 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardContent className="p-4 space-y-3">
        {/* Match header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {matchCode && (
              <Badge 
                variant="secondary" 
                className="text-xs font-medium px-2 py-1 bg-primary/20 text-primary border border-primary/30"
              >
                {matchCode}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs px-2 py-1 bg-accent/10 text-accent border-accent/30">
              {/* All lower bracket matches and wildcard matches are BO3 */}
              {(() => {
                // Check if this is a lower bracket match (matchCode starts with 'L')
                if (matchCode?.startsWith('L')) return 'BO3';
                // Check if this is a wildcard match (matchCode starts with 'WC')
                if (matchCode?.startsWith('WC')) return 'BO3';
                return match.format?.toUpperCase() || 'BO1';
              })()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isCompleted && match.result && (
              <Badge variant="secondary" className="text-xs bg-secondary/20 text-secondary border border-secondary/30">
                {match.result.teamAScore}-{match.result.teamBScore}
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
                ? "bg-primary/10 border border-primary/30 font-semibold text-primary" 
                : "bg-muted/30 hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                winnerId === match.teamA?.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                  : "bg-muted-foreground/30 text-muted-foreground"
              )}>
                A
              </div>
              <span className="truncate text-sm">
                {teamAName}
              </span>
            </div>
            {isCompleted && scoreA !== null && (
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
                ? "bg-primary/10 border border-primary/30 font-semibold text-primary" 
                : "bg-muted/30 hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                winnerId === match.teamB?.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                  : "bg-muted-foreground/30 text-muted-foreground"
              )}>
                B
              </div>
              <span className="truncate text-sm">
                {teamBName}
              </span>
            </div>
            {isCompleted && scoreB !== null && (
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
      </CardContent>
    </Card>
  );
};

const BracketTree: React.FC<BracketTreeProps> = ({ 
  title, 
  rounds, 
  type,
  allBrackets = [],
  t,
  teamsMap
}) => {
  // No filtering, just use rounds as-is
  if (!rounds || rounds.length === 0) {
    return null;
  }
  const maxMatchesInRound = Math.max(...rounds.map(r => r.matches.length));
  const containerHeight = Math.max(600, maxMatchesInRound * 200 + 100);
  
  return (
    <div className="w-full" style={{ minHeight: `${containerHeight}px` }}>
      {/* Bracket Grid - Symmetric Tournament Tree Layout */}
      <div className="grid gap-8 w-full h-full" style={{ 
        gridTemplateColumns: `repeat(${rounds.length}, 1fr)`,
        minHeight: `${containerHeight}px`
      }}>
        {rounds.map((round, roundIndex) => {
          const isLastRound = roundIndex === rounds.length - 1;
          
          return (
            <div 
              key={round.id}
              className="relative flex flex-col items-center justify-center"
              style={{ minHeight: `${containerHeight - 100}px` }}
            >
              {/* Round Header */}
              <div className="text-center mb-6 z-10">
                {(round.name || round.dateRange) && (
                  <>
                    {round.name && (
                      <h3 className="text-lg lg:text-xl font-bold text-white mb-2">
                        {type === 'final' ? t('playoffs.grandFinal') : round.name}
                      </h3>
                    )}
                    {round.dateRange && (
                      <p className="text-sm text-muted-foreground mb-3 font-medium opacity-80">
                        {round.dateRange}
                      </p>
                    )}
                    <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent rounded-full mx-auto opacity-80"></div>
                  </>
                )}
              </div>

              {/* Matches Column - Properly Spaced */}
              <div className="flex flex-col justify-center items-center gap-8 flex-1 w-full max-w-[320px]">
                {round.matches.map((match, matchIndex) => {
                  const matchCode = round.id === 'grand-final' ? 'GF' : getMatchCode({ type, matches: round.matches } as PlayoffBracket, match);
                  // Check if this is the grand final match within upper bracket
                  const isGrandFinal = round.id === 'grand-final';
                  const bracketTypeForDescription = isGrandFinal ? 'final' : type;
                  const teamADescription = getTeamDescription({ type: bracketTypeForDescription, matches: round.matches } as PlayoffBracket, match, true, allBrackets, t);
                  const teamBDescription = getTeamDescription({ type: bracketTypeForDescription, matches: round.matches } as PlayoffBracket, match, false, allBrackets, t);

                  return (
                    <div key={`${match.teamA?.id || 'teamA'}-${match.teamB?.id || 'teamB'}-${matchIndex}`} className="relative w-full">
                      <MatchCard
                        match={match}
                        matchCode={matchCode}
                        teamADescription={teamADescription}
                        teamBDescription={teamBDescription}
                        teamsMap={teamsMap}
                        allBrackets={allBrackets}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Tournament Tree Connection Lines */}
              {!isLastRound && (
                <svg 
                  className="absolute top-1/2 -right-4 transform -translate-y-1/2 z-20 w-8 h-8"
                  viewBox="0 0 32 32"
                  fill="none"
                >
                  <defs>
                    <linearGradient id={`connection-${type}-${roundIndex}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.6"/>
                      <stop offset="50%" stopColor="currentColor" stopOpacity="1"/>
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.6"/>
                    </linearGradient>
                  </defs>
                  
                  {/* Main connection line */}
                  <line
                    x1="0"
                    y1="16"
                    x2="24"
                    y2="16"
                    stroke={`url(#connection-${type}-${roundIndex})`}
                    strokeWidth="2"
                    className="text-primary opacity-80"
                  />
                  
                  {/* Arrow head */}
                  <polygon
                    points="24,12 32,16 24,20"
                    fill="currentColor"
                    className="text-primary opacity-80"
                  />
                  
                  {/* Pulsating energy dot */}
                  <circle
                    cx="16"
                    cy="16"
                    r="2"
                    fill="currentColor"
                    className="text-accent animate-pulse"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Simple Lower Bracket Visualizer
const LowerBracketVisualizer: React.FC<{
  title: string;
  bracket: PlayoffBracket;
  allBrackets?: PlayoffBracket[];
  t: (key: string) => string;
  teamsMap?: Map<string, any>;
}> = ({ title, bracket, allBrackets = [], t, teamsMap }) => {
  const rounds = createRounds(bracket, t);

  return (
    <BracketTree
      title={title}
      rounds={rounds}
      type="lower"
      allBrackets={allBrackets}
      t={t}
      teamsMap={teamsMap}
    />
  );
};

const PlayoffBracketDisplay: React.FC<{ bracketData: PlayoffData }> = ({ bracketData }) => {
  const { t } = useTranslation();
  const [teamsMap, setTeamsMap] = useState<Map<string, any>>(new Map());
  const [resolvedBracketData, setResolvedBracketData] = useState<PlayoffData | null>(null);
  
  // Function to resolve slots to actual team objects
  const resolveSlots = (playoffData: PlayoffData, teamsMap: Map<string, any>): PlayoffData => {
    const resolvedBrackets = playoffData.brackets.map(bracket => {
      // Create a slot lookup map for this bracket
      const slotMap = new Map();
      if (bracket.slots) {
        bracket.slots.forEach(slot => {
          if (slot.teamId && teamsMap.has(slot.teamId)) {
            const team = teamsMap.get(slot.teamId);
            slotMap.set(slot.id, { id: team.id, name: team.name, logoUrl: team.logoUrl || '' });
          }
        });
      }
      
      // Resolve matches by looking up teams from slots
      const resolvedMatches = bracket.matches.map(match => {
        const teamA = slotMap.get(match.teamASlotId) || null;
        const teamB = slotMap.get(match.teamBSlotId) || null;
        
        return {
          ...match,
          teamA,
          teamB
        };
      });
      
      return {
        ...bracket,
        matches: resolvedMatches
      };
    });
    
    return {
      ...playoffData,
      brackets: resolvedBrackets
    };
  };
  
  // Load team data and resolve slots
  useEffect(() => {
    const loadTeamsAndResolve = async () => {
      try {
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const newTeamsMap = new Map();
        teamsSnapshot.forEach(doc => {
          const teamData = { id: doc.id, ...doc.data() };
          newTeamsMap.set(doc.id, teamData);
        });
        setTeamsMap(newTeamsMap);
        
        // Resolve slots to teams in bracket data
        if (bracketData) {
          const resolved = resolveSlots(bracketData, newTeamsMap);
          setResolvedBracketData(resolved);
        }
      } catch (error) {
        console.error('Failed to load teams:', error);
      }
    };
    loadTeamsAndResolve();
  }, [bracketData]);

  // Use resolved bracket data if available, otherwise use original
  const displayData = resolvedBracketData || bracketData;
  
  if (!displayData || !Array.isArray(displayData.brackets) || displayData.brackets.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-card via-card/80 to-muted border-border/20">
        <CardContent className="text-center py-12">
          <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('playoffs.noBracket')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('playoffs.notSetupYet')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Organize brackets
  const upperBracket = displayData.brackets.find(b => b.type === 'upper');
  const lowerBracket = displayData.brackets.find(b => b.type === 'lower');
  const wildcardBracket = displayData.brackets.find(b => b.type === 'wildcard');
  const finalBracket = displayData.brackets.find(b => b.type === 'final');

  const allBrackets = displayData.brackets;
  const allMatches = allBrackets.flatMap(b => b.matches);
  const totalMatches = allMatches.length;
  const completedMatches = allMatches.filter(m => m.status === 'completed').length;

  const upperRounds = createRounds(upperBracket);
  const lowerRounds = createRounds(lowerBracket);  
  const wildcardRounds = createRounds(wildcardBracket);

  return (
    <div className="space-y-8 relative min-h-screen bg-gradient-to-br from-background via-background/98 to-muted/30">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,59,234,0.3)_0%,_transparent_70%)]"></div>
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,_transparent_0deg,_rgba(255,59,234,0.1)_60deg,_transparent_120deg)]"></div>
      </div>
      {/* Modern Hero Section with Animated Background, no dimming, on-brand style */}
      <div className="w-full">
        <div className="relative w-full h-[280px] md:h-[360px] 2k:h-[480px] flex items-center justify-center overflow-hidden mb-8 rounded-2xl shadow-2xl group">
          <div className="absolute inset-0 z-0 bg-cover bg-center scale-105 transition-transform duration-1000 group-hover:scale-110" style={{ backgroundImage: `url(/backgrounds/playoffs.png)` }} />
          
          {/* Modern floating orbs with better colors */}
          <div className="absolute top-8 left-8 w-32 h-32 bg-gradient-to-br from-primary/40 to-accent/30 rounded-full blur-2xl opacity-80 animate-pulse-slow" />
          <div className="absolute bottom-8 right-16 w-48 h-48 bg-gradient-to-br from-accent/30 to-secondary/30 rounded-full blur-3xl opacity-70 animate-pulse-slower" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-gradient-to-br from-chart-3/15 to-chart-4/15 rounded-full blur-3xl opacity-50 animate-pulse-slowest -translate-x-1/2 -translate-y-1/2" />
          
          {/* Subtle gradient overlay for readability */}
          
       
            
            
            <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 animate-fade-in-up delay-400">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              
            </div>
          </div>
        </div>

            {/* Sekcje drabinki */}
            {upperBracket && (
              <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-card/80 via-background/60 to-card/70 backdrop-blur-md min-h-[800px] shadow-2xl shadow-primary/10 hover:shadow-primary/20 transition-all duration-700 group overflow-hidden">
                {/* Modern background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(255,59,234,0.3)_0%,_transparent_50%)]"></div>
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,_transparent_40%,_rgba(255,59,234,0.2)_50%,_transparent_60%)]"></div>
                </div>
                
                {/* Enhanced border effects */}
                <div className="absolute inset-0 border border-primary/30 rounded-2xl shadow-[inset_0_0_40px_8px_rgba(255,59,234,0.15)]"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="relative z-10 p-8">
                  <div className="text-center mb-8">
                    <div className="relative inline-block">
                      <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-300">
                        {t('playoffs.upperBracket')}
                      </h2>
                      <div className="absolute inset-0 text-3xl md:text-4xl font-bold text-primary/10 blur-sm transform scale-110 group-hover:scale-115 transition-transform duration-300 -z-10">
                        {t('playoffs.upperBracket')}
                      </div>
                    </div>
                    <div className="mx-auto w-24 h-1 bg-gradient-to-r from-primary to-accent rounded-full opacity-80 group-hover:w-40 group-hover:opacity-100 transition-all duration-500 shadow-lg shadow-primary/50"></div>
                  </div>
                  <div className="w-full min-h-[600px]">
                    <BracketTree
                      title=""
                      rounds={[ 
                        ...upperRounds,
                        ...(finalBracket ? [{
                          id: 'grand-final',
                          name: t('playoffs.grandFinal'),
                          matches: finalBracket.matches,
                          dateRange: '05.10'
                        }] : [])
                      ]}
                      allBrackets={allBrackets}
                      type="upper"
                      t={t}
                      teamsMap={teamsMap}
                    />
                  </div>
                </div>
              </div>
            )}

            {lowerBracket && lowerBracket.matches.length > 0 && (
              <div className="relative rounded-2xl border border-accent/30 bg-gradient-to-br from-card/80 via-background/60 to-card/70 backdrop-blur-md min-h-[1000px] shadow-2xl shadow-accent/10 hover:shadow-accent/20 transition-all duration-700 group overflow-hidden">
                {/* Modern background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,154,0,0.3)_0%,_transparent_50%)]"></div>
                  <div className="absolute inset-0 bg-[linear-gradient(225deg,_transparent_40%,_rgba(255,154,0,0.2)_50%,_transparent_60%)]"></div>
                </div>
                
                {/* Enhanced border effects */}
                <div className="absolute inset-0 border border-accent/30 rounded-2xl shadow-[inset_0_0_40px_8px_rgba(255,154,0,0.15)]"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="relative z-10 p-8">
                  <div className="text-center mb-8">
                    <div className="relative inline-block">
                      <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-accent via-secondary to-chart-5 bg-clip-text text-transparent drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-300">
                        {t('playoffs.lowerBracket')}
                      </h2>
                      <div className="absolute inset-0 text-3xl md:text-4xl font-bold text-accent/10 blur-sm transform scale-110 group-hover:scale-115 transition-transform duration-300 -z-10">
                        {t('playoffs.lowerBracket')}
                      </div>
                    </div>
                    <div className="mx-auto w-24 h-1 bg-gradient-to-r from-accent to-secondary rounded-full opacity-80 group-hover:w-40 group-hover:opacity-100 transition-all duration-500 shadow-lg shadow-accent/50"></div>
                  </div>
                  <div className="w-full min-h-[800px]">
                    <LowerBracketVisualizer
                      title=""
                      bracket={lowerBracket}
                      allBrackets={allBrackets}
                      t={t}
                      teamsMap={teamsMap}
                    />
                  </div>
                </div>
              </div>
            )}

            {wildcardBracket && (
              <div className="relative rounded-2xl border border-chart-3/30 bg-gradient-to-br from-card/80 via-background/60 to-card/70 backdrop-blur-md min-h-[600px] shadow-2xl shadow-chart-3/10 hover:shadow-chart-3/20 transition-all duration-700 group overflow-hidden">
                {/* Modern background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,_rgba(34,197,94,0.3)_0%,_transparent_50%)]"></div>
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,_transparent_40%,_rgba(34,197,94,0.2)_50%,_transparent_60%)]"></div>
                </div>
                {/* Enhanced border effects */}
                <div className="absolute inset-0 border border-chart-3/30 rounded-2xl shadow-[inset_0_0_40px_8px_rgba(34,197,94,0.15)]"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-chart-3 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10 p-8">
                  <div className="text-center mb-8">
                    <div className="relative inline-block">
                      <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-chart-3 via-chart-4 to-primary bg-clip-text text-transparent drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-300">
                        {t('playoffs.wildcardMatches')}
                      </h2>
                      <div className="absolute inset-0 text-3xl md:text-4xl font-bold text-chart-3/10 blur-sm transform scale-110 group-hover:scale-115 transition-transform duration-300 -z-10">
                        {t('playoffs.wildcardMatches')}
                      </div>
                    </div>
                    <div className="mx-auto w-24 h-1 bg-gradient-to-r from-chart-3 to-chart-4 rounded-full opacity-80 group-hover:w-40 group-hover:opacity-100 transition-all duration-500 shadow-lg shadow-chart-3/50"></div>
                  </div>
                  <div className="w-full min-h-[400px]">
                    <BracketTree
                      title=""
                      rounds={wildcardRounds}
                      allBrackets={allBrackets}
                      type="wildcard"
                      t={t}
                      teamsMap={teamsMap}
                    />
                  </div>
                </div>
              </div>
            )}
    </div>
  );
};

export default PlayoffBracketDisplay;
