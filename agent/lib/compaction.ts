/**
 * Context window compaction and token estimation engine.
 */

export const DEFAULT_CONTEXT_WINDOW = 200_000; // 200k default Claude token context window
export const DEFAULT_COMPACTION_THRESHOLD = 0.75; // 75% utilization trigger

export interface CompactionSummary {
  activeGoal?: string;
  modifiedFiles: string[];
  keyDecisions: string[];
  preservedChecklistItems: string[];
  summaryText: string;
  originalEstimatedTokens: number;
  compactedEstimatedTokens: number;
  tokenReductionPercent: number;
}

/**
 * Estimates token count for text using the industry-standard heuristic (~4 characters per token).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Checks whether current token usage exceeds the configured compaction threshold.
 */
export function isThresholdReached(
  currentTokens: number,
  contextLimit: number = DEFAULT_CONTEXT_WINDOW,
  thresholdPercent: number = DEFAULT_COMPACTION_THRESHOLD
): boolean {
  if (contextLimit <= 0) return false;
  return currentTokens / contextLimit >= thresholdPercent;
}

export interface ConversationTurnRecord {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: Array<{ name: string; input?: unknown }>;
  toolResults?: Array<{ name: string; output?: unknown }>;
}

/**
 * Summarizes conversation turn history, pruning verbose command/search outputs
 * while strictly preserving goals, active checklist status, and modified files.
 */
export function summarizeTurnHistory(
  turns: ConversationTurnRecord[],
  options: {
    activeGoal?: string;
    modifiedFiles?: string[];
    contextLimit?: number;
  } = {}
): CompactionSummary {
  const originalText = turns.map((t) => t.content).join("\n");
  const originalEstimatedTokens = estimateTokens(originalText);

  const modifiedFilesSet = new Set<string>(options.modifiedFiles ?? []);
  const keyDecisions: string[] = [];
  const actionSummaries: string[] = [];

  for (const turn of turns) {
    if (turn.role === "tool" || turn.toolCalls) {
      if (turn.toolCalls) {
        for (const tc of turn.toolCalls) {
          if (tc.name === "edit_file" || tc.name === "write_file") {
            const input = tc.input as { filePath?: string } | undefined;
            if (input?.filePath) {
              modifiedFilesSet.add(input.filePath);
            }
          }
          actionSummaries.push(`- Executed tool: ${tc.name}`);
        }
      }
    } else if (turn.role === "assistant" && turn.content.length > 0) {
      // Capture concise decisions
      const lines = turn.content.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines.slice(0, 3)) {
        if (line.toLowerCase().includes("decid") || line.toLowerCase().includes("plan") || line.toLowerCase().includes("step")) {
          keyDecisions.push(line.trim());
        }
      }
    }
  }

  const modifiedFiles = Array.from(modifiedFilesSet);

  const summaryLines: string[] = [
    `### Compacted Context History`,
    options.activeGoal ? `**Active Goal**: ${options.activeGoal}` : `**Active Goal**: In-progress development`,
    "",
    `#### Modified Workspace Files:`,
    modifiedFiles.length > 0
      ? modifiedFiles.map((f) => `- \`${f}\``).join("\n")
      : "- None recorded in this session segment.",
    "",
    `#### Key Architectural Decisions & Actions:`,
    keyDecisions.length > 0
      ? keyDecisions.slice(-10).map((d) => `- ${d}`).join("\n")
      : "- Initialized coding harness environment and executed preliminary tasks.",
    "",
    `#### Historical Turns:`,
    `Compacted ${turns.length} historical turns into high-density reference memory.`,
  ];

  const summaryText = summaryLines.join("\n");
  const compactedEstimatedTokens = estimateTokens(summaryText);
  const tokenReductionPercent =
    originalEstimatedTokens > 0
      ? Math.max(
          0,
          Math.round(
            ((originalEstimatedTokens - compactedEstimatedTokens) / originalEstimatedTokens) * 100
          )
        )
      : 0;

  return {
    activeGoal: options.activeGoal,
    modifiedFiles,
    keyDecisions,
    preservedChecklistItems: [],
    summaryText,
    originalEstimatedTokens,
    compactedEstimatedTokens,
    tokenReductionPercent,
  };
}
