import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { chaos } from "@/server/chaos";
import { canMove, isValidAgent } from "@/server/rules";
import { TicketStatus } from "@/types/ticket";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agentId = req.headers.get("X-Agent-Id");
  if (!agentId || !isValidAgent(agentId)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing X-Agent-Id header" },
      { status: 401 }
    );
  }

  const chaosError = await chaos("write");
  if (chaosError) return chaosError;

  const { id } = await params;
  const ticket = db.get(id);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Assignee check: Only the assigned agent may transition the ticket's status
  if (ticket.assigned_to !== agentId) {
    return NextResponse.json(
      { error: "Forbidden: Only the assigned agent can change ticket status" },
      { status: 403 }
    );
  }

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nextStatus = body.status;
  if (!nextStatus || typeof nextStatus !== "string") {
    return NextResponse.json({ error: "Missing status in request body" }, { status: 400 });
  }

  // Validate state machine transition rules (NEXT)
  if (!canMove(ticket.status, nextStatus)) {
    return NextResponse.json(
      {
        error: `Invalid transition: cannot move ticket from '${ticket.status}' to '${nextStatus}'`,
      },
      { status: 422 }
    );
  }

  const updated = db.update(id, { status: nextStatus as TicketStatus });
  return NextResponse.json(updated);
}
