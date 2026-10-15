"use client";

import React, { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  setQuery,
  setStatusFilter,
  setPriorityFilter,
  setCategoryFilter,
  resetFilters,
  syncFromUrl,
} from "@/store/filtersSlice";
import { selectActiveFilters } from "@/store/selectors";
import { Search, X, ChevronDown } from "lucide-react";
import { PRIORITIES, CATEGORIES, STATUSES } from "@/types/ticket";

const STATUS_LABELS: Record<string, string> = {
  all: "All Status",
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Categories",
  billing: "Billing",
  bug: "Bug Report",
  account_access: "Account Access",
  feature_request: "Feature Request",
  other: "General",
};

const PRIORITY_LABELS: Record<string, string> = {
  all: "All Priorities",
  P0: "P0 Critical",
  P1: "P1 High",
  P2: "P2 Normal",
  P3: "P3 Low",
};

export function FiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectActiveFilters);
  const [, startTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localSearch, setLocalSearch] = useState(filters.q);

  const updateUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const current = new URLSearchParams(searchParams.toString());
      current.delete("cursor");

      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all") {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      }

      startTransition(() => {
        router.replace(`${pathname}?${current.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  // Sync from URL params on load / popstate
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "all";
    const priority = searchParams.get("priority") || "all";
    const category = searchParams.get("category") || "all";

    dispatch(syncFromUrl({ q, status, priority, category }));
  }, [searchParams, dispatch]);

  // Debounced search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.q) {
        updateUrl({ q: localSearch || undefined });
        dispatch(setQuery(localSearch));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, filters.q, dispatch, updateUrl]);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleStatusChange = (val: string) => {
    dispatch(setStatusFilter(val));
    updateUrl({ status: val });
  };

  const handlePriorityChange = (val: string) => {
    dispatch(setPriorityFilter(val));
    updateUrl({ priority: val });
  };

  const handleCategoryChange = (val: string) => {
    dispatch(setCategoryFilter(val));
    updateUrl({ category: val });
  };

  const handleClear = () => {
    setLocalSearch("");
    dispatch(resetFilters());
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const hasActiveFilters =
    filters.q !== "" ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.category !== "all";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 space-y-3 transition-colors">
      <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-700 dark:group-focus-within:text-slate-200 transition-colors" />
          <input
            ref={searchInputRef}
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search tickets by subject, body, or ID..."
            className="w-full pl-9 pr-14 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {localSearch ? (
              <button
                onClick={() => {
                  setLocalSearch("");
                  dispatch(setQuery(""));
                  updateUrl({ q: undefined });
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="appearance-none pl-2.5 pr-7 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="all">All Status</option>
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABELS[st] || st}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <select
              value={filters.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="appearance-none pl-2.5 pr-7 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p] || p}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="appearance-none pl-2.5 pr-7 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] text-slate-400 mr-1 font-medium">Filtered by:</span>

          {filters.q && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <span>Query: &ldquo;{filters.q}&rdquo;</span>
              <button
                onClick={() => {
                  setLocalSearch("");
                  dispatch(setQuery(""));
                  updateUrl({ q: undefined });
                }}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.status !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <span>Status: {STATUS_LABELS[filters.status] || filters.status}</span>
              <button
                onClick={() => handleStatusChange("all")}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.priority !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <span>Priority: {filters.priority}</span>
              <button
                onClick={() => handlePriorityChange("all")}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.category !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <span>Category: {CATEGORY_LABELS[filters.category] || filters.category}</span>
              <button
                onClick={() => handleCategoryChange("all")}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
