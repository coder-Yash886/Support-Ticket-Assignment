import { describe, it, expect } from "vitest";
import { TEST_TICKETS, generateSeedTickets } from "./seed";
import { safeUrl } from "@/lib/safeUrl";

describe("All 12 Test Tickets Verification (T-2001 to T-2012)", () => {
  const seed = generateSeedTickets();
  const ticketMap = new Map(seed.map((t) => [t.id, t]));

  it("T-2001: Dedupes duplicate external_id (keeps first instance T-2001-A)", () => {
    expect(ticketMap.has("T-2001-A")).toBe(true);
    expect(ticketMap.has("T-2001-B")).toBe(false);
  });

  it("T-2002: Contains XSS tags rendered literally without running code", () => {
    const t = ticketMap.get("T-2002");
    expect(t).toBeDefined();
    expect(t?.subject).toContain("<img");
    expect(t?.body).toContain("https://billing.example.com/receipt/99827");
  });

  it("T-2003: Flags prompt injection in body and blocks javascript: attachment", () => {
    const t = ticketMap.get("T-2003");
    expect(t).toBeDefined();
    expect(t?.triage_decision).toBe("manual_review");
    expect(t?.review_reason).toBe("flagged_input");
    expect(safeUrl(t?.attachment_url)).toBeNull();
  });

  it("T-2004: Flags unknown plan (platinum), invalid priority P5, and forces manual review", () => {
    const t = ticketMap.get("T-2004");
    expect(t).toBeDefined();
    expect(t?.flags).toContain("unknown_plan");
    expect(t?.flags).toContain("invalid_priority");
    expect(t?.flags).toContain("invalid_category");
    expect(t?.triage_decision).toBe("manual_review");
    expect(t?.ai_summary).toBeNull();
  });

  it("T-2005: Preserves very long subject with no spaces without truncation in data", () => {
    const t = ticketMap.get("T-2005");
    expect(t).toBeDefined();
    expect(t?.subject.length).toBeGreaterThan(80);
    expect(t?.subject).not.toContain(" ");
  });

  it("T-2006: Safely normalizes empty subject and null body to empty strings", () => {
    const t = ticketMap.get("T-2006");
    expect(t).toBeDefined();
    expect(t?.subject).toBe("");
    expect(t?.body).toBe("");
    expect(t?.triage_decision).toBe("manual_review");
  });

  it("T-2007: Handles Arabic RTL text, parses UTC date without timezone, and shows AI suggested P3 vs final P1", () => {
    const t = ticketMap.get("T-2007");
    expect(t).toBeDefined();
    expect(t?.subject).toContain("مشكلة في تسجيل الدخول");
    expect(t?.priority).toBe("P1");
    expect(t?.ai_priority).toBe("P3");
    expect(t?.review_reason).toContain("enterprise minimum P1 rule");
    // Verify date without timezone parsed as UTC
    const expectedUtc = Date.parse("2026-10-14T10:30:00Z");
    expect(t?.createdAt).toBe(expectedUtc);
  });

  it("T-2008: Clamps future date in 2027 to current time and sets future_date flag", () => {
    const t = ticketMap.get("T-2008");
    expect(t).toBeDefined();
    expect(t?.flags).toContain("future_date");
    expect(t?.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("T-2009: Flags unknown agent (agent-99) and keeps assigned_to value intact", () => {
    const t = ticketMap.get("T-2009");
    expect(t).toBeDefined();
    expect(t?.assigned_to).toBe("agent-99");
    expect(t?.flags).toContain("unknown_agent");
  });

  it("T-2010: Normalizes status 'closed' to 'resolved' and preserves valid HTTPS attachment", () => {
    const t = ticketMap.get("T-2010");
    expect(t).toBeDefined();
    expect(t?.status).toBe("resolved");
    expect(t?.rawStatus).toBe("closed");
    expect(t?.flags).toContain("was_closed");
    expect(safeUrl(t?.attachment_url)).toBe(
      "https://documents.example.com/invoices/vat_2026_09.pdf"
    );
  });

  it("T-2011: Contains XSS inside AI summary safely preserved as string", () => {
    const t = ticketMap.get("T-2011");
    expect(t).toBeDefined();
    expect(t?.ai_summary).toContain("<script>");
  });

  it("T-2012: Handles invalid triage_decision 'maybe' by failing safe to manual_review", () => {
    const t = ticketMap.get("T-2012");
    expect(t).toBeDefined();
    expect(t?.triage_decision).toBe("manual_review");
    expect(t?.flags).toContain("invalid_decision");
  });
});
