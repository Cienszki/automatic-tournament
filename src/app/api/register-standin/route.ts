import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '@/lib/admin';
import { checkRateLimit, LIMIT_REGISTRATION } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rateLimitRes = checkRateLimit(req, 'register-standin', LIMIT_REGISTRATION);
  if (rateLimitRes) return rateLimitRes;

  // Require authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let authenticatedUid: string;
  try {
    ensureAdminInitialized();
    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    authenticatedUid = decodedToken.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const data = await req.json();
    const { userId } = data;
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    // Enforce that callers can only register themselves as a standin
    if (userId !== authenticatedUid) {
      return NextResponse.json({ error: 'Forbidden: You can only register yourself as a standin' }, { status: 403 });
    }
    await db.collection('standins').doc(userId).set(data, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error registering standin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
