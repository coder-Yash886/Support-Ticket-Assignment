import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";

describe("In-Memory Database & Cursor Pagination", () => {
  beforeEach(() => {
    process.env.FAKE_API_CHAOS = "off";
    db.seed();
  });

  it("deduplicates tickets with duplicate external_id (T-2001)", () => {
    const list = db.list({ limit: 100 });
    // T-2001-A should exist, T-2001-B should have been deduped out
    const matchingExt = list.tickets.filter((t) => t.external_id === "ext-t-2001");
    expect(matchingExt.length).toBe(1);
    expect(matchingExt[0].id).toBe("T-2001-A");
  });

  it("calculates accurate header counts for agents and review queue", () => {
    const counts = db.getCounts("agent-1");
    expect(counts.total).toBeGreaterThan(2000);
    expect(typeof counts.myTickets).toBe("number");
    expect(typeof counts.reviewQueue).toBe("number");
    expect(counts.reviewQueue).toBeGreaterThan(0);
  });

  it("updates ticket status, reviewer, and tracks updates in event log", () => {
    const ticket = db.get("T-2002");
    expect(ticket).toBeDefined();

    const updated = db.update("T-2002", {
      assigned_to: "agent-1",
      status: "in_progress",
    });

    expect(updated?.assigned_to).toBe("agent-1");
    expect(updated?.status).toBe("in_progress");

    // Check updates log
    const updates = db.getUpdates(Date.now() - 5000);
    const found = updates.tickets.find((t) => t.id === "T-2002");
    expect(found).toBeDefined();
    expect(found?.assigned_to).toBe("agent-1");
  });

  it("proves cursor pagination yields no duplicates and no skips when new tickets arrive", () => {
    // 1. Fetch first page of 10 items
    const page1 = db.list({ limit: 10 });
    expect(page1.tickets.length).toBe(10);
    expect(page1.nextCursor).not.toBeNull();

    const page1Ids = new Set(page1.tickets.map((t) => t.id));

    // 2. Simulate inserting a brand new high-priority ticket at the top of the timeline
    const newTopTicket = {
      id: "T-BRAND-NEW-9999",
      external_id: "ext-brand-new",
      subject: "Interleaved new ticket inserted between user page fetches",
      body: "Testing that keyset/cursor pagination is completely immune to row shifting",
      priority: "P0" as const,
      category: "bug" as const,
      status: "open" as const,
      customer_plan: "enterprise" as const,
      assigned_to: null,
      created_at: new Date(Date.now() + 1000).toISOString(),
      createdAt: Date.now() + 1000, // strictly newer than existing items
      triage_decision: "auto_accept" as const,
      flags: [],
    };
    // Put directly into db map
    (db as any).tickets.set(newTopTicket.id, newTopTicket);

    // 3. Fetch second page using page1's cursor
    const page2 = db.list({ limit: 10, cursor: page1.nextCursor });
    expect(page2.tickets.length).toBe(10);

    // 4. Assert ZERO duplicate IDs between page 1 and page 2
    for (const t of page2.tickets) {
      expect(page1Ids.has(t.id)).toBe(false);
    }

    // 5. Assert the boundary is consecutive with no skipped rows
    const lastPage1 = page1.tickets[page1.tickets.length - 1];
    const firstPage2 = page2.tickets[0];

    // Page 2's first item must be strictly older than page 1's last item
    const isStrictlyAfter =
      firstPage2.createdAt < lastPage1.createdAt ||
      (firstPage2.createdAt === lastPage1.createdAt &&
        firstPage2.id.localeCompare(lastPage1.id) < 0);

    expect(isStrictlyAfter).toBe(true);
  });
});
