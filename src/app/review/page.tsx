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
} from "lucide-react";

function ReviewContent() {
  const dispatch = useAppDispatch();
  const currentAgent = useAppSelector(selectActiveAgent);
  const allTickets = useAppSelector(selectAllTickets);

  // Background polling for review queue
  useLiveUpdates({ intervalMs: 5000 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Optimistically removed IDs for immediate queue removal
  const [optimisticRemoved, setOptimisticRemoved] = useState<Set<string>>(
    new Set()
  );

  // Expanded editor form states: ticketId -> editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formPriority, setFormPriority] = useState<Priority>("P1");
  const [formCategory, setFormCategory] = useState<Category>("bug");
  const [formReason, setFormReason] = useState<string>("");
  const [formErrors, setFormErrors] = useState<TriageValidationErrors>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Fetch initial review tickets from server
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

  // Review Queue filter: manual_review AND not reviewed yet (Page 2, point 11)
  const reviewTickets = allTickets.filter(
    (t) =>
      t.triage_decision === "manual_review" &&
      !t.reviewed_at &&
      !optimisticRemoved.has(t.id)
  );

  // Action: Accept AI suggestion (Page 6)
  const handleAccept = async (ticket: Ticket) => {
    // Check if ticket has invalid enums (like T-2004)
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

    // Optimistically remove from queue immediately
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
      // Rollback: return to queue
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
    // 1. Client-side fast validation
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

    // 2. Optimistically remove from queue immediately
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
      // Rollback on failure
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              AI Triage Review Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              {reviewTickets.length} pending
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Human-in-the-loop review for ambiguous tickets, prompt injections, and SLA policy constraints.
          </p>
        </div>

        <button
          onClick={loadReviewTickets}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Toast Alert */}
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

      {/* Network Error Box */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
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

      {/* Empty State */}
      {!loading && reviewTickets.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Review Queue All Caught Up!
          </h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto">
            All flagged tickets have been reviewed and approved. New uncertain tickets will appear here automatically via live polling.
          </p>
          <div className="pt-2">
            <Link
              href="/tickets"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
            >
              <span>Back to Tickets List</span>
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

          return (
            <div
              key={ticket.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden transition"
            >
              {/* Card Header */}
              <div className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {ticket.id}
                    </Link>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize">
                      Plan: {ticket.customer_plan}
                    </span>
                    {ticket.flags.map((flag) => (
                      <span
                        key={flag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                      >
                        <ShieldAlert className="w-3 h-3" />
                        <span>{flag.replace("_", " ")}</span>
                      </span>
                    ))}
                  </div>

                  <span className="text-xs text-zinc-400">
                    Created: {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Subject & Body (Safe text rendering, dir="auto") */}
                <div>
                  <h3
                    className="text-base font-semibold text-zinc-900 dark:text-zinc-100 break-words"
                    dir="auto"
                  >
                    {ticket.subject || (
                      <span className="text-zinc-400 italic">(No subject)</span>
                    )}
                  </h3>
                  <p
                    className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words mt-1 line-clamp-3"
                    dir="auto"
                  >
                    {ticket.body || (
                      <span className="text-zinc-400 italic">(No body content)</span>
                    )}
                  </p>
                </div>

                {/* AI Suggestions Box */}
                <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-300">
                    <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>AI Analysis & Proposed Classification:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div>
                      <span className="text-zinc-500">Suggested Priority: </span>
                      <strong className="text-zinc-900 dark:text-zinc-100">
                        {ticket.ai_priority || ticket.priority}
                      </strong>
                    </div>
                    <div>
                      <span className="text-zinc-500">Category: </span>
                      <strong className="text-zinc-900 dark:text-zinc-100">
                        {ticket.category.replace("_", " ")}
                      </strong>
                    </div>
                    {ticket.review_reason && (
                      <div>
                        <span className="text-zinc-500">Flag Reason: </span>
                        <span className="italic text-purple-700 dark:text-purple-300">
                          {ticket.review_reason}
                        </span>
                      </div>
                    )}
                  </div>

                  {ticket.ai_summary && (
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 pt-1 border-t border-purple-200/60 dark:border-purple-900/40">
                      <strong>Summary: </strong>
                      {ticket.ai_summary}
                    </p>
                  )}

                  {/* Enterprise minimum P1 warning */}
                  {isEnterprise &&
                    (ticket.priority === "P2" || ticket.priority === "P3") && (
                      <div className="p-2 rounded bg-amber-100/70 border border-amber-300 text-amber-900 text-xs font-medium">
                        ⚠️ Enterprise rule: AI suggested {ticket.priority}, but Enterprise tickets must stay P1 or higher.
                      </div>
                    )}
                </div>

                {/* Action Buttons */}
                {!isEditing && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAccept(ticket)}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm shadow-emerald-500/20 transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isSubmitting ? "Approving..." : "Accept AI Decision"}</span>
                      </button>

                      <button
                        onClick={() => handleStartEdit(ticket)}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Modify & Triage</span>
                      </button>
                    </div>

                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>View full ticket</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}

                {/* Modify & Triage Inline Form */}
                {isEditing && (
                  <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Adjust Priority, Category & Reasoning
                      </h4>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Priority Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                          Priority {isEnterprise && <span className="text-amber-600 font-normal">(Enterprise min P1)</span>}
                        </label>
                        <select
                          value={formPriority}
                          onChange={(e) => setFormPriority(e.target.value as Priority)}
                          className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {p} {p === "P0" ? "- Critical" : p === "P1" ? "- High" : p === "P2" ? "- Medium" : "- Low"}
                            </option>
                          ))}
                        </select>
                        {formErrors.priority && (
                          <p className="text-xs text-red-600 mt-1">{formErrors.priority}</p>
                        )}
                      </div>

                      {/* Category Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                          Category
                        </label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as Category)}
                          className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                        {formErrors.category && (
                          <p className="text-xs text-red-600 mt-1">{formErrors.category}</p>
                        )}
                      </div>
                    </div>

                    {/* Reason Textarea (10 character minimum rule) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Review Reason (Audit Trail)
                        </label>
                        <span
                          className={`text-[11px] ${
                            formReason.trim().length >= 10
                              ? "text-emerald-600"
                              : "text-amber-600 font-semibold"
                          }`}
                        >
                          {formReason.trim().length}/10 characters min
                        </span>
                      </div>
                      <textarea
                        value={formReason}
                        onChange={(e) => setFormReason(e.target.value)}
                        rows={2}
                        placeholder="Explain why this ticket classification was chosen (at least 10 characters)..."
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                      />
                      {formErrors.reason && (
                        <p className="text-xs text-red-600 mt-0.5">{formErrors.reason}</p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveTriage(ticket)}
                        disabled={isSubmitting}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? "Saving..." : "Save & Approve"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
        <div className="max-w-5xl mx-auto px-4 py-12 text-center text-zinc-400">
          Loading AI review queue...
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
