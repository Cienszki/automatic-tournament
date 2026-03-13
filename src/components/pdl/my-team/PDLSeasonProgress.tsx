'use client';

import { Trophy, TrendingUp, Target, Award, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PDLSeasonProgressProps {
  divisionName?: string;
  divisionTier?: number;
  divisionColor?: string;
  currentPosition?: number;
  totalTeams?: number;
  currentRound?: number;
  totalRounds?: number;
  points?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  recentForm?: ('W' | 'D' | 'L')[];
  playoffQualified?: boolean;
  promotionZone?: boolean;
  relegationZone?: boolean;
}

export function PDLSeasonProgress({
  divisionName = 'Nieznana Dywizja',
  divisionTier = 3,
  divisionColor = '#8B1538',
  currentPosition,
  totalTeams,
  currentRound = 0,
  totalRounds = 8,
  points = 0,
  wins = 0,
  draws = 0,
  losses = 0,
  recentForm = [],
  playoffQualified = false,
  promotionZone = false,
  relegationZone = false,
}: PDLSeasonProgressProps) {
  const matchesPlayed = wins + draws + losses;
  const roundProgress = totalRounds > 0 ? (currentRound / totalRounds) * 100 : 0;

  // Determine status badge
  let statusBadge: { text: string; color: string; icon: typeof Trophy } | null = null;
  
  if (playoffQualified) {
    statusBadge = { text: 'Kwalifikacja do Playoffów', color: 'text-green-400 bg-green-500/20 border-green-500/30', icon: Trophy };
  } else if (promotionZone) {
    statusBadge = { text: 'Strefa Awansu', color: 'text-blue-400 bg-blue-500/20 border-blue-500/30', icon: TrendingUp };
  } else if (relegationZone) {
    statusBadge = { text: 'Strefa Spadkowa', color: 'text-red-400 bg-red-500/20 border-red-500/30', icon: Target };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
          <Award className="w-5 h-5 text-pdl-gold" />
        </div>
        <h3 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
          Postęp Sezonu
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Division Card */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40 uppercase tracking-wider font-logik">Dywizja</p>
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: divisionColor }}
            />
          </div>
          <p className="text-2xl font-logik-wide-black text-white">
            {divisionName}
          </p>
          {currentPosition && totalTeams && (
            <div className="flex items-center gap-2">
              <Medal className="w-4 h-4 text-pdl-gold" />
              <p className="text-sm text-white/60 font-logik">
                Pozycja: <span className="text-white font-logik-extended-bold">{currentPosition}</span> / {totalTeams}
              </p>
            </div>
          )}
          
          {/* Status Badge */}
          {statusBadge && (
            <div className={cn(
              'rounded-lg border px-3 py-1.5 flex items-center gap-2 w-fit text-xs font-logik-extended-bold uppercase',
              statusBadge.color
            )}>
              <statusBadge.icon className="w-3.5 h-3.5" />
              {statusBadge.text}
            </div>
          )}
        </div>

        {/* Round Progress Card */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <p className="text-xs text-white/40 uppercase tracking-wider font-logik">Postęp Rundy</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-logik-wide-black text-white">
              Runda {currentRound}
            </p>
            <p className="text-sm text-white/40 font-logik">
              / {totalRounds}
            </p>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pdl-crimson to-pdl-gold transition-all duration-500"
                style={{ width: `${roundProgress}%` }}
              />
            </div>
            <p className="text-xs text-white/40 font-logik">
              {totalRounds - currentRound} {totalRounds - currentRound === 1 ? 'runda' : 'rund'} pozostało
            </p>
          </div>
        </div>

        {/* Points & Form Card */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <p className="text-xs text-white/40 uppercase tracking-wider font-logik">Punkty</p>
          <p className="text-4xl font-logik-wide-black text-pdl-gold">{points}</p>
          <div className="space-y-1.5">
            <p className="text-xs text-white/40 font-logik uppercase tracking-wider">Ostatnia forma</p>
            {recentForm.length > 0 ? (
              <div className="flex items-center gap-1.5">
                {recentForm.slice(-5).map((result, i) => (
                  <span
                    key={i}
                    className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-logik-extended-bold',
                      result === 'W' && 'bg-green-500/20 text-green-400',
                      result === 'D' && 'bg-yellow-500/20 text-yellow-400',
                      result === 'L' && 'bg-red-500/20 text-red-400',
                    )}
                  >
                    {result}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/20 font-logik italic">Brak rozegranych meczów</p>
            )}
          </div>
        </div>

        {/* Record Card */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <p className="text-xs text-white/40 uppercase tracking-wider font-logik">Bilans</p>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-logik-wide-black text-green-400">{wins}</p>
              <p className="text-xs text-white/40 font-logik uppercase">Wygrane</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-logik-wide-black text-yellow-400">{draws}</p>
              <p className="text-xs text-white/40 font-logik uppercase">Remisy</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-logik-wide-black text-red-400">{losses}</p>
              <p className="text-xs text-white/40 font-logik uppercase">Porażki</p>
            </div>
          </div>
          <p className="text-xs text-white/40 font-logik">
            Rozegrane mecze: <span className="text-white font-logik-extended-bold">{matchesPlayed}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
