import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { chaos } from "@/server/chaos";
import { PRIORITIES, CATEGORIES, Priority, Category, Ticket } from "@/types/ticket";

function fakeTriage(ticket: Ticket, _apiKey: string) {
  // Simulate AI model triage prediction
  const isHighPriority =
    ticket.subject.toLowerCase().includes("urgent") ||
    ticket.subject.toLowerCase().includes("security") ||
    ticket.subject.toLowerCase().includes("down") ||
    ticket.body.toLowerCase().includes("cannot access");

  const rawSuggestedPriority = isHighPriority ? "P0" : "P2";
  const rawSuggestedCategory = ticket.category || "bug";
  const aiSummary = `AI Analysis: Issue relating to ${ticket.category}. ${ticket.subject.slice(0, 80)}`;

  return {
    ai_priority: rawSuggestedPriority,
    category: rawSuggestedCategory,
    ai_summary: aiSummary,
    triage_decision: "auto_accept" as const,
  };
}

function validateAiOutput(
  rawAi: {
    ai_priority: string;
    category: string;
    ai_summary: string;
    triage_decision: "auto_accept" | "manual_review";
  },
  customerPlan: string
) {
  let priority = PRIORITIES.includes(rawAi.ai_priority as Priority)
    ? (rawAi.ai_priority as Priority)
    : "P2";

  const category = CATEGORIES.includes(rawAi.category as Category)
    ? (rawAi.category as Category)
    : "other";

  let reviewReason = "AI auto-triaged";

  // Re-apply enterprise safety constraint to AI output
  // If AI suggests P2 or P3 for Enterprise, enforce minimum P1
  if (customerPlan === "enterprise" && priority > "P1") {
    priority = "P1";
    reviewReason = "AI suggested lower priority, adjusted to P1 per Enterprise SLA rule";
  }

  // Strip harmful script tags from AI summary (AI output is untrusted!)
  const sanitizedSummary = rawAi.ai_summary
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "");

  return {
    priority,
    ai_priority: rawAi.ai_priority,
    category,
    ai_summary: sanitizedSummary,
    triage_decision: rawAi.triage_decision,
    review_reason: reviewReason,
  };
}

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const chaosError = await chaos("write");
  if (chaosError) return chaosError;

  const { id } = await params;

  // Security critical: server-only TRIAGE_API_KEY, never exposed to client
  const key = process.env.TRIAGE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "AI service not configured (TRIAGE_API_KEY missing on server)" },
      { status: 503 }
    );
  }

  const ticket = db.get(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const rawAiResult = fakeTriage(ticket, key);
  const safeResult = validateAiOutput(rawAiResult, ticket.customer_plan);

  const updated = db.update(id, {
    ai_priority: safeResult.ai_priority,
    ai_summary: safeResult.ai_summary,
    priority: safeResult.priority,
    category: safeResult.category,
    review_reason: safeResult.review_reason,
  });

  return NextResponse.json(updated);
}
