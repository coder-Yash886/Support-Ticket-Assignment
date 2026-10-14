import {
  createSlice,
  createAsyncThunk,
  createEntityAdapter,
  PayloadAction,
} from "@reduxjs/toolkit";
import { Ticket, TicketStatus } from "@/types/ticket";
import { safeFetch } from "@/lib/http";
import type { RootState } from "./index";

export const ticketsAdapter = createEntityAdapter<Ticket, string>({
  selectId: (ticket: Ticket) => ticket.id,
  sortComparer: (a, b) => {
    if (b.createdAt !== a.createdAt) {
      return b.createdAt - a.createdAt;
    }
    return b.id.localeCompare(a.id);
  },
});

export interface PendingSnapshot {
  assigned_to: string | null;
  status: TicketStatus;
}

export interface TicketsState
  extends ReturnType<typeof ticketsAdapter.getInitialState> {
  nextCursor: string | null;
  totalFiltered: number;
  totalAll: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  serverTime: number;
  // Maps ticketId to snapshot before optimistic mutation
  pending: Record<string, PendingSnapshot>;
  // IDs of new tickets buffered for the banner
  pendingNewIds: string[];
  // Transient error message for toast / inline banner
  mutationError: string | null;
  // Selected IDs for bulk actions
  selectedTicketIds: string[];
}

const initialState: TicketsState = ticketsAdapter.getInitialState({
  nextCursor: null,
  totalFiltered: 0,
  totalAll: 0,
  loading: false,
  loadingMore: false,
  error: null,
  serverTime: 0,
  pending: {},
  pendingNewIds: [],
  mutationError: null,
  selectedTicketIds: [],
});

// Async Thunk: Fetch Tickets with Cursor Pagination and Cancellation
export const fetchTickets = createAsyncThunk<
  {
    tickets: Ticket[];
    nextCursor: string | null;
    totalFiltered: number;
    totalAll: number;
    append: boolean;
  },
  {
    q?: string;
    status?: string;
    priority?: string;
    category?: string;
    cursor?: string | null;
    append?: boolean;
    signal?: AbortSignal;
  },
  { rejectValue: string }
>("tickets/fetchTickets", async (params, { rejectWithValue }) => {
  try {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status && params.status !== "all") search.set("status", params.status);
    if (params.priority && params.priority !== "all") search.set("priority", params.priority);
    if (params.category && params.category !== "all") search.set("category", params.category);
    if (params.cursor) search.set("cursor", params.cursor);
    search.set("limit", "25");

    const res = await safeFetch(`/api/tickets?${search.toString()}`, {
      signal: params.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err.error || `Failed to fetch tickets: ${res.status}`);
    }

    const data = await res.json();
    return {
      tickets: data.tickets,
      nextCursor: data.nextCursor,
      totalFiltered: data.totalFiltered,
      totalAll: data.totalAll,
      append: !!params.append,
    };
  } catch (err: unknown) {
    if ((err as Error)?.name === "AbortError") {
      return rejectWithValue("ABORTED");
    }
    return rejectWithValue((err as Error)?.message || "Network error");
  }
});

// Async Thunk: Optimistic Claim Ticket with Rollback
export const claimTicket = createAsyncThunk<
  Ticket,
  string,
  { state: RootState; rejectValue: { status: number; message: string } }
>("tickets/claim", async (id: string, { getState, rejectWithValue }) => {
  const agent = getState().agent.current;
  const res = await fetch(`/api/tickets/${id}/claim`, {
    method: "POST",
    headers: {
      "X-Agent-Id": agent,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Claim failed" }));
    return rejectWithValue({
      status: res.status,
      message: errorData.error || `Server error (${res.status})`,
    });
  }

  return (await res.json()) as Ticket;
});

// Async Thunk: Optimistic Status Transition with Double-click Guard
export const changeStatus = createAsyncThunk<
  Ticket,
  { id: string; to: TicketStatus },
  { state: RootState; rejectValue: { status: number; message: string } }
>("tickets/changeStatus", async ({ id, to }, { getState, rejectWithValue }) => {
  const agent = getState().agent.current;
  const res = await fetch(`/api/tickets/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Id": agent,
    },
    body: JSON.stringify({ status: to }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Transition failed" }));
    return rejectWithValue({
      status: res.status,
      message: errorData.error || `Server error (${res.status})`,
    });
  }

  return (await res.json()) as Ticket;
});

export const ticketsSlice = createSlice({
  name: "tickets",
  initialState,
  reducers: {
    clearMutationError(state) {
      state.mutationError = null;
    },
    // Merges buffered incoming tickets into the visible list when user clicks banner
    mergeNewTickets(state) {
      state.pendingNewIds = [];
    },
    // Background polling update logic (Page 6)
    applyUpdates(
      state,
      action: PayloadAction<{ tickets: Ticket[]; serverTime: number }>
    ) {
      state.serverTime = action.payload.serverTime;
      for (const t of action.payload.tickets) {
        // Skip any ticket that currently has an in-flight optimistic mutation
        if (state.pending[t.id]) continue;

        const isKnown = !!state.entities[t.id];
        if (isKnown) {
          // Merge in-place for existing known tickets
          ticketsAdapter.upsertOne(state, t);
        } else {
          // New incoming ticket -> add to pendingNewIds buffer (do not jolt UI)
          ticketsAdapter.upsertOne(state, t);
          if (!state.pendingNewIds.includes(t.id)) {
            state.pendingNewIds.push(t.id);
          }
        }
      }
    },
    upsertSingleTicket(state, action: PayloadAction<Ticket>) {
      ticketsAdapter.upsertOne(state, action.payload);
    },
    toggleSelectTicket(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedTicketIds.indexOf(id);
      if (idx !== -1) {
        state.selectedTicketIds.splice(idx, 1);
      } else {
        state.selectedTicketIds.push(id);
      }
    },
    selectAllVisible(state, action: PayloadAction<string[]>) {
      state.selectedTicketIds = action.payload;
    },
    clearSelection(state) {
      state.selectedTicketIds = [];
    },
  },
  extraReducers: (builder) => {
    // --- Fetch Tickets ---
    builder.addCase(fetchTickets.pending, (state, action) => {
      if (action.meta.arg.append) {
        state.loadingMore = true;
      } else {
        state.loading = true;
      }
      state.error = null;
    });
    builder.addCase(fetchTickets.fulfilled, (state, action) => {
      state.loading = false;
      state.loadingMore = false;
      state.nextCursor = action.payload.nextCursor;
      state.totalFiltered = action.payload.totalFiltered;
      state.totalAll = action.payload.totalAll;

      if (action.payload.append) {
        ticketsAdapter.upsertMany(state, action.payload.tickets);
      } else {
        ticketsAdapter.setAll(state, action.payload.tickets);
      }
    });
    builder.addCase(fetchTickets.rejected, (state, action) => {
      if (action.payload === "ABORTED") return; // Stale debounced search
      state.loading = false;
      state.loadingMore = false;
      state.error = action.payload || "Failed to load tickets";
    });

    // --- Claim Ticket with Optimistic Rollback ---
    builder.addCase(claimTicket.pending, (state, action) => {
      const id = action.meta.arg;
      const t = state.entities[id];
      if (!t) return;

      // Save previous snapshot
      state.pending[id] = {
        assigned_to: t.assigned_to,
        status: t.status,
      };

      // Apply instant optimistic update
      // Note: agent will be overwritten by fulfilled or rolled back by rejected
      const currentAgent = (action as any).meta?.agent || "agent-1";
      t.assigned_to = currentAgent;
      state.mutationError = null;
    });
    builder.addCase(claimTicket.fulfilled, (state, action) => {
      const id = action.meta.arg;
      delete state.pending[id];
      ticketsAdapter.upsertOne(state, action.payload);
    });
    builder.addCase(claimTicket.rejected, (state, action) => {
      const id = action.meta.arg;
      const prev = state.pending[id];
      if (prev && state.entities[id]) {
        // Rollback to previous snapshot
        state.entities[id]!.assigned_to = prev.assigned_to;
        state.entities[id]!.status = prev.status;
      }
      delete state.pending[id];
      state.mutationError =
        action.payload?.message || "Failed to claim ticket. Rolled back.";
    });

    // --- Change Status with Optimistic Rollback ---
    builder.addCase(changeStatus.pending, (state, action) => {
      const { id, to } = action.meta.arg;
      const t = state.entities[id];
      if (!t) return;

      state.pending[id] = {
        assigned_to: t.assigned_to,
        status: t.status,
      };
      t.status = to;
      state.mutationError = null;
    });
    builder.addCase(changeStatus.fulfilled, (state, action) => {
      const { id } = action.meta.arg;
      delete state.pending[id];
      ticketsAdapter.upsertOne(state, action.payload);
    });
    builder.addCase(changeStatus.rejected, (state, action) => {
      const { id } = action.meta.arg;
      const prev = state.pending[id];
      if (prev && state.entities[id]) {
        state.entities[id]!.status = prev.status;
      }
      delete state.pending[id];
      state.mutationError =
        action.payload?.message || "Status transition failed. Rolled back.";
    });
  },
});

export const {
  clearMutationError,
  mergeNewTickets,
  applyUpdates,
  upsertSingleTicket,
  toggleSelectTicket,
  selectAllVisible,
  clearSelection,
} = ticketsSlice.actions;

export default ticketsSlice.reducer;
