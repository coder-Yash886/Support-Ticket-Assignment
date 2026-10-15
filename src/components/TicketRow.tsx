"use client";

import React, { useState } from "react";
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
import {
  UserCheck,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  User,
  Copy,
  Check,
  Zap,
} from "lucide-react";

interface TicketRowProps {
  id: string;
}

const PRIORITY_CONF: Record<
  Priority,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  P0: {
    label: "P0",
    text: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  P1: {
    label: "P1",
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  P2: {
    label: "P2",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  P3: {
    label: "P3",
    text: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

const STATUS_CONF = {
  open: {
    label: "Open",
    pill: "bg-slate-100 text-slate-700",
    dot: "bg-blue-500",
  },
  in_progress: {
    label: "In Progress",
    pill: "bg-amber-50 text-amber-800 border border-amber-200/80",
    dot: "bg-amber-500",
  },
  resolved: {
    label: "Resolved",
    pill: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
    dot: "bg-emerald-500",
  },
};

export const TicketRow = React.memo(function TicketRow({ id }: TicketRowProps) {
  const dispatch = useAppDispatch();
  const ticket = useAppSelector((state) => selectTicketById(state, id));
  const isPending = useAppSelector(selectIsPendingMutation(id));
  const currentAgent = useAppSelector(selectActiveAgent);
  const selectedIds = useAppSelector(selectSelectedTicketIds);
  const isSelected = selectedIds.includes(id);

  const [copied, setCopied] = useState(false);

  if (!ticket) return null;

  const isAssignedToMe = ticket.assigned_to === currentAgent;
  const isUnassigned = !ticket.assigned_to;
  const assignedName = ticket.assigned_to
    ? AGENT_NAMES[ticket.assigned_to as AgentId] || `Agent (${ticket.assigned_to})`
    : null;

  const priorityStyle = PRIORITY_CONF[ticket.priority] || PRIORITY_CONF.P3;
  const statusStyle = STATUS_CONF[ticket.status] || STATUS_CONF.open;

  const handleClaim = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPending && isUnassigned) {
      dispatch(claimTicket(id));
    }
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(ticket.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`group border-b border-slate-100 hover:bg-slate-50/70 transition-colors ${
        isSelected ? "bg-indigo-50/40" : "bg-white"
      }`}
    >
      {/* Desktop Grid Layout */}
      <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 items-center">
        {/* Checkbox, ID, Flags (Col 1-2) */}
        <div className="col-span-2 flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => dispatch(toggleSelectTicket(id))}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer flex-shrink-0"
            aria-label={`Select ticket ${ticket.id}`}
          />
          <div className="flex items-center gap-1 min-w-0">
            <Link
              href={`/tickets/${ticket.id}`}
              className="font-mono text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors truncate"
              title={ticket.id}
            >
              {ticket.id}
            </Link>
            <button
              onClick={handleCopyId}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-600 transition-opacity"
              title="Copy ID"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          {ticket.flags.length > 0 && (
            <span
              title={`Security flags: ${ticket.flags.join(", ")}`}
              className="inline-flex text-amber-500 flex-shrink-0"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
          )}

          {ticket.triage_decision === "manual_review" && !ticket.reviewed_at && (
            <span
              title="Needs AI review"
              className="inline-flex text-purple-600 flex-shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Priority & Status (Col 3-4) */}
        <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${priorityStyle.bg} ${priorityStyle.border} ${priorityStyle.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
            <span>{ticket.priority}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${statusStyle.pill}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            <span>{statusStyle.label}</span>
          </span>
        </div>

        {/* Subject & Description Snippet (Col 5-8) */}
        <div className="col-span-4 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            <Link
              href={`/tickets/${ticket.id}`}
              className="text-xs sm:text-sm font-semibold text-slate-900 truncate hover:text-indigo-600 transition-colors"
              title={ticket.subject || "(No subject)"}
              dir="auto"
            >
              {ticket.subject || (
                <span className="text-slate-400 italic">(No subject)</span>
              )}
            </Link>
            {ticket.customer_plan && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium uppercase tracking-wider bg-slate-100 text-slate-600 flex-shrink-0">
                {ticket.customer_plan}
              </span>
            )}
          </div>
          <p
            className="text-xs text-slate-500 truncate leading-relaxed"
            dir="auto"
          >
            {ticket.body || "(No message body provided)"}
          </p>
        </div>

        {/* SLA Status (Col 9-10) */}
        <div className="col-span-2">
          <SlaCountdown
            createdAt={ticket.createdAt}
            priority={ticket.priority}
            status={ticket.status}
            showBadge
          />
        </div>

        {/* Assignment & Action (Col 11-12) */}
        <div className="col-span-2 flex justify-end items-center gap-2">
          {isAssignedToMe ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/60">
              <UserCheck className="w-3.5 h-3.5" />
              <span>You</span>
            </span>
          ) : assignedName ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-slate-600 truncate max-w-[110px]"
              title={`Assigned to ${assignedName}`}
            >
              <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{assignedName}</span>
            </span>
          ) : (
            <button
              onClick={handleClaim}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-3 h-3 text-indigo-500" />
              <span>{isPending ? "Claiming..." : "Claim"}</span>
            </button>
          )}

          <Link
            href={`/tickets/${ticket.id}`}
            className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
            aria-label="View ticket detail"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => dispatch(toggleSelectTicket(id))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600"
            />
            <Link
              href={`/tickets/${ticket.id}`}
              className="font-mono text-xs font-semibold text-slate-700"
            >
              {ticket.id}
            </Link>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${priorityStyle.bg} ${priorityStyle.border} ${priorityStyle.text}`}
            >
              {ticket.priority}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${statusStyle.pill}`}
            >
              {statusStyle.label}
            </span>
          </div>

          <SlaCountdown
            createdAt={ticket.createdAt}
            priority={ticket.priority}
            status={ticket.status}
          />
        </div>

        <Link href={`/tickets/${ticket.id}`} className="block">
          <h3
            className="text-xs sm:text-sm font-semibold text-slate-900 truncate"
            dir="auto"
          >
            {ticket.subject || "(No subject)"}
          </h3>
          <p
            className="text-xs text-slate-500 truncate mt-0.5"
            dir="auto"
          >
            {ticket.body || "(No message body)"}
          </p>
        </Link>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            {assignedName ? `Assigned: ${assignedName}` : "Unassigned"}
          </span>

          {isUnassigned && (
            <button
              onClick={handleClaim}
              disabled={isPending}
              className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
            >
              Claim
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
