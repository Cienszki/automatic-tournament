'use client';

import React from 'react';
import { Bracket, RoundProps, MatchProps, SeedTeam, SeedItem } from 'react-brackets'; // Re-added SeedItem
import type { BracketData, TournamentMatch, ParticipantSource, TeamId, SeedSource, WinnerSource, LoserSource, TBDSlotSource } from '@/lib/tournament-bracket';
import type { Team } from '@/lib/definitions';

interface PlayoffBracketDisplayProps {
  bracketData: BracketData;
  teamsMapArray: [TeamId, Team][]; 
}

const PlayoffBracketDisplay: React.FC<PlayoffBracketDisplayProps> = ({ bracketData, teamsMapArray }) => {
  const teamsMap = React.useMemo(() => new Map(teamsMapArray), [teamsMapArray]);

  const { upperBracketMatches, lowerBracketMatches, grandFinalsMatches } = bracketData;

  const transformMatches = (matches: TournamentMatch[]): MatchProps[] => {
    return matches.map((match) => {
      const participantToSeedTeam = (participant: any, isCompleted: boolean, matchId: string, participantLabel: 'A' | 'B'): SeedTeam => {
        const teamDetails = participant.team;
        let name = 'TBD';
        let baseId = `${matchId}-${participantLabel}`;

        if (teamDetails) {
          name = teamDetails.name;
          baseId = teamDetails.id;
        } else if (participant.source) {
          if (participant.source.type === 'seed') {
            const seededTeam = teamsMap.get((participant.source as SeedSource).teamId);
            name = seededTeam?.name || 'TBD Seed';
            baseId = (participant.source as SeedSource).teamId;
          } else if (participant.source.type === 'tbd') {
            name = (participant.source as TBDSlotSource).description;
            baseId = `tbd-${matchId}-${participantLabel}`;
          } else {
            name = `From ${ (participant.source as WinnerSource | LoserSource).matchId }`;
            baseId = `${(participant.source as WinnerSource | LoserSource).type}:${(participant.source as WinnerSource | LoserSource).matchId}`;
          }
        }
        return {
          id: baseId,
          name: name,
          score: participant.score?.toString(), 
          isWinner: isCompleted ? participant.isWinner : undefined,
        };
      };
      const isCompleted = match.status === 'completed';
      return {
        id: match.id, name: `${match.roundName} - M${match.matchNumberInRound}`,
        nextMatchId: typeof match.winnerGoesTo === 'string' && !['champions', 'runner-up', 'eliminated'].includes(match.winnerGoesTo) ? match.winnerGoesTo : null,
        tournamentRoundText: match.roundName, 
        startTime: match.scheduledTime ? match.scheduledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'TBD',
        state: match.status === 'completed' ? 'DONE' : (match.status === 'in_progress' ? 'RUNNING' : 'SCHEDULED'),
        teams: [ 
          participantToSeedTeam(match.participantA, isCompleted, match.id, 'A'), 
          participantToSeedTeam(match.participantB, isCompleted, match.id, 'B') 
        ],
      } as MatchProps;
    });
  };

  const groupMatchesToRounds = (matchesToGroup: TournamentMatch[], transformFn: (m: TournamentMatch[]) => MatchProps[]): RoundProps[] => {
    const roundsOutput: RoundProps[] = [];
    if (!matchesToGroup || matchesToGroup.length === 0) return roundsOutput;
    const roundNameOrder: string[] = [];
    const matchesByRoundName: { [key: string]: TournamentMatch[] } = {};
    matchesToGroup.forEach(match => {
      if (!matchesByRoundName[match.roundName]) {
        matchesByRoundName[match.roundName] = [];
        roundNameOrder.push(match.roundName);
      }
      matchesByRoundName[match.roundName].push(match);
    });
    roundNameOrder.forEach(roundName => {
      roundsOutput.push({ title: roundName, seeds: transformFn(matchesByRoundName[roundName]) });
    });
    return roundsOutput;
  };

  // Combine Upper Bracket and Grand Final matches for the first section
  const winnerBracketAndFinalMatches = [...upperBracketMatches, ...grandFinalsMatches];
  const winnerBracketAndFinalRounds = groupMatchesToRounds(winnerBracketAndFinalMatches, transformMatches);
  
  const lowerBracketRounds = groupMatchesToRounds(lowerBracketMatches, transformMatches);
  
  const renderBracketSection = (title: string, roundsData: RoundProps[]) => {
    if (roundsData.length === 0) return null;
    return (
      <section className="mb-8 p-1">
        <h2 className="text-xl font-bold mb-4 text-center text-amber-400 tracking-wider uppercase">{title}</h2>
        <Bracket 
          rounds={roundsData} 
          mobileBreakpoint={768}
          renderSeedComponent={({seed, breakpoint}) => { 
            // Extremely simple and fixed-size seed rendering
            return (
              <SeedItem 
                mobileBreakpoint={breakpoint} 
                style={{ 
                  width: '140px', // Fixed width
                  height: '50px',  // Fixed height
                  margin: '15px 5px', // Vertical margin for spacing, horizontal for between seeds
                  padding: '2px',
                  border: '1px solid #FACC15', // amber-400
                  backgroundColor: '#262626', // neutral-800
                  color: '#e5e5e5', // neutral-200
                  fontSize: '0.65rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '3px',
                  boxSizing: 'border-box' // Important for consistent sizing
                }}
              >
                <div style={{textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{seed.teams[0]?.name || 'TBD'}</div>
                <div style={{margin: '1px 0', fontSize: '0.55rem', color: '#a3a3a3'}}>vs</div>
                <div style={{textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{seed.teams[1]?.name || 'TBD'}</div>
              </SeedItem>
            );
          }}
          rtl={false} 
          roundTitleComponent={(roundTitle: React.ReactNode) => {
            const simplifiedTitle = roundTitle?.toString().replace('Upper Bracket', 'UB').replace('Lower Bracket', 'LB').replace('Semifinals', 'Semis').replace('Round ', 'R');
            return <div className="text-xs font-semibold mb-1 mt-3 text-center text-neutral-400 tracking-wide uppercase">{simplifiedTitle}</div>;
          }}
          lineProps={{ stroke: '#FACC15', strokeWidth: 1.5, fill: 'transparent'}} 
          itemKey="id"
        />
      </section>
    );
  }

  return (
    <div className="overflow-x-auto p-2 md:p-4 bg-neutral-900 text-neutral-100 min-h-screen font-sans">
      <div className="inline-block min-w-full"> 
        <h1 className="text-3xl md:text-4xl font-extrabold mb-6 md:mb-10 text-center text-amber-400 uppercase tracking-wider" style={{ textShadow: '0 0 4px #FACC15, 0 0 8px #FACC15' }}>Tournament Playoffs</h1>
        
        {renderBracketSection("Winner's Bracket & Grand Final", winnerBracketAndFinalRounds)}
        {renderBracketSection("Loser's Bracket", lowerBracketRounds)}
        {/* Grand Final section is now removed as it's part of the Winner's bracket section */}
      </div>
    </div>
  );
};

export default PlayoffBracketDisplay;
