import { describe, it, expect } from "vitest";
import ticketsReducer, {
  claimTicket,
  changeStatus,
  mergeNewTickets,
  applyUpdates,
  ticketsAdapter,
} from "./ticketsSlice";
import { Ticket } from "@/types/ticket";

const mockTicket: Ticket = {
  id: "T-TEST-1",
  subject: "Testing claim rollback",
  body: "Body content",
  priority: "P1",
  category: "bug",
  status: "open",
  customer_plan: "pro",
  assigned_to: null,
  created_at: new Date().toISOString(),
  createdAt: Date.now(),
  triage_decision: "auto_accept",
  flags: [],
};

describe("Redux Tickets Slice & Optimistic Mutations", () => {
  it("optimistically assigns ticket on claim.pending, and restores snapshot on claim.rejected", () => {
    // 1. Initial state with unassigned ticket
    let state = ticketsAdapter.setAll(
      ticketsReducer(undefined, { type: "@@INIT" }),
      [mockTicket]
    );

    expect(state.entities["T-TEST-1"]?.assigned_to).toBeNull();
    expect(state.pending["T-TEST-1"]).toBeUndefined();

    // 2. Dispatch claimTicket.pending
    state = ticketsReducer(state, {
      type: claimTicket.pending.type,
      meta: { arg: "T-TEST-1", agent: "agent-1" },
    });

    // Instant UI change
    expect(state.entities["T-TEST-1"]?.assigned_to).toBe("agent-1");
    // Previous snapshot saved
    expect(state.pending["T-TEST-1"]).toEqual({
      assigned_to: null,
      status: "open",
    });

    // 3. Dispatch claimTicket.rejected (e.g. 409 conflict: another agent took it)
    state = ticketsReducer(state, {
      type: claimTicket.rejected.type,
      meta: { arg: "T-TEST-1" },
      payload: { status: 409, message: "Conflict: Already claimed by Rahul" },
    });

    // Rolled back to original snapshot
    expect(state.entities["T-TEST-1"]?.assigned_to).toBeNull();
    expect(state.pending["T-TEST-1"]).toBeUndefined();
    expect(state.mutationError).toContain("Already claimed by Rahul");
  });

  it("optimistically updates status on changeStatus.pending, and rolls back on changeStatus.rejected", () => {
    let state = ticketsAdapter.setAll(
      ticketsReducer(undefined, { type: "@@INIT" }),
      [mockTicket]
    );

    // Dispatch changeStatus.pending to 'in_progress'
    state = ticketsReducer(state, {
      type: changeStatus.pending.type,
      meta: { arg: { id: "T-TEST-1", to: "in_progress" } },
    });

    expect(state.entities["T-TEST-1"]?.status).toBe("in_progress");
    expect(state.pending["T-TEST-1"]?.status).toBe("open");

    // Dispatch changeStatus.rejected
    state = ticketsReducer(state, {
      type: changeStatus.rejected.type,
      meta: { arg: { id: "T-TEST-1", to: "in_progress" } },
      payload: { status: 500, message: "Server error" },
    });

    // Status rolled back to 'open'
    expect(state.entities["T-TEST-1"]?.status).toBe("open");
    expect(state.pending["T-TEST-1"]).toBeUndefined();
  });

  it("buffers new incoming tickets into pendingNewIds without jolting UI, and merges when action fired", () => {
    let state = ticketsAdapter.setAll(
      ticketsReducer(undefined, { type: "@@INIT" }),
      [mockTicket]
    );

    const newTicket: Ticket = {
      ...mockTicket,
      id: "T-NEW-99",
      subject: "Brand new ticket",
    };

    // Incoming background updates
    state = ticketsReducer(
      state,
      applyUpdates({ tickets: [newTicket], serverTime: Date.now() })
    );

    // Added to buffer
    expect(state.pendingNewIds).toContain("T-NEW-99");

    // Dispatch merge
    state = ticketsReducer(state, mergeNewTickets());
    expect(state.pendingNewIds.length).toBe(0);
  });
});
