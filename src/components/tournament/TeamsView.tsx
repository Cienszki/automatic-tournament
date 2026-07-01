'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Users, X, Swords, Sparkles, Shield, HandHelping, Eye,
  Copy, Check, ChevronLeft, ChevronRight, ChevronDown,
  ExternalLink, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getHeroName } from '@/lib/hero-mapping';
import type { Team, Player, PlayerRole, PlayerPerformanceInMatch, Match } from '@/lib/definitions';
import { MatchDetailModal } from '@/components/divisions/MatchDetailModal';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { usePageSize } from '@/hooks/usePageSize';
import { useIsMobile } from '@/hooks/use-mobile';

interface GameHistoryItem {
  gameId: string;
  matchId: string;
  opponentTeam: { id: string; name: string; logoUrl?: string };
  won: boolean;
  teamKills: number;
  opponentKills: number;
  durationSeconds: number;
  date: Date;
}

// ─── Division tier colors matching the PDLTeamCard premium theme ────

const DIVISION_TIER_STYLES: Record<string, { gradient: string; glow: string; text: string; lightBorder: string; foil: string }> = {
  elite: {
    gradient: 'from-amber-500/20 via-yellow-400/10 to-transparent',
    glow: 'rgba(255, 215, 0, 0.4)',
    text: 'text-pdl-gold',
    lightBorder: 'border-pdl-gold/40',
    foil: 'bg-gradient-to-tr from-[#FFD700]/20 via-[#FDB931]/10 to-transparent',
  },
  challenger: {
    gradient: 'from-slate-400/20 via-gray-300/10 to-transparent',
    glow: 'rgba(192, 192, 192, 0.4)',
    text: 'text-pdl-silver',
    lightBorder: 'border-pdl-silver/40',
    foil: 'bg-gradient-to-tr from-[#E0E0E0]/20 via-[#B0B0B0]/10 to-transparent',
  },
  adept: {
    gradient: 'from-orange-700/20 via-amber-600/10 to-transparent',
    glow: 'rgba(205, 127, 50, 0.4)',
    text: 'text-pdl-bronze',
    lightBorder: 'border-pdl-bronze/40',
    foil: 'bg-gradient-to-tr from-[#CD7F32]/20 via-[#8B4513]/10 to-transparent',
  },
};

const DEFAULT_TIER_STYLE = {
  gradient: 'from-gray-500/20 via-gray-400/10 to-transparent',
  glow: 'rgba(128, 128, 128, 0.4)',
  text: 'text-gray-400',
  lightBorder: 'border-gray-400/40',
  foil: 'bg-gradient-to-tr from-gray-500/20 via-gray-400/10 to-transparent',
};

function getDivisionStyle(team: Team) {
  const divisionKey = (team.divisionId || team.division || '').toLowerCase();
  const validKey = ['elite', 'challenger', 'adept'].includes(divisionKey) ? divisionKey : '';
  return { style: validKey ? DIVISION_TIER_STYLES[validKey] : DEFAULT_TIER_STYLE, validKey };
}

// Noise texture data URI (shared)
const NOISE_BG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

const getRoleIcon = (role: PlayerRole, className: string = 'h-3.5 w-3.5') => {
  switch (role) {
    case 'Carry': return <Swords className={className} />;
    case 'Mid': return <Sparkles className={className} />;
    case 'Offlane': return <Shield className={className} />;
    case 'Soft Support': return <HandHelping className={className} />;
    case 'Hard Support': return <Eye className={className} />;
    default: return null;
  }
};

const ROLE_ORDER: PlayerRole[] = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];

function sortPlayersByRole(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const aIdx = ROLE_ORDER.indexOf(a.role);
    const bIdx = ROLE_ORDER.indexOf(b.role);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });
}

// ─── Player game data for profile view ──────────────────────────────

interface PlayerGameRecord {
  gameId: string;
  matchId: string;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  won: boolean;
  enemyTeamName: string;
  gpm: number;
  xpm: number;
}

// ─── Grid configuration based on team count ─────────────────────────

interface GridConfig {
  columns: number;
  rows: number;
  minSlots: number;
}

function getGridConfig(teamCount: number): GridConfig {
  const count = Math.max(teamCount, 8);
  if (count <= 8) return { columns: 4, rows: 2, minSlots: 8 };
  if (count <= 9) return { columns: 3, rows: 3, minSlots: 9 };
  if (count <= 12) return { columns: 4, rows: 3, minSlots: 12 };
  if (count <= 16) return { columns: 4, rows: 4, minSlots: 16 };
  if (count <= 20) return { columns: 5, rows: 4, minSlots: 20 };
  if (count <= 24) return { columns: 6, rows: 4, minSlots: 24 };
  if (count <= 28) return { columns: 7, rows: 4, minSlots: 28 };
  return { columns: 8, rows: 4, minSlots: 32 };
}

// ─── Collapsed Team Card (PDLTeamCard styling) ──────────────────────

interface CollapsedCardProps {
  team: Team;
  isSelected: boolean;
  onSelect: () => void;
  compact: boolean;
}

function CollapsedTeamCard({ team, isSelected, onSelect, compact }: CollapsedCardProps) {
  const { theme } = useTournament();
  const { style, validKey } = getDivisionStyle(team);

  return (
    <div className="w-full h-full" style={{ containerType: 'size' }}>
      <button
        onClick={onSelect}
        className={cn(
          'relative flex flex-col items-center justify-center overflow-hidden w-full h-full',
          'transition-all duration-300 cursor-pointer group rounded-2xl',
          'border border-none',
        )}
      >
        {/* Noise Texture Overlay */}
        <div
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: NOISE_BG }}
        />

        {/* Center vignette hover glow — radial, not touching edges */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none"
          style={{
            background: validKey
              ? `radial-gradient(ellipse 60% 50% at center, ${style.glow}18, transparent 70%)`
              : 'radial-gradient(ellipse 60% 50% at center, rgba(255,255,255,0.04), transparent 70%)',
          }}
        />

        {/* Holographic Foil Gradient */}
        <div
          className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-soft-light pointer-events-none',
            style.foil,
          )}
        />

        {/* Animated Sheen */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer z-10 pointer-events-none" />

        {/* Content — fills the entire card */}
        <div
          className="relative z-20 flex flex-col items-center justify-center w-full h-full"
          style={{ padding: '3cqmin' }}
        >
          {/* Logo — scales with card size */}
          <div
            className={cn(
              'relative shrink-0 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center',
              'border border-white/10 group-hover:border-white/30 transition-colors shadow-xl',
            )}
            style={{ width: '65cqmin', height: '65cqmin' }}
          >
            {team.logoUrl && team.logoUrl.trim() !== '' ? (
              <Image
                src={team.logoUrl}
                alt={team.name}
                fill
                sizes="(max-width: 768px) 80px, 120px"
                className="object-cover"
                unoptimized
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}
            <div
              className="font-logik-extended-bold absolute inset-0 flex items-center justify-center"
              style={{
                fontSize: 'clamp(12px, 20cqmin, 48px)',
                color: theme?.titleColor || theme?.textColor || '#ffffff',
                fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                zIndex: team.logoUrl && team.logoUrl.trim() !== '' ? -1 : 1,
              }}
            >
              {team.name.charAt(0)}
            </div>
          </div>

          {/* Team Name — scales with card size */}
          <span
            className="font-logik-extended-bold uppercase tracking-wide text-center leading-tight drop-shadow-md"
            style={{
              fontSize: 'clamp(8px, 8cqmin, 16px)',
              marginTop: '2cqmin',
              paddingLeft: '2cqmin',
              paddingRight: '2cqmin',
              color: theme?.titleColor || theme?.textColor || '#ffffff',
              fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
            }}
          >
            {team.name}
          </span>
        </div>

        {/* Bottom glow bar */}
        <motion.div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 shadow-[0_-2px_10px_rgba(255,255,255,0.3)] pointer-events-none',
            style.gradient,
          )}
          initial={{ scaleX: 0 }}
          whileHover={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: 'circOut' }}
        />
      </button>
    </div>
  );
}

// ─── Discord copy button ────────────────────────────────────────────

function DiscordCopyButton({ discord, useTournamentVars = false }: { discord: string; useTournamentVars?: boolean }) {
  const { theme } = useTournament();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(discord);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [discord]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center w-full gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.06] transition-colors group/copy"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
        className="w-4 h-4 shrink-0" style={{ color: useTournamentVars ? 'var(--tournament-primary-text)' : (theme?.textColor || theme?.primaryTextColor || '#ffffff') }}>
        <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.2 13.2 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
      </svg>
      <span
        className="text-xs font-medium"
        style={{ color: useTournamentVars ? 'var(--tournament-primary-text)' : (theme?.primaryTextColor || theme?.textColor || '#ffffff') }}
      >
        {discord}
      </span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover/copy:opacity-100 transition-opacity"
          style={{ color: useTournamentVars ? 'var(--tournament-secondary-text)' : (theme?.secondaryTextColor || 'rgba(255,255,255,0.5)') }}
        />
      )}
      {copied && (
        <span className="text-[10px] text-green-400 font-medium">Skopiowano!</span>
      )}
    </button>
  );
}

// ─── Most Played Heroes Sub-component ────────────────────────────────

interface HeroEntry {
  heroId: number;
  games: number;
  win: number;
}

function HeroRow({ hero, theme, useTournamentVars = false }: { hero: HeroEntry; theme: any; useTournamentVars?: boolean }) {
  const winRate = hero.games > 0 ? Math.round((hero.win / hero.games) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs truncate flex-1" style={{ color: useTournamentVars ? 'var(--tournament-primary-text)' : (theme?.primaryTextColor || '#fff') }}>
        {getHeroName(hero.heroId)}
      </span>
      <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: useTournamentVars ? 'var(--tournament-secondary-text)' : (theme?.secondaryTextColor || 'rgba(255,255,255,0.5)') }}>
        {hero.games}g
      </span>
      <span className={cn('text-[11px] font-mono tabular-nums shrink-0', winRate >= 55 ? 'text-green-400' : winRate <= 45 ? 'text-red-400' : '')}
        style={winRate > 45 && winRate < 55 ? { color: useTournamentVars ? 'var(--tournament-secondary-text)' : (theme?.secondaryTextColor || 'rgba(255,255,255,0.5)') } : undefined}>
        {winRate}%
      </span>
    </div>
  );
}

function MostPlayedHeroesSection({ heroes, theme, useTournamentVars = false }: { heroes?: { overall: HeroEntry[]; recent: HeroEntry[]; lastUpdated?: string }; theme: any; useTournamentVars?: boolean }) {
  if (!heroes || (!heroes.overall?.length && !heroes.recent?.length)) {
    return (
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: useTournamentVars ? 'var(--tournament-secondary-text)' : (theme?.secondaryTextColor || 'rgba(255,255,255,0.4)') }}>
          Brak danych o bohaterach
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3 space-y-3">
      {heroes.overall.length > 0 && (
        <div>
          <h5 className="text-[10px] uppercase tracking-widest mb-1" style={{ color: useTournamentVars ? 'var(--tournament-section-header)' : (theme?.secondaryTextColor || 'rgba(255,255,255,0.5)') }}>
            Najczęściej grane – ogólne
          </h5>
          <div className="space-y-0.5">
            {heroes.overall.map(h => <HeroRow key={h.heroId} hero={h} theme={theme} useTournamentVars={useTournamentVars} />)}
          </div>
        </div>
      )}
      {heroes.recent.length > 0 && (
        <div>
          <h5 className="text-[10px] uppercase tracking-widest mb-1" style={{ color: useTournamentVars ? 'var(--tournament-section-header)' : (theme?.secondaryTextColor || 'rgba(255,255,255,0.5)') }}>
            Najczęściej grane – ostatnie 6 mies.
          </h5>
          <div className="space-y-0.5">
            {heroes.recent.map(h => <HeroRow key={h.heroId} hero={h} theme={theme} useTournamentVars={useTournamentVars} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Player Profile View (inside expanded panel) ────────────────────

interface PlayerProfileProps {
  player: Player;
  team: Team;
  onBack: () => void;
}

function PlayerProfile({ player, team, onBack }: PlayerProfileProps) {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const isMobile = useIsMobile();
  const [games, setGames] = useState<PlayerGameRecord[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [smurfsOpen, setSmurfsOpen] = useState(false);
  const [selectedMatchForModal, setSelectedMatchForModal] = useState<Match | null>(null);

  // Fresh data fetched directly from the team's roster map entry
  const [smurfAccounts, setSmurfAccounts] = useState<{ steamProfileUrl: string; steamId64?: string; steamId32?: string }[] | undefined>(player.smurfAccounts);
  const [mostPlayedHeroes, setMostPlayedHeroes] = useState<Player['mostPlayedHeroes']>(player.mostPlayedHeroes);
  const [loadingExtra, setLoadingExtra] = useState(true);

  const GAMES_PER_PAGE = 20;

  const handleGameClick = async (matchId: string) => {
    if (!tournament?.id || isLegacyTournament || !matchId) return;
    try {
      const matchDoc = await getDoc(doc(db, 'tournaments', tournament.id, 'matches', matchId));
      if (matchDoc.exists()) {
        const m = matchDoc.data();
        setSelectedMatchForModal({
          id: matchDoc.id,
          teamA: { id: m.teamA?.id || '', name: m.teamA?.name || '', score: m.teamA?.score ?? 0, logoUrl: m.teamA?.logoUrl || '' },
          teamB: { id: m.teamB?.id || '', name: m.teamB?.name || '', score: m.teamB?.score ?? 0, logoUrl: m.teamB?.logoUrl || '' },
          teams: m.teams || [],
          status: m.status || 'completed',
          scheduledFor: m.scheduledFor || m.completed_at || '',
          schedulingStatus: 'confirmed',
          series_format: m.series_format,
          completed_at: m.completed_at,
        } as Match);
      }
    } catch (e) {
      console.warn('[PlayerProfile] Failed to load match:', e);
    }
  };

  const accountId = player.steamId32 || player.openDotaAccountId?.toString() || '';
  const steamProfileUrl = player.steamProfileUrl || (player.steamId ? `https://steamcommunity.com/profiles/${player.steamId}` : '');
  const dotabuffUrl = accountId ? `https://www.dotabuff.com/players/${accountId}` : '';
  const opendotaUrl = accountId ? `https://www.opendota.com/players/${accountId}` : '';

  // Fetch fresh smurfAccounts + mostPlayedHeroes directly from Firestore roster entry
  // so the card always reflects current DB state regardless of page-load cache.
  useEffect(() => {
    const fetchRosterData = async () => {
      if (!tournament?.id || isLegacyTournament) { setLoadingExtra(false); return; }
      try {
        const teamDoc = await getDoc(doc(db, 'tournaments', tournament.id, 'teams', team.id));
        if (teamDoc.exists()) {
          const roster = teamDoc.data().roster as Record<string, any> | undefined;
          const steamId64 = player.steamId || player.id;
          const entry = roster?.[steamId64];
          if (entry) {
            if (entry.smurfAccounts?.length) setSmurfAccounts(entry.smurfAccounts);
            if (entry.mostPlayedHeroes) setMostPlayedHeroes(entry.mostPlayedHeroes);
          }
        }
      } catch (e) {
        console.warn('[PlayerProfile] Failed to fetch fresh roster data:', e);
      }
      setLoadingExtra(false);
    };
    fetchRosterData();
  }, [tournament?.id, team.id, player.steamId, player.id, isLegacyTournament]);

  // Fetch player games from performances subcollections
  useEffect(() => {
    const load = async () => {
      if (!tournament?.id) { setLoadingGames(false); return; }
      setLoadingGames(true);
      try {
        const steamId64 = player.steamId || player.steamId64 || player.id;
        const steamId32 = player.steamId32;
        const gameRecords: PlayerGameRecord[] = [];

        if (isLegacyTournament) {
          // Legacy Letnia: performances stored as array field on match docs
          const matchesSnap = await getDocs(collection(db, 'matches'));
          await Promise.all(matchesSnap.docs.map(async (matchDoc) => {
            const matchData = matchDoc.data();
            const involvedTeams: string[] = matchData.teams || [];
            if (!involvedTeams.includes(team.id)) return;

            const playerPerfs = matchData.playerPerformances as Array<PlayerPerformanceInMatch & { steamId32?: string; steamId?: string; heroId?: number }> | undefined;
            if (!playerPerfs) return;
            const perf = playerPerfs.find(p =>
              p.playerId === steamId64 ||
              (steamId32 && p.steamId32 === steamId32) ||
              p.steamId === player.steamId,
            );
            if (!perf) return;

            const teamAId = matchData.teamA?.id;
            const teamBId = matchData.teamB?.id;
            const enemyTeamName = team.id === teamAId ? matchData.teamB?.name : matchData.teamA?.name;
            const scoreA = matchData.teamA?.score ?? matchData.scoreA ?? 0;
            const scoreB = matchData.teamB?.score ?? matchData.scoreB ?? 0;
            const won = team.id === teamAId ? scoreA > scoreB : scoreB > scoreA;

            gameRecords.push({
              gameId: matchDoc.id,
              matchId: matchDoc.id,
              heroId: perf.heroId ?? 0,
              kills: perf.kills ?? 0,
              deaths: perf.deaths ?? 0,
              assists: perf.assists ?? 0,
              won,
              enemyTeamName: enemyTeamName || 'Unknown',
              gpm: perf.gpm ?? 0,
              xpm: perf.xpm ?? 0,
            });
          }));
        } else {
          // New tournaments (PDL): read from denormalized playerGameHistory
          const historyRef = collection(db, 'tournaments', tournament.id, 'playerGameHistory', steamId64, 'games');
          const historySnap = await getDocs(historyRef);
          historySnap.docs.forEach(doc => {
            const h = doc.data();
            gameRecords.push({
              gameId: h.gameId,
              matchId: h.matchId,
              heroId: h.heroId ?? 0,
              kills: h.kills ?? 0,
              deaths: h.deaths ?? 0,
              assists: h.assists ?? 0,
              won: h.won ?? false,
              enemyTeamName: h.enemyTeamName || 'Unknown',
              gpm: h.gpm ?? 0,
              xpm: h.xpm ?? 0,
            });
          });
        }

        gameRecords.sort((a, b) => parseInt(b.gameId) - parseInt(a.gameId));
        setGames(gameRecords);
      } catch (err) {
        console.error('Failed to load player games:', err);
      }
      setLoadingGames(false);
    };
    load();
  }, [tournament?.id, player.id, player.steamId, isLegacyTournament, team.id]);

  const totalPages = Math.max(1, Math.ceil(games.length / GAMES_PER_PAGE));
  const paginatedGames = games.slice(currentPage * GAMES_PER_PAGE, (currentPage + 1) * GAMES_PER_PAGE);

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs uppercase tracking-widest hover:opacity-80 transition-opacity"
          style={{ color: 'var(--tournament-secondary-text)' }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Powrót do drużyny
        </button>

        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10">
              {(player.avatarfull || player.avatarmedium || player.avatar) ? (
                <Image
                  src={player.avatarfull || player.avatarmedium || player.avatar || ''}
                  alt={player.nickname}
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ color: 'var(--tournament-title)' }}>
                  {player.nickname.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4
                className="text-base font-logik-extended-bold uppercase tracking-tight truncate"
                style={{ color: 'var(--tournament-title)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}
              >
                {player.nickname}
              </h4>
              <p className="text-xs" style={{ color: 'var(--tournament-secondary-text)' }}>{team.name}</p>
            </div>
            {player.mmr > 0 && (
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--tournament-secondary-text)' }}>MMR</p>
                <p className="text-sm font-logik-extended-bold" style={{ color: 'var(--tournament-title)' }}>{player.mmr}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--tournament-section-header)' }}>
            Profile
          </p>
          <div className="flex flex-wrap gap-2">
            {steamProfileUrl && (
              <a href={steamProfileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                style={{ color: 'var(--tournament-primary-text)' }}>
                <ExternalLink className="w-3 h-3" /> Steam
              </a>
            )}
            {dotabuffUrl && (
              <a href={dotabuffUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                style={{ color: 'var(--tournament-primary-text)' }}>
                <ExternalLink className="w-3 h-3" /> Dotabuff
              </a>
            )}
            {opendotaUrl && (
              <a href={opendotaUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                style={{ color: 'var(--tournament-primary-text)' }}>
                <ExternalLink className="w-3 h-3" /> OpenDota
              </a>
            )}
          </div>
        </div>

        {(smurfAccounts && smurfAccounts.length > 0) && (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <button
              onClick={() => setSmurfsOpen(!smurfsOpen)}
              className="flex items-center gap-1.5 text-xs uppercase tracking-widest hover:opacity-80 transition-opacity"
              style={{ color: 'var(--tournament-heading)' }}
            >
              <ChevronDown className={cn('w-3 h-3 transition-transform', smurfsOpen && 'rotate-180')} />
              Konta dodatkowe ({smurfAccounts.length})
            </button>
            {smurfsOpen && (
              <div className="space-y-1.5 mt-2">
                {smurfAccounts.map((smurf, idx) => {
                  const smurfUrl = smurf.steamProfileUrl;
                  const smurfSteam32 = (smurf as any).steamId32 || (() => {
                    const id64 = (smurf as any).steamId64 || smurfUrl?.match(/\/profiles\/(\d{17,})/)?.[1] || '';
                    if (!id64) return '';
                    try { return String(BigInt(id64) - 76561197960265728n); } catch { return ''; }
                  })();
                  const smurfDotabuff = smurfSteam32 ? `https://www.dotabuff.com/players/${smurfSteam32}` : '';
                  const smurfOpendota = smurfSteam32 ? `https://www.opendota.com/players/${smurfSteam32}` : '';
                  return (
                    <div key={idx} className="flex flex-wrap gap-2">
                      {smurfUrl && <a href={smurfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors" style={{ color: 'var(--tournament-primary-text)' }}><ExternalLink className="w-2.5 h-2.5" /> Steam</a>}
                      {smurfDotabuff && <a href={smurfDotabuff} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors" style={{ color: 'var(--tournament-primary-text)' }}><ExternalLink className="w-2.5 h-2.5" /> Dotabuff</a>}
                      {smurfOpendota && <a href={smurfOpendota} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors" style={{ color: 'var(--tournament-primary-text)' }}><ExternalLink className="w-2.5 h-2.5" /> OpenDota</a>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!smurfsOpen && (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--tournament-section-header)' }}>
              Najczęściej grane
            </p>
            {loadingExtra ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--tournament-secondary-text)' }}>Ładowanie...</span>
              </div>
            ) : (
              <MostPlayedHeroesSection heroes={mostPlayedHeroes} theme={theme} useTournamentVars />
            )}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--tournament-section-header)' }}>
            Historia gier
          </p>
          {loadingGames ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : games.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--tournament-secondary-text)' }}>Brak rozegranych gier.</p>
          ) : (
            <>
              <div className="space-y-1">
                {paginatedGames.map((game) => (
                  <button
                    key={game.gameId}
                    onClick={() => handleGameClick(game.matchId)}
                    disabled={isLegacyTournament || !game.matchId}
                    className="flex items-center gap-2 w-full py-1.5 px-2 rounded text-xs hover:bg-white/[0.06] transition-colors disabled:cursor-default text-left"
                  >
                    <span className="truncate w-20 shrink-0" style={{ color: 'var(--tournament-secondary-text)' }}>
                      {game.enemyTeamName}
                    </span>
                    <span className="shrink-0" style={{ color: 'var(--tournament-primary-text)' }}>
                      {getHeroName(game.heroId)}
                    </span>
                    <span className="shrink-0 font-mono" style={{ color: 'var(--tournament-primary-text)' }}>
                      {game.kills}/{game.deaths}/{game.assists}
                    </span>
                    <span className={cn('shrink-0 font-bold text-[10px] uppercase', game.won ? 'text-green-400' : 'text-red-400')}>
                      {game.won ? 'W' : 'L'}
                    </span>
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2 mt-1 border-t border-white/[0.06]">
                  <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-all">
                    <ChevronLeft className="w-3.5 h-3.5" style={{ color: 'var(--tournament-heading)' }} />
                  </button>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--tournament-secondary-text)' }}>
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-all">
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--tournament-heading)' }} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <MatchDetailModal
          match={selectedMatchForModal}
          isOpen={selectedMatchForModal !== null}
          onClose={() => setSelectedMatchForModal(null)}
          divisionColor={theme?.primaryColor || '#666'}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs uppercase tracking-widest mb-3 hover:opacity-80 transition-opacity"
        style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Powrót do drużyny
      </button>

      {/* 2-column layout */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* Left column: Player info */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10">
              {(player.avatarfull || player.avatarmedium || player.avatar) ? (
                <Image
                  src={player.avatarfull || player.avatarmedium || player.avatar || ''}
                  alt={player.nickname}
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl font-bold"
                  style={{ color: theme?.titleColor || '#fff' }}>
                  {player.nickname.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h4
                className="text-lg font-logik-extended-bold uppercase tracking-tight"
                style={{ color: theme?.titleColor || '#fff', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}
              >
                {player.nickname}
              </h4>
              <p className="text-xs" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }}>
                {team.name}
              </p>
            </div>
          </div>

          {/* MMR */}
          {player.mmr > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-widest"
                style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>MMR</span>
              <span className="text-sm font-logik-extended-bold"
                style={{ color: theme?.titleColor || '#fff' }}>{player.mmr}</span>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-2 mb-4">
            {steamProfileUrl && (
              <a href={steamProfileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                style={{ color: theme?.primaryTextColor || '#fff' }}>
                <ExternalLink className="w-3 h-3" /> Steam
              </a>
            )}
            {dotabuffUrl && (
              <a href={dotabuffUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                style={{ color: theme?.primaryTextColor || '#fff' }}>
                <ExternalLink className="w-3 h-3" /> Dotabuff
              </a>
            )}
            {opendotaUrl && (
              <a href={opendotaUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                style={{ color: theme?.primaryTextColor || '#fff' }}>
                <ExternalLink className="w-3 h-3" /> OpenDota
              </a>
            )}
          </div>

          {/* Smurf Accounts toggle + Most Played Heroes */}
          {smurfAccounts && smurfAccounts.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setSmurfsOpen(!smurfsOpen)}
                className="flex items-center gap-1.5 text-xs uppercase tracking-widest hover:opacity-80 transition-opacity"
                style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }}
              >
                <ChevronDown className={cn('w-3 h-3 transition-transform', smurfsOpen && 'rotate-180')} />
                Konta dodatkowe ({smurfAccounts.length})
              </button>
            </div>
          )}

          {smurfsOpen && smurfAccounts && smurfAccounts.length > 0 ? (
            /* Smurf accounts list (replaces heroes when open) */
            <div className="space-y-1.5 mb-3">
              {smurfAccounts.map((smurf, idx) => {
                const smurfUrl = smurf.steamProfileUrl;
                const smurfSteam32 = (smurf as any).steamId32 || (() => {
                  const id64 = (smurf as any).steamId64 || smurfUrl?.match(/\/profiles\/(\d{17,})/)?.[1] || '';
                  if (!id64) return '';
                  try { return String(BigInt(id64) - 76561197960265728n); } catch { return ''; }
                })();
                const smurfDotabuff = smurfSteam32 ? `https://www.dotabuff.com/players/${smurfSteam32}` : '';
                const smurfOpendota = smurfSteam32 ? `https://www.opendota.com/players/${smurfSteam32}` : '';
                return (
                  <div key={idx} className="flex flex-wrap gap-2">
                    {smurfUrl && (
                      <a href={smurfUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                        style={{ color: theme?.primaryTextColor || '#fff' }}>
                        <ExternalLink className="w-2.5 h-2.5" /> Steam
                      </a>
                    )}
                    {smurfDotabuff && (
                      <a href={smurfDotabuff} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                        style={{ color: theme?.primaryTextColor || '#fff' }}>
                        <ExternalLink className="w-2.5 h-2.5" /> Dotabuff
                      </a>
                    )}
                    {smurfOpendota && (
                      <a href={smurfOpendota} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                        style={{ color: theme?.primaryTextColor || '#fff' }}>
                        <ExternalLink className="w-2.5 h-2.5" /> OpenDota
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : loadingExtra ? (
            <div className="mb-3 flex items-center gap-2">
              <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="text-[10px] uppercase tracking-widest" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                Ładowanie...
              </span>
            </div>
          ) : (
            /* Most Played Heroes section (shown when smurfs are collapsed) */
            <MostPlayedHeroesSection heroes={mostPlayedHeroes} theme={theme} />
          )}
        </div>

        {/* Right column: Game history */}
        <div className="flex-1 flex flex-col min-w-0">
          <h4
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }}
          >
            Historia gier
          </h4>

          {loadingGames ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : games.length === 0 ? (
            <p className="text-xs" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
              Brak rozegranych gier.
            </p>
          ) : (
            <>
              {/* Game rows */}
              <div className="flex-1 space-y-1 min-h-0 overflow-y-auto">
                {paginatedGames.map((game) => (
                  <button
                    key={game.gameId}
                    onClick={() => handleGameClick(game.matchId)}
                    disabled={isLegacyTournament || !game.matchId}
                    className="flex items-center gap-2 w-full py-1 px-2 rounded text-xs hover:bg-white/[0.06] transition-colors disabled:cursor-default text-left"
                  >
                    <span className="truncate w-20 shrink-0" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }}>
                      {game.enemyTeamName}
                    </span>
                    <span className="shrink-0" style={{ color: theme?.primaryTextColor || '#fff' }}>
                      {getHeroName(game.heroId)}
                    </span>
                    <span className="shrink-0 font-mono" style={{ color: theme?.primaryTextColor || '#fff' }}>
                      {game.kills}/{game.deaths}/{game.assists}
                    </span>
                    <span className={cn('shrink-0 font-bold text-[10px] uppercase', game.won ? 'text-green-400' : 'text-red-400')}>
                      {game.won ? 'W' : 'L'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2 mt-1 border-t border-white/[0.06]">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" style={{ color: theme?.textColor || '#fff' }} />
                  </button>
                  <span className="text-[10px] font-mono" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }}>
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: theme?.textColor || '#fff' }} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <MatchDetailModal
        match={selectedMatchForModal}
        isOpen={selectedMatchForModal !== null}
        onClose={() => setSelectedMatchForModal(null)}
        divisionColor={theme?.primaryColor || '#666'}
      />
    </div>
  );
}

// ─── Expanded Team Card ─────────────────────────────────────────────
// Shows detailed information about a team — occupies the left half

interface ExpandedCardProps {
  team: Team;
  onClose: () => void;
}

function ExpandedTeamCard({ team, onClose }: ExpandedCardProps) {
  const { theme, tournament } = useTournament();
  const isMobile = useIsMobile();
  const { style } = getDivisionStyle(team);
  const historyPageSize = usePageSize(72);
  const upcomingPageSize = usePageSize(135);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [upcomingMatches, setUpcomingMatches] = useState<{ id: string; teamA: { id: string; name: string; logoUrl?: string }; teamB: { id: string; name: string; logoUrl?: string }; scheduledFor: string; series_format?: string }[]>([]);
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [matchesById, setMatchesById] = useState<Map<string, Match>>(new Map());
  const [selectedMatchForModal, setSelectedMatchForModal] = useState<Match | null>(null);

  const sortedPlayers = useMemo(() => sortPlayersByRole(team.players || []), [team.players]);
  const captainDiscord = team.captainDiscordUsername || team.discordUsername;
  const totalMMR = useMemo(
    () => (team.players || []).reduce((s, p) => s + (Number(p.mmr) || 0), 0),
    [team.players],
  );

  // Fetch upcoming + game history for this team
  useEffect(() => {
    if (!tournament?.id || !team.id) return;
    setUpcomingMatches([]);
    setGameHistory([]);
    setUpcomingPage(0);
    setHistoryPage(0);

    const fetchData = async () => {
      try {
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');

        // Upcoming scheduled matches (also fallback to teamA/teamB for robustness)
        const scheduledSnap = await getDocs(query(matchesRef, where('status', '==', 'scheduled')));
        const upcoming = scheduledSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter((m: any) =>
            (m.teams?.includes(team.id) || m.teamA?.id === team.id || m.teamB?.id === team.id) &&
            !!m.scheduledFor
          )
          .sort((a: any, b: any) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
        setUpcomingMatches(upcoming);

        // Completed matches → per-game history
        const completedSnap = await getDocs(query(matchesRef, where('status', '==', 'completed')));
        const completedMatches = completedSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter((m: any) =>
            // prefer `teams` array (fast), fall back to teamA/teamB comparison for older docs
            m.teams?.includes(team.id) ||
            m.teamA?.id === team.id ||
            m.teamB?.id === team.id
          );

        const gameItems: GameHistoryItem[] = [];
        await Promise.all(
          completedMatches.map(async (match: any) => {
            try {
              const gamesSnap = await getDocs(
                collection(db, 'tournaments', tournament.id, 'matches', match.id, 'games')
              );
              for (const gameDoc of gamesSnap.docs) {
                const g = gameDoc.data();
                const isRadiant = g.radiant_team?.id === team.id;
                const won = isRadiant ? !!g.radiant_win : !g.radiant_win;
                const perfSnap = await getDocs(
                  collection(db, 'tournaments', tournament.id, 'matches', match.id, 'games', gameDoc.id, 'performances')
                );
                let teamKills = 0;
                let opponentKills = 0;
                for (const perfDoc of perfSnap.docs) {
                  const perf = perfDoc.data();
                  if (perf.teamId === team.id) teamKills += perf.kills || 0;
                  else opponentKills += perf.kills || 0;
                }
                const opp = match.teamA?.id === team.id ? match.teamB : match.teamA;
                if (!opp) return;
                gameItems.push({
                  gameId: gameDoc.id,
                  matchId: match.id,
                  opponentTeam: { id: opp.id, name: opp.name, logoUrl: opp.logoUrl },
                  won,
                  teamKills,
                  opponentKills,
                  durationSeconds: g.duration ?? 0,
                  date: new Date((g.start_time ?? 0) * 1000),
                });
              }
            } catch {
              // no games subcollection yet
            }
          })
        );
        gameItems.sort((a, b) => b.date.getTime() - a.date.getTime());
        setGameHistory(gameItems);

        // Build matchesById map for MatchDetailModal
        const newMatchesById = new Map<string, Match>();
        for (const m of upcoming) {
          newMatchesById.set(m.id, {
            id: m.id,
            teamA: { id: m.teamA?.id || '', name: m.teamA?.name || '', score: 0, logoUrl: m.teamA?.logoUrl || '' },
            teamB: { id: m.teamB?.id || '', name: m.teamB?.name || '', score: 0, logoUrl: m.teamB?.logoUrl || '' },
            teams: [m.teamA?.id, m.teamB?.id].filter(Boolean) as string[],
            status: 'scheduled',
            scheduledFor: m.scheduledFor,
            schedulingStatus: 'confirmed',
            series_format: m.series_format as Match['series_format'],
          });
        }
        for (const m of completedMatches) {
          newMatchesById.set(m.id, {
            id: m.id,
            teamA: { id: m.teamA?.id || '', name: m.teamA?.name || '', score: m.teamA?.score ?? 0, logoUrl: m.teamA?.logoUrl || '' },
            teamB: { id: m.teamB?.id || '', name: m.teamB?.name || '', score: m.teamB?.score ?? 0, logoUrl: m.teamB?.logoUrl || '' },
            teams: m.teams || [m.teamA?.id, m.teamB?.id].filter(Boolean) as string[],
            status: 'completed',
            scheduledFor: m.scheduledFor || m.completed_at || '',
            schedulingStatus: 'confirmed',
            series_format: m.series_format as Match['series_format'],
            completed_at: m.completed_at,
          } as Match);
        }
        setMatchesById(newMatchesById);
      } catch {
        // fetch failed silently
      }
    };

    fetchData();
  }, [team.id, tournament?.id]);

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.76, 0, 0.24, 1] }}
      className={cn(
        'w-full flex flex-col border border-none bg-black/25 backdrop-blur-xl relative',
        isMobile ? 'h-auto rounded-xl overflow-visible' : 'h-full rounded-2xl overflow-hidden',
      )}
      style={{ willChange: 'backdrop-filter, transform' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Noise Texture Overlay */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: NOISE_BG }}
      />

      {/* Division glow border */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          boxShadow: `inset 0 0 60px ${style.glow}, 0 0 20px -5px ${style.glow}`,
          border: `1px solid ${style.glow}`,
          borderRadius: '1rem',
        }}
      />

      {/* Holographic Foil Gradient */}
      <div className={cn(
        'absolute inset-0 opacity-30 mix-blend-soft-light pointer-events-none',
        style.foil,
      )} />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-30 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" style={{ color: theme?.textColor || '#fff' }} />
      </button>

      <AnimatePresence mode="wait">
        {selectedPlayer ? (
          <motion.div
            key="player-profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={cn('flex-1 relative z-20', isMobile ? 'p-4 overflow-y-auto' : 'p-6 overflow-hidden')}
          >
            <PlayerProfile
              player={selectedPlayer}
              team={team}
              onBack={() => setSelectedPlayer(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="team-detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={cn('flex-1 flex flex-col relative z-20', isMobile ? 'overflow-y-auto' : 'overflow-hidden')}
          >
            {isMobile ? (
              <div className="p-4 pt-3 space-y-3">
                {/* Team summary */}
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-start gap-3">
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10 flex items-center justify-center">
                      {team.logoUrl && team.logoUrl.trim() !== '' ? (
                        <Image
                          src={team.logoUrl}
                          alt={team.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                      <div
                        className="text-2xl font-logik-extended-bold absolute inset-0 flex items-center justify-center"
                        style={{
                          color: 'var(--tournament-title)',
                          fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                          zIndex: team.logoUrl && team.logoUrl.trim() !== '' ? -1 : 1,
                        }}
                      >
                        {team.name.charAt(0)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-2xl font-logik-extended-bold uppercase tracking-tight leading-tight"
                        style={{
                          color: 'var(--tournament-title)',
                          fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                        }}
                      >
                        {team.name}
                      </h3>
                      {team.tag && (
                        <p
                          className="text-xs font-logik-extended-bold uppercase tracking-widest mt-1"
                          style={{
                            color: 'var(--tournament-heading)',
                            fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                          }}
                        >
                          [{team.tag}]
                        </p>
                      )}
                      {team.motto && (
                        <p
                          className="text-xs italic font-logik mt-1.5 leading-relaxed"
                          style={{
                            color: 'var(--tournament-secondary-text)',
                            fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                          }}
                        >
                          &ldquo;{team.motto}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {team.division && (
                      <span className={cn('text-[10px] uppercase tracking-widest inline-block font-logik', style.text)}>
                        {team.division}
                      </span>
                    )}
                    {team.status && (() => {
                      const statusLabels: Record<string, string> = {
                        pending: 'Oczekuje',
                        verified: 'Zweryfikowana',
                        rejected: 'Odrzucona',
                        eliminated: 'Wyeliminowana',
                        warning: 'Ostrzeżenie',
                        banned: 'Zbanowana',
                      };
                      const label = statusLabels[team.status];
                      if (!label) return null;
                      const isRejected = team.status === 'rejected';
                      return (
                        <span
                          className="text-[10px] uppercase tracking-widest font-logik-extended-bold px-2 py-0.5 rounded-full border bg-white/[0.04] border-white/10"
                          style={isRejected
                            ? { color: 'rgb(248 113 113)', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)' }
                            : { color: 'var(--tournament-section-header)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }
                          }
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Roster */}
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--tournament-section-header)' }}>
                    Skład
                  </p>
                  {sortedPlayers.length > 0 && (
                    <div className="space-y-1">
                      {sortedPlayers.map((player, idx) => (
                        <button
                          key={player.id || idx}
                          onClick={() => setSelectedPlayer(player)}
                          className="flex items-center w-full gap-2 py-2 px-2 rounded-lg hover:bg-white/[0.06] transition-colors text-left"
                        >
                          <div className="shrink-0 w-5 flex justify-center" style={{ color: 'var(--tournament-secondary-text)' }}>
                            {getRoleIcon(player.role, 'h-3.5 w-3.5')}
                          </div>
                          <div className="relative w-8 h-8 rounded-md overflow-hidden bg-black/30 shrink-0 border border-white/10">
                            {(player.avatar || player.avatarmedium) ? (
                              <Image
                                src={player.avatarmedium || player.avatar || ''}
                                alt={player.nickname}
                                fill
                                sizes="32px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[11px] font-bold" style={{ color: 'var(--tournament-title)' }}>
                                {player.nickname.charAt(0)}
                              </div>
                            )}
                          </div>
                          <span
                            className="text-xs font-logik-extended-bold uppercase tracking-wide truncate flex-1"
                            style={{
                              color: 'var(--tournament-primary-text)',
                              fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                            }}
                          >
                            {player.nickname}
                          </span>
                          {player.mmr != null && Number(player.mmr) > 0 && (
                            <span className="text-xs font-mono shrink-0 ml-auto pl-2" style={{ color: 'var(--tournament-secondary-text)' }}>
                              {player.mmr}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Captain + MMR */}
                {(captainDiscord || totalMMR > 0) && (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--tournament-section-header)' }}>
                      Kontakt i MMR
                    </p>
                    <div className="flex items-center gap-2">
                      {captainDiscord && (
                        <div className="flex-1 min-w-0">
                          <DiscordCopyButton discord={captainDiscord} useTournamentVars />
                        </div>
                      )}
                      {totalMMR > 0 && (
                        <span className="text-xs font-mono shrink-0" style={{ color: 'var(--tournament-secondary-text)' }}>
                          Σ {totalMMR.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Upcoming matches */}
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--tournament-section-header)' }}>
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] uppercase tracking-[0.18em]">Nadchodzące mecze</span>
                  </div>
                  {upcomingMatches.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--tournament-secondary-text)' }}>Brak zaplanowanych meczów.</p>
                  ) : (
                    <>
                      {upcomingMatches
                        .slice(upcomingPage * upcomingPageSize, (upcomingPage + 1) * upcomingPageSize)
                        .map((match) => {
                          const opp = match.teamA?.id === team.id ? match.teamB : match.teamA;
                          if (!opp) return null;
                          return (
                            <button
                              key={match.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedMatchForModal(matchesById.get(match.id) || null); }}
                              className="flex items-center gap-2 w-full py-2 px-2 rounded-lg hover:bg-white/[0.07] transition-colors text-left"
                            >
                              <div className="w-6 h-6 rounded shrink-0 bg-white/10 overflow-hidden flex items-center justify-center text-[10px]" style={{ color: 'var(--tournament-secondary-text)' }}>
                                {opp.logoUrl ? (
                                  <Image src={opp.logoUrl} alt={opp.name} width={24} height={24} className="object-cover" unoptimized />
                                ) : opp.name.charAt(0)}
                              </div>
                              <span className="text-xs font-logik truncate flex-1" style={{ color: 'var(--tournament-primary-text)' }}>
                                vs {opp.name}
                              </span>
                              <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--tournament-secondary-text)' }}>
                                {format(new Date(match.scheduledFor), 'dd.MM HH:mm', { locale: pl })}
                              </span>
                            </button>
                          );
                        })}
                      {upcomingMatches.length > upcomingPageSize && (
                        <div className="flex justify-between items-center mt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setUpcomingPage(p => Math.max(0, p - 1)); }}
                            disabled={upcomingPage === 0}
                            className="text-[10px] font-mono disabled:opacity-20"
                            style={{ color: 'var(--tournament-heading)' }}
                          >← Poprz.</button>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--tournament-secondary-text)' }}>
                            {upcomingPage + 1}/{Math.ceil(upcomingMatches.length / upcomingPageSize)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setUpcomingPage(p => Math.min(Math.ceil(upcomingMatches.length / upcomingPageSize) - 1, p + 1)); }}
                            disabled={(upcomingPage + 1) * upcomingPageSize >= upcomingMatches.length}
                            className="text-[10px] font-mono disabled:opacity-20"
                            style={{ color: 'var(--tournament-heading)' }}
                          >Nast. →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Game history */}
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--tournament-section-header)' }}>
                    <Swords className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] uppercase tracking-[0.18em]">Historia gier</span>
                  </div>
                  {gameHistory.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--tournament-secondary-text)' }}>Brak danych o grach.</p>
                  ) : (
                    <>
                      {gameHistory
                        .slice(historyPage * historyPageSize, (historyPage + 1) * historyPageSize)
                        .map((game) => {
                          const dMin = Math.floor(game.durationSeconds / 60);
                          const dSec = game.durationSeconds % 60;
                          return (
                            <button
                              key={`${game.matchId}-${game.gameId}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedMatchForModal(matchesById.get(game.matchId) || null); }}
                              className="flex items-center gap-2 w-full py-2 px-2 rounded-lg hover:bg-white/[0.07] transition-colors text-left"
                            >
                              <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: game.won ? '#10b981' : '#ef4444' }} />
                              <div className="w-6 h-6 rounded shrink-0 bg-white/10 overflow-hidden flex items-center justify-center text-[10px]" style={{ color: 'var(--tournament-secondary-text)' }}>
                                {game.opponentTeam.logoUrl ? (
                                  <Image src={game.opponentTeam.logoUrl} alt={game.opponentTeam.name} width={24} height={24} className="object-cover" unoptimized />
                                ) : game.opponentTeam.name.charAt(0)}
                              </div>
                              <span className="text-xs font-logik truncate flex-1" style={{ color: 'var(--tournament-primary-text)' }}>
                                vs {game.opponentTeam.name}
                              </span>
                              <span className="text-[10px] font-mono shrink-0">
                                <span style={{ color: game.won ? '#10b981' : '#ef4444' }}>{game.teamKills}</span>
                                <span style={{ color: 'var(--tournament-secondary-text)' }}>:</span>
                                <span style={{ color: game.won ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)' }}>{game.opponentKills}</span>
                              </span>
                              <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--tournament-secondary-text)' }}>
                                {dMin}:{String(dSec).padStart(2, '0')}
                              </span>
                            </button>
                          );
                        })}
                      {gameHistory.length > historyPageSize && (
                        <div className="flex justify-between items-center mt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setHistoryPage(p => Math.max(0, p - 1)); }}
                            disabled={historyPage === 0}
                            className="text-[10px] font-mono disabled:opacity-20"
                            style={{ color: 'var(--tournament-heading)' }}
                          >← Poprz.</button>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--tournament-secondary-text)' }}>
                            {historyPage + 1}/{Math.ceil(gameHistory.length / historyPageSize)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setHistoryPage(p => Math.min(Math.ceil(gameHistory.length / historyPageSize) - 1, p + 1)); }}
                            disabled={(historyPage + 1) * historyPageSize >= gameHistory.length}
                            className="text-[10px] font-mono disabled:opacity-20"
                            style={{ color: 'var(--tournament-heading)' }}
                          >Nast. →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-6 p-6 pb-4">
                  <div className={cn(
                    'relative w-28 h-28 rounded-2xl overflow-hidden bg-black/40 shrink-0 shadow-xl flex items-center justify-center',
                    'border border-white/10',
                  )}>
                    {team.logoUrl && team.logoUrl.trim() !== '' ? (
                      <Image
                        src={team.logoUrl}
                        alt={team.name}
                        fill
                        sizes="112px"
                        className="object-cover"
                        unoptimized
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div
                      className="text-4xl font-logik-extended-bold absolute inset-0 flex items-center justify-center"
                      style={{
                        color: theme?.titleColor || theme?.textColor || '#ffffff',
                        fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                        zIndex: team.logoUrl && team.logoUrl.trim() !== '' ? -1 : 1,
                      }}
                    >
                      {team.name.charAt(0)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-4xl font-logik-extended-bold uppercase tracking-tight leading-tight drop-shadow-md"
                      style={{
                        color: theme?.titleColor || theme?.textColor || '#ffffff',
                        fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                      }}
                    >
                      {team.name}
                    </h3>
                    {team.tag && (
                      <p
                        className="text-lg font-logik-extended-bold uppercase tracking-widest mt-0.5 leading-tight opacity-70"
                        style={{
                          color: 'var(--tournament-heading)',
                          fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                        }}
                      >
                        [{team.tag}]
                      </p>
                    )}
                    {team.motto && (
                      <p
                        className="text-sm italic font-logik mt-1 opacity-60 truncate"
                        style={{
                          color: 'var(--tournament-heading)',
                          fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                        }}
                      >
                        &ldquo;{team.motto}&rdquo;
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {team.division && (
                        <span className={cn('text-xs uppercase tracking-widest inline-block font-logik', style.text)}>
                          {team.division}
                        </span>
                      )}
                      {team.status && (() => {
                        const statusLabels: Record<string, string> = {
                          pending: 'Oczekuje',
                          verified: 'Zweryfikowana',
                          rejected: 'Odrzucona',
                          eliminated: 'Wyeliminowana',
                          warning: 'Ostrzeżenie',
                          banned: 'Zbanowana',
                        };
                        const label = statusLabels[team.status];
                        if (!label) return null;
                        const isRejected = team.status === 'rejected';
                        return (
                          <span
                            className="text-xs uppercase tracking-widest font-logik-extended-bold px-2 py-0.5 rounded-full border bg-white/[0.04] border-white/10"
                            style={isRejected
                              ? { color: 'rgb(248 113 113)', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)' }
                              : { color: 'var(--tournament-section-header)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }
                            }
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-6 h-px" style={{ background: `linear-gradient(to right, ${style.glow}60, transparent)` }} />

                {/* Two-column content */}
                <div className="flex-1 flex gap-4 p-6 pt-4 min-h-0 overflow-hidden">
                  {/* Left column: Roster + Discord */}
                  <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                {/* Player rows — no heading, sorted by role */}
                {sortedPlayers.length > 0 && (
                  <div className="space-y-1">
                    {sortedPlayers.map((player, idx) => (
                      <button
                        key={player.id || idx}
                        onClick={() => setSelectedPlayer(player)}
                        className="flex items-center w-full gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.06] transition-colors group/player text-left"
                      >
                        {/* Role icon */}
                        <div className="shrink-0 w-5 flex justify-center"
                          style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                          {getRoleIcon(player.role, 'h-3.5 w-3.5')}
                        </div>

                        {/* Avatar */}
                        <div className="relative w-7 h-7 rounded-md overflow-hidden bg-black/30 shrink-0 border border-white/10">
                          {(player.avatar || player.avatarmedium) ? (
                            <Image
                              src={player.avatarmedium || player.avatar || ''}
                              alt={player.nickname}
                              fill
                              sizes="28px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold"
                              style={{ color: theme?.titleColor || '#fff' }}>
                              {player.nickname.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Nickname */}
                        <span
                          className="text-xs font-logik-extended-bold uppercase tracking-wide truncate flex-1 group-hover/player:opacity-80 transition-opacity"
                          style={{
                            color: theme?.primaryTextColor || theme?.textColor || '#ffffff',
                            fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                          }}
                        >
                          {player.nickname}
                        </span>

                        {/* MMR */}
                        {player.mmr != null && Number(player.mmr) > 0 && (
                          <span
                            className="text-xs font-mono shrink-0 ml-auto pl-2"
                            style={{ color: theme?.primaryTextColor || theme?.textColor || '#ffffff' }}
                          >
                            {player.mmr}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Captain Discord + Total MMR */}
                {(captainDiscord || totalMMR > 0) && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                    {captainDiscord && (
                      <div className="flex-1 min-w-0">
                        <DiscordCopyButton discord={captainDiscord} />
                      </div>
                    )}
                    {totalMMR > 0 && (
                      <span
                        className="text-xs font-mono shrink-0"
                        style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }}
                      >
                        Σ&nbsp;{totalMMR.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Upcoming matches */}
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div
                    className="flex items-center gap-1.5 mb-1.5 px-1"
                    style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.35)' }}
                  >
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span className="text-[9px] uppercase tracking-[0.15em] font-logik-extended-bold truncate">Nadchodzące mecze</span>
                  </div>
                  {upcomingMatches.length === 0 ? (
                    <p className="text-[10px] px-1 font-logik" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>Brak zaplanowanych meczów.</p>
                  ) : (
                    <>
                      {upcomingMatches
                        .slice(upcomingPage * upcomingPageSize, (upcomingPage + 1) * upcomingPageSize)
                        .map((match) => {
                          const opp = match.teamA?.id === team.id ? match.teamB : match.teamA;
                          if (!opp) return null;
                          return (
                            <button
                              key={match.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedMatchForModal(matchesById.get(match.id) || null); }}
                              className="flex items-center gap-2 w-full py-1.5 px-1.5 rounded-lg hover:bg-white/[0.07] transition-colors text-left"
                            >
                              <div className="w-5 h-5 rounded shrink-0 bg-white/10 overflow-hidden flex items-center justify-center text-[9px]"
                                style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                                {opp.logoUrl ? (
                                  <Image src={opp.logoUrl} alt={opp.name} width={20} height={20} className="object-cover" unoptimized />
                                ) : opp.name.charAt(0)}
                              </div>
                              <span className="text-[11px] font-logik truncate flex-1" style={{ color: theme?.primaryTextColor || '#fff' }}>
                                vs {opp.name}
                              </span>
                              <span className="text-[9px] font-mono shrink-0" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.35)' }}>
                                {format(new Date(match.scheduledFor), 'dd.MM HH:mm', { locale: pl })}
                              </span>
                            </button>
                          );
                        })}
                      {upcomingMatches.length > upcomingPageSize && (
                        <div className="flex justify-between items-center mt-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setUpcomingPage(p => Math.max(0, p - 1)); }}
                            disabled={upcomingPage === 0}
                            className="text-[9px] font-mono disabled:opacity-20"
                            style={{ color: theme?.primaryColor }}
                          >← Poprz.</button>
                          <span className="text-[9px] font-mono" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
                            {upcomingPage + 1}/{Math.ceil(upcomingMatches.length / upcomingPageSize)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setUpcomingPage(p => Math.min(Math.ceil(upcomingMatches.length / upcomingPageSize) - 1, p + 1)); }}
                            disabled={(upcomingPage + 1) * upcomingPageSize >= upcomingMatches.length}
                            className="text-[9px] font-mono disabled:opacity-20"
                            style={{ color: theme?.primaryColor }}
                          >Nast. →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Right column: game history */}
              <div className={cn('flex-1 flex flex-col min-w-0', isMobile ? 'overflow-visible border-t border-white/[0.06] pt-3' : 'overflow-y-auto')}>
                <div
                  className="flex items-center gap-1.5 mb-1.5 px-1"
                  style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.35)' }}
                >
                  <Swords className="w-3 h-3 shrink-0" />
                  <span className="text-[9px] uppercase tracking-[0.15em] font-logik-extended-bold truncate">Historia gier</span>
                </div>
                {gameHistory.length === 0 ? (
                  <p className="text-[10px] px-1 font-logik" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>Brak danych o grach.</p>
                ) : (
                  <>
                    {gameHistory
                      .slice(historyPage * historyPageSize, (historyPage + 1) * historyPageSize)
                      .map((game) => {
                        const dMin = Math.floor(game.durationSeconds / 60);
                        const dSec = game.durationSeconds % 60;
                        return (
                          <button
                            key={`${game.matchId}-${game.gameId}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedMatchForModal(matchesById.get(game.matchId) || null); }}
                            className="flex items-center gap-1.5 w-full py-1.5 px-1.5 rounded-lg hover:bg-white/[0.07] transition-colors group/game text-left"
                          >
                            <div
                              className="w-0.5 self-stretch rounded-full shrink-0"
                              style={{ backgroundColor: game.won ? '#10b981' : '#ef4444' }}
                            />
                            <div className="w-5 h-5 rounded shrink-0 bg-white/10 overflow-hidden flex items-center justify-center text-[9px]"
                              style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                              {game.opponentTeam.logoUrl ? (
                                <Image src={game.opponentTeam.logoUrl} alt={game.opponentTeam.name} width={20} height={20} className="object-cover" unoptimized />
                              ) : game.opponentTeam.name.charAt(0)}
                            </div>
                            <span className="text-[11px] font-logik truncate flex-1" style={{ color: theme?.primaryTextColor || '#fff' }}>
                              vs {game.opponentTeam.name}
                            </span>
                            <span className="text-[10px] font-mono shrink-0">
                              <span style={{ color: game.won ? '#10b981' : '#ef4444' }}>{game.teamKills}</span>
                              <span style={{ color: 'rgba(255,255,255,0.2)' }}>:</span>
                              <span style={{ color: game.won ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)' }}>{game.opponentKills}</span>
                            </span>
                            <span className="text-[9px] font-mono shrink-0 ml-0.5" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
                              {dMin}:{String(dSec).padStart(2, '0')}
                            </span>
                          </button>
                        );
                      })}
                    {gameHistory.length > historyPageSize && (
                      <div className="flex justify-between items-center mt-0.5 px-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHistoryPage(p => Math.max(0, p - 1)); }}
                          disabled={historyPage === 0}
                          className="text-[9px] font-mono disabled:opacity-20"
                          style={{ color: theme?.primaryColor }}
                        >← Poprz.</button>
                        <span className="text-[9px] font-mono" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
                          {historyPage + 1}/{Math.ceil(gameHistory.length / historyPageSize)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setHistoryPage(p => Math.min(Math.ceil(gameHistory.length / historyPageSize) - 1, p + 1)); }}
                          disabled={(historyPage + 1) * historyPageSize >= gameHistory.length}
                          className="text-[9px] font-mono disabled:opacity-20"
                          style={{ color: theme?.primaryColor }}
                        >Nast. →</button>
                      </div>
                    )}
                  </>
                )}
              </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom glow bar */}
      <div
        className={cn('absolute bottom-0 left-0 right-0 h-[3px] shadow-[0_-2px_10px_rgba(255,255,255,0.3)]', style.gradient)}
      />
      <MatchDetailModal
        match={selectedMatchForModal}
        isOpen={selectedMatchForModal !== null}
        onClose={() => setSelectedMatchForModal(null)}
        divisionColor={style.glow}
      />
    </motion.div>
  );
}

// ─── Main TeamsView Component ────────────────────────────────────────

interface TeamsViewProps {
  teams: Team[];
  divisionRankings?: Record<string, number>;
  highlightedTeamId?: string | null;
  onTeamHighlightConsumed?: () => void;
}

export function TeamsView({ teams, highlightedTeamId, onTeamHighlightConsumed }: TeamsViewProps) {
  const { tournament, theme } = useTournament();
  const isMobile = useIsMobile();
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const primaryColor = theme?.primaryColor || '#8B1538';

  // Auto-expand a team when navigated from standings
  useEffect(() => {
    if (highlightedTeamId) {
      setExpandedTeamId(highlightedTeamId);
      onTeamHighlightConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedTeamId]);

  const hasExpanded = expandedTeamId !== null;
  const expandedTeam = useMemo(
    () => (expandedTeamId ? teams.find((t) => t.id === expandedTeamId) : null),
    [expandedTeamId, teams],
  );

  const gridConfig = useMemo(() => getGridConfig(teams.length), [teams.length]);

  // Build slots array: teams + empty placeholders
  const slots = useMemo(() => {
    const result: (Team | null)[] = [...teams];
    while (result.length < gridConfig.minSlots) {
      result.push(null);
    }
    return result;
  }, [teams, gridConfig.minSlots]);

  // When a card is expanded, use a grid config for the right half (fewer columns)
  const compactGridConfig = useMemo(() => {
    const count = slots.length;
    if (count <= 8) return { columns: 4, rows: 2 };
    if (count <= 12) return { columns: 4, rows: 3 };
    if (count <= 16) return { columns: 4, rows: 4 };
    if (count <= 20) return { columns: 5, rows: 4 };
    if (count <= 24) return { columns: 6, rows: 4 };
    if (count <= 28) return { columns: 7, rows: 4 };
    return { columns: 8, rows: 4 };
  }, [slots.length]);

  const handleSelectTeam = useCallback((teamId: string) => {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId));
  }, []);

  const handleClose = useCallback(() => {
    setExpandedTeamId(null);
  }, []);

  // Measure the available height of the grid wrapper so rows always fit exactly
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const [gridWrapperHeight, setGridWrapperHeight] = useState(0);
  useEffect(() => {
    const el = gridWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setGridWrapperHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const currentRows = hasExpanded ? compactGridConfig.rows : gridConfig.rows;
  // gap-2 = 8px between rows; compute exact pixel height per row
  const rowHeight = gridWrapperHeight > 0
    ? Math.floor((gridWrapperHeight - (currentRows - 1) * 8) / currentRows)
    : 0;

  // Are we in "compact" mode (many teams = smaller cards)?
  const isCompact = teams.length > 20;

  if (teams.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <Users className="h-12 w-12 mx-auto text-white/20" />
          <p
            className="text-lg"
            style={{
              color: 'var(--tournament-heading)',
              fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
            }}
          >
            {tournament?.status === 'registration'
              ? 'Brak zarejestrowanych drużyn. Bądź pierwszy!'
              : 'Brak drużyn w tym turnieju.'}
          </p>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-full w-full flex flex-col px-3 py-3 overflow-hidden">
        <div className="text-center mb-3 shrink-0">
          <h2
            className="text-4xl font-logik-extended-bold uppercase tracking-tight"
            style={{
              color: theme?.titleColor || 'white',
              fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
            }}
          >
            Drużyny
          </h2>
          <div className="flex items-center justify-center gap-4 mt-1 opacity-60">
            <div className="h-[1px] w-12" style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }} />
            <Users className="w-3 h-3" style={{ color: primaryColor }} />
            <div className="h-[1px] w-12" style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }} />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
          {teams.map((team) => {
            const isExpanded = expandedTeamId === team.id;
            return (
              <div
                key={team.id}
                className="rounded-xl border border-white/10 bg-black/25 backdrop-blur-sm overflow-hidden"
              >
                <button
                  onClick={() => handleSelectTeam(team.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-black/35 shrink-0 border border-white/10">
                    {team.logoUrl && team.logoUrl.trim() !== '' ? (
                      <Image
                        src={team.logoUrl}
                        alt={team.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-sm font-logik-extended-bold"
                        style={{ color: theme?.titleColor || theme?.textColor || '#ffffff' }}
                      >
                        {team.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-logik-extended-bold uppercase tracking-wide truncate"
                      style={{
                        color: theme?.primaryTextColor || theme?.textColor || '#ffffff',
                        fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                      }}
                    >
                      {team.name}
                    </p>
                    <p className="text-[11px] mt-0.5 uppercase tracking-wider opacity-70" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.65)' }}>
                      {team.division || team.tag || 'Drużyna'}
                    </p>
                  </div>

                  <ChevronDown
                    className={cn('w-4 h-4 shrink-0 transition-transform duration-200', isExpanded && 'rotate-180')}
                    style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.7)' }}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="p-2 pt-0">
                        <ExpandedTeamCard team={team} onClose={handleClose} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col px-4 sm:px-8 lg:px-12 py-4 overflow-hidden">
      {/* Section header */}
      <div className="text-center mb-3 shrink-0">
        <h2
          className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight"
          style={{
            color: theme?.titleColor || 'white',
            fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
          }}
        >
          Drużyny
        </h2>
        <div className="flex items-center justify-center gap-4 mt-1 opacity-60">
          <div className="h-[1px] w-12" style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }} />
          <Users className="w-3 h-3" style={{ color: primaryColor }} />
          <div className="h-[1px] w-12" style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }} />
        </div>
      </div>

      {/* Main content area */}
      <div className={cn('flex-1 flex gap-4 min-h-0 overflow-hidden', isMobile ? 'pr-0 relative' : 'pr-10')}>
        {/* Expanded card — left half */}
        <motion.div
          initial={false}
          animate={{ width: hasExpanded ? (isMobile ? '100%' : '50%') : '0%' }}
          transition={{ duration: 0.4, ease: [0.76, 0, 0.24, 1] }}
          className={cn(
            'h-full shrink-0 relative overflow-hidden will-change-transform',
            isMobile && 'absolute inset-0 z-30',
          )}
          style={{ isolation: 'isolate' }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <AnimatePresence>
              {hasExpanded && expandedTeam && (
                <motion.div
                  key={expandedTeamId}
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0.32, ease: [0.76, 0, 0.24, 1] }}
                  className="absolute inset-0"
                >
                  <ExpandedTeamCard team={expandedTeam} onClose={handleClose} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Grid of collapsed cards — full width or right half */}
        <div
          ref={gridWrapperRef}
          className={cn(
            'flex-1 min-w-0 h-full overflow-hidden',
            isMobile && hasExpanded && 'pointer-events-none opacity-0',
          )}
        >
          <div
            className="grid w-full gap-2"
            style={{
              height: gridWrapperHeight > 0 ? `${gridWrapperHeight}px` : '100%',
              gridTemplateColumns: `repeat(${hasExpanded ? compactGridConfig.columns : gridConfig.columns}, 1fr)`,
              gridTemplateRows: rowHeight > 0
                ? `repeat(${currentRows}, ${rowHeight}px)`
                : `repeat(${currentRows}, 1fr)`,
            }}
          >
            {slots.map((team, idx) =>
              team ? (
                <CollapsedTeamCard
                  key={team.id}
                  team={team}
                  isSelected={team.id === expandedTeamId}
                  onSelect={() => handleSelectTeam(team.id)}
                  compact={isCompact || hasExpanded}
                />
              ) : (
                <div
                  key={`empty-${idx}`}
                  className="rounded-xl border border-white/[0.03] bg-white/[0.01]"
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
