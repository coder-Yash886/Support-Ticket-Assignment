"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store";
import { setAgent } from "@/store/agentSlice";
import { selectActiveAgent, selectHeaderCounts } from "@/store/selectors";
import { AGENTS, AGENT_NAMES, AgentId } from "@/types/ticket";
import {
  Inbox,
  Sparkles,
  ChevronDown,
  Sun,
  Moon,
  Check,
  Headphones,
} from "lucide-react";

const AGENT_DETAILS: Record<
  AgentId,
  { initials: string; role: string; bg: string; text: string }
> = {
  "agent-1": {
    initials: "PR",
    role: "Tier 2 Support Specialist",
    bg: "bg-indigo-50 border border-indigo-200",
    text: "text-indigo-700",
  },
  "agent-2": {
    initials: "RA",
    role: "Technical Lead",
    bg: "bg-amber-50 border border-amber-200",
    text: "text-amber-800",
  },
  "agent-3": {
    initials: "ME",
    role: "Customer Escalations",
    bg: "bg-emerald-50 border border-emerald-200",
    text: "text-emerald-700",
  },
};

export function Header() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const currentAgent = useAppSelector(selectActiveAgent);
  const localCounts = useAppSelector(selectHeaderCounts);

  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const agentMenuRef = useRef<HTMLDivElement>(null);

  // Default clean light theme
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Explicitly enforce clean light theme and clear any dark class
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
    setIsDark(false);
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        agentMenuRef.current &&
        !agentMenuRef.current.contains(event.target as Node)
      ) {
        setAgentMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll server counts for queue visibility
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
    const interval = setInterval(loadServerCounts, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentAgent]);

  const myTicketsCount = Math.max(
    serverCounts?.myTickets ?? 0,
    localCounts.myTickets
  );
  const reviewQueueCount = Math.max(
    serverCounts?.reviewQueue ?? 0,
    localCounts.reviewQueue
  );

  const activeAgent = AGENT_DETAILS[currentAgent] || {
    initials: currentAgent.slice(0, 2).toUpperCase(),
    role: "Support Agent",
    bg: "bg-slate-100 border border-slate-200",
    text: "text-slate-700",
  };

  const isTicketsActive =
    pathname === "/tickets" || pathname === "/" || pathname.startsWith("/tickets/");
  const isReviewActive = pathname === "/review";

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/90 transition-colors shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-6 sm:gap-8 min-w-0">
          <Link
            href="/tickets"
            className="flex items-center gap-2.5 group flex-shrink-0 focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs transition group-hover:scale-105">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900">
                SupportDesk
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live
              </span>
            </div>
          </Link>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            <Link
              href="/tickets"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isTicketsActive
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Inbox className="w-4 h-4 opacity-75" />
              <span>Tickets</span>
              {myTicketsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700">
                  {myTicketsCount}
                </span>
              )}
            </Link>

            <Link
              href="/review"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isReviewActive
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Review Queue</span>
              {reviewQueueCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">
                  {reviewQueueCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

        {/* Right Tools & Active Agent Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Agent Profile & Switcher */}
          <div className="relative" ref={agentMenuRef}>
            <button
              onClick={() => setAgentMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 bg-white shadow-2xs transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              aria-expanded={agentMenuOpen}
              aria-haspopup="true"
            >
              <div
                className={`w-6 h-6 rounded-md ${activeAgent.bg} ${activeAgent.text} flex items-center justify-center font-bold text-[11px] flex-shrink-0`}
              >
                {activeAgent.initials}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-tight">
                  {AGENT_NAMES[currentAgent]}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                  agentMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {agentMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-lg shadow-black/5 p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                <div className="px-2.5 py-1.5 mb-1 border-b border-slate-100">
                  <p className="text-[11px] font-medium text-slate-400">
                    Switch Active Agent
                  </p>
                </div>
                <div className="space-y-0.5">
                  {AGENTS.map((agentId) => {
                    const info = AGENT_DETAILS[agentId];
                    const isSelected = currentAgent === agentId;
                    return (
                      <button
                        key={agentId}
                        onClick={() => {
                          dispatch(setAgent(agentId));
                          setAgentMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition ${
                          isSelected
                            ? "bg-slate-100 text-slate-900 font-medium"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-md ${info.bg} ${info.text} flex items-center justify-center font-bold text-[11px] flex-shrink-0`}
                          >
                            {info.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {AGENT_NAMES[agentId]}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {info.role}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
