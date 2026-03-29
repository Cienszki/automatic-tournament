'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Shield, Calendar, LogIn, UserPlus, 
  ImageIcon, ChevronRight 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import type { Team, Match, Player } from '@/lib/definitions';

interface MmrMyTeamProps {
  team: Team | null;
  hasTeam: boolean;
  matches: Match[];
  loading: boolean;
}

export function MmrMyTeamPage({ team, hasTeam, matches, loading }: MmrMyTeamProps) {
  const { tournament, theme, getTournamentPath } = useTournament();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();

  if (!tournament) return null;
  if (authLoading || loading) return <LoadingScreen />;

  const primaryColor = theme?.primaryColor || '#8B1538';
  const secondaryColor = theme?.secondaryColor || '#D4AF37';

  const AtmosphereBackground = () => (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] opacity-80" />
      <div
        className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full mix-blend-screen opacity-[0.07]"
        style={{ background: primaryColor }}
      />
      <div
        className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full mix-blend-screen opacity-[0.05]"
        style={{ background: secondaryColor }}
      />
    </div>
  );

  if (!user) {
    return (
      <div className="relative min-h-screen">
        <AtmosphereBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] gap-8 px-6 py-24 text-center">
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <LogIn className="h-12 w-12 mx-auto" style={{ color: primaryColor }} />
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-100 to-gray-500 tracking-tighter uppercase">
              Moja drużyna
            </h1>
            <p className="text-white/50 text-lg">Zaloguj się aby zobaczyć swoją drużynę</p>
          </div>
          <Button
            onClick={signInWithGoogle}
            size="lg"
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white"
          >
            <LogIn className="mr-2 h-4 w-4" /> Zaloguj się przez Google
          </Button>
        </div>
      </div>
    );
  }

  if (!hasTeam) {
    return (
      <div className="relative min-h-screen">
        <AtmosphereBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] gap-8 px-6 py-24 text-center">
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <UserPlus className="h-12 w-12 mx-auto" style={{ color: primaryColor }} />
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-100 to-gray-500 tracking-tighter uppercase">
              Moja drużyna
            </h1>
            <p className="text-white/50 text-lg">
              {tournament.status === 'registration'
                ? 'Nie masz jeszcze drużyny. Zarejestruj się aby wziąć udział w turnieju!'
                : 'Rejestracja drużyn została zamknięta.'}
            </p>
          </div>
          {tournament.status === 'registration' && (
            <Button asChild size="lg" style={{ backgroundColor: primaryColor }}>
              <Link href={getTournamentPath('/register')}>
                <UserPlus className="mr-2 h-4 w-4" /> Zarejestruj drużynę
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!team) return null;

  const isCaptain = team.captainId === user.uid;
  const totalMmr = team.players?.reduce((sum, p) => sum + ((p as any).mmr || 0), 0) || (team as any).totalMmr || 0;
  const mmrCap = tournament.mmrCap || 24000;
  const upcomingMatches = matches.filter(m => m.status !== 'completed');
  const completedMatches = matches.filter(m => m.status === 'completed');

  return (
    <div className="relative min-h-screen">
      <AtmosphereBackground />

      <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-8">
        {/* Page Header */}
        <div className="text-center mb-12 relative">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[150px] blur-[100px] rounded-full pointer-events-none opacity-10"
            style={{ background: primaryColor }}
          />
          <h1 className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-100 to-gray-500 tracking-tighter uppercase drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative z-10">
            Moja drużyna
          </h1>
          <div className="flex items-center justify-center gap-6 mt-4 opacity-80 relative z-10">
            <div
              className="h-[1px] w-20"
              style={{ background: `linear-gradient(to right, transparent, ${primaryColor}, transparent)` }}
            />
            <div
              className="flex items-center gap-2 tracking-widest uppercase font-logik text-sm"
              style={{ color: primaryColor }}
            >
              <Shield className="w-4 h-4" />
              <span>{tournament.name}</span>
            </div>
            <div
              className="h-[1px] w-20"
              style={{ background: `linear-gradient(to right, transparent, ${primaryColor}, transparent)` }}
            />
          </div>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Team Header Card */}
          <motion.div variants={fadeInUp}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div
                className="h-1"
                style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }}
              />
              <div className="p-6">
                <div className="flex items-center gap-4">
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt={team.name}
                      className="w-16 h-16 rounded-lg object-cover border border-white/10"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center border border-white/10"
                      style={{ backgroundColor: `${primaryColor}20` }}
                    >
                      <Shield className="h-8 w-8" style={{ color: primaryColor }} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold text-white">{team.name}</h2>
                      {team.tag && (
                        <Badge variant="outline" style={{ borderColor: primaryColor, color: primaryColor }}>
                          [{team.tag}]
                        </Badge>
                      )}
                      <Badge
                        variant={team.status === 'verified' ? 'default' : 'secondary'}
                        style={team.status === 'verified' ? { backgroundColor: primaryColor } : undefined}
                      >
                        {team.status === 'verified' ? 'Zatwierdzony' : team.status === 'pending' ? 'Oczekuje' : team.status}
                      </Badge>
                      {isCaptain && (
                        <Badge variant="outline" className="border-white/20 text-white/60">
                          Kapitan
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-sm">
                      <span className="text-white/50">MMR:</span>
                      <strong style={{ color: primaryColor }}>{totalMmr.toLocaleString()}</strong>
                      <span className="text-white/30">/ {mmrCap.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Roster */}
            <motion.div variants={fadeInUp} className="md:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h3 className="flex items-center gap-2 font-logik-extended-bold text-white">
                    <Users className="h-5 w-5" style={{ color: primaryColor }} />
                    Skład drużyny
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-2">
                    {(team.players || []).map((player: Player, idx: number) => {
                      const playerMmr = (player as any).mmr || 0;
                      const screenshotUrl = (player as any).profileScreenshotUrl;
                      return (
                        <div
                          key={player.id || idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                            >
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-medium text-white">{player.nickname}</div>
                              <div className="text-xs text-white/40">{player.role || 'Gracz'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium" style={{ color: primaryColor }}>
                              {playerMmr > 0 ? playerMmr.toLocaleString() : '—'}
                            </span>
                            {screenshotUrl && (
                              <a
                                href={screenshotUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/30 hover:text-white/70 transition-colors"
                              >
                                <ImageIcon className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Sidebar */}
            <motion.div variants={fadeInUp} className="space-y-4">
              {/* MMR Summary */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h4 className="text-sm font-logik-extended-bold text-white/60 uppercase tracking-widest">
                    Podsumowanie MMR
                  </h4>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Łączne MMR</span>
                    <span className="font-bold" style={{ color: primaryColor }}>{totalMmr.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Limit MMR</span>
                    <span className="text-white/70">{mmrCap.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (totalMmr / mmrCap) * 100)}%`,
                        backgroundColor: totalMmr > mmrCap ? '#ef4444' : primaryColor,
                      }}
                    />
                  </div>
                  <div className="text-xs text-white/30 text-right">
                    {((totalMmr / mmrCap) * 100).toFixed(1)}% wykorzystane
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                <div className="p-3 space-y-1">
                  <Link
                    href={getTournamentPath('/groups')}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    <span>Tabela grupowa</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={getTournamentPath('/schedule')}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    <span>Harmonogram</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={getTournamentPath('/rules')}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    <span>Regulamin</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Matches Section */}
          <motion.div variants={fadeInUp}>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h3 className="flex items-center gap-2 font-logik-extended-bold text-white">
                  <Calendar className="h-5 w-5" style={{ color: secondaryColor }} />
                  Mecze
                </h3>
              </div>
              <div className="p-6">
                {matches.length === 0 ? (
                  <p className="text-center text-white/40 py-6">Brak zaplanowanych meczów</p>
                ) : (
                  <div className="space-y-2">
                    {[...upcomingMatches, ...completedMatches].map((match) => {
                      const isTeamA = match.teamA?.id === team.id;
                      const opponent = isTeamA ? match.teamB : match.teamA;
                      const myScore = isTeamA ? match.teamA?.score : match.teamB?.score;
                      const opponentScore = isTeamA ? match.teamB?.score : match.teamA?.score;
                      const isCompleted = match.status === 'completed';

                      return (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm text-white">
                              vs {opponent?.name || 'TBD'}
                            </div>
                            <div className="text-xs text-white/40">
                              {match.scheduledFor
                                ? new Date(match.scheduledFor).toLocaleDateString('pl-PL', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Data nie ustalona'}
                            </div>
                          </div>
                          <div className="text-right">
                            {isCompleted ? (
                              <div
                                className="font-bold text-sm px-3 py-1 rounded-lg"
                                style={{
                                  backgroundColor:
                                    (myScore ?? 0) > (opponentScore ?? 0)
                                      ? `${primaryColor}20`
                                      : (myScore ?? 0) < (opponentScore ?? 0)
                                      ? '#ef444420'
                                      : `${secondaryColor}20`,
                                  color:
                                    (myScore ?? 0) > (opponentScore ?? 0)
                                      ? primaryColor
                                      : (myScore ?? 0) < (opponentScore ?? 0)
                                      ? '#ef4444'
                                      : secondaryColor,
                                }}
                              >
                                {myScore} - {opponentScore}
                              </div>
                            ) : (
                              <Badge variant="outline" className="border-white/20 text-white/50">
                                {match.status === 'scheduled' ? 'Zaplanowany' : 'Oczekuje'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
