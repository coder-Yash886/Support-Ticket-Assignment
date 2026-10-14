import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function TicketNotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
        Ticket Not Found (404)
      </h1>
      <p className="text-sm text-zinc-500 max-w-md mx-auto">
        The requested ticket does not exist or has been removed from the database.
      </p>
      <div className="pt-2">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Ticket List</span>
        </Link>
      </div>
    </div>
  );
}
