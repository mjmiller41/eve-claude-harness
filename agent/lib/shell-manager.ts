import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { BackgroundTask, ShellExecutionRecord } from "./types.js";
import { getWorkspaceRoot, assertWithinWorkspace } from "./workspace.js";

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_OUTPUT_BYTES = 40 * 1024; // 40KB

interface ActiveBackgroundProcess {
  task: BackgroundTask;
  child: ChildProcess;
  logStream?: fs.WriteStream;
}

export class ShellManager {
  private currentWorkingDir: string;
  private backgroundTasks: Map<string, ActiveBackgroundProcess> = new Map();

  constructor(initialCwd?: string) {
    this.currentWorkingDir = initialCwd ? getWorkspaceRoot(initialCwd) : getWorkspaceRoot();
  }

  public getCurrentWorkingDir(): string {
    return this.currentWorkingDir;
  }

  public setCurrentWorkingDir(newCwd: string, workspaceRoot?: string): void {
    const root = getWorkspaceRoot(workspaceRoot);
    const resolved = assertWithinWorkspace(newCwd, root);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Directory does not exist: ${newCwd}`);
    }
    this.currentWorkingDir = resolved;
  }

  /**
   * Executes a shell command synchronously with a 30s timeout and 40KB output cap.
   */
  public async executeCommand(
    command: string,
    options: {
      cwd?: string;
      timeoutMs?: number;
      workspaceRoot?: string;
    } = {}
  ): Promise<ShellExecutionRecord> {
    const root = getWorkspaceRoot(options.workspaceRoot);
    const execCwd = options.cwd
      ? assertWithinWorkspace(options.cwd, root)
      : this.currentWorkingDir;

    // Check workspace containment for execution directory
    assertWithinWorkspace(execCwd, root);

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const commandId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    return new Promise<ShellExecutionRecord>((resolve) => {
      let stdoutBuffer = "";
      let stderrBuffer = "";
      let stdoutTruncated = false;
      let stderrTruncated = false;
      let timedOut = false;
      let settled = false;

      // Spawn shell process with process group isolation
      const child = spawn("bash", ["-c", command], {
        cwd: execCwd,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        if (child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
        }
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        if (stdoutTruncated) return;
        const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(stdoutBuffer, "utf8");
        if (chunk.length > remaining) {
          stdoutBuffer += chunk.subarray(0, remaining).toString("utf8");
          stdoutBuffer += "\n[Output truncated: 40KB limit reached]";
          stdoutTruncated = true;
        } else {
          stdoutBuffer += chunk.toString("utf8");
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        if (stderrTruncated) return;
        const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(stderrBuffer, "utf8");
        if (chunk.length > remaining) {
          stderrBuffer += chunk.subarray(0, remaining).toString("utf8");
          stderrBuffer += "\n[Output truncated: 40KB limit reached]";
          stderrTruncated = true;
        } else {
          stderrBuffer += chunk.toString("utf8");
        }
      });

      const finish = (code: number | null, signal: NodeJS.Signals | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const durationMs = Date.now() - startTime;
        const completedAt = new Date().toISOString();

        // Special handling for cd commands to update persistent cwd
        const cdMatch = command.match(/^\s*cd\s+([^&;\n]+)/);
        if (cdMatch && (code === 0 || code === null)) {
          try {
            const rawTarget = cdMatch[1].trim();
            const resolvedTarget = path.resolve(execCwd, rawTarget);
            if (assertWithinWorkspace(resolvedTarget, root) && fs.existsSync(resolvedTarget)) {
              this.currentWorkingDir = resolvedTarget;
            }
          } catch {
            // If target directory is outside workspace or invalid, keep current working directory
          }
        }

        let status: ShellExecutionRecord["status"] = "completed";
        if (timedOut) {
          status = "timed_out";
        } else if (code !== 0 && code !== null) {
          status = "failed";
        }

        resolve({
          commandId,
          command,
          cwd: execCwd,
          startedAt,
          completedAt,
          durationMs,
          exitCode: code ?? (signal ? -1 : 0),
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          isBackground: false,
          status,
        });
      };

      child.on("error", (err) => {
        stderrBuffer += `\nProcess error: ${err.message}`;
        finish(1, null);
      });

      child.on("close", (code, signal) => {
        finish(code, signal);
      });
    });
  }

  /**
   * Spawns a background process and tracks its lifecycle and output logs.
   */
  public startBackgroundTask(
    command: string,
    options: { cwd?: string; workspaceRoot?: string } = {}
  ): BackgroundTask {
    const root = getWorkspaceRoot(options.workspaceRoot);
    const execCwd = options.cwd
      ? assertWithinWorkspace(options.cwd, root)
      : this.currentWorkingDir;

    assertWithinWorkspace(execCwd, root);

    const taskId = `task_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const logDir = path.resolve(root, ".eve/logs");
    fs.mkdirSync(logDir, { recursive: true });
    const logFilePath = path.join(logDir, `${taskId}.log`);

    const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

    const child = spawn("bash", ["-c", command], {
      cwd: execCwd,
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (!child.pid) {
      throw new Error(`Failed to spawn background task: ${command}`);
    }

    const task: BackgroundTask = {
      taskId,
      pid: child.pid,
      command,
      cwd: execCwd,
      startedAt: new Date().toISOString(),
      status: "running",
      logFilePath,
    };

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    const bgEntry: ActiveBackgroundProcess = {
      task,
      child,
      logStream,
    };

    child.on("close", (code) => {
      task.status = code === 0 ? "stopped" : "failed";
      logStream.end();
    });

    child.on("error", () => {
      task.status = "failed";
      logStream.end();
    });

    this.backgroundTasks.set(taskId, bgEntry);
    return task;
  }

  /**
   * Lists all registered background tasks and checks their current liveness.
   */
  public listBackgroundTasks(): BackgroundTask[] {
    for (const [_, entry] of this.backgroundTasks) {
      if (entry.task.status === "running") {
        try {
          // Sending signal 0 tests whether process exists
          process.kill(entry.task.pid, 0);
        } catch {
          entry.task.status = "stopped";
        }
      }
    }
    return Array.from(this.backgroundTasks.values()).map((e) => ({ ...e.task }));
  }

  /**
   * Retrieves a single background task by its ID.
   */
  public getBackgroundTask(taskId: string): BackgroundTask | undefined {
    const entry = this.backgroundTasks.get(taskId);
    if (!entry) return undefined;
    if (entry.task.status === "running") {
      try {
        process.kill(entry.task.pid, 0);
      } catch {
        entry.task.status = "stopped";
      }
    }
    return { ...entry.task };
  }

  /**
   * Reads log output from a background task.
   */
  public getBackgroundTaskLogs(taskId: string, maxBytes: number = MAX_OUTPUT_BYTES): string {
    const entry = this.backgroundTasks.get(taskId);
    if (!entry || !fs.existsSync(entry.task.logFilePath)) {
      return "";
    }

    const stats = fs.statSync(entry.task.logFilePath);
    const start = Math.max(0, stats.size - maxBytes);
    const buffer = Buffer.alloc(Math.min(stats.size, maxBytes));

    const fd = fs.openSync(entry.task.logFilePath, "r");
    fs.readSync(fd, buffer, 0, buffer.length, start);
    fs.closeSync(fd);

    let content = buffer.toString("utf8");
    if (stats.size > maxBytes) {
      content = `[Output truncated: showing last ${Math.round(maxBytes / 1024)}KB]\n` + content;
    }
    return content;
  }

  /**
   * Sends text input to a running background task's stdin.
   */
  public sendInputToBackgroundTask(taskId: string, input: string): boolean {
    const entry = this.backgroundTasks.get(taskId);
    if (!entry || entry.task.status !== "running" || !entry.child.stdin) {
      return false;
    }
    entry.child.stdin.write(input.endsWith("\n") ? input : `${input}\n`);
    return true;
  }

  /**
   * Terminates a running background task.
   */
  public killBackgroundTask(taskId: string, signal: NodeJS.Signals = "SIGTERM"): boolean {
    const entry = this.backgroundTasks.get(taskId);
    if (!entry || entry.task.status !== "running") {
      return false;
    }

    try {
      if (entry.child.pid) {
        try {
          process.kill(-entry.child.pid, signal);
        } catch {
          process.kill(entry.child.pid, signal);
        }
      }
      entry.task.status = "stopped";
      return true;
    } catch {
      return false;
    }
  }
}

// Global default shell manager instance
export const defaultShellManager = new ShellManager();
