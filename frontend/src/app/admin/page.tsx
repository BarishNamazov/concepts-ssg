"use client";

import { useState } from "react";
import { FolderPlus, Shield, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/forum/page";
import { CategoryDot } from "@/components/forum/badges";
import { UserName } from "@/components/forum/user-name";
import {
  EmptyState,
  LoadingState,
} from "@/components/forum/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { FORUM_CONTEXT, useAuth } from "@/lib/auth";
import type { Category, RoleRow } from "@/lib/models";
import { shortId } from "@/lib/format";

const CAPABILITIES = ["administer", "moderate", "pin"] as const;

function CategoryAdmin() {
  const { session } = useAuth();
  const { data, refetch } = useQuery<{ categories: Category[] }>(
    () => api.categories.list({}),
    [],
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function create() {
    if (!session || !name.trim()) return;
    const result = await api.categories.create({
      session,
      name: name.trim(),
      description: description.trim(),
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Category created");
      setName("");
      setDescription("");
      refetch();
    }
  }

  async function remove(category: string) {
    if (!session) return;
    const result = await api.categories.delete({ session, category });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Category deleted");
      refetch();
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <FolderPlus className="size-5" />
          New category
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Announcements"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">Description</Label>
            <Input
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What belongs here?"
            />
          </div>
        </div>
        <Button className="mt-4" onClick={create} disabled={!name.trim()}>
          Create category
        </Button>
      </section>

      <section>
        <h3 className="eyebrow mb-3">Existing categories</h3>
        {!data || data.categories.length === 0 ? (
          <EmptyState title="No categories" description="Create your first category above." />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {data.categories.map((category) => (
              <div
                key={String(category.category)}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-2.5">
                  <CategoryDot id={String(category.category)} className="size-3.5" />
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {category.description || "No description"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() => remove(String(category.category))}
                  aria-label="Delete category"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RoleAdmin() {
  const { session } = useAuth();
  const [roleName, setRoleName] = useState("");
  const [caps, setCaps] = useState<string[]>([]);
  const [grantUser, setGrantUser] = useState("");
  const [grantRole, setGrantRole] = useState("");
  const [lookupUser, setLookupUser] = useState("");
  const [queryUser, setQueryUser] = useState<string | null>(null);

  const roles = useQuery<{ roles: RoleRow[] }>(
    queryUser
      ? () => api.roles.forUser({ user: queryUser, context: FORUM_CONTEXT })
      : null,
    [queryUser],
  );

  function toggleCap(cap: string) {
    setCaps((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  }

  async function define() {
    if (!session || !roleName.trim() || caps.length === 0) return;
    const result = await api.roles.define({
      session,
      name: roleName.trim(),
      // The inferred contract types `capabilities` as a single string (symbolic
      // frame vars collapse to string), but the backend expects a string[].
      capabilities: caps as unknown as string,
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(`Role "${roleName.trim()}" defined`);
      setRoleName("");
      setCaps([]);
    }
  }

  async function grant() {
    if (!session || !grantUser.trim() || !grantRole.trim()) return;
    const result = await api.roles.grant({
      session,
      user: grantUser.trim(),
      context: FORUM_CONTEXT,
      role: grantRole.trim(),
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Role granted");
      setGrantUser("");
      setGrantRole("");
      if (queryUser === grantUser.trim()) roles.refetch();
    }
  }

  async function revoke(role: string) {
    if (!session || !queryUser) return;
    const result = await api.roles.revoke({
      session,
      user: queryUser,
      context: FORUM_CONTEXT,
      role,
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Role revoked");
      roles.refetch();
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <Shield className="size-5" />
          Define a role
        </h3>
        <div className="space-y-2">
          <Label htmlFor="role-name">Role name</Label>
          <Input
            id="role-name"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. moderator"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label>Capabilities</Label>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((cap) => (
              <button
                key={cap}
                type="button"
                onClick={() => toggleCap(cap)}
                className={
                  "rounded-full border px-3 py-1 text-sm capitalize transition-colors " +
                  (caps.includes(cap)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted")
                }
              >
                {cap}
              </button>
            ))}
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={define}
          disabled={!roleName.trim() || caps.length === 0}
        >
          Define role
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <UserCog className="size-5" />
          Grant a role
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="grant-user">User ID</Label>
            <Input
              id="grant-user"
              value={grantUser}
              onChange={(e) => setGrantUser(e.target.value)}
              placeholder="user id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grant-role">Role name</Label>
            <Input
              id="grant-role"
              value={grantRole}
              onChange={(e) => setGrantRole(e.target.value)}
              placeholder="role name"
            />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={grant}
          disabled={!grantUser.trim() || !grantRole.trim()}
        >
          Grant role
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-display text-lg font-semibold">
          Inspect a user&apos;s roles
        </h3>
        <div className="flex gap-2">
          <Input
            value={lookupUser}
            onChange={(e) => setLookupUser(e.target.value)}
            placeholder="user id"
          />
          <Button
            variant="outline"
            onClick={() => setQueryUser(lookupUser.trim() || null)}
            disabled={!lookupUser.trim()}
          >
            Look up
          </Button>
        </div>
        {queryUser ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted-foreground">
              Roles for <UserName user={queryUser} className="text-foreground" /> (
              {shortId(queryUser)})
            </p>
            {roles.loading ? (
              <LoadingState />
            ) : !roles.data || roles.data.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles in this context.</p>
            ) : (
              <ul className="space-y-2">
                {roles.data.roles.map((r) => (
                  <li
                    key={String(r.role)}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="font-mono text-sm">{shortId(String(r.role))}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => revoke(String(r.role))}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function AdminPage() {
  const { loading, can } = useAuth();

  if (loading)
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );

  if (!can.administer)
    return (
      <PageContainer>
        <EmptyState
          icon={Shield}
          title="Administrators only"
          description="You don't have permission to view the admin console."
        />
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Console"
        title="Administration"
        description="Manage categories and the roles that grant moderation powers."
      />
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-6">
          <CategoryAdmin />
        </TabsContent>
        <TabsContent value="roles" className="mt-6">
          <RoleAdmin />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
