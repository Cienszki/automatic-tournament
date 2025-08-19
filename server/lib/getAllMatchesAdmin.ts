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
      scheduled_for: toISOStringIfTimestamp(data.scheduled_for),
      defaultMatchTime: toISOStringIfTimestamp(data.defaultMatchTime),
      dateTime: toISOStringIfTimestamp(data.dateTime),
      proposedTime: toISOStringIfTimestamp(data.proposedTime),
      completed_at: toISOStringIfTimestamp(data.completed_at),
    } as Match;
  });
}
