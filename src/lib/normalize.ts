import {
  PRIORITIES,
  CATEGORIES,
  STATUSES,
  AGENTS,
  CUSTOMER_PLANS,
  Priority,
  Category,
  TicketStatus,
  RawTicket,
  Ticket,
} from "@/types/ticket";

/**
 * Parses date string safely.
 * If date string does not have an explicit timezone offset, treats it as UTC (documented per brief).
 * If date cannot be parsed, falls back to Date.now().
 */
export function parseDate(s?: string | null): number {
  if (!s || typeof s !== "string") return Date.now();
  const trimmed = s.trim();
  if (!trimmed) return Date.now();

  const iso = trimmed.replace(" ", "T");
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const normalizedIso = hasZone ? iso : iso + "Z"; // no zone -> UTC
  const t = Date.parse(normalizedIso);
  return Number.isNaN(t) ? Date.now() : t;
}

/**
 * Normalizes raw ticket objects from the database/API.
 * Defends against all 12 trap tickets (T-2001 to T-2012):
 * - Status "closed" mapped to "resolved"
 * - Unknown agent flagged
 * - Future dates clamped to now and flagged
 * - Invalid priority/category flagged, safely mapped to valid enums, and forced to manual_review
 * - Invalid triage decisions (e.g., 'maybe') safely mapped to manual_review
 * - Null/empty subject and body safely normalized to empty string placeholders
 * - Unknown customer plans flagged
 */
export function normalize(raw: RawTicket, now = Date.now()): Ticket {
  const flags: string[] = [];

  // 1. Status normalization ('closed' -> 'resolved')
  let statusInput = raw.status ?? "open";
  let wasClosed = false;
  if (statusInput === "closed") {
    wasClosed = true;
    statusInput = "resolved";
    flags.push("was_closed");
  }

  const status: TicketStatus = STATUSES.includes(statusInput as TicketStatus)
    ? (statusInput as TicketStatus)
    : "open";

  // 2. Priority validation
  const rawPriority = raw.priority;
  const priorityOk = PRIORITIES.includes(rawPriority as Priority);
  if (!priorityOk) {
    flags.push("invalid_priority");
  }
  const priority: Priority = priorityOk ? (rawPriority as Priority) : "P3";

  // 3. Category validation
  const rawCategory = raw.category;
  const categoryOk = CATEGORIES.includes(rawCategory as Category);
  if (!categoryOk) {
    flags.push("invalid_category");
  }
  const category: Category = categoryOk ? (rawCategory as Category) : "other";

  // 4. Decision validation
  const rawDecision = raw.triage_decision;
  const decisionOk =
    rawDecision === "auto_accept" || rawDecision === "manual_review";
  if (!decisionOk) {
    flags.push("invalid_decision");
  }

  // 5. Agent validation
  if (raw.assigned_to && !AGENTS.includes(raw.assigned_to as any)) {
    flags.push("unknown_agent");
  }

  // 6. Plan validation
  const plan = raw.customer_plan || raw.customer_tier || "free";
  if (!CUSTOMER_PLANS.includes(plan as any)) {
    flags.push("unknown_plan");
  }

  // 7. Date parsing & clamping future dates
  const created = parseDate(raw.created_at);
  if (created > now) {
    flags.push("future_date");
  }
  const clampedCreatedAt = Math.min(created, now);

  // 8. Triage decision rule: if anything invalid, force manual_review
  const finalDecision =
    decisionOk && priorityOk && categoryOk && !flags.includes("unknown_plan")
      ? (rawDecision as "auto_accept" | "manual_review")
      : "manual_review";

  return {
    ...raw,
    id: String(raw.id),
    external_id: raw.external_id ? String(raw.external_id) : undefined,
    subject: raw.subject ?? "",
    body: raw.body ?? "",
    priority,
    rawPriority: !priorityOk ? String(rawPriority ?? "") : undefined,
    category,
    rawCategory: !categoryOk ? String(rawCategory ?? "") : undefined,
    status,
    rawStatus: wasClosed ? "closed" : undefined,
    customer_plan: plan,
    assigned_to: raw.assigned_to ?? null,
    created_at: raw.created_at ?? new Date(clampedCreatedAt).toISOString(),
    createdAt: clampedCreatedAt,
    triage_decision: finalDecision,
    ai_priority: raw.ai_priority ?? null,
    ai_summary: raw.ai_summary ?? null,
    review_reason: raw.review_reason ?? null,
    reviewed_by: raw.reviewed_by ?? null,
    reviewed_at: raw.reviewed_at ?? null,
    attachment_url: raw.attachment_url ?? null,
    flags,
  };
}
