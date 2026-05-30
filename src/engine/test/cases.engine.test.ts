import { describe, expect, test } from "bun:test";
import { actions, type Frames, Logging, SyncConcept, type Vars } from "../mod.ts";
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
  return { Sync, Button, Counter, Notification, List, Recorder };
}

describe("engine: edge cases", () => {
  test("where frames filter prevents extra then actions", async () => {
    const { Button, Notification } = setup();
    await Button.clicked({ kind: "inc" });
    await Button.clicked({ kind: "inc" });
    expect(Notification.messages.length).toBe(0);
    await Button.clicked({ kind: "inc" });
    expect(Notification.messages.length).toBe(1);
  });

  test("multiple flows do not cross-match when clauses", async () => {
    const { Button, Notification } = setup();
    await Button.clicked({ kind: "inc" });
    await Button.clicked({ kind: "inc" });
    await Button.clicked({ kind: "inc" });
    expect(Notification.messages.length).toBe(1);
  });

  test("frames query fanout composes with subsequent where filters", async () => {
    const { Sync, Button, List, Recorder } = setup();
    List.add({ value: 1 });
    List.add({ value: 2 });
    List.add({ value: 3 });

    // Extra sync that only records even values produced by FanoutOverList.
    const OnlyEven = ({ tag, value, evenTag }: Vars) => ({
      when: actions([Recorder.record, { tag }, {}]),
      where: (frames: Frames) =>
        frames
          .filter(($) => String($[tag]).startsWith("v:"))
          .map((frame) => {
            const num = Number(String(frame[tag]).split(":")[1] ?? "NaN");
            return { ...frame, [value]: num } as typeof frame;
          })
          .filter(($) => (Number($[value]) % 2) === 0)
          .map((frame) => ({
            ...frame,
            [evenTag]: `even:${String(frame[value])}`,
          })),
      then: actions([Recorder.record, { tag: evenTag }]),
    });
    Sync.register({ OnlyEven });

    await Button.clicked({ kind: "fanout" });
    expect(Recorder.order.filter((t) => t.startsWith("v:")).length).toBe(3);
    expect(Recorder.order.filter((t) => t.startsWith("even:")).length).toBe(1);
  });
});
