import { Ticket, PRIORITIES, CATEGORIES, CUSTOMER_PLANS } from "@/types/ticket";
import { normalize } from "@/lib/normalize";

let nextNewTicketSeq = 90000;

export interface SimulationResult {
  newTickets: Ticket[];
  updatedTickets: Ticket[];
}

/**
 * Lazy simulator for background ticket arrivals and updates.
 * Runs on every request by checking elapsed time since lastSimulatedAt.
 * Generates an event every 5 to 10 seconds.
 */
export function simulateEvents(lastSimulatedAt: number, now = Date.now()): {
  result: SimulationResult;
  newLastSimulatedAt: number;
} {
  const elapsedMs = Math.max(0, now - lastSimulatedAt);
  // Avg event every 7.5 seconds
  const eventIntervalMs = 7500;
  const count = Math.min(Math.floor(elapsedMs / eventIntervalMs), 10); // cap at 10 to avoid spikes

  if (count <= 0) {
    return {
      result: { newTickets: [], updatedTickets: [] },
      newLastSimulatedAt: lastSimulatedAt,
    };
  }

  const newTickets: Ticket[] = [];

  for (let i = 0; i < count; i++) {
    nextNewTicketSeq += 1;
    const eventTime = lastSimulatedAt + (i + 1) * eventIntervalMs;
    const id = `T-LIVE-${nextNewTicketSeq}`;
    const priority = PRIORITIES[nextNewTicketSeq % PRIORITIES.length];
    const category = CATEGORIES[nextNewTicketSeq % CATEGORIES.length];
    const plan = CUSTOMER_PLANS[nextNewTicketSeq % CUSTOMER_PLANS.length];

    const raw = {
      id,
      external_id: `ext-live-${nextNewTicketSeq}`,
      subject: `Incoming live alert: service health check event #${nextNewTicketSeq}`,
      body: `Automated monitor detected latency anomaly on zone ${category}. Created at ${new Date(eventTime).toISOString()}`,
      priority,
      category,
      status: "open",
      customer_plan: plan,
      assigned_to: null,
      created_at: new Date(eventTime).toISOString(),
      triage_decision: "auto_accept" as const,
      ai_summary: `Real-time incoming ticket for ${category}.`,
    };

    newTickets.push(normalize(raw, eventTime));
  }

  return {
    result: { newTickets, updatedTickets: [] },
    newLastSimulatedAt: lastSimulatedAt + count * eventIntervalMs,
  };
}
