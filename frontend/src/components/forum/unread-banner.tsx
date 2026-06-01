"use client";

import { useEffect } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Read-tracking banner for a conversation (Unread concept). Marks the opening
 * post seen on open, counts what's new since the last visit, and offers a
 * one-tap "mark all read".
 */
export function UnreadBanner({
  conversation,
  rootItem,
}: {
  conversation: string;
  rootItem: string;
}) {
  const { session } = useAuth();
  const { data, refetch } = useQuery<{ items: { item: string }[] }>(
    session ? () => api.unread.list({ session, scope: conversation }) : null,
    [session, conversation],
  );
  const count = useQuery<{ count: number }>(
    session ? () => api.unread.count({ session, scope: conversation }) : null,
    [session, conversation],
  );

  // Opening the topic marks the root post as seen.
  useEffect(() => {
    if (!session) return;
    void api.unread.markSeen({ session, item: rootItem });
  }, [session, rootItem]);

  if (!session) return null;
  const newCount = count.data?.count ?? data?.items.length ?? 0;
  if (newCount <= 0) return null;

  async function markAll() {
    if (!session) return;
    await api.unread.markAllSeen({ session, scope: conversation });
    refetch();
    count.refetch();
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
      <span className="inline-flex items-center gap-2 text-foreground">
        <Eye className="size-4 text-primary" />
        {newCount} new {newCount === 1 ? "post" : "posts"} since your last visit
      </span>
      <Button variant="ghost" size="sm" onClick={markAll}>
        Mark all read
      </Button>
    </div>
  );
}
