"use client";

import React, { useEffect, useRef, useCallback, Suspense, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  fetchTickets,
  clearMutationError,
  selectAllVisible,
  clearSelection,
} from "@/store/ticketsSlice";
import {
  selectVisibleTicketIds,
  selectTicketsLoading,
  selectTicketsLoadingMore,
  selectTicketsError,
  selectNextCursor,
  selectMutationError,
  selectSelectedTicketIds,
  selectActiveAgent,
  selectAllTickets,
  selectHeaderCounts,
} from "@/store/selectors";
import { FiltersBar } from "@/components/FiltersBar";
import { TicketRow } from "@/components/TicketRow";
import { NewTicketsBanner } from "@/components/NewTicketsBanner";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import {
  AlertCircle,
  RefreshCw,
  Inbox,
  AlertTriangle,
  X,
  Clock,
  UserCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { AGENT_NAMES } from "@/types/ticket";
import { slaStatus } from "@/lib/sla";

type QuickView = "all" | "my_tickets" | "urgent";

function TicketsContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();

  // Background live updates polling (every 5 seconds)
  useLiveUpdates({ intervalMs: 5000 });

  const rawTicketIds = useAppSelector(selectVisibleTicketIds);
  const allTickets = useAppSelector(selectAllTickets);
  const selectedIds = useAppSelector(selectSelectedTicketIds);
  const loading = useAppSelector(selectTicketsLoading);
  const loadingMore = useAppSelector(selectTicketsLoadingMore);
  const error = useAppSelector(selectTicketsError);
  const nextCursor = useAppSelector(selectNextCursor);
  const mutationError = useAppSelector(selectMutationError);
  const currentAgent = useAppSelector(selectActiveAgent);
  const headerCounts = useAppSelector(selectHeaderCounts);

  // Quick view tab state
  const [quickView, setQuickView] = useState<QuickView>("all");

  // Compute live metrics
  const now = Date.now();
  const myAssignedCount = useMemo(
    () => allTickets.filter((t) => t.assigned_to === currentAgent && t.status !== "resolved").length,
    [allTickets, currentAgent]
  );

  const urgentCount = useMemo(
    () =>
      allTickets.filter((t) => {
        if (t.status === "resolved") return false;
        const { state } = slaStatus(t.createdAt, t.priority, now);
        return state === "late" || state === "at_risk";
      }).length,
    [allTickets, now]
  );

  // Filter visible tickets if quickView is active
  const filteredTicketIds = useMemo(() => {
    if (quickView === "all") return rawTicketIds;

    const ticketsMap = new Map(allTickets.map((t) => [t.id, t]));
    return rawTicketIds.filter((id) => {
      const ticket = ticketsMap.get(id);
      if (!ticket) return true;

      if (quickView === "my_tickets") {
        return ticket.assigned_to === currentAgent;
      }
      if (quickView === "urgent") {
        if (ticket.status === "resolved") return false;
        const { state } = slaStatus(ticket.createdAt, ticket.priority, now);
        return state === "late" || state === "at_risk";
      }
      return true;
    });
  }, [rawTicketIds, allTickets, quickView, currentAgent, now]);

  const isAllSelected =
    filteredTicketIds.length > 0 &&
    filteredTicketIds.every((id) => selectedIds.includes(id));

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreObserverRef = useRef<HTMLDivElement | null>(null);

  // Load tickets with URL params and AbortController cancellation
  const load = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    const q = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const category = searchParams.get("category") || undefined;

    dispatch(
      fetchTickets({
        q,
        status,
        priority,
        category,
        append: false,
        signal: ctrl.signal,
      })
    );
  }, [searchParams, dispatch]);

  useEffect(() => {
    load();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [load]);

  // Load more items using cursor pagination
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !nextCursor) return;

    const q = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const category = searchParams.get("category") || undefined;

    dispatch(
      fetchTickets({
        q,
        status,
        priority,
        category,
        cursor: nextCursor,
        append: true,
      })
    );
  }, [loadingMore, nextCursor, searchParams, dispatch]);

  // Infinite Scroll via IntersectionObserver
  useEffect(() => {
    const el = loadMoreObserverRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore && !loading) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore, nextCursor, loadingMore, loading]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Tickets
            </h1>
            <span className="text-xs text-slate-400 font-medium">
              ({allTickets.length} loaded)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active customer requests, SLA countdowns, and quick assignment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
            title="Refresh queue"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-400 ${
                loading ? "animate-spin text-indigo-600" : ""
              }`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Interactive Quick View Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setQuickView("all")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              quickView === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>All Tickets</span>
            <span
              className={`text-[10px] font-semibold px-1 rounded-full ${
                quickView === "all"
                  ? "bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {allTickets.length}
            </span>
          </button>

          <button
            onClick={() => setQuickView("my_tickets")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              quickView === "my_tickets"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Assigned to me</span>
            {myAssignedCount > 0 && (
              <span
                className={`text-[10px] font-semibold px-1 rounded-full ${
                  quickView === "my_tickets"
                    ? "bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                }`}
              >
                {myAssignedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setQuickView("urgent")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              quickView === "urgent"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>SLA at risk</span>
            {urgentCount > 0 && (
              <span
                className={`text-[10px] font-semibold px-1 rounded-full ${
                  quickView === "urgent"
                    ? "bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {urgentCount}
              </span>
            )}
          </button>
        </div>

        {headerCounts.reviewQueue > 0 && (
          <Link
            href="/review"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>AI Review Queue ({headerCounts.reviewQueue})</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </Link>
        )}
      </div>

      {/* Mutation Error Notice */}
      {mutationError && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>{mutationError}</span>
          </div>
          <button
            onClick={() => dispatch(clearMutationError())}
            className="p-0.5 rounded text-amber-700 hover:text-amber-900 dark:hover:text-amber-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <FiltersBar />

      {/* Incoming Tickets Banner */}
      <NewTicketsBanner />

      {/* Network Error */}
      {error && (
        <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
          <h3 className="font-semibold text-rose-900 dark:text-rose-200 text-sm">
            Could not fetch tickets
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-300 max-w-sm mx-auto">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-xs transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Tickets List Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Table Header Row */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={() => {
                if (isAllSelected) {
                  dispatch(clearSelection());
                } else {
                  dispatch(selectAllVisible(filteredTicketIds));
                }
              }}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
              aria-label="Select all visible tickets"
            />
            <span>Ticket</span>
          </div>
          <div className="col-span-2">Priority & Status</div>
          <div className="col-span-4">Subject & Preview</div>
          <div className="col-span-2">SLA Time</div>
          <div className="col-span-2 text-right pr-2">Assignment</div>
        </div>

        {/* Loading Skeletons */}
        {loading && filteredTicketIds.length === 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="p-4 space-y-2 skeleton-shimmer">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-20" />
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-16" />
                </div>
                <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-3/4 ml-7" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredTicketIds.length === 0 && !error && (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {quickView === "my_tickets"
                  ? "No tickets currently assigned to you"
                  : quickView === "urgent"
                  ? "No SLA breaches or at-risk tickets right now"
                  : "No tickets match your filters"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-0.5">
                {quickView !== "all"
                  ? "Switch to 'All Tickets' or clear search filters to view the full queue."
                  : "Try clearing keywords, status, or priority filters."}
              </p>
            </div>
            <button
              onClick={() => {
                setQuickView("all");
                router.replace("/tickets");
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition cursor-pointer"
            >
              <span>Reset view</span>
            </button>
          </div>
        )}

        {/* Render Tickets */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredTicketIds.map((id) => (
            <TicketRow key={id} id={id} />
          ))}
        </div>

        {/* Infinite Scroll Load More */}
        {nextCursor && quickView === "all" && (
          <div
            ref={loadMoreObserverRef}
            className="p-3 text-center border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30"
          >
            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Loading more tickets...</span>
              </div>
            ) : (
              <button
                onClick={handleLoadMore}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                Load more tickets
              </button>
            )}
          </div>
        )}
      </div>

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar />
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400 text-xs">
          Loading tickets...
        </div>
      }
    >
      <TicketsContent />
    </Suspense>
  );
}
