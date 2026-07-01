"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import DOMPurify from 'dompurify';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { getAllTeams, getUserPickem, getUserProfile, updateUserProfile } from '@/lib/firestore';
import { useTranslation } from '@/hooks/useTranslation';
import type { Team, UserProfile } from '@/lib/definitions';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { DiscordUsernameModal } from '@/components/app/DiscordUsernameModal';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type LegacyContainerId =
  | 'champion'
  | 'runnerUp'
  | 'thirdPlace'
  | 'fourthPlace'
  | 'fifthToSixth'
  | 'seventhToEighth'
  | 'ninthToTwelfth'
  | 'thirteenthToSixteenth';

interface PlacementBasket {
  id: string;
  title: string;
  limit: number;
  score: number;
}

interface BasketShape {
  id: string;
  limit: number;
  score: number;
}

type PicksState = Record<string, string[]>;

const BYE_PREFIX = '__pickem_bye__';

const LEGACY_SCORE_TO_CONTAINER_MAP: Record<number, LegacyContainerId> = {
  16: 'champion',
  15: 'runnerUp',
  14: 'thirdPlace',
  13: 'fourthPlace',
  11: 'fifthToSixth',
  9: 'seventhToEighth',
  6: 'ninthToTwelfth',
  2: 'thirteenthToSixteenth',
};

const isByeId = (id: string): boolean => id.startsWith(BYE_PREFIX);

function buildLegacyBaskets(t: (key: string) => string): PlacementBasket[] {
  return [
    { id: 'champion', title: t('pickem.champion'), limit: 1, score: 16 },
    { id: 'runnerUp', title: t('pickem.runnerUp'), limit: 1, score: 15 },
    { id: 'thirdPlace', title: t('pickem.thirdPlace'), limit: 1, score: 14 },
    { id: 'fourthPlace', title: t('pickem.fourthPlace'), limit: 1, score: 13 },
    { id: 'fifthToSixth', title: t('pickem.fifthToSixth'), limit: 2, score: 11 },
    { id: 'seventhToEighth', title: t('pickem.seventhToEighth'), limit: 2, score: 9 },
    { id: 'ninthToTwelfth', title: t('pickem.ninthToTwelfth'), limit: 4, score: 6 },
    { id: 'thirteenthToSixteenth', title: t('pickem.thirteenthToSixteenth'), limit: 4, score: 2 },
  ];
}

function buildMmrBaskets(totalSlots: number, scoreBase: number): PlacementBasket[] {
  const normalizedSlots = Math.max(2, Math.floor(totalSlots || 2));
  const normalizedScoreBase = Math.max(2, Math.floor(scoreBase || normalizedSlots));
  const baskets: PlacementBasket[] = [];

  let placeStart = 1;
  let remaining = normalizedSlots;
  // Mirrors single-elimination rounds: winner, runner-up, then each round doubles losers.
  const bucketPattern = [1, 1, 2, 4, 8, 16, 32, 64];
  let bucketIdx = 0;

  while (remaining > 0) {
    const size = Math.min(bucketPattern[Math.min(bucketIdx, bucketPattern.length - 1)], remaining);
    const placeEnd = placeStart + size - 1;

    baskets.push({
      id: size === 1 ? `place_${placeStart}` : `place_${placeStart}_${placeEnd}`,
      title: size === 1 ? `Miejsce ${placeStart}` : `Miejsca ${placeStart}-${placeEnd}`,
      limit: size,
      // User request: bucket points equal to score of the worst place in that bucket.
      score: Math.max(1, normalizedScoreBase - (placeEnd - 1)),
    });

    placeStart = placeEnd + 1;
    remaining -= size;
    bucketIdx += 1;
  }

  return baskets;
}

function formatBasicMarkdown(markdown: string): string {
  if (!markdown.trim()) return '';

  let formatted = markdown;
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-semibold mt-4 mb-3">$1</h1>');
  formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline">$1</a>');

  formatted = formatted.replace(/^[\-*] (.+)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc ml-5 my-2">$1</ul>');

  return formatted
    .split(/\n\n+/)
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul')) return trimmed;
      return `<p class="leading-relaxed mb-3">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
}

function sortTeamsAlphabetically(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    const aName = (a.name || a.tag || a.id || '').trim();
    const bName = (b.name || b.tag || b.id || '').trim();
    return aName.localeCompare(bName, 'pl', { sensitivity: 'base' });
  });
}

export default function PickemPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { isLeague, isMmrLimited } = useTournamentType();
  const { user, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<PicksState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const pageTitleClass = 'text-4xl md:text-5xl 2xl:text-6xl font-logik-wide-black tracking-tighter uppercase';

  const byeTeamsCount = Math.max(0, Number(tournament?.pickem?.byeTeamsCount ?? 0));
  const playoffsTeamsCount = Math.max(2, Number(tournament?.playoffs?.teamsCount ?? 16));
  const effectiveMmrSlots = useMemo(() => {
    return Math.max(2, playoffsTeamsCount - byeTeamsCount);
  }, [playoffsTeamsCount, byeTeamsCount]);

  const pickemDeadlineDate = useMemo(() => {
    const raw = tournament?.pickem?.submissionDeadline;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [tournament?.pickem?.submissionDeadline]);

  const isPastPickemDeadline = useMemo(() => {
    if (!pickemDeadlineDate) return false;
    return Date.now() > pickemDeadlineDate.getTime();
  }, [pickemDeadlineDate]);

  const baskets = useMemo(() => {
    if (isLegacyTournament) return buildLegacyBaskets(t);
    return buildMmrBaskets(effectiveMmrSlots, playoffsTeamsCount);
  }, [isLegacyTournament, t, effectiveMmrSlots, playoffsTeamsCount]);

  const basketShape = useMemo<BasketShape[]>(() => {
    if (isLegacyTournament) {
      return [
        { id: 'champion', limit: 1, score: 16 },
        { id: 'runnerUp', limit: 1, score: 15 },
        { id: 'thirdPlace', limit: 1, score: 14 },
        { id: 'fourthPlace', limit: 1, score: 13 },
        { id: 'fifthToSixth', limit: 2, score: 11 },
        { id: 'seventhToEighth', limit: 2, score: 9 },
        { id: 'ninthToTwelfth', limit: 4, score: 6 },
        { id: 'thirteenthToSixteenth', limit: 4, score: 2 },
      ];
    }

    return buildMmrBaskets(effectiveMmrSlots, playoffsTeamsCount).map((basket) => ({
      id: basket.id,
      limit: basket.limit,
      score: basket.score,
    }));
  }, [isLegacyTournament, effectiveMmrSlots, playoffsTeamsCount]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      try {
        let teams: Team[] = [];

        if (isLegacyTournament) {
          teams = await getAllTeams();
        } else if (tournament?.id) {
          const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
          const teamsSnapshot = await getDocs(teamsRef);

          teams = teamsSnapshot.docs.map((teamDoc) => {
            const teamData = teamDoc.data();
            return {
              id: teamDoc.id,
              name: teamData.name || '',
              tag: teamData.tag || '',
              logo: teamData.logo || '',
              logoUrl: teamData.logoUrl || teamData.logo || '',
              captainId: teamData.captainId || '',
              divisionId: teamData.divisionId,
              discordUsername: teamData.discordUsername || '',
              motto: teamData.motto || '',
              players: [],
              wins: teamData.wins || 0,
              draws: teamData.draws || 0,
              losses: teamData.losses || 0,
              points: teamData.points || 0,
              status: teamData.status || 'active',
              createdAt: teamData.createdAt || new Date().toISOString(),
            } as Team;
          });
        }

        const sortedTeams = sortTeamsAlphabetically(teams);
        setAllTeams(sortedTeams);

        const initial: PicksState = { pool: sortedTeams.map((team) => team.id) };
        basketShape.forEach((basket) => {
          initial[basket.id] = [];
        });

        if (user) {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);

          if (tournament?.id) {
            const pickemSnap = await getDoc(doc(db, 'tournaments', tournament.id, 'pickems', user.uid));
            const data = pickemSnap.data() as { baskets?: Record<string, string[]>; scores?: Record<string, number> } | undefined;
            if (data?.baskets) {
              const used = new Set<string>();
              for (const basket of basketShape) {
                const fromDoc = Array.isArray(data.baskets[basket.id]) ? data.baskets[basket.id] : [];
                initial[basket.id] = fromDoc.filter((teamId) => teamId && !isByeId(teamId) && teams.some((team) => team.id === teamId));
                initial[basket.id].forEach((teamId) => {
                  used.add(teamId);
                });
              }
              // Stale keys (e.g. old bucket IDs like place_5_6 / place_7_8 that no longer exist
              // after a bucket structure change) would leave teams unreachable — collect them into pool.
              Object.values(data.baskets).forEach((teamIds) => {
                if (!Array.isArray(teamIds)) return;
                teamIds.forEach((teamId) => {
                  if (teamId && !isByeId(teamId) && !used.has(teamId) && teams.some((t) => t.id === teamId)) {
                    used.add(teamId);
                  }
                });
              });

                initial.pool = sortedTeams.map((team) => team.id).filter((id) => !used.has(id));
            } else if (isLegacyTournament) {
              // Backward-compat fallback for old global legacy pickem documents.
              const legacyPickem = await getUserPickem(user.uid);
              if (legacyPickem?.scores) {
                const used = new Set<string>();
                Object.entries(legacyPickem.scores).forEach(([teamId, score]) => {
                  const legacyId = LEGACY_SCORE_TO_CONTAINER_MAP[score];
                  if (legacyId && initial[legacyId] && teams.some((team) => team.id === teamId)) {
                    initial[legacyId].push(teamId);
                    used.add(teamId);
                  }
                });
                initial.pool = sortedTeams.map((team) => team.id).filter((id) => !used.has(id));
              }
            }
          }
        }

        setPicks(initial);
      } catch (error) {
        console.error('Error loading pickem data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (tournament) {
      loadData();
    }
  }, [user, isLegacyTournament, tournament?.id, basketShape]);

  const getTeamById = (teamId: string): Team | undefined => allTeams.find((team) => team.id === teamId);

  const onDragStart = () => setIsDraggingAny(true);

  const onDragEnd = (result: DropResult) => {
    setIsDraggingAny(false);
    if (!result.destination || !picks) return;

    const sourceId = result.source.droppableId;
    const destId = result.destination.droppableId;

    const sourceList = Array.from(picks[sourceId] || []);
    const destList = sourceId === destId ? sourceList : Array.from(picks[destId] || []);

    const [movedTeamId] = sourceList.splice(result.source.index, 1);
    if (!movedTeamId) return;

    destList.splice(result.destination.index, 0, movedTeamId);

    setPicks({
      ...picks,
      [sourceId]: sourceList,
      [destId]: destList,
    });
  };

  const isSubmissionReady = useMemo(() => {
    if (!picks) return false;
    return basketShape.every((basket) => (picks[basket.id] || []).length === basket.limit);
  }, [picks, basketShape]);

  const resetPicks = () => {
    const reset: PicksState = { pool: allTeams.map((team) => team.id) };
    basketShape.forEach((basket) => {
      reset[basket.id] = [];
    });

    setPicks(reset);
  };

  const performSave = async () => {
    if (!user || !picks || !isSubmissionReady) return;
    if (isPastPickemDeadline) {
      toast({
        title: 'Zapis zablokowany',
        description: 'Termin zapisu Pick\'em minął.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const basketAssignments: Record<string, string[]> = {};
      const scores: Record<string, number> = {};

      basketShape.forEach((basket) => {
        basketAssignments[basket.id] = picks[basket.id] || [];
        (picks[basket.id] || []).forEach((teamId) => {
          scores[teamId] = basket.score;
        });
      });

      if (tournament?.id) {
        const discordUsername = userProfile?.discordUsername || '';

        await setDoc(
          doc(db, 'tournaments', tournament.id, 'pickems', user.uid),
          {
            userId: user.uid,
            tournamentId: tournament.id,
            displayName: user.displayName || '',
            email: user.email || '',
            discordUsername,
            baskets: basketAssignments,
            scores,
            byeTeamsCount,
            playoffsFormat: tournament.playoffs?.format || null,
            playoffsTeamsCount: tournament.playoffs?.teamsCount || null,
            submissionDeadline: tournament.pickem?.submissionDeadline || null,
            updatedAt: serverTimestamp(),
          },
          // No merge — full overwrite ensures stale bucket keys are removed.
          // All necessary fields are always written above.
        );
      }

      toast({ title: 'Zapisano', description: 'Twoje predykcje Pick\'em zostały zapisane.' });
    } catch (error) {
      console.error("Error saving Pick'em:", error);
      toast({
        title: 'Błąd',
        description: (error as Error).message || 'Nie udało się zapisać predykcji Pick\'em.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitClick = () => {
    if (isPastPickemDeadline) {
      toast({
        title: 'Zapis zablokowany',
        description: 'Termin zapisu Pick\'em minął.',
        variant: 'destructive',
      });
      return;
    }

    setIsModalOpen(true);
  };

  const handleModalSubmit = async (username: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, { discordUsername: username });
      setUserProfile((prev) => ({ ...prev, uid: user.uid, discordUsername: username }));
      setIsModalOpen(false);
      await performSave();
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się zapisać nicku Discord.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!tournament) return null;

  const pickemEnabled = tournament.pickem?.enabled;

  if (!pickemEnabled) {
    return (
      <div className="relative text-white overflow-x-hidden min-h-screen">
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-60"
            style={{ background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)' }}
          />
          <div
            className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.05] blur-[200px]"
            style={{ background: theme.primaryColor }}
          />
          <div
            className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
            style={{ background: theme.accentColor }}
          />
        </div>

        <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-8">
          <div className="text-center space-y-4 py-8">
            <h1
              className={pageTitleClass}
              style={{ color: theme.titleColor || theme.textColor || '#ffffff' }}
            >
              Pick'em
            </h1>
          </div>

          <Card className="max-w-3xl mx-auto bg-white/[0.03] border-white/10 backdrop-blur-sm">
            <CardContent className="py-16 text-center space-y-3">
              <h3 className="text-xl font-logik-extended-bold">Pick'em niedostepne</h3>
              <p className="text-white/60">Pick'em nie jest wlaczone w tym turnieju.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingScreen />;

  if (!user) {
    return (
      <div className="min-h-screen w-full text-white">
        <div className="max-w-[1800px] mx-auto px-6 lg:px-12 py-6">
          <div className="text-center py-6">
            <h1
              className={pageTitleClass}
              style={{ color: theme.titleColor || theme.textColor || '#ffffff' }}
            >
              Pick'em
            </h1>
          </div>

          <Card className="max-w-xl mx-auto text-center bg-black/25 border-white/15 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-xl font-logik-extended-bold" style={{ color: 'var(--tournament-heading, #ffffff)' }}>
                {t('pickem.joinChallenge')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-5 text-sm text-white/75">{t('pickem.loginToPredict')}</p>
              <Button
                onClick={signInWithGoogle}
                size="lg"
                className="font-logik-extended-bold uppercase tracking-wide"
                style={{
                  backgroundColor: 'var(--tournament-primary, #8B1538)',
                  color: '#ffffff',
                  clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                }}
              >
                {t('common.signInWithGoogle')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isLegacyTournament && !isMmrLimited) {
    return (
      <div className="min-h-screen w-full text-white">
        <div className="max-w-[1800px] mx-auto px-6 lg:px-12 py-8">
          <div className="text-center py-8">
            <h1
              className={pageTitleClass}
              style={{ color: theme.titleColor || theme.textColor || '#ffffff' }}
            >
              Pick'em
            </h1>
          </div>

          <Card className="bg-transparent border-white/10 max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="font-logik-extended-bold">{isLeague ? 'Przewidywania koncowych miejsc w dywizjach' : 'Pick\'em'}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/70 text-center py-8">Pick'em dla tego typu turnieju bedzie dostepne w kolejnej aktualizacji.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const formattedInstructions = DOMPurify.sanitize(formatBasicMarkdown(tournament.pickem?.instructionsMarkdown || ''));

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full overflow-hidden" style={{ color: 'var(--tournament-text, #ffffff)' }}>
      <div className="max-w-[1800px] mx-auto px-6 lg:px-12 h-full py-1 md:py-2 flex flex-col gap-2">
        <div className="text-center space-y-1 py-1 relative shrink-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-20 blur-[80px] rounded-full pointer-events-none" style={{ background: `${theme?.primaryColor || '#8B1538'}0D` }} />

          <h1
            className={pageTitleClass}
            style={{ color: theme.titleColor || theme.textColor || '#ffffff' }}
          >
            Pick'em
          </h1>

          <div className="flex items-center justify-center gap-4 opacity-60">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[var(--tournament-primary)]" />
            <div className="w-2 h-2 rotate-45 border border-[var(--tournament-primary)]" />
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[var(--tournament-primary)]" />
          </div>
        </div>

        <DiscordUsernameModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleModalSubmit}
          isSubmitting={isSaving}
          initialUsername={userProfile?.discordUsername || ''}
        />

        {picks && (
          <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 xl:col-span-4">
                <Card className="bg-transparent border-white/10">
                  <Droppable droppableId="pool">
                    {(provided) => (
                      <CardContent ref={provided.innerRef} {...provided.droppableProps}>
                        <ScrollArea className="h-[560px] p-2 rounded-xl border border-white/10 bg-transparent">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {(picks.pool || []).map((teamId, index) => (
                              <Draggable key={teamId} draggableId={teamId} index={index}>
                                {(innerProvided, snapshot) => {
                                  const el = (
                                    <div ref={innerProvided.innerRef} {...innerProvided.draggableProps} {...innerProvided.dragHandleProps}>
                                      <TeamCardItem team={getTeamById(teamId)} teamId={teamId} compact={true} />
                                    </div>
                                  );
                                  return snapshot.isDragging ? createPortal(el, document.body) : el;
                                }}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    )}
                  </Droppable>
                </Card>
              </div>

              <div className="lg:col-span-7 xl:col-span-8">
                <Card className="bg-transparent border-white/10">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {baskets.map((basket) => (
                        <DroppableList
                          key={basket.id}
                          id={basket.id}
                          title={basket.title}
                          teams={picks[basket.id] || []}
                          getTeamById={getTeamById}
                          requiredCount={basket.limit}
                          isDraggingAny={isDraggingAny}
                        />
                      ))}
                    </div>
                  </CardContent>
                  {formattedInstructions && (
                    <CardContent className="pt-0 pb-1">
                      <div className="max-h-28 overflow-y-auto pr-2">
                        <div
                          className="max-w-none text-sm leading-relaxed"
                          style={{ color: 'var(--tournament-text, #ffffff)' }}
                          dangerouslySetInnerHTML={{ __html: formattedInstructions }}
                        />
                      </div>
                    </CardContent>
                  )}
                  <CardFooter className="p-4 pt-2 flex flex-col md:flex-row md:justify-end items-center gap-3 border-t border-white/10">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={resetPicks}
                      disabled={isSaving}
                      className="w-full md:w-auto md:flex-none shrink-0 min-h-[46px] inline-flex items-center justify-center gap-3 px-6 md:px-8 py-3 font-logik-extended-bold text-xs md:text-sm uppercase tracking-wide bg-transparent transition-all duration-300 relative overflow-hidden group whitespace-nowrap border"
                      style={{
                        color: 'var(--tournament-text, #ffffff)',
                        borderColor: 'color-mix(in srgb, var(--tournament-text, #ffffff) 50%, transparent)',
                        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                      }}
                    >
                      <span className="relative z-10">{t('pickem.resetAllPicks')}</span>
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleSubmitClick}
                      disabled={!isSubmissionReady || isSaving || isPastPickemDeadline}
                      className="w-full md:w-auto md:flex-none shrink-0 min-h-[46px] inline-flex items-center justify-center gap-3 px-6 md:px-8 py-3 font-logik-extended-bold text-xs md:text-sm uppercase tracking-wide text-white transition-all duration-300 relative overflow-hidden group whitespace-nowrap"
                      style={{
                        backgroundColor: 'var(--tournament-primary, #8B1538)',
                        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                      }}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin relative z-10" /> : null}
                      <span className="relative z-10">{isSaving ? t('pickem.saving') : t('pickem.submitPredictions')}</span>
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}

interface DroppableListProps {
  id: string;
  title: string;
  teams: string[];
  getTeamById: (id: string) => Team | undefined;
  requiredCount: number;
  isDraggingAny?: boolean;
}

const DroppableList = ({ id, title, teams, getTeamById, requiredCount, isDraggingAny }: DroppableListProps) => {
  const { t } = useTranslation();
  const bucketBorderColor = 'var(--tournament-heading, #8B1538)';

  return (
    <Card className="flex flex-col min-w-[200px] bg-transparent border-transparent shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-normal flex justify-between items-center">
          <span className="flex items-center font-normal" style={{ color: 'var(--tournament-text, #ffffff)' }}>
            {title}
          </span>
          <Badge
            variant="outline"
            className="font-normal bg-transparent border"
            style={{
              color: 'var(--tournament-text, #ffffff)',
              borderColor: 'color-mix(in srgb, var(--tournament-text, #ffffff) 45%, transparent)',
            }}
          >
            {teams.length} / {requiredCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <CardContent
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'relative flex-grow min-h-[88px] rounded-xl p-2 pl-5 transition-all duration-200',
              snapshot.isDraggingOver ? 'opacity-100' : 'opacity-95',
              (isDraggingAny || snapshot.isDraggingOver) && 'border border-dashed',
            )}
            style={
              snapshot.isDraggingOver
                ? { borderColor: 'color-mix(in srgb, var(--tournament-heading, #8B1538) 70%, transparent)', backgroundColor: 'color-mix(in srgb, var(--tournament-heading, #8B1538) 8%, transparent)' }
                : isDraggingAny
                ? { borderColor: 'color-mix(in srgb, var(--tournament-heading, #8B1538) 30%, transparent)' }
                : undefined
            }
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ backgroundColor: bucketBorderColor, boxShadow: `0 0 12px color-mix(in srgb, ${bucketBorderColor} 60%, transparent)` }}
            />
            {teams.length > 0 ? teams.map((teamId, index) => (
              <Draggable key={teamId} draggableId={teamId} index={index}>
                {(innerProvided, snapshot) => {
                  const el = (
                    <div ref={innerProvided.innerRef} {...innerProvided.draggableProps} {...innerProvided.dragHandleProps}>
                      <TeamCardItem team={getTeamById(teamId)} teamId={teamId} />
                    </div>
                  );
                  return snapshot.isDragging ? createPortal(el, document.body) : el;
                }}
              </Draggable>
            )) : (
              <div className="flex items-center justify-center h-full text-xs font-normal" style={{ color: 'var(--tournament-secondary-text, rgba(255,255,255,0.5))' }}>{t('pickem.dropTeamsHere')}</div>
            )}
            {provided.placeholder}
          </CardContent>
        )}
      </Droppable>
    </Card>
  );
};

const TeamCardItem = ({ team, teamId, compact = false }: { team: Team | undefined; teamId: string; compact?: boolean }) => {
  const { t } = useTranslation();

  if (isByeId(teamId)) {
    return (
      <TeamCardShell compact={compact} borderColor="rgba(251, 191, 36, 0.95)">
        <div className={cn('rounded-sm flex-shrink-0 bg-amber-500/30 flex items-center justify-center font-bold text-amber-100', compact ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]')}>BYE</div>
        <span className={cn('font-medium text-amber-100 uppercase tracking-wide', compact ? 'text-xs' : 'text-sm')}>BYE</span>
      </TeamCardShell>
    );
  }

  if (!team) {
    return (
      <TeamCardShell compact={compact} borderColor="var(--tournament-secondary-text, rgba(255,255,255,0.5))">
        <div className={cn('bg-muted-foreground rounded-sm flex-shrink-0', compact ? 'w-5 h-5' : 'w-6 h-6')} />
        <span className={cn('font-medium', compact ? 'text-xs' : 'text-sm')} style={{ color: 'var(--tournament-secondary-text, rgba(255,255,255,0.5))' }}>{t('pickem.unknownTeam')}</span>
      </TeamCardShell>
    );
  }

  return (
    <TeamCardShell compact={compact} borderColor="var(--tournament-text, #ffffff)">
      <Image src={team.logoUrl || `https://placehold.co/24x24.png?text=${team.name.charAt(0)}`} alt={team.name} width={compact ? 20 : 24} height={compact ? 20 : 24} className="rounded-sm flex-shrink-0" unoptimized={true} />
      <span className={cn('font-medium truncate', compact ? 'text-xs' : 'text-sm')} style={{ color: 'var(--tournament-text, #ffffff)' }}>{team.name}</span>
    </TeamCardShell>
  );
};

const TeamCardShell = ({ children, compact, borderColor }: { children: React.ReactNode; compact: boolean; borderColor: string }) => (
  <div
    className={cn(
      'relative bg-transparent rounded-xl cursor-grab active:cursor-grabbing',
      compact ? 'mb-1.5' : 'mb-2',
    )}
  >
    <div
      className="absolute left-0 top-0 bottom-0 w-[3px]"
      style={{ backgroundColor: borderColor, boxShadow: `0 0 12px ${borderColor}60` }}
    />
    <div className={cn('flex items-center transition-colors', compact ? 'pl-3 pr-1.5 py-1.5 space-x-2' : 'pl-4 pr-2.5 py-2.5 space-x-3')}>
      {children}
    </div>
  </div>
);
