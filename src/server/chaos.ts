import { NextResponse } from "next/server";

export type ChaosKind = "read" | "claim" | "write";

/**
 * Chaos middleware:
 * - Simulates realistic network latency (300ms - 1500ms)
 * - Simulates 10% random server errors (HTTP 500)
 * - Simulates 25% race condition conflict on claim actions (HTTP 409)
 * - Can be disabled completely by setting FAKE_API_CHAOS="off" (crucial for automated tests)
 */
export async function chaos(kind: ChaosKind = "read"): Promise<NextResponse | null> {
  if (process.env.FAKE_API_CHAOS === "off") {
    return null;
  }

  // Latency jitter: 300ms to 1500ms
  const delay = 300 + Math.random() * 1200;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // 10% chance of random server error
  if (Math.random() < 0.1) {
    return NextResponse.json(
      { error: "Temporary server error (simulated chaos)" },
      { status: 500 }
    );
  }

  // 25% chance of race condition when claiming
  if (kind === "claim" && Math.random() < 0.25) {
    return NextResponse.json(
      { error: "Already claimed by another agent (simulated conflict)" },
      { status: 409 }
    );
  }

  return null;
}
