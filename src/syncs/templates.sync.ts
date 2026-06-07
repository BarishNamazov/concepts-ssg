/**
 * Template / layout syncs.
 *
 * Layout read → Layouting.define
 * Formatting.render + Routing.derive → Layouting.apply
 * Building.complete → index page regeneration via Layouting.apply.
 */

import {
  Building as _Building,
  Collecting as _Collecting,
  Filing as _Filing,
  Formatting as _Formatting,
  Frontmattering as _Frontmattering,
  Layouting as _Layouting,
  Routing as _Routing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Building: typeof _Building;
  Collecting: typeof _Collecting;
  Filing: typeof _Filing;
  Formatting: typeof _Formatting;
  Frontmattering: typeof _Frontmattering;
  Layouting: typeof _Layouting;
  Routing: typeof _Routing;
};

export function createTemplatesSync({
  Building,
  Collecting,
  Filing,
  Formatting,
  Frontmattering,
  Layouting,
  Routing,
}: C) {
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

  const FinalizeTriggersIndexRegen: Sync = ({
    entry,
    rawPosts,
    posts,
    html,
    layoutName,
    fields,
    vars,
    collName,
    sortBy,
    layoutSrc,
  }) => ({
    when: actions([Building.complete, {}, {}]),
    where: async (frames) => {
      frames = await frames.query(Filing._getAll, {}, { entry });
      frames = await frames.query(Formatting._getHtml, { entry }, { html });
      frames = await frames.query(
        Frontmattering._getAllFields,
        { entry },
        { fields },
      );
      frames = frames.map((frame) => {
        const fieldsObj =
          (frame[fields] as Record<string, string | number | boolean>) ?? {};
        const layoutForEntry = String(fieldsObj.layout ?? "default");
        return { ...frame, [layoutName]: layoutForEntry };
      });
      frames = await frames.query(
        Layouting._getLayout,
        { name: layoutName },
        { source: layoutSrc },
      );
      frames = frames.map((frame) => {
        const bodyHtml = (frame[html] as string) ?? "";
        const layoutHtml = (frame[layoutSrc] as string) ?? "";
        const searchIn = layoutHtml.includes("{{#each") ? layoutHtml : bodyHtml;
        const match = searchIn.match(/\{\{#each\s+(\w+)(?:\s+sort=(\w+))?\}\}/);
        const collectionName = match ? match[1] : "";
        const sortField = match?.[2] ?? "";
        return { ...frame, [collName]: collectionName, [sortBy]: sortField };
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
        const currentEntry = frame[entry] as string;
        const filtered = currentEntry
          ? clean.filter((c) => c._entry !== currentEntry)
          : clean;
        const sortField = (frame[sortBy] as string) ?? "";
        if (sortField) {
          filtered.sort((a, b) =>
            (b[sortField] ?? "").localeCompare(a[sortField] ?? ""),
          );
        }
        return { ...frame, [posts]: filtered };
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
        const bodyHtml = ((frame[html] as string) ?? "").replace(
          /\{\{#each\s+(\w+)\s+sort=\w+\}\}/g,
          "{{#each $1}}",
        );
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

  return {
    LayoutReadTriggersDefine,
    RenderAndRouteTriggersApply,
    FinalizeTriggersIndexRegen,
  };
}

const defaultSyncs = createTemplatesSync({
  Building: _Building,
  Collecting: _Collecting,
  Filing: _Filing,
  Formatting: _Formatting,
  Frontmattering: _Frontmattering,
  Layouting: _Layouting,
  Routing: _Routing,
});
export default defaultSyncs;
