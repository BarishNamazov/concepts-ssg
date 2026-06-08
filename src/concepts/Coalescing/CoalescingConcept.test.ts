import { describe, expect, test } from "bun:test";
import type { ID } from "@utils/types.ts";
import CoalescingConcept from "./CoalescingConcept.ts";

describe("Coalescing", () => {
  test("request starts work when context is idle", async () => {
    const Coalescing = new CoalescingConcept();
    const context = "dev-1" as ID;

    const result = await Coalescing.request({ context, kind: "change" });

    expect(result).toEqual({ context, kind: "change", started: true });
    expect(await Coalescing._get({ context })).toEqual([
      { active: true, pending: false, pendingKind: undefined },
    ]);
  });

  test("request queues at most one follow-up when context is active", async () => {
    const Coalescing = new CoalescingConcept();
    const context = "dev-1" as ID;

    await Coalescing.request({ context, kind: "change" });
    const firstQueued = await Coalescing.request({ context, kind: "change" });
    const secondQueued = await Coalescing.request({ context, kind: "change" });

    expect(firstQueued).toEqual({ context, kind: "change", queued: true });
    expect(secondQueued).toEqual({ context, kind: "change", queued: true });
    expect(await Coalescing._get({ context })).toEqual([
      { active: true, pending: true, pendingKind: "change" },
    ]);
  });

  test("finish starts one queued follow-up then returns to idle", async () => {
    const Coalescing = new CoalescingConcept();
    const context = "dev-1" as ID;

    await Coalescing.request({ context, kind: "change" });
    await Coalescing.request({ context, kind: "change" });

    const next = await Coalescing.finish({ context });
    expect(next).toEqual({ context, kind: "change", started: true });
    expect(await Coalescing._get({ context })).toEqual([
      { active: true, pending: false, pendingKind: undefined },
    ]);

    const idle = await Coalescing.finish({ context });
    expect(idle).toEqual({ context, idle: true });
    expect(await Coalescing._get({ context })).toEqual([
      { active: false, pending: false, pendingKind: undefined },
    ]);
  });

  test("finish rejects idle contexts", async () => {
    const Coalescing = new CoalescingConcept();
    const context = "dev-1" as ID;

    const result = await Coalescing.finish({ context });

    expect(result).toEqual({ error: `No active work for context: ${context}` });
  });
});
