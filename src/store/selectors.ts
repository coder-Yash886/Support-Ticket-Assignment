import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "./index";
import { ticketsAdapter } from "./ticketsSlice";

export const {
  selectAll: selectAllTickets,
  selectById: selectTicketById,
  selectIds: selectTicketIds,
} = ticketsAdapter.getSelectors<RootState>((state) => state.tickets);

export const selectActiveAgent = (state: RootState) => state.agent.current;
export const selectActiveFilters = (state: RootState) => state.filters;
export const selectPendingNewCount = (state: RootState) => state.tickets.pendingNewIds.length;
export const selectIsPendingMutation = (id: string) => (state: RootState) =>
  Boolean(state.tickets.pending[id]);

export const selectMutationError = (state: RootState) => state.tickets.mutationError;
export const selectTicketsLoading = (state: RootState) => state.tickets.loading;
export const selectTicketsLoadingMore = (state: RootState) => state.tickets.loadingMore;
export const selectTicketsError = (state: RootState) => state.tickets.error;
export const selectNextCursor = (state: RootState) => state.tickets.nextCursor;

// Filtered Ticket IDs for high-performance virtualized or list rendering
export const selectVisibleTicketIds = createSelector(
  [selectAllTickets, selectActiveFilters, (state: RootState) => state.tickets.pendingNewIds],
  (tickets, filters, pendingNewIds) => {
    const pendingSet = new Set(pendingNewIds);
    const query = filters.q.trim().toLowerCase();

    return tickets
      .filter((t) => {
        // Hide newly buffered tickets until user clicks banner
        if (pendingSet.has(t.id)) return false;

        if (filters.status !== "all" && t.status !== filters.status) return false;
        if (filters.priority !== "all" && t.priority !== filters.priority) return false;
        if (filters.category !== "all" && t.category !== filters.category) return false;

        if (query) {
          const inId = t.id.toLowerCase().includes(query);
          const inSubj = t.subject.toLowerCase().includes(query);
          const inBody = t.body.toLowerCase().includes(query);
          const inSummary = (t.ai_summary ?? "").toLowerCase().includes(query);
          if (!inId && !inSubj && !inBody && !inSummary) return false;
        }

        return true;
      })
      .map((t) => t.id);
  }
);

// Dynamic Header counts derived from local Redux entities
export const selectHeaderCounts = createSelector(
  [selectAllTickets, selectActiveAgent],
  (tickets, currentAgent) => {
    let myTicketsCount = 0;
    let reviewQueueCount = 0;

    for (const t of tickets) {
      if (t.assigned_to === currentAgent && t.status !== "resolved") {
        myTicketsCount++;
      }
      if (t.triage_decision === "manual_review" && !t.reviewed_at) {
        reviewQueueCount++;
      }
    }

    return {
      myTickets: myTicketsCount,
      reviewQueue: reviewQueueCount,
      total: tickets.length,
    };
  }
);
