import { NextResponse } from "next/server";
import { getDb, type Database } from "@/db/client";
import { getHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  let db: Database | null = null;
  try {
    db = getDb();
  } catch {
    db = null;
  }
  const report = await getHealth(db);
  // 503 when the app cannot serve real work, so uptime monitors and deploy checks catch it.
  return NextResponse.json(report, {
    status: report.status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
