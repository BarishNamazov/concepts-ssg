import { describe, expect, test } from "bun:test";
import { Logging, SyncConcept } from "../mod.ts";
import {
  ButtonConcept,
  CounterConcept,
  ListConcept,
  NotificationConcept,
  RecorderConcept,
} from "./mocks.ts";
import { makeSyncs } from "./syncs.ts";

/** Build a fresh, instrumented set of concepts wired to the test syncs. */
function setup() {
  const Sync = new SyncConcept();
  Sync.logging = Logging.OFF;
  const { Button, Counter, Notification, List, Recorder } = Sync.instrument({
    Button: new ButtonConcept(),
    Counter: new CounterConcept(),
    Notification: new NotificationConcept(),
    List: new ListConcept(),
    Recorder: new RecorderConcept(),
  });
  Sync.register(makeSyncs(Button, Counter, Notification, List, Recorder));
  return { Button, Counter, Notification, List, Recorder };
}

describe("engine: basic synchronizations", () => {
  test("button click increments counter once", async () => {
    const { Button, Counter } = setup();
    await Button.clicked({ kind: "inc" });
    expect(Counter.count).toBe(1);
  });

  test("notify when count reaches 3", async () => {
    const { Button, Notification } = setup();
    await Button.clicked({ kind: "inc" });
    await Button.clicked({ kind: "inc" });
    await Button.clicked({ kind: "inc" });
    expect(Notification.messages).toEqual(["reached 3"]);
  });

  test("fanout over list via query", async () => {
    const { Button, List, Recorder } = setup();
    List.add({ value: 1 });
    List.add({ value: 2 });
    List.add({ value: 3 });
    await Button.clicked({ kind: "fanout" });
    expect(Recorder.order.length).toBe(3);
  });

  test("fanout over list via async query", async () => {
    const { Button, List, Recorder } = setup();
    List.add({ value: 1 });
    List.add({ value: 2 });
    List.add({ value: 3 });
    await Button.clicked({ kind: "fanout-async" });
    expect(Recorder.order.length).toBe(3);
  });

  test("prevent double fire by synced marks across when actions", async () => {
    const { Recorder } = setup();
    await Recorder.record({ tag: "x" });
    // ChainRecordA appends ":a", PreventDoubleFire then appends ":done".
    expect(Recorder.order.join(",")).toBe("x,x:a,x:done");
  });
});
