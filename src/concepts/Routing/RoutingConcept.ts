import path from "node:path";
import type { Empty, ID } from "@utils/types.ts";

type Entry = ID;

interface EntryDoc {
  _id: Entry;
  filePath: string;
  route: string;
}

interface Config {
  stripPrefix: string;
  indexName: string;
}

export default class RoutingConcept {
  private entries = new Map<Entry, EntryDoc>();
  private config: Config = {
    stripPrefix: "",
    indexName: "index",
  };

  constructor(namespace?: string) {
    void namespace;
  }

  async clear(): Promise<Empty> {
    this.entries.clear();
    return {};
  }

  async configure({
    stripPrefix,
    indexName,
  }: {
    stripPrefix?: string;
    indexName?: string;
  }): Promise<Empty> {
    if (stripPrefix !== undefined) {
      this.config.stripPrefix = stripPrefix.replace(/[/\\]+$/, "");
    }
    if (indexName !== undefined) this.config.indexName = indexName;
    return {};
  }

  async derive({
    entry,
    filePath,
  }: {
    entry: ID;
    filePath: string;
  }): Promise<{ entry: ID; route: string } | { error: string }> {
    const { stripPrefix, indexName } = this.config;

    let relative = filePath;

    if (stripPrefix) {
      const prefixSlash = `${stripPrefix}/`;
      if (relative.startsWith(prefixSlash)) {
        relative = relative.slice(prefixSlash.length);
      } else if (relative === stripPrefix) {
        relative = "";
      }
    }

    const ext = path.extname(relative);
    let routeBase = ext ? relative.slice(0, -ext.length) : relative;

    const base = path.basename(routeBase);
    if (base === indexName) {
      routeBase = path.dirname(routeBase);
      if (routeBase === ".") {
        routeBase = "";
      }
    }

    let route = `/${routeBase}`;
    route = route.replace(/\\/g, "/").replace(/\/+/g, "/");
    if (route !== "/" && route.endsWith("/")) {
      route = route.slice(0, -1);
    }

    for (const [existingEntry, doc] of this.entries) {
      if (existingEntry !== entry && doc.route === route) {
        return {
          error: `Route collision: "${route}" is already assigned to another entry`,
        };
      }
    }

    this.entries.set(entry, { _id: entry, filePath, route });

    return { entry, route };
  }

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

  async _getConfig(): Promise<{ stripPrefix: string; indexName: string }[]> {
    return [{ ...this.config }];
  }

  async _getRoute({ entry }: { entry: ID }): Promise<{ route: string }[]> {
    const doc = this.entries.get(entry);
    if (!doc) return [];
    return [{ route: doc.route }];
  }

  async _getByRoute({ route }: { route: string }): Promise<{ entry: ID }[]> {
    return [...this.entries.values()]
      .filter((doc) => doc.route === route)
      .map((doc) => ({ entry: doc._id }));
  }
}
