"use client";

import { ArrowUpRight } from "lucide-react";
import { Link } from "@/components/link";
import { UserAvatar } from "@/components/forum/user-avatar";
import { UserName } from "@/components/forum/user-name";
import { RenderedMarkdown } from "@/components/forum/rendered-markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import type { PostView } from "@/lib/models";
import { relativeTime, titleFromContent } from "@/lib/format";

/**
 * A compact, self-contained preview of a single post (resolved via
 * `/posts/get`). Used by every post-list surface — bookmarks, a category's
 * items, a tag's targets, a user's posts. When `conversation` is known the
 * title links into the thread.
 */
export function PostPreview({
  item,
  conversation,
  meta,
  action,
}: {
  item: string;
  conversation?: string | null;
  /** Optional trailing meta line (e.g. "saved 2h ago"). */
  meta?: React.ReactNode;
  /** Optional action node rendered in the top-right (e.g. restore button). */
  action?: React.ReactNode;
}) {
  const { data, loading } = useQuery<{ post: PostView }>(
    () => api.posts.get({ post: item }),
    [item],
  );

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
        This post is no longer available.
      </div>
    );
  }

  const post = data.post;
  const author = String(post.author);
  const title = titleFromContent(post.content);

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-border/80 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar user={author} className="size-7" />
          <div className="min-w-0 text-sm">
            <UserName user={author} />
            <span className="mx-1.5 text-muted-foreground">·</span>
            <time className="text-muted-foreground">
              {relativeTime(post.createdAt)}
            </time>
          </div>
        </div>
        {action}
      </div>

      {conversation ? (
        <h3 className="mb-1.5 font-display text-lg font-semibold leading-snug">
          <Link
            href={`/t/${conversation}#post-${item}`}
            className="inline-flex items-center gap-1 text-foreground hover:text-primary"
          >
            {title}
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </h3>
      ) : null}

      <RenderedMarkdown html={post.rendered} className="line-clamp-4 text-sm" />

      {meta ? (
        <div className="mt-3 text-xs text-muted-foreground">{meta}</div>
      ) : null}
    </article>
  );
}
