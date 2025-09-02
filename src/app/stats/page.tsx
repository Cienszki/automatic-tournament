'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
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
  Award,
  Crosshair,
  BarChart3,
  Timer,
  Flame
} from 'lucide-react';

// Add special animations CSS
const animationCSS = `
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-shimmer {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

.animate-gradient {
  animation: gradient 3s ease infinite;
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out;
}
`;

// Inject CSS
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animationCSS;
  document.head.appendChild(style);
}

// Enhanced StatCard component with animations and visual effects
const StatCard = ({ 
  icon: Icon, 
  title, 
  value, 
  subtitle = '', 
  delay = '0ms',
  gradient = false,
  highlight = false 
}: { 
  icon: React.ComponentType<any>; 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  delay?: string;
  gradient?: boolean;
  highlight?: boolean;
}) => (
  <Card 
    className={`
      relative overflow-hidden group
      transition-all duration-700 hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 
      animate-fade-in-up transform-gpu
      ${gradient ? 'bg-gradient-to-br from-card/80 to-primary/10 border-primary/40' : 'bg-card/90 border-primary/20'}
      ${highlight ? 'ring-2 ring-primary/70 border-primary/50 bg-gradient-to-br from-primary/5 to-accent/5' : ''}
      backdrop-blur-sm shadow-lg shadow-primary/10
      before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/10 before:to-accent/10 before:opacity-0 before:transition-opacity before:duration-700 hover:before:opacity-100
    `}
    style={{ animationDelay: delay }}
  >
    <CardContent className="p-4 relative z-10">
      <div className="flex items-center space-x-3">
        <div className={`
          p-2 rounded-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-3
          ${gradient 
            ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30' 
            : 'bg-gradient-to-r from-primary/20 to-accent/20 text-primary group-hover:from-primary/30 group-hover:to-accent/30 border border-primary/30'
          }
        `}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-1 transition-colors group-hover:text-foreground truncate">{title}</p>
          <p className={`
            text-lg font-bold transition-all duration-500 group-hover:scale-105 truncate
            ${gradient 
              ? 'bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent drop-shadow-sm' 
              : 'text-foreground group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-accent group-hover:bg-clip-text group-hover:text-transparent'
            }
          `}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 transition-all duration-300 group-hover:text-foreground/80 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      
      {/* Animated gradient background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-accent/0 to-primary/0 group-hover:from-primary/10 group-hover:via-accent/15 group-hover:to-primary/10 transition-all duration-1000 rounded-lg"></div>
      
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-primary/20 to-transparent skew-x-12"></div>
    </CardContent>
  </Card>
);

// Enhanced Section Header component with more visual flair
const SectionHeader = ({ 
  title, 
  description, 
  icon: Icon,
  delay = '0ms',
  accentColor = 'primary'
}: { 
  title: string; 
  description: string; 
  icon: React.ComponentType<any>;
  delay?: string;
  accentColor?: 'primary' | 'accent' | 'secondary' | 'blue' | 'purple' | 'emerald' | 'orange';
}) => {
  const colorVariants = {
    primary: 'from-primary to-primary',
    accent: 'from-accent to-accent', 
    secondary: 'from-secondary to-secondary',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600', 
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600'
  };
  
  const shadowVariants = {
    primary: 'shadow-primary/25',
    accent: 'shadow-accent/25',
    secondary: 'shadow-secondary/25',
    blue: 'shadow-blue-500/25',
    purple: 'shadow-purple-500/25',
    emerald: 'shadow-emerald-500/25',
    orange: 'shadow-orange-500/25'
  };
  
  return (
    <div 
      className="text-center space-y-6 animate-fade-in-up relative"
      style={{ animationDelay: delay }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 blur-3xl -z-10 rounded-full"></div>
      
      <div className="flex justify-center relative">
        {/* Glowing ring effect */}
        <div className={`absolute inset-0 bg-gradient-to-r ${colorVariants[accentColor]} rounded-full blur-lg opacity-30 animate-pulse`}></div>
        <div className={`relative p-6 rounded-full bg-gradient-to-r ${colorVariants[accentColor]} text-primary-foreground shadow-2xl ${shadowVariants[accentColor]} transition-all duration-500 hover:scale-110 hover:rotate-3`}>
          <Icon className="h-10 w-10" />
        </div>
      </div>
      
      <div className="space-y-3">
        <h2 className={`text-4xl font-bold bg-gradient-to-r ${colorVariants[accentColor]} bg-clip-text text-transparent drop-shadow-sm`}>
          {title}
        </h2>
        <div className={`h-1 w-24 mx-auto bg-gradient-to-r ${colorVariants[accentColor]} rounded-full`}></div>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};

// Type definitions
interface TournamentStats {
  id: string;
  totalTeams: number;
  totalMatches: number;
  totalGames: number;
  totalHoursPlayed: number;
  averageMatchDuration: number;
  longestMatch: { matchId: string; duration: number; teamA: string; teamB: string };
  shortestMatch: { matchId: string; duration: number; teamA: string; teamB: string };
  
  // Hero Statistics
  totalUniqueHeroesPicked: number;
  mostPickedHero?: { heroName: string; pickCount: number };
  mostBannedHero?: { heroName: string; banCount: number };
  mostPlayedRoleHero?: string;
  
  // Combat Statistics
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  averageKills: number;
  averageDeaths: number;
  averageAssists: number;
  totalRoshanKills: number;
  totalRampages: number;
  totalHealing: number;
  totalWardsPlaced: number;
  totalBuybacks: number;
  totalCreepsKilled: number;
  totalDenies: number;
  totalCouriersKilled: number;
  totalWardsDestroyed: number;
  uniqueHeroesPicked: number;
  totalFantasyPoints: number;
  
  // Economy
  totalGoldGenerated: number;
  averageNetWorth: number;
  averageLastHits: number;
  averageDenies: number;
  averageGPM: number;
  averageXPM: number;
  
  // Damage & Healing
  averageHeroDamage: number;
  averageTowerDamage: number;
  averageHeroHealing: number;
}

interface PlayerStats {
  playerId: string;
  playerName: string;
  totalMatches: number;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  
  // Performance metrics
  averageKills: { value: number };
  averageDeaths: { value: number };
  averageAssists: { value: number };
  averageNetWorth: { value: number };
  averageGPM: { value: number };
  averageXPM: { value: number };
  averageLastHits: { value: number };
  averageDenies: { value: number };
  averageHeroDamage: { value: number };
  averageTowerDamage: { value: number };
  averageHeroHealing: { value: number };
  
  // Single game records
  highestKillsSingleGame: { value: number; matchId: string };
  highestNetWorthSingleGame: { value: number; matchId: string };
  highestGPMSingleGame: { value: number; matchId: string };
  highestXPMSingleGame: { value: number; matchId: string };
  highestLastHitsSingleGame: { value: number; matchId: string };
  highestHeroDamageSingleGame: { value: number; matchId: string };
  highestTowerDamageSingleGame: { value: number; matchId: string };
  highestHeroHealingSingleGame: { value: number; matchId: string };
}

interface TeamStats {
  teamId: string;
  teamName: string;
  totalMatches: number;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  
  // Performance metrics
  averageKills: { value: number };
  averageDeaths: { value: number };
  averageAssists: { value: number };
  averageMatchDuration: { value: number };
  averageGoldAdvantage: { value: number };
  averageXPAdvantage: { value: number };
}

export default function StatsPage() {
  const [tournamentStats, setTournamentStats] = useState<TournamentStats | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to find player name by ID
  const findPlayerName = (playerId: string): string => {
    const player = playerStats.find(p => p.playerId === playerId);
    return player?.playerName || 'Unknown Player';
  };

  // Function to find team name by ID
  const findTeamName = (teamId: string): string => {
    const team = teamStats.find(t => t.teamId === teamId);
    return team?.teamName || 'Unknown Team';
  };

  useEffect(() => {
    const unsubscribeTournament = onSnapshot(
      doc(db, 'tournamentStats', 'tournament-stats'),
      (doc) => {
        if (doc.exists()) {
          setTournamentStats(doc.data() as TournamentStats);
        }
      },
      (error) => {
        console.error('Error fetching tournament stats:', error);
        setError('Failed to load tournament statistics');
      }
    );

    const unsubscribePlayerStats = onSnapshot(
      collection(db, 'playerStats'),
      (snapshot) => {
        const stats = snapshot.docs.map(doc => ({ 
          playerId: doc.id, 
          ...doc.data() 
        })) as PlayerStats[];
        setPlayerStats(stats);
      },
      (error) => {
        console.error('Error fetching player stats:', error);
        setError('Failed to load player statistics');
      }
    );

    const unsubscribeTeamStats = onSnapshot(
      collection(db, 'teamStats'),
      (snapshot) => {
        const stats = snapshot.docs.map(doc => ({ 
          teamId: doc.id, 
          ...doc.data() 
        })) as TeamStats[];
        setTeamStats(stats);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching team stats:', error);
        setError('Failed to load team statistics');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTournament();
      unsubscribePlayerStats();
      unsubscribeTeamStats();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading tournament statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-full bg-red-100 text-red-600 mx-auto w-fit">
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-red-600">Error Loading Statistics</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-accent/20 to-primary/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-secondary/10 to-accent/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="container mx-auto px-4 py-12 space-y-16 relative z-10">
        {/* Enhanced Header */}
        <div className="text-center space-y-8 animate-fade-in-up relative">
          {/* Decorative elements */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/10 to-primary/5 blur-3xl rounded-full"></div>
          
          <div className="flex justify-center relative">
            {/* Multiple glowing rings */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full blur-2xl opacity-20 animate-pulse"></div>
            <div className="absolute inset-2 bg-gradient-to-r from-accent to-primary rounded-full blur-xl opacity-30 animate-pulse" style={{animationDelay: '1s'}}></div>
            <div className="relative p-8 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-2xl shadow-primary/25 transition-all duration-1000 hover:scale-110 hover:rotate-6 hover:shadow-accent/25">
              <BarChart3 className="h-16 w-16" />
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="relative">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent drop-shadow-lg animate-gradient bg-[length:200%_auto]">
                Tournament Statistics
              </h1>
              {/* Underline effect */}
              <div className="h-2 w-48 mx-auto mt-4 bg-gradient-to-r from-primary to-accent rounded-full opacity-80"></div>
            </div>
            <p className="text-muted-foreground text-xl max-w-3xl mx-auto leading-relaxed font-medium">
              Comprehensive statistics and analytics from the tournament
              <span className="block text-sm mt-2 text-muted-foreground/60">Real-time data • Detailed insights • Performance metrics</span>
            </p>
          </div>
        </div>

        {/* Tournament Statistics Section */}
        <div className="space-y-12 relative">
          {/* Section background */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-3xl blur-3xl -z-10"></div>
          
          <SectionHeader
            icon={Trophy}
            title="Tournament Statistics"
            description="Tournament-wide game metrics and milestones"
            delay="100ms"
            accentColor="primary"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <StatCard icon={Target} title="Total Games Played" value={tournamentStats?.totalGames || 0} delay="200ms" gradient />
            <StatCard icon={Clock} title="Total Tournament Duration" value={`${tournamentStats?.totalHoursPlayed || 0}h`} delay="250ms" gradient />
            <StatCard icon={Timer} title="Average Game Duration" value={`${Math.round(tournamentStats?.averageMatchDuration || 0)} min`} delay="300ms" gradient />
            <StatCard icon={Crown} title="Total Rampages" value={tournamentStats?.totalRampages?.toLocaleString() || "TBD"} delay="350ms" gradient />
            <StatCard icon={Sword} title="Total Kills" value={tournamentStats?.totalKills?.toLocaleString() || "TBD"} delay="400ms" gradient />
            <StatCard icon={Activity} title="Total Assists" value={tournamentStats?.totalAssists?.toLocaleString() || "TBD"} delay="450ms" gradient />
            <StatCard icon={Users} title="Total Deaths" value={tournamentStats?.totalDeaths?.toLocaleString() || "TBD"} delay="500ms" gradient />
            <StatCard icon={Flame} title="Total Healing" value={tournamentStats?.totalHealing?.toLocaleString() || "TBD"} delay="550ms" gradient />
            <StatCard icon={Eye} title="Total Wards Placed" value={tournamentStats?.totalWardsPlaced?.toLocaleString() || "TBD"} delay="600ms" gradient />
            <StatCard icon={Zap} title="Total Buybacks Used" value={tournamentStats?.totalBuybacks?.toLocaleString() || "TBD"} delay="650ms" gradient />
            <StatCard icon={DollarSign} title="Total Gold Earned" value={`${Math.round((tournamentStats?.totalGoldGenerated || 0) / 1000)}K`} delay="700ms" gradient />
            <StatCard icon={Target} title="Total Creeps Killed" value={tournamentStats?.totalCreepsKilled?.toLocaleString() || "TBD"} delay="750ms" gradient />
            <StatCard icon={Crosshair} title="Total Denies" value={tournamentStats?.totalDenies?.toLocaleString() || "TBD"} delay="800ms" gradient />
            <StatCard icon={Users} title="Total Couriers Killed" value={tournamentStats?.totalCouriersKilled?.toLocaleString() || "TBD"} delay="850ms" gradient />
            <StatCard icon={Eye} title="Wards Destroyed" value={tournamentStats?.totalWardsDestroyed?.toLocaleString() || "TBD"} delay="900ms" gradient />
            <StatCard icon={Star} title="Unique Heroes Picked" value={tournamentStats?.uniqueHeroesPicked || "TBD"} delay="950ms" gradient />
            <StatCard icon={Trophy} title="Total Fantasy Points" value={tournamentStats?.totalFantasyPoints?.toLocaleString() || "TBD"} delay="1000ms" gradient />
            <StatCard icon={Crown} title="Most Picked Hero" value={tournamentStats?.mostPickedHero?.heroName || "TBD"} delay="1050ms" gradient />
            <StatCard icon={Shield} title="Total Roshan Kills" value={tournamentStats?.totalRoshanKills?.toLocaleString() || "TBD"} delay="1100ms" gradient />
            <StatCard icon={Crosshair} title="Most Banned Hero" value={tournamentStats?.mostBannedHero?.heroName || "TBD"} delay="1150ms" gradient />
            <StatCard icon={Users} title="Most Played Role-Hero" value={tournamentStats?.mostPlayedRoleHero || "TBD"} delay="1200ms" gradient />
          </div>
        </div>

        {/* Player Statistics Section */}
        <div className="space-y-12 relative">
          {/* Section background */}
          <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-secondary/5 rounded-3xl blur-3xl -z-10"></div>
          
          <SectionHeader
            icon={Star}
            title="Player Statistics"
            description="Individual player records and achievements"
            delay="1250ms"
            accentColor="accent"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <StatCard 
              icon={Sword} 
              title="Most Kills (Single Game)" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestKillsSingleGame?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestKillsSingleGame?.value === Math.max(...playerStats.map(p => (p as any).highestKillsSingleGame?.value || 0)))?.playerId || '') : ""}
              delay="1300ms"
              gradient
            />
            <StatCard 
              icon={Activity} 
              title="Best KDA Ratio" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).bestKDAGameRatio?.value || 0)).toFixed(2) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).bestKDAGameRatio?.value === Math.max(...playerStats.map(p => (p as any).bestKDAGameRatio?.value || 0)))?.playerId || '') : ""}
              delay="1350ms"
              gradient
            />
            <StatCard 
              icon={Star} 
              title="Longest Kill Streak" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).longestKillStreak?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).longestKillStreak?.value === Math.max(...playerStats.map(p => (p as any).longestKillStreak?.value || 0)))?.playerId || '') : ""}
              delay="1400ms"
              gradient
            />
            <StatCard 
              icon={Flame} 
              title="Highest Hero Damage" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestHeroDamageSingleGame?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestHeroDamageSingleGame?.value === Math.max(...playerStats.map(p => (p as any).highestHeroDamageSingleGame?.value || 0)))?.playerId || '') : ""}
              delay="1450ms"
              gradient
            />
            <StatCard 
              icon={TrendingUp} 
              title="Highest GPM (Single Game)" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestGPMSingleGame?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestGPMSingleGame?.value === Math.max(...playerStats.map(p => (p as any).highestGPMSingleGame?.value || 0)))?.playerId || '') : ""}
              delay="1500ms"
              gradient
            />
            <StatCard 
              icon={Zap} 
              title="Highest XPM (Single Game)" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestXPMSingleGame?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestXPMSingleGame?.value === Math.max(...playerStats.map(p => (p as any).highestXPMSingleGame?.value || 0)))?.playerId || '') : ""}
              delay="1550ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Most Last Hits" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestLastHitsSingleGame?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestLastHitsSingleGame?.value === Math.max(...playerStats.map(p => (p as any).highestLastHitsSingleGame?.value || 0)))?.playerId || '') : ""}
              delay="1600ms"
              gradient
            />
            <StatCard 
              icon={DollarSign} 
              title="Highest Net Worth (Single Game)" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestNetWorthSingleGame?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestNetWorthSingleGame?.value === Math.max(...playerStats.map(p => (p as any).highestNetWorthSingleGame?.value || 0)))?.playerId || '') : ""}
              delay="1650ms"
              gradient
            />
            <StatCard 
              icon={Activity} 
              title="Best CS Per Minute" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).bestCSPerMinute?.value || 0)).toFixed(1) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).bestCSPerMinute?.value === Math.max(...playerStats.map(p => (p as any).bestCSPerMinute?.value || 0)))?.playerId || '') : ""}
              delay="1700ms"
              gradient
            />
            <StatCard 
              icon={Eye} 
              title="Most Observer Wards" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostObserverWards?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostObserverWards?.value === Math.max(...playerStats.map(p => (p as any).mostObserverWards?.value || 0)))?.playerId || '') : ""}
              delay="1750ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Most Wards Killed" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostWardsKilled?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostWardsKilled?.value === Math.max(...playerStats.map(p => (p as any).mostWardsKilled?.value || 0)))?.playerId || '') : ""}
              delay="1800ms"
              gradient
            />
            <StatCard 
              icon={Flame} 
              title="Most Healing Done (Single Game)" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostHealingDone?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostHealingDone?.value === Math.max(...playerStats.map(p => (p as any).mostHealingDone?.value || 0)))?.playerId || '') : ""}
              delay="1850ms"
              gradient
            />
            <StatCard 
              icon={Star} 
              title="Most Unique Heroes Played" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).uniqueHeroesPlayed?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).uniqueHeroesPlayed?.value === Math.max(...playerStats.map(p => (p as any).uniqueHeroesPlayed?.value || 0)))?.playerId || '') : ""}
              delay="1900ms"
              gradient
            />
            <StatCard 
              icon={Trophy} 
              title="Best Fantasy Score" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).bestFantasyScore?.value || 0)).toFixed(1) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).bestFantasyScore?.value === Math.max(...playerStats.map(p => (p as any).bestFantasyScore?.value || 0)))?.playerId || '') : ""}
              delay="1950ms"
              gradient
            />
            <StatCard 
              icon={Sword} 
              title="Highest Kill Streak" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestKillStreak?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestKillStreak?.value === Math.max(...playerStats.map(p => (p as any).highestKillStreak?.value || 0)))?.playerId || '') : ""}
              delay="2000ms"
              gradient
            />
            <StatCard 
              icon={Crown} 
              title="Most Triple Kills" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostTripleKills?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostTripleKills?.value === Math.max(...playerStats.map(p => (p as any).mostTripleKills?.value || 0)))?.playerId || '') : ""}
              delay="2050ms"
              gradient
            />
            <StatCard 
              icon={Crown} 
              title="Most Ultra Kills" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostUltraKills?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostUltraKills?.value === Math.max(...playerStats.map(p => (p as any).mostUltraKills?.value || 0)))?.playerId || '') : ""}
              delay="2100ms"
              gradient
            />
            <StatCard 
              icon={Crown} 
              title="Most Godlike Streaks" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostGodlikeStreaks?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostGodlikeStreaks?.value === Math.max(...playerStats.map(p => (p as any).mostGodlikeStreaks?.value || 0)))?.playerId || '') : ""}
              delay="2150ms"
              gradient
            />
            <StatCard 
              icon={Activity} 
              title="Best KDA Average" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).bestKDAAverage?.value || 0)).toFixed(2) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).bestKDAAverage?.value === Math.max(...playerStats.map(p => (p as any).bestKDAAverage?.value || 0)))?.playerId || '') : ""}
              delay="2200ms"
              gradient
            />
            <StatCard 
              icon={Flame} 
              title="Highest Damage Per Minute" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestDamagePerMinute?.value || 0)).toFixed(1) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestDamagePerMinute?.value === Math.max(...playerStats.map(p => (p as any).highestDamagePerMinute?.value || 0)))?.playerId || '') : ""}
              delay="2250ms"
              gradient
            />
            <StatCard 
              icon={Sword} 
              title="Highest Average Kills" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestAverageKills?.value || 0)).toFixed(1) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestAverageKills?.value === Math.max(...playerStats.map(p => (p as any).highestAverageKills?.value || 0)))?.playerId || '') : ""}
              delay="2300ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Most First Bloods" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostFirstBloods?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostFirstBloods?.value === Math.max(...playerStats.map(p => (p as any).mostFirstBloods?.value || 0)))?.playerId || '') : ""}
              delay="2350ms"
              gradient
            />
            <StatCard 
              icon={Shield} 
              title="Games with 0 Deaths" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).gamesWithZeroDeaths?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).gamesWithZeroDeaths?.value === Math.max(...playerStats.map(p => (p as any).gamesWithZeroDeaths?.value || 0)))?.playerId || '') : ""}
              delay="2400ms"
              gradient
            />
            <StatCard 
              icon={Activity} 
              title="Most Assists in Single Game" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostAssistsSingleGame?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostAssistsSingleGame?.value === Math.max(...playerStats.map(p => (p as any).mostAssistsSingleGame?.value || 0)))?.playerId || '') : ""}
              delay="2450ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Most Last Hits in Single Game" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostLastHitsSingleGame?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostLastHitsSingleGame?.value === Math.max(...playerStats.map(p => (p as any).mostLastHitsSingleGame?.value || 0)))?.playerId || '') : ""}
              delay="2500ms"
              gradient
            />
            <StatCard 
              icon={DollarSign} 
              title="Highest Net Worth Lead" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestNetWorthLead?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestNetWorthLead?.value === Math.max(...playerStats.map(p => (p as any).highestNetWorthLead?.value || 0)))?.playerId || '') : ""}
              delay="2550ms"
              gradient
            />
            <StatCard 
              icon={Crosshair} 
              title="Most Denies" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostDenies?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostDenies?.value === Math.max(...playerStats.map(p => (p as any).mostDenies?.value || 0)))?.playerId || '') : ""}
              delay="2600ms"
              gradient
            />
            <StatCard 
              icon={DollarSign} 
              title="Most Gold Earned" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostGoldEarned?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostGoldEarned?.value === Math.max(...playerStats.map(p => (p as any).mostGoldEarned?.value || 0)))?.playerId || '') : ""}
              delay="2650ms"
              gradient
            />
            <StatCard 
              icon={Zap} 
              title="Highest XPM" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).highestXPM?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).highestXPM?.value === Math.max(...playerStats.map(p => (p as any).highestXPM?.value || 0)))?.playerId || '') : ""}
              delay="2700ms"
              gradient
            />
            <StatCard 
              icon={Eye} 
              title="Most Wards Placed" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostWardsPlaced?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostWardsPlaced?.value === Math.max(...playerStats.map(p => (p as any).mostWardsPlaced?.value || 0)))?.playerId || '') : ""}
              delay="2750ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Most Wards Destroyed" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostWardsDestroyed?.value || 0)) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostWardsDestroyed?.value === Math.max(...playerStats.map(p => (p as any).mostWardsDestroyed?.value || 0)))?.playerId || '') : ""}
              delay="2800ms"
              gradient
            />
            <StatCard 
              icon={Activity} 
              title="Most Tower Damage" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).mostTowerDamage?.value || 0)).toLocaleString() : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).mostTowerDamage?.value === Math.max(...playerStats.map(p => (p as any).mostTowerDamage?.value || 0)))?.playerId || '') : ""}
              delay="2850ms"
              gradient
            />
            <StatCard 
              icon={Star} 
              title="Most Versatile Player" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).versatilityScore?.value || 0)).toFixed(1) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).versatilityScore?.value === Math.max(...playerStats.map(p => (p as any).versatilityScore?.value || 0)))?.playerId || '') : ""}
              delay="2900ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Least Versatile Player" 
              value={playerStats.length > 0 ? Math.min(...playerStats.map(p => (p as any).versatilityScore?.value || 999)).toFixed(1) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).versatilityScore?.value === Math.min(...playerStats.map(p => (p as any).versatilityScore?.value || 999)))?.playerId || '') : ""}
              delay="2950ms"
              gradient
            />
            <StatCard 
              icon={Crown} 
              title="Hero Spammer" 
              value={playerStats.length > 0 ? Math.max(...playerStats.map(p => (p as any).heroSpamScore?.value || 0)).toFixed(1) : "TBD"}
              subtitle={playerStats.length > 0 ? findPlayerName(playerStats.find(p => (p as any).heroSpamScore?.value === Math.max(...playerStats.map(p => (p as any).heroSpamScore?.value || 0)))?.playerId || '') : ""}
              delay="3000ms"
              gradient
            />
          </div>
        </div>

        {/* Team Statistics Section */}
        <div className="space-y-12 relative">
          {/* Section background */}
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/5 to-primary/5 rounded-3xl blur-3xl -z-10"></div>
          
          <SectionHeader
            icon={Users}
            title="Team Statistics"
            description="Team achievements and competitive records"
            delay="3050ms"
            accentColor="secondary"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <StatCard 
              icon={Clock} 
              title="Shortest Game Winner" 
              value={teamStats.length > 0 ? `${Math.min(...teamStats.map(t => (t as any).shortestGameWon?.value || 99999)).toFixed(0)} min` : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).shortestGameWon?.value === Math.min(...teamStats.map(t => (t as any).shortestGameWon?.value || 99999)))?.teamId || '') : ""}
              delay="3100ms"
              gradient
            />
            <StatCard 
              icon={Timer} 
              title="Longest Game Winner" 
              value={teamStats.length > 0 ? `${Math.max(...teamStats.map(t => (t as any).longestGameWon?.value || 0)).toFixed(0)} min` : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).longestGameWon?.value === Math.max(...teamStats.map(t => (t as any).longestGameWon?.value || 0)))?.teamId || '') : ""}
              delay="3150ms"
              gradient
            />
            <StatCard 
              icon={Clock} 
              title="Highest Avg Game Time" 
              value={teamStats.length > 0 ? `${Math.max(...teamStats.map(t => (t as any).averageMatchDuration?.value || 0)).toFixed(0)} min` : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).averageMatchDuration?.value === Math.max(...teamStats.map(t => (t as any).averageMatchDuration?.value || 0)))?.teamId || '') : ""}
              delay="3200ms"
              gradient
            />
            <StatCard 
              icon={Timer} 
              title="Lowest Avg Game Time" 
              value={teamStats.length > 0 ? `${Math.min(...teamStats.map(t => (t as any).averageMatchDuration?.value || 99999)).toFixed(0)} min` : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).averageMatchDuration?.value === Math.min(...teamStats.map(t => (t as any).averageMatchDuration?.value || 99999)))?.teamId || '') : ""}
              delay="3250ms"
              gradient
            />
            <StatCard 
              icon={Sword} 
              title="Most Kills Per Game" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).averageKills?.value || 0)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).averageKills?.value === Math.max(...teamStats.map(t => (t as any).averageKills?.value || 0)))?.teamId || '') : ""}
              delay="3300ms"
              gradient
            />
            <StatCard 
              icon={Shield} 
              title="Fewest Kills Per Game" 
              value={teamStats.length > 0 ? Math.min(...teamStats.map(t => (t as any).averageKills?.value || 999)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).averageKills?.value === Math.min(...teamStats.map(t => (t as any).averageKills?.value || 999)))?.teamId || '') : ""}
              delay="3350ms"
              gradient
            />
            <StatCard 
              icon={Activity} 
              title="Most Assists Per Game" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).averageAssists?.value || 0)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).averageAssists?.value === Math.max(...teamStats.map(t => (t as any).averageAssists?.value || 0)))?.teamId || '') : ""}
              delay="3400ms"
              gradient
            />
            <StatCard 
              icon={Users} 
              title="Fewest Assists Per Game" 
              value={teamStats.length > 0 ? Math.min(...teamStats.map(t => (t as any).averageAssists?.value || 999)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).averageAssists?.value === Math.min(...teamStats.map(t => (t as any).averageAssists?.value || 999)))?.teamId || '') : ""}
              delay="3450ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Most First Bloods" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).mostFirstBloods?.value || 0)) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).mostFirstBloods?.value === Math.max(...teamStats.map(t => (t as any).mostFirstBloods?.value || 0)))?.teamId || '') : ""}
              delay="3500ms"
              gradient
            />
            <StatCard 
              icon={Shield} 
              title="Fewest First Bloods" 
              value={teamStats.length > 0 ? Math.min(...teamStats.map(t => (t as any).mostFirstBloods?.value || 999)) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).mostFirstBloods?.value === Math.min(...teamStats.map(t => (t as any).mostFirstBloods?.value || 999)))?.teamId || '') : ""}
              delay="3550ms"
              gradient
            />
            <StatCard 
              icon={Sword} 
              title="Most Kills Single Game" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).mostKillsSingleGame?.value || 0)) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).mostKillsSingleGame?.value === Math.max(...teamStats.map(t => (t as any).mostKillsSingleGame?.value || 0)))?.teamId || '') : ""}
              delay="3600ms"
              gradient
            />
            <StatCard 
              icon={Users} 
              title="Fewest Kills Single Game" 
              value={teamStats.length > 0 ? Math.min(...teamStats.map(t => (t as any).mostKillsSingleGame?.value || 999)) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).mostKillsSingleGame?.value === Math.min(...teamStats.map(t => (t as any).mostKillsSingleGame?.value || 999)))?.teamId || '') : ""}
              delay="3650ms"
              gradient
            />
            <StatCard 
              icon={Activity} 
              title="Highest Tower Damage" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).highestTowerDamage?.value || 0)).toLocaleString() : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).highestTowerDamage?.value === Math.max(...teamStats.map(t => (t as any).highestTowerDamage?.value || 0)))?.teamId || '') : ""}
              delay="3700ms"
              gradient
            />
            <StatCard 
              icon={Shield} 
              title="Lowest Tower Damage" 
              value={teamStats.length > 0 ? Math.min(...teamStats.map(t => (t as any).highestTowerDamage?.value || 999999)).toLocaleString() : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).highestTowerDamage?.value === Math.min(...teamStats.map(t => (t as any).highestTowerDamage?.value || 999999)))?.teamId || '') : ""}
              delay="3750ms"
              gradient
            />
            <StatCard 
              icon={Crown} 
              title="Most Dominant Victory" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).mostDominantVictory?.value || 0)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).mostDominantVictory?.value === Math.max(...teamStats.map(t => (t as any).mostDominantVictory?.value || 0)))?.teamId || '') : ""}
              delay="3800ms"
              gradient
            />
            <StatCard 
              icon={Star} 
              title="Most Versatile Team" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).teamVersatility?.value || 0)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).teamVersatility?.value === Math.max(...teamStats.map(t => (t as any).teamVersatility?.value || 0)))?.teamId || '') : ""}
              delay="3850ms"
              gradient
            />
            <StatCard 
              icon={Shield} 
              title="Fastest Roshan Kill" 
              value={teamStats.length > 0 ? `${Math.min(...teamStats.map(t => (t as any).fastestRoshanKill?.value || 99999)).toFixed(0)} min` : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).fastestRoshanKill?.value === Math.min(...teamStats.map(t => (t as any).fastestRoshanKill?.value || 99999)))?.teamId || '') : ""}
              delay="3900ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Fastest First Blood" 
              value={teamStats.length > 0 ? `${Math.min(...teamStats.map(t => (t as any).fastestFirstBlood?.value || 99999)).toFixed(0)}s` : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).fastestFirstBlood?.value === Math.min(...teamStats.map(t => (t as any).fastestFirstBlood?.value || 99999)))?.teamId || '') : ""}
              delay="3950ms"
              gradient
            />
            <StatCard 
              icon={DollarSign} 
              title="Highest Average Team Net Worth" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).highestAvgTeamNetWorth?.value || 0)).toLocaleString() : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).highestAvgTeamNetWorth?.value === Math.max(...teamStats.map(t => (t as any).highestAvgTeamNetWorth?.value || 0)))?.teamId || '') : ""}
              delay="4000ms"
              gradient
            />
            <StatCard 
              icon={Zap} 
              title="Most Buybacks Used" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).mostBuybacksUsed?.value || 0)) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).mostBuybacksUsed?.value === Math.max(...teamStats.map(t => (t as any).mostBuybacksUsed?.value || 0)))?.teamId || '') : ""}
              delay="4050ms"
              gradient
            />
            <StatCard 
              icon={Clock} 
              title="Best Late Game Team" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).lateGameScore?.value || 0)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).lateGameScore?.value === Math.max(...teamStats.map(t => (t as any).lateGameScore?.value || 0)))?.teamId || '') : ""}
              delay="4100ms"
              gradient
            />
            <StatCard 
              icon={Eye} 
              title="Most Wards Per Game" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).mostWardsPerGame?.value || 0)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).mostWardsPerGame?.value === Math.max(...teamStats.map(t => (t as any).mostWardsPerGame?.value || 0)))?.teamId || '') : ""}
              delay="4150ms"
              gradient
            />
            <StatCard 
              icon={Activity} 
              title="Most Throws" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).mostThrows?.value || 0)) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).mostThrows?.value === Math.max(...teamStats.map(t => (t as any).mostThrows?.value || 0)))?.teamId || '') : ""}
              delay="4200ms"
              gradient
            />
            <StatCard 
              icon={TrendingUp} 
              title="Highest Tower Damage Per Minute" 
              value={teamStats.length > 0 ? Math.max(...teamStats.map(t => (t as any).highestTowerDamagePerMinute?.value || 0)).toFixed(1) : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).highestTowerDamagePerMinute?.value === Math.max(...teamStats.map(t => (t as any).highestTowerDamagePerMinute?.value || 0)))?.teamId || '') : ""}
              delay="4250ms"
              gradient
            />
            <StatCard 
              icon={Target} 
              title="Fastest Tier 3 Tower" 
              value={teamStats.length > 0 ? `${Math.min(...teamStats.map(t => (t as any).fastestTier3Tower?.value || 99999)).toFixed(0)} min` : "TBD"}
              subtitle={teamStats.length > 0 ? findTeamName(teamStats.find(t => (t as any).fastestTier3Tower?.value === Math.min(...teamStats.map(t => (t as any).fastestTier3Tower?.value || 99999)))?.teamId || '') : ""}
              delay="4300ms"
              gradient
            />
          </div>
        </div>
      </div>
    </div>
  );
}