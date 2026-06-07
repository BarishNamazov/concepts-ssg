import type { Empty, ID } from "@utils/types.ts";
import { parse as parseYaml } from "yaml";

type Entry = ID;

interface EntryDoc {
  _id: Entry;
  raw: string;
  frontmatter: string | null;
  body: string;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Frontmattering [Document]
 *
 * **purpose** let metadata travel with a textual document while remaining
 *   independently accessible from its body
 *
 * **principle** after parsing a document with a fenced metadata header, the
 *   metadata fields and clean body can be retrieved separately
 */
export default class FrontmatteringConcept {
  private entries = new Map<Entry, EntryDoc>();

  /**
   * parse ({ entry, raw, command? }): ({ entry, command? })
   *
   * **requires** none
   *
   * **effects** stores parsed frontmatter and body for the entry. Supports
   *   both LF and CRLF line endings. If no valid frontmatter fence is found,
   *   the entire raw content becomes the body.
   */
  async parse({
    entry,
    raw,
    command,
  }: {
    entry: Entry;
    raw: string;
    command?: string;
  }): Promise<{ entry: Entry; command?: string }> {
    let frontmatter: string | null = null;
    let body: string;

    // Normalize CRLF to LF for consistent fence detection
    const normalized = raw.replace(/\r\n/g, "\n");

    if (normalized.startsWith("---\n")) {
      const contentStart = 4;
      const closingIndex = normalized.indexOf("\n---", contentStart);
      if (closingIndex !== -1) {
        frontmatter = normalized.substring(contentStart, closingIndex);
        let bodyStart = closingIndex + 4;
        if (normalized[bodyStart] === "\n") bodyStart++;
        body = normalized.substring(bodyStart);
      } else {
        body = normalized;
      }
    } else {
      body = normalized;
    }

    const existing = this.entries.get(entry);
    if (existing) {
      existing.raw = raw;
      existing.frontmatter = frontmatter;
      existing.body = body;
    } else {
      this.entries.set(entry, { _id: entry, raw, frontmatter, body });
    }

    return { entry, command };
  }

  async clear(): Promise<Empty> {
    this.entries.clear();
    return {};
  }

  async remove({
    entry,
  }: {
    entry: Entry;
  }): Promise<{ entry: Entry } | { error: string }> {
    if (!this.entries.has(entry)) {
      return { error: `Entry not found: ${entry}` };
    }
    this.entries.delete(entry);
    return { entry };
  }

  async _getBody({
    entry,
  }: {
    entry: Entry;
  }): Promise<Array<{ body: string }>> {
    const doc = this.entries.get(entry);
    if (!doc) return [];
    return [{ body: doc.body }];
  }

  async _getFrontmatter({
    entry,
  }: {
    entry: Entry;
  }): Promise<Array<{ frontmatter: string | null }>> {
    const doc = this.entries.get(entry);
    if (!doc) return [];
    return [{ frontmatter: doc.frontmatter }];
  }

  async _getField({
    entry,
    field,
  }: {
    entry: Entry;
    field: string;
  }): Promise<Array<{ value: string | number | boolean }>> {
    const doc = this.entries.get(entry);
    if (!doc) return [];
    const fields = this.#parseFrontmatter(doc.frontmatter);
    if (!(field in fields)) return [];
    const val = fields[field];
    if (
      typeof val === "string" ||
      typeof val === "number" ||
      typeof val === "boolean"
    ) {
      return [{ value: val }];
    }
    return [];
  }

  async _getAllFields({
    entry,
  }: {
    entry: Entry;
  }): Promise<Array<{ fields: Record<string, string | number | boolean> }>> {
    const doc = this.entries.get(entry);
    if (!doc) return [];
    const fields = this.#parseFrontmatter(doc.frontmatter);
    const flat: Record<string, string | number | boolean> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (
        typeof val === "string" ||
        typeof val === "number" ||
        typeof val === "boolean"
      ) {
        flat[key] = val;
      } else {
        flat[key] = JSON.stringify(val);
      }
    }
    return [{ fields: flat }];
  }

  /** Parse YAML frontmatter string into a flat key-value map. */
  #parseFrontmatter(yaml: string | null): Record<string, JsonValue> {
    if (!yaml) return {};
    try {
      const parsed = parseYaml(yaml);
      if (parsed === null || parsed === undefined) return {};
      if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed as Record<string, JsonValue>;
    } catch {
      return {};
    }
  }
}
