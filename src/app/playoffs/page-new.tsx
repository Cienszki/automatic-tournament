'use client';

import React, { useEffect, useState } from 'react';
import { convertPlayoffDataToGame } from '@/lib/bracketConverter';

interface PlayoffData {
  brackets: {
    type: string;
    matches: any[];
    isActive: boolean;
  }[];
}

interface TournamentGame {
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
}

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

export default function PlayoffsPage() {
  const [playoffData, setPlayoffData] = useState<PlayoffData | null>(null);
  const [bracketGame, setBracketGame] = useState<TournamentGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [BracketComponent, setBracketComponent] = useState<any>(null);
  const windowSize = useWindowSize();

  // Load the react-tournament-bracket library
  useEffect(() => {
    const loadBracketLibrary = async () => {
      try {
        if (typeof window !== 'undefined') {
          const lib = require('react-tournament-bracket');
          console.log('Library loaded:', lib);
          setBracketComponent(() => lib.default || lib.Bracket);
        }
      } catch (error) {
        console.error('Failed to load bracket library:', error);
        setError('Failed to load bracket library');
      }
    };

    loadBracketLibrary();
  }, []);

  useEffect(() => {
    const fetchPlayoffData = async () => {
      try {
        const response = await fetch('/test-playoff-data.json');
        if (!response.ok) {
          throw new Error('Failed to fetch playoff data');
        }
        const data: PlayoffData = await response.json();
        setPlayoffData(data);
        
        // Convert to bracket game structure using existing converter
        const convertedGame = convertPlayoffDataToGame(data);
        setBracketGame(convertedGame);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayoffData();
  }, []);

  // Inject custom CSS for full-width styling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .playoffs-wrapper {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        min-height: 100vh;
        width: 100vw;
        margin: 0;
        padding: 0;
        position: relative;
        overflow-x: auto;
        overflow-y: hidden;
      }
      
      .playoffs-container {
        width: 100%;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 20px;
        box-sizing: border-box;
      }
      
      .playoffs-header {
        text-align: center;
        margin-bottom: 30px;
        z-index: 10;
      }
      
      .playoffs-content {
        flex: 1;
        width: 100%;
        min-height: calc(100vh - 140px);
        background: rgba(30, 41, 59, 0.9);
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        backdrop-filter: blur(12px);
        padding: 40px;
        box-sizing: border-box;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: auto;
      }
      
      .bracket-display {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background: linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%);
        border-radius: 12px;
        padding: 30px;
        box-shadow: 
          0 20px 25px -5px rgba(0, 0, 0, 0.1),
          0 10px 10px -5px rgba(0, 0, 0, 0.04),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }
      
      /* Tournament bracket specific styling */
      .tournament-bracket {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .tournament-bracket .match {
        background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        padding: 8px 12px;
        margin: 4px;
      }
      
      .tournament-bracket .match:hover {
        border-color: #3b82f6;
        box-shadow: 0 8px 16px rgba(59, 130, 246, 0.15);
        transform: translateY(-2px);
      }
      
      .tournament-bracket .team {
        color: #1e293b;
        font-weight: 600;
        font-size: 14px;
        padding: 4px 0;
      }
      
      .tournament-bracket .winner {
        background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
        border-color: #22c55e;
        color: #15803d;
      }
      
      .tournament-bracket .score {
        font-weight: 700;
        color: #374151;
      }
      
      .tournament-bracket svg {
        overflow: visible;
      }
      
      .tournament-bracket line {
        stroke: #6b7280;
        stroke-width: 2;
      }
      
      .loading-spinner {
        color: #60a5fa;
        font-size: 18px;
      }
      
      .error-message {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 8px;
        padding: 16px;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (loading) {
    return (
      <div className="playoffs-wrapper">
        <div className="playoffs-container">
          <div className="playoffs-content">
            <div className="loading-spinner">
              Loading tournament bracket...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="playoffs-wrapper">
        <div className="playoffs-container">
          <div className="playoffs-content">
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bracketGame || !BracketComponent) {
    return (
      <div className="playoffs-wrapper">
        <div className="playoffs-container">
          <div className="playoffs-content">
            <div className="loading-spinner">
              {!BracketComponent ? 'Loading bracket library...' : 'No tournament data available'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="playoffs-wrapper">
      <div className="playoffs-container">
        <div className="playoffs-header">
          <h1 className="text-5xl font-bold text-white mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Tournament Playoffs
          </h1>
          <p className="text-slate-300 text-lg">
            Professional Tournament Bracket System
          </p>
        </div>
        
        <div className="playoffs-content">
          <div className="bracket-display">
            <div className="tournament-bracket">
              <BracketComponent 
                game={bracketGame}
                homeOnTop={true}
                gameDimensions={{ 
                  height: 100, 
                  width: Math.min(280, Math.max(200, windowSize.width / 8))
                }}
                svgPadding={30}
                roundSeparatorWidth={50}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
