export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = [
  "billing",
  "bug",
  "account_access",
  "feature_request",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["open", "in_progress", "resolved"] as const;
export type TicketStatus = (typeof STATUSES)[number];

export const CUSTOMER_PLANS = ["free", "pro", "enterprise"] as const;
export type CustomerPlan = (typeof CUSTOMER_PLANS)[number] | string;

export const AGENTS = ["agent-1", "agent-2", "agent-3"] as const;
export type AgentId = (typeof AGENTS)[number];

export const AGENT_NAMES: Record<AgentId, string> = {
  "agent-1": "Priya",
  "agent-2": "Rahul",
  "agent-3": "Meera",
};

export const TRIAGE_DECISIONS = ["auto_accept", "manual_review"] as const;
export type TriageDecision = (typeof TRIAGE_DECISIONS)[number];

export interface RawTicket {
  id: string;
  external_id?: string;
  subject?: string | null;
  body?: string | null;
  priority?: string | null;
  category?: string | null;
  status?: string | null;
  customer_tier?: string | null;
  customer_plan?: string | null;
  assigned_to?: string | null;
  created_at?: string | null;
  triage_decision?: string | null;
  ai_priority?: string | null;
  ai_summary?: string | null;
  review_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  attachment_url?: string | null;
  [key: string]: unknown;
}

export interface Ticket {
  id: string;
  external_id?: string;
  subject: string;
  body: string;
  priority: Priority;
  rawPriority?: string;
  category: Category;
  rawCategory?: string;
  status: TicketStatus;
  rawStatus?: string;
  customer_plan: CustomerPlan;
  assigned_to: string | null;
  created_at: string;
  createdAt: number; // normalized epoch ms
  triage_decision: TriageDecision;
  ai_priority?: string | null;
  ai_summary?: string | null;
  review_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  attachment_url?: string | null;
  flags: string[];
}
