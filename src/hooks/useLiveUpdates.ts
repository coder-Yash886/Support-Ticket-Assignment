"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store";
import { applyUpdates } from "@/store/ticketsSlice";

interface UseLiveUpdatesOptions {
  intervalMs?: number;
  enabled?: boolean;
}

/**
 * Background polling hook:
 * - Polls /api/tickets/updates?since=<serverTime> every intervalMs (default 5000ms).
 * - Pauses polling when the browser tab is hidden (document.hidden) to conserve bandwidth.
 * - Uses SERVER timestamps instead of local client clock.
 * - Applies exponential backoff on network errors (up to 30s).
 * - Merges updates: known tickets updated in-place; new tickets buffered in pendingNewIds.
 */
export function useLiveUpdates({
  intervalMs = 5000,
  enabled = true,
}: UseLiveUpdatesOptions = {}) {
  const dispatch = useAppDispatch();
  const sinceRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    let delay = intervalMs;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    // Initialize with current time if zero
    if (sinceRef.current === 0) {
      sinceRef.current = Date.now() - 60000; // Look back 1 minute initially
    }

    const tick = async () => {
      // Pause polling if user is on another tab (Page 6, 7.10)
      if (typeof document !== "undefined" && document.hidden) {
        if (!stopped) {
          timer = setTimeout(tick, delay);
        }
        return;
      }

      try {
        const url = `/api/tickets/updates?since=${encodeURIComponent(
          sinceRef.current.toString()
        )}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        // Crucial: Use server time, never the client clock (Page 6)
        if (data.serverTime) {
          sinceRef.current = data.serverTime;
        }

        if (Array.isArray(data.tickets) && data.tickets.length > 0) {
          dispatch(
            applyUpdates({
              tickets: data.tickets,
              serverTime: data.serverTime || Date.now(),
            })
          );
        }

        // Reset delay on successful request
        delay = intervalMs;
      } catch {
        // Exponential backoff on failure up to 30,000ms
        delay = Math.min(delay * 2, 30000);
      }

      if (!stopped) {
        timer = setTimeout(tick, delay);
      }
    };

    timer = setTimeout(tick, delay);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [dispatch, intervalMs, enabled]);
}
