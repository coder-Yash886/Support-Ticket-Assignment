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
  Copy,
  Check,
  Zap,
  ArrowRight,
  Calendar,
  Layers,
  Inbox,
} from "lucide-react";

const PRIORITY_CONF: Record<
  Priority,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  P0: {
    label: "P0 Critical",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200/80 dark:border-rose-900/50",
    dot: "bg-rose-500",
  },
  P1: {
    label: "P1 High",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200/80 dark:border-amber-900/50",
    dot: "bg-amber-500",
  },
  P2: {
    label: "P2 Normal",
    text: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200/80 dark:border-blue-900/50",
    dot: "bg-blue-500",
  },
  P3: {
    label: "P3 Low",
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
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
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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
      setFetchError((err as Error)?.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [id, dispatch]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const handleCopyId = () => {
    if (!ticket) return;
    navigator.clipboard?.writeText(ticket.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClaim = async () => {
    if (isPending || !ticket) return;
    try {
      const result = await dispatch(claimTicket(ticket.id)).unwrap();
      setToastMessage({
        type: "success",
        text: `Claimed ticket ${result.id}`,
      });
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err?.message || "Failed to claim ticket",
      });
      loadTicket();
    }
  };

  const handleStatusChange = async (nextStatus: TicketStatus) => {
    if (isPending || !ticket) return;
    try {
      await dispatch(changeStatus({ id: ticket.id, to: nextStatus })).unwrap();
      setToastMessage({
        type: "success",
        text: `Status changed to ${STATUS_LABELS[nextStatus]}`,
      });
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err?.message || "Failed to update status",
      });
      loadTicket();
    }
  };

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
        text: "Triage re-evaluated successfully",
      });
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to re-run triage",
      });
    } finally {
      setRetriaging(false);
    }
  };

  if (notFound) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Inbox className="w-5 h-5" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Ticket Not Found
        </h2>
        <p className="text-xs text-slate-500">
          No ticket was found matching ID <code className="font-mono">{id}</code>.
        </p>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to tickets</span>
        </Link>
      </div>
    );
  }

  if (fetchError && !ticket) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Error Loading Ticket
        </h2>
        <p className="text-xs text-slate-500">{fetchError}</p>
        <button
          onClick={loadTicket}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-medium cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  if (loading && !ticket) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-32 skeleton-shimmer" />
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl skeleton-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-64 bg-slate-200 dark:bg-slate-800 rounded-xl skeleton-shimmer" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  const isAssignedToMe = ticket.assigned_to === currentAgent;
  const isUnassigned = !ticket.assigned_to;
  const assignedName = ticket.assigned_to
    ? AGENT_NAMES[ticket.assigned_to as AgentId] || `Agent (${ticket.assigned_to})`
    : null;

  const allowedNextStatuses = (NEXT_ALLOWED_STATUS[ticket.status] || []) as TicketStatus[];
  const validatedAttachment = safeUrl(ticket.attachment_url);
  const priorityStyle = PRIORITY_CONF[ticket.priority] || PRIORITY_CONF.P3;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/tickets"
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tickets</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
            {ticket.id}
          </span>
          <button
            onClick={handleCopyId}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Copy ticket ID"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Security & Review Flags */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ticket.flags.map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60"
            >
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              <span>{flag.replace("_", " ")}</span>
            </span>
          ))}
          {ticket.triage_decision === "manual_review" && !ticket.reviewed_at && (
            <Link
              href="/review"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>Needs AI Review</span>
            </Link>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between animate-in fade-in ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200"
              : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ticket Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${priorityStyle.bg} ${priorityStyle.border} ${priorityStyle.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
              <span>{priorityStyle.label}</span>
            </span>

            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize">
              {STATUS_LABELS[ticket.status]}
            </span>

            {ticket.customer_plan && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wider">
                {ticket.customer_plan}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">SLA:</span>
            <SlaCountdown
              createdAt={ticket.createdAt}
              priority={ticket.priority}
              status={ticket.status}
              showBadge
            />
          </div>
        </div>

        <h1
          className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words tracking-tight"
          dir="auto"
        >
          {ticket.subject || (
            <span className="text-slate-400 italic">(No subject specified)</span>
          )}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Created {new Date(ticket.createdAt).toLocaleString()}</span>
          </div>

          {ticket.external_id && (
            <span className="font-mono text-slate-400">
              Ref: {ticket.external_id}
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: Content & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Customer Message & AI Assessment */}
        <div className="lg:col-span-8 space-y-5">
          {/* Customer Message Box */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                  C
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Customer Request
                </span>
              </div>
              <span className="text-[11px] text-slate-400 capitalize">
                Plan: {ticket.customer_plan}
              </span>
            </div>

            <div
              className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed font-normal"
              dir="auto"
            >
              {ticket.body || (
                <span className="text-slate-400 italic">(No message body provided)</span>
              )}
            </div>

            {/* Inbound Attachment */}
            {ticket.attachment_url && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Attachment
                </span>
                {validatedAttachment ? (
                  <a
                    href={validatedAttachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-xs font-medium transition"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="truncate max-w-xs">{validatedAttachment}</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs">
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Unsafe attachment blocked ({ticket.attachment_url})</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Triage Assessment Note */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Triage Assessment
                </h3>
              </div>
              <button
                onClick={handleRetriage}
                disabled={retriaging}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3 h-3 ${retriaging ? "animate-spin text-purple-600" : ""}`} />
                <span>{retriaging ? "Analyzing..." : "Re-evaluate"}</span>
              </button>
            </div>

            {ticket.ai_summary && (
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-0.5">
                  Summary:
                </span>
                {ticket.ai_summary}
              </div>
            )}

            {ticket.ai_priority && ticket.ai_priority !== ticket.priority && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs space-y-0.5">
                <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Priority Override</span>
                </span>
                <p className="text-amber-800 dark:text-amber-300">
                  Model proposed {ticket.ai_priority}, effective priority resolved to {ticket.priority}.
                </p>
              </div>
            )}

            {ticket.review_reason && (
              <p className="text-xs text-slate-500">
                <span className="font-medium">Note:</span> {ticket.review_reason}
              </p>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Ownership & Workflow Actions */}
        <div className="lg:col-span-4 space-y-4">
          {/* Assignment Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Assignee
            </h4>

            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="w-7 h-7 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs">
                {assignedName ? assignedName.slice(0, 2).toUpperCase() : "?"}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block truncate">
                  {assignedName || "Unassigned"}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {isAssignedToMe ? "You are active owner" : "Support team"}
                </span>
              </div>
            </div>

            {isUnassigned ? (
              <button
                onClick={handleClaim}
                disabled={isPending}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500" />
                <span>{isPending ? "Claiming..." : "Claim this ticket"}</span>
              </button>
            ) : isAssignedToMe ? (
              <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Assigned to you</span>
              </div>
            ) : null}
          </div>

          {/* Status Progression */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Status Actions
            </h4>

            {!isAssignedToMe ? (
              <p className="text-xs text-slate-500">
                Only the assigned agent ({assignedName || "Unassigned"}) can change ticket status.
              </p>
            ) : allowedNextStatuses.length === 0 ? (
              <p className="text-xs text-slate-500">
                Ticket is resolved.
              </p>
            ) : (
              <div className="space-y-1.5">
                {allowedNextStatuses.map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={isPending}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isPending ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3 h-3" />
                    )}
                    <span>
                      {st === "in_progress"
                        ? "Start Progress"
                        : st === "resolved"
                        ? "Mark as Resolved"
                        : `Move to ${st.replace("_", " ")}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ticket Properties */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Details
            </h4>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-400">Category</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                {ticket.category.replace("_", " ")}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-400">Plan</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                {ticket.customer_plan}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-400">Triage Decision</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                {ticket.triage_decision.replace("_", " ")}
              </span>
            </div>
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
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-slate-400 text-xs">
          Loading ticket...
        </div>
      }
    >
      <TicketDetailContent />
    </React.Suspense>
  );
}

