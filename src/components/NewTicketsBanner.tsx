"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { selectPendingNewCount } from "@/store/selectors";
import { mergeNewTickets } from "@/store/ticketsSlice";
import { ArrowUp } from "lucide-react";

export function NewTicketsBanner() {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectPendingNewCount);

  if (count <= 0) return null;

  return (
    <div className="sticky top-16 z-30 flex justify-center my-2 animate-in fade-in slide-in-from-top-2 duration-150">
      <button
        onClick={() => dispatch(mergeNewTickets())}
        className="group flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-full shadow-md text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-600" />
        <span>
          {count} new {count === 1 ? "ticket" : "tickets"} arrived — click to show
        </span>
        <ArrowUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
      </button>
    </div>
  );
}
