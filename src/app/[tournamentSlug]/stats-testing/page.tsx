'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Trophy, Target, Sword, Shield, Crown, Users, Activity, TrendingUp,
  Zap, DollarSign, Eye, Star, Crosshair, BarChart3, Timer, Flame,
  Swords, Heart, TreePine, ExternalLink, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type TournamentStatsData, type PlayerStatsData, type TeamStatsData, type StatRecord,
  fmtNum, fmtDec, fmtGold, fmtDur,
} from '@/components/stats/StatsContent';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBestPlayerRecord(
  players: PlayerStatsData[],
  key: keyof PlayerStatsData,
  mode: 'max' | 'min' = 'max',
): { value: number; playerName: string; heroName?: string; matchId?: string } {
  let best: PlayerStatsData | null = null;
  let bestVal = mode === 'max' ? -Infinity : Infinity;
  for (const p of players) {
    if (p.playerId?.startsWith('unknown_') || p.playerName === p.playerId) continue;
    const stat = p[key] as StatRecord | undefined;
    const val = stat?.value ?? (mode === 'max' ? -Infinity : Infinity);
    if (mode === 'max' ? val > bestVal : val < bestVal) { bestVal = val; best = p; }
  }
  if (!best) return { value: 0, playerName: '' };
  const stat = best[key] as StatRecord | undefined;
  return {
    value:      stat?.value ?? 0,
    playerName: best.playerName ?? '',
    heroName:   stat?.heroName,
    matchId:    stat?.matchId,
  };
}

function getBestTeamRecord(
  teams: TeamStatsData[],
  key: keyof TeamStatsData,
  mode: 'max' | 'min' = 'max',
): { value: number; teamName: string; opponent?: string; matchId?: string } {
  let best: TeamStatsData | null = null;
  let bestVal = mode === 'max' ? -Infinity : Infinity;
  for (const t of teams) {
    const stat = t[key] as StatRecord | undefined;
    const val = stat?.value ?? (mode === 'max' ? -Infinity : Infinity);
    if (mode === 'max' ? val > bestVal : val < bestVal) { bestVal = val; best = t; }
  }
  if (!best) return { value: 0, teamName: '' };
  const stat = best[key] as StatRecord | undefined;
  return {
    value:    stat?.value ?? 0,
    teamName: best.teamName ?? '',
    opponent: stat?.opponent,
    matchId:  stat?.matchId,
  };
}

// ─── Glance strip ─────────────────────────────────────────────────────────────

function GlancePill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <span className="text-2xl font-logik-extended-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[9px] uppercase tracking-widest opacity-40 text-white text-center">{label}</span>
    </div>
  );
}

function GlanceStrip({ ts, color }: { ts: TournamentStatsData; color: string }) {
  const pills = [
    { label: 'Drużyny',   value: fmtNum(ts.totalTeams) },
    { label: 'Mecze',     value: fmtNum(ts.totalMatches) },
    { label: 'Gry',       value: fmtNum(ts.totalGames) },
    { label: 'Godziny',   value: fmtDec(ts.totalHoursPlayed, 0) },
    { label: 'Zabójstwa', value: fmtNum(ts.totalKills) },
    { label: 'Rampages',  value: fmtNum(ts.totalRampages) },
    { label: 'Wardy',     value: fmtNum(ts.totalWardsPlaced) },
    { label: 'Roshany',   value: fmtNum(ts.totalRoshanKills) },
  ];
  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] px-4 py-5"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${color}50, transparent)` }} />
      <div className="flex items-center justify-around flex-wrap gap-y-4 gap-x-2">
        {pills.map((p, i) => (
          <React.Fragment key={p.label}>
            {i > 0 && <div className="h-8 w-px bg-white/[0.06] hidden sm:block" />}
            <GlancePill label={p.label} value={p.value} color={color} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Record card (with optional match chip) ───────────────────────────────────

function RecordCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
  matchPath,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  value: string;
  subtitle?: string;
  color: string;
  matchPath?: string;
}) {
  const { theme } = useTournament();
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:bg-white/[0.06] hover:border-white/10 transition-colors duration-300 flex flex-col"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}60` }} />
      <div className="pl-5 pr-4 pt-4 pb-3 flex-1">
        <p className="text-xs uppercase tracking-widest leading-tight mb-2" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
          {title}
        </p>
        <p className="text-lg font-logik-extended-bold leading-snug break-words" style={{ color }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] mt-1.5 break-words" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.35)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {matchPath && (
        <Link
          href={matchPath}
          className="flex items-center gap-1.5 px-5 py-2 border-t border-white/[0.05] text-[9px] uppercase tracking-widest opacity-40 hover:opacity-90 transition-opacity"
          style={{ color }}
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          Zobacz mecz
        </Link>
      )}
    </motion.div>
  );
}

// ─── Aggregate card (no match chip, compact style) ────────────────────────────

function AggCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}) {
  const { theme } = useTournament();
  return (
    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
      <Icon className="w-4 h-4 shrink-0 opacity-50" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-widest truncate" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
          {label}
        </p>
        <p className="text-sm font-logik-extended-bold" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  color,
  delay = 0,
  children,
  grid = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  delay?: number;
  children: React.ReactNode;
  grid?: boolean;
}) {
  const { theme } = useTournament();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-[2px] rounded-full" style={{ backgroundColor: color }} />
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span
          className="text-[10px] uppercase tracking-[0.2em] font-logik-extended-bold"
          style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.35)' }}
        >
          {title}
        </span>
      </div>
      {grid ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {children}
        </div>
      ) : (
        <div>{children}</div>
      )}
    </motion.div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'tournament' | 'players' | 'teams';

// ─── Tournament tab ───────────────────────────────────────────────────────────

function TournamentTab({ ts, color }: { ts: TournamentStatsData | null; color: string }) {
  if (!ts) return <p className="text-white/30 text-sm">Brak danych.</p>;
  return (
    <div className="space-y-8">

      {/* Glance strip */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <GlanceStrip ts={ts} color={color} />
      </motion.div>

      {/* Hero meta — 3 cards, not aggregates */}
      <Section title="Meta bohaterów" icon={Crown} color={color} delay={0.05}>
        <RecordCard icon={Crown}   color={color} title="Najpickowany"  value={ts.mostPickedHero    ? `${ts.mostPickedHero.heroName} — ${ts.mostPickedHero.pickCount} picków`            : 'TBD'} />
        <RecordCard icon={Target}  color={color} title="Najbanowany"   value={ts.mostBannedHero    ? `${ts.mostBannedHero.heroName} — ${ts.mostBannedHero.banCount} banów`               : 'TBD'} />
        <RecordCard icon={Flame}   color={color} title="Najkontestowany" value={ts.mostContestedHero ? `${ts.mostContestedHero.heroName} — ${ts.mostContestedHero.contestCount} razy`  : 'TBD'} />
      </Section>

      {/* Combat totals */}
      <Section title="Walka" icon={Swords} color={color} delay={0.1}>
        <AggCard icon={Sword}    label="Zabójstwa"    value={fmtNum(ts.totalKills)}       color={color} />
        <AggCard icon={Flame}    label="Rampages"     value={fmtNum(ts.totalRampages)}    color={color} />
        <AggCard icon={Zap}      label="Ultra Kille"  value={fmtNum(ts.totalUltraKills)}  color={color} />
        <AggCard icon={Swords}   label="Triple Kille" value={fmtNum(ts.totalTripleKills)} color={color} />
        <AggCard icon={Activity} label="Double Kille" value={fmtNum(ts.totalDoubleKills)} color={color} />
        <AggCard icon={Heart}    label="Leczenie"     value={fmtGold(ts.totalHealing)}    color={color} />
        <AggCard icon={Timer}    label="Buybacki"     value={fmtNum(ts.totalBuybacks)}    color={color} />
      </Section>

      {/* Objectives */}
      <Section title="Cele" icon={Trophy} color={color} delay={0.15}>
        <AggCard icon={Shield}   label="Wieże"         value={fmtNum(ts.totalTowerKills)}    color={color} />
        <AggCard icon={Shield}   label="Dmg wieże"     value={fmtGold(ts.totalTowerDamage)}  color={color} />
        <AggCard icon={Trophy}   label="Roshany"       value={fmtNum(ts.totalRoshanKills)}   color={color} />
        <AggCard icon={Target}   label="Killery kurie" value={fmtNum(ts.totalCourierKills)}  color={color} />
        <AggCard icon={TreePine} label="Neutralne"     value={fmtNum(ts.totalNeutralKills)}  color={color} />
      </Section>

      {/* Economy & vision */}
      <Section title="Ekonomia i wizja" icon={Eye} color={color} delay={0.2}>
        <AggCard icon={DollarSign} label="Wydane złoto"  value={fmtGold(ts.totalGoldSpent)}      color={color} />
        <AggCard icon={Eye}        label="Wardy"          value={fmtNum(ts.totalWardsPlaced)}     color={color} />
        <AggCard icon={Zap}        label="Runy"           value={fmtNum(ts.totalRunesPickedUp)}   color={color} />
        <AggCard icon={TreePine}   label="Stacki"         value={fmtNum(ts.totalCampsStacked)}   color={color} />
      </Section>

    </div>
  );
}

// ─── Players tab ──────────────────────────────────────────────────────────────

function PlayersTab({ players, color, getTournamentPath }: {
  players: PlayerStatsData[];
  color: string;
  getTournamentPath: (p: string) => string;
}) {
  const chip = (key: keyof PlayerStatsData, fmt: (v: number) => string, mode: 'max' | 'min' = 'max') => {
    const r = getBestPlayerRecord(players, key, mode);
    if (!r.playerName) return null;
    return {
      value:     `${r.playerName} — ${fmt(r.value)}`,
      subtitle:  r.heroName,
      matchPath: r.matchId ? getTournamentPath(`/schedule?match=${r.matchId}`) : undefined,
    };
  };

  const c = (key: keyof PlayerStatsData, fmt: (v: number) => string, icon: React.ComponentType<any>, title: string) => {
    const d = chip(key, fmt);
    if (!d) return null;
    return <RecordCard key={key} icon={icon} color={color} title={title} value={d.value} subtitle={d.subtitle} matchPath={d.matchPath} />;
  };

  return (
    <div className="space-y-8">
      <Section title="Walka" icon={Swords} color={color} delay={0}>
        {c('mostKillsSingleGame',    fmtNum,               Sword,     'Zabójstwa')}
        {c('mostAssistsSingleGame',  fmtNum,               Zap,       'Asysty')}
        {c('highestKillStreak',      fmtNum,               Crown,     'Kill streak')}
      </Section>

      <Section title="Ekonomia" icon={DollarSign} color={color} delay={0.05}>
        {c('highestGPMSingleGame',   fmtNum,               DollarSign,'GPM')}
        {c('highestXPMSingleGame',   fmtNum,               TrendingUp,'XPM')}
        {c('mostLastHitsSingleGame', fmtNum,               Crosshair, 'Last hity')}
        {c('highestNetWorthSingleGame', fmtGold,           DollarSign,'Net worth')}
        {c('mostGoldSpentSingleGame',   fmtGold,           DollarSign,'Wydane złoto')}
      </Section>

      <Section title="Obrażenia" icon={Flame} color={color} delay={0.1}>
        {c('mostHeroDamageSingleGame',  fmtGold,           Flame,     'Dmg na bohaterów')}
        {c('mostTowerDamageSingleGame', fmtGold,           Shield,    'Dmg na wieże')}
        {c('mostTowerKillsSingleGame',  fmtNum,            Shield,    'Zabite wieże')}
      </Section>

      <Section title="Wizja" icon={Eye} color={color} delay={0.15}>
        {c('mostWardsSingleGame',         fmtNum,           Eye,       'Postawione wardy')}
        {c('mostSentryPlacedSingleGame',  fmtNum,           Eye,       'Sentry wardy')}
        {c('mostObserverKillsSingleGame', fmtNum,           Eye,       'Zniszczone obs.')}
      </Section>

      <Section title="Farmienie i mapa" icon={TreePine} color={color} delay={0.2}>
        {c('mostNeutralKillsSingleGame',  fmtNum,           TreePine,  'Neutralne creepy')}
        {c('mostLaneKillsSingleGame',     fmtNum,           Crosshair, 'Lane kille')}
        {c('mostCampsStackedTotal',       fmtNum,           TreePine,  'Stacki')}
      </Section>

      <Section title="Inne" icon={Star} color={color} delay={0.25}>
        {c('bestFantasyScoreSingleGame',  v => fmtDec(v),   Star,     'Fantasy score')}
        {c('mostCourierKillsSingleGame',  fmtNum,           Target,   'Killery kurie')}
        {c('mostRunesSingleGame',         fmtNum,           Zap,      'Zebrane runy')}
      </Section>
    </div>
  );
}

// ─── Teams tab ────────────────────────────────────────────────────────────────

function TeamsTab({ teams, color, getTournamentPath }: {
  teams: TeamStatsData[];
  color: string;
  getTournamentPath: (p: string) => string;
}) {
  const chip = (key: keyof TeamStatsData, fmt: (v: number) => string, mode: 'max' | 'min' = 'max') => {
    const r = getBestTeamRecord(teams, key, mode);
    if (!r.teamName) return null;
    const subtitle = r.opponent ? `${r.teamName} vs ${r.opponent}` : r.teamName;
    return {
      value:     fmt(r.value),
      subtitle,
      matchPath: r.matchId ? getTournamentPath(`/schedule?match=${r.matchId}`) : undefined,
    };
  };

  const c = (key: keyof TeamStatsData, fmt: (v: number) => string, icon: React.ComponentType<any>, title: string, mode: 'max' | 'min' = 'max') => {
    const d = chip(key, fmt, mode);
    if (!d) return null;
    return <RecordCard key={key} icon={icon} color={color} title={title} value={d.value} subtitle={d.subtitle} matchPath={d.matchPath} />;
  };

  return (
    <div className="space-y-8">
      <Section title="Walka" icon={Swords} color={color} delay={0}>
        {c('mostKillsSingleMatch',     fmtNum,          Swords,     'Najwięcej zabójstw')}
        {c('fewestDeathsSingleMatch',  fmtNum,          Shield,     'Najmniej śmierci',   'min')}
        {c('bestKDRatio',              v => fmtDec(v),  Activity,   'Najlepszy K/D')}
        {c('mostDeniesSingleMatch',    fmtNum,          Crosshair,  'Deniesy')}
        {c('mostCourierKillsSingleMatch', fmtNum,       Target,     'Killery kurie')}
      </Section>

      <Section title="Ekonomia" icon={DollarSign} color={color} delay={0.05}>
        {c('highestAvgGPM',           fmtNum,           TrendingUp, 'Średnie GPM')}
        {c('highestCombinedNetWorth', fmtGold,          DollarSign, 'Łączny net worth')}
        {c('mostLastHitsSingleMatch', fmtNum,           Crosshair,  'Last hity')}
      </Section>

      <Section title="Wizja i mapa" icon={Eye} color={color} delay={0.1}>
        {c('mostWardsSingleMatch',    fmtNum,           Eye,        'Wardy')}
        {c('mostDewardsSingleMatch',  fmtNum,           Eye,        'Dewarded')}
        {c('mostCampsStackedSingleGame', fmtNum,        TreePine,   'Stacki')}
        {c('mostRunesSingleMatch',    fmtNum,           Zap,        'Runy')}
      </Section>

      <Section title="Cele" icon={Trophy} color={color} delay={0.15}>
        {c('mostRoshanKills',          fmtNum,           Trophy,     'Roshany')}
        {c('mostNeutralKillsSingleMatch', fmtNum,        TreePine,   'Neutralne')}
        {c('mostLaneKillsSingleMatch', fmtNum,           Crosshair,  'Lane kille')}
      </Section>

      <Section title="Zróżnicowanie i czas" icon={BarChart3} color={color} delay={0.2}>
        {c('fewestUniqueHeroes',       fmtNum,           Crown,      'Najmniej unikalnych hero', 'min')}
        {c('mostUniqueHeroes',         fmtNum,           Crown,      'Najwięcej unikalnych hero')}
        {c('assistsPerKill',           v => fmtDec(v, 2), Activity,  'Asysty / zabójstwo')}
        {c('shortestGame',             fmtDur,           Timer,      'Najkrótsza gra',  'min')}
        {c('longestGame',              fmtDur,           Timer,      'Najdłuższa gra')}
      </Section>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsTestingPage(): React.ReactElement | null {
  const { tournament, theme, isLegacyTournament, getTournamentPath } = useTournament();

  const [tournamentStats, setTournamentStats] = useState<TournamentStatsData | null>(null);
  const [playerStats,     setPlayerStats]     = useState<PlayerStatsData[]>([]);
  const [teamStats,       setTeamStats]       = useState<TeamStatsData[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [activeTab,       setActiveTab]       = useState<TabId>('tournament');

  const loadStats = useCallback(async () => {
    if (!tournament?.id) { setLoading(false); return; }
    const [tDoc, pSnap, tmSnap] = isLegacyTournament
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
    if (tDoc.exists()) setTournamentStats(tDoc.data() as TournamentStatsData);
    setPlayerStats(pSnap.docs.map(d => ({ playerId: d.id, ...d.data() } as PlayerStatsData)));
    setTeamStats(tmSnap.docs.map(d => ({ teamId: d.id, ...d.data() } as TeamStatsData)));
    setLoading(false);
  }, [tournament?.id, isLegacyTournament]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (!tournament) return null;

  const pc = theme.primaryColor;
  const ac = theme.accentColor;
  const sc = theme.secondaryColor;

  const TABS: { id: TabId; label: string; color: string }[] = [
    { id: 'tournament', label: 'Turniej',  color: sc },
    { id: 'players',    label: 'Gracze',   color: pc },
    { id: 'teams',      label: 'Drużyny',  color: ac },
  ];

  const activeColor = TABS.find(t => t.id === activeTab)?.color ?? pc;

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)' }} />
        <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.05] blur-[200px]" style={{ background: pc }} />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]" style={{ background: ac }} />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-12 py-8 space-y-8">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.25)' }}>
            {tournament.name}
          </p>
          <h1
            className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight"
            style={{ color: theme.titleColor || 'white', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}
          >
            Statystyki
          </h1>
          <div className="h-px w-32 mx-auto mt-4 rounded-full" style={{ background: `linear-gradient(to right, transparent, ${pc}90, transparent)` }} />
          {tournamentStats?.lastUpdated && (
            <p className="text-[10px] uppercase tracking-widest mt-3" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.2)' }}>
              Ostatnia aktualizacja: {new Date(tournamentStats.lastUpdated).toLocaleString('pl-PL')}
            </p>
          )}
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center justify-center gap-2 flex-wrap"
        >
          {TABS.map(({ id, label, color }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'px-7 py-3 rounded-full text-sm uppercase tracking-widest transition-all duration-300',
                  isActive
                    ? 'text-black font-bold shadow-lg'
                    : 'bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20',
                )}
                style={isActive
                  ? { backgroundColor: color, boxShadow: `0 0 20px ${color}60` }
                  : { color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}
              >
                {label}
              </button>
            );
          })}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${pc}60 transparent transparent transparent` }} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'tournament' && (
              <motion.div key="tournament" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
                <TournamentTab ts={tournamentStats} color={sc} />
              </motion.div>
            )}
            {activeTab === 'players' && (
              <motion.div key="players" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
                <PlayersTab players={playerStats} color={pc} getTournamentPath={getTournamentPath} />
              </motion.div>
            )}
            {activeTab === 'teams' && (
              <motion.div key="teams" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
                <TeamsTab teams={teamStats} color={ac} getTournamentPath={getTournamentPath} />
              </motion.div>
            )}
          </AnimatePresence>
        )}

      </div>
    </div>
  );
}
