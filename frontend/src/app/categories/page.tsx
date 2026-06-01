"use client";

import { FolderOpen } from "lucide-react";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/forum/page";
import { CategoryDot } from "@/components/forum/badges";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/forum/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import type { Category } from "@/lib/models";

export default function CategoriesPage() {
  const { data, error, loading, refetch } = useQuery<{
    categories: Category[];
  }>(() => api.categories.list({}), []);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Browse"
        title="Categories"
        description="Topics grouped by the spaces they belong to."
      />
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data || data.categories.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No categories yet"
          description="Categories will appear here once they are created."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.categories.map((category) => (
            <Link
              key={String(category.category)}
              href={`/c/${category.category}`}
              className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="mb-2 flex items-center gap-2.5">
                <CategoryDot id={String(category.category)} className="size-3.5" />
                <h2 className="font-display text-xl font-semibold group-hover:text-primary">
                  {category.name}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {category.description || "No description provided."}
              </p>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
