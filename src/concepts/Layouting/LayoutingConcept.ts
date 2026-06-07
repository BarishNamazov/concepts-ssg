import type { ID } from "@utils/types.ts";

type Layout = ID;
type Entry = ID;

interface LayoutDoc {
  _id: Layout;
  source: string;
}

interface LayoutDep {
  _id: Layout;
  uses: Layout[];
}

interface EntryDoc {
  _id: Entry;
  layoutName?: string;
  composed?: string;
}

const SELF_CLOSE_RE = /<([A-Z]\w*)\s*\/>/g;
const WRAP_OPEN_RE = /<([A-Z]\w*)>/g;
const VAR_RE = /\{\{(\w+)\}\}/g;
const EACH_RE = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
const SLOT_RE = /<slot\b[^>]*>([\s\S]*?)<\/slot>|<slot\s*\/>/g;

export default class LayoutingConcept {
  private layouts = new Map<Layout, LayoutDoc>();
  private layoutDeps = new Map<Layout, LayoutDep>();
  private entries = new Map<Entry, EntryDoc>();

  async define({
    name,
    source,
  }: {
    name: string;
    source: string;
  }): Promise<{ layout: Layout }> {
    const layoutId = name as Layout;

    const existingLayout = this.layouts.get(layoutId) ?? {
      _id: layoutId,
      source,
    };
    existingLayout.source = source;
    this.layouts.set(layoutId, existingLayout);

    const uses = this.#parseUses(source);
    const existingDep = this.layoutDeps.get(layoutId) ?? {
      _id: layoutId,
      uses,
    };
    existingDep.uses = uses;
    this.layoutDeps.set(layoutId, existingDep);

    return { layout: layoutId };
  }

  async compose({
    layoutName,
  }: {
    layoutName: string;
  }): Promise<{ layoutName: string; composed: string } | { error: string }> {
    const result = this.#resolveLayout(layoutName, new Set());
    if (typeof result === "object" && "error" in result) return result;
    const composed = result as string;

    const doc = this.entries.get(layoutName as Entry) ?? {
      _id: layoutName as Entry,
    };
    doc.composed = composed;
    this.entries.set(layoutName as Entry, doc);

    return { layoutName, composed };
  }

  async apply({
    entry,
    layoutName,
    variables,
    command,
  }: {
    entry: Entry;
    layoutName: string;
    variables: Record<string, string | Record<string, string>[]>;
    command?: string;
  }): Promise<
    | { entry: Entry; composed: string; command?: string }
    | { error: string; command?: string }
  > {
    const resolved = this.#resolveLayout(layoutName, new Set());
    if (typeof resolved === "object" && "error" in resolved) {
      if (resolved.error.startsWith("Layout not found")) {
        const composed =
          typeof variables.content === "string" ? variables.content : "";
        const doc = this.entries.get(entry) ?? { _id: entry };
        doc.layoutName = layoutName;
        doc.composed = composed;
        this.entries.set(entry, doc);
        return { entry, composed, command };
      }
      return { ...resolved, command };
    }

    const slotContent =
      typeof variables.content === "string" ? variables.content : undefined;
    const composed = this.#renderTemplate(
      resolved as string,
      variables,
      slotContent,
    );

    const doc = this.entries.get(entry) ?? { _id: entry };
    doc.layoutName = layoutName;
    doc.composed = composed;
    this.entries.set(entry, doc);

    return { entry, composed, command };
  }

  async _getLayout({
    name,
  }: {
    name: string;
  }): Promise<{ layout: Layout; source: string }[]> {
    const doc = this.layouts.get(name as Layout);
    if (!doc) return [];
    return [{ layout: doc._id, source: doc.source }];
  }

  async _getUses({ layout }: { layout: Layout }): Promise<{ name: Layout }[]> {
    const doc = this.layoutDeps.get(layout);
    if (!doc) return [];
    return doc.uses.map((name) => ({ name }));
  }

  async _getComposed({
    entry,
  }: {
    entry: Entry;
  }): Promise<{ composed: string }[]> {
    const doc = this.entries.get(entry);
    if (!doc || doc.composed === undefined) return [];
    return [{ composed: doc.composed }];
  }

  /**
   * remove ({ name }): ({ name }) | ({ error })
   *
   * **requires** `name` is an existing layout
   *
   * **effects** removes the layout definition and its dependency record
   */
  async remove({
    name,
  }: {
    name: string;
  }): Promise<{ name: string } | { error: string }> {
    const id = name as Layout;
    if (!this.layouts.has(id)) {
      return { error: `Layout not found: ${name}` };
    }
    this.layouts.delete(id);
    this.layoutDeps.delete(id);
    return { name };
  }

  #parseUses(source: string): Layout[] {
    const names = new Set<string>();
    for (const m of source.matchAll(SELF_CLOSE_RE)) {
      names.add(m[1]);
    }
    SELF_CLOSE_RE.lastIndex = 0;
    for (const m of source.matchAll(WRAP_OPEN_RE)) {
      if (!m[0].startsWith("</")) names.add(m[1]);
    }
    WRAP_OPEN_RE.lastIndex = 0;
    return [...names] as Layout[];
  }

  #resolveLayout(
    layoutName: string,
    visited: Set<string>,
    cache: Map<string, string> = new Map(),
  ): string | { error: string } {
    if (cache.has(layoutName)) return cache.get(layoutName) as string;

    if (visited.has(layoutName)) {
      return {
        error: `Circular dependency detected for layout: ${layoutName}`,
      };
    }
    visited.add(layoutName);

    const layout = this.layouts.get(layoutName as Layout);
    if (!layout) return { error: `Layout not found: ${layoutName}` };

    const depDoc = this.layoutDeps.get(layoutName as Layout);
    const uses = depDoc?.uses ?? [];

    const resolvedDeps = new Map<string, string>();
    for (const use of uses) {
      const result = this.#resolveLayout(
        use as string,
        new Set(visited),
        cache,
      );
      if (typeof result === "object" && "error" in result) return result;
      resolvedDeps.set(use as string, result as string);
    }

    let source = layout.source;

    for (const [name, resolved] of resolvedDeps) {
      source = source.replace(new RegExp(`<${name}\\s*/>`, "g"), resolved);
    }

    for (const [name, resolved] of resolvedDeps) {
      const wrapRe = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "g");
      source = source.replace(wrapRe, (_full: string, inner: string) => {
        return resolved.replace(SLOT_RE, inner);
      });
    }

    cache.set(layoutName, source);
    return source;
  }

  #renderTemplate(
    template: string,
    variables: Record<string, string | Record<string, string>[]>,
    slotContent?: string,
  ): string {
    let result = template.replace(
      SLOT_RE,
      (_full: string, fallback?: string) => {
        if (slotContent !== undefined) return slotContent;
        return fallback ?? "";
      },
    );

    result = result.replace(
      EACH_RE,
      (_m, collectionName: string, inner: string) => {
        const collection = variables[collectionName];
        if (!Array.isArray(collection) || collection.length === 0) return "";
        return collection
          .map((item) =>
            inner.replace(VAR_RE, (_vm: string, varName: string) => {
              return (item as Record<string, string>)[varName] ?? "";
            }),
          )
          .join("");
      },
    );

    result = result.replace(VAR_RE, (_, name: string) => {
      const val = variables[name];
      if (typeof val === "string") return val;
      return "";
    });

    return result;
  }
}
