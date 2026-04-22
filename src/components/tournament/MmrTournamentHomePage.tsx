"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowRight, Users } from 'lucide-react';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { usePDLData } from '@/hooks/usePDLData';
import { getGroups, calculateGroupStandings } from '@/lib/api/groups';
import type { TeamForStandings, MatchForStandings } from '@/lib/api/groups';
import type { Group, GroupStanding } from '@/lib/definitions';

// Unified components used for all tournament types
import { HeroSection } from '@/components/pdl/HeroSection';
import { MmrFeaturedMatchCard } from '@/components/tournament/mmr/FeaturedMatchCard';
import { MmrQuickLinksSection } from '@/components/tournament/mmr/QuickLinksSection';
import { DivisionTable } from '@/components/pdl/DivisionTable';

// Sorting helper for group standings
const sortGroupStandings = (standings: GroupStanding[]): GroupStanding[] =>
  [...standings].sort((a, b) => b.points - a.points || b.neustadtlScore - a.neustadtlScore);

// Compact group standings table (frameless, matching DivisionTable style)
function CompactGroupTable({ group }: { group: Group }) {
  const sorted = sortGroupStandings(Object.values(group.standings));
  return (
    <div className="overflow-hidden">
      <div className="pb-4 mb-2 relative">
        <h3 className="text-xl font-logik-extended-bold tracking-wide uppercase text-[var(--tournament-section-header)]">
          {group.name}
        </h3>
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/10" />
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] font-mono uppercase tracking-widest text-[var(--tournament-secondary-text)]">
            <th className="px-2 py-2 text-left">Drużyna</th>
            <th className="px-2 py-2 text-center w-12">PKT</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, idx) => (
            <tr key={s.teamId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
              <td className="px-2 py-3">
                <span className="font-logik text-base text-[var(--tournament-primary-text)] tracking-wide">{s.teamName}</span>
              </td>
              <td className="px-2 py-3 text-center">
                <span className="font-logik-extended-bold text-xl text-[var(--tournament-title)]">{s.points}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Exported as both names so existing imports don't break
export { TournamentHomePage as MmrTournamentHomePage };

export function TournamentHomePage() {
  const { tournament, getTournamentPath, theme, isLegacyTournament } = useTournament();
  const { isLeague, isMmrLimited } = useTournamentType();
  const { user } = useAuth();
  const [hasTeam, setHasTeam] = useState(false);
  const [isTeamCaptain, setIsTeamCaptain] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [recentResults, setRecentResults] = useState<Array<{ id: string; team1: string; team2: string; score1: number; score2: number; playedAtLabel: string }>>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Array<{ id: string; team1: string; team2: string; whenLabel: string }>>([]);

  // PDL data (league only)
  const { divisions, nextMatch, loading: pdlLoading } = usePDLData();

  const primaryColor = theme?.primaryColor || '#8B1538';

  useEffect(() => {
    const checkCaptain = async () => {
      if (!user || !tournament?.id) { setIsTeamCaptain(false); setHasTeam(false); return; }
      try {
        const teamsRef = isLegacyTournament
          ? collection(db, 'teams')
          : collection(db, 'tournaments', tournament.id, 'teams');
        const q = query(teamsRef, where('captainId', '==', user.uid));
        const snap = await getDocs(q);
        setIsTeamCaptain(!snap.empty);
        setHasTeam(!snap.empty);
      } catch {
        setIsTeamCaptain(false);
        setHasTeam(false);
      }
    };
    checkCaptain();
  }, [user, tournament?.id, isLegacyTournament]);

  // Fetch group standings for MMR tournaments
  useEffect(() => {
    if (!isMmrLimited || isLegacyTournament || !tournament?.id) return;
    const fetchGroups = async () => {
      try {
        const [groupDocs, teamsSnap, matchesSnap] = await Promise.all([
          getGroups(tournament.id),
          getDocs(collection(db, 'tournaments', tournament.id, 'teams')),
          getDocs(collection(db, 'tournaments', tournament.id, 'matches')),
        ]);
        const teams: TeamForStandings[] = teamsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<TeamForStandings, 'id'>) }));
        const matches = matchesSnap.docs.map(d => d.data() as MatchForStandings);
        setGroups(calculateGroupStandings(groupDocs, teams, matches));
      } catch (e) {
        console.error('Failed to load groups for home page', e);
      }
    };
    fetchGroups();
  }, [isMmrLimited, isLegacyTournament, tournament?.id]);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!tournament?.id) return;
      try {
        const matchesRef = isLegacyTournament
          ? collection(db, 'matches')
          : collection(db, 'tournaments', tournament.id, 'matches');

        const snap = await getDocs(matchesRef);
        const completed: typeof recentResults = [];
        const upcoming: typeof upcomingMatches = [];

        snap.docs.forEach(doc => {
          const m = doc.data();
          const teamAName = m.teamA?.name || m.teamA?.id || 'TBD';
          const teamBName = m.teamB?.name || m.teamB?.id || 'TBD';

          if (m.status === 'completed') {
            const playedAt = m.playedAt?.toDate?.() || m.scheduledAt?.toDate?.();
            const label = playedAt
              ? new Intl.RelativeTimeFormat('pl', { numeric: 'auto' }).format(
                  Math.round((playedAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                  'day'
                )
              : '';
            completed.push({
              id: doc.id,
              team1: teamAName,
              team2: teamBName,
              score1: m.teamA?.score ?? 0,
              score2: m.teamB?.score ?? 0,
              playedAtLabel: label,
            });
          } else if (m.status === 'scheduled' || m.status === 'pending') {
            const scheduledAt = m.scheduledAt?.toDate?.();
            const whenLabel = scheduledAt
              ? scheduledAt.toLocaleDateString('pl-PL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
              : '';
            upcoming.push({
              id: doc.id,
              team1: teamAName,
              team2: teamBName,
              whenLabel,
            });
          }
        });

        completed.sort((a, b) => b.playedAtLabel.localeCompare(a.playedAtLabel));
        setRecentResults(completed.slice(0, 3));
        setUpcomingMatches(upcoming.slice(0, 3));
      } catch (err) {
        console.error('Failed to fetch matches for home page:', err);
      }
    };
    fetchMatches();
  }, [tournament?.id, isLegacyTournament]);

  if (!tournament) return null;

  const getPath = (path: string): string => {
    if (isLegacyTournament) return `/${tournament.slug}${path}`;
    return getTournamentPath(path);
  };

  // Next match data — PDL uses usePDLData(), MMR uses local upcoming matches
  const nextTeam1 = isLeague ? nextMatch?.teamA : upcomingMatches[0]?.team1;
  const nextTeam2 = isLeague ? nextMatch?.teamB : upcomingMatches[0]?.team2;
  const nextDate = isLeague ? nextMatch?.dateLabel : upcomingMatches[0]?.whenLabel;

  const showGroupsSection = isMmrLimited && groups.length > 0;

  return (
    <div className="relative overflow-hidden text-foreground min-h-screen">
      {/* ── Premium Atmosphere Background ──
           Only rendered for solid-colour themes (no background image).
           When a bg image is present the layout already handles depth via
           backgroundImageUrl + backgroundOverlay, so this vignette would
           just darken a light-themed background incorrectly. */}
      {!theme?.backgroundImageUrl && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-80"
            style={{ background: 'radial-gradient(circle at center, transparent 0%, #000000 100%)' }}
          />
          <div
            className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[150px]"
            style={{ background: primaryColor, opacity: 0.04 }}
          />
          <div
            className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full blur-[150px]"
            style={{ background: theme?.secondaryColor || primaryColor, opacity: 0.03 }}
          />
        </div>
      )}

      <div className="relative z-10 w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-6 space-y-12">

        {/* ── Section 1: Hero + Featured/Next Match ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
          {/* Hero: 8 columns */}
          <div className="lg:col-span-7 xl:col-span-8 h-full">
            <HeroSection isTeamCaptain={hasTeam} />
          </div>

          {/* Right column: Featured match / logo card */}
          <div className="lg:col-span-5 xl:col-span-4 h-full pt-6 lg:pt-0">
            <MmrFeaturedMatchCard
              team1={nextTeam1}
              team2={nextTeam2}
              date={nextDate}
            />
          </div>
        </section>

        {/* ── Section 2: Sidebar + Main Standings/Content ── */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
          {/* Sticky Sidebar: Quick Links (desktop only) */}
          <div className="xl:col-span-2 hidden xl:block">
            <div className="sticky top-20 space-y-6">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--tournament-muted)] mb-6 pl-1">Menu</h3>
              <MmrQuickLinksSection />
            </div>
          </div>

          {/* Mobile quick links */}
          <div className="xl:hidden col-span-1">
            <MmrQuickLinksSection />
          </div>

          {/* Main content: 10 columns */}
          <div className="xl:col-span-10">
            {/* League: Division tables */}
            {isLeague && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-12">
                {divisions.map((division) => (
                  <div key={division.id || division.name} className="relative group h-full">
                    <DivisionTable
                      divisionName={division.name}
                      divisionColor={division.color}
                      teams={division.teams}
                      divisionId={division.id}
                      divisionTheme={division.theme}
                      medalUrl={division.medalUrl}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* MMR: Group standings */}
            {showGroupsSection && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-12">
                {groups.map((group) => (
                  <CompactGroupTable key={group.id} group={group} />
                ))}
              </div>
            )}
          </div>
        </section>



        {/* ── Section 4: CTA Bottom ── */}
        <section className="py-12 lg:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <h2
              className="text-4xl md:text-6xl lg:text-7xl font-logik-extended-bold mb-8 tracking-tight text-[var(--tournament-heading)]"
              style={{ filter: `drop-shadow(0 0 30px ${primaryColor}30)` }}
            >
              GOTOWY NA WYZWANIE?
            </h2>
            <p
              className="mb-12 text-xl leading-relaxed max-w-2xl mx-auto"
              style={{ color: theme?.secondaryTextColor || theme?.mutedTextColor || 'rgba(255,255,255,0.6)' }}
            >
              {tournament.description || `Dołącz do ${tournament.name} i sprawdź się z najlepszymi graczami.`}
            </p>
            <Link
              href={getTournamentPath(hasTeam ? '/my-team' : '/register')}
              className="inline-flex items-center gap-4 px-12 py-6 font-logik-extended-bold text-xl uppercase tracking-widest bg-white text-black hover:bg-gray-200 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] transition-all duration-300 transform hover:-translate-y-1"
              style={{
                clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)'
              }}
            >
              <span>{hasTeam ? 'Moja Drużyna' : 'Zarejestruj się'}</span>
              {hasTeam ? <Users className="h-6 w-6" /> : <ArrowRight className="h-6 w-6" />}
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}

