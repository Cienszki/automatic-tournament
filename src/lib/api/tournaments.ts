// src/lib/api/tournaments.ts
// API functions for tournament CRUD operations

import { 
  collection,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDocs, 
  query, 
  where,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { validateSlug, describeSlugProblem } from '@/lib/reserved-slugs';
import {
  checkNamespaceClaim,
  describeNamespaceVerdict,
  type SlugOwner,
} from '@/lib/slug-namespace';
import { TournamentConfig, TournamentSummary, TournamentType } from '@/types/tournament';

/**
 * Create a new tournament
 * Returns the tournament ID
 */
/**
 * Type-specific slice of a new tournament's config.
 *
 * Kept as an explicit per-type lookup rather than `isMmrLimited ? a : b`. With
 * only two types a boolean worked, but the "else" branch silently meant
 * "league" — so adding Swiss to that shape would have handed it
 * promotion/relegation, a two-round season, and season-long fantasy.
 */
function buildTypeSpecificConfig(
  type: TournamentType,
  structure: any
): Record<string, any> {
  switch (type) {
    case 'mmr-limited':
      return {
        mmrCap: structure.mmrCap || 24000,
        mmrVerificationRequired: true,
        coachMode: 'disabled',
        defaultMatchFormat: structure.groupMatchFormat || 'bo2',
        schedulingMethod: 'captain-scheduled',
        groupMatchFormat: structure.groupMatchFormat || 'bo2',
        fantasyType: 'round-based',
        fantasyBudget: structure.mmrCap || 24000,
        pickemLockTime: 'before-round',
        standinRequireRegistration: true,
        standinRequireOpponentApproval: false,
        standinMmrRestrictions: true,
      };

    case 'league':
      return {
        mmrCap: null,
        mmrVerificationRequired: false,
        coachMode: 'per-game',
        defaultMatchFormat: 'bo2',
        schedulingMethod: 'admin-scheduled',
        promotionRelegationEnabled: true,
        roundsPerSeason: 2,
        fantasyType: 'season-long',
        fantasyBudget: 100,
        pickemLockTime: 'before-season',
        standinRequireRegistration: false,
        standinRequireOpponentApproval: true,
        standinMmrRestrictions: false,
      };

    case 'swiss':
      return {
        // No cap and no per-player MMR: a Swiss team self-reports one average,
        // used only for seeding, so there is nothing to verify against.
        mmrCap: null,
        mmrVerificationRequired: false,
        coachMode: 'disabled',
        defaultMatchFormat: structure.swissMatchFormat || 'bo2',
        // The admin picks a scheduling mode per round; this is only the default.
        schedulingMethod: 'captain-scheduled',
        swiss: {
          plannedRounds: structure.swissPlannedRounds ?? null,
          currentRound: 0,
          defaultMatchFormat: structure.swissMatchFormat || 'bo2',
          allowConsecutiveRematch: false,
          byeTeamId: null,
          divisionId: null,
        },
        // Fantasy prices players by MMR and Pick'em needs a known schedule —
        // neither exists in Swiss, so both stay off. See plan "Known limitations".
        fantasyType: 'round-based',
        fantasyBudget: 100,
        pickemLockTime: 'before-round',
        standinRequireRegistration: false,
        standinRequireOpponentApproval: true,
        standinMmrRestrictions: false,
      };
  }
}

export async function createTournament(data: {
  basicInfo: any;
  branding: any;
  structure: any;
  template: string;
  /**
   * Firebase uid of the creator. Becomes `organizerId` and the tournament's
   * first admin. Previously hardcoded to 'pd2ih', which meant every tournament
   * claimed the same owner and firestore.rules could not tell creators apart.
   */
  organizerId: string;
}): Promise<string> {
  const { basicInfo, branding, structure, template, organizerId } = data;
  const type: TournamentType = structure.type;
  const isSwiss = type === 'swiss';

  // Guard: never let an unusable slug reach the database, even if a caller
  // skipped the isSlugAvailable() check. Covers reserved names AND malformed
  // ones — a slug containing '/', '.' or uppercase breaks routing outright, and
  // fetchTournamentBySlug matches the stored value exactly.
  const slugProblem = validateSlug(basicInfo.slug);
  if (slugProblem) {
    throw new Error(describeSlugProblem(slugProblem, basicInfo.slug));
  }

  const preset = buildTypeSpecificConfig(type, structure);

  // Build tournament configuration
  const tournamentConfig: Record<string, any> = {
    slug: basicInfo.slug,
    name: basicInfo.name,
    shortName: basicInfo.shortName,
    description: basicInfo.description,
    organizerId,
    
    type: structure.type,
    status: 'draft',
    visibility: 'inactive',
    
    startDate: basicInfo.tournamentStart || null,
    endDate: basicInfo.tournamentEnd || null,
    
    discordUrl: basicInfo.discordUrl || null,
    twitchUrl: basicInfo.twitchUrl || null,
    
    leagueId: null,
    
    // Flat registration fields are the ones TournamentConfig declares and that
    // the rest of the app can actually read. The nested `registration` object
    // below is written purely for backward compatibility with
    // fetchTournaments(), which reads `registration.maxTeams`.
    registrationStartDate: basicInfo.registrationStart || null,
    registrationEndDate: basicInfo.registrationEnd || null,
    maxTeams: structure.maxTeams ?? null,

    registration: {
      enabled: true,
      startDate: basicInfo.registrationStart || null,
      endDate: basicInfo.registrationEnd || null,
      requireApproval: false,
      maxTeams: structure.maxTeams ?? null,
    },


    // Team configuration
    teamSize: 5,
    mmrCap: preset.mmrCap,
    mmrVerificationRequired: preset.mmrVerificationRequired,
    coachMode: preset.coachMode,

    // Match configuration
    defaultMatchFormat: preset.defaultMatchFormat,
    schedulingMethod: preset.schedulingMethod,

    // Type-specific structure: groupMatchFormat (mmr-limited),
    // promotionRelegationEnabled + roundsPerSeason (league), swiss (swiss).
    ...(preset.groupMatchFormat !== undefined ? { groupMatchFormat: preset.groupMatchFormat } : {}),
    ...(preset.promotionRelegationEnabled !== undefined ? {
      promotionRelegationEnabled: preset.promotionRelegationEnabled,
      roundsPerSeason: preset.roundsPerSeason,
    } : {}),
    ...(preset.swiss !== undefined ? { swiss: preset.swiss } : {}),

    fantasy: {
      // Fantasy prices players from per-player MMR, which Swiss does not collect.
      enabled: isSwiss ? false : structure.enableFantasy,
      type: preset.fantasyType,
      rosterSize: 5,
      budget: preset.fantasyBudget,
      lockBeforeMatchday: true,
      scoring: {
        killPoints: 3,
        deathPoints: -3,
        assistPoints: 1.5,
        lastHitPoints: 0.015,
        gpmPoints: 1,
        xpmPoints: 0,
        towerKillPoints: 0.75,
        roshanKillPoints: 0.5,
        obsPlacedPoints: 0.05,
        senPlacedPoints: 0.05,
        teamWinPoints: 4,
      },
    },
    
    pickem: {
      // Pick'em predicts a known schedule; Swiss round N+1 does not exist until
      // round N completes, so there is nothing to predict.
      enabled: isSwiss ? false : structure.enablePickem,
      matchPredictions: true,
      standingsPredictions: true,
      playoffBracket: true,
      mvpPredictions: false,
      lockTime: preset.pickemLockTime,
    },

    standins: {
      enabled: structure.enableStandins,
      requireRegistration: preset.standinRequireRegistration,
      requireOpponentApproval: preset.standinRequireOpponentApproval,
      adminCanOverride: true,
      maxPerMatch: 1,
      maxPerRound: 1,
      mmrRestrictions: preset.standinMmrRestrictions,
    },

    playoffs: {
      // Optional for Swiss — a future organiser may run Swiss with no playoffs.
      enabled: structure.enablePlayoffs ?? true,
      format: structure.playoffFormat || 'double-elimination',
      teamsCount: structure.playoffTeamsCount ?? structure.teamsCount ?? 8,
      upperBracketTeams: null, // Set by admin after group stage
      lowerBracketTeams: null,
      wildcardSpots: 0,
      thirdPlaceMatch: false,
      thirdPlaceFormat: 'bo3',
      semifinalFormat: structure.playoffSemifinalFormat || 'bo3',
      finalFormat: structure.playoffFinalFormat || 'bo3',
      grandFinalFormat: structure.playoffGrandFinalFormat || 'bo5',
    },
    
    theme: {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor || branding.primaryColor,
      backgroundColor: branding.backgroundColor || 'hsl(240 17% 6%)',
      backgroundGradient: `linear-gradient(135deg, ${branding.backgroundColor || 'hsl(240 17% 6%)'} 0%, hsl(240 15% 10%) 100%)`,
      cardColor: branding.cardColor || 'hsl(240 15% 10%)',
      textColor: branding.textColor || 'hsl(0 0% 100%)',
      mutedTextColor: 'hsl(240 8% 66%)',
      borderColor: branding.borderColor || 'hsl(240 16% 20%)',
      headerFont: `var(--font-${branding.headerFont})`,
      bodyFont: `var(--font-${branding.bodyFont})`,
      logoUrl: branding.logoUrl || null,
      faviconUrl: branding.faviconUrl || null,
      backgroundImageUrl: branding.backgroundImageUrl || null,
      // Extended theming
      backgroundOverlayColor: branding.backgroundOverlayColor || null,
      backgroundOverlayOpacity: branding.backgroundOverlayOpacity ?? 90,
      backgroundBlur: branding.backgroundBlur ?? 0,
      backgroundPosition: branding.backgroundPosition || 'center center',
      backgroundSize: branding.backgroundSize || 'cover',
      navbarStyle: branding.navbarStyle || 'blur',
      navbarColor: branding.navbarColor || null,
      cardOpacity: branding.cardOpacity ?? 100,
      cardBlur: branding.cardBlur ?? 0,
      cardBorderRadius: branding.cardBorderRadius || '0.75rem',
      glowColor: branding.glowColor || null,
      headingColor: branding.headingColor || null,
      themeStyle: branding.themeStyle || 'dark',
    },
    
    // Opaque token that lets the organizer preview a draft (and share it with
    // co-organizers) before the tournament is visible to the public.
    previewToken: generatePreviewToken(),

    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  // Add to Firestore
  const tournamentsRef = collection(db, 'tournaments');
  const docRef = await addDoc(tournamentsRef, tournamentConfig);

  // ── Post-create bootstrap ────────────────────────────────────────────────
  // Without these two writes the wizard produces a tournament its creator
  // cannot administer, whose standings pages render empty.
  //
  // Done as best-effort follow-ups rather than a transaction: if one fails the
  // tournament still exists and is repairable from the admin panel, which is a
  // better outcome than rolling back a tournament the user just filled in.

  // 1. The creator becomes the tournament's first admin.
  try {
    await setDoc(doc(db, 'tournaments', docRef.id, 'admins', organizerId), {
      role: 'owner',
      addedAt: serverTimestamp(),
      addedBy: organizerId,
    });
  } catch (err) {
    console.error('[createTournament] could not grant creator admin access:', err);
  }

  // 2. An initial group/division, so standings and schedule pages have somewhere
  //    to put teams instead of rendering empty.
  try {
    const initial = initialDivisionFor(type);
    await setDoc(doc(db, 'tournaments', docRef.id, 'divisions', initial.id), {
      name: initial.name,
      tier: 1,
      color: branding.primaryColor || '#6366f1',
      ...(isSwiss ? { isSwissField: true } : {}),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[createTournament] could not create the initial division:', err);
  }

  return docRef.id;
}

/** URL-safe random token for draft previews. */
function generatePreviewToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * The single group/division a brand-new tournament starts with.
 * Swiss uses one field for every team; the other modes start with one group the
 * admin renames or adds to.
 */
function initialDivisionFor(type: TournamentType): { id: string; name: string } {
  switch (type) {
    case 'swiss':    return { id: 'swiss', name: 'Swiss' };
    case 'league':   return { id: 'dywizja-1', name: 'Dywizja 1' };
    case 'mmr-limited':
    default:         return { id: 'grupa-a', name: 'Grupa A' };
  }
}

/**
 * Fetch single tournament config by slug
 * Used by TournamentContext to load tournament data
 */
export async function fetchTournamentBySlug(slug: string): Promise<TournamentConfig | null> {
  try {
    const tournamentsRef = collection(db, 'tournaments');
    const q = query(tournamentsRef, where('slug', '==', slug));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Return the full tournament config
    return {
      id: doc.id,
      ...data,
      // Ensure Timestamp objects are converted to strings
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    } as TournamentConfig;
  } catch (error) {
    console.error('Error fetching tournament by slug:', error);
    return null;
  }
}

/**
 * Fetch all tournaments
 * Used by landing page and tournament selector
 */
export async function fetchTournaments(): Promise<TournamentSummary[]> {
  try {
    const tournamentsRef = collection(db, 'tournaments');
    const snapshot = await getDocs(tournamentsRef);
    
    const tournaments: TournamentSummary[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      tournaments.push({
        id: doc.id,
        slug: data.slug,
        name: data.name,
        shortName: data.shortName,
        type: data.type,
        status: data.status,
        visibility: data.visibility,
        logoUrl: data.theme?.logoUrl || data.logoUrl || '',
        primaryColor: data.theme?.primaryColor || data.primaryColor || 'hsl(0, 0%, 50%)',
        startDate: data.dates?.tournamentStart || data.startDate || '',
        endDate: data.dates?.tournamentEnd || data.endDate,
        teamsCount: data.teams?.maxTeams || data.registration?.maxTeams || 0,
        organizerId: data.organizerId,
      });
    });
    
    return tournaments;
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return [];
  }
}

/**
 * Update tournament status
 * Used when organizer publishes from draft or changes status
 */
export async function updateTournamentStatus(
  tournamentId: string,
  status: 'draft' | 'registration' | 'active' | 'completed' | 'archived',
  visibility?: 'active' | 'inactive' | 'archived'
) {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  
  const updates: any = {
    status,
    updatedAt: serverTimestamp(),
  };
  
  if (visibility) {
    updates.visibility = visibility;
  }
  
  await updateDoc(tournamentRef, updates);
}

/**
 * Validate tournament slug is unique
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  try {
    // Reserved or malformed slugs are never available, regardless of whether
    // another tournament has taken them.
    if (validateSlug(slug)) {
      return false;
    }

    const tournamentsRef = collection(db, 'tournaments');
    const q = query(tournamentsRef, where('slug', '==', slug));
    const snapshot = await getDocs(q);

    return snapshot.empty;
  } catch (error) {
    console.error('Error checking slug availability:', error);
    return false;
  }
}

export interface SlugClaimResult {
  ok: boolean;
  /** Ready-to-display reason when `ok` is false. */
  message?: string;
}

/**
 * Full slug check for the wizard: shape, reserved words, uniqueness, and
 * namespace ownership for recurring tournaments (`pdl` owns `pdl-*`).
 *
 * One call so the wizard cannot check three of the four and let the fourth
 * through.
 */
export async function checkSlugClaim(
  slug: string,
  requesterId: string,
  opts: { isSuperAdmin?: boolean; excludeTournamentId?: string } = {}
): Promise<SlugClaimResult> {
  const problem = validateSlug(slug);
  if (problem) {
    return { ok: false, message: describeSlugProblem(problem, slug) };
  }

  try {
    const snapshot = await getDocs(collection(db, 'tournaments'));
    const existing: SlugOwner[] = snapshot.docs
      .filter(d => d.id !== opts.excludeTournamentId)
      .map(d => ({ slug: d.data().slug, organizerId: d.data().organizerId }))
      .filter(t => !!t.slug);

    if (existing.some(t => t.slug === slug)) {
      return { ok: false, message: `Adres "${slug}" jest już zajęty.` };
    }

    const verdict = checkNamespaceClaim(slug, requesterId, existing, {
      isSuperAdmin: opts.isSuperAdmin,
    });
    const reason = describeNamespaceVerdict(verdict);
    if (reason) return { ok: false, message: reason };

    return { ok: true };
  } catch (error) {
    console.error('Error checking slug claim:', error);
    // Fail closed: better to block creation than to hand out a slug that
    // collides with someone else's series.
    return { ok: false, message: 'Nie udało się sprawdzić dostępności adresu. Spróbuj ponownie.' };
  }
}

export interface OrganizerTournament {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  type?: TournamentType;
  status?: string;
  visibility?: string;
  logoUrl?: string;
  startDate?: string;
  organizerId?: string;
  redirectToSlug?: string | null;
  /** Number of registered teams, filled in lazily by the organizer page. */
  teamCount?: number;
}

/**
 * Every tournament an organizer owns, for the organizer dashboard.
 * Super admins see all of them, since they administer the whole platform.
 */
export async function fetchOrganizerTournaments(
  organizerId: string,
  opts: { isSuperAdmin?: boolean } = {}
): Promise<OrganizerTournament[]> {
  try {
    const snapshot = await getDocs(collection(db, 'tournaments'));
    return snapshot.docs
      .map(d => {
        const t = d.data();
        return {
          id: d.id,
          slug: t.slug,
          name: t.name ?? d.id,
          shortName: t.shortName,
          type: t.type,
          status: t.status,
          visibility: t.visibility,
          logoUrl: t.theme?.logoUrl ?? t.logoUrl,
          startDate: t.startDate,
          organizerId: t.organizerId,
          redirectToSlug: t.redirectToSlug ?? null,
        } as OrganizerTournament;
      })
      .filter(t => !!t.slug)
      .filter(t => opts.isSuperAdmin || t.organizerId === organizerId)
      .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '') || a.slug.localeCompare(b.slug));
  } catch (error) {
    console.error('Error fetching organizer tournaments:', error);
    return [];
  }
}

/** Point one tournament at another, or clear it by passing null. */
export async function setTournamentRedirect(
  tournamentId: string,
  redirectToSlug: string | null
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    redirectToSlug: redirectToSlug || null,
    updatedAt: serverTimestamp(),
  });
}

/** Slugs the given organizer already owns, for the redirect picker. */
export async function fetchOwnedSlugs(organizerId: string): Promise<string[]> {
  try {
    const snapshot = await getDocs(collection(db, 'tournaments'));
    return snapshot.docs
      .map(d => d.data())
      .filter(t => t.slug && t.organizerId === organizerId)
      .map(t => t.slug as string)
      .sort();
  } catch (error) {
    console.error('Error fetching owned slugs:', error);
    return [];
  }
}
