import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";
import type { CommandLineRuntimeAdapter } from "../runtime/command_line_runtime_adapter.ts";

export function createRuntimeCliSyncs({
  CommandLine,
  CommandLineRuntime,
}: {
  CommandLine: AppConcepts["CommandLine"];
  CommandLineRuntime: CommandLineRuntimeAdapter;
}) {
  const RuntimeCliReady: Sync = ({ invocation, message }) => ({
    when: actions([CommandLine.ready, {}, { invocation, message }]),
    then: actions([CommandLineRuntime.ready, { invocation, message }]),
  });

  const RuntimeCliNotice: Sync = ({ invocation, message, level }) => ({
    when: actions([CommandLine.notice, {}, { invocation, message, level }]),
    then: actions([CommandLineRuntime.notice, { invocation, message, level }]),
  });

  const RuntimeCliSucceed: Sync = ({ invocation, message }) => ({
    when: actions([CommandLine.succeed, {}, { invocation, message }]),
    then: actions([CommandLineRuntime.succeed, { invocation, message }]),
  });

  const RuntimeCliFail: Sync = ({ invocation, message, usage }) => ({
    when: actions([CommandLine.fail, {}, { invocation, message, usage }]),
    then: actions([CommandLineRuntime.fail, { invocation, message, usage }]),
  });

  return {
    RuntimeCliReady,
    RuntimeCliNotice,
    RuntimeCliSucceed,
    RuntimeCliFail,
  };
}
