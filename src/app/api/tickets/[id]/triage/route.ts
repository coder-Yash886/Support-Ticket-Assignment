import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { chaos } from "@/server/chaos";
import { validateTriage, isValidAgent } from "@/server/rules";
import { Priority, Category } from "@/types/ticket";

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

  let body: {
    action?: "accept" | "change";
    priority?: string;
    category?: string;
    reason?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Mode 1: Accept AI suggestion
  if (body.action === "accept") {
    // Ticket leaves queue by recording reviewer and reviewed_at, keeping original AI decision
    const updated = db.update(id, {
      reviewed_by: agentId,
      reviewed_at: now,
    });
    return NextResponse.json(updated);
  }

  // Mode 2: Modify priority / category with human review reason
  if (body.action === "change") {
    const { priority, category, reason } = body;
    const errors = validateTriage(
      ticket.customer_plan,
      priority ?? "",
      category ?? "",
      reason ?? ""
    );

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 422 });
    }

    const updated = db.update(id, {
      priority: priority as Priority,
      category: category as Category,
      review_reason: reason?.trim(),
      reviewed_by: agentId,
      reviewed_at: now,
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: "Invalid action. Expected 'accept' or 'change'" },
    { status: 400 }
  );
}
