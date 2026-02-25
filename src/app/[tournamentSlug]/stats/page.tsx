"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import {
  Trophy,
  Target,
  Sword,
  Shield,
  Crown,
  Users,
  Activity,
  TrendingUp,
  Zap,
  DollarSign,
  Eye,
  Clock,
  Star,
  Crosshair,
  BarChart3,
  Timer,
  Flame,
  Swords,
  Heart,
  TreePine,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// ─── Type Definitions ────────────────────────────────────────────────

interface TournamentStatsData {
  id: string;
  totalTeams: number;
  totalMatches: number;
  totalGames: number;
  totalHoursPlayed: number;
  averageMatchDuration: number;

  // Combat
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalRampages: number;
  totalUltraKills: number;
  totalTripleKills: number;
  totalDoubleKills: number;

  // Objectives
  totalRoshanKills: number;
  totalTowerKills: number;
  totalTowerDamage: number;
  totalCourierKills: number;

  // Economy
  totalGoldSpent: number;
  totalNeutralKills: number;
  totalLaneKills: number;

  // Vision
  totalObserverWardsPlaced: number;
  totalSentryWardsPlaced: number;
  totalWardsPlaced: number;
  totalRunesPickedUp: number;
  totalCampsStacked: number;

  // Misc
  totalHealing: number;
  totalBuybacks: number;

  // Hero meta
  mostPickedHero?: { heroName: string; pickCount: number };
  mostBannedHero?: { heroName: string; banCount: number };
  mostContestedHero?: { heroName: string; contestCount: number };
  mostPlayedHeroCombination?: { playerName: string; heroName: string; count: number };

  // Fantasy
  totalFantasyPoints: number;

  lastUpdated: string;
}

interface StatRecord {
  value: number;
  matchId?: string;
  heroName?: string;
  opponent?: string;
}

interface PlayerStatsData {
  playerId: string;
  playerName: string;
  teamName?: string;
  // Group 1 — high-priority single-game peaks
  mostKillsSingleGame?: StatRecord;        // kills
  mostAssistsSingleGame?: StatRecord;      // assists
  highestGPMSingleGame?: StatRecord;       // gpm
  highestXPMSingleGame?: StatRecord;       // xpm
  mostLastHitsSingleGame?: StatRecord;     // lastHits
  mostHeroDamageSingleGame?: StatRecord;   // heroDamage
  mostTowerDamageSingleGame?: StatRecord;  // towerDamage
  mostWardsSingleGame?: StatRecord;        // obsPlaced + senPlaced
  bestFantasyScoreSingleGame?: StatRecord; // fantasyPoints
  highestKillStreak?: StatRecord;          // highestKillStreak
  // Group 2 — extra single-game records
  mostCourierKillsSingleGame?: StatRecord; // courierKills
  mostRunesSingleGame?: StatRecord;        // runesPickedUp
  mostNeutralKillsSingleGame?: StatRecord; // neutralKills
  mostObserverKillsSingleGame?: StatRecord;// observerKills (dewards)
  mostLaneKillsSingleGame?: StatRecord;    // laneKills
  highestNetWorthSingleGame?: StatRecord;  // netWorth
  mostGoldSpentSingleGame?: StatRecord;    // goldSpent
  mostCampsStackedTotal?: StatRecord;       // campsStacked best single game
  mostTowerKillsSingleGame?: StatRecord;   // towerKills
  mostSentryPlacedSingleGame?: StatRecord; // senPlaced
}

interface TeamStatsData {
  teamId: string;
  teamName: string;
  // Group 1 — high-priority records
  mostKillsSingleMatch?: StatRecord;          // sum team kills
  fewestDeathsSingleMatch?: StatRecord;        // sum team deaths
  mostWardsSingleMatch?: StatRecord;           // obsPlaced + senPlaced
  fewestUniqueHeroes?: StatRecord;             // team with fewest unique heroes (total)
  mostUniqueHeroes?: StatRecord;               // team with most unique heroes (total)
  mostRoshanKills?: StatRecord;                // roshanKills
  highestAvgGPM?: StatRecord;                  // avg team gpm
  mostCampsStackedSingleGame?: StatRecord;     // campsStacked
  mostDeniesSingleMatch?: StatRecord;          // sum team denies
  bestKDRatio?: StatRecord;                    // kills/deaths
  // Group 2 — extra records
  mostCourierKillsSingleMatch?: StatRecord;    // sum team courierKills
  highestCombinedNetWorth?: StatRecord;        // sum team netWorth
  mostLastHitsSingleMatch?: StatRecord;        // sum team lastHits
  mostNeutralKillsSingleMatch?: StatRecord;    // sum team neutralKills
  mostLaneKillsSingleMatch?: StatRecord;       // sum laneKills
  mostRunesSingleMatch?: StatRecord;           // sum runesPickedUp
  mostDewardsSingleMatch?: StatRecord;         // sum observerKills + sentryKills
  assistsPerKill?: StatRecord;                 // total assists / total kills
  shortestGame?: StatRecord;                   // duration of shortest game (seconds)
  longestGame?: StatRecord;                    // duration of longest game (seconds)
}

// ─── StatCard ────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
}

function StatCard({ icon: Icon, title, value, subtitle, color }: StatCardProps): React.ReactElement {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative group bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:bg-white/[0.06] hover:border-white/10 transition-colors duration-300 cursor-default"
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}60` }}
      />
      <div className="pl-4 pr-3 pt-3 pb-3">
        <p className="text-[10px] uppercase tracking-widest text-white/30 leading-tight mb-2">{title}</p>
        <p className="text-base font-logik-extended-bold leading-snug break-words" style={{ color }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-white/40 mt-1.5 break-words">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  color: string;
}

function SectionHeader({ icon: Icon, title, description, color }: SectionHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center gap-4">
      <div
        className="w-1 h-10 rounded-full flex-shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 16px ${color}80` }}
      />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <h2 className="text-lg font-logik-extended-bold uppercase tracking-wide text-white leading-none">
            {title}
          </h2>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section Container ───────────────────────────────────────────────

interface SectionProps {
  children: React.ReactNode;
  color: string;
  delay?: number;
}

function Section({ children, color, delay = 0 }: SectionProps): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative bg-white/[0.02] border border-white/[0.06] rounded-2xl md:rounded-3xl overflow-hidden p-5 md:p-6 space-y-5"
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${color}50, transparent)` }}
      />
      {children}
    </motion.div>
  );
}

// ─── Helper Functions ─────────────────────────────────────────────────

function findBestPlayer(
  players: PlayerStatsData[],
  statKey: keyof PlayerStatsData,
  mode: 'max' | 'min' = 'max'
): { value: number; playerName: string; heroName?: string } {
  if (players.length === 0) return { value: 0, playerName: '' };
  let best: PlayerStatsData | null = null;
  let bestVal = mode === 'max' ? -Infinity : Infinity;
  for (const p of players) {
    // Skip unresolved standins / players not registered in any team
    if (p.playerId?.startsWith('unknown_')) continue;
    const stat = p[statKey] as StatRecord | undefined;
    const val = stat?.value ?? (mode === 'max' ? -Infinity : Infinity);
    if (mode === 'max' ? val > bestVal : val < bestVal) {
      bestVal = val;
      best = p;
    }
  }
  if (!best) return { value: 0, playerName: '' };
  const stat = best[statKey] as StatRecord | undefined;
  return { value: stat?.value ?? 0, playerName: best.playerName || '', heroName: stat?.heroName };
}

function findBestTeam(
  teams: TeamStatsData[],
  statKey: keyof TeamStatsData,
  mode: 'max' | 'min' = 'max'
): { value: number; teamName: string } {
  if (teams.length === 0) return { value: 0, teamName: '' };
  let best: TeamStatsData | null = null;
  let bestVal = mode === 'max' ? -Infinity : Infinity;
  for (const t of teams) {
    const stat = t[statKey] as StatRecord | undefined;
    const val = stat?.value ?? (mode === 'max' ? -Infinity : Infinity);
    if (mode === 'max' ? val > bestVal : val < bestVal) {
      bestVal = val;
      best = t;
    }
  }
  if (!best) return { value: 0, teamName: '' };
  const stat = best[statKey] as StatRecord | undefined;
  return { value: stat?.value ?? 0, teamName: best.teamName || '' };
}

function fmtNum(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return 'TBD';
  return n.toLocaleString('pl-PL');
}

function fmtDec(n: number | undefined | null, digits: number = 1): string {
  if (n == null || isNaN(n) || !isFinite(n)) return 'TBD';
  return n.toFixed(digits);
}

function fmtGold(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return 'TBD';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('pl-PL');
}

function fmtDur(n: number | undefined | null): string {
  if (n == null || isNaN(n) || n <= 0) return 'TBD';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Main Page ───────────────────────────────────────────────────────

type TabId = 'tournament' | 'players' | 'teams';

export default function StatsPage(): React.ReactElement | null {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const t = useTranslations('stats');

  const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'tournament', label: t('tabTournament'), icon: Trophy },
    { id: 'players',   label: t('players'),        icon: Star },
    { id: 'teams',     label: t('teams'),           icon: Users },
  ];
  const [tournamentStats, setTournamentStats] = useState<TournamentStatsData | null>(null);
  const [playerStats, setPlayerStats]         = useState<PlayerStatsData[]>([]);
  const [teamStats, setTeamStats]             = useState<TeamStatsData[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [activeTab, setActiveTab]             = useState<TabId>('tournament');

  const loadStats = useCallback(async () => {
    if (!tournament?.id) { setLoading(false); return; }
    try {
      // Legacy (Letnia) uses flat top-level collections; new tournaments use tournament-scoped paths
      const [tournamentDoc, playerSnap, teamSnap] = isLegacyTournament
        ? await Promise.all([
            getDoc(doc(db, 'tournamentStats', 'tournament-stats')),
            getDocs(collection(db, 'playerStats')),
            getDocs(collection(db, 'teamStats')),
          ])
        : await Promise.all([
            getDoc(doc(db, 'tournaments', tournament.id, 'stats', 'tournament-stats')),
            getDocs(collection(db, 'tournaments', tournament.id, 'playerStats')),
            getDocs(collection(db, 'tournaments', tournament.id, 'teamStats')),
          ]);
      if (tournamentDoc.exists()) {
        setTournamentStats(tournamentDoc.data() as TournamentStatsData);
      }
      setPlayerStats(playerSnap.docs.map(d => ({ playerId: d.id, ...d.data() } as PlayerStatsData)));
      setTeamStats(teamSnap.docs.map(d => ({ teamId: d.id, ...d.data() } as TeamStatsData)));
    } catch (err) {
      console.error('Error loading stats:', err);
      setError(t('errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [tournament?.id, isLegacyTournament, t]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (!tournament) return null;

  const pc = theme.primaryColor;
  const ac = theme.accentColor;
  const sc = theme.secondaryColor;

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="relative text-white min-h-[60vh] flex items-center justify-center">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]" style={{ background: pc }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 border-2 border-white/5 rounded-full" />
            <div
              className="absolute inset-0 w-20 h-20 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${pc}60 transparent transparent transparent` }}
            />
          </div>
          <span className="text-xs tracking-widest uppercase text-white/30 animate-pulse">{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative text-white min-h-[40vh] flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <BarChart3 className="w-12 h-12 mx-auto opacity-20" />
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const ts = tournamentStats;

  // ── Main render ────────────────────────────────────────────

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">

      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)' }}
        />
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.05] blur-[200px]"
          style={{ background: pc }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: ac }}
        />
        <div
          className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] rounded-full opacity-[0.025] blur-[180px]"
          style={{ background: sc }}
        />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-12 py-8 sm:py-12 space-y-10 md:space-y-14">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center"
        >
          <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-white/25 mb-4">
            {tournament.name}
          </p>
          <h1 className="text-5xl sm:text-7xl md:text-[9rem] font-logik-extended-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/30 uppercase tracking-tight leading-none">
            {t('title')}
          </h1>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 120 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-px mx-auto mt-5 rounded-full"
            style={{ background: `linear-gradient(to right, transparent, ${pc}90, transparent)` }}
          />
          {ts?.lastUpdated && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[10px] text-white/20 uppercase tracking-widest mt-4"
            >
              {t('lastUpdated')} {new Date(ts.lastUpdated).toLocaleString('pl-PL')}
            </motion.p>
          )}
        </motion.div>

        {/* Tab navigation */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex items-center justify-center gap-2 flex-wrap"
        >
          {TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'px-5 py-2.5 rounded-full text-xs uppercase tracking-widest transition-all duration-300',
                  isActive
                    ? 'text-black font-bold shadow-lg'
                    : 'bg-white/[0.04] border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.08] hover:border-white/20'
                )}
                style={isActive ? { backgroundColor: pc, boxShadow: `0 0 20px ${pc}60` } : {}}
              >
                {label}
              </button>
            );
          })}
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">

          {/* ════ TOURNAMENT ════ */}
          {activeTab === 'tournament' && (
            <motion.div
              key="tournament"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
            >
              <StatCard icon={Crown}      color={sc} title={t('mostPicks')}        value={ts?.mostPickedHero ? `${ts.mostPickedHero.heroName} — ${ts.mostPickedHero.pickCount}` : t('tbd')} />
              <StatCard icon={Crosshair}  color={sc} title={t('mostBans')}         value={ts?.mostBannedHero ? `${ts.mostBannedHero.heroName} — ${ts.mostBannedHero.banCount}` : t('tbd')} />
              <StatCard icon={Flame}      color={sc} title={t('picksAndBans')}     value={ts?.mostContestedHero ? `${ts.mostContestedHero.heroName} — ${ts.mostContestedHero.contestCount}` : t('tbd')} />
              <StatCard icon={Sword}     color={sc} title={t('kills')}             value={fmtNum(ts?.totalKills)} />
              <StatCard icon={Flame}     color={sc} title={t('rampages')}          value={fmtNum(ts?.totalRampages)} />
              <StatCard icon={Zap}       color={sc} title={t('ultraKills')}        value={fmtNum(ts?.totalUltraKills)} />
              <StatCard icon={Swords}    color={sc} title={t('tripleKills')}       value={fmtNum(ts?.totalTripleKills)} />
              <StatCard icon={Activity}  color={sc} title={t('doubleKills')}       value={fmtNum(ts?.totalDoubleKills)} />
              <StatCard icon={Heart}     color={sc} title={t('heroHealing')}       value={fmtGold(ts?.totalHealing)} />
              <StatCard icon={Timer}     color={sc} title={t('buybacks')}          value={fmtNum(ts?.totalBuybacks)} />
              <StatCard icon={Shield}    color={sc} title={t('towersDestroyed')}   value={fmtNum(ts?.totalTowerKills)} />
              <StatCard icon={Shield}    color={sc} title={t('buildingDamage')}    value={fmtGold(ts?.totalTowerDamage)} />
              <StatCard icon={Trophy}    color={sc} title={t('roshans')}           value={fmtNum(ts?.totalRoshanKills)} />
              <StatCard icon={Target}    color={sc} title={t('courierKills')}      value={fmtNum(ts?.totalCourierKills)} />
              <StatCard icon={TreePine}  color={sc} title={t('neutralCreeps')}     value={fmtNum(ts?.totalNeutralKills)} />
              <StatCard icon={DollarSign} color={sc} title={t('goldSpent')}        value={fmtGold(ts?.totalGoldSpent)} />
              <StatCard icon={Eye}       color={sc} title={t('wardsPlaced')}       value={fmtNum(ts?.totalWardsPlaced)} />
              <StatCard icon={Zap}       color={sc} title={t('runesPickedUp')}     value={fmtNum(ts?.totalRunesPickedUp)} />
              <StatCard icon={TreePine}  color={sc} title={t('campsStacked')}      value={fmtNum(ts?.totalCampsStacked)} />
              <StatCard icon={BarChart3} color={sc} title={t('gamesPlayed')}       value={fmtNum(ts?.totalGames)} />
            </motion.div>
          )}

          {/* ════ PLAYERS ════ */}
          {activeTab === 'players' && (() => {
            const bp = (key: keyof PlayerStatsData) => findBestPlayer(playerStats, key);
            // Returns "PlayerName — formattedValue"
            const bpVal = (key: keyof PlayerStatsData, fmt: (v: number) => string): string => {
              const { value, playerName } = bp(key);
              if (!playerName) return 'TBD';
              return `${playerName} \u2014 ${fmt(value)}`;
            };
            // Returns opponent + hero info only (no player name)
            const bpSub = (key: keyof PlayerStatsData): string | undefined => {
              const { playerName, heroName } = bp(key);
              const stat = playerStats.find(p => p.playerName === playerName)?.[key] as StatRecord | undefined;
              const parts: string[] = [];
              if (stat?.opponent) parts.push(`vs ${stat.opponent}`);
              if (heroName) parts.push(heroName);
              return parts.length > 0 ? parts.join(' · ') : undefined;
            };
            return (
              <motion.div
                key="players"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
              >
                <StatCard icon={Sword}      color={pc} title={t('kills')}                    value={bpVal('mostKillsSingleGame', fmtNum)}          subtitle={bpSub('mostKillsSingleGame')} />
                <StatCard icon={Zap}        color={pc} title={t('assists')}                   value={bpVal('mostAssistsSingleGame', fmtNum)}        subtitle={bpSub('mostAssistsSingleGame')} />
                <StatCard icon={DollarSign} color={pc} title={t('gpm')}                       value={bpVal('highestGPMSingleGame', fmtNum)}         subtitle={bpSub('highestGPMSingleGame')} />
                <StatCard icon={TrendingUp} color={pc} title={t('xpm')}                       value={bpVal('highestXPMSingleGame', fmtNum)}         subtitle={bpSub('highestXPMSingleGame')} />
                <StatCard icon={Crosshair}  color={pc} title={t('lastHits')}                  value={bpVal('mostLastHitsSingleGame', fmtNum)}       subtitle={bpSub('mostLastHitsSingleGame')} />
                <StatCard icon={Flame}      color={pc} title={t('heroDamage')}                value={bpVal('mostHeroDamageSingleGame', fmtGold)}    subtitle={bpSub('mostHeroDamageSingleGame')} />
                <StatCard icon={Shield}     color={pc} title={t('towerDamage')}               value={bpVal('mostTowerDamageSingleGame', fmtGold)}   subtitle={bpSub('mostTowerDamageSingleGame')} />
                <StatCard icon={Eye}        color={pc} title={t('wardsPlaced')}               value={bpVal('mostWardsSingleGame', fmtNum)}          subtitle={bpSub('mostWardsSingleGame')} />
                <StatCard icon={Star}       color={pc} title={t('fantasyScore')}              value={bpVal('bestFantasyScoreSingleGame', v => fmtDec(v))} subtitle={bpSub('bestFantasyScoreSingleGame')} />
                <StatCard icon={Crown}      color={pc} title={t('killStreak')}                value={bpVal('highestKillStreak', fmtNum)}            subtitle={bpSub('highestKillStreak')} />
                <StatCard icon={Target}     color={pc} title={t('courierKills')}              value={bpVal('mostCourierKillsSingleGame', fmtNum)}   subtitle={bpSub('mostCourierKillsSingleGame')} />
                <StatCard icon={Zap}        color={pc} title={t('runesPlayer')}               value={bpVal('mostRunesSingleGame', fmtNum)}          subtitle={bpSub('mostRunesSingleGame')} />
                <StatCard icon={TreePine}   color={pc} title={t('neutralsPlayer')}            value={bpVal('mostNeutralKillsSingleGame', fmtNum)}   subtitle={bpSub('mostNeutralKillsSingleGame')} />
                <StatCard icon={Eye}        color={pc} title={t('wardsDestroyed')}            value={bpVal('mostObserverKillsSingleGame', fmtNum)}  subtitle={bpSub('mostObserverKillsSingleGame')} />
                <StatCard icon={Crosshair}  color={pc} title={t('laneKills')}                 value={bpVal('mostLaneKillsSingleGame', fmtNum)}      subtitle={bpSub('mostLaneKillsSingleGame')} />
                <StatCard icon={DollarSign} color={pc} title={t('netWorth')}                  value={bpVal('highestNetWorthSingleGame', fmtGold)}  subtitle={bpSub('highestNetWorthSingleGame')} />
                <StatCard icon={DollarSign} color={pc} title={t('goldSpent')}                 value={bpVal('mostGoldSpentSingleGame', fmtGold)}    subtitle={bpSub('mostGoldSpentSingleGame')} />
                <StatCard icon={TreePine}   color={pc} title={t('mostCampsStackedPlayer')}      value={bpVal('mostCampsStackedTotal', fmtNum)}        subtitle={bpSub('mostCampsStackedTotal')} />
                <StatCard icon={Shield}     color={pc} title={t('towerKills')}                value={bpVal('mostTowerKillsSingleGame', fmtNum)}     subtitle={bpSub('mostTowerKillsSingleGame')} />
                <StatCard icon={Eye}        color={pc} title={t('sentryWards')}               value={bpVal('mostSentryPlacedSingleGame', fmtNum)}   subtitle={bpSub('mostSentryPlacedSingleGame')} />
              </motion.div>
            );
          })()}

          {/* ════ TEAMS ════ */}
          {activeTab === 'teams' && (() => {
            const bt = (key: keyof TeamStatsData, mode: 'max' | 'min' = 'max') => findBestTeam(teamStats, key, mode);
            const btSub = (key: keyof TeamStatsData, mode: 'max' | 'min' = 'max'): string => {
              const { teamName } = bt(key, mode);
              const team = teamStats.find(t => t.teamName === teamName);
              const stat = team?.[key] as StatRecord | undefined;
              return stat?.opponent ? `${teamName} vs ${stat.opponent}` : teamName;
            };
            return (
              <motion.div
                key="teams"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
              >
                <StatCard icon={Swords}     color={ac} title={t('mostKillsMatch')}          value={fmtNum(bt('mostKillsSingleMatch').value)}          subtitle={btSub('mostKillsSingleMatch')} />
                <StatCard icon={Shield}     color={ac} title={t('fewestDeathsMatch')}        value={fmtNum(bt('fewestDeathsSingleMatch', 'min').value)} subtitle={btSub('fewestDeathsSingleMatch', 'min')} />
                <StatCard icon={Eye}        color={ac} title={t('mostWardsMatch')}            value={fmtNum(bt('mostWardsSingleMatch').value)}           subtitle={btSub('mostWardsSingleMatch')} />
                <StatCard icon={Crown}      color={ac} title={t('fewestUniqueHeroes')}         value={fmtNum(bt('fewestUniqueHeroes', 'min').value)}       subtitle={bt('fewestUniqueHeroes', 'min').teamName} />
                <StatCard icon={Crown}      color={ac} title={t('mostUniqueHeroes')}          value={fmtNum(bt('mostUniqueHeroes').value)}               subtitle={bt('mostUniqueHeroes').teamName} />
                <StatCard icon={Trophy}     color={ac} title={t('mostRoshans')}               value={fmtNum(bt('mostRoshanKills').value)}                subtitle={bt('mostRoshanKills').teamName} />
                <StatCard icon={TrendingUp} color={ac} title={t('highestAvgGPM')}             value={fmtNum(bt('highestAvgGPM').value)}                  subtitle={bt('highestAvgGPM').teamName} />
                <StatCard icon={TreePine}   color={ac} title={t('mostCampsGame')}             value={fmtNum(bt('mostCampsStackedSingleGame').value)}     subtitle={btSub('mostCampsStackedSingleGame')} />
                <StatCard icon={Sword}      color={ac} title={t('mostDeniesMatch')}           value={fmtNum(bt('mostDeniesSingleMatch').value)}          subtitle={btSub('mostDeniesSingleMatch')} />
                <StatCard icon={Activity}   color={ac} title={t('bestKD')}                    value={fmtDec(bt('bestKDRatio').value)}                    subtitle={bt('bestKDRatio').teamName} />
                <StatCard icon={Target}     color={ac} title={t('mostCourierKillsMatch')}     value={fmtNum(bt('mostCourierKillsSingleMatch').value)}    subtitle={btSub('mostCourierKillsSingleMatch')} />
                <StatCard icon={DollarSign} color={ac} title={t('highestNetWorthMatch')}      value={fmtGold(bt('highestCombinedNetWorth').value)}       subtitle={btSub('highestCombinedNetWorth')} />
                <StatCard icon={Crosshair}  color={ac} title={t('mostLastHitsMatch')}          value={fmtNum(bt('mostLastHitsSingleMatch').value)}         subtitle={btSub('mostLastHitsSingleMatch')} />
                <StatCard icon={TreePine}   color={ac} title={t('mostNeutralKillsMatch')}     value={fmtNum(bt('mostNeutralKillsSingleMatch').value)}    subtitle={btSub('mostNeutralKillsSingleMatch')} />
                <StatCard icon={Crosshair}  color={ac} title={t('mostLaneKillsMatch')}        value={fmtNum(bt('mostLaneKillsSingleMatch').value)}       subtitle={btSub('mostLaneKillsSingleMatch')} />
                <StatCard icon={Zap}        color={ac} title={t('mostRunesMatch')}            value={fmtNum(bt('mostRunesSingleMatch').value)}           subtitle={btSub('mostRunesSingleMatch')} />
                <StatCard icon={Eye}        color={ac} title={t('mostDewardsMatch')}          value={fmtNum(bt('mostDewardsSingleMatch').value)}         subtitle={btSub('mostDewardsSingleMatch')} />
                <StatCard icon={Activity}   color={ac} title={t('assistsPerKill')}             value={fmtDec(bt('assistsPerKill').value, 2)}               subtitle={bt('assistsPerKill').teamName} />
                <StatCard icon={Timer}      color={ac} title={t('shortestGame')}               value={fmtDur(bt('shortestGame', 'min').value)}             subtitle={btSub('shortestGame', 'min')} />
                <StatCard icon={Timer}      color={ac} title={t('longestGame')}                value={fmtDur(bt('longestGame').value)}                     subtitle={btSub('longestGame')} />
              </motion.div>
            );
          })()}

        </AnimatePresence>
      </div>
    </div>
  );
}
