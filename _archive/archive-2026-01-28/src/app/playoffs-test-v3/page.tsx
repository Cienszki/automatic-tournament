// Clean client-only page for playoffs-test-v3
'use client';

import React, { useEffect, useState } from 'react';
import MatchSummary from '@/components/ui/MatchSummary';
import convertPlayoffDataToGame from '@/lib/bracketConverter';

export default function PlayoffsTestV3Page() {
  const [BracketComponent, setBracketComponent] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const lib = require('react-tournament-bracket');
          setBracketComponent(() => lib?.Bracket ?? null);
        }
      } catch (e) {
        console.error('Failed to load bracket lib', e);
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    load();
  }, []);

  const [testGame, setTestGame] = useState<any | null>(null);
  useEffect(() => {
    // fetch sample playoff data and convert to a bracket Game
    (async () => {
      try {
        const resp = await fetch('/test-playoff-data.json');
        if (!resp.ok) throw new Error('Failed to fetch playoff data');
        const data = await resp.json();
        const game = convertPlayoffDataToGame(data);
        setTestGame(game || {
          id: 'g1',
          name: 'Test Match',
          scheduled: Date.now(),
          sides: {
            home: { team: { id: 'team1', name: 'Team Alpha' }, score: { score: 2 } },
            visitor: { team: { id: 'team2', name: 'Team Beta' }, score: { score: 1 } },
          },
        });
      } catch (e) {
        console.error('Playoff data fetch/convert error', e);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Playoffs — test</h1>
          <p className="text-gray-400">Compact match summary + bracket preview</p>
        </header>

        <div className="bg-gray-800 rounded-lg p-6">
          {error && <div className="text-red-400 mb-4">Error loading bracket: {error}</div>}

          {testGame ? (
            <div>
              {/* Compact single-line summary */}
              <MatchSummary match={testGame} onClick={(m) => console.log('clicked', m.id)} />

              <div className="mt-6 bg-slate-800 p-4 rounded-lg">
                {BracketComponent ? (
                  // Render bracket if the lib is available
                  <div className="rounded-md bg-black/40 p-4">
                    {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                    {/* @ts-ignore */}
                    <BracketComponent game={testGame} />
                  </div>
                ) : (
                  <div className="text-slate-300">Bracket library not loaded (client-only)</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-white text-center py-8">Building test game...</div>
          )}
        </div>
      </div>
    </div>
  );
}

