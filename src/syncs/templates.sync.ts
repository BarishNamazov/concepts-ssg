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

  /**
   * After the build completes, regenerate every entry that uses collection
   * loops.  Layouting owns loop detection and rendering; the sync only
   * fetches the data and passes it in as typed sequences.
   */
  const FinalizeTriggersIndexRegen: Sync = ({
    build,
    entry,
    collName,
    sortBy,
    itemEntry,
    itemMeta,
    rawItems,
    items,
    fields,
    html,
    layoutName,
    vars,
  }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Building.complete, { build }, { build }],
    ),
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
        return {
          ...frame,
          [layoutName]: String(fieldsObj.layout ?? "default"),
        };
      });

      frames = await frames.query(
        Layouting._getSequenceRequests,
        { layoutName, content: html },
        { collection: collName, sortBy },
      );
      frames = frames.filter(
        (f) =>
          typeof f[collName] === "string" && (f[collName] as string) !== "",
      );
      if (frames.length === 0) return frames;

      frames = await frames.query(
        Collecting._getEntries,
        { collection: collName },
        { entry: itemEntry, metadata: itemMeta },
      );

      frames = frames.collectAs([itemEntry, itemMeta], rawItems);

      return frames.map((frame) => {
        const raw = (frame[rawItems] as Record<string, unknown>[]) ?? [];
        const collectionName = (frame[collName] as string) ?? "";

        const sequences: Record<
          string,
          Array<{ entry: string; fields: Record<string, string> }>
        > = {};

        const rows: Array<{ entry: string; fields: Record<string, string> }> =
          [];
        for (const item of raw) {
          const entryId = (item as Record<string, unknown>)[
            itemEntry.description ?? ""
          ] as string | undefined;
          const meta = (item as Record<string, unknown>)[
            itemMeta.description ?? ""
          ] as Record<string, string> | undefined;
          if (entryId !== undefined && meta !== undefined) {
            rows.push({ entry: entryId, fields: meta });
          }
        }
        sequences[collectionName] = rows;

        const fieldsObj =
          ((frame as Record<symbol, unknown>)[fields] as
            | Record<string, string | number | boolean>
            | undefined) ?? {};
        const bodyHtml =
          ((frame as Record<symbol, unknown>)[html] as string | undefined) ??
          "";
        const resolvedLayout = String(fieldsObj.layout ?? "default");

        const variables: Record<string, string | Record<string, string>[]> = {};
        for (const [key, value] of Object.entries(fieldsObj)) {
          variables[key] = String(value);
        }
        variables.content = bodyHtml;

        return {
          ...frame,
          [layoutName]: resolvedLayout,
          [vars]: variables,
          [items]: sequences,
        };
      });
    },
    then: actions([
      Layouting.apply,
      { entry, layoutName, variables: vars, sequences: items },
    ]),
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
