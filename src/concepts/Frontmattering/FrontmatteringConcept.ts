import type { Empty, ID } from "@utils/types.ts";
import { parse as parseYaml } from "yaml";

type Entry = ID;

interface EntryDoc {
  _id: Entry;
  raw: string;
  frontmatter: string | null;
  body: string;
  fields: Record<string, JsonValue>;
  parseError: string | null;
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
   * parse ({ entry, raw }): ({ entry })
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
  }: {
    entry: Entry;
    raw: string;
  }): Promise<{ entry: Entry }> {
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

    const { fields, parseError } = this.#parseFrontmatter(frontmatter);

    const existing = this.entries.get(entry);
    if (existing) {
      existing.raw = raw;
      existing.frontmatter = frontmatter;
      existing.body = body;
      existing.fields = fields;
      existing.parseError = parseError;
    } else {
      this.entries.set(entry, {
        _id: entry,
        raw,
        frontmatter,
        body,
        fields,
        parseError,
      });
    }

    return { entry };
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
    const fields = doc.fields;
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
    const fmFields = doc.fields;
    const flat: Record<string, string | number | boolean> = {};
    for (const [key, val] of Object.entries(fmFields)) {
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

  /** Parse YAML frontmatter string into a flat key-value map and optional error. */
  #parseFrontmatter(yaml: string | null): {
    fields: Record<string, JsonValue>;
    parseError: string | null;
  } {
    if (!yaml) return { fields: {}, parseError: null };
    try {
      const parsed = parseYaml(yaml);
      if (parsed === null || parsed === undefined) {
        return { fields: {}, parseError: null };
      }
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        return { fields: {}, parseError: null };
      }
      return {
        fields: parsed as Record<string, JsonValue>,
        parseError: null,
      };
    } catch (e) {
      return {
        fields: {},
        parseError: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * _getParseErrors (): ({ entry, error })
   *
   * **requires** true
   *
   * **effects** returns every entry that has a non-null parseError,
   *   together with the error message
   */
  async _getParseErrors(): Promise<Array<{ entry: Entry; error: string }>> {
    const results: Array<{ entry: Entry; error: string }> = [];
    for (const [id, doc] of this.entries) {
      if (doc.parseError != null) {
        results.push({ entry: id, error: doc.parseError });
      }
    }
    return results;
  }
}
