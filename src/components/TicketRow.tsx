"use client";

import React from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  selectTicketById,
  selectIsPendingMutation,
  selectActiveAgent,
  selectSelectedTicketIds,
} from "@/store/selectors";
import { claimTicket, toggleSelectTicket } from "@/store/ticketsSlice";
import { SlaCountdown } from "./SlaCountdown";
import { AGENT_NAMES, AgentId, Priority } from "@/types/ticket";
import { UserCheck, ShieldAlert, Sparkles, ChevronRight, User } from "lucide-react";

interface TicketRowProps {
  id: string;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  P0: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  P1: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  P2: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  P3: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

const STATUS_STYLES = {
  open: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export const TicketRow = React.memo(function TicketRow({ id }: TicketRowProps) {
  const dispatch = useAppDispatch();
  const ticket = useAppSelector((state) => selectTicketById(state, id));
  const isPending = useAppSelector(selectIsPendingMutation(id));
  const currentAgent = useAppSelector(selectActiveAgent);
  const selectedIds = useAppSelector(selectSelectedTicketIds);
  const isSelected = selectedIds.includes(id);

  if (!ticket) return null;

  const isAssignedToMe = ticket.assigned_to === currentAgent;
  const isUnassigned = !ticket.assigned_to;
  const assignedName = ticket.assigned_to
    ? AGENT_NAMES[ticket.assigned_to as AgentId] || `Unknown (${ticket.assigned_to})`
    : null;

  const handleToggleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(toggleSelectTicket(id));
  };

  const handleClaim = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPending && isUnassigned) {
      dispatch(claimTicket(id));
    }
  };

  return (
    <div
      className={`group border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition ${
        isSelected ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""
      }`}
    >
      {/* Desktop Table Row (md and up) */}
      <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 items-center">
        {/* Checkbox, ID & Flags (Col 1-2) */}
        <div className="col-span-2 flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => dispatch(toggleSelectTicket(id))}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            aria-label={`Select ticket ${ticket.id}`}
          />
          <Link
            href={`/tickets/${ticket.id}`}
            className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
            title={ticket.id}
          >
            {ticket.id}
          </Link>
          {ticket.flags.length > 0 && (
            <span
              title={`Defensive flags: ${ticket.flags.join(", ")}`}
              className="inline-flex items-center text-amber-600 dark:text-amber-400"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
          )}
          {ticket.triage_decision === "manual_review" && !ticket.reviewed_at && (
            <span
              title="In AI review queue"
              className="inline-flex items-center text-purple-600 dark:text-purple-400"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Priority & Status (Col 3-4) */}
        <div className="col-span-2 flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold border ${
              PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.P3
            }`}
          >
            {ticket.priority}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium border capitalize ${
              STATUS_STYLES[ticket.status] || STATUS_STYLES.open
            }`}
          >
            {ticket.status.replace("_", " ")}
          </span>
        </div>

        {/* Subject & Body Preview (Col 5-8) */}
        <div className="col-span-4 min-w-0 pr-2">
          <Link
            href={`/tickets/${ticket.id}`}
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate hover:text-indigo-600 dark:hover:text-indigo-400"
            title={ticket.subject || "(No subject)"}
            dir="auto"
          >
            {ticket.subject || <span className="text-zinc-400 italic">(No subject)</span>}
          </Link>
          <p
            className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5"
            dir="auto"
            title={ticket.body}
          >
            {ticket.body || "(No content)"}
          </p>
        </div>

        {/* SLA Countdown (Col 9-10) */}
        <div className="col-span-2">
          <SlaCountdown
            createdAt={ticket.createdAt}
            priority={ticket.priority}
            status={ticket.status}
            showBadge
          />
        </div>

        {/* Assignee / Action Button (Col 11-12) */}
        <div className="col-span-2 flex justify-end items-center gap-2">
          {isAssignedToMe ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <UserCheck className="w-3 h-3" />
              <span>Assigned to you</span>
            </span>
          ) : assignedName ? (
            <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[110px]" title={assignedName}>
              {assignedName}
            </span>
          ) : (
            <button
              onClick={handleClaim}
              disabled={isPending}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition cursor-pointer"
            >
              {isPending ? "Claiming..." : "Claim"}
            </button>
          )}

          <Link
            href={`/tickets/${ticket.id}`}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Mobile Card Layout (under 640px / 375px) */}
      <div className="md:hidden p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={`/tickets/${ticket.id}`}
              className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400"
            >
              {ticket.id}
            </Link>
            <span
              className={`px-1.5 py-0.2 rounded text-[11px] font-semibold border ${
                PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.P3
              }`}
            >
              {ticket.priority}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[11px] font-medium border capitalize ${
                STATUS_STYLES[ticket.status] || STATUS_STYLES.open
              }`}
            >
              {ticket.status.replace("_", " ")}
            </span>
          </div>

          <SlaCountdown
            createdAt={ticket.createdAt}
            priority={ticket.priority}
            status={ticket.status}
            showBadge
          />
        </div>

        <Link href={`/tickets/${ticket.id}`} className="block">
          <h4
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate"
            dir="auto"
          >
            {ticket.subject || "(No subject)"}
          </h4>
          <p
            className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5"
            dir="auto"
          >
            {ticket.body || "(No content)"}
          </p>
        </Link>

        <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <User className="w-3.5 h-3.5" />
            <span className="truncate max-w-[140px]">
              {isAssignedToMe ? "You" : assignedName || "Unassigned"}
            </span>
          </div>

          {isUnassigned && (
            <button
              onClick={handleClaim}
              disabled={isPending}
              className="px-3 py-1 text-xs font-semibold rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 transition"
            >
              {isPending ? "Claiming..." : "Claim"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
