import type { Empty, ID } from "@utils/types.ts";

type Entry = ID;

interface IndexEntry {
  _id: Entry;
  collections: string[];
  metadata: Record<string, string>;
}

/**
 * Collecting concept — aggregate entries into named collections with
 * arbitrary metadata.
 *
 * **purpose** group entries into named collections, each carrying a flat
 *   mapping of metadata keyed by string
 *
 * **principle** after entries are collected into a named collection, all
 *   members and their metadata can be retrieved by collection name
 */
export default class CollectingConcept {
  private indexed = new Map<Entry, IndexEntry>();

  /**
   * collect ({ entry, collections, metadata }): ({ entry })
   *
   * **requires** true
   *
   * **effects** stores the entry's collections and metadata, replacing any
   *   previous collections and merging metadata with existing data
   */
  async collect({
    entry,
    collections,
    metadata,
  }: {
    entry: Entry;
    collections: string[];
    metadata: Record<string, string>;
  }): Promise<{ entry: Entry }> {
    const existing = this.indexed.get(entry);
    const merged: IndexEntry = {
      _id: entry,
      collections,
      metadata: { ...existing?.metadata, ...metadata },
    };
    this.indexed.set(entry, merged);
    return { entry };
  }

  /**
   * clear (): Empty
   *
   * **requires** nothing
   *
   * **effects** removes all collected entries from state
   */
  async clear(): Promise<Empty> {
    this.indexed.clear();
    return {};
  }

  /**
   * remove ({ entry }): ({ entry }) | ({ error })
   *
   * **requires** `entry` is an existing collected entry
   *
   * **effects** removes the entry from all collection memberships
   */
  async remove({
    entry,
  }: {
    entry: Entry;
  }): Promise<{ entry: Entry } | { error: string }> {
    if (!this.indexed.has(entry)) {
      return { error: `Entry not found: ${entry}` };
    }
    this.indexed.delete(entry);
    return { entry };
  }

  /**
   * updateMetadata ({ entry, metadata }): ({ entry }) | ({ error })
   *
   * **requires** `entry` is an existing collected entry
   *
   * **effects** merges the provided metadata into the entry's existing
   *   metadata without changing collection memberships
   */
  async updateMetadata({
    entry,
    metadata,
  }: {
    entry: Entry;
    metadata: Record<string, string>;
  }): Promise<{ entry: Entry }> {
    const existing = this.indexed.get(entry);
    if (!existing) {
      this.indexed.set(entry, { _id: entry, collections: [], metadata });
    } else {
      existing.metadata = { ...existing.metadata, ...metadata };
      this.indexed.set(entry, existing);
    }
    return { entry };
  }

  /**
   * _getEntries ({ collection }): ({ entry, metadata })
   *
   * **requires** true
   *
   * **effects** returns all collected entries that belong to the given
   *   collection, each with its identity and metadata
   */
  async _getEntries({
    collection,
  }: {
    collection: string;
  }): Promise<{ entry: Entry; metadata: Record<string, string> }[]> {
    return [...this.indexed.values()]
      .filter((e) => e.collections.includes(collection))
      .map((e) => ({ entry: e._id, metadata: e.metadata }));
  }
}
