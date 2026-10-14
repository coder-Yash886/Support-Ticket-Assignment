import { Priority } from "@/types/ticket";

export const SLA_LIMIT_MS: Record<Priority, number> = {
  P0: 1 * 3600 * 1000,   // 1 hour
  P1: 4 * 3600 * 1000,   // 4 hours
  P2: 24 * 3600 * 1000,  // 24 hours
  P3: 72 * 3600 * 1000,  // 72 hours
};

export type SlaState = "late" | "at_risk" | "on_track";

export interface SlaResult {
  state: SlaState;
  left: number;
  total: number;
  ratio: number;
}

/**
 * Calculates SLA status.
 * Boundary rules:
 * - left <= 0: "late"
 * - left / total < 0.2: "at_risk"
 * - left / total >= 0.2: "on_track" (exactly 20% left is on track)
 */
export function slaStatus(
  createdAt: number,
  priority: Priority,
  now: number
): SlaResult {
  const total = SLA_LIMIT_MS[priority] ?? SLA_LIMIT_MS.P3;
  const left = createdAt + total - now;

  if (left <= 0) {
    return { state: "late", left, total, ratio: 0 };
  }

  const ratio = left / total;
  const state: SlaState = ratio < 0.2 ? "at_risk" : "on_track";

  return { state, left, total, ratio };
}

/**
 * Format remaining SLA duration into human-readable text (e.g., "-15m", "45m", "2h 10m")
 */
export function formatSlaTime(ms: number): string {
  const isNegative = ms < 0;
  const absMs = Math.abs(ms);
  const minutes = Math.floor(absMs / (60 * 1000));
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  let formatted = "";
  if (hours > 0) {
    formatted = `${hours}h ${remainingMins}m`;
  } else {
    formatted = `${remainingMins}m`;
  }

  return isNegative ? `-${formatted}` : formatted;
}
