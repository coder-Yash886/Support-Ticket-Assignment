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
import { CheckSquare, UserCheck, Play, CheckCircle2, X, RefreshCw } from "lucide-react";

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

  // Bulk Claim Action: 1 request per ticket, rolls back only failed ones (Page 5, 7.6)
  const handleBulkClaim = async () => {
    if (processing) return;
    setProcessing(true);
    setResultMessage(null);

    let succeeded = 0;
    let failed = 0;

    for (const ticket of targetTickets) {
      // Only claim unassigned tickets or tickets not already mine
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
      `Claimed ${succeeded} tickets.${failed > 0 ? ` ${failed} failed or were taken by another agent.` : ""}`
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
    <div className="sticky bottom-6 z-40 max-w-2xl mx-auto px-4">
      <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-2xl border border-zinc-700 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-semibold">
            {selectedIds.length} {selectedIds.length === 1 ? "ticket" : "tickets"} selected
          </span>
          {resultMessage && (
            <span className="text-xs text-zinc-300 ml-2 hidden sm:inline">
              ({resultMessage})
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Claim All */}
          <button
            onClick={handleBulkClaim}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
          >
            {processing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
            <span>Claim</span>
          </button>

          {/* Start Progress */}
          <button
            onClick={handleBulkInProgress}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            <span>Start</span>
          </button>

          {/* Resolve */}
          <button
            onClick={handleBulkResolve}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Resolve</span>
          </button>

          {/* Deselect All */}
          <button
            onClick={() => dispatch(clearSelection())}
            disabled={processing}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Deselect all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
