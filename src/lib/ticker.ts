"use client";

import { useSyncExternalStore } from "react";

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (listeners.size === 1 && timer === null) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return now;
}

function getServerSnapshot() {
  return 0;
}

/**
 * Hook subscribing to a single global 1-second timer across the entire application.
 * Prevents 2,000 separate setInterval timers from draining memory and CPU.
 */
export function useSharedTicker(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
