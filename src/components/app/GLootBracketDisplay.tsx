'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DoubleEliminationBracket,
  Match,
  MATCH_STATES,
  SVGViewer,
  MatchProps as GLootMatchProps,
  ParticipantProps as GLootParticipantProps
} from '@g-loot/react-tournament-brackets';
import { ThemeProvider, DefaultTheme, createGlobalStyle } from 'styled-components';

import type { Team } from '@/lib/definitions';
import type { 
  BracketData, 
  TournamentMatch as InternalTournamentMatch, 
  Participant as InternalParticipant, 
  TeamId,
} from '@/lib/tournament-bracket';

const defaultTheme: DefaultTheme = {
  textColor: { main: '#E0E0E0', highlighted: '#FFFFFF', dark: '#8F8F8F' },
  matchBackground: { wonColor: '#2C3E50', lostColor: '#1A242F', tbdColor: '#24303C' },
  score: { textColor: { primary: '#E0E0E0', secondary: '#B0B0B0' }, background: '#24303C' },
  border: { color: '#4A5568', highlightedColor: '#718096' },
  roundHeader: { backgroundColor: '#24303C', fontColor: '#E0E0E0' },
  connectorColor: '#4A5568',
  connectorColorHighlight: '#718096',
  svgBackground: '#1A202C',
};

const GlobalStyle = createGlobalStyle`
  body, html {
    background-color: ${props => (props.theme as any).svgBackground || '#1A202C'}; 
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  *, *::before, *::after {
    box-sizing: inherit;
  }
`;

interface GLootBracketDisplayProps {
  bracketData: BracketData;
  teamsMapArray: [TeamId, Team][];
}

const PLACEHOLDER_DATE_ISO_STRING = '2000-01-01T00:00:00.000Z';

const transformInternalMatchToGLootMatch = (
  internalMatch: InternalTournamentMatch,
  teamsMap: Map<TeamId, Team>,
  isManuallyDefinedGrandFinal: boolean = false
): GLootMatchProps => {

  const transformParticipant = (p: InternalParticipant | undefined | null, slot: string): GLootParticipantProps => {
    if (!p) return { id: `tbd-${internalMatch.id}-${slot}`, name: 'TBD', isWinner: false, status: MATCH_STATES.NO_PARTY };
    if (p.team) {
      const team = teamsMap.get(p.team.id);
      return {
        id: p.team.id.toString(),
        name: team?.name || 'Unknown Team',
        isWinner: !!p.isWinner,
        resultText: p.score?.toString() ?? undefined,
        status: p.isWinner !== undefined ? MATCH_STATES.PLAYED : null, 
      };
    }
    if (p.source) {
      let name = 'TBD';
      if (p.source.type === 'winner' || p.source.type === 'loser') {
        name = `${p.source.type === 'winner' ? 'Winner' : 'Loser'} of ${p.source.matchId}`;
      } else if (p.source.type === 'tbd') {
        name = p.source.description;
      } else if (p.source.type === 'seed') {
        const seededTeam = teamsMap.get(p.source.teamId);
        name = seededTeam?.name || 'TBD Seed';
        if (!p.team && seededTeam) {
             return { id: seededTeam.id.toString(), name: seededTeam.name, isWinner: false, status: null };
        }
        if (!p.team && !seededTeam) {
            return { id: `seed-tbd-${p.source.teamId}-${slot}`, name: 'TBD Seed', isWinner: false, status: MATCH_STATES.NO_PARTY };
        }
      }
      const sourceIdBase = p.source.type === 'seed' ? p.source.teamId : p.source.type + '-' + ( (p.source as any).matchId || (p.source as any).description || 'nosource') ;
      return { id: `${sourceIdBase}-${internalMatch.id}-${slot}`.replace(/\s+/g, '-'), name, isWinner: false, status: null };
    }
    return { id: `tbd-unknown-${internalMatch.id}-${slot}`, name: 'TBD', isWinner: false, status: MATCH_STATES.NO_PARTY };
  };

  let matchState: GLootMatchProps['state'] = MATCH_STATES.NO_PARTY; 
  if (internalMatch.status === 'completed') matchState = MATCH_STATES.DONE; 
  else if (internalMatch.status === 'pending' || internalMatch.status === 'in_progress') matchState = 'SCHEDULED'; 
  
  if(internalMatch.status === 'completed') matchState = MATCH_STATES.DONE;
  else matchState = 'SCHEDULED'; 

  const pAIsEffectivelyTBD = !internalMatch.participantA.team && internalMatch.participantA.source?.type !== 'seed';
  const pBIsEffectivelyTBD = !internalMatch.participantB.team && internalMatch.participantB.source?.type !== 'seed';
  if (pAIsEffectivelyTBD && pBIsEffectivelyTBD && internalMatch.status !== 'completed') {
    matchState = MATCH_STATES.NO_PARTY; 
  }

  const transformedMatch: GLootMatchProps = {
    id: internalMatch.id,
    name: internalMatch.name || `${internalMatch.roundName} - M${internalMatch.matchNumberInRound}`,
    nextMatchId: internalMatch.winnerGoesTo === 'champions' ? null : internalMatch.winnerGoesTo || null,
    nextLooserMatchId: internalMatch.loserGoesTo === 'eliminated' || internalMatch.loserGoesTo === 'runner-up' ? null : internalMatch.loserGoesTo || null,
    tournamentRoundText: internalMatch.roundName.replace(/Upper Bracket |Lower Bracket |Grand Final /gi, '').replace(/Round /gi, 'R'),
    startTime: internalMatch.scheduledTime?.toISOString() || PLACEHOLDER_DATE_ISO_STRING,
    state: matchState,
    participants: [
      transformParticipant(internalMatch.participantA, 'A'),
      transformParticipant(internalMatch.participantB, 'B'),
    ],
  };

  if (isManuallyDefinedGrandFinal) {
    transformedMatch.grandFinalsType = 'upper';
  }

  return transformedMatch;
};

const GLootBracketDisplay: React.FC<GLootBracketDisplayProps> = ({ bracketData, teamsMapArray }) => {
  const teamsMap = React.useMemo(() => new Map(teamsMapArray), [teamsMapArray]);

  const upperBracketGLootMatches = React.useMemo(() => {
    if (!bracketData?.upperBracketMatches) return [];
    const ubMatches = bracketData.upperBracketMatches.map(match => transformInternalMatchToGLootMatch(match, teamsMap, false));
    const gfMatches = bracketData.grandFinalsMatches.map(match => transformInternalMatchToGLootMatch(match, teamsMap, true));
    return [...ubMatches, ...gfMatches];
  }, [bracketData, teamsMap]);

  const lowerBracketGLootMatches = React.useMemo(() => {
    if (!bracketData?.lowerBracketMatches) return [];
    return bracketData.lowerBracketMatches.map(match => transformInternalMatchToGLootMatch(match, teamsMap, false));
  }, [bracketData, teamsMap]);

  const [svgWidth, setSvgWidth] = useState(950); 
  const [svgHeight, setSvgHeight] = useState(800);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) { 
      const calculateSize = () => {
        // Use the dimensions of the immediate parent of SVGViewer if possible,
        // or fallback to window size. For this, we'd need a ref to the parent div.
        // For now, keep window-based, ensure parent div allows expansion.
        const newWidth = Math.max(window.innerWidth - 40, 500); // Adjusted padding slightly
        const newHeight = Math.max(window.innerHeight - 120, 700); // Adjusted padding and min height
        setSvgWidth(newWidth);
        setSvgHeight(newHeight);
      };
      calculateSize();
      window.addEventListener('resize', calculateSize);
      return () => window.removeEventListener('resize', calculateSize);
    }
  }, [isClient]);

  // Commented out logs for cleaner console, can be re-enabled for debugging
  // if (typeof window !== 'undefined') {
  //   console.log("Transformed Upper (with GF) Bracket Matches for Library:", JSON.stringify(upperBracketGLootMatches, null, 2));
  //   console.log("Transformed Lower Bracket Matches for Library:", JSON.stringify(lowerBracketGLootMatches, null, 2));
  // }

  if (upperBracketGLootMatches.length === 0 && lowerBracketGLootMatches.length === 0) {
    return (
      <div className="p-4 text-center text-neutral-400">
        Loading bracket data or no matches to display...
      </div>
    );
  }

  return (
    <ThemeProvider theme={defaultTheme}>
      <GlobalStyle />
      {/* These outer divs ensure proper page layout and scrolling for the bracket viewer */}
      <div className="p-2 md:p-4 bg-neutral-900 text-neutral-100 min-h-screen font-sans flex flex-col items-center">
        <h1 
          className="text-3xl md:text-4xl font-extrabold mt-4 mb-6 md:mb-10 text-center text-amber-400 uppercase tracking-wider"
          style={{ textShadow: '0 0 4px #FACC15, 0 0 8px #FACC15' }}
        >
          Tournament Playoffs
        </h1>
        {/* This div will constrain the SVGViewer and allow it to be centered if narrower than screen */}
        {/* SVGViewer itself will handle overflow of the actual bracket SVG via pan/zoom */}
        <div style={{ width: '100%', maxWidth: `${svgWidth}px`, flexGrow: 1 }}> 
          <DoubleEliminationBracket
            matches={{
              upper: upperBracketGLootMatches,
              lower: lowerBracketGLootMatches,
            }}
            matchComponent={Match} 
            svgWrapper={({ children, ...props }) => (
              <SVGViewer 
                width={svgWidth} 
                height={svgHeight} 
                SVGBackground={defaultTheme.svgBackground} 
                {...props}
              >
                {children}
              </SVGViewer>
            )}
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default GLootBracketDisplay;
