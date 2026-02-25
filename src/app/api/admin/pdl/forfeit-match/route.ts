// src/app/api/admin/pdl/forfeit-match/route.ts
import { NextResponse } from 'next/server';
import { forfeitPDLMatchAdmin } from '@/lib/pdl-admin-actions';

/**
 * POST /api/admin/pdl/forfeit-match
 *
 * Record a forfeit (walkover) for a PDL match.
 *
 * Body:
 * {
 *   tournamentId:        string,
 *   matchId:             string,
 *   forfeitingTeam:      'teamA' | 'teamB',
 *   forfeitedGameNumbers: number[],  // [] = full series walkover; [1]/[2]/[1,2] = game-level
 *   reason:              string,     // optional admin note
 *   adminUserId:         string
 * }
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const {
            tournamentId,
            matchId,
            forfeitingTeam,
            forfeitedGameNumbers,
            reason = '',
            adminUserId = 'admin',
        } = body;

        if (!tournamentId || !matchId || !forfeitingTeam) {
            return NextResponse.json(
                { success: false, error: 'tournamentId, matchId and forfeitingTeam are required' },
                { status: 400 },
            );
        }

        if (forfeitingTeam !== 'teamA' && forfeitingTeam !== 'teamB') {
            return NextResponse.json(
                { success: false, error: 'forfeitingTeam must be "teamA" or "teamB"' },
                { status: 400 },
            );
        }

        const gameNumbers: number[] = Array.isArray(forfeitedGameNumbers)
            ? forfeitedGameNumbers.map(Number).filter(n => !isNaN(n))
            : [];

        const result = await forfeitPDLMatchAdmin(
            tournamentId,
            matchId,
            forfeitingTeam as 'teamA' | 'teamB',
            gameNumbers,
            reason,
            adminUserId,
        );

        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Forfeit failed';
        console.error('[API] forfeit-match error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
