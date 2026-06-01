"use client";

import { use } from "react";
import { ThreadView } from "@/components/forum/thread-view";

export default function ThreadPage({
  params,
}: {
  params: Promise<{ conversation: string }>;
}) {
  const { conversation } = use(params);
  return <ThreadView conversation={conversation} />;
}
