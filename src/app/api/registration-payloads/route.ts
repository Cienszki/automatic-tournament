import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { getAdminAuth, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(req: NextRequest) {
  // Require admin authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    ensureAdminInitialized();
    await getAdminAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  const filePath = path.join(process.cwd(), "registration_payloads.json");
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const payloads = JSON.parse(data);
    return NextResponse.json(payloads);
  } catch {
    return NextResponse.json({ error: "Failed to load registration payloads." }, { status: 500 });
  }
}
