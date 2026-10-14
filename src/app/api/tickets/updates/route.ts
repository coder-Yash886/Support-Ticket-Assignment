import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { chaos } from "@/server/chaos";

export async function GET(req: NextRequest) {
  const chaosError = await chaos("read");
  if (chaosError) return chaosError;

  const { searchParams } = new URL(req.url);
  const sinceStr = searchParams.get("since");
  const since = sinceStr ? parseInt(sinceStr, 10) : 0;

  const updates = db.getUpdates(Number.isNaN(since) ? 0 : since);
  return NextResponse.json(updates);
}
