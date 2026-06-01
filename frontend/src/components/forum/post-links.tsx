"use client";

import { ArrowRightLeft, CornerDownRight } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";

/**
 * Shows the cross-references for a post: how many posts mention it (backlinks)
 * and how many it points at (forward links), surfaced by the Linking concept.
 */
export function PostLinks({ post }: { post: string }) {
  const back = useQuery(() => api.links.backlinks({ target: post }), [post]);
  const forward = useQuery(() => api.links.forward({ source: post }), [post]);

  const backCount = back.data?.sources.length ?? 0;
  const forwardCount = forward.data?.targets.length ?? 0;
  if (backCount === 0 && forwardCount === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
      {backCount > 0 ? (
        <span className="inline-flex items-center gap-1">
          <CornerDownRight className="size-3.5" />
          Mentioned in {backCount}
        </span>
      ) : null}
      {forwardCount > 0 ? (
        <span className="inline-flex items-center gap-1">
          <ArrowRightLeft className="size-3.5" />
          Links to {forwardCount}
        </span>
      ) : null}
    </div>
  );
}
