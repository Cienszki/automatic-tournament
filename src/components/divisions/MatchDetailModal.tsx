// src/components/divisions/MatchDetailModal.tsx
// Detailed head-to-head match view modal — dark premium style

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import { Calendar, Trophy, ExternalLink, Loader2, Shield, Sword, Users, ArrowRightLeft, Swords, Sparkles, HandHelping, Eye } from 'lucide-react';
import type { Match } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { loadTeamPlayersForDisplay } from '@/lib/team-players-loader';
import { getHeroName } from '@/lib/hero-mapping';
import { getMatchPlayersData, MatchPlayerData } from '@/lib/match-players-action';

interface Performance {
  playerId: string;
  teamId: string;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  fantasyPoints?: number;
}

interface GameDetail {
  id: string;
  radiant_win: boolean;
  duration: number;
  start_time: number;
  radiant_team: { id: string; name: string };
  dire_team: { id: string; name: string };
  is_forfeit?: boolean;
  performances: Performance[];
}

const ROLE_ORDER = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];

function getRoleIcon(role: string) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (role) {
    case 'Carry': return <Swords className={cls} />;
    case 'Mid': return <Sparkles className={cls} />;
    case 'Offlane': return <Shield className={cls} />;
    case 'Soft Support': return <HandHelping className={cls} />;
    case 'Hard Support': return <Eye className={cls} />;
    default: return null;
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface MatchDetailModalProps {
  match: Match | null;
  isOpen: boolean;
  onClose: () => void;
  divisionColor: string;
}

export function MatchDetailModal({ match, isOpen, onClose, divisionColor }: MatchDetailModalProps) {
  const { tournament, theme } = useTournament();

  const [gamesData, setGamesData] = useState<GameDetail[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [matchPlayers, setMatchPlayers] = useState<Record<string, MatchPlayerData>>({});

  type SimplePlayer = { id: string; nickname: string; role: string; mmr?: number };
  const [teamAPlayers, setTeamAPlayers] = useState<SimplePlayer[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<SimplePlayer[]>([]);
  const [playersLoaded, setPlayersLoaded] = useState(false);

  const loadGames = useCallback(async () => {
    if (!tournament?.id || !match?.id || gamesLoaded) return;
    setGamesLoading(true);
    try {
      const gamesRef = collection(db, 'tournaments', tournament.id, 'matches', match.id, 'games');
      const gamesSnap = await getDocs(gamesRef);
      const gameDetails: GameDetail[] = await Promise.all(
        gamesSnap.docs.map(async (gameDoc) => {
          const game = gameDoc.data();
          const perfsRef = collection(
            db, 'tournaments', tournament.id, 'matches', match.id, 'games', gameDoc.id, 'performances'
          );
          const perfsSnap = await getDocs(perfsRef);
          return {
            id: gameDoc.id,
            radiant_win: game.radiant_win,
            duration: game.duration || 0,
            start_time: game.start_time || 0,
            radiant_team: game.radiant_team || { id: '', name: '?' },
            dire_team: game.dire_team || { id: '', name: '?' },
            is_forfeit: game.is_forfeit || false,
            performances: perfsSnap.docs.map(d => d.data() as Performance),
          };
        })
      );
      gameDetails.sort((a, b) => (a.start_time || 0) - (b.start_time || 0));
      setGamesData(gameDetails);

      // Fetch match players metadata for naming and coloring
      if (match.teamA?.id && match.teamB?.id) {
        const playersData = await getMatchPlayersData(match.id, match.teamA.id, match.teamB.id, tournament?.id);
        setMatchPlayers(playersData);
      }

      setGamesLoaded(true);
    } catch (e) {
      console.error('Failed to load game details', e);
    } finally {
      setGamesLoading(false);
    }
  }, [tournament?.id, match?.id, gamesLoaded]);

  // Reset when match changes
  useEffect(() => {
    setGamesData([]);
    setGamesLoaded(false);
    setMatchPlayers({});
    setTeamAPlayers([]);
    setTeamBPlayers([]);
    setPlayersLoaded(false);
  }, [match?.id]);

  const loadTeamPlayers = useCallback(async () => {
    if (!tournament?.id || !match?.teamA?.id || !match?.teamB?.id || playersLoaded) return;
    try {
      const fetchPlayers = async (teamId: string): Promise<SimplePlayer[]> => {
        const players = await loadTeamPlayersForDisplay(teamId, tournament.id);
        return players
          .map(p => ({ id: p.id, nickname: p.nickname || '?', role: p.role || '', mmr: p.mmr }))
          .sort((a, b) => {
            const ai = ROLE_ORDER.indexOf(a.role);
            const bi = ROLE_ORDER.indexOf(b.role);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          });
      };
      const [aPl, bPl] = await Promise.all([
        fetchPlayers(match.teamA.id),
        fetchPlayers(match.teamB.id),
      ]);
      setTeamAPlayers(aPl);
      setTeamBPlayers(bPl);
      setPlayersLoaded(true);
    } catch (e) {
      console.error('Failed to load team players', e);
    }
  }, [tournament?.id, match?.teamA?.id, match?.teamB?.id, playersLoaded]);

  useEffect(() => {
    if (isOpen && match?.status === 'completed') {
      loadGames();
    }
    // For upcoming/live matches, load match players metadata and team rosters
    if (isOpen && match?.status !== 'completed' && match?.teamA?.id && match?.teamB?.id && tournament?.id) {
      getMatchPlayersData(match.id, match.teamA.id, match.teamB.id, tournament.id)
        .then(setMatchPlayers)
        .catch(() => {});
      loadTeamPlayers();
    }
  }, [isOpen, match?.status, loadGames, loadTeamPlayers]);

  if (!match) return null;

  const matchDate = match.completed_at
    ? new Date(match.completed_at)
    : match.scheduledFor
      ? new Date(match.scheduledFor)
      : null;

  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';

  const teamAWon = isCompleted && match.teamA.score > match.teamB.score;
  const teamBWon = isCompleted && match.teamB.score > match.teamA.score;

  // Render a single team's roster with inline standin info
  const renderTeamRoster = (players: { id: string; nickname: string; role: string; mmr?: number }[], teamId: string) => {
    if (players.length === 0) {
      return <p className="text-xs text-white/20 italic">Brak danych</p>;
    }
    return (
      <div className="space-y-2">
        {players.map((player) => {
          const standinEntry = match.approvedStandins
            ? Object.values(match.approvedStandins).find(
                e => e.teamId === teamId && e.replacedPlayerId === player.id
              )
            : null;
          return (
            <div key={player.id} className="flex items-center gap-2.5 text-xs">
              <span className="shrink-0 text-white/30">
                {getRoleIcon(player.role)}
              </span>
              {standinEntry ? (
                <>
                  <span className="text-yellow-400 font-medium uppercase tracking-wide truncate">
                    {player.nickname}
                  </span>
                  {player.mmr ? <span className="text-white/25 shrink-0">({player.mmr})</span> : null}
                  <span className="text-white/25 shrink-0">→</span>
                  <span className="text-blue-400 font-medium uppercase tracking-wide truncate">
                    {standinEntry.nickname}
                  </span>
                  {standinEntry.standinMmr ? <span className="text-blue-400/40 shrink-0">({standinEntry.standinMmr})</span> : null}
                </>
              ) : (
                <>
                  <span className="text-gray-300 font-medium uppercase tracking-wide truncate">
                    {player.nickname}
                  </span>
                  {player.mmr ? <span className="text-white/25 shrink-0">({player.mmr})</span> : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1100px] backdrop-blur-xl border border-white/10 p-0 overflow-hidden shadow-2xl" style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)' }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Szczegóły meczu</DialogTitle>
        </DialogHeader>

        <div className="relative w-full max-h-[85vh] overflow-y-auto">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

          <div className="relative p-8 md:p-10">
            {/* Status badge */}
            <div className="flex justify-center mb-8">
              {isLive ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Na żywo</span>
                </div>
              ) : isCompleted ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border" style={{ backgroundColor: `${divisionColor}1a`, borderColor: `${divisionColor}4d` }}>
                  <Trophy className="w-4 h-4" style={{ color: divisionColor }} />
                  <span className="text-sm font-bold uppercase tracking-wider" style={{ color: divisionColor }}>Ukończony</span>
                </div>
              ) : (() => {
                const calendarUrl = matchDate
                  ? (() => {
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
                      const start = fmt(matchDate);
                      const end = fmt(new Date(matchDate.getTime() + 2 * 60 * 60 * 1000));
                      const title = `${tournament?.name || 'Mecz'} - ${match.teamA.name} vs ${match.teamB.name}`;
                      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}`;
                    })()
                  : null;
                return (
                  <a
                    href={calendarUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 cursor-pointer"
                    title="Dodaj do Google Calendar"
                  >
                    <Calendar className="w-4 h-4" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }} />
                    <span className="text-xs uppercase tracking-widest" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                      {matchDate ? format(matchDate, 'dd MMMM yyyy, HH:mm', { locale: pl }) : 'TBD'}
                    </span>
                  </a>
                );
              })()}
            </div>

            {/* Teams + Score */}
            <div className="flex items-center justify-between gap-8">
              {/* Team A */}
              <div className={cn('flex-1 flex flex-col items-center gap-4 transition-opacity', teamBWon ? 'opacity-40' : '')}>
                <div className="relative w-24 h-24">
                  {match.teamA.logoUrl ? (
                    <Image src={match.teamA.logoUrl} alt={match.teamA.name} fill className="object-contain drop-shadow-2xl" unoptimized />
                  ) : (
                    <div className="w-full h-full rounded-2xl bg-white/5 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
                      {match.teamA.name.charAt(0)}
                    </div>
                  )}
                  {teamAWon && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: divisionColor }}>
                      <Trophy className="w-4 h-4 text-black" />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-logik-extended-bold text-center uppercase tracking-wide" style={{ color: teamAWon ? divisionColor : (theme?.primaryTextColor || 'white'), fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}>
                  {match.teamA.name}
                </h3>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="text-5xl font-logik-extended-bold flex items-center gap-4">
                  <span style={{ color: teamAWon ? divisionColor : 'rgba(255,255,255,0.5)' }}>
                    {isCompleted || isLive ? match.teamA.score : '-'}
                  </span>
                  <span className="text-white/20">:</span>
                  <span style={{ color: teamBWon ? divisionColor : 'rgba(255,255,255,0.5)' }}>
                    {isCompleted || isLive ? match.teamB.score : '-'}
                  </span>
                </div>
                <div className="text-sm font-mono tracking-widest uppercase" style={{ color: divisionColor ? `${divisionColor}99` : undefined }}>
                  {match.bestOf
                    ? `Best of ${match.bestOf}`
                    : match.series_format
                      ? `Best of ${match.series_format.replace(/\D/g, '')}`
                      : 'Best of 2'}
                </div>

              </div>

              {/* Team B */}
              <div className={cn('flex-1 flex flex-col items-center gap-4 transition-opacity', teamAWon ? 'opacity-40' : '')}>
                <div className="relative w-24 h-24">
                  {match.teamB.logoUrl ? (
                    <Image src={match.teamB.logoUrl} alt={match.teamB.name} fill className="object-contain drop-shadow-2xl" unoptimized />
                  ) : (
                    <div className="w-full h-full rounded-2xl bg-white/5 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
                      {match.teamB.name.charAt(0)}
                    </div>
                  )}
                  {teamBWon && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: divisionColor }}>
                      <Trophy className="w-4 h-4 text-black" />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-logik-extended-bold text-center uppercase tracking-wide" style={{ color: teamBWon ? divisionColor : (theme?.primaryTextColor || 'white'), fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}>
                  {match.teamB.name}
                </h3>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

            {/* Game breakdown */}
            {isCompleted && (
              <>
                {gamesLoading && (
                  <div className="flex items-center justify-center py-10 gap-3 text-white/30">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-mono">Ładowanie statystyk…</span>
                  </div>
                )}

                {!gamesLoading && gamesData.length > 0 && (
                  <div className="space-y-6">
                    {gamesData.map((game, idx) => {
                      const winnerTeamId = game.radiant_win ? game.radiant_team.id : game.dire_team.id;
                      const teamAWonGame = winnerTeamId === match.teamA.id;

                      const sortPerfs = (arr: Performance[]) =>
                        [...arr].sort((a, b) => (b.kills + b.assists) - (a.kills + a.assists));

                      const leftPerfs = sortPerfs(game.performances.filter(p => p.teamId === match.teamA.id));
                      const rightPerfs = sortPerfs(game.performances.filter(p => p.teamId === match.teamB.id));

                      return (
                        <div key={game.id} className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                          {/* Game header */}
                          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs font-logik-extended-bold text-white/50 uppercase tracking-widest">
                                Gra {idx + 1}
                              </span>
                              {game.is_forfeit ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                  Walkover
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-mono border border-white/10">
                                  {formatDuration(game.duration)}
                                </span>
                              )}
                              <span className="text-xs font-logik-extended-bold" style={{ color: teamAWonGame ? divisionColor : 'rgba(255,255,255,0.4)' }}>
                                {teamAWonGame ? `★ ${match.teamA.name}` : match.teamA.name}
                              </span>
                              <span className="text-white/20 text-xs">vs</span>
                              <span className="text-xs font-logik-extended-bold" style={{ color: !teamAWonGame ? divisionColor : 'rgba(255,255,255,0.4)' }}>
                                {!teamAWonGame ? `★ ${match.teamB.name}` : match.teamB.name}
                              </span>
                            </div>
                            <a
                              href={`https://www.opendota.com/matches/${game.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors shrink-0 ml-3"
                            >
                              OpenDota
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {/* Players grid */}
                          {!game.is_forfeit && (leftPerfs.length > 0 || rightPerfs.length > 0) && (
                            <div className="grid grid-cols-2 divide-x divide-white/10">
                              {/* Team A */}
                              <div className={cn('p-3', !teamAWonGame && 'opacity-60')}>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Shield className="w-3 h-3 text-white/30" />
                                  <span className="text-xs font-logik-extended-bold text-white/60 uppercase tracking-wide truncate">
                                    {match.teamA.name}
                                  </span>
                                  {teamAWonGame && <span className="ml-auto text-xs shrink-0" style={{ color: divisionColor }}>✓ Win</span>}
                                </div>
                                <div className="space-y-1">
                                  {leftPerfs.slice(0, 5).map((p, i) => {
                                    const playerData = matchPlayers[p.playerId];
                                    const playerName = playerData?.nickname || `Nieznany (ID: ${p.playerId})`;
                                    let nameColor = 'text-red-400';
                                    if (playerData?.role === 'registered') nameColor = 'text-green-400';
                                    if (playerData?.role === 'standin') nameColor = 'text-blue-400';

                                    return (
                                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className={cn("truncate font-medium", nameColor)} title={playerName}>
                                            {playerName}
                                          </span>
                                          {playerData?.role === 'standin' && playerData.replacedPlayerNickname && (
                                            <span className="text-blue-400/50 truncate text-[10px]" title={`Za: ${playerData.replacedPlayerNickname}`}>
                                              za {playerData.replacedPlayerNickname}
                                            </span>
                                          )}
                                          <span className="text-white/40 truncate text-[10px]" title={getHeroName(p.heroId)}>
                                            {getHeroName(p.heroId)}
                                          </span>
                                        </div>
                                        <span className="font-mono shrink-0 flex flex-col items-end gap-0.5">
                                          <span>
                                            <span className="text-green-400/80">{p.kills}</span>
                                            <span className="text-white/20">/</span>
                                            <span className="text-red-400/80">{p.deaths}</span>
                                            <span className="text-white/20">/</span>
                                            <span className="text-blue-400/80">{p.assists}</span>
                                          </span>
                                          {p.gpm > 0 && (
                                            <span className="text-[10px]">
                                              <span className="text-yellow-400/60">{p.gpm}</span>
                                              <span className="text-white/15">g</span>
                                              <span className="mx-1 text-white/10">|</span>
                                              <span className="text-blue-400/60">{p.xpm}</span>
                                              <span className="text-white/15">x</span>
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {leftPerfs.length === 0 && <p className="text-xs text-white/20 italic">Brak danych</p>}
                                </div>
                              </div>

                              {/* Team B */}
                              <div className={cn('p-3', teamAWonGame && 'opacity-60')}>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Sword className="w-3 h-3 text-white/30" />
                                  <span className="text-xs font-logik-extended-bold text-white/60 uppercase tracking-wide truncate">
                                    {match.teamB.name}
                                  </span>
                                  {!teamAWonGame && <span className="ml-auto text-xs shrink-0" style={{ color: divisionColor }}>✓ Win</span>}
                                </div>
                                <div className="space-y-1">
                                  {rightPerfs.slice(0, 5).map((p, i) => {
                                    const playerData = matchPlayers[p.playerId];
                                    const playerName = playerData?.nickname || `Nieznany (ID: ${p.playerId})`;
                                    let nameColor = 'text-red-400';
                                    if (playerData?.role === 'registered') nameColor = 'text-green-400';
                                    if (playerData?.role === 'standin') nameColor = 'text-blue-400';

                                    return (
                                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className={cn("truncate font-medium", nameColor)} title={playerName}>
                                            {playerName}
                                          </span>
                                          {playerData?.role === 'standin' && playerData.replacedPlayerNickname && (
                                            <span className="text-blue-400/50 truncate text-[10px]" title={`Za: ${playerData.replacedPlayerNickname}`}>
                                              za {playerData.replacedPlayerNickname}
                                            </span>
                                          )}
                                          <span className="text-white/40 truncate text-[10px]" title={getHeroName(p.heroId)}>
                                            {getHeroName(p.heroId)}
                                          </span>
                                        </div>
                                        <span className="font-mono shrink-0 flex flex-col items-end gap-0.5">
                                          <span>
                                            <span className="text-green-400/80">{p.kills}</span>
                                            <span className="text-white/20">/</span>
                                            <span className="text-red-400/80">{p.deaths}</span>
                                            <span className="text-white/20">/</span>
                                            <span className="text-blue-400/80">{p.assists}</span>
                                          </span>
                                          {p.gpm > 0 && (
                                            <span className="text-[10px]">
                                              <span className="text-yellow-400/60">{p.gpm}</span>
                                              <span className="text-white/15">g</span>
                                              <span className="mx-1 text-white/10">|</span>
                                              <span className="text-blue-400/60">{p.xpm}</span>
                                              <span className="text-white/15">x</span>
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {rightPerfs.length === 0 && <p className="text-xs text-white/20 italic">Brak danych</p>}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!gamesLoading && gamesData.length === 0 && (
                  <p className="text-center text-white/20 text-sm flex items-center justify-center gap-2 py-4">
                    <Trophy className="w-4 h-4" />
                    Brak zaimportowanych gier
                  </p>
                )}

                {/* Approved standin info (new PDL format) */}
                {match.approvedStandins && Object.keys(match.approvedStandins).length > 0 && (
                  <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="text-xs font-logik-extended-bold text-blue-400/70 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <ArrowRightLeft className="w-3 h-3" />
                      Zastępstwa
                    </p>
                    <div className="space-y-2">
                      {Object.values(match.approvedStandins).map((entry, i) => {
                        const teamName = entry.teamId === match.teamA.id ? match.teamA.name : match.teamB.name;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-white/30 shrink-0">{teamName}:</span>
                            <span className="text-blue-400 font-medium">{entry.nickname}</span>
                            <span className="text-white/20">za</span>
                            <span className="text-white/50">{entry.replacedPlayerNickname}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Legacy Letnia standin info */}
                {!match.approvedStandins && match.standinInfo && Object.keys(match.standinInfo).length > 0 && (
                  <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-xs font-logik-extended-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      Zastępstwa
                    </p>
                    <div className="space-y-2 text-xs text-white/50">
                      {Object.entries(match.standinInfo).map(([teamId, info]) => (
                        <div key={teamId}>
                          <p className="font-bold text-white/70">
                            {teamId === match.teamA.id ? match.teamA.name : match.teamB.name}
                          </p>
                          <p>Niedostępni: {info.unavailablePlayers.join(', ')}</p>
                          <p>Zastępstwa: {info.standins.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Upcoming / Live — team rosters */}
            {!isCompleted && (
              <div className="space-y-6">
                {/* Team rosters with inline standin info */}
                {(teamAPlayers.length > 0 || teamBPlayers.length > 0) && (
                  <div className="grid grid-cols-2 divide-x divide-white/10 rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                    {/* Team A */}
                    <div className="p-4">
                      <p className="text-[11px] font-logik-extended-bold text-white/40 uppercase tracking-widest mb-3">
                        {match.teamA.name}
                      </p>
                      {renderTeamRoster(teamAPlayers, match.teamA.id)}
                    </div>
                    {/* Team B */}
                    <div className="p-4">
                      <p className="text-[11px] font-logik-extended-bold text-white/40 uppercase tracking-widest mb-3">
                        {match.teamB.name}
                      </p>
                      {renderTeamRoster(teamBPlayers, match.teamB.id)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
