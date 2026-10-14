"use client";

import React, { useState, useEffect, useTransition } from "react";
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
import { Search, X, Filter } from "lucide-react";
import { PRIORITIES, CATEGORIES, STATUSES } from "@/types/ticket";

export function FiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectActiveFilters);
  const [, startTransition] = useTransition();

  // Local state for debounced search input
  const [localSearch, setLocalSearch] = useState(filters.q);

  // 1. Sync from URL on initial load and back/forward navigation
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "all";
    const priority = searchParams.get("priority") || "all";
    const category = searchParams.get("category") || "all";

    dispatch(syncFromUrl({ q, status, priority, category }));
    setLocalSearch(q);
  }, [searchParams, dispatch]);

  // 2. Debounced search effect (350ms) writing to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.q) {
        updateUrl({ q: localSearch || undefined });
        dispatch(setQuery(localSearch));
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [localSearch]);

  const updateUrl = (updates: Record<string, string | undefined>) => {
    const current = new URLSearchParams(searchParams.toString());
    // Cursor must reset whenever filters or query change
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
  };

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
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search input with live clear button */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by ID, subject, content, or summary..."
            className="w-full pl-10 pr-9 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Select */}
          <select
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {st.replace("_", " ").toUpperCase()}
              </option>
            ))}
          </select>

          {/* Priority Select */}
          <select
            value={filters.priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Category Select */}
          <select
            value={filters.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60 transition cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
