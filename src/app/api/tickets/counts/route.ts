import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { chaos } from "@/server/chaos";

export async function GET(req: NextRequest) {
  const chaosError = await chaos("read");
  if (chaosError) return chaosError;

  const agentHeader = req.headers.get("X-Agent-Id");
  const { searchParams } = new URL(req.url);
  const agentQuery = searchParams.get("agentId");
  const agentId = agentHeader || agentQuery || undefined;

  const counts = db.getCounts(agentId);
  return NextResponse.json(counts);
}
