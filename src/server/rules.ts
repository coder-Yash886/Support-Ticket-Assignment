import {
  PRIORITIES,
  CATEGORIES,
  AGENTS,
  Priority,
  Category,
  TicketStatus,
  AgentId,
} from "@/types/ticket";

export const NEXT_ALLOWED_STATUS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["open"],
};

export function canMove(from: string, to: string): boolean {
  return (NEXT_ALLOWED_STATUS as Record<string, string[]>)[from]?.includes(to) ?? false;
}

export function isValidAgent(agentId: string): agentId is AgentId {
  return AGENTS.includes(agentId as AgentId);
}

export interface TriageValidationErrors {
  priority?: string;
  category?: string;
  reason?: string;
}

/**
 * Validates triage changes (both on server API and client form).
 * Rules:
 * 1. Priority must be one of PRIORITIES (P0, P1, P2, P3)
 * 2. Category must be one of CATEGORIES
 * 3. Reason must be at least 10 characters (trimmed)
 * 4. Enterprise rule: If customer_plan is "enterprise", priority cannot be lowered below P1 (i.e. P2, P3 are rejected)
 */
export function validateTriage(
  plan: string,
  priority: string,
  category: string,
  reason: string
): TriageValidationErrors {
  const errors: TriageValidationErrors = {};

  if (!PRIORITIES.includes(priority as Priority)) {
    errors.priority = "Pick a valid priority";
  }

  if (!CATEGORIES.includes(category as Category)) {
    errors.category = "Pick a valid category";
  }

  if ((reason ?? "").trim().length < 10) {
    errors.reason = "Reason must be at least 10 characters";
  }

  // Enterprise rule: enterprise tickets must stay P1 or higher (P0 or P1 allowed; P2, P3 disallowed)
  if (plan === "enterprise" && priority > "P1") {
    errors.priority = "Enterprise tickets must stay P1 or higher";
  }

  return errors;
}
