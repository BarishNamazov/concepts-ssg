import { beforeEach, describe, expect, test } from "bun:test";
import BuildingConcept from "./BuildingConcept.ts";

let Building: BuildingConcept;

beforeEach(() => {
  Building = new BuildingConcept();
});

describe("Building", () => {
  test("start creates a build in RUNNING status", async () => {
    const { build } = await Building.start();
    expect(typeof build).toBe("string");
    const [doc] = await Building._get({ build });
    expect(doc.status).toBe("RUNNING");
  });

  test("start allocates concept-owned ids", async () => {
    const { build } = await Building.start();
    expect(typeof build).toBe("string");
    expect(build as string).not.toBe("cmd-123");
  });

  test("start generates unique ids", async () => {
    const b1 = await Building.start();
    const b2 = await Building.start();
    expect(b1.build).not.toBe(b2.build);
  });

  test("complete transitions RUNNING to SUCCEEDED", async () => {
    const { build } = await Building.start();
    await Building.complete({ build });
    const [doc] = await Building._get({ build });
    expect(doc.status).toBe("SUCCEEDED");
  });

  test("complete returns error for nonexistent build", async () => {
    const result = await Building.complete({ build: "nope" as never });
    expect("error" in result).toBe(true);
  });

  test("complete returns error when not RUNNING", async () => {
    const { build } = await Building.start();
    await Building.complete({ build });
    const result = await Building.complete({ build });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("not running");
    }
  });

  test("fail transitions RUNNING to FAILED", async () => {
    const { build } = await Building.start();
    await Building.fail({ build, error: "something broke" });
    const [doc] = await Building._get({ build });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toBe("something broke");
  });

  test("fail returns error for nonexistent build", async () => {
    const result = await Building.fail({
      build: "nope" as never,
      error: "x",
    });
    expect("error" in result).toBe(true);
  });

  test("fail returns error when not RUNNING", async () => {
    const { build } = await Building.start();
    await Building.complete({ build });
    const result = await Building.fail({ build, error: "late" });
    expect("error" in result).toBe(true);
  });

  test("cannot complete a FAILED build", async () => {
    const { build } = await Building.start();
    await Building.fail({ build, error: "bad" });
    const result = await Building.complete({ build });
    expect("error" in result).toBe(true);
  });

  test("_get returns empty for unknown build", async () => {
    const docs = await Building._get({ build: "nope" as never });
    expect(docs).toHaveLength(0);
  });

  test("principle: start, succeed, verify final state", async () => {
    const { build } = await Building.start();

    // Initially RUNNING
    let [doc] = await Building._get({ build });
    expect(doc.status).toBe("RUNNING");

    // Complete
    await Building.complete({ build });
    [doc] = await Building._get({ build });
    expect(doc.status).toBe("SUCCEEDED");

    // Idempotent query
    const again = await Building._get({ build });
    expect(again[0].status).toBe("SUCCEEDED");
  });

  test("principle: start, fail, verify error preserved", async () => {
    const { build } = await Building.start();

    await Building.fail({ build, error: "scan dir not found" });

    const [doc] = await Building._get({ build });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toBe("scan dir not found");

    // Attempted complete after fail is rejected
    const completeResult = await Building.complete({ build });
    expect("error" in completeResult).toBe(true);
  });
});
