import { describe, it, expect } from "vitest";
import { normalize, parseDate } from "./normalize";
import { safeUrl } from "./safeUrl";
import { slaStatus, SLA_LIMIT_MS } from "./sla";
import { RawTicket } from "@/types/ticket";

describe("Normalizer & Defensive Data Handling", () => {
  it("normalizes 'closed' status to 'resolved' and flags it", () => {
    const raw: RawTicket = {
      id: "T-2010",
      status: "closed",
      priority: "P2",
      category: "bug",
      triage_decision: "auto_accept",
      created_at: "2026-10-10T12:00:00Z",
    };
    const ticket = normalize(raw);
    expect(ticket.status).toBe("resolved");
    expect(ticket.rawStatus).toBe("closed");
    expect(ticket.flags).toContain("was_closed");
  });

  it("handles dates without timezone by defaulting to UTC", () => {
    // 2026-10-10 12:00:00 without zone -> treated as UTC 12:00:00Z
    const timestamp = parseDate("2026-10-10 12:00:00");
    const expected = Date.parse("2026-10-10T12:00:00Z");
    expect(timestamp).toBe(expected);
  });

  it("clamps future created_at dates to current time and adds future_date flag", () => {
    const futureTime = Date.now() + 1000000;
    const now = Date.now();
    const raw: RawTicket = {
      id: "T-2008",
      created_at: new Date(futureTime).toISOString(),
      priority: "P1",
      category: "billing",
      triage_decision: "auto_accept",
    };
    const ticket = normalize(raw, now);
    expect(ticket.createdAt).toBe(now);
    expect(ticket.flags).toContain("future_date");
  });

  it("falls back gracefully for null/empty body and subject without crashing", () => {
    const raw: RawTicket = {
      id: "T-2006",
      subject: null,
      body: null,
      priority: "P2",
      category: "other",
      triage_decision: "manual_review",
    };
    const ticket = normalize(raw);
    expect(ticket.subject).toBe("");
    expect(ticket.body).toBe("");
    expect(ticket.body.length).toBe(0);
  });

  it("flags invalid priority and category and forces triage_decision to manual_review", () => {
    const raw: RawTicket = {
      id: "T-2004",
      priority: "P5",
      category: "invalid_category",
      customer_plan: "platinum",
      triage_decision: "auto_accept",
    };
    const ticket = normalize(raw);
    expect(ticket.flags).toContain("invalid_priority");
    expect(ticket.flags).toContain("invalid_category");
    expect(ticket.flags).toContain("unknown_plan");
    expect(ticket.triage_decision).toBe("manual_review");
    expect(ticket.priority).toBe("P3"); // fallback valid enum
    expect(ticket.category).toBe("other"); // fallback valid enum
  });

  it("safely handles invalid triage_decision like 'maybe' by defaulting to manual_review", () => {
    const raw: RawTicket = {
      id: "T-2012",
      priority: "P1",
      category: "bug",
      triage_decision: "maybe",
    };
    const ticket = normalize(raw);
    expect(ticket.triage_decision).toBe("manual_review");
    expect(ticket.flags).toContain("invalid_decision");
  });

  it("flags unknown assigned agent (e.g. agent-99)", () => {
    const raw: RawTicket = {
      id: "T-2009",
      priority: "P1",
      category: "bug",
      assigned_to: "agent-99",
      triage_decision: "auto_accept",
    };
    const ticket = normalize(raw);
    expect(ticket.flags).toContain("unknown_agent");
    expect(ticket.assigned_to).toBe("agent-99");
  });
});

describe("safeUrl helper", () => {
  it("allows safe http and https links", () => {
    expect(safeUrl("https://example.com/invoice.pdf")).toBe(
      "https://example.com/invoice.pdf"
    );
    expect(safeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("blocks dangerous javascript: and data: URLs (XSS protection)", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox")).toBeNull();
    expect(safeUrl("not-a-valid-url")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });
});

describe("SLA Status Boundaries", () => {
  it("correctly identifies 'on_track' at exactly 20% remaining time", () => {
    const createdAt = 100000;
    const total = SLA_LIMIT_MS.P0; // 3,600,000 ms
    // exactly 20% left -> left = 0.20 * total = 720,000 ms
    // now = createdAt + total - left = 100000 + 3600000 - 720000 = 2980000
    const now = createdAt + total - 0.20 * total;
    const result = slaStatus(createdAt, "P0", now);
    expect(result.state).toBe("on_track");
  });

  it("correctly identifies 'at_risk' when strictly under 20% remaining time", () => {
    const createdAt = 100000;
    const total = SLA_LIMIT_MS.P0;
    // slightly under 20% left (19.99%)
    const now = createdAt + total - 0.1999 * total;
    const result = slaStatus(createdAt, "P0", now);
    expect(result.state).toBe("at_risk");
  });

  it("correctly identifies 'late' when left <= 0", () => {
    const createdAt = 100000;
    const total = SLA_LIMIT_MS.P0;
    // Exactly 0 remaining
    expect(slaStatus(createdAt, "P0", createdAt + total).state).toBe("late");
    // Past SLA deadline
    expect(slaStatus(createdAt, "P0", createdAt + total + 5000).state).toBe(
      "late"
    );
  });

  it("respects limits across all priorities (P0, P1, P2, P3)", () => {
    const createdAt = 0;
    expect(slaStatus(createdAt, "P0", 3599000).total).toBe(1 * 3600e3);
    expect(slaStatus(createdAt, "P1", 1000).total).toBe(4 * 3600e3);
    expect(slaStatus(createdAt, "P2", 1000).total).toBe(24 * 3600e3);
    expect(slaStatus(createdAt, "P3", 1000).total).toBe(72 * 3600e3);
  });
});
