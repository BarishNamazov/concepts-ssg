"use client";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Follow / unfollow a conversation (subscriptions concept). */
export function SubscribeButton({ conversation }: { conversation: string }) {
  const { session } = useAuth();
  const { data, refetch } = useQuery<{ subscribed: boolean }>(
    session
      ? () => api.subscriptions.isSubscribed({ session, target: conversation })
      : null,
    [session, conversation],
  );

  if (!session) return null;
  const subscribed = data?.subscribed ?? false;

  async function toggle() {
    if (!session) return;
    const result = subscribed
      ? await api.subscriptions.unsubscribe({ session, target: conversation })
      : await api.subscriptions.subscribe({ session, target: conversation });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(subscribed ? "Unfollowed" : "Following this topic");
      refetch();
    }
  }

  return (
    <Button
      variant={subscribed ? "secondary" : "outline"}
      size="sm"
      onClick={toggle}
      className="gap-2"
    >
      {subscribed ? (
        <BellOff className="size-4" />
      ) : (
        <Bell className="size-4" />
      )}
      {subscribed ? "Following" : "Follow"}
    </Button>
  );
}
