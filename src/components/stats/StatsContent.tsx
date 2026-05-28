'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
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
  Star,
  Crosshair,
  BarChart3,
  Timer,
  Flame,
  Swords,
  Heart,
  TreePine,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────

export interface StatRecord {
  value: number;
  matchId?: string;
  heroName?: string;
  opponent?: string;
}

export interface TournamentStatsData {
  id: string;
  totalTeams: number;
  totalMatches: number;
  totalGames: number;
  totalHoursPlayed: number;
  averageMatchDuration: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalRampages: number;
  totalUltraKills: number;
  totalTripleKills: number;
  totalDoubleKills: number;
  totalRoshanKills: number;
  totalTowerKills: number;
  totalTowerDamage: number;
  totalCourierKills: number;
  totalGoldSpent: number;
  totalNeutralKills: number;
  totalLaneKills: number;
  totalObserverWardsPlaced: number;
  totalSentryWardsPlaced: number;
  totalWardsPlaced: number;
  totalRunesPickedUp: number;
  totalCampsStacked: number;
  totalHealing: number;
  totalBuybacks: number;
  mostPickedHero?: { heroName: string; pickCount: number };
  mostBannedHero?: { heroName: string; banCount: number };
  mostContestedHero?: { heroName: string; contestCount: number };
  mostPlayedHeroCombination?: { playerName: string; heroName: string; count: number };
  totalFantasyPoints: number;
  lastUpdated: string;
}

export interface PlayerStatsData {
  playerId: string;
  playerName: string;
  teamName?: string;
  mostKillsSingleGame?: StatRecord;
  mostAssistsSingleGame?: StatRecord;
  highestGPMSingleGame?: StatRecord;
  highestXPMSingleGame?: StatRecord;
  mostLastHitsSingleGame?: StatRecord;
  mostHeroDamageSingleGame?: StatRecord;
  mostTowerDamageSingleGame?: StatRecord;
  mostWardsSingleGame?: StatRecord;
  bestFantasyScoreSingleGame?: StatRecord;
  highestKillStreak?: StatRecord;
  mostCourierKillsSingleGame?: StatRecord;
  mostRunesSingleGame?: StatRecord;
  mostNeutralKillsSingleGame?: StatRecord;
  mostObserverKillsSingleGame?: StatRecord;
  mostLaneKillsSingleGame?: StatRecord;
  highestNetWorthSingleGame?: StatRecord;
  mostGoldSpentSingleGame?: StatRecord;
  mostCampsStackedTotal?: StatRecord;
  mostTowerKillsSingleGame?: StatRecord;
  mostSentryPlacedSingleGame?: StatRecord;
}

export interface TeamStatsData {
  teamId: string;
  teamName: string;
  mostKillsSingleMatch?: StatRecord;
  fewestDeathsSingleMatch?: StatRecord;
  mostWardsSingleMatch?: StatRecord;
  fewestUniqueHeroes?: StatRecord;
  mostUniqueHeroes?: StatRecord;
  mostRoshanKills?: StatRecord;
  highestAvgGPM?: StatRecord;
  mostCampsStackedSingleGame?: StatRecord;
  mostDeniesSingleMatch?: StatRecord;
  bestKDRatio?: StatRecord;
  mostCourierKillsSingleMatch?: StatRecord;
  highestCombinedNetWorth?: StatRecord;
  mostLastHitsSingleMatch?: StatRecord;
  mostNeutralKillsSingleMatch?: StatRecord;
  mostLaneKillsSingleMatch?: StatRecord;
  mostRunesSingleMatch?: StatRecord;
  mostDewardsSingleMatch?: StatRecord;
  assistsPerKill?: StatRecord;
  shortestGame?: StatRecord;
  longestGame?: StatRecord;
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function findBestPlayer(
  players: PlayerStatsData[],
  statKey: keyof PlayerStatsData,
  mode: 'max' | 'min' = 'max',
): { value: number; playerName: string; heroName?: string } {
  if (players.length === 0) return { value: 0, playerName: '' };
  let best: PlayerStatsData | null = null;
  let bestVal = mode === 'max' ? -Infinity : Infinity;
  for (const p of players) {
    if (p.playerId?.startsWith('unknown_')) continue;
    if (p.playerName === p.playerId) continue;
    const stat = p[statKey] as StatRecord | undefined;
    const val = stat?.value ?? (mode === 'max' ? -Infinity : Infinity);
    if (mode === 'max' ? val > bestVal : val < bestVal) { bestVal = val; best = p; }
  }
  if (!best) return { value: 0, playerName: '' };
  const stat = best[statKey] as StatRecord | undefined;
  return { value: stat?.value ?? 0, playerName: best.playerName || '', heroName: stat?.heroName };
}

export function findBestTeam(
  teams: TeamStatsData[],
  statKey: keyof TeamStatsData,
  mode: 'max' | 'min' = 'max',
): { value: number; teamName: string } {
  if (teams.length === 0) return { value: 0, teamName: '' };
  let best: TeamStatsData | null = null;
  let bestVal = mode === 'max' ? -Infinity : Infinity;
  for (const t of teams) {
    const stat = t[statKey] as StatRecord | undefined;
    const val = stat?.value ?? (mode === 'max' ? -Infinity : Infinity);
    if (mode === 'max' ? val > bestVal : val < bestVal) { bestVal = val; best = t; }
  }
  if (!best) return { value: 0, teamName: '' };
  const stat = best[statKey] as StatRecord | undefined;
  return { value: stat?.value ?? 0, teamName: best.teamName || '' };
}

export function fmtNum(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return 'TBD';
  return n.toLocaleString('pl-PL');
}
export function fmtDec(n: number | undefined | null, digits = 1): string {
  if (n == null || isNaN(n) || !isFinite(n)) return 'TBD';
  return n.toFixed(digits);
}
export function fmtGold(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return 'TBD';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('pl-PL');
}
export function fmtDur(n: number | undefined | null): string {
  if (n == null || isNaN(n) || n <= 0) return 'TBD';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── StatCard ──────────────────────────────────────────────────────────

export interface StatCardProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
}

export function StatCard({ icon: Icon, title, value, subtitle, color }: StatCardProps): React.ReactElement {
  const { theme } = useTournament();
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative group bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:bg-white/[0.06] hover:border-white/10 transition-colors duration-300 cursor-default"
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}60` }}
      />
      <div className="pl-5 pr-4 pt-4 pb-4">
        <p className="text-xs uppercase tracking-widest leading-tight mb-2" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
          {title}
        </p>
        <p className="text-xl font-logik-extended-bold leading-snug break-words" style={{ color, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs mt-2 break-words" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── SectionHeader ─────────────────────────────────────────────────────

export interface SectionHeaderProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  color: string;
}

export function SectionHeader({ icon: Icon, title, description, color }: SectionHeaderProps): React.ReactElement {
  const { theme } = useTournament();
  return (
    <div className="flex items-center gap-4">
      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 16px ${color}80` }} />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <h2
            className="text-lg font-logik-extended-bold uppercase tracking-wide leading-none"
            style={{ color: theme.headingColor || theme.primaryTextColor || 'white', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}
          >
            {title}
          </h2>
          <p className="text-[10px] font-mono uppercase tracking-widest mt-0.5" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Section container ─────────────────────────────────────────────────

export interface SectionContainerProps {
  children: React.ReactNode;
  color: string;
  delay?: number;
}

export function SectionContainer({ children, color, delay = 0 }: SectionContainerProps): React.ReactElement {
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

// ─── Tab type ──────────────────────────────────────────────────────────

export type StatsTabId = 'tournament' | 'players' | 'teams';

// ─── StatsContent ──────────────────────────────────────────────────────

export interface StatsContentProps {
  tournamentStats: TournamentStatsData | null;
  playerStats: PlayerStatsData[];
  teamStats: TeamStatsData[];
  /** If true, wraps the card grid in a scrollable container (for use inside snap-scroll view) */
  scrollable?: boolean;
}

export function StatsContent({ tournamentStats, playerStats, teamStats, scrollable }: StatsContentProps): React.ReactElement {
  const { theme } = useTournament();
  const t = useTranslations('stats');

  const [activeTab, setActiveTab] = useState<StatsTabId>('tournament');

  const TABS: { id: StatsTabId; label: string }[] = [
    { id: 'tournament', label: t('tabTournament') },
    { id: 'players',    label: t('players') },
    { id: 'teams',      label: t('teams') },
  ];

  const pc = theme.primaryColor;
  const ac = theme.accentColor;
  const sc = theme.secondaryColor;
  const ts = tournamentStats;

  const bp = (key: keyof PlayerStatsData) => findBestPlayer(playerStats, key);
  const bpVal = (key: keyof PlayerStatsData, fmt: (v: number) => string): string => {
    const { value, playerName } = bp(key);
    if (!playerName) return 'TBD';
    return `${playerName} \u2014 ${fmt(value)}`;
  };
  const bpSub = (key: keyof PlayerStatsData): string | undefined => {
    const { playerName, heroName } = bp(key);
    const stat = playerStats.find(p => p.playerName === playerName)?.[key] as StatRecord | undefined;
    const parts: string[] = [];
    if (stat?.opponent) parts.push(`vs ${stat.opponent}`);
    if (heroName) parts.push(heroName);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  const bt = (key: keyof TeamStatsData, mode: 'max' | 'min' = 'max') => findBestTeam(teamStats, key, mode);
  const btSub = (key: keyof TeamStatsData, mode: 'max' | 'min' = 'max'): string => {
    const { teamName } = bt(key, mode);
    const team = teamStats.find(t => t.teamName === teamName);
    const stat = team?.[key] as StatRecord | undefined;
    return stat?.opponent ? `${teamName} vs ${stat.opponent}` : teamName;
  };

  return (
    <div className={cn(scrollable && 'flex flex-col h-full')}>
      {/* Tab buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center justify-center gap-2 flex-wrap flex-shrink-0 mb-8"
      >
        {TABS.map(({ id, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'px-7 py-3 rounded-full text-sm uppercase tracking-widest transition-all duration-300',
                isActive
                  ? 'text-black font-bold shadow-lg'
                  : 'bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:text-white',
              )}
              style={isActive
                ? { backgroundColor: pc, boxShadow: `0 0 20px ${pc}60` }
                : { color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}
            >
              {label}
            </button>
          );
        })}
      </motion.div>

      {/* Tab content */}
      <div className={cn(scrollable && 'flex-1 min-h-0 overflow-y-auto')}>
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
              <StatCard icon={Crown}      color={sc} title={t('mostPicks')}      value={ts?.mostPickedHero     ? `${ts.mostPickedHero.heroName} — ${ts.mostPickedHero.pickCount}`         : t('tbd')} />
              <StatCard icon={Crosshair}  color={sc} title={t('mostBans')}       value={ts?.mostBannedHero     ? `${ts.mostBannedHero.heroName} — ${ts.mostBannedHero.banCount}`           : t('tbd')} />
              <StatCard icon={Flame}      color={sc} title={t('picksAndBans')}   value={ts?.mostContestedHero  ? `${ts.mostContestedHero.heroName} — ${ts.mostContestedHero.contestCount}` : t('tbd')} />
              <StatCard icon={Sword}      color={sc} title={t('kills')}          value={fmtNum(ts?.totalKills)} />
              <StatCard icon={Flame}      color={sc} title={t('rampages')}       value={fmtNum(ts?.totalRampages)} />
              <StatCard icon={Zap}        color={sc} title={t('ultraKills')}     value={fmtNum(ts?.totalUltraKills)} />
              <StatCard icon={Swords}     color={sc} title={t('tripleKills')}    value={fmtNum(ts?.totalTripleKills)} />
              <StatCard icon={Activity}   color={sc} title={t('doubleKills')}    value={fmtNum(ts?.totalDoubleKills)} />
              <StatCard icon={Heart}      color={sc} title={t('heroHealing')}    value={fmtGold(ts?.totalHealing)} />
              <StatCard icon={Timer}      color={sc} title={t('buybacks')}       value={fmtNum(ts?.totalBuybacks)} />
              <StatCard icon={Shield}     color={sc} title={t('towersDestroyed')} value={fmtNum(ts?.totalTowerKills)} />
              <StatCard icon={Shield}     color={sc} title={t('buildingDamage')} value={fmtGold(ts?.totalTowerDamage)} />
              <StatCard icon={Trophy}     color={sc} title={t('roshans')}        value={fmtNum(ts?.totalRoshanKills)} />
              <StatCard icon={Target}     color={sc} title={t('courierKills')}   value={fmtNum(ts?.totalCourierKills)} />
              <StatCard icon={TreePine}   color={sc} title={t('neutralCreeps')}  value={fmtNum(ts?.totalNeutralKills)} />
              <StatCard icon={DollarSign} color={sc} title={t('goldSpent')}      value={fmtGold(ts?.totalGoldSpent)} />
              <StatCard icon={Eye}        color={sc} title={t('wardsPlaced')}    value={fmtNum(ts?.totalWardsPlaced)} />
              <StatCard icon={Zap}        color={sc} title={t('runesPickedUp')}  value={fmtNum(ts?.totalRunesPickedUp)} />
              <StatCard icon={TreePine}   color={sc} title={t('campsStacked')}   value={fmtNum(ts?.totalCampsStacked)} />
              <StatCard icon={BarChart3}  color={sc} title={t('gamesPlayed')}    value={fmtNum(ts?.totalGames)} />
            </motion.div>
          )}

          {/* ════ PLAYERS ════ */}
          {activeTab === 'players' && (
            <motion.div
              key="players"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
            >
              <StatCard icon={Sword}      color={pc} title={t('kills')}                   value={bpVal('mostKillsSingleGame', fmtNum)}                       subtitle={bpSub('mostKillsSingleGame')} />
              <StatCard icon={Zap}        color={pc} title={t('assists')}                  value={bpVal('mostAssistsSingleGame', fmtNum)}                     subtitle={bpSub('mostAssistsSingleGame')} />
              <StatCard icon={DollarSign} color={pc} title={t('gpm')}                      value={bpVal('highestGPMSingleGame', fmtNum)}                      subtitle={bpSub('highestGPMSingleGame')} />
              <StatCard icon={TrendingUp} color={pc} title={t('xpm')}                      value={bpVal('highestXPMSingleGame', fmtNum)}                      subtitle={bpSub('highestXPMSingleGame')} />
              <StatCard icon={Crosshair}  color={pc} title={t('lastHits')}                 value={bpVal('mostLastHitsSingleGame', fmtNum)}                    subtitle={bpSub('mostLastHitsSingleGame')} />
              <StatCard icon={Flame}      color={pc} title={t('heroDamage')}               value={bpVal('mostHeroDamageSingleGame', fmtGold)}                 subtitle={bpSub('mostHeroDamageSingleGame')} />
              <StatCard icon={Shield}     color={pc} title={t('towerDamage')}              value={bpVal('mostTowerDamageSingleGame', fmtGold)}                subtitle={bpSub('mostTowerDamageSingleGame')} />
              <StatCard icon={Eye}        color={pc} title={t('wardsPlaced')}              value={bpVal('mostWardsSingleGame', fmtNum)}                       subtitle={bpSub('mostWardsSingleGame')} />
              <StatCard icon={Star}       color={pc} title={t('fantasyScore')}             value={bpVal('bestFantasyScoreSingleGame', v => fmtDec(v))}        subtitle={bpSub('bestFantasyScoreSingleGame')} />
              <StatCard icon={Crown}      color={pc} title={t('killStreak')}               value={bpVal('highestKillStreak', fmtNum)}                         subtitle={bpSub('highestKillStreak')} />
              <StatCard icon={Target}     color={pc} title={t('courierKills')}             value={bpVal('mostCourierKillsSingleGame', fmtNum)}                subtitle={bpSub('mostCourierKillsSingleGame')} />
              <StatCard icon={Zap}        color={pc} title={t('runesPlayer')}              value={bpVal('mostRunesSingleGame', fmtNum)}                       subtitle={bpSub('mostRunesSingleGame')} />
              <StatCard icon={TreePine}   color={pc} title={t('neutralsPlayer')}           value={bpVal('mostNeutralKillsSingleGame', fmtNum)}                subtitle={bpSub('mostNeutralKillsSingleGame')} />
              <StatCard icon={Eye}        color={pc} title={t('wardsDestroyed')}           value={bpVal('mostObserverKillsSingleGame', fmtNum)}               subtitle={bpSub('mostObserverKillsSingleGame')} />
              <StatCard icon={Crosshair}  color={pc} title={t('laneKills')}                value={bpVal('mostLaneKillsSingleGame', fmtNum)}                   subtitle={bpSub('mostLaneKillsSingleGame')} />
              <StatCard icon={DollarSign} color={pc} title={t('netWorth')}                 value={bpVal('highestNetWorthSingleGame', fmtGold)}               subtitle={bpSub('highestNetWorthSingleGame')} />
              <StatCard icon={DollarSign} color={pc} title={t('goldSpent')}                value={bpVal('mostGoldSpentSingleGame', fmtGold)}                 subtitle={bpSub('mostGoldSpentSingleGame')} />
              <StatCard icon={TreePine}   color={pc} title={t('mostCampsStackedPlayer')}   value={bpVal('mostCampsStackedTotal', fmtNum)}                     subtitle={bpSub('mostCampsStackedTotal')} />
              <StatCard icon={Shield}     color={pc} title={t('towerKills')}               value={bpVal('mostTowerKillsSingleGame', fmtNum)}                  subtitle={bpSub('mostTowerKillsSingleGame')} />
              <StatCard icon={Eye}        color={pc} title={t('sentryWards')}              value={bpVal('mostSentryPlacedSingleGame', fmtNum)}               subtitle={bpSub('mostSentryPlacedSingleGame')} />
            </motion.div>
          )}

          {/* ════ TEAMS ════ */}
          {activeTab === 'teams' && (
            <motion.div
              key="teams"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
            >
              <StatCard icon={Swords}     color={ac} title={t('mostKillsMatch')}        value={fmtNum(bt('mostKillsSingleMatch').value)}            subtitle={btSub('mostKillsSingleMatch')} />
              <StatCard icon={Shield}     color={ac} title={t('fewestDeathsMatch')}     value={fmtNum(bt('fewestDeathsSingleMatch', 'min').value)}   subtitle={btSub('fewestDeathsSingleMatch', 'min')} />
              <StatCard icon={Eye}        color={ac} title={t('mostWardsMatch')}         value={fmtNum(bt('mostWardsSingleMatch').value)}            subtitle={btSub('mostWardsSingleMatch')} />
              <StatCard icon={Crown}      color={ac} title={t('fewestUniqueHeroes')}    value={fmtNum(bt('fewestUniqueHeroes', 'min').value)}        subtitle={bt('fewestUniqueHeroes', 'min').teamName} />
              <StatCard icon={Crown}      color={ac} title={t('mostUniqueHeroes')}      value={fmtNum(bt('mostUniqueHeroes').value)}                subtitle={bt('mostUniqueHeroes').teamName} />
              <StatCard icon={Trophy}     color={ac} title={t('mostRoshans')}           value={fmtNum(bt('mostRoshanKills').value)}                 subtitle={bt('mostRoshanKills').teamName} />
              <StatCard icon={TrendingUp} color={ac} title={t('highestAvgGPM')}         value={fmtNum(bt('highestAvgGPM').value)}                   subtitle={bt('highestAvgGPM').teamName} />
              <StatCard icon={TreePine}   color={ac} title={t('mostCampsGame')}         value={fmtNum(bt('mostCampsStackedSingleGame').value)}      subtitle={btSub('mostCampsStackedSingleGame')} />
              <StatCard icon={Sword}      color={ac} title={t('mostDeniesMatch')}       value={fmtNum(bt('mostDeniesSingleMatch').value)}           subtitle={btSub('mostDeniesSingleMatch')} />
              <StatCard icon={Activity}   color={ac} title={t('bestKD')}                value={fmtDec(bt('bestKDRatio').value)}                     subtitle={bt('bestKDRatio').teamName} />
              <StatCard icon={Target}     color={ac} title={t('mostCourierKillsMatch')} value={fmtNum(bt('mostCourierKillsSingleMatch').value)}     subtitle={btSub('mostCourierKillsSingleMatch')} />
              <StatCard icon={DollarSign} color={ac} title={t('highestNetWorthMatch')}  value={fmtGold(bt('highestCombinedNetWorth').value)}        subtitle={btSub('highestCombinedNetWorth')} />
              <StatCard icon={Crosshair}  color={ac} title={t('mostLastHitsMatch')}     value={fmtNum(bt('mostLastHitsSingleMatch').value)}         subtitle={btSub('mostLastHitsSingleMatch')} />
              <StatCard icon={TreePine}   color={ac} title={t('mostNeutralKillsMatch')} value={fmtNum(bt('mostNeutralKillsSingleMatch').value)}     subtitle={btSub('mostNeutralKillsSingleMatch')} />
              <StatCard icon={Crosshair}  color={ac} title={t('mostLaneKillsMatch')}   value={fmtNum(bt('mostLaneKillsSingleMatch').value)}        subtitle={btSub('mostLaneKillsSingleMatch')} />
              <StatCard icon={Zap}        color={ac} title={t('mostRunesMatch')}        value={fmtNum(bt('mostRunesSingleMatch').value)}            subtitle={btSub('mostRunesSingleMatch')} />
              <StatCard icon={Eye}        color={ac} title={t('mostDewardsMatch')}      value={fmtNum(bt('mostDewardsSingleMatch').value)}          subtitle={btSub('mostDewardsSingleMatch')} />
              <StatCard icon={Activity}   color={ac} title={t('assistsPerKill')}        value={fmtDec(bt('assistsPerKill').value, 2)}              subtitle={bt('assistsPerKill').teamName} />
              <StatCard icon={Timer}      color={ac} title={t('shortestGame')}          value={fmtDur(bt('shortestGame', 'min').value)}             subtitle={btSub('shortestGame', 'min')} />
              <StatCard icon={Timer}      color={ac} title={t('longestGame')}           value={fmtDur(bt('longestGame').value)}                    subtitle={btSub('longestGame')} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── StatsPageLayout ──────────────────────────────────────────────────
// Full page body: hero (tournament name + giant title + line + lastUpdated) + StatsContent.
// Used by both the /stats page and the home page View 5 snap-scroll section.

export interface StatsPageLayoutProps {
  tournamentStats: TournamentStatsData | null;
  playerStats: PlayerStatsData[];
  teamStats: TeamStatsData[];
}

export function StatsPageLayout({ tournamentStats, playerStats, teamStats }: StatsPageLayoutProps): React.ReactElement | null {
  const { tournament, theme, getTournamentPath } = useTournament();
  const t = useTranslations('stats');

  if (!tournament) return null;

  const pc = theme.primaryColor;
  const ts = tournamentStats;

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-12 py-5 sm:py-8 space-y-6 md:space-y-10">

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center"
      >
        <p
          className="text-[10px] md:text-xs uppercase tracking-[0.3em] mb-4"
          style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.25)' }}
        >
          {tournament.name}
        </p>
        <h1
          className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight leading-none"
          style={{ color: theme.titleColor || 'white', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}
        >
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
            className="text-[10px] uppercase tracking-widest mt-4"
            style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.2)' }}
          >
            {t('lastUpdated')} {new Date(ts.lastUpdated).toLocaleString('pl-PL')}
          </motion.p>
        )}
      </motion.div>

      {/* Tabs + cards */}
      <StatsContent
        tournamentStats={tournamentStats}
        playerStats={playerStats}
        teamStats={teamStats}
      />

      {/* Privacy link */}
      <div className="text-center pt-8 pb-4 flex items-center justify-center gap-4">
        <div className="h-px w-12 rounded-full" style={{ background: `linear-gradient(to right, transparent, ${pc}50)` }} />
        <Link
          href={getTournamentPath('/privacy')}
          className="text-xs tracking-widest uppercase transition-opacity opacity-50 hover:opacity-100"
          style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.35)' }}
        >
          Polityka Prywatności
        </Link>
        <div className="h-px w-12 rounded-full" style={{ background: `linear-gradient(to left, transparent, ${pc}50)` }} />
      </div>

    </div>
  );
}
