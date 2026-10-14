import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { chaos } from "@/server/chaos";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const chaosError = await chaos("read");
  if (chaosError) return chaosError;

  const { id } = await params;
  const ticket = db.get(id);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
