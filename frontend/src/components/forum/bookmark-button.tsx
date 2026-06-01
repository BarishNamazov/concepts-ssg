"use client";

import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Bookmark / unbookmark a post. `item` is the post id. */
export function BookmarkButton({
  item,
  withLabel = false,
}: {
  item: string;
  withLabel?: boolean;
}) {
  const { session } = useAuth();
  const { data, refetch } = useQuery<{ saved: boolean }>(
    session ? () => api.bookmarks.isSaved({ session, item }) : null,
    [session, item],
  );
  const saved = data?.saved ?? false;

  async function toggle() {
    if (!session) {
      toast.error("Sign in to bookmark posts.");
      return;
    }
    const result = saved
      ? await api.bookmarks.unsave({ session, item })
      : await api.bookmarks.save({ session, item });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(saved ? "Bookmark removed" : "Bookmarked");
      refetch();
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={cn("gap-1.5 text-muted-foreground", saved && "text-primary")}
    >
      <Bookmark className={cn("size-4", saved && "fill-current")} />
      {withLabel ? (saved ? "Saved" : "Save") : null}
    </Button>
  );
}
