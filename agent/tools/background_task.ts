import { defineTool } from "eve/tools";
import { z } from "zod";
import { defaultShellManager } from "../lib/shell-manager.js";

export default defineTool({
  description:
    "Monitors and manages long-running background processes (list, status/logs, send input, kill).",
  inputSchema: z.object({
    action: z
      .enum(["list", "status", "kill", "send_input"])
      .describe("Action to perform on background tasks"),
    taskId: z
      .string()
      .optional()
      .describe("Target background task ID (required for status, kill, and send_input)"),
    input: z
      .string()
      .optional()
      .describe("Input string to send to the process's standard input (required for send_input)"),
  }),
  label: {
    start: ({ action, taskId }) =>
      `${action} background task${taskId ? ` ${taskId}` : ""}`,
  },
  async execute({ action, taskId, input }) {
    if (action === "list") {
      const tasks = defaultShellManager.listBackgroundTasks();
      return {
        action: "list",
        taskCount: tasks.length,
        tasks,
      };
    }

    if (!taskId) {
      throw new Error(`taskId is required for action "${action}".`);
    }

    const task = defaultShellManager.getBackgroundTask(taskId);
    if (!task) {
      throw new Error(`Background task "${taskId}" not found.`);
    }

    if (action === "status") {
      const logs = defaultShellManager.getBackgroundTaskLogs(taskId);
      return {
        action: "status",
        task,
        logs,
      };
    }

    if (action === "send_input") {
      if (input === undefined) {
        throw new Error("input is required for action 'send_input'.");
      }
      const sent = defaultShellManager.sendInputToBackgroundTask(taskId, input);
      return {
        action: "send_input",
        taskId,
        success: sent,
        message: sent
          ? `Input sent to background task "${taskId}".`
          : `Failed to send input: task "${taskId}" is not running or has no writable stdin.`,
      };
    }

    if (action === "kill") {
      const killed = defaultShellManager.killBackgroundTask(taskId);
      return {
        action: "kill",
        taskId,
        success: killed,
        message: killed
          ? `Background task "${taskId}" stopped successfully.`
          : `Failed to terminate task "${taskId}" (may already be stopped).`,
      };
    }

    throw new Error(`Unsupported action: ${action}`);
  },
});
