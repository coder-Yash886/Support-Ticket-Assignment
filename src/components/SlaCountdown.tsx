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
      <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
            ? "text-rose-700 bg-rose-50 border border-rose-200/60"
            : state === "at_risk"
            ? "text-amber-800 bg-amber-50 border border-amber-200/60"
            : "text-slate-600 bg-slate-100 border border-slate-200/60"
        }`}
        title={`Time remaining: ${formatted}`}
      >
        {formatted}
      </span>
    </div>
  );
});
