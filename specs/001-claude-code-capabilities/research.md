# Technical Research: Claude Code Agent Harness Capabilities

This document records the architectural and technology decisions for implementing the Claude Code capabilities within the Eve agent framework.

---

## 1. Tool Authoring & Eve Framework Integration

### Decision
Implement all coding capabilities as first-class typed Eve tools under `agent/tools/` using `defineTool` from `"eve/tools"` and Zod schemas (`z` from `"zod"`).
- `read_file.ts`: Multi-format file reading with line numbering, offset, and limit pagination.
- `edit_file.ts`: Exact-match string replacement (`old_string` -> `new_string`) with uniqueness validation and read-before-edit integrity.
- `write_file.ts`: Atomic file creation and full overwrite with recursive directory creation.
- `notebook_edit.ts`: Jupyter Notebook cell extraction, inspection, and surgical code/markdown cell editing.
- `grep.ts`: Fast regex code search supporting multiline matches, file glob filters, and ripgrep compatibility.
- `glob.ts`: Fast filesystem pattern search returning relative matching paths.
- `bash.ts`: Native shell execution with persistent working directory tracking, timeout enforcement, output buffer caps, and workspace root containment.
- `background_task.ts`: Subcommand management for background tasks (list, inspect status/logs, send input, kill).
- `ask_question.ts`: Interactive multiple-choice questions with custom write-ins for requirement disambiguation.
- `task_tracker.ts`: Observable checklist management (`TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`).
- `report_findings.ts`: Structured code quality and security findings reporting.
- `web_search.ts` & `web_fetch.ts`: Server-side search and HTML-to-markdown content extraction.
- `rewind.ts`: Multi-step file checkpoint snapshot store and workspace rollback.

### Rationale
- Eve's filesystem-first compilation model automatically compiles each file under `agent/tools/*.ts` into model-accessible tool descriptors without manual registry wiring.
- Typed Zod validation ensures runtime safety and type inference inside tool `execute({ ... }, ctx)`.
- `toModelOutput` enables rich metadata retention for logging and channels while projecting compact summaries to Anthropic models, optimizing prompt cache and context window usage.

### Alternatives Considered
- Direct raw bash scripts or monolithic CLI helper: Rejected because it bypasses Eve's structured tool calling, validation, and serialization.
- External MCP servers for all tools: Rejected because core file and execution operations require in-process performance, direct file handle control, and tightly coupled session state.

---

## 2. Permission Modes & Human-in-the-Loop Approval Gates

### Decision
Implement Auto Mode as the default execution policy using Eve's approval mechanism (`eve/tools/approval`) and custom dynamic approval evaluation in `agent/lib/permissions.ts`.
- Routine actions (file reads, searches, web lookups, and non-destructive edits) run automatically without user friction.
- High-risk operations (file deletions, git resets, modifying sensitive configuration or environment files, commands containing destructive operators like `rm -rf`, `format`, or `drop`) dynamically trigger `ctx.requestApproval` or Eve's `approval: policy(...)`.
- Developers can configure or override modes (`auto`, `accept-edits`, `manual`) via session configuration.

### Rationale
- Pure manual confirmation creates excessive user fatigue on routine 15-step coding tasks.
- Pure automated execution creates critical security and data-loss vulnerabilities.
- Dynamic inspection of tool arguments balances autonomy with fail-safe human steering.

### Alternatives Considered
- Static `always()` approval on all tools: Causes severe interruption fatigue for simple file reads.
- Static `never()` approval: Violates Constitution Principle V and safety guardrails.

---

## 3. Subagent Architecture & Worktree Isolation

### Decision
Implement specialist subagents as declared Eve subagents under `agent/subagents/`:
- `agent/subagents/researcher/`: Specialized read-only codebase explorer and documentation researcher with search/read/web tools.
- `agent/subagents/advisor/`: Specialized senior architectural advisor model pairing (using Opus 5.5 / high reasoning) consulted for critical design tradeoffs.
- For subagents requiring file modification capabilities, enforce git worktree isolation via `agent/lib/worktree.ts`:
  - Worker subagents execute in `.worktrees/<subagent-id>/` branched from the current branch.
  - Automatically copy relevant `.worktreeinclude` configurations.
  - Clean up worktrees upon task completion, returning diffs to the parent agent.

### Rationale
- Eve declared subagents provide isolated context windows and turn caps natively.
- Enforcing git worktrees for modifying subagents completely eliminates concurrent file editing race conditions, workspace dirty state collisions, and git staging conflicts.

### Alternatives Considered
- Shared workspace file writes by parallel subagents: Rejected due to fatal race conditions and git index locking.
- Local OS terminal multiplexer (`tmux`/`iTerm2`) split panes: Explicitly rejected in clarification; does not align with headless/cloud Eve deployments.

---

## 4. Shell Execution Security & Workspace Containment

### Decision
Implement shell command execution in `agent/tools/bash.ts` with strict working directory tracking and boundary enforcement in `agent/lib/shell-manager.ts`:
- Maintain a session-bound current working directory (initialized to `process.cwd()`).
- Path canonicalization (`path.resolve`) on all target paths and `cd` arguments.
- Any command attempting to escape the repository workspace root (`path.relative(repoRoot, targetPath).startsWith('..')`) is rejected immediately with a security violation error before spawning the shell process.
- Execution timeout defaults to 30,000ms with process group termination (`kill(-pid)`) on timeout.
- Output streams are truncated at 40KB with paging indicators to prevent context bloat.

### Rationale
- Prevents rogue or accidental modifications to developer host files (`~/.ssh`, system paths, other repos).
- Protects long-running interactive terminal sessions from hanging indefinitely.

### Alternatives Considered
- Low-level kernel sandboxing (Apple Seatbelt / Linux Bubblewrap): Excluded per user clarification; adds fragile platform-specific C/binary dependencies that break cross-platform Node/Vercel support.

---

## 5. File Checkpointing & Session Rewind

### Decision
Implement `agent/lib/checkpoint-manager.ts` and tool `agent/tools/rewind.ts`:
- Before any tool modifies or overwrites a file (`edit_file`, `write_file`, `notebook_edit`), the manager captures a snapshot of the target file's current disk content into an in-memory/disk store indexed by turn ID and timestamp.
- The `rewind` capability allows reverting all modified files back to the state at turn $N$.
- Retains full session-level history throughout the active conversation.

### Rationale
- Provides instant recovery if an edit breaks tests or introduces unintended changes, eliminating manual git resets.
- Operates in-memory and in `.eve/checkpoints/` without polluting git history with messy temporary commits.

### Alternatives Considered
- Auto-committing git commits on every edit: Pollutes git branch history with dozens of WIP commits.

---

## 6. Context Window Compaction & Token Budgeting

### Decision
Implement context window compaction in `agent/lib/compaction.ts` combining automated threshold triggers and an explicit `/compact` tool:
- Proactively monitor conversation token utilization against the active Anthropic model's context capacity.
- When utilization reaches 75% capacity, or when explicitly requested by the developer, generate a structured, high-density summary:
  - Preserves current task goals, active architectural decisions, modified file paths, and active rules.
  - Prunes verbose historical command outputs and redundant intermediate file reads.
  - Injects dynamic prompt caching boundaries (`__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`) to maximize Anthropic prompt caching hit rates.

### Rationale
- Maximizes token efficiency, keeps agent response latencies under control, and minimizes LLM gateway spend on multi-hour sessions.

### Alternatives Considered
- Reactive compaction only on overflow: Too risky; often causes provider-level context limit errors before compaction can run.
- Truncating message history without summarization: Discards crucial architectural context and leads to hallucinations.
