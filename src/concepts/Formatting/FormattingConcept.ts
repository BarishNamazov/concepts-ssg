import { freshID } from "@utils/database.ts";
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
    command,
  }: {
    entry?: ID;
    source: string;
    format: string;
    command?: string;
  }): Promise<
    | { entry: ID; html: string; command?: string }
    | { error: string; command?: string }
  > {
    if (format === "html") {
      const id = entry ?? freshID();
      this.entries.set(id, { _id: id, source, format, html: source });
      return { entry: id, html: source, command };
    }

    if (format !== "markdown") {
      return { error: `unsupported format: ${format}`, command };
    }

    const html = await marked.parse(source);
    const id = entry ?? freshID();

    this.entries.set(id, {
      _id: id,
      source,
      format,
      html,
    });

    return { entry: id, html, command };
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
}
