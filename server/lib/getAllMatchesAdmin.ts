import { getAdminDb } from './admin';
import type { Match } from '../../src/lib/definitions';

function toISOStringIfTimestamp(val: any): any {
  if (val && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  return val;
}

export async function getAllMatchesAdmin(): Promise<Match[]> {
  const db = getAdminDb();
  const matchesCollection = db.collection('matches');
  const snapshot = await matchesCollection.get();
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      scheduledFor: toISOStringIfTimestamp(data.scheduledFor || data.scheduled_for),
      proposedTime: toISOStringIfTimestamp(data.proposedTime),
      completed_at: toISOStringIfTimestamp(data.completed_at),
    } as unknown as Match;
  });
}
