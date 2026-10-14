"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store";
import { setAgent } from "@/store/agentSlice";
import { selectActiveAgent, selectHeaderCounts } from "@/store/selectors";
import { AGENTS, AGENT_NAMES, AgentId } from "@/types/ticket";
import { Inbox, Sparkles, User, ShieldCheck } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const currentAgent = useAppSelector(selectActiveAgent);
  const localCounts = useAppSelector(selectHeaderCounts);

  // Blend with server counts for full truth even before all 2,000 rows are loaded
  const [serverCounts, setServerCounts] = useState<{
    myTickets: number;
    reviewQueue: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadServerCounts() {
      try {
        const res = await fetch("/api/tickets/counts", {
          headers: { "X-Agent-Id": currentAgent },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setServerCounts(data);
        }
      } catch {
        // Fallback to local Redux counts
      }
    }

    loadServerCounts();
    // Poll header counts periodically
    const interval = setInterval(loadServerCounts, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentAgent]);

  // Use maximum of server count or local count to reflect optimistic mutations instantly
  const myTicketsCount = Math.max(
    serverCounts?.myTickets ?? 0,
    localCounts.myTickets
  );
  const reviewQueueCount = Math.max(
    serverCounts?.reviewQueue ?? 0,
    localCounts.reviewQueue
  );

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Main Navigation */}
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/tickets" className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/30 group-hover:bg-indigo-700 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white tracking-tight hidden sm:inline">
              SupportDesk
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/tickets"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pathname === "/tickets" || pathname === "/"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Tickets</span>
              {myTicketsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {myTicketsCount}
                </span>
              )}
            </Link>

            <Link
              href="/review"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pathname === "/review"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>AI Review</span>
              {reviewQueueCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  {reviewQueueCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

        {/* Active Agent Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pl-3 py-1 pr-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <User className="w-4 h-4 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Current Agent
              </span>
              <select
                value={currentAgent}
                onChange={(e) => dispatch(setAgent(e.target.value as AgentId))}
                className="bg-transparent text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                aria-label="Select Active Support Agent"
              >
                {AGENTS.map((agentId) => (
                  <option key={agentId} value={agentId} className="bg-white dark:bg-zinc-900">
                    {AGENT_NAMES[agentId]} ({agentId})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
