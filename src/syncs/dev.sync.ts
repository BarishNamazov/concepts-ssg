/**
 * Dev-mode sync — when any file is written to output, reload browsers.
 * The watching → rebuild loop is handled imperatively in main.ts's --dev mode
 * since it involves filesystem polling infrastructure.
 */

import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";

export function createDevSyncs({
  Filing,
  Serving,
}: Pick<AppConcepts, "Filing" | "Serving">) {
  const WriteTriggersReload: Sync = () => ({
    when: actions([Filing.write, {}, {}]),
    then: actions([Serving.reload, {}]),
  });

  return { WriteTriggersReload };
}
