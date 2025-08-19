import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '@/lib/admin';

export async function POST(req: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    const data = await req.json();
    const { userId } = data;
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    await db.collection('standins').doc(userId).set(data, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error registering standin:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
