"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store";
import { selectAllTickets, selectActiveAgent } from "@/store/selectors";
import { upsertSingleTicket } from "@/store/ticketsSlice";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import { validateTriage, TriageValidationErrors } from "@/server/rules";
import {
  PRIORITIES,
  CATEGORIES,
  Priority,
  Category,
  Ticket,
} from "@/types/ticket";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Bot,
  RefreshCw,
  Edit3,
  X,
  Inbox,
  AlertCircle,
  Check,
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

const CATEGORY_NAMES: Record<Category, string> = {
  billing: "Billing",
  bug: "Bug Report",
  account_access: "Account Access",
  feature_request: "Feature Request",
  other: "General",
};

const REASON_TEMPLATES = [
  "Verified customer request and validated priority classification.",
  "Adjusted per Enterprise SLA policy guidelines.",
  "Security audit cleared after payload analysis.",
  "Technical reproduction steps validated by support team.",
];

function ReviewContent() {
  const dispatch = useAppDispatch();
  const currentAgent = useAppSelector(selectActiveAgent);
  const allTickets = useAppSelector(selectAllTickets);

  useLiveUpdates({ intervalMs: 5000 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Optimistically removed IDs for immediate UI responsiveness
  const [optimisticRemoved, setOptimisticRemoved] = useState<Set<string>>(
    new Set()
  );

  // Editor states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formPriority, setFormPriority] = useState<Priority>("P1");
  const [formCategory, setFormCategory] = useState<Category>("bug");
  const [formReason, setFormReason] = useState<string>("");
  const [formErrors, setFormErrors] = useState<TriageValidationErrors>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Load review tickets from server
  const loadReviewTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets?limit=100");
      if (!res.ok) throw new Error("Failed to load review tickets");
      const data = await res.json();
      if (Array.isArray(data.tickets)) {
        for (const t of data.tickets) {
          dispatch(upsertSingleTicket(t));
        }
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to fetch review items");
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadReviewTickets();
  }, [loadReviewTickets]);

  // Review Queue filter: manual_review AND not reviewed yet
  const reviewTickets = allTickets.filter(
    (t) =>
      t.triage_decision === "manual_review" &&
      !t.reviewed_at &&
      !optimisticRemoved.has(t.id)
  );

  // Action: Accept AI suggestion
  const handleAccept = async (ticket: Ticket) => {
    if (
      ticket.flags.includes("invalid_priority") ||
      ticket.flags.includes("invalid_category")
    ) {
      setToastMessage({
        type: "error",
        text: "Cannot accept invalid AI outputs. Please use 'Modify & Triage' to pick a valid priority and category.",
      });
      return;
    }

    setOptimisticRemoved((prev) => new Set(prev).add(ticket.id));
    setSubmittingId(ticket.id);

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/triage`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Id": currentAgent,
        },
        body: JSON.stringify({ action: "accept" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to approve triage");
      }

      const updated = await res.json();
      dispatch(upsertSingleTicket(updated));
      setToastMessage({
        type: "success",
        text: `Approved triage for ticket ${ticket.id}`,
      });
    } catch (err: any) {
      setOptimisticRemoved((prev) => {
        const copy = new Set(prev);
        copy.delete(ticket.id);
        return copy;
      });
      setToastMessage({
        type: "error",
        text: err.message || "Approval failed. Ticket returned to queue.",
      });
    } finally {
      setSubmittingId(null);
    }
  };

  // Action: Open editor form
  const handleStartEdit = (ticket: Ticket) => {
    setEditingId(ticket.id);
    setFormPriority(
      PRIORITIES.includes(ticket.priority as Priority) ? ticket.priority : "P1"
    );
    setFormCategory(
      CATEGORIES.includes(ticket.category as Category) ? ticket.category : "bug"
    );
    setFormReason(
      ticket.review_reason || "Manually adjusted after agent evaluation."
    );
    setFormErrors({});
  };

  // Action: Submit manual triage adjustment
  const handleSaveTriage = async (ticket: Ticket) => {
    const errors = validateTriage(
      ticket.customer_plan,
      formPriority,
      formCategory,
      formReason
    );
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setOptimisticRemoved((prev) => new Set(prev).add(ticket.id));
    setSubmittingId(ticket.id);

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/triage`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Id": currentAgent,
        },
        body: JSON.stringify({
          action: "change",
          priority: formPriority,
          category: formCategory,
          reason: formReason,
        }),
      });

      if (res.status === 422) {
        const data = await res.json();
        setFormErrors(data.errors || {});
        throw new Error("Validation rejected by server");
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save triage modification");
      }

      const updated = await res.json();
      dispatch(upsertSingleTicket(updated));
      setEditingId(null);
      setToastMessage({
        type: "success",
        text: `Triaged and updated ticket ${ticket.id}`,
      });
    } catch (err: any) {
      setOptimisticRemoved((prev) => {
        const copy = new Set(prev);
        copy.delete(ticket.id);
        return copy;
      });
      setToastMessage({
        type: "error",
        text: err.message || "Triage failed. Ticket returned to queue.",
      });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title & Introduction */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Triage Review
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              {reviewTickets.length} pending
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Human-in-the-loop review for ambiguous classifications and policy constraints.
          </p>
        </div>

        <button
          onClick={loadReviewTickets}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-slate-400 ${
              loading ? "animate-spin text-purple-600" : ""
            }`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Toast Alert */}
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

      {/* Network Error Box */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadReviewTickets}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State: Inbox Zero */}
      {!loading && reviewTickets.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Review Queue All Caught Up
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            All tickets requiring manual evaluation have been resolved. New ambiguous tickets will appear here automatically.
          </p>
          <div className="pt-2">
            <Link
              href="/tickets"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition"
            >
              <span>Back to Tickets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Review Queue Cards */}
      <div className="space-y-4">
        {reviewTickets.map((ticket) => {
          const isSubmitting = submittingId === ticket.id;
          const isEditing = editingId === ticket.id;
          const isEnterprise = ticket.customer_plan === "enterprise";
          const priorityConf =
            PRIORITY_CONF[ticket.priority as Priority] || PRIORITY_CONF.P3;

          return (
            <div
              key={ticket.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 transition"
            >
              {/* Header: ID, Plan, Flags, Created */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    {ticket.id}
                  </Link>

                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
                    {ticket.customer_plan}
                  </span>

                  {ticket.flags.map((flag) => (
                    <span
                      key={flag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
                    >
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      <span>{flag.replace("_", " ")}</span>
                    </span>
                  ))}
                </div>

                <span className="text-xs text-slate-400">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Subject & Description */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 space-y-2">
                  <h3
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                    dir="auto"
                  >
                    {ticket.subject || (
                      <span className="text-slate-400 italic">(No subject)</span>
                    )}
                  </h3>
                  <p
                    className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed line-clamp-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                    dir="auto"
                  >
                    {ticket.body || (
                      <span className="text-slate-400 italic">(No body content)</span>
                    )}
                  </p>
                </div>

                {/* Proposed Triage Recommendation Box */}
                <div className="lg:col-span-5 p-3.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 dark:text-purple-300">
                    <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Proposed Triage:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Priority:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {ticket.ai_priority || ticket.priority}
                      </span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Category:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                        {ticket.category.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {ticket.ai_summary && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic pt-1 border-t border-purple-100 dark:border-purple-900/40">
                      &ldquo;{ticket.ai_summary}&rdquo;
                    </p>
                  )}

                  {ticket.review_reason && (
                    <div className="text-[11px] text-purple-800 dark:text-purple-300">
                      Reason: {ticket.review_reason}
                    </div>
                  )}

                  {isEnterprise &&
                    (ticket.priority === "P2" || ticket.priority === "P3") && (
                      <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                        Enterprise policy: Requires minimum P1 priority.
                      </div>
                    )}
                </div>
              </div>

              {/* Bottom Actions */}
              {!isEditing && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAccept(ticket)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition cursor-pointer"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{isSubmitting ? "Approving..." : "Approve Triage"}</span>
                    </button>

                    <button
                      onClick={() => handleStartEdit(ticket)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Adjust & Triage</span>
                    </button>
                  </div>

                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
                  >
                    <span>View ticket</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Inline Adjustment Form */}
              {isEditing && (
                <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Adjust Classification & Justification
                    </h4>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Priority Select */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Priority Level {isEnterprise && <span className="text-amber-600 font-semibold">(Enterprise min P1)</span>}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRIORITIES.map((p) => {
                        const conf = PRIORITY_CONF[p];
                        const isSelected = formPriority === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setFormPriority(p)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                              isSelected
                                ? `${conf.bg} ${conf.border} ${conf.text} ring-2 ring-indigo-500/20`
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                            <span>{conf.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {formErrors.priority && (
                      <p className="text-xs text-rose-600 font-medium mt-1">
                        {formErrors.priority}
                      </p>
                    )}
                  </div>

                  {/* Category Select */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Category
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((c) => {
                        const isSelected = formCategory === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setFormCategory(c)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                              isSelected
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent"
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            <span>{CATEGORY_NAMES[c] || c}</span>
                          </button>
                        );
                      })}
                    </div>
                    {formErrors.category && (
                      <p className="text-xs text-rose-600 font-medium mt-1">
                        {formErrors.category}
                      </p>
                    )}
                  </div>

                  {/* Reason Input */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Reason for modification
                    </label>
                    <textarea
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                      placeholder="State reason for overriding or adjusting priority/category..."
                      rows={2}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {formErrors.reason && (
                      <p className="text-xs text-rose-600 font-medium mt-0.5">
                        {formErrors.reason}
                      </p>
                    )}

                    {/* Quick Reason Templates */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {REASON_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl}
                          type="button"
                          onClick={() => setFormReason(tmpl)}
                          className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded cursor-pointer transition truncate max-w-xs"
                          title={tmpl}
                        >
                          + {tmpl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleSaveTriage(ticket)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition cursor-pointer"
                    >
                      {isSubmitting ? "Saving..." : "Save Classification"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 py-16 text-center text-slate-400 text-xs">
          Loading review queue...
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
