import path from "node:path";
import crypto from "node:crypto";
import type { PermissionMode, PermissionApprovalRequest } from "./types.js";

/**
 * List of regex patterns for dangerous or destructive commands that require confirmation.
 */
const DESTRUCTIVE_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f*|-rf|-fr)\b/i, reason: "Recursive force file deletion (rm -rf)" },
  { pattern: /\brm\s+/i, reason: "File deletion (rm)" },
  { pattern: /\brmdir\b/i, reason: "Directory removal (rmdir)" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, reason: "Hard git reset discarding uncommitted changes" },
  { pattern: /\bgit\s+clean\s+(-[a-zA-Z]*f)\b/i, reason: "Forced git clean deleting untracked files" },
  { pattern: /\bgit\s+checkout\s+--\s+\./i, reason: "Discarding local working directory changes" },
  { pattern: /\bgit\s+restore\s+(\.|--staged|\*)/i, reason: "Discarding local working directory or staged changes" },
  { pattern: /\bdrop\s+(database|table|schema)\b/i, reason: "Database dropping command" },
  { pattern: /\btruncate\s+(table)?\b/i, reason: "Database truncation command" },
  { pattern: /\bmkfs\b/i, reason: "Filesystem format command" },
  { pattern: /\bdd\s+if=/i, reason: "Direct block device write command (dd)" },
  { pattern: /\b(shutdown|reboot|init\s+0|halt)\b/i, reason: "System restart or shutdown command" },
];

/**
 * Sensitive filename patterns that should trigger approval before modification or overwrite.
 */
const SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /^\.env($|\..+)/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /credentials\.json$/i,
  /secret/i,
  /service-account.*\.json$/i,
];

/**
 * Checks whether a shell command is destructive.
 */
export function isDestructiveCommand(command: string): { isDestructive: boolean; reason?: string } {
  const trimmed = command.trim();
  for (const { pattern, reason } of DESTRUCTIVE_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { isDestructive: true, reason };
    }
  }
  return { isDestructive: false };
}

/**
 * Checks whether a file path targets sensitive configurations, keys, or credentials.
 */
export function isSensitivePath(filePath: string): boolean {
  const basename = path.basename(filePath);
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}

export interface OperationDescriptor {
  toolName: string;
  command?: string;
  filePath?: string;
  action?: string;
  overwrite?: boolean;
  proposedAction?: Record<string, unknown>;
}

export interface PermissionEvaluationResult {
  requiresApproval: boolean;
  reason?: string;
  request?: PermissionApprovalRequest;
}

/**
 * Evaluates whether an operation requires user approval based on the active permission mode.
 */
export function evaluatePermission(
  mode: PermissionMode,
  op: OperationDescriptor
): PermissionEvaluationResult {
  const { toolName, command, filePath, action, proposedAction = {} } = op;

  // 1. Manual mode: All modifying operations and commands require explicit approval
  if (mode === "manual") {
    const isReadOnly =
      toolName === "read_file" ||
      toolName === "grep" ||
      toolName === "glob" ||
      toolName === "web_search" ||
      toolName === "web_fetch" ||
      (toolName === "task_tracker" && action === "list");

    if (!isReadOnly) {
      const requestId = crypto.randomUUID();
      return {
        requiresApproval: true,
        reason: `Manual approval mode enabled: action ${toolName} requires confirmation.`,
        request: {
          requestId,
          toolName,
          operationType: command ? "destructive_command" : "file_deletion",
          description: `User approval required for ${toolName}`,
          commandOrPath: command ?? filePath ?? toolName,
          proposedAction,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // 2. Sensitive file check (Auto and accept_edits modes)
  if (filePath && isSensitivePath(filePath)) {
    const isModification =
      toolName === "edit_file" ||
      toolName === "write_file" ||
      toolName === "notebook_edit";

    if (isModification) {
      const requestId = crypto.randomUUID();
      return {
        requiresApproval: true,
        reason: `Target file "${filePath}" matches sensitive credential or environment configuration pattern.`,
        request: {
          requestId,
          toolName,
          operationType: "sensitive_file",
          description: `Attempt to modify sensitive file: ${filePath}`,
          commandOrPath: filePath,
          proposedAction,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // 3. Destructive command check
  if (command) {
    const { isDestructive, reason } = isDestructiveCommand(command);
    if (isDestructive) {
      const requestId = crypto.randomUUID();
      return {
        requiresApproval: true,
        reason: `Potentially destructive command detected: ${reason}`,
        request: {
          requestId,
          toolName,
          operationType: "destructive_command",
          description: reason ?? "Destructive command execution",
          commandOrPath: command,
          proposedAction,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // 4. Overwrite check in accept_edits or auto mode
  if (toolName === "write_file" && op.overwrite === true) {
    // Overwriting existing files in manual mode requires approval
    if (mode === "manual") {
      const requestId = crypto.randomUUID();
      return {
        requiresApproval: true,
        reason: `Overwriting existing file "${filePath}" requires confirmation in ${mode} mode.`,
        request: {
          requestId,
          toolName,
          operationType: "file_deletion",
          description: `Overwrite file: ${filePath}`,
          commandOrPath: filePath ?? "unknown",
          proposedAction,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  return { requiresApproval: false };
}
