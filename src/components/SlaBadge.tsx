import React from "react";
import { SlaState } from "@/lib/sla";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";

interface SlaBadgeProps {
  state: SlaState;
  showIcon?: boolean;
}

export const SlaBadge = React.memo(function SlaBadge({
  state,
  showIcon = true,
}: SlaBadgeProps) {
  if (state === "late") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
        aria-label="SLA Breached: Late"
      >
        {showIcon && <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />}
        <span>Late</span>
      </span>
    );
  }

  if (state === "at_risk") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
        aria-label="SLA Warning: At Risk"
      >
        {showIcon && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
        <span>At Risk</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
      aria-label="SLA Safe: On Track"
    >
      {showIcon && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
      <span>On Track</span>
    </span>
  );
});
