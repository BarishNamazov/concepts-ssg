/**
 * Static site generator build pipeline syncs.
 *
 * Pipeline:
 *   command "build" → configure + layout-scan + content-scan + finalize + succeed
 *   scan (success) → read → parse → render + route + collect → apply → write
 *   scan (failure) → command fail
 */

import type { AppConcepts } from "@concepts";
import { createBuildSync } from "./build.sync";
import { createContentSync } from "./content.sync";
import { createDiscoverySync } from "./discovery.sync";
import { createErrorsSync } from "./errors.sync";
import { createPublishingSync } from "./publishing.sync";
import { createTemplatesSync } from "./templates.sync";

export function createSyncs(concepts: AppConcepts) {
  return {
    ...createBuildSync(concepts),
    ...createDiscoverySync(concepts),
    ...createContentSync(concepts),
    ...createTemplatesSync(concepts),
    ...createPublishingSync(concepts),
    ...createErrorsSync(concepts),
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
  Publishing,
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
  Publishing,
  Routing,
} as AppConcepts);
export default defaultSyncs;
