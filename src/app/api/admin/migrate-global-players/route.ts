/**
 * Admin API: Migrate all existing players from team subcollections
 * into the global `/players/{steamId64}` collection.
 *
 * Safe to run multiple times — uses set-with-merge and won't overwrite
 * existing profiles' `createdAt`.
 *
 * GET  → dry run (reports what would be migrated)
 * POST → execute migration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';

interface PlayerCandidate {
  source: string; // e.g. "tournaments/pdl-s1/teams/abc123/players/xyz"
  steamId: string;
  steamId32: string;
  nickname: string;
  steamProfileUrl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
}

async function collectAllPlayers(): Promise<{
  candidates: PlayerCandidate[];
  errors: string[];
}> {
  const db = getAdminDb();
  const candidates: PlayerCandidate[] = [];
  const errors: string[] = [];
  const seenSteamIds = new Set<string>();

  // Helper: normalise a player document into a candidate
  const processPlayer = (
    data: Record<string, unknown>,
    docId: string,
    source: string
  ) => {
    // Resolve steamId64 from various field names
    let steamId = '';
    const steamIdField = data.steamId || data.steamId64 || '';
    if (typeof steamIdField === 'string' && steamIdField.length > 10) {
      steamId = steamIdField;
    }

    // Resolve steamId32
    let steamId32 = (data.steamId32 as string) || '';
    if (!steamId32 && steamId) {
      try {
        steamId32 = String(BigInt(steamId) - 76561197960265728n);
      } catch { /* ignore */ }
    }
    if (!steamId32 && data.openDotaAccountId) {
      steamId32 = String(data.openDotaAccountId);
    }

    // If no steamId64 but we have steamId32, derive it
    if (!steamId && steamId32) {
      try {
        steamId = String(BigInt(steamId32) + 76561197960265728n);
      } catch { /* ignore */ }
    }

    if (!steamId) {
      errors.push(`[skip] ${source}/${docId} — no steamId found (nickname: ${data.nickname})`);
      return;
    }

    // Skip coach entries
    if (docId === 'coach' || data.isCoach === true || data.role === 'Coach') {
      return;
    }

    if (seenSteamIds.has(steamId)) {
      // Already seen — update nickname if this one is newer
      return;
    }
    seenSteamIds.add(steamId);

    candidates.push({
      source: `${source}/${docId}`,
      steamId,
      steamId32,
      nickname: (data.nickname as string) || 'Unknown',
      steamProfileUrl: (data.steamProfileUrl as string) || `https://steamcommunity.com/profiles/${steamId}`,
      avatar: (data.avatar as string) || '',
      avatarmedium: (data.avatarmedium as string) || '',
      avatarfull: (data.avatarfull as string) || '',
    });
  };

  // 1. Scan tournament-scoped teams
  const tournamentsSnap = await db.collection('tournaments').get();
  for (const tournamentDoc of tournamentsSnap.docs) {
    const tId = tournamentDoc.id;
    const teamsSnap = await db
      .collection('tournaments').doc(tId)
      .collection('teams').get();

    for (const teamDoc of teamsSnap.docs) {
      const playersSnap = await db
        .collection('tournaments').doc(tId)
        .collection('teams').doc(teamDoc.id)
        .collection('players').get();

      for (const playerDoc of playersSnap.docs) {
        processPlayer(
          playerDoc.data() as Record<string, unknown>,
          playerDoc.id,
          `tournaments/${tId}/teams/${teamDoc.id}/players`
        );
      }
    }
  }

  // 2. Scan legacy root teams
  const legacyTeamsSnap = await db.collection('teams').get();
  for (const teamDoc of legacyTeamsSnap.docs) {
    const playersSnap = await db
      .collection('teams').doc(teamDoc.id)
      .collection('players').get();

    for (const playerDoc of playersSnap.docs) {
      processPlayer(
        playerDoc.data() as Record<string, unknown>,
        playerDoc.id,
        `teams/${teamDoc.id}/players`
      );
    }
  }

  // 3. Scan standin requests for players who were standins
  const standinRequestCollections = [
    db.collectionGroup('standinRequests'),
  ];

  for (const colRef of standinRequestCollections) {
    try {
      const snap = await colRef.get();
      for (const reqDoc of snap.docs) {
        const data = reqDoc.data();
        if (data.standinSteamProfileUrl && data.standinNickname) {
          // Try to resolve Steam ID from URL
          try {
            const { extractSteamIdFromUrl } = await import('@/lib/steam-id-utils');
            const { steamId64, steamId32 } = await extractSteamIdFromUrl(data.standinSteamProfileUrl);
            if (steamId64 && !seenSteamIds.has(steamId64)) {
              seenSteamIds.add(steamId64);
              candidates.push({
                source: `standinRequests/${reqDoc.id}`,
                steamId: steamId64,
                steamId32,
                nickname: data.standinNickname,
                steamProfileUrl: data.standinSteamProfileUrl,
                avatar: '',
                avatarmedium: '',
                avatarfull: '',
              });
            }
          } catch (e) {
            errors.push(`[skip standin] ${reqDoc.id} — could not resolve steam URL: ${data.standinSteamProfileUrl}`);
          }
        }
      }
    } catch (e) {
      errors.push(`[warn] Could not scan standinRequests collectionGroup: ${(e as Error).message}`);
    }
  }

  return { candidates, errors };
}

export async function GET() {
  try {
    ensureAdminInitialized();
    const { candidates, errors } = await collectAllPlayers();

    return NextResponse.json({
      success: true,
      mode: 'dry_run',
      totalCandidates: candidates.length,
      errors,
      candidates: candidates.map(c => ({
        steamId: c.steamId,
        nickname: c.nickname,
        source: c.source,
        hasAvatar: !!c.avatarmedium,
      })),
    });
  } catch (error) {
    console.error('Migration dry run failed:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    const { candidates, errors } = await collectAllPlayers();

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No players found to migrate',
        errors,
      });
    }

    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;

    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 450;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const chunk = candidates.slice(i, i + batchSize);
      const batch = db.batch();

      for (const candidate of chunk) {
        const docRef = db.collection('players').doc(candidate.steamId);
        const existing = await docRef.get();

        if (existing.exists) {
          // Update with latest data but don't overwrite createdAt
          batch.update(docRef, {
            nickname: candidate.nickname,
            steamProfileUrl: candidate.steamProfileUrl,
            avatar: candidate.avatar || existing.data()?.avatar || '',
            avatarmedium: candidate.avatarmedium || existing.data()?.avatarmedium || '',
            avatarfull: candidate.avatarfull || existing.data()?.avatarfull || '',
            updatedAt: now,
          });
          updated++;
        } else {
          batch.set(docRef, {
            steamId: candidate.steamId,
            steamId32: candidate.steamId32,
            nickname: candidate.nickname,
            steamProfileUrl: candidate.steamProfileUrl,
            avatar: candidate.avatar,
            avatarmedium: candidate.avatarmedium,
            avatarfull: candidate.avatarfull,
            createdAt: now,
            updatedAt: now,
          });
          created++;
        }
      }

      await batch.commit();
      console.log(`[migration] Committed batch ${Math.floor(i / batchSize) + 1}: ${chunk.length} documents`);
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete. Created: ${created}, Updated: ${updated}`,
      totalCandidates: candidates.length,
      created,
      updated,
      errors,
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
