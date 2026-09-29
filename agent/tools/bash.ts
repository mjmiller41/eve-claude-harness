import { defineTool } from "eve/tools";
import { z } from "zod";
import { defaultShellManager } from "../lib/shell-manager.js";
import { toRelativeWorkspacePath, getWorkspaceRoot } from "../lib/workspace.js";
import { eveApprovalPolicy } from "../lib/permissions.js";

export default defineTool({
  description:
    "Executes a shell command in bash with workspace boundary containment, persistent directory tracking, 30s timeout, and 40KB output capping.",
  inputSchema: z.object({
    command: z.string().describe("The exact shell command line string to execute"),
    cwd: z
      .string()
      .optional()
      .describe("Optional working directory relative to workspace root (defaults to persistent session cwd)"),
    timeoutMs: z
      .number()
      .int()
      .min(1000)
      .max(120000)
      .default(30000)
      .describe("Execution timeout in milliseconds (default: 30000ms)"),
    isBackground: z
      .boolean()
      .default(false)
      .describe("Set to true for long-running servers, watchers, or daemon tasks"),
  }),
  approval: eveApprovalPolicy,
  label: {
    start: ({ command, isBackground }) =>
      `${isBackground ? "Run in background: " : "Run: "}${command}`,
  },
  async execute({ command, cwd, timeoutMs = 30000, isBackground = false }) {
    const root = getWorkspaceRoot();

    if (isBackground) {
      const bgTask = defaultShellManager.startBackgroundTask(command, { cwd });
      return {
        exitCode: 0,
        stdout: `Background task started successfully with Task ID: ${bgTask.taskId} (PID: ${bgTask.pid}).`,
        stderr: "",
        cwd: toRelativeWorkspacePath(bgTask.cwd, root),
        isBackground: true,
        backgroundTaskId: bgTask.taskId,
      };
    }

    const result = await defaultShellManager.executeCommand(command, {
      cwd,
      timeoutMs,
    });

    return {
      exitCode: result.exitCode ?? 0,
      stdout: result.stdout,
      stderr: result.stderr,
      cwd: toRelativeWorkspacePath(result.cwd, root),
      isBackground: false,
      durationMs: result.durationMs,
      timedOut: result.status === "timed_out",
    };
  },
});
