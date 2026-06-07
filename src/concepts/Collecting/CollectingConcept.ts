import type { Empty, ID } from "@utils/types.ts";

type Entry = ID;

interface IndexEntry {
  _id: Entry;
  collections: string[];
  metadata: Record<string, string>;
}

/**
 * Collecting concept — aggregate entry metadata by collection for index/list
 * pages.  Each entry declares which collections it belongs to via frontmatter
 * (e.g., `collections: posts`).  The index page is itself a member of the
 * collection; it is excluded from its own listing.
 *
 * **purpose** aggregate entry metadata by collection for index/list pages
 *
 * **principle** after entries declare `collections: posts` in frontmatter
 * and an index page joins the same collection, the index page can iterate
 * all other members via `{{#each posts}}` in its template.
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
   * finalize (): ({})
   *
   * **requires** true
   *
   * **effects** none — a no-op semaphore that syncs trigger on to start
   *   index page regeneration
   */
  async finalize(): Promise<Empty> {
    return {};
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
   * _getEntries ({ collection }): ({ metadata })
   *
   * **requires** true
   *
   * **effects** returns all collected entries that belong to the given
   *   collection
   */
  async _getEntries({
    collection,
  }: {
    collection: string;
  }): Promise<{ metadata: Record<string, string> }[]> {
    const entries = [...this.indexed.values()]
      .filter((e) => e.collections.includes(collection))
      .map((e) => ({ metadata: e.metadata }));
    return entries;
  }
}
