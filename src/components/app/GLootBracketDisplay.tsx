
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  // DoubleEliminationBracket, // Will be dynamically imported
  // Match, // Will be dynamically imported
  MATCH_STATES,
  // SVGViewer, // Will be dynamically imported
  type MatchProps as GLootMatchProps,
  type ParticipantProps as GLootParticipantProps
} from '@g-loot/react-tournament-brackets';
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
} from '@/lib/tournament-bracket'; // Using InternalBracketData
import { Loader2 } from 'lucide-react';

const DoubleEliminationBracket = dynamic(() =>
  import('@g-loot/react-tournament-brackets').then(mod => mod.DoubleEliminationBracket), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading Bracket...</p></div>,
});

const GlootMatch = dynamic(() =>
  import('@g-loot/react-tournament-brackets').then(mod => mod.Match), {
  ssr: false,
  loading: () => <div className="text-xs">Loading Match...</div>,
});

const SVGViewer = dynamic(() =>
  import('@g-loot/react-tournament-brackets').then(mod => mod.SVGViewer), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading Viewer...</p></div>,
});


// Theme definition (can be customized)
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
  roundHeader: { 
    backgroundColor: 'hsl(var(--card))', 
    fontColor: 'hsl(var(--card-foreground))' 
  },
  connectorColor: 'hsl(var(--border))',
  connectorColorHighlight: 'hsl(var(--primary))',
  svgBackground: 'hsl(var(--background))', // Use app's background
};

const GlobalStyle = createGlobalStyle`
  body, html {
    background-color: ${props => (props.theme as any).svgBackground || 'hsl(var(--background))'}; 
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  *, *::before, *::after {
    box-sizing: inherit;
  }
`;

interface GLootBracketDisplayProps {
  bracketData: InternalBracketData; // Takes internal data structure
  teamsMapArray: [TeamId, Team][];
}

const PLACEHOLDER_DATE_ISO_STRING = '2000-01-01T00:00:00.000Z'; // For matches without a set time

const transformInternalMatchToGLootMatch = (
  internalMatch: InternalTournamentMatch,
  teamsMap: Map<TeamId, Team>,
): GLootMatchProps => {
  
  const transformParticipant = (p: InternalParticipant | undefined | null, slot: string): GLootParticipantProps => {
    if (!p || !p.source) { // Guard against undefined participant or source
        return { id: `tbd-nosource-${internalMatch.id}-${slot}`, name: 'TBD', isWinner: false, status: MATCH_STATES.NO_PARTY as any };
    }

    if (p.team) {
      const team = teamsMap.get(p.team.id);
      return {
        id: p.team.id.toString(),
        name: team?.name || 'Unknown Team',
        isWinner: !!p.isWinner,
        resultText: p.score?.toString() ?? (p.isWinner ? 'W' : undefined),
        status: p.isWinner !== undefined ? MATCH_STATES.PLAYED as any : null, 
      };
    }
    // If p.team is not defined, means it's a TBD slot based on p.source
    let name = 'TBD';
    let sourceIdBase = `tbd-source-${internalMatch.id}-${slot}`;

    if (p.source.type === 'winner' || p.source.type === 'loser') {
      name = `${p.source.type === 'winner' ? 'Winner' : 'Loser'} of ${ (p.source as WinnerSource | LoserSource).matchId}`;
      sourceIdBase = `${p.source.type}-${(p.source as WinnerSource | LoserSource).matchId}`;
    } else if (p.source.type === 'tbd') {
      name = (p.source as TBDSlotSource).description;
      sourceIdBase = `tbd-${(p.source as TBDSlotSource).description}`;
    } else if (p.source.type === 'seed') { // This case should ideally be covered by p.team being present
      const seededTeam = teamsMap.get((p.source as SeedSource).teamId);
      name = seededTeam?.name || 'TBD Seed';
      sourceIdBase = `seed-${(p.source as SeedSource).teamId}`;
      if (seededTeam) { // If seeded team is known, treat as if p.team was directly populated
        return { id: seededTeam.id.toString(), name: seededTeam.name, isWinner: false, status: null };
      }
    }
    return { id: `${sourceIdBase}-${internalMatch.id}-${slot}`.replace(/\s+/g, '-'), name, isWinner: false, status: MATCH_STATES.NO_PARTY as any };
  };

  let matchStateGLoot: GLootMatchProps['state'] = MATCH_STATES.SCHEDULED as any;
  if (internalMatch.status === 'completed') {
    matchStateGLoot = MATCH_STATES.DONE as any;
  } else if (internalMatch.status === 'pending' || internalMatch.status === 'in_progress') {
    matchStateGLoot = MATCH_STATES.SCHEDULED as any;
  }
  
  // If both participants are effectively TBD and match isn't completed, mark as NO_PARTY
  const pAIsEffectivelyTBD = !internalMatch.participantA.team && internalMatch.participantA.source?.type !== 'seed';
  const pBIsEffectivelyTBD = !internalMatch.participantB.team && internalMatch.participantB.source?.type !== 'seed';
  if (pAIsEffectivelyTBD && pBIsEffectivelyTBD && internalMatch.status !== 'completed') {
    matchStateGLoot = MATCH_STATES.NO_PARTY as any; 
  }


  const transformedMatch: GLootMatchProps = {
    id: internalMatch.id,
    name: internalMatch.name || `${internalMatch.roundName} - M${internalMatch.matchNumberInRound}`,
    nextMatchId: internalMatch.winnerGoesTo === 'champions' ? null : internalMatch.winnerGoesTo || null,
    nextLooserMatchId: (internalMatch.loserGoesTo === 'eliminated' || internalMatch.loserGoesTo === 'runner-up') ? null : internalMatch.loserGoesTo || null,
    tournamentRoundText: internalMatch.roundName.replace(/Upper Bracket |Lower Bracket |Grand Final /gi, '').replace(/Round /gi, 'R'), // Shorten round names for display
    startTime: internalMatch.scheduledTime?.toISOString() || PLACEHOLDER_DATE_ISO_STRING,
    state: matchStateGLoot,
    participants: [
      transformParticipant(internalMatch.participantA, 'A'),
      transformParticipant(internalMatch.participantB, 'B'),
    ],
  };
  
  // For the Grand Final, if it's the last match in the upper bracket array and has special linking for double finals
  if (internalMatch.id === 'GF-M1' && internalMatch.winnerGoesTo === 'champions' && internalMatch.loserGoesTo === 'runner-up') {
    // This indicates it's the true final. For @g-loot, a standard double elim ends with one final match.
    // If a bracket reset scenario was needed, the Grand Final itself would have a nextMatchId.
    // For simplicity, we are not modeling a bracket reset here.
  }


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

  const [viewerWidth, setViewerWidth] = useState(950); 
  const [viewerHeight, setViewerHeight] = useState(800);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const calculateSize = () => {
      const newWidth = Math.max(window.innerWidth * 0.9, 500); 
      const newHeight = Math.max(window.innerHeight * 0.8, 600); 
      setViewerWidth(newWidth);
      setViewerHeight(newHeight);
    };
    calculateSize();
    window.addEventListener('resize', calculateSize);
    return () => window.removeEventListener('resize', calculateSize);
  }, []);
  
  if (!isClient || !DoubleEliminationBracket || !GlootMatch || !SVGViewer) {
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
      <div className="w-full flex-grow flex flex-col items-center bg-[hsl(var(--background))]">
        <SVGViewer 
          width={viewerWidth} 
          height={viewerHeight} 
          SVGBackground={miamiNeonTheme.svgBackground}
          // Optional: initial position and scale
          // initialScale={0.8}
          // initialPan={{ x: 50, y: 50 }}
        >
          <DoubleEliminationBracket
            matches={gLootMatchesData}
            matchComponent={GlootMatch} 
            theme={miamiNeonTheme}
          />
        </SVGViewer>
      </div>
    </StyledThemeProvider>
  );
};

export default GLootBracketDisplay;
