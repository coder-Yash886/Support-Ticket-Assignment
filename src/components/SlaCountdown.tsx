"use client";

import React from "react";
import { useSharedTicker } from "@/lib/ticker";
import { slaStatus, formatSlaTime } from "@/lib/sla";
import { Priority, TicketStatus } from "@/types/ticket";
import { SlaBadge } from "./SlaBadge";
import { CheckCircle2 } from "lucide-react";

interface SlaCountdownProps {
  createdAt: number;
  priority: Priority;
  status: TicketStatus;
  showBadge?: boolean;
}

/**
 * Isolated countdown component.
 * Re-renders only this element on the 1s tick.
 */
export const SlaCountdown = React.memo(function SlaCountdown({
  createdAt,
  priority,
  status,
  showBadge = false,
}: SlaCountdownProps) {
  const now = useSharedTicker();

  if (status === "resolved") {
    return (
      <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>Resolved</span>
      </div>
    );
  }

  const { state, left } = slaStatus(createdAt, priority, now || Date.now());
  const formatted = formatSlaTime(left);

  return (
    <div className="inline-flex items-center gap-1.5">
      {showBadge && <SlaBadge state={state} />}
      <span
        className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded text-[11px] font-medium ${
          state === "late"
            ? "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50"
            : state === "at_risk"
            ? "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50"
            : "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
        }`}
        title={`Time remaining: ${formatted}`}
      >
        {formatted}
      </span>
    </div>
  );
});
