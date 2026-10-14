"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { selectPendingNewCount } from "@/store/selectors";
import { mergeNewTickets } from "@/store/ticketsSlice";
import { ArrowUpCircle } from "lucide-react";

export function NewTicketsBanner() {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectPendingNewCount);

  if (count <= 0) return null;

  return (
    <div className="sticky top-16 z-30 flex justify-center my-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <button
        onClick={() => dispatch(mergeNewTickets())}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-full shadow-lg shadow-indigo-500/25 text-sm font-medium transition cursor-pointer"
      >
        <ArrowUpCircle className="w-4 h-4 animate-bounce" />
        <span>{count} new {count === 1 ? "ticket" : "tickets"} arrived — Click to show</span>
      </button>
    </div>
  );
}
