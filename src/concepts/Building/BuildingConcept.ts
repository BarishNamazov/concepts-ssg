import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";

type Build = ID;

interface BuildDoc {
  _id: Build;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  error?: string;
}

/**
 * Building concept — track the lifecycle of a build run.
 *
 * **purpose** track whether a production run across multiple inputs completed
 *   successfully or failed
 *
 * **principle** after a build is started, it is in RUNNING status; when all
 *   processing succeeds the build becomes SUCCEEDED, and when any required
 *   processing fails it becomes FAILED with an explanation
 *
 * **state**
 *   a set of Builds with
 *     a status of RUNNING or SUCCEEDED or FAILED
 *     an optional error String
 */
export default class BuildingConcept {
  private builds = new Map<Build, BuildDoc>();

  /**
   * start ({ command? }): ({ build })
   *
   * **requires** true
   *
   * **effects** creates a new build in RUNNING status
   */
  async start({ command }: { command?: string }): Promise<{ build: Build }> {
    const id = (command ?? freshID()) as Build;
    this.builds.set(id, { _id: id, status: "RUNNING" });
    return { build: id };
  }

  /**
   * complete ({ build }): ({ build }) | ({ error })
   *
   * **requires** `build` is an existing build in RUNNING status
   *
   * **effects** marks the build as SUCCEEDED
   */
  async complete({
    build,
  }: {
    build: Build;
  }): Promise<{ build: Build } | { error: string }> {
    const doc = this.builds.get(build);
    if (!doc) return { error: `Build not found: ${build}` };
    if (doc.status !== "RUNNING") {
      return { error: `Build is not running (${doc.status}): ${build}` };
    }
    doc.status = "SUCCEEDED";
    return { build };
  }

  /**
   * fail ({ build, error }): ({ build }) | ({ error })
   *
   * **requires** `build` is an existing build in RUNNING status
   *
   * **effects** marks the build as FAILED with an explanation
   */
  async fail({
    build,
    error,
  }: {
    build: Build;
    error: string;
  }): Promise<{ build: Build } | { error: string }> {
    const doc = this.builds.get(build);
    if (!doc) return { error: `Build not found: ${build}` };
    if (doc.status !== "RUNNING") {
      return { error: `Build is not running (${doc.status}): ${build}` };
    }
    doc.status = "FAILED";
    doc.error = error;
    return { build };
  }

  /**
   * _get ({ build }): ({ status, error? })
   *
   * **requires** `build` is an existing build
   *
   * **effects** returns the build's status and optional error
   */
  async _get({
    build,
  }: {
    build: Build;
  }): Promise<{ status: string; error?: string }[]> {
    const doc = this.builds.get(build);
    if (!doc) return [];
    return [{ status: doc.status, error: doc.error }];
  }
}
