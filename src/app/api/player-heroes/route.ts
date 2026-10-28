import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '@/lib/admin';
import { checkRateLimit, LIMIT_ADMIN_SYNC } from '@/lib/rate-limit';
import { requireAdmin } from '@/server/lib/require-admin';

interface OpenDotaHeroStat {
  hero_id: string;
  last_played: number;
  games: number;
  win: number;
  with_games: number;
  with_win: number;
  against_games: number;
  against_win: number;
}

interface MostPlayedHero {
  heroId: number;
  games: number;
  win: number;
}

interface MostPlayedHeroes {
  overall: MostPlayedHero[];
  recent: MostPlayedHero[];
  lastUpdated: string;
}

const OD_KEY = process.env.OPENDOTA_API_KEY;
const odHeroes = (accountId: string, query = '') =>
  fetch(`https://api.opendota.com/api/players/${accountId}/heroes${query}${OD_KEY ? `${query ? '&' : '?'}api_key=${OD_KEY}` : ''}`, { cache: 'no-store' });
/** Pause between players: the free tier allows about 1 request a second, our key much more */
const PLAYER_DELAY_MS = OD_KEY ? 300 : 2100;

async function fetchMostPlayedHeroes(accountId: string): Promise<MostPlayedHeroes> {
  const [overallRes, recentRes] = await Promise.all([odHeroes(accountId), odHeroes(accountId, '?date=180')]);

  if (!overallRes.ok) throw new Error(`OpenDota API error: ${overallRes.status}`);
  if (!recentRes.ok) throw new Error(`OpenDota API error (recent): ${recentRes.status}`);

  const overallData: OpenDotaHeroStat[] = await overallRes.json();
  const recentData: OpenDotaHeroStat[] = await recentRes.json();

  const top5Overall = overallData
    .sort((a, b) => b.games - a.games)
    .slice(0, 5)
    .filter(h => h.games > 0)
    .map(h => ({ heroId: parseInt(h.hero_id), games: h.games, win: h.win }));

  const top5Recent = recentData
    .sort((a, b) => b.games - a.games)
    .slice(0, 5)
    .filter(h => h.games > 0)
    .map(h => ({ heroId: parseInt(h.hero_id), games: h.games, win: h.win }));

  return {
    overall: top5Overall,
    recent: top5Recent,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * POST /api/player-heroes
 *
 * Body options:
 *   { accountId: string }                        — Fetch heroes for a single player (returns data)
 *   { tournamentId: string, refreshAll: true }    — Refresh heroes for all players in a tournament
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Single player fetch (used during registration / transfer) ──
    if (body.accountId && !body.refreshAll) {
      const accountId = String(body.accountId);
      if (!/^\d+$/.test(accountId)) {
        return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
      }
      const data = await fetchMostPlayedHeroes(accountId);
      return NextResponse.json({ success: true, data });
    }

    // ── Refresh all players in tournament (admin action) ──
    if (body.tournamentId && body.refreshAll) {
      const caller = await requireAdmin(request, String(body.tournamentId));
      if (caller instanceof NextResponse) return caller;

      const rateLimitRes = checkRateLimit(request, 'player-heroes-refresh', LIMIT_ADMIN_SYNC);
      if (rateLimitRes) return rateLimitRes;

      ensureAdminInitialized();
      const db = getAdminDb();
      const tournamentId = String(body.tournamentId);

      // Read all teams in tournament
      const teamsSnap = await db.collection('tournaments').doc(tournamentId).collection('teams').get();

      let updatedCount = 0;
      let errorCount = 0;
      let keptCount = 0;

      for (const teamDoc of teamsSnap.docs) {
        const teamData = teamDoc.data();
        const roster = teamData.roster as Record<string, { steamId32?: string; [k: string]: unknown }> | undefined;
        if (!roster) continue;

        let rosterChanged = false;
        const updatedRoster = { ...roster };

        for (const [steamId64, playerInfo] of Object.entries(roster)) {
          const accountId = playerInfo.steamId32 || (() => {
            try { return String(BigInt(steamId64) - 76561197960265728n); } catch { return ''; }
          })();
          if (!accountId) continue;

          try {
            // Delay between players to respect OpenDota rate limits
            if (updatedCount > 0) await new Promise(r => setTimeout(r, PLAYER_DELAY_MS));

            const heroData = await fetchMostPlayedHeroes(accountId);
            // Never replace heroes we have with nothing: OpenDota shows nothing once a player turns
            // their match data private, and the old list is still the best we know
            const prev = (playerInfo as { mostPlayedHeroes?: MostPlayedHeroes }).mostPlayedHeroes;
            if (!heroData.overall.length && prev?.overall?.length) { keptCount++; continue; }
            updatedRoster[steamId64] = { ...updatedRoster[steamId64], mostPlayedHeroes: heroData };
            rosterChanged = true;
            updatedCount++;
          } catch (err) {
            console.warn(`Failed to fetch heroes for ${steamId64}:`, err);
            errorCount++;
          }
        }

        if (rosterChanged) {
          await teamDoc.ref.update({ roster: updatedRoster });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Updated heroes for ${updatedCount} players (${errorCount} errors, ${keptCount} kept: OpenDota shows nothing for them now)`,
        updatedCount,
        errorCount,
        keptCount,
      });
    }

    return NextResponse.json({ error: 'Provide accountId or tournamentId+refreshAll' }, { status: 400 });

  } catch (error) {
    console.error('Error in /api/player-heroes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
