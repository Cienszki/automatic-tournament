// src/app/playoffs-test-v2/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { PlayoffData, PlayoffMatch } from '@/lib/definitions';

type TournamentGame = {
  id: string;
  name: string;
  bracketLabel?: string;
  scheduled: number;
  sides: {
    home: {
      team?: {
        id: string;
        name: string;
      };
      score?: {
        score: number;
      };
      seed?: {
        displayName: string;
        rank: number;
        sourceGame?: TournamentGame;
      };
    };
    visitor: {
      team?: {
        id: string;
        name: string;
      };
      score?: {
        score: number;
      };
      seed?: {
        displayName: string;
        rank: number;
        sourceGame?: TournamentGame;
      };
    };
  };
};

export default function PlayoffsTestV2Page() {
  const [playoffData, setPlayoffData] = useState<PlayoffData | null>(null);
  const [bracketGame, setBracketGame] = useState<TournamentGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [BracketComponent, setBracketComponent] = useState<any>(null);

  useEffect(() => {
    const loadBracketLibrary = async () => {
      try {
        if (typeof window !== 'undefined') {
          const lib = require('react-tournament-bracket');
          console.log('Library loaded:', lib);
          console.log('Bracket component:', lib.Bracket);
          setBracketComponent(() => lib.Bracket);
        }
      } catch (error) {
        console.error('Failed to load bracket library:', error);
      }
    };

    loadBracketLibrary();
  }, []);

  useEffect(() => {
    const fetchPlayoffData = async () => {
      try {
        // Fetch the test playoff data
        const response = await fetch('/test-playoff-data.json');
        if (!response.ok) {
          throw new Error('Failed to fetch playoff data');
        }
        const data: PlayoffData = await response.json();
        setPlayoffData(data);
        
        // Convert to bracket game structure
        const convertedGame = convertToBracketGame(data);
        setBracketGame(convertedGame);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayoffData();
  }, []);

  const convertToBracketGame = (data: PlayoffData): TournamentGame | null => {
    const upperBracket = data.brackets.find(b => b.type === 'upper');
    if (!upperBracket) {
      console.log('No upper bracket found');
      return null;
    }

    console.log('Upper bracket matches:', upperBracket.matches.length);

    // Find the final match (highest round)
    const finalMatch = upperBracket.matches.reduce((final, match) => 
      match.round > final.round ? match : final
    );

    console.log('Final match:', finalMatch);

    // Build the game structure
    const buildGameStructure = (match: PlayoffMatch): TournamentGame => {
      const game: TournamentGame = {
        id: match.id,
        name: match.id || 'Unknown Match',
        scheduled: match.scheduledFor ? new Date(match.scheduledFor).getTime() : Date.now(),
        sides: {
          home: {
            team: match.teamA ? {
              id: match.teamA.id,
              name: match.teamA.name
            } : undefined,
            score: match.result ? {
              score: match.result.teamAScore
            } : undefined,
            seed: !match.teamA ? {
              displayName: 'TBD',
              rank: 1
            } : undefined
          },
          visitor: {
            team: match.teamB ? {
              id: match.teamB.id,
              name: match.teamB.name
            } : undefined,
            score: match.result ? {
              score: match.result.teamBScore
            } : undefined,
            seed: !match.teamB ? {
              displayName: 'TBD',
              rank: 2
            } : undefined
          }
        },
        bracketLabel: `Round ${match.round}`
      };

      console.log('Built game structure:', game);
      return game;
    };

    return buildGameStructure(finalMatch);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading playoff bracket...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Playoff Bracket (Test V2)
          </h1>
          <p className="text-gray-400">
            Using react-tournament-bracket library (fixed imports)
          </p>
        </header>

        <div className="bg-gray-800 rounded-lg p-6 overflow-x-auto">
          {bracketGame && BracketComponent ? (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
              <div className="text-black mb-4 text-sm">
                Debug: Game ID = {bracketGame?.id}, Component loaded = {!!BracketComponent}
              </div>
              {(() => {
                try {
                  return (
                    <BracketComponent 
                      game={bracketGame}
                      homeOnTop={true}
                      gameDimensions={{ height: 80, width: 200 }}
                      svgPadding={20}
                    />
                  );
                } catch (error) {
                  console.error('Bracket rendering error:', error);
                  return (
                    <div className="text-red-600 p-4">
                      Error rendering bracket: {error instanceof Error ? error.message : 'Unknown error'}
                    </div>
                  );
                }
              })()}
            </div>
          ) : (
            <div className="text-white text-center py-8">
              {!BracketComponent ? 'Loading bracket library...' : 'No bracket data available'}
              <div className="text-sm text-gray-400 mt-2">
                BracketComponent: {!!BracketComponent ? 'Loaded' : 'Not loaded'}
                <br />
                bracketGame: {!!bracketGame ? `ID: ${bracketGame.id}` : 'Not created'}
              </div>
            </div>
          )}
        </div>

        {playoffData && bracketGame && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Debug Info</h2>
            <div className="text-gray-300 space-y-2">
              <div>Total Brackets: {playoffData.brackets.length}</div>
              <div>Upper Bracket Matches: {playoffData.brackets.find(b => b.type === 'upper')?.matches.length || 0}</div>
              <div>Lower Bracket Matches: {playoffData.brackets.find(b => b.type === 'lower')?.matches.length || 0}</div>
              <div>Final Game ID: {bracketGame.id}</div>
              <div>Library Loaded: {BracketComponent ? 'Yes' : 'No'}</div>
            </div>
            <pre className="text-xs text-gray-400 mt-4 overflow-auto max-h-32">
              {JSON.stringify(bracketGame, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
