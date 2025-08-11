
// src/lib/team-actions.ts
"use server";
import { revalidatePath } from 'next/cache';
import { getAdminDb, ensureAdminInitialized, getAdminAuth } from '@/lib/admin';
import { Timestamp, getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getTeamById } from './firestore';
import { Team } from './definitions';

async function verifyUser(token: string) {
    if (!token) throw new Error('Authentication token not provided.');
    await ensureAdminInitialized();
    try {
        const decodedToken = await getAdminAuth().verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        throw new Error('Invalid or expired authentication token.');
    }
}

async function getMatchAndVerifyCaptain(matchId: string, uid: string) {
    const matchRef = getAdminDb().collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error('Match not found.');
    
    const match = matchSnap.data()!;
    const teamAId = match.teamA.id;
    const teamBId = match.teamB.id;

    const [teamASnap, teamBSnap] = await Promise.all([
        getAdminDb().collection('teams').doc(teamAId).get(),
        getAdminDb().collection('teams').doc(teamBId).get()
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
        const { matchRef, match, userTeamId } = await getMatchAndVerifyCaptain(matchId, decodedToken.uid);

        const deadline = (match.scheduled_for as Timestamp).toDate();
        if (proposedDate > deadline) {
            return { success: false, message: 'Proposed time cannot be after the deadline.' };
        }

        const serverTimestamp = Timestamp.fromDate(new Date(proposedDate));
        await matchRef.update({
            schedulingStatus: 'proposed',
            proposedTime: serverTimestamp,
            proposingCaptainId: decodedToken.uid,
            proposedById: userTeamId
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

        const deadline = (match.scheduled_for as Timestamp).toDate();
        const proposedTime = (match.proposedTime as Timestamp).toDate();
        if (proposedTime > deadline) {
            return { success: false, message: 'Cannot accept a time that is after the deadline.' };
        }

        await matchRef.update({
            schedulingStatus: 'confirmed',
            status: 'scheduled',
            dateTime: match.proposedTime,
            proposedTime: null,
            proposingCaptainId: null,
            proposedById: null
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
            status: 'pending',
            proposedTime: null,
            proposingCaptainId: null,
            proposedById: null
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
            status: 'pending',
            proposedTime: null,
            proposingCaptainId: null,
            proposedById: null
        });

        revalidatePath('/my-team');
        return { success: true, message: 'Your proposal has been cancelled.' };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}

export async function cancelStandinRequest(token: string, matchId: string, teamId: string) {
    try {
        const decodedToken = await verifyUser(token);
        
        const { matchRef, match } = await getMatchAndVerifyCaptain(matchId, decodedToken.uid);

        const db = getAdminDb();
        
        // Get match document reference and data
        const currentMatchData = match;
        
        // Remove standin information for this team from the match
        const updatedStandinInfo = { ...currentMatchData.standinInfo };
        if (updatedStandinInfo && updatedStandinInfo[teamId]) {
            delete updatedStandinInfo[teamId];
        }
        
        // If no teams have standin info, remove the entire field
        const hasStandinInfo = Object.keys(updatedStandinInfo).length > 0;
        
        if (hasStandinInfo) {
            await matchRef.update({ standinInfo: updatedStandinInfo });
        } else {
            await matchRef.update({ standinInfo: FieldValue.delete() });
        }
        
        // Find and delete all standin requests for this team and match
        const standinRequestsRef = db.collection('standinRequests');
        const query = standinRequestsRef
            .where('matchId', '==', matchId)
            .where('teamId', '==', teamId);
        
        const snapshot = await query.get();
        
        // Delete all matching standin request documents
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        if (!snapshot.empty) {
            await batch.commit();
        }
        
        const teamRef = db.collection('teams').doc(teamId);
        await teamRef.update({
            standinPlayerIds: FieldValue.delete()
        });

        revalidatePath('/my-team');
        return { success: true, message: 'Prośba o rezerwowego została anulowana. Twoi pierwotni gracze mogą teraz uczestniczyć.' };
    } catch (error) {
        console.error('Error in cancelStandinRequest:', error);
        return { success: false, message: (error as Error).message };
    }
}

export async function getUserTeam(userId: string): Promise<{ hasTeam: boolean; team?: Team | null; }> {
    await ensureAdminInitialized();
    const db = getAdminDb();
    const q = db.collection('teams').where('captainId', '==', userId);
    const querySnapshot = await q.get();
    if (querySnapshot.empty) return { hasTeam: false, team: null };
    
    // querySnapshot.docs[0].id is the team ID
    const team = await getTeamById(querySnapshot.docs[0].id);
    
    // No need to revalidate the path on a simple fetch action.
    // revalidatePath('/my-team');
    
    return { hasTeam: true, team };
}
