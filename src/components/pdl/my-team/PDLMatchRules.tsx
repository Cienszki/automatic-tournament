'use client';

import { Info, Shield, Clock, Globe, Eye, Users, AlertTriangle, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';

interface PDLMatchRulesProps {
  leagueId?: number;
  leagueName?: string;
  isGame1Host?: boolean;
  hostTeamName?: string;
  opponentTeamName?: string;
  timePenalty?: {
    minutes: number;
    reason: string;
  };
}

export function PDLMatchRules({
  leagueId,
  leagueName,
  isGame1Host,
  hostTeamName,
  opponentTeamName,
  timePenalty,
}: PDLMatchRulesProps) {
  const { tournament } = useTournament();
  const displayLeagueName = leagueName ?? tournament?.name?.toUpperCase() ?? 'POLISH DOTA LEAGUE';
  const displayLeagueId = leagueId ?? tournament?.leagueId ?? 19206;

  const lobby = tournament?.lobbySettings;
  const displayGameMode = lobby?.gameMode || 'Captains Mode';
  const displayServer = lobby?.server || 'EU West';
  const displayVisibility = lobby?.visibility || 'Publiczna';
  const displayDotatvDelay = lobby?.dotatvDelayMinutes ?? 5;
  const displayLatePenaltyGame = lobby?.latePenaltyGameMinutes ?? 15;
  const displayLatePenaltySeries = lobby?.latePenaltySeriesMinutes ?? 30;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-pdl-gold" />
        <h4 className="text-xs font-logik-extended-bold text-white/60 uppercase tracking-wide">
          Zasady Rozgrywki
        </h4>
      </div>

      {/* Time Penalty Alert */}
      {timePenalty && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-logik-extended-bold text-orange-300">
                Kara czasowa: {timePenalty.minutes} minut
              </p>
              <p className="text-xs text-orange-200/70 font-logik">
                {timePenalty.reason}
              </p>
              <p className="text-xs text-orange-200/50 font-logik mt-2">
                Drużyna rozpoczyna mecz z opóźnieniem czasowym dla pierwszego draka.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hosting Rules */}
      {hostTeamName && opponentTeamName && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-start gap-2">
            {lobby?.botLobbyEnabled ? (
              <>
                <Bot className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-xs font-logik">
                  <p className="text-white/70">
                    <span className="font-logik-extended-bold text-white">Gra 1 &amp; 2:</span>{' '}
                    Lobby zostanie stworzone automatycznie przez bota przed meczem.
                  </p>
                  <p className="text-white/50">
                    Dołącz do lobby w wyznaczonym czasie – bot wyśle zaproszenia na Steam.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Users className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-xs font-logik">
                  <p className="text-white/70">
                    <span className="font-logik-extended-bold text-white">Gra 1:</span>{' '}
                    Lobby tworzy kapitan{' '}
                    <span className={cn(
                      'font-logik-extended-bold',
                      isGame1Host ? 'text-pdl-gold' : 'text-white/90'
                    )}>
                      {isGame1Host ? hostTeamName : opponentTeamName}
                    </span>
                  </p>
                  <p className="text-white/70">
                    <span className="font-logik-extended-bold text-white">Gra 2:</span>{' '}
                    Lobby tworzy kapitan{' '}
                    <span className={cn(
                      'font-logik-extended-bold',
                      !isGame1Host ? 'text-pdl-gold' : 'text-white/90'
                    )}>
                      {!isGame1Host ? hostTeamName : opponentTeamName}
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lobby Settings */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <p className="text-xs text-white font-logik-extended-bold uppercase tracking-wide">
          Ustawienia Lobby
        </p>
        
        <div className="grid gap-3 text-xs font-logik">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10">
              <Shield className="w-4 h-4 text-white/40" />
            </div>
            <div>
              <p className="text-white/40">Tryb Gry</p>
              <p className="text-white font-logik-extended-bold">{displayGameMode}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10">
              <Globe className="w-4 h-4 text-white/40" />
            </div>
            <div>
              <p className="text-white/40">Serwer</p>
              <p className="text-white font-logik-extended-bold">{displayServer}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10">
              <Eye className="w-4 h-4 text-white/40" />
            </div>
            <div>
              <p className="text-white/40">Widoczność</p>
              <p className="text-white font-logik-extended-bold">{displayVisibility}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10">
              <Shield className="w-4 h-4 text-white/40" />
            </div>
            <div>
              <p className="text-white/40">Liga</p>
              <p className="text-white font-logik-extended-bold">{displayLeagueName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10">
              <Clock className="w-4 h-4 text-white/40" />
            </div>
            <div>
              <p className="text-white/40">Opóźnienie DotaTV</p>
              <p className="text-white font-logik-extended-bold">{displayDotatvDelay} {displayDotatvDelay === 1 ? 'minuta' : 'minut'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
        <div className="flex gap-2">
          <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-200/80 font-logik space-y-1">
            <p className="font-logik-extended-bold text-yellow-300">Ważne:</p>
            <ul className="list-disc list-inside space-y-0.5 text-yellow-200/70">
              <li>Coin Toss decyduje o priorytecie wyboru w grze 1</li>
              <li>Przegrany pierwszego coin tossa ma priorytet w grze 2</li>
              <li>Spóźnienie {displayLatePenaltyGame} min = walkower za grę</li>
              <li>Spóźnienie {displayLatePenaltySeries} min = walkower za serię (0-2)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
