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

  // Auto-dismiss mutation error banner after 5 seconds
  useEffect(() => {
    if (!mutationError) return;
    const timer = setTimeout(() => {
      dispatch(clearMutationError());
    }, 5000);
    return () => clearTimeout(timer);
  }, [mutationError, dispatch]);

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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Tickets
            </h1>
            <span className="text-xs text-slate-500 font-medium">
              ({allTickets.length} loaded)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Active customer requests, SLA countdowns, and quick assignment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
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

      {/* Clean Segmented Quick View Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setQuickView("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition cursor-pointer ${
              quickView === "all"
                ? "bg-white text-slate-900 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            <span>All Tickets</span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                quickView === "all"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              {allTickets.length}
            </span>
          </button>

          <button
            onClick={() => setQuickView("my_tickets")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition cursor-pointer ${
              quickView === "my_tickets"
                ? "bg-white text-indigo-700 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Assigned to me</span>
            {myAssignedCount > 0 && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                  quickView === "my_tickets"
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {myAssignedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setQuickView("urgent")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition cursor-pointer ${
              quickView === "urgent"
                ? "bg-white text-amber-700 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>SLA at risk</span>
            {urgentCount > 0 && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                  quickView === "urgent"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-200/70 text-slate-600"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 transition shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>AI Review Queue ({headerCounts.reviewQueue})</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </Link>
        )}
      </div>

      {/* Mutation Error Notice (Auto-dismisses in 5s) */}
      {mutationError && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-medium truncate">{mutationError}</span>
          </div>
          <button
            onClick={() => dispatch(clearMutationError())}
            className="flex-shrink-0 ml-3 text-[11px] font-semibold text-amber-800 hover:text-amber-950 px-2 py-0.5 rounded hover:bg-amber-100 transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <FiltersBar />

      {/* Incoming Tickets Banner */}
      <NewTicketsBanner />

      {/* Network Error */}
      {error && (
        <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
          <h3 className="font-semibold text-rose-900 text-sm">
            Could not fetch tickets
          </h3>
          <p className="text-xs text-rose-700 max-w-sm mx-auto">{error}</p>
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Table Header Row */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
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
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
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
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="p-4 space-y-2 skeleton-shimmer">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-slate-200 rounded" />
                  <div className="h-3.5 bg-slate-200 rounded w-20" />
                  <div className="h-3.5 bg-slate-200 rounded w-16" />
                </div>
                <div className="h-3.5 bg-slate-200 rounded w-3/4 ml-7" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredTicketIds.length === 0 && !error && (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {quickView === "my_tickets"
                  ? "No tickets currently assigned to you"
                  : quickView === "urgent"
                  ? "No SLA breaches or at-risk tickets right now"
                  : "No tickets match your filters"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
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
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition cursor-pointer"
            >
              <span>Reset view</span>
            </button>
          </div>
        )}

        {/* Render Tickets */}
        <div className="divide-y divide-slate-100">
          {filteredTicketIds.map((id) => (
            <TicketRow key={id} id={id} />
          ))}
        </div>

        {/* Infinite Scroll Load More */}
        {nextCursor && quickView === "all" && (
          <div
            ref={loadMoreObserverRef}
            className="p-3 text-center border-t border-slate-200 bg-slate-50/50"
          >
            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Loading more tickets...</span>
              </div>
            ) : (
              <button
                onClick={handleLoadMore}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition cursor-pointer"
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
