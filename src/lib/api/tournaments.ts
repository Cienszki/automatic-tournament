// src/lib/api/tournaments.ts
// API functions for tournament CRUD operations

import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TournamentConfig, TournamentSummary } from '@/types/tournament';

/**
 * Create a new tournament
 * Returns the tournament ID
 */
export async function createTournament(data: {
  basicInfo: any;
  branding: any;
  structure: any;
  template: string;
}): Promise<string> {
  const { basicInfo, branding, structure, template } = data;
  const isMmrLimited = structure.type === 'mmr-limited';

  // Build tournament configuration
  const tournamentConfig: Record<string, any> = {
    slug: basicInfo.slug,
    name: basicInfo.name,
    shortName: basicInfo.shortName,
    description: basicInfo.description,
    organizerId: 'pd2ih', // TODO: Get from current user
    
    type: structure.type,
    status: 'draft',
    visibility: 'inactive',
    
    startDate: basicInfo.tournamentStart || null,
    endDate: basicInfo.tournamentEnd || null,
    
    leagueId: null,
    
    registration: {
      enabled: true,
      startDate: basicInfo.registrationStart,
      endDate: basicInfo.registrationEnd,
      requireApproval: false,
      maxTeams: structure.maxTeams ?? null,
    },
    
    // Team configuration
    teamSize: 5,
    mmrCap: isMmrLimited ? (structure.mmrCap || 24000) : null,
    mmrVerificationRequired: isMmrLimited,
    coachMode: isMmrLimited ? 'disabled' : 'per-game',
    
    // Match configuration
    defaultMatchFormat: isMmrLimited ? (structure.groupMatchFormat || 'bo2') : 'bo2',
    schedulingMethod: isMmrLimited ? 'captain-scheduled' : 'admin-scheduled',
    
    // Group stage configuration (MMR tournaments)
    ...(isMmrLimited ? {
      groupMatchFormat: structure.groupMatchFormat || 'bo2',
    } : {}),

    // Division configuration (league tournaments)
    ...(!isMmrLimited ? {
      promotionRelegationEnabled: true,
      roundsPerSeason: 2,
    } : {}),
    
    fantasy: {
      enabled: structure.enableFantasy,
      type: isMmrLimited ? 'round-based' : 'season-long',
      rosterSize: 5,
      budget: isMmrLimited ? (structure.mmrCap || 24000) : 100,
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
      enabled: structure.enablePickem,
      matchPredictions: true,
      standingsPredictions: true,
      playoffBracket: true,
      mvpPredictions: false,
      lockTime: isMmrLimited ? 'before-round' : 'before-season',
    },
    
    standins: {
      enabled: structure.enableStandins,
      requireRegistration: isMmrLimited,
      requireOpponentApproval: !isMmrLimited,
      adminCanOverride: true,
      maxPerMatch: 1,
      maxPerRound: 1,
      mmrRestrictions: isMmrLimited,
    },
    
    playoffs: {
      enabled: true,
      format: structure.playoffFormat || 'double-elimination',
      teamsCount: structure.teamsCount || 8,
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
    
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  // Add to Firestore
  const tournamentsRef = collection(db, 'tournaments');
  const docRef = await addDoc(tournamentsRef, tournamentConfig);

  return docRef.id;
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
    const tournamentsRef = collection(db, 'tournaments');
    const q = query(tournamentsRef, where('slug', '==', slug));
    const snapshot = await getDocs(q);
    
    return snapshot.empty;
  } catch (error) {
    console.error('Error checking slug availability:', error);
    return false;
  }
}
