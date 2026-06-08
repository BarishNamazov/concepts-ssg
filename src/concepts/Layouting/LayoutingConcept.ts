import { freshID } from "@utils/id.ts";
import type { Empty, ID } from "@utils/types.ts";

type Layout = ID;
type Entry = ID;

interface LayoutDoc {
  _id: Layout;
  name: string;
  source: string;
}

interface LayoutDep {
  _id: Layout;
  name: string;
  uses: string[];
}

interface EntryDoc {
  _id: Entry;
  layoutName?: string;
  composed?: string;
}

/** Parsed `{{#each}}` block from a template. */
export interface EachBlock {
  collection: string;
  sortBy?: string;
  excludeCurrent: boolean;
  inner: string;
  fullMatch: string;
}

/** One item in a sequence passed to `apply`. */
export interface SequenceItem {
  entry: ID;
  fields: Record<string, string>;
}

type TemplateVariables = Record<string, string>;
type TemplateSequences = Record<string, SequenceItem[]>;

const SELF_CLOSE_RE = /<([A-Z]\w*)\s*\/>/g;
const WRAP_OPEN_RE = /<([A-Z]\w*)>/g;
const VAR_RE = /\{\{(\w+)\}\}/g;
const SLOT_RE = /<slot\b[^>]*>([\s\S]*?)<\/slot>|<slot\s*\/>/g;

/** Matches a full `{{#each …}}…{{/each}}` block. */
const EACH_BLOCK_RE = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

/** Splits a directive string like `posts sort=date excludeCurrent=false`. */
const TOKEN_RE = /[^\s"']+|"[^"]*"|'[^']*'/g;

/**
 * Layouting concept — own template definitions, component resolution, and
 * template rendering (variable substitution, slots, `{{#each}}` loops).
 *
 * **purpose** define HTML layouts and apply them to entries with typed
 *   variables and sequences
 *
 * **principle** after a layout is defined and applied to an entry with
 *   variables and optional sequence data, the composed HTML reflects
 *   variable substitution, component resolution, and sequence iteration
 */
export default class LayoutingConcept {
  private layouts = new Map<Layout, LayoutDoc>();
  private layoutDeps = new Map<Layout, LayoutDep>();
  private entries = new Map<Entry, EntryDoc>();
  private compositions = new Map<Layout, { composed: string }>();
  private nameIndex = new Map<string, Layout>();

  // ── public actions ───────────────────────────────────────────────────

  /**
   * define ({ name, source }): ({ layout })
   *
   * **requires** `name` is a non-empty string
   *
   * **effects** allocates a fresh layout ID, stores the layout source and
   *   its sub-layout dependencies, and updates the name-to-ID index
   */
  async define({
    name,
    source,
  }: {
    name: string;
    source: string;
  }): Promise<{ layout: Layout }> {
    const layoutId = freshID();

    const uses = this.#parseUses(source);

    const prevId = this.nameIndex.get(name);
    if (prevId !== undefined) {
      this.layouts.delete(prevId);
      this.layoutDeps.delete(prevId);
      this.compositions.delete(prevId);
    }

    this.nameIndex.set(name, layoutId);
    this.layouts.set(layoutId, { _id: layoutId, name, source });
    this.layoutDeps.set(layoutId, { _id: layoutId, name, uses });

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

    const layoutId = this.nameIndex.get(layoutName);
    if (layoutId === undefined) {
      return { error: `Layout not found: ${layoutName}` };
    }
    this.compositions.set(layoutId, { composed });

    return { layoutName, composed };
  }

  /**
   * apply ({ entry, layoutName, variables, sequences? }):
   *   ({ entry, composed }) | ({ error })
   *
   * **requires** none (missing layout falls through to raw content)
   *
   * **effects** resolves the layout, substitutes variables, iterates
   *   `{{#each}}` blocks using sequence data, and stores the composed HTML
   */
  async apply({
    entry,
    layoutName,
    variables,
    sequences,
  }: {
    entry: Entry;
    layoutName: string;
    variables: TemplateVariables;
    sequences?: TemplateSequences;
  }): Promise<{ entry: Entry; composed: string } | { error: string }> {
    const resolved = this.#resolveLayout(layoutName, new Set());
    if (typeof resolved === "object" && "error" in resolved) {
      if (resolved.error.startsWith("Layout not found")) {
        const composed =
          typeof variables.content === "string" ? variables.content : "";
        const doc = this.entries.get(entry) ?? { _id: entry };
        doc.layoutName = layoutName;
        doc.composed = composed;
        this.entries.set(entry, doc);
        return { entry, composed };
      }
      return resolved;
    }

    const slotContent =
      typeof variables.content === "string" ? variables.content : undefined;
    const composed = this.#renderTemplate(
      resolved as string,
      variables,
      slotContent,
      sequences ?? {},
      entry,
    );

    const doc = this.entries.get(entry) ?? { _id: entry };
    doc.layoutName = layoutName;
    doc.composed = composed;
    this.entries.set(entry, doc);

    return { entry, composed };
  }

  // ── queries ──────────────────────────────────────────────────────────

  async _getLayout({
    name,
  }: {
    name: string;
  }): Promise<{ layout: Layout; name: string; source: string }[]> {
    const layoutId = this.nameIndex.get(name);
    if (layoutId === undefined) return [];
    const doc = this.layouts.get(layoutId);
    if (!doc) return [];
    return [{ layout: doc._id, name: doc.name, source: doc.source }];
  }

  async _getUses({ layout }: { layout: Layout }): Promise<{ name: string }[]> {
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
   * _getSequenceRequests ({ layoutName, content }):
   *   ({ collection, sortBy? })[]
   *
   * **requires** none
   *
   * **effects** resolves the layout, inserts content into its slot, parses
   *   `{{#each}}` blocks, and returns the unique collection names (with
   *   optional `sortBy`) that the template requires
   */
  async _getSequenceRequests({
    layoutName,
    content,
  }: {
    layoutName: string;
    content: string;
  }): Promise<{ collection: string; sortBy?: string }[]> {
    const resolved = this.#resolveLayout(layoutName, new Set());
    const template =
      typeof resolved === "string"
        ? resolved.replace(SLOT_RE, (_full, fallback?: string) => {
            return content !== undefined ? content : (fallback ?? "");
          })
        : content;

    const blocks = this.#parseEachBlocks(template);
    if ("error" in blocks) return [];

    const seen = new Map<string, string | undefined>();
    for (const block of blocks as EachBlock[]) {
      seen.set(block.collection, block.sortBy);
    }
    return [...seen.entries()].map(([collection, sortBy]) => ({
      collection,
      sortBy,
    }));
  }

  // ── mutation ─────────────────────────────────────────────────────────

  async remove({
    name,
  }: {
    name: string;
  }): Promise<{ name: string } | { error: string }> {
    const layoutId = this.nameIndex.get(name);
    if (layoutId === undefined) {
      return { error: `Layout not found: ${name}` };
    }
    this.layouts.delete(layoutId);
    this.layoutDeps.delete(layoutId);
    this.compositions.delete(layoutId);
    this.nameIndex.delete(name);
    return { name };
  }

  async clear(): Promise<Empty> {
    this.layouts.clear();
    this.layoutDeps.clear();
    this.entries.clear();
    this.compositions.clear();
    this.nameIndex.clear();
    return {};
  }

  // ── private template parsing ─────────────────────────────────────────

  #parseUses(source: string): string[] {
    const names = new Set<string>();
    for (const m of source.matchAll(SELF_CLOSE_RE)) {
      names.add(m[1]);
    }
    SELF_CLOSE_RE.lastIndex = 0;
    for (const m of source.matchAll(WRAP_OPEN_RE)) {
      if (!m[0].startsWith("</")) names.add(m[1]);
    }
    WRAP_OPEN_RE.lastIndex = 0;
    return [...names];
  }

  /**
   * Parse all `{{#each …}}…{{/each}}` blocks from a template string.
   *
   * Supported directive options:
   *   `sort=<field>`
   *   `excludeCurrent=true|false` (default true)
   */
  #parseEachBlocks(template: string): EachBlock[] | { error: string } {
    const blocks: EachBlock[] = [];

    for (const match of template.matchAll(EACH_BLOCK_RE)) {
      const [fullMatch, directive, inner] = match;
      const tokens =
        directive
          .trim()
          .match(TOKEN_RE)
          ?.map((t) => t.replace(/^["']|["']$/g, "")) ?? [];
      if (tokens.length === 0) continue;

      const collection = tokens[0];
      let sortBy: string | undefined;
      let excludeCurrent = true;

      for (const token of tokens.slice(1)) {
        const eqIdx = token.indexOf("=");
        if (eqIdx === -1) {
          return { error: `Unsupported each option: ${token}` };
        }
        const key = token.slice(0, eqIdx);
        const value = token.slice(eqIdx + 1);
        if (key === "sort") {
          sortBy = value;
        } else if (key === "excludeCurrent") {
          excludeCurrent = value !== "false";
        } else {
          return { error: `Unsupported each option: ${key}` };
        }
      }

      blocks.push({ collection, sortBy, excludeCurrent, inner, fullMatch });
    }

    return blocks;
  }

  // ── private layout resolution ────────────────────────────────────────

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

    const layoutId = this.nameIndex.get(layoutName);
    if (layoutId === undefined) {
      return { error: `Layout not found: ${layoutName}` };
    }

    const layout = this.layouts.get(layoutId);
    if (!layout) return { error: `Layout not found: ${layoutName}` };

    const depDoc = this.layoutDeps.get(layoutId);
    const uses = depDoc?.uses ?? [];

    const resolvedDeps = new Map<string, string>();
    for (const use of uses) {
      const result = this.#resolveLayout(use, new Set(visited), cache);
      if (typeof result === "object" && "error" in result) return result;
      resolvedDeps.set(use, result as string);
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

  // ── private render ───────────────────────────────────────────────────

  #renderTemplate(
    template: string,
    variables: TemplateVariables,
    slotContent: string | undefined,
    sequences: TemplateSequences,
    currentEntry: Entry | undefined,
  ): string {
    let result = template.replace(
      SLOT_RE,
      (_full: string, fallback?: string) => {
        if (slotContent !== undefined) return slotContent;
        return fallback ?? "";
      },
    );

    // Resolve {{#each}} blocks before scalar variables so `{{title}}` in
    // each-block inner templates resolves against item fields.
    result = result.replace(
      EACH_BLOCK_RE,
      (_full: string, _directive: string, inner: string) => {
        const blocks = this.#parseEachBlocks(_full);
        if (typeof blocks === "object" && "error" in blocks) return "";
        const block = (blocks as EachBlock[])[0];
        if (block === undefined) return "";

        const items = sequences[block.collection] ?? [];
        let filtered = items;
        if (block.excludeCurrent && currentEntry !== undefined) {
          filtered = filtered.filter((item) => item.entry !== currentEntry);
        }
        if (block.sortBy) {
          const sortBy = block.sortBy;
          filtered = [...filtered].sort((a, b) =>
            (b.fields[sortBy] ?? "").localeCompare(a.fields[sortBy] ?? ""),
          );
        }

        return filtered
          .map((item) =>
            inner.replace(VAR_RE, (_vm: string, varName: string) => {
              return item.fields[varName] ?? "";
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
