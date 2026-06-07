import type { Empty, ID } from "@utils/types.ts";

type Entry = ID;

interface EntryDoc {
  _id: Entry;
  raw: string;
  frontmatter: string | null;
  body: string;
}

/** Frontmattering [Entry] — extract structured metadata from the header of content files. */
export default class FrontmatteringConcept {
  private entries = new Map<Entry, EntryDoc>();

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

    if (raw.startsWith("---\n")) {
      const contentStart = 4;
      const closingIndex = raw.indexOf("\n---", contentStart);
      if (closingIndex !== -1) {
        frontmatter = raw.substring(contentStart, closingIndex);
        let bodyStart = closingIndex + 4;
        if (raw[bodyStart] === "\n") bodyStart++;
        body = raw.substring(bodyStart);
      } else {
        body = raw;
      }
    } else {
      body = raw;
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
    const fields = this.parseYaml(doc.frontmatter);
    if (!(field in fields)) return [];
    return [{ value: fields[field] }];
  }

  async _getAllFields({
    entry,
  }: {
    entry: Entry;
  }): Promise<Array<{ fields: Record<string, string | number | boolean> }>> {
    const doc = this.entries.get(entry);
    if (!doc) return [];
    const fields = this.parseYaml(doc.frontmatter);
    return [{ fields }];
  }

  private parseYaml(
    yaml: string | null,
  ): Record<string, string | number | boolean> {
    if (!yaml) return {};
    const result: Record<string, string | number | boolean> = {};
    const lines = yaml.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;
      const key = trimmed.substring(0, colonIndex).trim();
      const rawValue = trimmed.substring(colonIndex + 1).trim();
      result[key] = this.parseYamlValue(rawValue);
    }
    return result;
  }

  private parseYamlValue(raw: string): string | number | boolean {
    if (raw === "true") return true;
    if (raw === "false") return false;
    const num = Number(raw);
    if (!Number.isNaN(num) && raw !== "") return num;
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      return raw.slice(1, -1);
    }
    return raw;
  }
}
