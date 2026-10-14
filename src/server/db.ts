import { Ticket } from "@/types/ticket";
import { generateSeedTickets } from "./seed";
import { simulateEvents } from "./simulator";

export interface TicketFilters {
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
  cursor?: string | null;
  limit?: number;
}

export interface ListResult {
  tickets: Ticket[];
  nextCursor: string | null;
  totalFiltered: number;
  totalAll: number;
}

export interface TicketUpdateLog {
  ticket: Ticket;
  updatedAt: number;
}

class InMemoryTicketStore {
  private tickets: Map<string, Ticket> = new Map();
  private updateLogs: TicketUpdateLog[] = [];
  private lastSimulatedAt: number = Date.now();

  constructor() {
    this.seed();
  }

  public seed(): void {
    this.tickets.clear();
    this.updateLogs = [];
    const seed = generateSeedTickets();
    for (const t of seed) {
      this.tickets.set(t.id, t);
    }
    this.lastSimulatedAt = Date.now();
  }

  /**
   * Lazily triggers background simulation to generate new tickets that arrived since last check.
   */
  public triggerSimulation(): void {
    const { result, newLastSimulatedAt } = simulateEvents(this.lastSimulatedAt);
    this.lastSimulatedAt = newLastSimulatedAt;

    for (const t of result.newTickets) {
      this.tickets.set(t.id, t);
      this.updateLogs.push({ ticket: t, updatedAt: t.createdAt });
    }
  }

  public get(id: string): Ticket | undefined {
    this.triggerSimulation();
    return this.tickets.get(id);
  }

  public list(filters: TicketFilters): ListResult {
    this.triggerSimulation();

    const all = Array.from(this.tickets.values());
    const totalAll = all.length;

    // 1. Filter tickets
    const query = (filters.q ?? "").trim().toLowerCase();
    const statusFilter = filters.status;
    const priorityFilter = filters.priority;
    const categoryFilter = filters.category;

    const filtered = all.filter((t) => {
      if (statusFilter && statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }
      if (priorityFilter && priorityFilter !== "all" && t.priority !== priorityFilter) {
        return false;
      }
      if (categoryFilter && categoryFilter !== "all" && t.category !== categoryFilter) {
        return false;
      }
      if (query) {
        const inId = t.id.toLowerCase().includes(query);
        const inSubj = t.subject.toLowerCase().includes(query);
        const inBody = t.body.toLowerCase().includes(query);
        const inSummary = (t.ai_summary ?? "").toLowerCase().includes(query);
        if (!inId && !inSubj && !inBody && !inSummary) {
          return false;
        }
      }
      return true;
    });

    // 2. Sort order: createdAt desc, id desc (stable keyset ordering)
    filtered.sort((a, b) => {
      if (b.createdAt !== a.createdAt) {
        return b.createdAt - a.createdAt;
      }
      return b.id.localeCompare(a.id);
    });

    const totalFiltered = filtered.length;

    // 3. Cursor pagination
    let startIndex = 0;
    if (filters.cursor) {
      try {
        const decoded = Buffer.from(filters.cursor, "base64").toString("utf-8");
        const [cursorTimeStr, cursorId] = decoded.split("|");
        const cursorTime = Number(cursorTimeStr);

        // Find first item strictly after this cursor
        const idx = filtered.findIndex((t) => {
          if (t.createdAt < cursorTime) return true;
          if (t.createdAt === cursorTime && t.id.localeCompare(cursorId) < 0) return true;
          return false;
        });

        if (idx !== -1) {
          startIndex = idx;
        } else {
          startIndex = filtered.length; // cursor past end
        }
      } catch {
        startIndex = 0;
      }
    }

    const pageSize = Math.min(Math.max(1, filters.limit ?? 25), 100);
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    let nextCursor: string | null = null;
    if (startIndex + pageSize < filtered.length && paginated.length > 0) {
      const last = paginated[paginated.length - 1];
      nextCursor = Buffer.from(`${last.createdAt}|${last.id}`).toString("base64");
    }

    return {
      tickets: paginated,
      nextCursor,
      totalFiltered,
      totalAll,
    };
  }

  public update(id: string, patch: Partial<Ticket>): Ticket | null {
    const existing = this.tickets.get(id);
    if (!existing) return null;

    const updated: Ticket = {
      ...existing,
      ...patch,
      id: existing.id, // prevent ID overwrite
    };

    this.tickets.set(id, updated);
    this.updateLogs.push({ ticket: updated, updatedAt: Date.now() });
    return updated;
  }

  public getUpdates(sinceTimestamp: number): { tickets: Ticket[]; serverTime: number } {
    this.triggerSimulation();
    const serverTime = Date.now();

    // Find any tickets updated or created after sinceTimestamp
    const recent = this.updateLogs
      .filter((log) => log.updatedAt > sinceTimestamp)
      .map((log) => log.ticket);

    // Deduplicate in case a ticket was updated multiple times
    const map = new Map<string, Ticket>();
    for (const t of recent) {
      map.set(t.id, t);
    }

    return {
      tickets: Array.from(map.values()),
      serverTime,
    };
  }

  public getCounts(agentId?: string): {
    myTickets: number;
    reviewQueue: number;
    total: number;
  } {
    this.triggerSimulation();
    let myTickets = 0;
    let reviewQueue = 0;
    const all = Array.from(this.tickets.values());

    for (const t of all) {
      // My tickets: assigned to agent and not resolved
      if (agentId && t.assigned_to === agentId && t.status !== "resolved") {
        myTickets++;
      }
      // Review queue: manual_review and not yet reviewed
      if (t.triage_decision === "manual_review" && !t.reviewed_at) {
        reviewQueue++;
      }
    }

    return {
      myTickets,
      reviewQueue,
      total: all.length,
    };
  }
}

// Global singleton to survive Next.js hot-reloading in dev
const globalStore = globalThis as unknown as { __ticketDb?: InMemoryTicketStore };
if (!globalStore.__ticketDb) {
  globalStore.__ticketDb = new InMemoryTicketStore();
}

export const db = globalStore.__ticketDb;
