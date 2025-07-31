import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export async function GET() {
  const filePath = path.join(process.cwd(), "registration_payloads.json");
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const payloads = JSON.parse(data);
    return NextResponse.json(payloads);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load registration payloads." }, { status: 500 });
  }
}
