'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { usePDLData } from '@/hooks/usePDLData';
import { useSnapScroll } from '@/hooks/useSnapScroll';
import { useHomeNavigation, HOME_VIEW_TO_SECTION } from '@/context/HomeNavigationContext';
import type { Match, Team, Player, PlayoffMatch } from '@/lib/definitions';
import { organizationConfig } from '@/config/organization';

// Components
import { DivisionTable } from '@/components/pdl/DivisionTable';
import { InlineDivisionView } from '@/components/divisions/InlineDivisionView';
import { MatchdayCarousel } from '@/components/schedule/MatchdayCarousel';
import { ChronologicalCarousel } from '@/components/schedule/ChronologicalCarousel';
import { TeamsView } from '@/components/tournament/TeamsView';
import { PlayoffBracket } from '@/components/playoffs/PlayoffBracket';
import { SeasonPointsTable } from '@/components/playoffs/SeasonPointsTable';

// Icons
import {
  ChevronDown,
  ChevronUp,
  Users,
  Trophy,
  Youtube,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  StatsPageLayout,
  type TournamentStatsData,
  type PlayerStatsData,
  type TeamStatsData,
} from '@/components/stats/StatsContent';

// Lazy-loaded My Team view (only rendered for captains)
const MyTeamPage = dynamic(
  () => import('@/app/[tournamentSlug]/my-team/page'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: 'var(--tournament-heading)' }} />
      </div>
    ),
  },
);

// ─── Social media icon SVGs for hero section ────────────────────────

const HeroDiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.2 13.2 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
  </svg>
);

const HeroTwitchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
  </svg>
);

const HeroInstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const HeroTikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
  </svg>
);

// ─── Section labels for dot navigation ───────────────────────────────

const BASE_SECTION_LABELS = ['Start', 'Tabele', 'Terminarz', 'Drużyny', 'Statystyki'];

// ─── Dot Navigation with arrow controls ─────────────────────────────

function DotNavigation({
  totalSections,
  currentSection,
  goToSection,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  sectionLabels,
}: {
  totalSections: number;
  currentSection: number;
  goToSection: (i: number) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  sectionLabels: string[];
}) {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 items-center">
      {/* Up arrow */}
      <button
        onClick={onPrev}
        aria-label="Przewiń w górę"
        className={cn(
          'flex items-center justify-center transition-opacity duration-200',
          canGoPrev ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      >
        <ChevronUp className="h-5 w-5" style={{ color: 'var(--tournament-heading)' }} />
      </button>

      {/* Dots */}
      {Array.from({ length: totalSections }).map((_, i) => (
        <button
          key={i}
          onClick={() => goToSection(i)}
          className="group relative flex items-center"
          aria-label={`Przejdź do sekcji ${sectionLabels[i] || i + 1}`}
        >
          {/* Label tooltip */}
          <span className="absolute right-full mr-3 px-2 py-1 text-[10px] uppercase tracking-widest font-logik whitespace-nowrap bg-black/80 border border-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity text-white/70 pointer-events-none">
            {sectionLabels[i] || `Sekcja ${i + 1}`}
          </span>
          <div
            className={cn('w-2 h-2 rounded-full transition-all duration-300', currentSection === i ? 'scale-150' : 'hover:opacity-70')}
            style={
              currentSection === i
                ? { backgroundColor: 'var(--tournament-heading)', boxShadow: '0 0 8px var(--tournament-heading)' }
                : { backgroundColor: 'var(--tournament-secondary-text)' }
            }
          />
        </button>
      ))}

      {/* Down arrow */}
      <button
        onClick={onNext}
        aria-label="Przewiń w dół"
        className={cn(
          'flex items-center justify-center transition-opacity duration-200',
          canGoNext ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      >
        <ChevronDown className="h-5 w-5" style={{ color: 'var(--tournament-heading)' }} />
      </button>
    </div>
  );
}

// ─── Section Wrapper ─────────────────────────────────────────────────

function FullScreenSection({
  children,
  isActive,
  className,
}: {
  children: React.ReactNode;
  isActive: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'h-[calc(100vh-3.5rem)] w-full flex-shrink-0 overflow-hidden relative',
        className,
      )}
    >
      <div className={cn(
        'h-full w-full transition-opacity duration-500',
        isActive ? 'opacity-100' : 'opacity-0',
      )}>
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export { TournamentHomePage as MmrTournamentHomePage };

export function TournamentHomePage() {
  const { tournament, getTournamentPath, theme, isLegacyTournament } = useTournament();
  const { isLeague, isMmrLimited } = useTournamentType();
  const { user } = useAuth();
  const t = useTranslations('pdlHome');

  // ── Auth state ───
  const [hasTeam, setHasTeam] = useState(false);

  // ── Divisions data (both tournament types via usePDLData) ───
  const { divisions, loading: pdlLoading } = usePDLData();

  // ── Schedule data ───
  const [matches, setMatches] = useState<Match[]>([]);

  // ── Teams data ───
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisionRankings, setDivisionRankings] = useState<Record<string, number>>({});

  // ── Playoffs data ───
  const [playoffMatches, setPlayoffMatches] = useState<PlayoffMatch[]>([]);
  const [playoffTeams, setPlayoffTeams] = useState<Team[]>([]);
  // Visibility driven by admin toggle on tournament config
  const playoffsActive = !!(tournament?.playoffs?.enabled && tournament?.playoffs?.playoffsVisible);

  // ── Stats data ───
  const [tournamentStats, setTournamentStats] = useState<TournamentStatsData | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStatsData[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStatsData[]>([]);

  const primaryColor = theme?.primaryColor || '#8B1538';
  const TOTAL_SECTIONS = hasTeam ? 6 : 5;
  const sectionLabels = useMemo(() =>
    hasTeam ? [...BASE_SECTION_LABELS, 'Moja drużyna'] : BASE_SECTION_LABELS,
    [hasTeam],
  );

  const {
    currentSection,
    goToSection,
    goNext,
    goPrev,
    containerRef,
    isTransitioning,
  } = useSnapScroll({ totalSections: TOTAL_SECTIONS, cooldown: 150, transitionDuration: 300 });

  // ── Register with HomeNavigationContext so navbar can scroll here ───
  const { registerGoToSection, selectedGroupId, setSelectedGroupId } = useHomeNavigation();
  const searchParams = useSearchParams();

  // Use a ref so the stable wrapper always calls the latest goToSection
  const goToSectionRef = useRef(goToSection);
  useEffect(() => { goToSectionRef.current = goToSection; }, [goToSection]);

  const stableGoToSection = useCallback((idx: number) => {
    goToSectionRef.current(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    registerGoToSection(stableGoToSection);
    return () => { registerGoToSection(null); };
  }, [stableGoToSection, registerGoToSection]);

  // Handle ?view=<key> and optional ?group=<id> search params — used when navigating from another page
  useEffect(() => {
    const view = searchParams.get('view');
    const group = searchParams.get('group');
    if (view && HOME_VIEW_TO_SECTION[view] !== undefined) {
      const timer = setTimeout(() => {
        stableGoToSection(HOME_VIEW_TO_SECTION[view]);
        if (group) setSelectedGroupId(group);
      }, 120);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Data fetching - all at once on mount ───

  // Check captain status
  useEffect(() => {
    const checkCaptain = async () => {
      if (!user || !tournament?.id) { setHasTeam(false); return; }
      try {
        const teamsRef = isLegacyTournament
          ? collection(db, 'teams')
          : collection(db, 'tournaments', tournament.id, 'teams');
        const q = query(teamsRef, where('captainId', '==', user.uid));
        const snap = await getDocs(q);
        setHasTeam(!snap.empty);
      } catch {
        setHasTeam(false);
      }
    };
    checkCaptain();
  }, [user, tournament?.id, isLegacyTournament]);

  // Fetch schedule matches
  useEffect(() => {
    const load = async () => {
      if (!tournament?.id) return;
      try {
        const matchesRef = isLegacyTournament
          ? collection(db, 'matches')
          : collection(db, 'tournaments', tournament.id, 'matches');
        const snap = await getDocs(matchesRef);
        const fetched: Match[] = snap.docs.map(docSnap => {
          const data = docSnap.data();
          const mapTeam = (td: unknown) => {
            if (typeof td === 'object' && td !== null) return td;
            return { id: String(td), name: 'TBA', score: 0, logoUrl: '' };
          };
          const teamAObj = mapTeam(data.teamA);
          const teamBObj = mapTeam(data.teamB);
          return {
            id: docSnap.id,
            teamA: teamAObj,
            teamB: teamBObj,
            teams: [(teamAObj as { id: string }).id, (teamBObj as { id: string }).id],
            status: data.status || 'scheduled',
            scheduledFor: data.scheduledFor || data.scheduled_for || '',
            schedulingStatus: data.schedulingStatus || 'unscheduled',
            completed_at: data.completed_at,
            scoreA: data.scoreA,
            scoreB: data.scoreB,
            round: data.round,
            matchday: data.matchday,
            group_id: data.group_id,
            bestOf: data.bestOf || 2,
            series_format: data.series_format,
            approvedStandins: data.approvedStandins,
          } as unknown as Match;
        });
        setMatches(fetched.filter(m => m.scheduledFor));
      } catch (err) {
        console.error('Failed to load schedule matches:', err);
      }
    };
    load();
  }, [tournament?.id, isLegacyTournament]);

  // Fetch teams
  useEffect(() => {
    const load = async () => {
      if (!tournament?.id) return;
      try {
        const teamsRef = isLegacyTournament
          ? collection(db, 'teams')
          : collection(db, 'tournaments', tournament.id, 'teams');
        const snap = await getDocs(teamsRef);
        const teamsData: Team[] = await Promise.all(
          snap.docs.map(async (teamDoc) => {
            const teamData = teamDoc.data();
            const rosterMap = teamData.roster as Record<string, { nickname: string; role: string; steamId32: string; avatar?: string; mmr?: number }> | undefined;
            let players: Player[];
            if (rosterMap && Object.keys(rosterMap).length > 0) {
              players = Object.entries(rosterMap).map(([steamId64, info]) => ({
                id: steamId64,
                steamId: steamId64,
                steamId32: info.steamId32,
                nickname: info.nickname,
                role: info.role,
                avatar: info.avatar || '',
                mmr: info.mmr ?? 0,
              } as unknown as Player));
            } else if (!isLegacyTournament && tournament?.id) {
              const playersRef = collection(db, 'tournaments', tournament.id, 'teams', teamDoc.id, 'players');
              const playersSnap = await getDocs(playersRef);
              players = playersSnap.docs.map(pd => ({ id: pd.id, ...pd.data() })) as unknown as Player[];
            } else {
              players = teamData.players || [];
            }
            return { id: teamDoc.id, ...teamData, players } as Team;
          }),
        );
        const divisionOrder: Record<string, number> = { elite: 1, challenger: 2, adept: 3 };
        teamsData.sort((a, b) => {
          const ao = divisionOrder[a.divisionId?.toLowerCase() || ''] || 999;
          const bo = divisionOrder[b.divisionId?.toLowerCase() || ''] || 999;
          if (ao !== bo) return ao - bo;
          return (a.name || '').localeCompare(b.name || '');
        });
        setTeams(teamsData);
        // Compute rankings
        const rankings: Record<string, number> = {};
        const byDiv: Record<string, Team[]> = {};
        teamsData.forEach(tm => {
          const d = tm.divisionId || 'none';
          if (!byDiv[d]) byDiv[d] = [];
          byDiv[d].push(tm);
        });
        Object.values(byDiv).forEach(divTeams => {
          const getP = (tm: Team): number => {
            const anyTm = tm as unknown as Record<string, unknown>;
            const s = anyTm.stats as { points?: number; wins?: number; draws?: number } | undefined;
            if (s?.points !== undefined) return s.points;
            const w = s?.wins ?? anyTm.wins ?? 0;
            const d = s?.draws ?? anyTm.draws ?? 0;
            return (w as number) * 2 + (d as number);
          };
          [...divTeams]
            .sort((a, b) => {
              const diff = getP(b) - getP(a);
              return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
            })
            .forEach((tm, idx) => { rankings[tm.id] = idx + 1; });
        });
        setDivisionRankings(rankings);
      } catch (err) {
        console.error('Failed to load teams:', err);
      }
    };
    load();
  }, [tournament?.id, isLegacyTournament]);

  // Fetch playoffs
  useEffect(() => {
    const load = async () => {
      if (!tournament?.id || tournament.playoffs?.enabled === false) return;
      try {
        // Fetch playoff matches
        let pMatches: PlayoffMatch[] = [];
        try {
          const ref = collection(db, 'tournaments', tournament.id, 'playoff_matches');
          const snap = await getDocs(ref);
          pMatches = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlayoffMatch));
        } catch { /* collection may not exist */ }

        if (pMatches.length > 0) { /* playoffsActive is driven by config flag */ }
        setPlayoffMatches(pMatches);

        // For league, compute elite standings for sidebar
        if (isLeague) {
          const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
          const teamsSnap = await getDocs(teamsRef);
          const teamsMap = new Map<string, Team>();
          teamsSnap.docs.forEach(d => {
            teamsMap.set(d.id, { id: d.id, ...d.data(), seasonPoints: 0, wins: 0, draws: 0, losses: 0 } as Team);
          });
          const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
          const matchesSnap = await getDocs(matchesRef);
          const eliteTeamIds = new Set<string>();
          matchesSnap.docs.forEach(d => {
            const m = d.data();
            if (m.divisionId !== 'elite') return;
            const aId = m.teamA?.id;
            const bId = m.teamB?.id;
            if (aId) eliteTeamIds.add(aId);
            if (bId) eliteTeamIds.add(bId);
            if (m.status === 'completed') {
              const sa = m.teamA?.score || 0;
              const sb = m.teamB?.score || 0;
              [
                { id: aId, s: sa, o: sb },
                { id: bId, s: sb, o: sa },
              ].forEach(({ id, s, o }) => {
                if (!teamsMap.has(id)) return;
                const tm = teamsMap.get(id)!;
                if (s > o) { tm.seasonPoints = (tm.seasonPoints || 0) + 2; tm.wins = (tm.wins || 0) + 1; }
                else if (s === o) { tm.seasonPoints = (tm.seasonPoints || 0) + 1; tm.draws = (tm.draws || 0) + 1; }
                else { tm.losses = (tm.losses || 0) + 1; }
                teamsMap.set(id, tm);
              });
            }
          });
          setPlayoffTeams(Array.from(teamsMap.values()).filter(tm => eliteTeamIds.has(tm.id)));
        }
      } catch (err) {
        console.error('Failed to load playoffs:', err);
      }
    };
    load();
  }, [tournament?.id, isLeague]);

  // Fetch stats
  useEffect(() => {
    const load = async () => {
      if (!tournament?.id) return;
      try {
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
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    };
    load();
  }, [tournament?.id, isLegacyTournament]);

  if (!tournament) return null;

  const logoUrl = theme?.logoUrl;
  const promoImageUrl = tournament.promotionalImageUrl;
  const heroLayout = tournament.heroLayout ?? 'logo-promo';
  const heroLeftImageUrl = tournament.heroLeftImageUrl;
  const heroRightImageUrl = tournament.heroRightImageUrl;

  // Determine if we show playoffs instead of groups in view 2
  const showPlayoffs = playoffsActive;
  const showDivisions = divisions.length > 0 && !showPlayoffs;

  return (
    <div
      ref={containerRef}
      className="relative w-full mt-14 h-[calc(100vh-3.5rem)] overflow-hidden"
    >
      {/* Dot navigation with arrow controls */}
      <DotNavigation
        totalSections={TOTAL_SECTIONS}
        currentSection={currentSection}
        goToSection={goToSection}
        canGoPrev={currentSection > 0}
        canGoNext={currentSection < TOTAL_SECTIONS - 1}
        onPrev={goPrev}
        onNext={goNext}
        sectionLabels={sectionLabels}
      />

      {/* Sliding container */}
      <div
        className="flex flex-col transition-transform ease-[cubic-bezier(0.76,0,0.24,1)] duration-300"
        style={{ transform: `translateY(calc(${currentSection} * (3.5rem - 100vh)))` }}
      >

        {/* ═══════════════════════════════════════════════════════════
            VIEW 1: Hero — two layout variants (admin-selectable)
           ═══════════════════════════════════════════════════════════ */}
        <FullScreenSection isActive={currentSection === 0}>
          {heroLayout === 'three-images' ? (
            /* ── Three-images layout ─────────────────────────────────
               Left image bleeds to the very left edge of the screen,
               tournament logo is centred, right image bleeds to the
               very right edge.  Hero copy/CTAs sit below as usual.   */
            <div className="h-full w-full flex flex-col pb-10">

              {/* Top ~65% — full-bleed halved images with centred logo overlay.
                  Left and right images each occupy exactly 50% of the viewport
                  width so they meet in the middle at every resolution.
                  The logo is absolutely centred on top of both panels. */}
              <div className="relative flex-[7] min-h-0 w-full overflow-hidden">

                {/* Left image — occupies the left half of the viewport */}
                <div className="absolute left-0 top-0 w-1/2 h-full overflow-hidden">
                  {heroLeftImageUrl ? (
                    <img
                      src={heroLeftImageUrl}
                      alt="Hero left"
                      className="h-full w-full object-cover object-right"
                    />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>

                {/* Right image — occupies the right half of the viewport */}
                <div className="absolute right-0 top-0 w-1/2 h-full overflow-hidden">
                  {heroRightImageUrl ? (
                    <img
                      src={heroRightImageUrl}
                      alt="Hero right"
                      className="h-full w-full object-cover object-left"
                    />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>

                {/* Centre — tournament logo, overlaid and centred over both panels.
                    pt-14 accounts for the navbar height so the logo appears
                    visually centred in the visible (below-navbar) area. */}
                <div className="absolute inset-0 flex items-center justify-center z-10 pt-14 pb-4 pointer-events-none">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={tournament.name}
                      className="max-h-[72vh] 2k:max-h-[54vh] max-w-[63vw] sm:max-w-[48vw] lg:max-w-[42vw] w-auto object-contain pointer-events-auto"
                    />
                  ) : (
                    <h1
                      className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight text-center px-8 pointer-events-auto"
                      style={{ color: 'var(--tournament-title)' }}
                    >
                      {tournament.name}
                    </h1>
                  )}
                </div>
              </div>

              {/* Bottom ~35% — hero copy + CTAs + social (same as logo-promo layout) */}
              <div className="flex-[3] flex flex-col min-h-0 px-6 sm:px-10 lg:px-20 xl:px-32 pt-4">
                <div className="flex flex-1 items-center gap-0">
                  <motion.div
                    className="flex-1 flex flex-col justify-center pr-8 lg:pr-16"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                  >
                    <h2
                      className="text-2xl sm:text-3xl uppercase tracking-[0.15em] font-logik-extended-bold mb-2"
                      style={{
                        color: 'var(--tournament-heading)',
                        fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                      }}
                    >
                      {tournament?.heroTitle || (isMmrLimited ? t('hero.mmrTitle') : t('hero.leagueTitle'))}
                    </h2>
                    <p
                      className="text-sm sm:text-base lg:text-lg leading-relaxed font-medium border-l-2 pl-4"
                      style={{ borderColor: primaryColor, color: 'var(--tournament-secondary-text)' }}
                    >
                      {tournament?.description || t('hero.subtitle')}
                    </p>
                  </motion.div>
                  <motion.div
                    className="flex-1 flex items-center justify-start gap-4 flex-wrap"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.1 }}
                  >
                    {hasTeam ? (
                      <button
                        onClick={() => goToSection(5)}
                        className="inline-flex items-center justify-center gap-3 px-8 py-3.5 font-logik-extended-bold text-sm uppercase tracking-widest text-white transition-all duration-300 relative overflow-hidden group whitespace-nowrap"
                        style={{
                          backgroundColor: primaryColor,
                          clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        <Trophy className="h-4 w-4 relative z-10" />
                        <span className="relative z-10">{t('hero.ctaMyTeam')}</span>
                      </button>
                    ) : (
                      <Link
                        href={getTournamentPath('/register')}
                        className="inline-flex items-center justify-center gap-3 px-8 py-3.5 font-logik-extended-bold text-sm uppercase tracking-widest text-white transition-all duration-300 relative overflow-hidden group whitespace-nowrap"
                        style={{
                          backgroundColor: primaryColor,
                          clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        <Users className="h-4 w-4 relative z-10" />
                        <span className="relative z-10">{t('hero.ctaRegister')}</span>
                      </Link>
                    )}
                    <Link
                      href={tournament?.discordUrl || organizationConfig.defaults.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-3 px-8 py-3.5 font-logik-extended-bold text-sm uppercase tracking-widest bg-transparent text-[#5865F2] border border-[#5865F2]/50 hover:border-[#5865F2] hover:bg-[#5865F2]/10 transition-all duration-300 whitespace-nowrap"
                      style={{
                        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                      }}
                    >
                      <Image
                        src="/logos/pd2ih/dc-icon.png"
                        alt="Discord"
                        width={18}
                        height={18}
                        priority
                        className="relative z-10 w-[18px] h-[18px] object-contain"
                      />
                      <span className="relative z-10">{t('hero.ctaDiscord')}</span>
                    </Link>
                  </motion.div>
                </div>
                {(tournament?.discordUrl || tournament?.twitchUrl || tournament?.youtubeUrl || tournament?.instagramUrl || tournament?.tiktokUrl) && (
                  <div className="flex items-center justify-center gap-6 py-3">
                    {tournament?.discordUrl && (
                      <a href={tournament.discordUrl} target="_blank" rel="noopener noreferrer" aria-label="Discord"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <HeroDiscordIcon className="h-5 w-5" /><span className="sr-only">Discord</span>
                      </a>
                    )}
                    {tournament?.twitchUrl && (
                      <a href={tournament.twitchUrl} target="_blank" rel="noopener noreferrer" aria-label="Twitch"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <HeroTwitchIcon className="h-5 w-5" /><span className="sr-only">Twitch</span>
                      </a>
                    )}
                    {tournament?.youtubeUrl && (
                      <a href={tournament.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <Youtube className="h-5 w-5" /><span className="sr-only">YouTube</span>
                      </a>
                    )}
                    {tournament?.instagramUrl && (
                      <a href={tournament.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <HeroInstagramIcon className="h-5 w-5" /><span className="sr-only">Instagram</span>
                      </a>
                    )}
                    {tournament?.tiktokUrl && (
                      <a href={tournament.tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <HeroTikTokIcon className="h-5 w-5" /><span className="sr-only">TikTok</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Logo + Promo layout (default) ───────────────────────
               Tournament logo on the left, promotional image on the
               right, hero copy/CTAs below.                            */
            <div className="h-full w-full flex flex-col px-6 sm:px-10 lg:px-20 xl:px-32 pt-20 pb-10">

              {/* Top ~65% — Logo (left) + Promo image (right) */}
              <div className="flex flex-[7] items-center min-h-0 gap-0">

                {/* Tournament Logo — left half */}
                <div className="flex-1 flex items-center justify-center min-h-0 h-full py-4">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={tournament.name}
                      className="max-h-[48vh] 2k:max-h-[36vh] max-w-full w-auto object-contain"
                    />
                  ) : (
                    <h1
                      className="text-5xl md:text-7xl font-logik-extended-bold uppercase tracking-tight text-center"
                      style={{ color: 'var(--tournament-title)' }}
                    >
                      {tournament.name}
                    </h1>
                  )}
                </div>

                {/* Promotional image — right half */}
                <div className="flex-1 flex items-center justify-center min-h-0 h-full py-4">
                  {promoImageUrl ? (
                    <img
                      src={promoImageUrl}
                      alt="Obraz promocyjny"
                      className="max-h-[48vh] 2k:max-h-[36vh] max-w-full w-auto object-contain"
                    />
                  ) : null}
                </div>
              </div>

              {/* Bottom ~35% — text (left col) + buttons (right col) */}
              <div className="flex-[3] flex flex-col min-h-0">
                <div className="flex flex-1 items-center gap-0">

                {/* Left column — subtitle + description */}
                <motion.div
                  className="flex-1 flex flex-col justify-center pr-8 lg:pr-16"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  <h2
                    className="text-2xl sm:text-3xl uppercase tracking-[0.15em] font-logik-extended-bold mb-2"
                    style={{
                      color: 'var(--tournament-heading)',
                      fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                    }}
                  >
                    {tournament?.heroTitle || (isMmrLimited ? t('hero.mmrTitle') : t('hero.leagueTitle'))}
                  </h2>

                  <p
                    className="text-sm sm:text-base lg:text-lg leading-relaxed font-medium border-l-2 pl-4"
                    style={{
                      borderColor: primaryColor,
                      color: 'var(--tournament-secondary-text)',
                    }}
                  >
                    {tournament?.description || t('hero.subtitle')}
                  </p>
                </motion.div>

                {/* Right column — CTA buttons */}
                <motion.div
                  className="flex-1 flex items-center justify-start gap-4 flex-wrap"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                >
                  {hasTeam ? (
                    <button
                      onClick={() => goToSection(5)}
                      className="inline-flex items-center justify-center gap-3 px-8 py-3.5 font-logik-extended-bold text-sm uppercase tracking-widest text-white transition-all duration-300 relative overflow-hidden group whitespace-nowrap"
                      style={{
                        backgroundColor: primaryColor,
                        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <Trophy className="h-4 w-4 relative z-10" />
                      <span className="relative z-10">{t('hero.ctaMyTeam')}</span>
                    </button>
                  ) : (
                    <Link
                      href={getTournamentPath('/register')}
                      className="inline-flex items-center justify-center gap-3 px-8 py-3.5 font-logik-extended-bold text-sm uppercase tracking-widest text-white transition-all duration-300 relative overflow-hidden group whitespace-nowrap"
                      style={{
                        backgroundColor: primaryColor,
                        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <Users className="h-4 w-4 relative z-10" />
                      <span className="relative z-10">{t('hero.ctaRegister')}</span>
                    </Link>
                  )}

                  <Link
                    href={tournament?.discordUrl || organizationConfig.defaults.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-3 px-8 py-3.5 font-logik-extended-bold text-sm uppercase tracking-widest bg-transparent text-[#5865F2] border border-[#5865F2]/50 hover:border-[#5865F2] hover:bg-[#5865F2]/10 transition-all duration-300 whitespace-nowrap"
                    style={{
                      clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                    }}
                  >
                    <Image
                      src="/logos/pd2ih/dc-icon.png"
                      alt="Discord"
                      width={18}
                      height={18}
                      priority
                      className="relative z-10 w-[18px] h-[18px] object-contain"
                    />
                    <span className="relative z-10">{t('hero.ctaDiscord')}</span>
                  </Link>
                </motion.div>
                </div>

                {/* Social media links */}
                {(tournament?.discordUrl || tournament?.twitchUrl || tournament?.youtubeUrl || tournament?.instagramUrl || tournament?.tiktokUrl) && (
                  <div className="flex items-center justify-center gap-6 py-3">
                    {tournament?.discordUrl && (
                      <a href={tournament.discordUrl} target="_blank" rel="noopener noreferrer" aria-label="Discord"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <HeroDiscordIcon className="h-5 w-5" />
                        <span className="sr-only">Discord</span>
                      </a>
                    )}
                    {tournament?.twitchUrl && (
                      <a href={tournament.twitchUrl} target="_blank" rel="noopener noreferrer" aria-label="Twitch"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <HeroTwitchIcon className="h-5 w-5" />
                        <span className="sr-only">Twitch</span>
                      </a>
                    )}
                    {tournament?.youtubeUrl && (
                      <a href={tournament.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <Youtube className="h-5 w-5" />
                        <span className="sr-only">YouTube</span>
                      </a>
                    )}
                    {tournament?.instagramUrl && (
                      <a href={tournament.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <HeroInstagramIcon className="h-5 w-5" />
                        <span className="sr-only">Instagram</span>
                      </a>
                    )}
                    {tournament?.tiktokUrl && (
                      <a href={tournament.tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                         className="transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--tournament-secondary-text)' }}>
                        <HeroTikTokIcon className="h-5 w-5" />
                        <span className="sr-only">TikTok</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </FullScreenSection>

        {/* ═══════════════════════════════════════════════════════════
            VIEW 2: Groups / Divisions Tables  OR  Playoffs Bracket
                    OR individual division view when selectedGroupId set
           ═══════════════════════════════════════════════════════════ */}
        <FullScreenSection isActive={currentSection === 1}>
          {/* Division / Group detail view (both tournament types) */}
          {selectedGroupId ? (
            <InlineDivisionView
              divisionId={selectedGroupId}
              onBack={() => setSelectedGroupId(null)}
            />
          ) : (
          <div className="h-full w-full flex flex-col overflow-y-auto px-4 sm:px-8 lg:px-16 py-8">
            {showPlayoffs ? (
              <>
                {/* Playoffs view */}
                <div className="text-center mb-6">
                  <h2
                    className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight"
                    style={{ color: 'var(--tournament-heading)' }}
                  >
                    Playoff
                  </h2>
                  <div className="flex items-center justify-center gap-4 mt-2 opacity-60">
                    <div className="h-[1px] w-12" style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }} />
                    <Trophy className="w-4 h-4" style={{ color: primaryColor }} />
                    <div className="h-[1px] w-12" style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }} />
                  </div>
                </div>
                <div className={cn('flex-1 grid grid-cols-1 gap-8 min-h-0', isLeague ? 'xl:grid-cols-12' : '')}>
                  {isLeague && (
                    <div className="xl:col-span-4 overflow-y-auto">
                      <SeasonPointsTable teams={playoffTeams} />
                    </div>
                  )}
                  <div className={cn('min-h-0 overflow-y-auto', isLeague ? 'xl:col-span-8' : '')}>
                    <div className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl relative overflow-hidden h-full">
                      <PlayoffBracket matches={playoffMatches} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Groups / Divisions view */}
                <div className="text-center mb-6">
                  <h2
                    className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight"
                    style={{ color: theme?.titleColor || 'white', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}
                  >
                    {isMmrLimited ? 'Grupy' : 'Dywizje'}
                  </h2>
                  <div className="flex items-center justify-center gap-4 mt-2 opacity-60">
                    <div className="h-[1px] w-12" style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }} />
                    <div className="w-2 h-2 rotate-45 border" style={{ borderColor: primaryColor }} />
                    <div className="h-[1px] w-12" style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }} />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {showDivisions && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                      {divisions.map((division) => (
                        <DivisionTable
                          key={division.id || division.name}
                          divisionName={division.name}
                          divisionColor={division.color}
                          teams={division.teams}
                          divisionId={division.id}
                          divisionTheme={division.theme}
                          medalUrl={division.medalUrl}
                        />
                      ))}
                    </div>
                  )}

                  {!showDivisions && (
                    <div className="flex-1 flex items-center justify-center">
                      <p
                        className="font-logik text-lg"
                        style={{ color: 'var(--tournament-heading)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}
                      >Tabele pojawią się po rozpoczęciu turnieju.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </FullScreenSection>

        {/* ═══════════════════════════════════════════════════════════
            VIEW 3: Schedule Carousel
           ═══════════════════════════════════════════════════════════ */}
        <FullScreenSection isActive={currentSection === 2}>
          <div className="h-full w-full overflow-y-auto text-white">
            {matches.length > 0 ? (
              <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-12 py-3 sm:py-5">
                {tournament?.type === 'league' ? (
                  <MatchdayCarousel matches={matches} />
                ) : (
                  <ChronologicalCarousel matches={matches} />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p
                  className="font-logik text-lg"
                  style={{ color: 'var(--tournament-heading)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}
                >Terminarz pojawi się po zaplanowaniu meczy.</p>
              </div>
            )}
          </div>
        </FullScreenSection>

        {/* ═══════════════════════════════════════════════════════════
            VIEW 4: Teams
           ═══════════════════════════════════════════════════════════ */}
        <FullScreenSection isActive={currentSection === 3}>
          <TeamsView teams={teams} divisionRankings={divisionRankings} />
        </FullScreenSection>

        {/* ═══════════════════════════════════════════════════════════
            VIEW 5: Stats
           ═══════════════════════════════════════════════════════════ */}
        <FullScreenSection isActive={currentSection === 4}>
          <div className="h-full w-full overflow-y-auto text-white">
            <StatsPageLayout
              tournamentStats={tournamentStats}
              playerStats={playerStats}
              teamStats={teamStats}
            />
          </div>
        </FullScreenSection>

        {/* ═══════════════════════════════════════════════════════════
            VIEW 6: My Team (captains only)
           ═══════════════════════════════════════════════════════════ */}
        {hasTeam && (
          <FullScreenSection isActive={currentSection === 5}>
            {/* Override the standalone page styles: hide fixed background, remove min-h-screen */}
            <div className="h-full w-full overflow-y-auto text-white
              [&>div]:!min-h-0 [&>div]:!h-full
              [&>div>div.fixed]:!hidden">
              <MyTeamPage />
            </div>
          </FullScreenSection>
        )}

      </div>
    </div>
  );
}
