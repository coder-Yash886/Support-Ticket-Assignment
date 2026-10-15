import React from "react";
import { SlaState } from "@/lib/sla";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";

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
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60"
        aria-label="SLA Breached: Late"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {showIcon && <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
        <span>Late</span>
      </span>
    );
  }

  if (state === "at_risk") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60"
        aria-label="SLA Warning: At Risk"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {showIcon && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
        <span>At Risk</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
      aria-label="SLA Safe: On Track"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {showIcon && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
      <span>On Track</span>
    </span>
  );
});
