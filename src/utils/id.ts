import type { ID } from "@utils/types.ts";

/** Create a fresh UUID v7 identity. Uses Bun's built-in crypto. */
export function freshID(): ID {
  return Bun.randomUUIDv7() as ID;
}
