
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider as StyledThemeProvider, type DefaultTheme, createGlobalStyle } from 'styled-components';

import type { Team } from '@/lib/definitions';
import type {
  BracketData as InternalBracketData,
  TournamentMatch as InternalTournamentMatch,
  Participant as InternalParticipant,
  TeamId,
  WinnerSource,
  LoserSource,
  SeedSource,
  TBDSlotSource
} from '@/lib/tournament-bracket';
import { Loader2 } from 'lucide-react';

// Dynamically import core components from the library
const DoubleEliminationBracket = dynamic(() =>
  import('@g-loot/react-tournament-brackets').then(mod => mod.DoubleEliminationBracket), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading Bracket...</p></div>,
});

const GlootMatchComponent = dynamic(() =>
  import('@g-loot/react-tournament-brackets').then(mod => mod.Match), {
  ssr: false,
  loading: () => <div className="text-xs">Loading Match...</div>,
});

const miamiNeonTheme: DefaultTheme = {
  textColor: { main: 'hsl(var(--foreground))', highlighted: 'hsl(var(--primary-foreground))', dark: 'hsl(var(--muted-foreground))' },
  matchBackground: { wonColor: 'hsl(var(--card))', lostColor: 'hsl(var(--muted))', tbdColor: 'hsl(var(--popover))' },
  score: {
    textColor: { primary: 'hsl(var(--primary))', secondary: 'hsl(var(--accent))' },
    background: 'hsl(var(--popover))'
  },
  border: {
    color: 'hsl(var(--border))',
    highlightedColor: 'hsl(var(--primary))'
  },
  roundHeader: { // Singular, as per docs and common sense
    backgroundColor: 'hsl(var(--card))',
    fontColor: 'hsl(var(--card-foreground))'
  },
  // Add the plural version as a workaround for the library's internal access
  roundHeaders: { 
    backgroundColor: 'hsl(var(--card))',
    fontColor: 'hsl(var(--card-foreground))'
  },
  connectorColor: 'hsl(var(--border))',
  connectorColorHighlight: 'hsl(var(--primary))',
  svgBackground: 'hsl(var(--background))',
};

const GlobalStyle = createGlobalStyle`
  body, html {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  *, *::before, *::after {
    box-sizing: inherit;
  }
`;

interface GLootBracketDisplayProps {
  bracketData: InternalBracketData;
  teamsMapArray: [TeamId, Team][];
}

const PLACEHOLDER_DATE_ISO_STRING = '2000-01-01T00:00:00.000Z';

const GLOOT_MATCH_STATES = {
  PLAYED: 'PLAYED',
  NO_SHOW: 'NO_SHOW',
  WALK_OVER: 'WALK_OVER',
  NO_PARTY: 'NO_PARTY',
  DONE: 'DONE',
  SCORE_DONE: 'SCORE_DONE', // Added as per docs
  SCHEDULED: 'SCHEDULED',
};


const transformInternalMatchToGLootMatch = (
  internalMatch: InternalTournamentMatch,
  teamsMap: Map<TeamId, Team>,
): any /* BracketMatchProps from @g-loot/react-tournament-brackets */ => {

  const transformParticipant = (p: InternalParticipant | undefined | null, slot: string): any /* BracketParticipantProps */ => {
    if (!p || !p.source) {
        return { id: `tbd-nosource-${internalMatch.id}-${slot}`, name: 'TBD', isWinner: false, status: GLOOT_MATCH_STATES.NO_PARTY };
    }

    if (p.team) {
      const team = teamsMap.get(p.team.id);
      return {
        id: p.team.id.toString(),
        name: team?.name || 'Unknown Team',
        isWinner: !!p.isWinner,
        resultText: p.score?.toString() ?? (p.isWinner ? 'W' : (p.isWinner === false ? 'L' : undefined)),
        status: p.isWinner !== undefined ? GLOOT_MATCH_STATES.PLAYED : null,
      };
    }

    let name = 'TBD';
    let sourceIdBase = `tbd-source-${internalMatch.id}-${slot}`;

    if (p.source.type === 'winner' || p.source.type === 'loser') {
      name = `${p.source.type === 'winner' ? 'Winner' : 'Loser'} of ${ (p.source as WinnerSource | LoserSource).matchId}`;
      sourceIdBase = `${p.source.type}-${(p.source as WinnerSource | LoserSource).matchId}`;
    } else if (p.source.type === 'tbd') {
      name = (p.source as TBDSlotSource).description;
      sourceIdBase = `tbd-${(p.source as TBDSlotSource).description}`;
    } else if (p.source.type === 'seed') {
      const seededTeam = teamsMap.get((p.source as SeedSource).teamId);
      name = seededTeam?.name || 'TBD Seed';
      sourceIdBase = `seed-${(p.source as SeedSource).teamId}`;
      if (seededTeam) {
        return { id: seededTeam.id.toString(), name: seededTeam.name, isWinner: false, status: null };
      }
    }
    return { id: `${sourceIdBase}-${internalMatch.id}-${slot}`.replace(/\s+/g, '-'), name, isWinner: false, status: GLOOT_MATCH_STATES.NO_PARTY };
  };

  let matchStateGLoot: string = GLOOT_MATCH_STATES.SCHEDULED;
  if (internalMatch.status === 'completed') {
    matchStateGLoot = GLOOT_MATCH_STATES.DONE;
  }

  const pAIsEffectivelyTBD = !internalMatch.participantA.team && internalMatch.participantA.source?.type !== 'seed';
  const pBIsEffectivelyTBD = !internalMatch.participantB.team && internalMatch.participantB.source?.type !== 'seed';
  if (pAIsEffectivelyTBD && pBIsEffectivelyTBD && internalMatch.status !== 'completed') {
    matchStateGLoot = GLOOT_MATCH_STATES.NO_PARTY;
  }

  const transformedMatch = {
    id: internalMatch.id,
    name: internalMatch.name || `${internalMatch.roundName} - M${internalMatch.matchNumberInRound}`,
    nextMatchId: internalMatch.winnerGoesTo === 'champions' ? null : internalMatch.winnerGoesTo || null,
    nextLooserMatchId: (internalMatch.loserGoesTo === 'eliminated' || internalMatch.loserGoesTo === 'runner-up') ? null : internalMatch.loserGoesTo || null,
    tournamentRoundText: internalMatch.roundName.replace(/Upper Bracket |Lower Bracket |Grand Final /gi, '').replace(/Round /gi, 'R'),
    startTime: internalMatch.scheduledTime?.toISOString() || PLACEHOLDER_DATE_ISO_STRING,
    state: matchStateGLoot,
    participants: [
      transformParticipant(internalMatch.participantA, 'A'),
      transformParticipant(internalMatch.participantB, 'B'),
    ],
  };

  return transformedMatch;
};

const GLootBracketDisplay: React.FC<GLootBracketDisplayProps> = ({ bracketData, teamsMapArray }) => {
  const teamsMap = useMemo(() => new Map(teamsMapArray), [teamsMapArray]);

  const gLootMatchesData = useMemo(() => {
    if (!bracketData) return { upper: [], lower: [] };
    return {
      upper: bracketData.upperBracketMatches.map(match => transformInternalMatchToGLootMatch(match, teamsMap)),
      lower: bracketData.lowerBracketMatches.map(match => transformInternalMatchToGLootMatch(match, teamsMap)),
    };
  }, [bracketData, teamsMap]);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !DoubleEliminationBracket || !GlootMatchComponent) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg">Loading Bracket Components...</p></div>;
  }

  if (!gLootMatchesData || (!gLootMatchesData.upper.length && !gLootMatchesData.lower.length)) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No bracket data available or still loading...
      </div>
    );
  }

  return (
    <StyledThemeProvider theme={miamiNeonTheme}>
      <GlobalStyle />
      <div className="w-full flex-grow flex flex-col items-center bg-[hsl(var(--background))] p-4 overflow-auto">
          <DoubleEliminationBracket
            matches={gLootMatchesData}
            matchComponent={GlootMatchComponent}
            theme={miamiNeonTheme} // Library's specific theme prop
          />
      </div>
    </StyledThemeProvider>
  );
};

export default GLootBracketDisplay;
