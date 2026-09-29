# Subagent Interface Contracts: Specialist Delegation

This document specifies the invocation contracts and structured output interfaces for specialized subagents under `agent/subagents/`.

---

## 1. Researcher Subagent (`agent/subagents/researcher/`)

### Purpose
Performs read-only codebase exploration, symbol indexing, dependency research, and technical documentation lookups without polluting the primary agent's conversation history.

### Model Tool Signature
Exposed to the parent agent via Eve's subagent mechanism as `researcher`:

```typescript
interface ResearcherInput {
  message: string; // The specific research question, target files, or search keywords
  agentId?: string; // Re-use an existing parked researcher session
  outputSchema?: object; // Structured schema for the research report
}

interface ResearcherOutput {
  summary: string; // High-level executive synthesis
  relevantFiles: Array<{
    filePath: string;
    lineNumbers?: string;
    relevance: string;
  }>;
  findings: string[]; // Key technical facts or patterns discovered
  recommendedApproach?: string; // Proposed next action for the primary agent
}
```

### Tool Allowlist
- Read-only tools only: `read_file`, `grep`, `glob`, `web_search`, `web_fetch`.
- `write_file`, `edit_file`, and `bash` are omitted or disabled to prevent modifications.

---

## 2. Advisor Subagent (`agent/subagents/advisor/`)

### Purpose
Pairs the primary coding agent with a senior architectural advisor model (`claude-opus-5.5` with high reasoning) to evaluate high-stakes design tradeoffs, database schema changes, or complex debugging dilemmas.

### Model Tool Signature
Exposed to the parent agent as `advisor`:

```typescript
interface AdvisorInput {
  message: string; // Architectural decision context, proposed alternatives, and specific dilemmas
  agentId?: string;
}

interface AdvisorOutput {
  recommendedOption: string; // Recommended choice
  tradeoffAnalysis: Array<{
    option: string;
    pros: string[];
    cons: string[];
    riskLevel: "low" | "medium" | "high";
  }>;
  consensusSummary: string; // Clear decision verdict
  suggestedMitigations: string[]; // Steps to counter identified risks
}
```

---

## 3. Worktree Worker Subagents

### Purpose
Delegates autonomous code-authoring tasks requiring file modifications to child agents running in isolated Git worktrees.

### Invocation Contract
```typescript
interface WorktreeWorkerInput {
  taskDescription: string;
  targetBranchName: string;
  allowedFilesPattern?: string; // Restrict edits to specific glob paths
}

interface WorktreeWorkerOutput {
  status: "success" | "failed";
  worktreeBranch: string;
  commitsCreated: number;
  filesModified: string[];
  diffSummary: string;
  testResults: {
    passed: boolean;
    output: string;
  };
}
```
