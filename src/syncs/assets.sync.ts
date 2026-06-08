/**
 * Public asset deployment sync — copies files from a public/ directory
 * to the output as opaque bytes, preserving relative paths.
 */

import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";

export function createAssetsSync({ Filing }: Pick<AppConcepts, "Filing">) {
  const PublicScanTriggersCopy: Sync = ({ entry, entries, source }) => ({
    when: actions([Filing.scan, {}, { entries, source }]),
    where: (frames) =>
      frames.flatMap((frame) => {
        if (frame[source] !== "public") return [];
        const entryIds = frame[entries] as string[];
        return entryIds.map((id) => ({ ...frame, [entry]: id }));
      }),
    then: actions([Filing.copy, { entry }]),
  });

  return { PublicScanTriggersCopy };
}
