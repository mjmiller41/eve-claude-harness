/**
 * Core domain types and interfaces for the Eve Claude Coding Agent Harness.
 */

export type PermissionMode = "auto" | "accept_edits" | "manual";

export interface ExecutionSession {
  sessionId: string;
  permissionMode: PermissionMode;
  workspaceRoot: string;
  currentWorkingDir: string;
  activeTurn: number;
  tokenMetrics: {
    promptTokens: number;
    completionTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalTokens: number;
  };
  compactionThreshold: number;
  lastCompactedTurn?: number;
  activeGoal?: string;
}

export interface PermissionApprovalRequest {
  requestId: string;
  toolName: string;
  operationType: "destructive_command" | "file_deletion" | "sensitive_file" | "git_mutation";
  description: string;
  commandOrPath: string;
  proposedAction: Record<string, unknown>;
  timestamp: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  order: number;
  title: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  skipReason?: string;
  outcomeSummary?: string;
}

export interface CodingTask {
  id: string;
  sessionId: string;
  goal: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  items: ChecklistItem[];
}

export interface FileSnapshot {
  filePath: string;
  contentBefore: string;
  checksum: string;
}

export interface FileCheckpoint {
  turnNumber: number;
  timestamp: string;
  description: string;
  modifiedFiles: FileSnapshot[];
}

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingCategory = "security" | "bug" | "performance" | "style" | "architecture";

export interface CodeFinding {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  failureScenario?: string;
  suggestedFix?: string;
}

export interface SubagentDelegation {
  delegationId: string;
  subagentName: string;
  parentSessionId: string;
  childAgentId: string;
  taskDescription: string;
  turnCap: number;
  requiresWrite: boolean;
  worktreePath?: string;
  worktreeBranch?: string;
  status: "starting" | "running" | "completed" | "failed" | "cancelled";
  resultSummary?: string;
  findings?: CodeFinding[];
}

export interface ShellExecutionRecord {
  commandId: string;
  command: string;
  cwd: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  exitCode?: number;
  stdout: string;
  stderr: string;
  isBackground: boolean;
  backgroundTaskId?: string;
  status: "running" | "completed" | "failed" | "timed_out" | "cancelled";
}

export interface BackgroundTask {
  taskId: string;
  pid: number;
  command: string;
  cwd: string;
  startedAt: string;
  status: "running" | "stopped" | "failed";
  logFilePath: string;
}

export interface NotebookCell {
  cell_type: "code" | "markdown" | "raw";
  source: string | string[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
}

export interface JupyterNotebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

export interface ScopedRule {
  id: string;
  filePath: string;
  description?: string;
  paths: string[];
  content: string;
}

export interface ScopedRuleMatchResult {
  matchedRules: ScopedRule[];
  touchedFiles: string[];
  formattedInstructions: string;
}

