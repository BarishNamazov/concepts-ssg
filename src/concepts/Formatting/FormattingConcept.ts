import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";
import { marked } from "marked";

interface FormattedEntry {
  _id: ID;
  source: string;
  format: string;
  html: string;
}

export default class FormattingConcept {
  private entries = new Map<ID, FormattedEntry>();

  constructor(namespace?: string) {
    void namespace;
  }

  async render({
    entry,
    source,
    format,
  }: {
    entry?: ID;
    source: string;
    format: string;
  }): Promise<{ entry: ID; html: string } | { error: string }> {
    if (format === "html") {
      const id = entry ?? freshID();
      this.entries.set(id, { _id: id, source, format, html: source });
      return { entry: id, html: source };
    }

    if (format !== "markdown") {
      return { error: `unsupported format: ${format}` };
    }

    let html: string;
    try {
      html = await marked.parse(source);
    } catch (err) {
      return { error: `Failed to render markdown: ${String(err)}` };
    }

    const id = entry ?? freshID();

    this.entries.set(id, {
      _id: id,
      source,
      format,
      html,
    });

    return { entry: id, html };
  }

  _getHtml({ entry }: { entry: ID }): { html: string }[] {
    const doc = this.entries.get(entry);
    if (!doc) return [];
    return [{ html: doc.html }];
  }

  _getSource({ entry }: { entry: ID }): { source: string; format: string }[] {
    const doc = this.entries.get(entry);
    if (!doc) return [];
    return [{ source: doc.source, format: doc.format }];
  }

  /**
   * remove ({ entry }): ({ entry }) | ({ error })
   *
   * **requires** `entry` is an existing formatted entry
   *
   * **effects** removes the rendered entry from state
   */
  async remove({
    entry,
  }: {
    entry: ID;
  }): Promise<{ entry: ID } | { error: string }> {
    if (!this.entries.has(entry)) {
      return { error: `Entry not found: ${entry}` };
    }
    this.entries.delete(entry);
    return { entry };
  }

  /**
   * clear (): {}
   *
   * **requires** nothing
   *
   * **effects** removes all rendered entries from state
   */
  async clear(): Promise<Record<PropertyKey, never>> {
    this.entries.clear();
    return {};
  }
}
