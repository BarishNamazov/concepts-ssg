"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Read-tracking banner for a conversation. Shows how many posts are new since
 * the last visit and offers a one-tap "mark all read". Read state is owned by
 * the parent's `useUnread` hook so the same data drives per-post highlighting.
 */
export function UnreadBanner({
  newCount,
  onMarkAll,
}: {
  newCount: number;
  onMarkAll: () => void;
}) {
  if (newCount <= 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
      <span className="inline-flex items-center gap-2 text-foreground">
        <Eye className="size-4 text-primary" />
        {newCount} new {newCount === 1 ? "post" : "posts"} since your last visit
      </span>
      <Button variant="ghost" size="sm" onClick={onMarkAll}>
        Mark all read
      </Button>
    </div>
  );
}
