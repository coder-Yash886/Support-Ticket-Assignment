import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { chaos } from "@/server/chaos";
import { isValidAgent } from "@/server/rules";
import { AGENT_NAMES } from "@/types/ticket";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Check agent authorization header
  const agentId = req.headers.get("X-Agent-Id");
  if (!agentId || !isValidAgent(agentId)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing X-Agent-Id header" },
      { status: 401 }
    );
  }

  // 2. Simulated chaos race condition (25% chance of simulated 409)
  const chaosError = await chaos("claim");
  if (chaosError) return chaosError;

  const { id } = await params;
  const ticket = db.get(id);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // 3. Real conflict check (must trigger even if chaos is off)
  if (ticket.assigned_to && ticket.assigned_to !== agentId) {
    const ownerName =
      AGENT_NAMES[ticket.assigned_to as keyof typeof AGENT_NAMES] || ticket.assigned_to;
    return NextResponse.json(
      {
        error: `Conflict: Ticket already claimed by ${ownerName}`,
        assigned_to: ticket.assigned_to,
      },
      { status: 409 }
    );
  }

  // 4. Idempotent claim: already assigned to this agent -> return 200
  if (ticket.assigned_to === agentId) {
    return NextResponse.json(ticket);
  }

  // 5. Update assignment
  const updated = db.update(id, { assigned_to: agentId });
  return NextResponse.json(updated);
}
