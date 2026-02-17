// src/app/playoffs-test/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { PlayoffData, PlayoffMatch } from '@/lib/definitions';

export default function PlayoffsTestPage() {
  const [playoffData, setPlayoffData] = useState<PlayoffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayoffData();
  }, []);

  const getTeamName = (match: PlayoffMatch, side: 'A' | 'B'): string => {
    const team = side === 'A' ? match.teamA : match.teamB;
    if (team) {
      return team.name;
    }
    return 'TBD';
  };

  const getScore = (match: PlayoffMatch, side: 'A' | 'B'): number | undefined => {
    if (match.result) {
      return side === 'A' ? match.result.teamAScore : match.result.teamBScore;
    }
    return undefined;
  };

  const renderSimpleBracket = () => {
    if (!playoffData) return null;

    const upperBracket = playoffData.brackets.find(b => b.type === 'upper');
    if (!upperBracket) return null;

    // Group matches by round
    const matchesByRound: { [round: number]: PlayoffMatch[] } = {};
    upperBracket.matches.forEach(match => {
      if (!matchesByRound[match.round]) {
        matchesByRound[match.round] = [];
      }
      matchesByRound[match.round].push(match);
    });

    const rounds = Object.keys(matchesByRound)
      .sort((a, b) => Number(a) - Number(b))
      .map(roundKey => ({
        round: Number(roundKey),
        matches: matchesByRound[Number(roundKey)].sort((a, b) => a.position - b.position)
      }));

    return (
      <div className="flex gap-8 items-start overflow-x-auto p-4">
        {rounds.map(({ round, matches }) => (
          <div key={round} className="flex flex-col gap-4 min-w-[250px]">
            <h3 className="text-white font-bold text-center mb-4">
              Round {round}
            </h3>
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-gray-700 rounded-lg p-4 border border-gray-600"
              >
                <div className="text-gray-400 text-sm mb-2 text-center">
                  {match.id}
                </div>
                
                <div className="space-y-2">
                  {/* Team A */}
                  <div className="flex justify-between items-center bg-gray-600 rounded p-2">
                    <span className="text-white truncate">
                      {getTeamName(match, 'A')}
                    </span>
                    {getScore(match, 'A') !== undefined && (
                      <span className="text-white font-bold ml-2">
                        {getScore(match, 'A')}
                      </span>
                    )}
                  </div>
                  
                  {/* Team B */}
                  <div className="flex justify-between items-center bg-gray-600 rounded p-2">
                    <span className="text-white truncate">
                      {getTeamName(match, 'B')}
                    </span>
                    {getScore(match, 'B') !== undefined && (
                      <span className="text-white font-bold ml-2">
                        {getScore(match, 'B')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-gray-400 text-xs mt-2 text-center">
                  Status: {match.status}
                </div>
                
                {match.scheduledFor && (
                  <div className="text-gray-400 text-xs text-center">
                    {new Date(match.scheduledFor).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
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
            Playoff Bracket (Test Page)
          </h1>
          <p className="text-gray-400">
            Simple bracket display without external library (for now)
          </p>
        </header>

        <div className="bg-gray-800 rounded-lg p-6 overflow-x-auto">
          {renderSimpleBracket()}
        </div>

        {playoffData && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Debug Info</h2>
            <div className="text-gray-300 space-y-2">
              <div>Total Brackets: {playoffData.brackets.length}</div>
              <div>Upper Bracket Matches: {playoffData.brackets.find(b => b.type === 'upper')?.matches.length || 0}</div>
              <div>Lower Bracket Matches: {playoffData.brackets.find(b => b.type === 'lower')?.matches.length || 0}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
