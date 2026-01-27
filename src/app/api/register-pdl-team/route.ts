// src/app/api/register-pdl-team/route.ts
import { NextResponse } from 'next/server';
import { registerPDLTeam, PDLTeamRegistrationData } from '@/lib/pdl-registration-actions';
import { getAdminAuth, ensureAdminInitialized } from '@/server/lib/admin';

/**
 * POST /api/register-pdl-team
 * 
 * Register a new PDL team (tournament-scoped, no MMR requirements)
 * 
 * Request body:
 * {
 *   "tournamentId": "pdl-s1",
 *   "name": "Team Name",
 *   "tag": "TAG",
 *   "discordUsername": "captain_discord",
 *   "motto": "We are the best!",
 *   "logoUrl": "https://storage.../logo.png",
 *   "captainId": "firebase_uid",
 *   "players": [...],
 *   "coach": {...}
 * }
 */
export async function POST(req: Request) {
    try {
        // Verify authentication
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized: Missing authentication token' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];
        let authenticatedUserId: string;

        try {
            ensureAdminInitialized();
            const decodedToken = await getAdminAuth().verifyIdToken(token);
            authenticatedUserId = decodedToken.uid;
        } catch (authError) {
            console.error('[API] Token verification failed:', authError);
            return NextResponse.json(
                { success: false, message: 'Unauthorized: Invalid authentication token' },
                { status: 401 }
            );
        }

        const body = await req.json();

        // Security check: Ensure the captainId matches the authenticated user
        if (body.captainId !== authenticatedUserId) {
            console.error(`[API] Security violation: User ${authenticatedUserId} tried to register team with captainId ${body.captainId}`);
            return NextResponse.json(
                { success: false, message: 'Unauthorized: You can only register a team for yourself' },
                { status: 403 }
            );
        }

        // Extract tournament ID (default to pdl-s1)
        const tournamentId = body.tournamentId || 'pdl-s1';

        // Prepare registration data
        const teamData: PDLTeamRegistrationData = {
            name: body.name,
            tag: body.tag,
            discordUsername: body.discordUsername,
            motto: body.motto,
            logoUrl: body.logoUrl,
            captainId: body.captainId,
            players: body.players,
            coach: body.coach,
        };

        // Validate required fields
        if (!teamData.name || !teamData.tag || !teamData.captainId || !teamData.logoUrl) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Missing required fields',
                },
                { status: 400 }
            );
        }

        // Call registration function
        const result = await registerPDLTeam(tournamentId, teamData);

        // Return result
        if (result.success) {
            return NextResponse.json(result, { status: 200 });
        } else {
            return NextResponse.json(result, { status: 400 });
        }

    } catch (error: any) {
        console.error('[API] PDL registration error:', error);
        return NextResponse.json(
            {
                success: false,
                message: error?.message || 'Registration failed',
            },
            { status: 500 }
        );
    }
}
