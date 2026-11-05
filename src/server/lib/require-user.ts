// Access check for signed-in user APIs: a verified Firebase ID token (Authorization: Bearer …).
// The token is checked, never just its presence.

import { NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminAuth } from './admin';

export interface UserCaller { uid: string; name?: string; picture?: string }

/**
 * The caller, or the 401 response to send back.
 * Usage: `const user = await requireUser(req); if (user instanceof NextResponse) return user;`
 */
export async function requireUser(req: Request): Promise<UserCaller | NextResponse> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 });
  ensureAdminInitialized();
  try {
    const t = await getAdminAuth().verifyIdToken(token);
    return { uid: t.uid, name: t.name, picture: t.picture };
  } catch {
    return NextResponse.json({ error: 'Sesja wygasła: zaloguj się ponownie.' }, { status: 401 });
  }
}
