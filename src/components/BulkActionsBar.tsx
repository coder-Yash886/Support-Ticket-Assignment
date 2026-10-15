"use client";

import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  selectSelectedTicketIds,
  selectActiveAgent,
  selectAllTickets,
} from "@/store/selectors";
import {
  clearSelection,
  claimTicket,
  changeStatus,
} from "@/store/ticketsSlice";
import { CheckSquare, Play, CheckCircle2, X, RefreshCw, Zap } from "lucide-react";

export function BulkActionsBar() {
  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector(selectSelectedTicketIds);
  const currentAgent = useAppSelector(selectActiveAgent);
  const allTickets = useAppSelector(selectAllTickets);

  const [processing, setProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const selectedSet = new Set(selectedIds);
  const targetTickets = allTickets.filter((t) => selectedSet.has(t.id));

  // Bulk Claim Action: 1 request per ticket, rolls back only failed ones
  const handleBulkClaim = async () => {
    if (processing) return;
    setProcessing(true);
    setResultMessage(null);

    let succeeded = 0;
    let failed = 0;

    for (const ticket of targetTickets) {
      if (ticket.assigned_to !== currentAgent) {
        try {
          await dispatch(claimTicket(ticket.id)).unwrap();
          succeeded++;
        } catch {
          failed++;
        }
      }
    }

    setProcessing(false);
    setResultMessage(
      `Claimed ${succeeded} tickets.${failed > 0 ? ` ${failed} failed or taken.` : ""}`
    );
    if (failed === 0) {
      dispatch(clearSelection());
    }
  };

  // Bulk Move to In Progress
  const handleBulkInProgress = async () => {
    if (processing) return;
    setProcessing(true);
    setResultMessage(null);

    let succeeded = 0;
    let failed = 0;

    for (const ticket of targetTickets) {
      if (ticket.status === "open" && ticket.assigned_to === currentAgent) {
        try {
          await dispatch(
            changeStatus({ id: ticket.id, to: "in_progress" })
          ).unwrap();
          succeeded++;
        } catch {
          failed++;
        }
      }
    }

    setProcessing(false);
    setResultMessage(
      `Started ${succeeded} tickets in progress.${failed > 0 ? ` ${failed} could not transition.` : ""}`
    );
    dispatch(clearSelection());
  };

  // Bulk Resolve
  const handleBulkResolve = async () => {
    if (processing) return;
    setProcessing(true);
    setResultMessage(null);

    let succeeded = 0;
    let failed = 0;

    for (const ticket of targetTickets) {
      if (ticket.status === "in_progress" && ticket.assigned_to === currentAgent) {
        try {
          await dispatch(
            changeStatus({ id: ticket.id, to: "resolved" })
          ).unwrap();
          succeeded++;
        } catch {
          failed++;
        }
      }
    }

    setProcessing(false);
    setResultMessage(
      `Resolved ${succeeded} tickets.${failed > 0 ? ` ${failed} could not be resolved.` : ""}`
    );
    dispatch(clearSelection());
  };

  return (
    <div className="fixed bottom-6 inset-x-0 z-40 max-w-lg mx-auto px-4 pointer-events-none">
      <div className="pointer-events-auto bg-slate-900 dark:bg-slate-950 text-white rounded-xl px-4 py-2.5 shadow-xl border border-slate-800 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-150">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-white">
              {selectedIds.length} selected
            </span>
            {resultMessage && (
              <span className="text-[11px] text-slate-400 ml-2 truncate inline-block max-w-[140px] align-bottom">
                {resultMessage}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Claim All */}
          <button
            onClick={handleBulkClaim}
            disabled={processing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
          >
            {processing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            <span>Claim</span>
          </button>

          {/* Start Progress */}
          <button
            onClick={handleBulkInProgress}
            disabled={processing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer border border-slate-700"
          >
            <Play className="w-3 h-3 text-amber-400" />
            <span>Start</span>
          </button>

          {/* Resolve */}
          <button
            onClick={handleBulkResolve}
            disabled={processing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer border border-slate-700"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Resolve</span>
          </button>

          {/* Deselect All */}
          <button
            onClick={() => dispatch(clearSelection())}
            disabled={processing}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
            title="Deselect all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
