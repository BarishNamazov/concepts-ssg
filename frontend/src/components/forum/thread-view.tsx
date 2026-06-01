"use client";

import { Lock, LockOpen, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/forum/badges";
import { Composer } from "@/components/forum/composer";
import { PageContainer } from "@/components/forum/page";
import { PostCard } from "@/components/forum/post-card";
import { SubscribeButton } from "@/components/forum/subscribe-button";
import { TagEditor } from "@/components/forum/tag-editor";
import {
  ErrorState,
  LoadingState,
} from "@/components/forum/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadThreadPage, type ThreadPage } from "@/lib/loaders";
import { count, titleFromContent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Indentation step per reply depth, capped so deep threads stay readable. */
function indentFor(depth: number): string {
  const level = Math.min(depth, 6);
  if (level === 0) return "";
  return "border-l-2 border-border/60 pl-3 sm:pl-5";
}

export function ThreadView({ conversation }: { conversation: string }) {
  const { session, can } = useAuth();
  const { data, error, loading, refetch } = useQuery<ThreadPage>(
    () => loadThreadPage(conversation),
    [conversation],
  );

  if (loading && !data) return <LoadingState label="Loading discussion…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const { nodes, root, questionId, category, tags, locked, acceptedAnswer } =
    data;
  const rootAuthorId = String(root.post.author);
  const title = titleFromContent(root.post.content);
  const replyCount = Math.max(0, nodes.length - 1);

  async function toggleLock() {
    if (!session) return;
    const result = locked
      ? await api.locks.unlock({ session, target: conversation })
      : await api.locks.lock({ session, target: conversation });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(locked ? "Topic unlocked" : "Topic locked");
      refetch();
    }
  }

  async function postRootReply(content: string) {
    if (!session) return;
    const result = await api.threads.reply({
      session,
      parent: String(root.node),
      content,
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Reply posted");
      refetch();
    }
  }

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All topics
        </Link>
      </div>

      <header className="mb-6 border-b border-border pb-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {category ? (
            <CategoryBadge id={String(category.category)} name={category.name} />
          ) : null}
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Lock className="size-3" />
              Locked
            </span>
          ) : null}
        </div>
        <h1 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageSquare className="size-4" />
            {count(replyCount, "reply", "replies")}
          </span>
          <div className="flex items-center gap-2">
            <SubscribeButton conversation={conversation} />
            {session && can.moderate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLock}
                className="gap-2"
              >
                {locked ? (
                  <LockOpen className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
                {locked ? "Unlock" : "Lock"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-3">
          <TagEditor target={questionId} tags={tags} onChanged={refetch} />
        </div>
      </header>

      <div className="space-y-4">
        {nodes.map((node) => (
          <div key={String(node.node)} className={cn(indentFor(node.depth))}>
            <PostCard
              node={node}
              isRoot={node.depth === 0}
              questionId={questionId}
              rootAuthorId={rootAuthorId}
              acceptedAnswer={acceptedAnswer}
              locked={locked}
              onChanged={refetch}
            />
          </div>
        ))}
      </div>

      <section className="mt-8 border-t border-border pt-6">
        {locked ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            This topic is locked. New replies are disabled.
          </p>
        ) : session ? (
          <>
            <h2 className="eyebrow mb-3">Add to the discussion</h2>
            <Composer
              placeholder="Write your reply… Markdown supported."
              submitLabel="Post reply"
              onSubmit={postRootReply}
            />
          </>
        ) : (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>{" "}
            to join the conversation.
          </p>
        )}
      </section>
    </PageContainer>
  );
}
