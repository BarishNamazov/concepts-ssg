/**
 * Static site generator build pipeline syncs.
 *
 * Pipeline:
 *   command "build" → configure + layout-scan + content-scan + finalize + succeed
 *   scan (success) → read → parse → render + route + collect → apply → write
 *   scan (failure) → command fail
 */

import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";

export function createSyncs({
  Building,
  Collecting,
  Commanding,
  Filing,
  Formatting,
  Frontmattering,
  Layouting,
  Routing,
}: AppConcepts) {
  // ── 0. build command → configure + scans + complete ──────────────────

  const BuildCommand: Sync = ({ command, args, source, output, layouts }) => ({
    when: actions([
      Commanding.issue,
      { name: "build", args },
      { command, name: "build" },
    ]),
    where: (frames) =>
      frames.map((frame) => {
        const cmdArgs = frame[args] as Record<string, string>;
        return {
          ...frame,
          [source]: cmdArgs.source,
          [output]: cmdArgs.output,
          [layouts]: cmdArgs.layouts ?? "",
        };
      }),
    then: actions(
      [Building.start, { command }],
      [Filing.clear, {}],
      [Collecting.clear, {}],
      [Frontmattering.clear, {}],
      [Routing.configure, { stripPrefix: source, indexName: "index" }],
      [
        Filing.scan,
        {
          directory: layouts,
          patterns: ["*.html"],
          outputDirectory: output,
          source: "layouts",
          command,
        },
      ],
      [
        Filing.scan,
        {
          directory: source,
          patterns: ["**/*.{md,html,htm}"],
          outputDirectory: output,
          source: "content",
          command,
        },
      ],
      [Building.complete, { build: command }],
      [Commanding.succeed, { command }],
    ),
  });

  // ── 1. scan (success) → read (per discovered entry) ────────────────────

  const ScanTriggersRead: Sync = ({ entry, entries }) => ({
    when: actions([Filing.scan, {}, { entries }]),
    where: (frames) =>
      frames.flatMap((frame) => {
        const entryIds = frame[entries] as string[];
        return entryIds.map((id) => ({ ...frame, [entry]: id }));
      }),
    then: actions([Filing.read, { entry }]),
  });

  // ── 2a. layout read → define layout ───────────────────────────────────

  const LayoutReadTriggersDefine: Sync = ({
    entry,
    content,
    filename,
    src,
  }) => ({
    when: actions([Filing.read, {}, { entry, content }]),
    where: async (frames) => {
      frames = await frames.query(
        Filing._getEntry,
        { entry },
        { path: filename, source: src },
      );
      frames = frames.filter((f) => f[src] === "layouts");
      if (frames.length === 0) return frames;
      return frames.map((frame) => {
        const fp = (frame[filename] as string) ?? "";
        const name = fp.replace(/\.[^.]+$/, "");
        return { ...frame, [filename]: name };
      });
    },
    then: actions([Layouting.define, { name: filename, source: content }]),
  });

  // ── 2b. content read → parse frontmatter ──────────────────────────────

  const ReadTriggersParse: Sync = ({ entry, content, src }) => ({
    when: actions([Filing.read, {}, { entry, content }]),
    where: async (frames) => {
      frames = await frames.query(Filing._getEntry, { entry }, { source: src });
      return frames.filter((f) => f[src] === "content");
    },
    then: actions([Frontmattering.parse, { entry, raw: content }]),
  });

  // ── 3. parse → render + route + collect ───────────────────────────────

  const ParseTriggersRender: Sync = ({ entry, body, filePath, format }) => ({
    when: actions([Frontmattering.parse, {}, { entry }]),
    where: async (frames) => {
      frames = await frames.query(Frontmattering._getBody, { entry }, { body });
      frames = await frames.query(
        Filing._getEntry,
        { entry },
        { path: filePath },
      );
      return frames.map((frame) => {
        const fp = (frame[filePath] as string) ?? "";
        const fmt =
          fp.endsWith(".html") || fp.endsWith(".htm") ? "html" : "markdown";
        return { ...frame, [format]: fmt };
      });
    },
    then: actions([Formatting.render, { entry, source: body, format }]),
  });

  const ParseTriggersRoute: Sync = ({ entry, filePath }) => ({
    when: actions([Frontmattering.parse, {}, { entry }]),
    where: async (frames) =>
      await frames.query(Filing._getEntry, { entry }, { path: filePath }),
    then: actions([Routing.derive, { entry, filePath }]),
  });

  const ParseTriggersCollect: Sync = ({ entry, fields, cols }) => ({
    when: actions([Frontmattering.parse, {}, { entry }]),
    where: async (frames) => {
      frames = await frames.query(
        Frontmattering._getAllFields,
        { entry },
        { fields },
      );
      return frames.map((frame) => {
        const fieldsObj =
          (frame[fields] as Record<string, string | number | boolean>) ?? {};
        const meta: Record<string, string> = {};
        for (const [key, value] of Object.entries(fieldsObj)) {
          meta[key] = String(value);
        }
        const rawCol = fieldsObj.collections;
        const collectionNames: string[] = rawCol
          ? String(rawCol)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        return { ...frame, [fields]: meta, [cols]: collectionNames };
      });
    },
    then: actions([
      Collecting.collect,
      { entry, collections: cols, metadata: fields },
    ]),
  });

  const RouteTriggersUpdateIndex: Sync = ({ entry, route, metaPayload }) => ({
    when: actions([Routing.derive, {}, { entry, route }]),
    where: (frames) =>
      frames.map((frame) => {
        const r = (frame[route] as string) ?? "/";
        return { ...frame, [metaPayload]: { route: r } };
      }),
    then: actions([
      Collecting.collect,
      { entry, collections: [] as string[], metadata: metaPayload },
    ]),
  });

  // ── 4. render + route → apply layout (bound on same entry) ────────────

  const RenderAndRouteTriggersApply: Sync = ({
    entry,
    html,
    layoutName,
    fields,
    vars,
  }) => ({
    when: actions(
      [Formatting.render, {}, { entry }],
      [Routing.derive, { entry }, {}],
    ),
    where: async (frames) => {
      frames = await frames.query(Formatting._getHtml, { entry }, { html });
      frames = await frames.query(
        Frontmattering._getAllFields,
        { entry },
        { fields },
      );
      return frames.map((frame) => {
        const fieldsObj =
          (frame[fields] as Record<string, string | number | boolean>) ?? {};
        const htmlStr = (frame[html] as string) ?? "";
        const resolvedLayout = String(fieldsObj.layout ?? "default");
        const variables: Record<string, string> = {};
        for (const [key, value] of Object.entries(fieldsObj)) {
          variables[key] = String(value);
        }
        variables.content = htmlStr;
        return { ...frame, [layoutName]: resolvedLayout, [vars]: variables };
      });
    },
    then: actions([Layouting.apply, { entry, layoutName, variables: vars }]),
  });

  // ── 5. apply → write ──────────────────────────────────────────────────

  const ApplyTriggersWrite: Sync = ({
    entry,
    composed,
    route,
    outputRelativePath,
  }) => ({
    when: actions([Layouting.apply, {}, { entry }]),
    where: async (frames) => {
      frames = await frames.query(
        Layouting._getComposed,
        { entry },
        { composed },
      );
      frames = await frames.query(Routing._getRoute, { entry }, { route });
      return frames.map((frame) => {
        const r = (frame[route] as string) ?? "/";
        const outputPath =
          r === "/" ? "index.html" : `${r.replace(/^\//, "")}/index.html`;
        return { ...frame, [outputRelativePath]: outputPath };
      });
    },
    then: actions(
      [Filing.setContent, { entry, content: composed }],
      [Filing.write, { entry, outputRelativePath }],
    ),
  });

  // ── 6. build complete → regenerate index pages ──────────────────────

  const FinalizeTriggersIndexRegen: Sync = ({
    entry,
    typeVar,
    rawPosts,
    posts,
    html,
    layoutName,
    fields,
    vars,
    collName,
  }) => ({
    when: actions([Building.complete, {}, {}]),
    where: async (frames) => {
      frames = await frames.query(Filing._getAll, {}, { entry });
      frames = await frames.query(
        Frontmattering._getField,
        { entry, field: "type" },
        { value: typeVar },
      );
      frames = frames.filter((f) => (f[typeVar] as string) === "index");
      if (frames.length === 0) return frames;

      frames = await frames.query(Formatting._getHtml, { entry }, { html });
      frames = frames.map((frame) => {
        const bodyHtml = (frame[html] as string) ?? "";
        const match = bodyHtml.match(/\{\{#each\s+(\w+)\}\}/);
        const collectionName = match ? match[1] : "";
        return { ...frame, [collName]: collectionName };
      });
      frames = frames.filter(
        (f) =>
          typeof f[collName] === "string" && (f[collName] as string) !== "",
      );
      if (frames.length === 0) return frames;

      frames = await frames.query(
        Collecting._getEntries,
        { collection: collName },
        { metadata: rawPosts },
      );

      frames = frames.filter((f) => {
        const meta = f[rawPosts] as Record<string, string> | undefined;
        return !meta?.type || meta.type !== "index";
      });

      frames = frames.collectAs([rawPosts], posts);
      frames = frames.map((frame) => {
        const raw = (frame[posts] as Record<string, unknown>[]) ?? [];
        const clean: Record<string, string>[] = [];
        for (const item of raw) {
          const flat = Object.values(item as Record<string, unknown>)[0] as
            | Record<string, string>
            | undefined;
          if (flat !== undefined) {
            clean.push(flat);
          }
        }
        return { ...frame, [posts]: clean };
      });

      frames = await frames.query(
        Frontmattering._getAllFields,
        { entry },
        { fields },
      );
      frames = await frames.query(Formatting._getHtml, { entry }, { html });

      return frames.map((frame) => {
        const fieldsObj =
          (frame[fields] as Record<string, string | number | boolean>) ?? {};
        const collectionName = (frame[collName] as string) ?? "";
        const bodyHtml = (frame[html] as string) ?? "";
        const resolvedLayout = String(fieldsObj.layout ?? "default");
        const siblings = (frame[posts] as Record<string, string>[]) ?? [];

        const variables: Record<string, string | Record<string, string>[]> = {};
        for (const [key, value] of Object.entries(fieldsObj)) {
          variables[key] = String(value);
        }
        variables.content = bodyHtml;
        if (collectionName) {
          variables[collectionName] = siblings;
        }

        return {
          ...frame,
          [layoutName]: resolvedLayout,
          [vars]: variables,
          [collName]: collectionName,
        };
      });
    },
    then: actions([Layouting.apply, { entry, layoutName, variables: vars }]),
  });

  // ── Error syncs (only for actions that carry command from BuildCommand) ─

  const ScanErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions([Filing.scan, { command, source: "content" }, { error }]),
    then: actions([Commanding.fail, { command, error }]),
  });

  return {
    BuildCommand,
    ScanTriggersRead,
    LayoutReadTriggersDefine,
    ReadTriggersParse,
    ParseTriggersRender,
    ParseTriggersRoute,
    ParseTriggersCollect,
    RouteTriggersUpdateIndex,
    RenderAndRouteTriggersApply,
    ApplyTriggersWrite,
    FinalizeTriggersIndexRegen,
    ScanErrorFailsBuild,
  };
}

// Default instance using module-level singletons
import {
  Building,
  Collecting,
  Commanding,
  Filing,
  Formatting,
  Frontmattering,
  Layouting,
  Routing,
} from "@concepts";

const defaultSyncs = createSyncs({
  Building,
  Collecting,
  Commanding,
  Filing,
  Formatting,
  Frontmattering,
  Layouting,
  Routing,
} as AppConcepts);
export default defaultSyncs;
