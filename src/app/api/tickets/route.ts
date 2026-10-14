import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { chaos } from "@/server/chaos";

export async function GET(req: NextRequest) {
  const chaosError = await chaos("read");
  if (chaosError) return chaosError;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const status = searchParams.get("status") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const category = searchParams.get("category") || undefined;
  const cursor = searchParams.get("cursor") || undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : 25;

  const result = db.list({
    q,
    status,
    priority,
    category,
    cursor,
    limit,
  });

  return NextResponse.json(result);
}
