import { describe, it, expect } from "vitest";
import { canMove, validateTriage, isValidAgent } from "./rules";

describe("State Transition Rules (canMove)", () => {
  it("rejects direct jump from open to resolved", () => {
    expect(canMove("open", "resolved")).toBe(false);
  });

  it("allows open to in_progress", () => {
    expect(canMove("open", "in_progress")).toBe(true);
  });

  it("allows in_progress to resolved", () => {
    expect(canMove("in_progress", "resolved")).toBe(true);
  });

  it("allows reopening from resolved to open", () => {
    expect(canMove("resolved", "open")).toBe(true);
  });

  it("rejects invalid or same-state transitions", () => {
    expect(canMove("in_progress", "in_progress")).toBe(false);
    expect(canMove("open", "open")).toBe(false);
    expect(canMove("resolved", "in_progress")).toBe(false);
    expect(canMove("unknown", "open")).toBe(false);
  });
});

describe("Triage Validation Rules (validateTriage)", () => {
  it("rejects enterprise plan with priority P2 or lower", () => {
    const errors = validateTriage(
      "enterprise",
      "P2",
      "bug",
      "Valid reason with enough length"
    );
    expect(errors.priority).toBe("Enterprise tickets must stay P1 or higher");
  });

  it("accepts enterprise plan with priority P0 or P1", () => {
    const errorsP1 = validateTriage(
      "enterprise",
      "P1",
      "bug",
      "Valid reason with enough length"
    );
    expect(errorsP1.priority).toBeUndefined();

    const errorsP0 = validateTriage(
      "enterprise",
      "P0",
      "bug",
      "Valid reason with enough length"
    );
    expect(errorsP0.priority).toBeUndefined();
  });

  it("rejects reason with less than 10 characters", () => {
    const errors = validateTriage("pro", "P2", "billing", "Too short");
    expect(errors.reason).toBe("Reason must be at least 10 characters");
  });

  it("accepts valid input with 10 or more characters", () => {
    const errors = validateTriage(
      "pro",
      "P2",
      "billing",
      "1234567890" // 10 chars
    );
    expect(Object.keys(errors).length).toBe(0);
  });

  it("rejects invalid priorities and categories", () => {
    const errors = validateTriage("pro", "P5", "unknown_category", "Valid long reason here");
    expect(errors.priority).toBe("Pick a valid priority");
    expect(errors.category).toBe("Pick a valid category");
  });
});

describe("Agent Validation", () => {
  it("validates known agents and rejects unknown ones", () => {
    expect(isValidAgent("agent-1")).toBe(true);
    expect(isValidAgent("agent-2")).toBe(true);
    expect(isValidAgent("agent-3")).toBe(true);
    expect(isValidAgent("agent-99")).toBe(false);
    expect(isValidAgent("random-hacker")).toBe(false);
  });
});
