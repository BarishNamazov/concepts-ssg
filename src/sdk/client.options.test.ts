import { describe, expect, test } from "bun:test";
import { createClient } from "./index.ts";

type TestContract = {
  "/ping": {
    input: { ok: boolean };
    output: { ok: boolean };
  };
};

async function callUrl(
  options: Parameters<typeof createClient<TestContract>>[0],
) {
  let calledUrl = "";
  const fetchImpl = (async (input: Parameters<typeof fetch>[0]) => {
    calledUrl = String(input);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as unknown as typeof fetch;

  const api = createClient<TestContract>({ ...options, fetch: fetchImpl });
  await api["/ping"]({ ok: true });
  return calledUrl;
}

function restoreEnv(previous: string | undefined) {
  if (previous === undefined) delete process.env.REQUESTING_API_BASE_URL;
  else process.env.REQUESTING_API_BASE_URL = previous;
}

describe("createClient options", () => {
  test("uses REQUESTING_API_BASE_URL when baseUrl is omitted", async () => {
    const previous = process.env.REQUESTING_API_BASE_URL;
    try {
      process.env.REQUESTING_API_BASE_URL = "http://configured.test/api/";

      expect(await callUrl({})).toBe("http://configured.test/api/ping");
    } finally {
      restoreEnv(previous);
    }
  });

  test("falls back to same-origin /api when baseUrl and env are omitted", async () => {
    const previous = process.env.REQUESTING_API_BASE_URL;
    try {
      delete process.env.REQUESTING_API_BASE_URL;

      expect(await callUrl({})).toBe("/api/ping");
    } finally {
      restoreEnv(previous);
    }
  });

  test("baseUrl option overrides environment configuration", async () => {
    const previous = process.env.REQUESTING_API_BASE_URL;
    try {
      process.env.REQUESTING_API_BASE_URL = "http://configured.test/api";

      expect(await callUrl({ baseUrl: "http://explicit.test/api/" })).toBe(
        "http://explicit.test/api/ping",
      );
    } finally {
      restoreEnv(previous);
    }
  });
});
