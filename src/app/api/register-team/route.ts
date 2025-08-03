import { NextResponse } from "next/server";
import { registerTeam } from "@/lib/actions";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const result = await registerTeam(data);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error && error.message ? error.message : "Unknown error" }, { status: 500 });
  }
}
