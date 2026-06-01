"use client";

import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from "@/components/forum/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import type { Revision } from "@/lib/models";
import { fullTime } from "@/lib/format";

/** Version history for a post (revisions concept), shown in a dialog. */
export function RevisionsDialog({ item }: { item: string }) {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2">
        <History className="size-3.5" />
        Edited
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Edit history</DialogTitle>
          <DialogDescription>
            Every saved version of this post, oldest first.
          </DialogDescription>
        </DialogHeader>
        <RevisionsBody item={item} />
      </DialogContent>
    </Dialog>
  );
}

function RevisionsBody({ item }: { item: string }) {
  const { data, loading } = useQuery<{ revisions: Revision[] }>(
    () => api.revisions.list({ item }),
    [item],
  );

  if (loading) return <LoadingState label="Loading history…" />;
  const revisions = data?.revisions ?? [];
  if (revisions.length === 0)
    return <p className="text-sm text-muted-foreground">No revisions found.</p>;

  return (
    <ScrollArea className="max-h-[60vh] pr-4">
      <ol className="space-y-4">
        {revisions.map((rev) => (
          <li
            key={String(rev.revision)}
            className="rounded-lg border border-border bg-muted/30 p-4"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Version {rev.number}
              </span>
              <span>{fullTime(rev.savedAt)}</span>
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-sm text-foreground/90">
              {rev.content}
            </pre>
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}
