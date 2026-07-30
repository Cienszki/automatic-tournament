// src/components/divisions/MatchDetailModal.tsx
// Detailed head-to-head match view modal — dark premium style

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import { Calendar, Trophy, ExternalLink, Loader2, Shield, Users, ArrowRightLeft, Swords, Sparkles, HandHelping, Eye } from 'lucide-react';
import type { Match, DraftPenalty } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { DraftPenaltyBanner } from '@/components/penalties/DraftPenaltyBanner';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

/** "Gra 1, Gra 3, Gra 5" for a per-game standin scope, or null when it covers the whole series. */
function formatGameNumbers(nums?: number[]): string | null {
  if (!nums || nums.length === 0) return null;
  return [...nums].sort((a, b) => a - b).map((n) => `Gra ${n}`).join(', ');
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

  // Draft penalties live on the `matches` doc (the same id as this match / the playoff mirror), but
  // a match opened from the bracket is built from `playoff_matches` and won't carry them — so fetch
  // them straight from the authoritative match doc.
  const [fetchedPenalties, setFetchedPenalties] = useState<DraftPenalty[]>([]);
  // scheduledFor from the `matches` doc — a playoff match opened from the bracket is built from
  // `playoff_matches` (no scheduledFor), so fall back to the mirror's schedule for the date.
  const [fetchedScheduledFor, setFetchedScheduledFor] = useState<string>('');
  useEffect(() => {
    if (!isOpen || !tournament?.id || !match?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'tournaments', tournament.id, 'matches', match.id));
        if (!cancelled) {
          setFetchedPenalties((snap.exists() ? (snap.data().draftPenalties as DraftPenalty[]) : []) || []);
          setFetchedScheduledFor((snap.exists() ? (snap.data().scheduledFor as string) : '') || '');
        }
      } catch {
        if (!cancelled) { setFetchedPenalties([]); setFetchedScheduledFor(''); }
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, tournament?.id, match?.id]);
  const penalties = match?.draftPenalties && match.draftPenalties.length > 0 ? match.draftPenalties : fetchedPenalties;

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
      loadTeamPlayers();
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

  const effectiveScheduledFor = match.scheduledFor || fetchedScheduledFor;
  const matchDate = match.completed_at
    ? new Date(match.completed_at)
    : effectiveScheduledFor
      ? new Date(effectiveScheduledFor)
      : null;

  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';

  const teamAWon = isCompleted && match.teamA.score > match.teamB.score;
  const teamBWon = isCompleted && match.teamB.score > match.teamA.score;

  // Build nickname → MMR lookup so game results can show MMR (for MMR-limited tournaments)
  const mmrByNickname: Record<string, number> = {};
  [...teamAPlayers, ...teamBPlayers].forEach(p => {
    if (p.nickname && p.mmr) mmrByNickname[p.nickname.toLowerCase()] = p.mmr;
  });

  // Render a single team's roster with inline standin info
  const renderTeamRoster = (players: { id: string; nickname: string; role: string; mmr?: number }[], teamId: string) => {
    if (players.length === 0) {
      return <p className="text-xs text-white/20 italic">Brak danych</p>;
    }
    return (
      <div className="space-y-2">
        {players.map((player) => {
          // A player may have several standins across the series (a different one per game),
          // so collect them all rather than just the first.
          const entries = match.approvedStandins
            ? Object.values(match.approvedStandins).filter(
                e => e.teamId === teamId && e.replacedPlayerId === player.id
              )
            : [];
          // A single standin with no game scope = whole-series replacement (the common case).
          const wholeSeries = entries.length === 1 && !formatGameNumbers(entries[0].gameNumbers);
          const playerName = (
            <>
              <span className="font-medium uppercase tracking-wide truncate" style={{ color: 'var(--tournament-primary-text)' }}>
                {player.nickname}
              </span>
              {player.mmr ? <span className="shrink-0 opacity-40" style={{ color: 'var(--tournament-primary-text)' }}>({player.mmr})</span> : null}
            </>
          );
          return (
            <div key={player.id} className="flex items-start gap-2.5 text-xs">
              <span className="shrink-0 mt-0.5" style={{ color: 'var(--tournament-primary-text)' }}>
                {getRoleIcon(player.role)}
              </span>
              {entries.length === 0 ? (
                <div className="flex items-center gap-2 min-w-0">{playerName}</div>
              ) : wholeSeries ? (
                <div className="flex items-center gap-2 min-w-0">
                  {playerName}
                  <span className="text-white/25 shrink-0">→</span>
                  <span className="font-medium uppercase tracking-wide truncate" style={{ color: 'var(--tournament-heading)' }}>
                    {entries[0].nickname}
                  </span>
                  {entries[0].standinMmr ? <span className="shrink-0 opacity-40" style={{ color: 'var(--tournament-heading)' }}>({entries[0].standinMmr})</span> : null}
                </div>
              ) : (
                // Per-game standins: show the registered player, then each standin with the
                // games they cover (the player themself plays any games not listed).
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">{playerName}</div>
                  {[...entries]
                    .sort((a, b) => (a.gameNumbers?.[0] ?? 0) - (b.gameNumbers?.[0] ?? 0))
                    .map((e, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 pl-3 min-w-0" style={{ color: 'var(--tournament-heading)' }}>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">{formatGameNumbers(e.gameNumbers)}</span>
                        <span className="text-white/20 shrink-0">→</span>
                        <span className="font-medium uppercase tracking-wide truncate">{e.nickname}</span>
                        {e.standinMmr ? <span className="shrink-0 opacity-40">({e.standinMmr})</span> : null}
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[1100px] backdrop-blur-xl border border-white/10 p-0 overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)' }}
      >
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
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest opacity-50" style={{ color: 'var(--tournament-primary-text)' }}>
                      Dodaj do kalendarza Google
                    </span>
                  <a
                    href={calendarUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 cursor-pointer"
                    style={{ borderColor: 'var(--tournament-primary-text)' }}
                    title="Add to Google Calendar"
                  >
                    <Calendar className="w-4 h-4" style={{ color: 'var(--tournament-primary-text)' }} />
                    <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--tournament-primary-text)' }}>
                      {matchDate ? format(matchDate, 'dd MMMM yyyy, HH:mm', { locale: pl }) : 'TBD'}
                    </span>
                  </a>
                  </div>
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
                <h3 className="text-xl font-logik-extended-bold text-center uppercase tracking-wide" style={{ color: teamAWon ? divisionColor : 'var(--tournament-section-header)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}>
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
                <div className="text-sm font-mono tracking-widest uppercase" style={{ color: 'var(--tournament-heading)' }}>
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
                <h3 className="text-xl font-logik-extended-bold text-center uppercase tracking-wide" style={{ color: teamBWon ? divisionColor : 'var(--tournament-section-header)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}>
                  {match.teamB.name}
                </h3>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

            {/* Draft penalties (admin-issued) */}
            {penalties.length > 0 && (
              <div className="mb-8">
                <h4 className="text-xs uppercase tracking-widest text-white/40 font-logik-extended-bold mb-2 flex items-center gap-2">
                  Kary draftu
                </h4>
                <DraftPenaltyBanner penalties={penalties} teamA={match.teamA} teamB={match.teamB} />
              </div>
            )}

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
                              <span className="text-xs font-logik-extended-bold uppercase tracking-widest" style={{ color: 'var(--tournament-primary-text)' }}>
                                Gra {idx + 1}
                              </span>
                              {game.is_forfeit ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                  Walkover
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 font-mono border border-white/10" style={{ color: 'var(--tournament-primary-text)' }}>
                                  {formatDuration(game.duration)}
                                </span>
                              )}
                              {teamAWonGame ? (
                                <span className="text-xs font-logik-extended-bold" style={{ color: divisionColor }}>★ {match.teamA.name}</span>
                              ) : (
                                <span className="text-xs font-logik-extended-bold" style={{ color: 'var(--tournament-primary-text)' }}>{match.teamA.name}</span>
                              )}
                              <span className="text-xs" style={{ color: 'var(--tournament-primary-text)' }}>vs</span>
                              {!teamAWonGame ? (
                                <span className="text-xs font-logik-extended-bold" style={{ color: divisionColor }}>★ {match.teamB.name}</span>
                              ) : (
                                <span className="text-xs font-logik-extended-bold" style={{ color: 'var(--tournament-primary-text)' }}>{match.teamB.name}</span>
                              )}
                            </div>
                            <a
                              href={`https://www.opendota.com/matches/${game.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity shrink-0 ml-3"
                              style={{ color: 'var(--tournament-primary-text)' }}
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
                                  <span className="text-xs font-logik-extended-bold uppercase tracking-wide truncate" style={{ color: 'var(--tournament-section-header)' }}>
                                    {match.teamA.name}
                                  </span>
                                  {teamAWonGame && <span className="ml-auto text-xs shrink-0" style={{ color: divisionColor }}>✓ Win</span>}
                                </div>
                                <div className="space-y-1">
                                  {leftPerfs.slice(0, 5).map((p, i) => {
                                    const playerData = matchPlayers[p.playerId];
                                    const playerName = playerData?.nickname || `Nieznany (ID: ${p.playerId})`;
                                    const isStandin = playerData?.role === 'standin';
                                    const isUnknown = !playerData || (playerData.role !== 'registered' && playerData.role !== 'standin');
                                    const nameColor = isStandin ? 'var(--tournament-heading)' : isUnknown ? 'rgba(255,255,255,0.35)' : 'var(--tournament-primary-text)';
                                    const playerMmr = mmrByNickname[playerName.toLowerCase()];

                                    return (
                                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <div className="flex items-baseline gap-1 min-w-0">
                                            <span className="truncate font-medium uppercase tracking-wide" style={{ color: nameColor }} title={playerName}>
                                              {playerName}
                                            </span>
                                            {playerMmr ? <span className="shrink-0 text-[10px] opacity-40" style={{ color: nameColor }}>({playerMmr})</span> : null}
                                          </div>
                                          {isStandin && playerData.replacedPlayerNickname && (
                                            <span className="truncate text-[10px] opacity-50" style={{ color: 'var(--tournament-heading)' }} title={`Za: ${playerData.replacedPlayerNickname}`}>
                                              za {playerData.replacedPlayerNickname}
                                            </span>
                                          )}
                                          <span className="truncate text-[10px] opacity-40" style={{ color: nameColor }} title={getHeroName(p.heroId)}>
                                            {getHeroName(p.heroId)}
                                          </span>
                                        </div>
                                        <span className="font-mono shrink-0 flex flex-col items-end gap-0.5">
                                          <span style={{ color: 'var(--tournament-primary-text)' }}>
                                            {p.kills}<span className="opacity-20">/</span>{p.deaths}<span className="opacity-20">/</span>{p.assists}
                                          </span>
                                          {p.gpm > 0 && (
                                            <span className="text-[10px] opacity-40" style={{ color: nameColor }}>
                                              {p.gpm}g · {p.xpm}x
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
                                  <span className="text-xs font-logik-extended-bold uppercase tracking-wide truncate" style={{ color: 'var(--tournament-section-header)' }}>
                                    {match.teamB.name}
                                  </span>
                                  {!teamAWonGame && <span className="ml-auto text-xs shrink-0" style={{ color: divisionColor }}>✓ Win</span>}
                                </div>
                                <div className="space-y-1">
                                  {rightPerfs.slice(0, 5).map((p, i) => {
                                    const playerData = matchPlayers[p.playerId];
                                    const playerName = playerData?.nickname || `Nieznany (ID: ${p.playerId})`;
                                    const isStandin = playerData?.role === 'standin';
                                    const isUnknown = !playerData || (playerData.role !== 'registered' && playerData.role !== 'standin');
                                    const nameColor = isStandin ? 'var(--tournament-heading)' : isUnknown ? 'rgba(255,255,255,0.35)' : 'var(--tournament-primary-text)';
                                    const playerMmr = mmrByNickname[playerName.toLowerCase()];

                                    return (
                                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <div className="flex items-baseline gap-1 min-w-0">
                                            <span className="truncate font-medium uppercase tracking-wide" style={{ color: nameColor }} title={playerName}>
                                              {playerName}
                                            </span>
                                            {playerMmr ? <span className="shrink-0 text-[10px] opacity-40" style={{ color: nameColor }}>({playerMmr})</span> : null}
                                          </div>
                                          {isStandin && playerData.replacedPlayerNickname && (
                                            <span className="truncate text-[10px] opacity-50" style={{ color: 'var(--tournament-heading)' }} title={`Za: ${playerData.replacedPlayerNickname}`}>
                                              za {playerData.replacedPlayerNickname}
                                            </span>
                                          )}
                                          <span className="truncate text-[10px] opacity-40" style={{ color: nameColor }} title={getHeroName(p.heroId)}>
                                            {getHeroName(p.heroId)}
                                          </span>
                                        </div>
                                        <span className="font-mono shrink-0 flex flex-col items-end gap-0.5">
                                          <span style={{ color: 'var(--tournament-primary-text)' }}>
                                            {p.kills}<span className="opacity-20">/</span>{p.deaths}<span className="opacity-20">/</span>{p.assists}
                                          </span>
                                          {p.gpm > 0 && (
                                            <span className="text-[10px] opacity-40" style={{ color: nameColor }}>
                                              {p.gpm}g · {p.xpm}x
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
                        const games = formatGameNumbers(entry.gameNumbers);
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-white/30 shrink-0">{teamName}:</span>
                            <span className="text-blue-400 font-medium">{entry.nickname}</span>
                            <span className="text-white/20">za</span>
                            <span className="text-white/50">{entry.replacedPlayerNickname}</span>
                            <span className="text-white/30">{games ? `(${games})` : '(cała seria)'}</span>
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
                      <p className="text-[11px] font-logik-extended-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tournament-section-header)' }}>
                        {match.teamA.name}
                      </p>
                      {renderTeamRoster(teamAPlayers, match.teamA.id)}
                    </div>
                    {/* Team B */}
                    <div className="p-4">
                      <p className="text-[11px] font-logik-extended-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tournament-section-header)' }}>
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
