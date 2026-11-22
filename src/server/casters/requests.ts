// Caster requests: anyone signed in can ask to cast a tournament (one click on the account page).
// The request lands in tournaments/{id}/casterRequests/{uid} (written only here) and in the inbox
// of the tournament's admins; an admin accepts it (→ addCaster, which tells the new caster) or
// declines it (the person hears it, and may ask again after a week).

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { notify, tournamentInfo } from '@/server/notify/notify';
import { addCaster, isCaster, profile, type CasterDoc } from './casters';

const db = () => { ensureAdminInitialized(); return getAdminDb(); };
const requests = (t: string) => db().collection('tournaments').doc(t).collection('casterRequests');

/** After a declined request, how long until the person may ask again */
const RETRY_MS = 7 * 86400_000;

export type RequestState = 'pending' | 'declined' | null;
export interface CasterRequest extends CasterDoc { at: string }

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : new Date(0).toISOString());

/** The signed-in person's request for this tournament, as the account page shows it */
export async function requestState(t: string, uid: string): Promise<RequestState> {
  const d = (await requests(t).doc(uid).get()).data();
  if (!d) return null;
  if (d.status === 'pending') return 'pending';
  if (d.status === 'declined' && Date.now() - Date.parse(iso(d.decidedAt)) < RETRY_MS) return 'declined';
  return null;
}

/** Tournament admins and super admins: who hears about a new request */
async function adminUids(t: string): Promise<string[]> {
  const [own, supers] = await Promise.all([
    db().collection('tournaments').doc(t).collection('admins').get(),
    db().collection('admins').get(),
  ]);
  return [...new Set([...own.docs, ...supers.docs].map(d => d.id))];
}

export async function sendRequest(t: string, uid: string): Promise<{ state: RequestState } | { error: string }> {
  if (await isCaster(t, uid)) return { error: 'Już jesteś casterem tego turnieju.' };
  const state = await requestState(t, uid);
  if (state === 'pending') return { state };
  if (state === 'declined') return { error: 'Organizatorzy niedawno odrzucili zgłoszenie. Spróbuj ponownie za kilka dni.' };
  const [p, info] = await Promise.all([profile(uid), tournamentInfo(t)]);
  if (!info) return { error: 'Nie ma takiego turnieju.' };
  const at = new Date().toISOString();
  await requests(t).doc(uid).set({ ...p, status: 'pending', at, decidedAt: null, decidedBy: null });
  await notify(await adminUids(t), {
    type: 'caster', key: `caster-request:${t}:${uid}:${at}`, tournament: info, href: `/${info.slug}/admin`,
    title: `${p.name} chce castować ${info.name}`,
    body: [p.stream && `Transmisja: ${p.stream}`, p.discord && `Discord: @${p.discord}`, 'Zgłoszenie czeka w panelu admina, w karcie Casterzy.'].filter(Boolean).join('\n'),
  });
  return { state: 'pending' };
}

/** Pending requests, oldest first, with the person's card as it is now */
export async function pendingRequests(t: string): Promise<CasterRequest[]> {
  const s = await requests(t).where('status', '==', 'pending').get();
  const list = await Promise.all(s.docs.map(async d => ({ ...await profile(d.id), at: iso(d.data().at) })));
  return list.sort((a, b) => a.at.localeCompare(b.at));
}

export async function acceptRequest(t: string, uid: string, by: string) {
  await addCaster(t, uid, by);
  await requests(t).doc(uid).delete();
}

export async function declineRequest(t: string, uid: string, by: string) {
  const ref = requests(t).doc(uid);
  if ((await ref.get()).data()?.status !== 'pending') return;
  await ref.update({ status: 'declined', decidedAt: FieldValue.serverTimestamp(), decidedBy: by });
  const info = await tournamentInfo(t);
  if (info) {
    await notify([uid], {
      type: 'caster', key: `caster-request-declined:${t}:${uid}:${Date.now()}`, tournament: info, href: `/${info.slug}/account`,
      title: 'Zgłoszenie na castera nie zostało przyjęte',
      body: `Organizatorzy ${info.name} nie dodali cię tym razem do casterów. Możesz zgłosić się ponownie za tydzień.`,
    });
  }
}
