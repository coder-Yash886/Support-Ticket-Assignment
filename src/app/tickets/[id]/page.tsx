"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  selectTicketById,
  selectIsPendingMutation,
  selectActiveAgent,
} from "@/store/selectors";
import {
  claimTicket,
  changeStatus,
  upsertSingleTicket,
} from "@/store/ticketsSlice";
import { SlaCountdown } from "@/components/SlaCountdown";
import { safeUrl } from "@/lib/safeUrl";
import { NEXT_ALLOWED_STATUS } from "@/server/rules";
import { AGENT_NAMES, AgentId, Priority, TicketStatus } from "@/types/ticket";
import {
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Paperclip,
  RefreshCw,
  ExternalLink,
  Bot,
} from "lucide-react";

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

function TicketDetailContent() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const dispatch = useAppDispatch();
  const ticket = useAppSelector((state) => selectTicketById(state, id));
  const isPending = useAppSelector(selectIsPendingMutation(id));
  const currentAgent = useAppSelector(selectActiveAgent);

  const [loading, setLoading] = useState(!ticket);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retriaging, setRetriaging] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch ticket details from server
  const loadTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    setNotFound(false);

    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFetchError(data.error || `Server error (${res.status})`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      dispatch(upsertSingleTicket(data));
    } catch (err: unknown) {
      setFetchError((err as Error)?.message || "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [id, dispatch]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  // Handle Claim with Double-Click Guard & Conflict Rollback
  const handleClaim = async () => {
    if (isPending || !ticket) return;
    try {
      const result = await dispatch(claimTicket(ticket.id)).unwrap();
      setToastMessage({ type: "success", text: `Successfully claimed ticket ${result.id}` });
    } catch (err: any) {
      const msg = err?.message || "Failed to claim ticket";
      setToastMessage({ type: "error", text: msg });
      // Refresh to display actual state and owner
      loadTicket();
    }
  };

  // Handle Status Transition with Double-Click Guard
  const handleStatusChange = async (nextStatus: TicketStatus) => {
    if (isPending || !ticket) return;
    try {
      await dispatch(changeStatus({ id: ticket.id, to: nextStatus })).unwrap();
      setToastMessage({
        type: "success",
        text: `Status updated to ${nextStatus.replace("_", " ")}`,
      });
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err?.message || "Failed to update status",
      });
      loadTicket();
    }
  };

  // Handle Server-Side AI Retriage
  const handleRetriage = async () => {
    if (retriaging || !ticket) return;
    setRetriaging(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/retriage`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Retriage failed");
      }
      const updated = await res.json();
      dispatch(upsertSingleTicket(updated));
      setToastMessage({
        type: "success",
        text: "AI re-triage completed with updated suggestions",
      });
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to run AI triage",
      });
    } finally {
      setRetriaging(false);
    }
  };

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/60 flex items-center justify-center mx-auto text-red-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Ticket Not Found
        </h2>
        <p className="text-sm text-zinc-500">
          We couldn&apos;t find a ticket with ID <code className="font-mono font-semibold">{id}</code>.
        </p>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Ticket List</span>
        </Link>
      </div>
    );
  }

  if (fetchError && !ticket) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center mx-auto text-amber-500">
          <RefreshCw className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Error Loading Ticket
        </h2>
        <p className="text-sm text-zinc-500">{fetchError}</p>
        <button
          onClick={loadTicket}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (loading && !ticket) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4 animate-pulse">
        <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
        <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    );
  }

  if (!ticket) return null;

  const isAssignedToMe = ticket.assigned_to === currentAgent;
  const isUnassigned = !ticket.assigned_to;
  const assignedName = ticket.assigned_to
    ? AGENT_NAMES[ticket.assigned_to as AgentId] || `Unknown (${ticket.assigned_to})`
    : null;

  const allowedNextStatuses = (NEXT_ALLOWED_STATUS[ticket.status] || []) as TicketStatus[];
  const validatedAttachment = safeUrl(ticket.attachment_url);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tickets</span>
        </Link>
        <div className="flex items-center gap-2">
          {ticket.flags.map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
            >
              <ShieldAlert className="w-3 h-3" />
              <span>{flag.replace("_", " ")}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border text-sm flex items-center justify-between ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/60 dark:border-red-800 dark:text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs font-bold px-1.5 py-0.5 hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ticket Header & Metadata */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-indigo-600 dark:text-indigo-400">
              {ticket.id}
            </span>
            {ticket.external_id && (
              <span className="text-xs font-mono text-zinc-400">
                ({ticket.external_id})
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.P3
              }`}
            >
              {ticket.priority}
            </span>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border capitalize ${
                STATUS_STYLES[ticket.status] || STATUS_STYLES.open
              }`}
            >
              {ticket.status.replace("_", " ")}
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 capitalize">
              Plan: {ticket.customer_plan}
            </span>
          </div>
        </div>

        {/* Title / Subject (Plain text, escaped, break-words) */}
        <h1
          className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 break-words"
          dir="auto"
        >
          {ticket.subject || <span className="text-zinc-400 italic">(No subject)</span>}
        </h1>

        {/* Timestamps & SLA */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Created: {new Date(ticket.createdAt).toLocaleString()}</span>
            {ticket.flags.includes("future_date") && (
              <span className="text-amber-600 font-semibold">(Future date clamped)</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">SLA:</span>
            <SlaCountdown
              createdAt={ticket.createdAt}
              priority={ticket.priority}
              status={ticket.status}
              showBadge
            />
          </div>
        </div>
      </div>

      {/* Main Content & Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Body, Attachments, and AI Insights */}
        <div className="md:col-span-2 space-y-6">
          {/* Ticket Body Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Customer Message
            </h3>
            {/* Safe rendering: escaped plain text, break-words, whitespace preserved */}
            <div
              className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words leading-relaxed"
              dir="auto"
            >
              {ticket.body || <span className="text-zinc-400 italic">(No body content provided)</span>}
            </div>

            {/* Attachment Section with Protocol Sanitization */}
            {ticket.attachment_url && (
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Attachment
                </span>
                {validatedAttachment ? (
                  <a
                    href={validatedAttachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="truncate max-w-xs">{validatedAttachment}</span>
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 text-xs font-medium">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <span>Unsafe attachment link blocked ({ticket.attachment_url})</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Triage & Analysis Card */}
          <div className="bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/30 dark:from-purple-950/20 dark:via-zinc-900 dark:to-indigo-950/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-900/40 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  AI Triage Analysis
                </h3>
              </div>
              <button
                onClick={handleRetriage}
                disabled={retriaging}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${retriaging ? "animate-spin" : ""}`} />
                <span>{retriaging ? "Re-triaging..." : "Re-run AI Triage"}</span>
              </button>
            </div>

            {/* AI Summary (Untrusted input: rendered as plain text) */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-500">Summary:</span>
              <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                {ticket.ai_summary || "(No AI summary generated)"}
              </p>
            </div>

            {/* AI vs Final Priority comparison if differing */}
            {ticket.ai_priority && ticket.ai_priority !== ticket.priority && (
              <div className="p-3 rounded-lg bg-purple-100/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs space-y-1">
                <span className="font-semibold text-purple-900 dark:text-purple-200">
                  Priority Adjustment Note:
                </span>
                <p className="text-purple-800 dark:text-purple-300">
                  AI originally suggested <strong>{ticket.ai_priority}</strong>, but final priority is{" "}
                  <strong>{ticket.priority}</strong>.
                </p>
              </div>
            )}

            {/* Review Reason */}
            {ticket.review_reason && (
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold">Reason: </span>
                <span>{ticket.review_reason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Actions & Assignee Panel */}
        <div className="space-y-6">
          {/* Assignee & Claim Panel */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Ticket Assignment
            </h3>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <User className="w-5 h-5 text-zinc-500" />
              <div className="min-w-0">
                <span className="text-xs text-zinc-400 block">Assigned Agent</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                  {assignedName || "Unassigned"}
                </span>
              </div>
            </div>

            {isUnassigned ? (
              <button
                onClick={handleClaim}
                disabled={isPending}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition cursor-pointer"
              >
                {isPending ? "Claiming..." : "Claim This Ticket"}
              </button>
            ) : isAssignedToMe ? (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>You own this ticket</span>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                This ticket is currently assigned to {assignedName}.
              </p>
            )}
          </div>

          {/* Status Transitions Panel */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Status Progression
            </h3>

            {!isAssignedToMe ? (
              <p className="text-xs text-zinc-500">
                Only the assigned agent ({assignedName || "Unassigned"}) can change the status.
              </p>
            ) : allowedNextStatuses.length === 0 ? (
              <p className="text-xs text-zinc-500">No further status transitions available.</p>
            ) : (
              <div className="space-y-2">
                {allowedNextStatuses.map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={isPending}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 transition cursor-pointer capitalize"
                  >
                    {isPending
                      ? "Updating..."
                      : st === "in_progress"
                      ? "Start In-Progress"
                      : st === "resolved"
                      ? "Mark as Resolved"
                      : `Move to ${st.replace("_", " ")}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-4 animate-pulse">
          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
          <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
          <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
      }
    >
      <TicketDetailContent />
    </React.Suspense>
  );
}
