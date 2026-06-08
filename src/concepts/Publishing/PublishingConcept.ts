import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";

type Publication = ID;
type Artifact = ID;

interface PublicationDoc {
  _id: Publication;
  destination: string;
  status: "STAGING" | "PUBLISHED" | "FAILED";
  error?: string;
}

interface ArtifactDoc {
  _id: Artifact;
  publication: Publication;
  relativePath: string;
  content: string;
}

/**
 * Publishing [Artifact]
 *
 * **purpose** make a coherent set of generated artifacts available as the
 *   current publication, without leaving stale files from previous builds
 *
 * **principle** after artifacts are staged and the publication is committed,
 *   exactly those artifacts exist in the destination; any files from prior
 *   publications are removed
 *
 * **state**
 *   a set of Publications with a destination and status
 *   a set of Artifacts with a relativePath and content
 */
export default class PublishingConcept {
  private publications = new Map<Publication, PublicationDoc>();
  private artifacts = new Map<Artifact, ArtifactDoc>();

  /**
   * begin ({ destination }): ({ publication })
   *
   * **requires** destination is a valid filesystem path
   *
   * **effects** creates a new publication in STAGING status
   */
  async begin({
    destination,
  }: {
    destination: string;
  }): Promise<{ publication: Publication }> {
    const id = freshID();
    this.publications.set(id, {
      _id: id,
      destination,
      status: "STAGING",
    });
    return { publication: id };
  }

  /**
   * stage ({ publication, relativePath, content }): ({ artifact }) | ({ error })
   *
   * **requires** `publication` is an existing publication in STAGING status
   *
   * **effects** stores the artifact content ready for commit
   */
  async stage({
    publication,
    relativePath,
    content,
  }: {
    publication: Publication;
    relativePath: string;
    content: string;
  }): Promise<{ artifact: Artifact } | { error: string }> {
    const pub = this.publications.get(publication);
    if (!pub) return { error: `Publication not found: ${publication}` };
    if (pub.status !== "STAGING") {
      return {
        error: `Publication is not staging (${pub.status}): ${publication}`,
      };
    }

    const id = freshID();
    this.artifacts.set(id, { _id: id, publication, relativePath, content });
    return { artifact: id };
  }

  /**
   * commit ({ publication }): ({ publication }) | ({ error })
   *
   * **requires** `publication` is in STAGING status
   *
   * **effects** writes all staged artifacts to the destination; removes any
   *   pre-existing files in the destination that are not in the staged set;
   *   marks the publication as PUBLISHED
   */
  async commit({
    publication,
  }: {
    publication: Publication;
  }): Promise<{ publication: Publication } | { error: string }> {
    const pub = this.publications.get(publication);
    if (!pub) return { error: `Publication not found: ${publication}` };
    if (pub.status !== "STAGING") {
      return {
        error: `Publication is not staging (${pub.status}): ${publication}`,
      };
    }

    const stagedArtifacts = [...this.artifacts.values()].filter(
      (a) => a.publication === publication,
    );
    const stagedPaths = new Set(
      stagedArtifacts.map((a) => path.join(pub.destination, a.relativePath)),
    );

    // Ensure destination exists
    try {
      await mkdir(pub.destination, { recursive: true });
    } catch (err) {
      return {
        error: `Failed to create destination directory: ${String(err)}`,
      };
    }

    // Remove stale files: any file in destination not in staged set
    try {
      await this.#cleanStale(pub.destination, stagedPaths);
    } catch (err) {
      return { error: `Failed to clean stale files: ${String(err)}` };
    }

    // Write all staged artifacts
    for (const artifact of stagedArtifacts) {
      const fullPath = path.join(pub.destination, artifact.relativePath);
      const dir = path.dirname(fullPath);
      try {
        await mkdir(dir, { recursive: true });
        await writeFile(fullPath, artifact.content, "utf-8");
      } catch (err) {
        return {
          error: `Failed to write ${artifact.relativePath}: ${String(err)}`,
        };
      }
    }

    pub.status = "PUBLISHED";
    return { publication };
  }

  /**
   * fail ({ publication, error }): ({ publication }) | ({ error })
   *
   * **requires** `publication` is in STAGING status
   *
   * **effects** marks the publication as FAILED without writing any files
   */
  async fail({
    publication,
    error,
  }: {
    publication: Publication;
    error: string;
  }): Promise<{ publication: Publication } | { error: string }> {
    const pub = this.publications.get(publication);
    if (!pub) return { error: `Publication not found: ${publication}` };
    if (pub.status !== "STAGING") {
      return {
        error: `Publication is not staging (${pub.status}): ${publication}`,
      };
    }
    pub.status = "FAILED";
    pub.error = error;
    return { publication };
  }

  /**
   * _getArtifacts ({ publication }): ({ artifact, relativePath })
   *
   * **requires** `publication` is an existing publication
   *
   * **effects** returns all staged artifacts for the publication
   */
  async _getArtifacts({
    publication,
  }: {
    publication: Publication;
  }): Promise<{ artifact: Artifact; relativePath: string }[]> {
    return [...this.artifacts.values()]
      .filter((a) => a.publication === publication)
      .map((a) => ({ artifact: a._id, relativePath: a.relativePath }));
  }

  /**
   * _getStatus ({ publication }): ({ status, error? })
   *
   * **requires** `publication` is an existing publication
   *
   * **effects** returns the publication's status
   */
  async _getStatus({
    publication,
  }: {
    publication: Publication;
  }): Promise<{ status: string; error?: string }[]> {
    const pub = this.publications.get(publication);
    if (!pub) return [];
    return [{ status: pub.status, error: pub.error }];
  }

  // ── private helpers ───────────────────────────────────────────────────

  /** Recursively remove files in `dir` that are not in `keep`. */
  async #cleanStale(dir: string, keep: Set<string>): Promise<void> {
    let entries: { name: string; isDir: boolean }[];
    try {
      const dirents = await readdir(dir, { withFileTypes: true });
      entries = dirents.map((d) => ({
        name: d.name,
        isDir: d.isDirectory(),
      }));
    } catch {
      return; // directory doesn't exist yet, nothing to clean
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDir) {
        await this.#cleanStale(fullPath, keep);
        // Remove empty directories
        try {
          const remaining = await readdir(fullPath);
          if (remaining.length === 0) {
            await rm(fullPath, { recursive: true });
          }
        } catch {
          // ignore
        }
      } else if (!keep.has(fullPath)) {
        await rm(fullPath);
      }
    }
  }
}
