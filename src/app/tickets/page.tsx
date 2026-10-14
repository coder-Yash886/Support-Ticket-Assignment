"use client";

import React, { useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
} from "@/store/selectors";
import { FiltersBar } from "@/components/FiltersBar";
import { TicketRow } from "@/components/TicketRow";
import { NewTicketsBanner } from "@/components/NewTicketsBanner";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import { AlertCircle, RefreshCw, Inbox, AlertTriangle, X } from "lucide-react";

function TicketsContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();

  // Background live updates polling (every 5 seconds, pauses when hidden)
  useLiveUpdates({ intervalMs: 5000 });

  const ticketIds = useAppSelector(selectVisibleTicketIds);
  const selectedIds = useAppSelector(selectSelectedTicketIds);
  const loading = useAppSelector(selectTicketsLoading);
  const loadingMore = useAppSelector(selectTicketsLoadingMore);
  const error = useAppSelector(selectTicketsError);
  const nextCursor = useAppSelector(selectNextCursor);
  const mutationError = useAppSelector(selectMutationError);

  const isAllSelected =
    ticketIds.length > 0 && ticketIds.every((id) => selectedIds.includes(id));

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreObserverRef = useRef<HTMLDivElement | null>(null);

  // Load tickets with URL params and AbortController cancellation (Page 5, 7.8)
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Support Tickets
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Real-time queue with SLA tracking and cursor keyset pagination
          </p>
        </div>
      </div>

      {/* Transient Mutation Error Toast (e.g. 409 Conflict rollback) */}
      {mutationError && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>{mutationError}</span>
          </div>
          <button
            onClick={() => dispatch(clearMutationError())}
            className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <FiltersBar />

      {/* New Incoming Tickets Floating Banner */}
      <NewTicketsBanner />

      {/* Error state with manual retry button */}
      {error && (
        <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-200">
              Error Loading Tickets
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Request</span>
          </button>
        </div>
      )}

      {/* Tickets List / Table Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Desktop Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={() => {
                if (isAllSelected) {
                  dispatch(clearSelection());
                } else {
                  dispatch(selectAllVisible(ticketIds));
                }
              }}
              className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              aria-label="Select all visible tickets"
            />
            <span>ID & Flags</span>
          </div>
          <div className="col-span-2">Priority / Status</div>
          <div className="col-span-4">Subject & Content</div>
          <div className="col-span-2">SLA Status</div>
          <div className="col-span-2 text-right">Assignee / Action</div>
        </div>

        {/* Loading Skeleton on Initial Fetch */}
        {loading && ticketIds.length === 0 && (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="p-4 space-y-2 animate-pulse">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && ticketIds.length === 0 && !error && (
          <div className="p-12 text-center space-y-3">
            <Inbox className="w-10 h-10 text-zinc-400 mx-auto" />
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
              No tickets match these filters
            </h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Try adjusting your search terms or clearing the current priority and category filters.
            </p>
          </div>
        )}

        {/* Render Tickets using React.memo rows */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {ticketIds.map((id) => (
            <TicketRow key={id} id={id} />
          ))}
        </div>

        {/* Infinite Scroll Trigger / Load More Bar */}
        {nextCursor && (
          <div ref={loadMoreObserverRef} className="p-4 text-center border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading more tickets...</span>
              </div>
            ) : (
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 transition"
              >
                Load More Tickets
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
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-zinc-400">
          Loading ticket dashboard...
        </div>
      }
    >
      <TicketsContent />
    </Suspense>
  );
}
