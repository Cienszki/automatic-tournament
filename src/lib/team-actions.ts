// src/lib/team-actions.ts
"use server";
import { revalidatePath } from 'next/cache';
import { adminDb, ensureAdminInitialized } from '@/lib/admin';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';

async function verifyUser(token: string) {
    if (!token) throw new Error('Authentication token not provided.');
    await ensureAdminInitialized();
    try {
        const decodedToken = await getAuth(adminDb.app).verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        throw new Error('Invalid or expired authentication token.');
    }
}

async function getMatchAndVerifyCaptain(matchId: string, uid: string) {
    const matchRef = adminDb.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error('Match not found.');
    
    const match = matchSnap.data()!;
    const teamAId = match.teamA.id;
    const teamBId = match.teamB.id;

    const [teamASnap, teamBSnap] = await Promise.all([
        adminDb.collection('teams').doc(teamAId).get(),
        adminDb.collection('teams').doc(teamBId).get()
    ]);

    const teamACaptain = teamASnap.data()?.captainId;
    const teamBCaptain = teamBSnap.data()?.captainId;

    if (uid !== teamACaptain && uid !== teamBCaptain) {
        throw new Error('You are not a captain of any team in this match.');
    }
    
    const userTeamId = uid === teamACaptain ? teamAId : teamBId;
    return { matchRef, match, userTeamId };
}

export async function proposeMatchTime(token: string, matchId: string, proposedDate: Date) {
    try {
        const decodedToken = await verifyUser(token);
        const { matchRef, userTeamId } = await getMatchAndVerifyCaptain(matchId, decodedToken.uid);

        // Convert the client-side Date object to a server-side Firestore Timestamp.
        const serverTimestamp = Timestamp.fromDate(new Date(proposedDate));

        await matchRef.update({
            schedulingStatus: 'proposed',
            proposedTime: serverTimestamp, // Use the server-side timestamp here.
            proposingCaptainId: decodedToken.uid
        });

        revalidatePath('/my-team');
        return { success: true, message: 'Time proposal sent successfully.' };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}

export async function acceptMatchTime(token: string, matchId: string) {
    try {
        const decodedToken = await verifyUser(token);
        const { matchRef, match } = await getMatchAndVerifyCaptain(matchId, decodedToken.uid);

        if (match.schedulingStatus !== 'proposed' || !match.proposedTime) {
            throw new Error('There is no active proposal to accept.');
        }

        if (match.proposingCaptainId === decodedToken.uid) {
            throw new Error('You cannot accept your own proposal.');
        }

        await matchRef.update({
            schedulingStatus: 'confirmed',
            dateTime: match.proposedTime, // The proposed time is already a server timestamp.
            proposedTime: null,
            proposingCaptainId: null
        });

        revalidatePath('/my-team');
        return { success: true, message: 'Match time confirmed!' };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}

export async function rejectMatchTime(token: string, matchId: string) {
    try {
        const decodedToken = await verifyUser(token);
        const { matchRef, match } = await getMatchAndVerifyCaptain(matchId, decodedToken.uid);

        if (match.proposingCaptainId === decodedToken.uid) {
            throw new Error('You cannot reject your own proposal. Please cancel it instead.');
        }

        await matchRef.update({
            schedulingStatus: 'unscheduled',
            proposedTime: null,
            proposingCaptainId: null
        });

        revalidatePath('/my-team');
        return { success: true, message: 'Proposal rejected. You can now suggest a new time.' };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}

export async function cancelProposal(token: string, matchId: string) {
    try {
        const decodedToken = await verifyUser(token);
        const { matchRef, match } = await getMatchAndVerifyCaptain(matchId, decodedToken.uid);

        if (match.proposingCaptainId !== decodedToken.uid) {
            throw new Error('You can only cancel your own proposals.');
        }

        await matchRef.update({
            schedulingStatus: 'unscheduled',
            proposedTime: null,
            proposingCaptainId: null
        });

        revalidatePath('/my-team');
        return { success: true, message: 'Your proposal has been cancelled.' };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}
