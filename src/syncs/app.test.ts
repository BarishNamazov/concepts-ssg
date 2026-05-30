import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { setupApp, type TestApp } from "@utils/app_testing.ts";

let app: TestApp;

beforeEach(async () => {
  if (!app) app = await setupApp();
  await app.reset();
});

afterAll(async () => {
  await app?.stop();
});

describe("auth synchronizations", () => {
  test("register creates a user and a profile", async () => {
    const res = await app.send("/auth/register", {
      username: "alice",
      password: "pw",
      displayName: "Alice",
    });
    expect(res.user).toBeDefined();

    const me = await app.send("/auth/login", {
      username: "alice",
      password: "pw",
    });
    expect(me.session).toBeDefined();
    expect(me.user).toBe(res.user);

    const profile = await app.send("/auth/me", { session: me.session });
    expect(profile.username).toBe("alice");
    expect(profile.profile.displayName).toBe("Alice");
  });

  test("duplicate registration returns an error", async () => {
    await app.send("/auth/register", {
      username: "bob",
      password: "pw",
      displayName: "Bob",
    });
    const dup = await app.send("/auth/register", {
      username: "bob",
      password: "pw2",
      displayName: "Bobby",
    });
    expect(dup.error).toBeDefined();
    expect(dup.user).toBeUndefined();
  });

  test("login with wrong password returns an error", async () => {
    await app.send("/auth/register", {
      username: "carol",
      password: "pw",
      displayName: "Carol",
    });
    const bad = await app.send("/auth/login", {
      username: "carol",
      password: "nope",
    });
    expect(bad.error).toBeDefined();
    expect(bad.session).toBeUndefined();
  });

  test("logout ends the session; me then reports invalid session", async () => {
    await app.send("/auth/register", {
      username: "dave",
      password: "pw",
      displayName: "Dave",
    });
    const { session } = await app.send("/auth/login", {
      username: "dave",
      password: "pw",
    });
    const out = await app.send("/auth/logout", { session });
    expect(out.ok).toBe(true);

    const me = await app.send("/auth/me", { session });
    expect(me.error).toBeDefined();
  });

  test("me with an unknown session returns an error", async () => {
    const me = await app.send("/auth/me", { session: "does-not-exist" });
    expect(me.error).toBeDefined();
  });
});
