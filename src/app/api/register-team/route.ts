import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, ensureAdminInitialized } from '@/lib/admin';
import { registerTeam } from "@/lib/actions";
import { checkRateLimit, LIMIT_REGISTRATION } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rateLimitRes = checkRateLimit(req, 'register-team', LIMIT_REGISTRATION);
  if (rateLimitRes) return rateLimitRes;

  // Require authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let authenticatedUid: string;
  try {
    ensureAdminInitialized();
    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    authenticatedUid = decodedToken.uid;
  } catch {
    return NextResponse.json({ success: false, message: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  try {
    const data = await req.json();
    // Enforce that the captainId in the payload matches the authenticated user
    if (data.captainId !== authenticatedUid) {
      return NextResponse.json({ success: false, message: 'Forbidden: You can only register a team for yourself' }, { status: 403 });
    }
    const result = await registerTeam(data);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
