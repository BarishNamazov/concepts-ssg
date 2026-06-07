/**
 * Public asset deployment sync — copies files from a public/ directory
 * to the output as-is, preserving relative paths.  No new concept needed;
 * Filing already handles scan, read, and write.
 */

import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";

export function createAssetsSync({ Filing }: Pick<AppConcepts, "Filing">) {
  const PublicReadTriggersWrite: Sync = ({ entry, src, content }) => ({
    when: actions([Filing.read, {}, { entry, content }]),
    where: async (frames) => {
      frames = await frames.query(Filing._getEntry, { entry }, { source: src });
      return frames.filter((f) => f[src] === "public");
    },
    then: actions([Filing.write, { entry }]),
  });

  return { PublicReadTriggersWrite };
}
