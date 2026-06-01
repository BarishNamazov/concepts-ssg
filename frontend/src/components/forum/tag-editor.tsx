"use client";

import { useState } from "react";
import { Plus, Tag as TagIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Tag } from "@/lib/models";

/** Inline tag list with add/remove controls for one post (`target` = post id). */
export function TagEditor({
  target,
  tags,
  onChanged,
}: {
  target: string;
  tags: Tag[];
  onChanged: () => void;
}) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const trimmed = name.trim();
    if (!session || !trimmed) return;
    setBusy(true);
    const created = await api.tags.create({ session, name: trimmed });
    if ("error" in created) {
      setBusy(false);
      toast.error(created.error);
      return;
    }
    const applied = await api.tags.add({
      session,
      target,
      tag: String(created.tag),
    });
    setBusy(false);
    if ("error" in applied) toast.error(applied.error);
    else {
      setName("");
      onChanged();
    }
  }

  async function remove(tag: string) {
    if (!session) return;
    const result = await api.tags.remove({ session, target, tag });
    if ("error" in result) toast.error(result.error);
    else onChanged();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span key={String(tag.tag)} className="inline-flex items-center">
          <Link href={`/tags/${tag.tag}`}>
            <Badge
              variant="secondary"
              className="font-normal text-muted-foreground hover:text-foreground"
            >
              #{tag.name}
            </Badge>
          </Link>
          {session ? (
            <button
              type="button"
              onClick={() => remove(String(tag.tag))}
              className="-ml-1 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
              aria-label={`Remove tag ${tag.name}`}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}

      {session ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground"
            >
              <TagIcon className="size-3" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="tag name"
                className="h-8"
                autoFocus
              />
              <Button
                size="icon"
                className="size-8 shrink-0"
                onClick={add}
                disabled={busy || !name.trim()}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Press Enter to create &amp; apply the tag.
            </p>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
