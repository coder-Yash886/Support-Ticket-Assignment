"use client";

import React from "react";
import { useSharedTicker } from "@/lib/ticker";
import { slaStatus, formatSlaTime } from "@/lib/sla";
import { Priority, TicketStatus } from "@/types/ticket";
import { SlaBadge } from "./SlaBadge";

interface SlaCountdownProps {
  createdAt: number;
  priority: Priority;
  status: TicketStatus;
  showBadge?: boolean;
}

/**
 * Isolated countdown component.
 * Only re-renders this tiny element on the 1s tick, protecting the entire TicketRow from re-rendering!
 */
export const SlaCountdown = React.memo(function SlaCountdown({
  createdAt,
  priority,
  status,
  showBadge = false,
}: SlaCountdownProps) {
  const now = useSharedTicker();

  // Resolved tickets show no active countdown
  if (status === "resolved") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-emerald-600 dark:text-emerald-400">Resolved</span>
      </div>
    );
  }

  const { state, left } = slaStatus(createdAt, priority, now || Date.now());
  const formatted = formatSlaTime(left);

  return (
    <div className="flex items-center gap-2">
      {showBadge && <SlaBadge state={state} />}
      <span
        className={`font-mono text-xs tabular-nums ${
          state === "late"
            ? "text-red-600 font-bold dark:text-red-400"
            : state === "at_risk"
            ? "text-amber-600 font-semibold dark:text-amber-400"
            : "text-zinc-600 dark:text-zinc-300"
        }`}
        title={`Time remaining: ${formatted}`}
      >
        {formatted}
      </span>
    </div>
  );
});
