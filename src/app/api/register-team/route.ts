import { NextRequest, NextResponse } from "next/server";
import { registerTeam } from "@/lib/actions";
import { checkRateLimit, LIMIT_REGISTRATION } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rateLimitRes = checkRateLimit(req, 'register-team', LIMIT_REGISTRATION);
  if (rateLimitRes) return rateLimitRes;

  try {
    const data = await req.json();
    const result = await registerTeam(data);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error && error.message ? error.message : "Unknown error" }, { status: 500 });
  }
}
