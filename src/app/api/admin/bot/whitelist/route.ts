// src/app/api/admin/bot/whitelist/route.ts
// API routes for managing the per-tournament lobby whitelist.
//
// The whitelist lets tournament admins grant specific Steam accounts
// (commentators, observers, super-admins) permanent access to every
// bot-managed lobby without being auto-kicked.
//
// Firestore path:
//   /tournaments/{tournamentId}/config/bot  →  field: whitelist[]

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/server/lib/admin';
import { getSteam64IdFromUrl, getSteamPlayerSummary } from '@/lib/server-utils';
import { steam64ToSteam32 } from '@/lib/steam-id-utils';
import type { LobbyWhitelistEntry } from '@/types/lobby-bot';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

function botConfigRef(tournamentId: string) {
  return getAdminDb()
    .collection('tournaments')
    .doc(tournamentId)
    .collection('config')
    .doc('bot');
}

// ─── GET /api/admin/bot/whitelist?tournamentId=xxx ───────────────────────────

/**
 * Returns the current whitelist for a tournament.
 */
export async function GET(req: Request): Promise<Response> {
  const uid = await verifyAuth(req);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get('tournamentId');
  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  try {
    const doc = await botConfigRef(tournamentId).get();
    const whitelist: LobbyWhitelistEntry[] = doc.exists
      ? ((doc.data()?.whitelist as LobbyWhitelistEntry[]) ?? [])
      : [];

    return NextResponse.json({ whitelist });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Whitelist GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST /api/admin/bot/whitelist ───────────────────────────────────────────

/**
 * Add a Steam profile to the whitelist.
 * Body: { tournamentId: string, steamProfileUrl: string, note?: string }
 *
 * The Steam URL is resolved via the Steam Web API to get the canonical
 * Steam64 ID, Steam32 ID, persona name, and avatar.
 */
export async function POST(req: Request): Promise<Response> {
  const uid = await verifyAuth(req);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { tournamentId: string; steamProfileUrl: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tournamentId, steamProfileUrl, note } = body;

  if (!tournamentId?.trim()) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }
  if (!steamProfileUrl?.trim()) {
    return NextResponse.json({ error: 'steamProfileUrl is required' }, { status: 400 });
  }

  // Basic validation: must be a Steam community URL
  if (!steamProfileUrl.includes('steamcommunity.com')) {
    return NextResponse.json(
      { error: 'Invalid Steam profile URL — must be a steamcommunity.com link' },
      { status: 400 }
    );
  }

  try {
    // Resolve Steam URL → Steam64 ID via Steam Web API
    const steamId64 = await getSteam64IdFromUrl(steamProfileUrl.trim());
    const steamId32 = steam64ToSteam32(steamId64);

    // Fetch persona name and avatar
    const profile = await getSteamPlayerSummary(steamId64);
    const displayName: string = profile.personaname ?? `Steam:${steamId32}`;
    const avatarUrl: string | undefined = profile.avatarfull ?? profile.avatar ?? undefined;

    // Check for duplicate
    const ref = botConfigRef(tournamentId);
    const doc = await ref.get();
    const existingWhitelist: LobbyWhitelistEntry[] = doc.exists
      ? ((doc.data()?.whitelist as LobbyWhitelistEntry[]) ?? [])
      : [];

    if (existingWhitelist.some((e) => e.steamId32 === steamId32)) {
      return NextResponse.json(
        { error: `${displayName} is already on the whitelist` },
        { status: 409 }
      );
    }

    const newEntry: LobbyWhitelistEntry = {
      steamId32,
      steamId64,
      displayName,
      avatarUrl,
      note: note?.trim() || undefined,
      addedAt: new Date().toISOString(),
      addedBy: uid,
    };

    await ref.set(
      { whitelist: [...existingWhitelist, newEntry] },
      { merge: true }
    );

    return NextResponse.json({ entry: newEntry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Whitelist POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE /api/admin/bot/whitelist ─────────────────────────────────────────

/**
 * Remove a Steam account from the whitelist.
 * Body: { tournamentId: string, steamId32: string }
 */
export async function DELETE(req: Request): Promise<Response> {
  const uid = await verifyAuth(req);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { tournamentId: string; steamId32: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tournamentId, steamId32 } = body;

  if (!tournamentId?.trim() || !steamId32?.trim()) {
    return NextResponse.json(
      { error: 'tournamentId and steamId32 are required' },
      { status: 400 }
    );
  }

  try {
    const ref = botConfigRef(tournamentId);
    const doc = await ref.get();
    const existing: LobbyWhitelistEntry[] = doc.exists
      ? ((doc.data()?.whitelist as LobbyWhitelistEntry[]) ?? [])
      : [];

    const updated = existing.filter((e) => e.steamId32 !== steamId32);

    if (updated.length === existing.length) {
      return NextResponse.json(
        { error: 'Entry not found in whitelist' },
        { status: 404 }
      );
    }

    await ref.set({ whitelist: updated }, { merge: true });

    return NextResponse.json({ removed: steamId32 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Whitelist DELETE error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
