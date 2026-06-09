import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";

type Build = ID;
type Context = ID;

interface BuildDoc {
  _id: Build;
  config: Record<string, string>;
  context: Context | null;
  kind: string;
  status: "REQUESTED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  error?: string;
}

interface ContextDoc {
  _id: Context;
  config: Record<string, string>;
  activeBuild: Build | null;
  pending: boolean;
  pendingKind?: string;
}

/**
 * Building [Context]
 *
 * **purpose** manage static-site build attempts and serialize rebuild
 *   requests per context
 *
 * **principle** after a build is requested without a context it starts
 *   immediately; after a build is requested with a context, if the context
 *   is idle the build starts immediately and blocks further requests, but if
 *   the context is active the request is coalesced into one pending rebuild;
 *   completing or failing an active build either starts the pending rebuild or
 *   returns the context to idle
 *
 * **state**
 *   a set of Builds with
 *     a config Record<String, String>
 *     an optional context Context
 *     a kind String
 *     a status of REQUESTED or RUNNING or SUCCEEDED or FAILED
 *     an optional error String
 *   a set of Contexts with
 *     a config Record<String, String>
 *     an optional activeBuild Build
 *     a pending Flag
 *     an optional pendingKind String
 */
export default class BuildingConcept {
  private builds = new Map<Build, BuildDoc>();
  private contexts = new Map<Context, ContextDoc>();

  /**
   * request ({ config, kind, context? }):
   *   ({ build, config, kind })
   *   | ({ build, config, kind, context })
   *   | ({ context, queued })
   *
   * **requires** `config` is provided (must contain at least "source" and "output")
   *
   * **effects** creates a REQUESTED build; if a context is given and is active,
   *   records one pending request instead of creating a new build
   */
  async request({
    config,
    kind,
    context,
  }: {
    config: Record<string, string>;
    kind: string;
    context?: Context;
  }): Promise<
    | { build: Build; config: Record<string, string>; kind: string }
    | {
        build: Build;
        config: Record<string, string>;
        kind: string;
        context: Context;
      }
    | { context: Context; queued: true }
  > {
    if (context !== undefined) {
      let ctxDoc = this.contexts.get(context);
      if (ctxDoc !== undefined && ctxDoc.activeBuild !== null) {
        ctxDoc.pending = true;
        ctxDoc.pendingKind = kind;
        if (config !== undefined) ctxDoc.config = config;
        return { context, queued: true };
      }
      if (ctxDoc === undefined) {
        ctxDoc = { _id: context, config, activeBuild: null, pending: false };
      } else {
        ctxDoc.config = config;
      }
      const build = this.createBuild(config, context, kind);
      ctxDoc.activeBuild = build;
      ctxDoc.pending = false;
      delete ctxDoc.pendingKind;
      this.contexts.set(context, ctxDoc);
      return { build, config, kind, context };
    }

    const build = this.createBuild(config, null, kind);
    return { build, config, kind };
  }

  /**
   * start ({ build }): ({ build, config, kind, context? })
   *
   * **requires** `build` exists and is in REQUESTED status
   *
   * **effects** transitions the build to RUNNING
   */
  async start({ build }: { build: Build }): Promise<
    | {
        build: Build;
        config: Record<string, string>;
        kind: string;
        context?: Context;
      }
    | { error: string }
  > {
    const doc = this.builds.get(build);
    if (!doc) return { error: `Build not found: ${build}` };
    if (doc.status !== "REQUESTED") {
      return { error: `Build not requested (${doc.status}): ${build}` };
    }
    doc.status = "RUNNING";
    return {
      build,
      config: doc.config,
      kind: doc.kind,
      context: doc.context ?? undefined,
    };
  }

  /**
   * complete ({ build }): ({ build }) | ({ build, nextBuild, config, kind, context })
   *
   * **requires** `build` exists and is RUNNING
   *
   * **effects** marks the build SUCCEEDED; if the build's context has a pending
   *   request, atomically creates a REQUESTED follow-up build
   */
  async complete({ build }: { build: Build }): Promise<
    | { build: Build }
    | {
        build: Build;
        nextBuild: Build;
        config: Record<string, string>;
        kind: string;
        context: Context;
      }
    | { error: string }
  > {
    const doc = this.builds.get(build);
    if (!doc) return { error: `Build not found: ${build}` };
    if (doc.status !== "RUNNING") {
      return { error: `Build not running (${doc.status}): ${build}` };
    }
    doc.status = "SUCCEEDED";

    if (doc.context !== null) {
      const ctxDoc = this.contexts.get(doc.context);
      if (ctxDoc) {
        if (ctxDoc.pending) {
          const nextKind = ctxDoc.pendingKind ?? "queued";
          ctxDoc.pending = false;
          delete ctxDoc.pendingKind;
          const nextBuild = this.createBuild(
            ctxDoc.config,
            doc.context,
            nextKind,
          );
          ctxDoc.activeBuild = nextBuild;
          return {
            build,
            nextBuild,
            config: ctxDoc.config,
            kind: nextKind,
            context: doc.context,
          };
        }
        ctxDoc.activeBuild = null;
      }
    }

    return { build };
  }

  /**
   * fail ({ build, error }): ({ build, error }) | ({ build, error, nextBuild, config, kind, context })
   *
   * **requires** `build` exists and is RUNNING
   *
   * **effects** marks the build FAILED; if the build's context has a pending
   *   request, atomically creates a REQUESTED follow-up build
   */
  async fail({ build, error }: { build: Build; error: string }): Promise<
    | { build: Build; error: string }
    | {
        build: Build;
        error: string;
        nextBuild: Build;
        config: Record<string, string>;
        kind: string;
        context: Context;
      }
    | { error: string }
  > {
    const doc = this.builds.get(build);
    if (!doc) return { error: `Build not found: ${build}` };
    if (doc.status !== "RUNNING") {
      return { error: `Build not running (${doc.status}): ${build}` };
    }
    doc.status = "FAILED";
    doc.error = error;

    if (doc.context !== null) {
      const ctxDoc = this.contexts.get(doc.context);
      if (ctxDoc) {
        if (ctxDoc.pending) {
          const nextKind = ctxDoc.pendingKind ?? "queued";
          ctxDoc.pending = false;
          delete ctxDoc.pendingKind;
          const nextBuild = this.createBuild(
            ctxDoc.config,
            doc.context,
            nextKind,
          );
          ctxDoc.activeBuild = nextBuild;
          return {
            build,
            error,
            nextBuild,
            config: ctxDoc.config,
            kind: nextKind,
            context: doc.context,
          };
        }
        ctxDoc.activeBuild = null;
      }
    }

    return { build, error };
  }

  /**
   * _getBuild ({ build }): ({ config, context?, kind, status, error? })
   *
   * **requires** `build` exists
   *
   * **effects** returns the build's config, context, kind, status, and optional error
   */
  async _getBuild({ build }: { build: Build }): Promise<
    {
      config: Record<string, string>;
      context: Context | null;
      kind: string;
      status: string;
      error?: string;
    }[]
  > {
    const doc = this.builds.get(build);
    if (!doc) return [];
    return [
      {
        config: doc.config,
        context: doc.context,
        kind: doc.kind,
        status: doc.status,
        error: doc.error,
      },
    ];
  }

  /**
   * _getContext ({ context }): ({ config, activeBuild?, pending, pendingKind? })
   *
   * **requires** true
   *
   * **effects** returns the context's state
   */
  async _getContext({ context }: { context: Context }): Promise<
    {
      config: Record<string, string>;
      activeBuild: Build | null;
      pending: boolean;
      pendingKind?: string;
    }[]
  > {
    const doc = this.contexts.get(context);
    if (!doc) return [];
    return [
      {
        config: doc.config,
        activeBuild: doc.activeBuild,
        pending: doc.pending,
        pendingKind: doc.pendingKind,
      },
    ];
  }

  private createBuild(
    config: Record<string, string>,
    context: Context | null,
    kind: string,
  ): Build {
    const id = freshID();
    this.builds.set(id, {
      _id: id,
      config,
      context,
      kind,
      status: "REQUESTED",
    });
    return id;
  }
}
