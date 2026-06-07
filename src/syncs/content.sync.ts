/**
 * Content processing syncs.
 *
 * Filing.read (content) → Frontmattering.parse →
 * Formatting.render + Routing.derive + Collecting.collect →
 * Collecting.collect (route index update).
 */

import {
  Collecting as _Collecting,
  Filing as _Filing,
  Formatting as _Formatting,
  Frontmattering as _Frontmattering,
  Routing as _Routing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Collecting: typeof _Collecting;
  Filing: typeof _Filing;
  Formatting: typeof _Formatting;
  Frontmattering: typeof _Frontmattering;
  Routing: typeof _Routing;
};

export function createContentSync({
  Collecting,
  Filing,
  Formatting,
  Frontmattering,
  Routing,
}: C) {
  const ReadTriggersParse: Sync = ({ entry, content, src }) => ({
    when: actions([Filing.read, {}, { entry, content }]),
    where: async (frames) => {
      frames = await frames.query(Filing._getEntry, { entry }, { source: src });
      return frames.filter((f) => f[src] === "content");
    },
    then: actions([Frontmattering.parse, { entry, raw: content }]),
  });

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

  return {
    ReadTriggersParse,
    ParseTriggersRender,
    ParseTriggersRoute,
    ParseTriggersCollect,
    RouteTriggersUpdateIndex,
  };
}

const defaultSyncs = createContentSync({
  Collecting: _Collecting,
  Filing: _Filing,
  Formatting: _Formatting,
  Frontmattering: _Frontmattering,
  Routing: _Routing,
});
export default defaultSyncs;
