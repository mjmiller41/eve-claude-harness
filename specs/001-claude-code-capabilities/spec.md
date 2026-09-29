# Feature Specification: Claude Code Agent Harness Capabilities

**Feature Branch**: `specs/001-claude-code-capabilities`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Of the features listed in docs/claude-code-features.md, I want to add the ones that do not already exist in this project, or improve existing features. before writing the spec, ask me about whether to add questionable features or not, and when adding new features they must follow the Eve framework guidlines."

## Clarifications

### Session 2026-09-29
- Q: What should be the default execution permission mode when the harness starts? (FR-011) → A: Auto Mode (reads, searches, and routine edits/commands run automatically; destructive actions such as `rm`, `git reset`, or modifying sensitive environment files trigger approval gates).
- Q: What tool permissions and access boundaries should specialized subagents have by default? (FR-017) → A: Option B (Isolated Worktree Only: Any subagent granted file modification or write capabilities must execute within an isolated git worktree rather than the main workspace, preventing staging and branch conflicts).
- Q: Should shell command execution be strictly bounded within the repository workspace root? (FR-006) → A: Option A (Workspace Root Boundary: All shell executions, working directory navigation, and file paths MUST be contained within the project repository root and its subdirectories; attempts to navigate or modify files outside the workspace are blocked).
- Q: What history depth and recovery granularity should be supported for file modification checkpoints? (FR-020) → A: Option A (Per-Turn Checkpointing: Capture file modification snapshots before every modifying turn, retaining full session-level history to enable rewinding the workspace back to any historical turn).
- Q: Under what trigger conditions should automated context window compaction execute? (FR-019) → A: Option A (Threshold & On-Demand Hybrid: Automatically compact when conversation context reaches 75% of model capacity, while allowing developers to trigger compaction on-demand via command or menu).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Autonomous Grounded Code Inspection & Editing Loop (Priority: P1)

A developer directs the agent to inspect repository code, locate specific declarations or usages, read files in bounded token ranges, and make surgical, non-destructive file edits using exact string matching. The agent inspects file contents before editing, applies exact replacements, and verifies changes immediately.

**Why this priority**: Core foundational capability of a coding agent. Without grounded inspection and precise editing, the agent cannot perform reliable software development tasks.

**Independent Test**: Can be fully tested by asking the agent to search for a function across multiple directories, read the implementation with line numbering, and replace an exact block of code. Delivers a verified file edit with diff reporting.

**Acceptance Scenarios**:

1. **Given** a multi-directory codebase, **When** the developer asks to locate a symbol or file pattern, **Then** the agent uses pattern-based search and regex search to return matching file paths and line occurrences.
2. **Given** a target file on disk, **When** the agent prepares to edit code, **Then** it inspects the target file content first, identifies an exact character match, and verifies that the replacement is applied uniquely without corrupting adjacent code.
3. **Given** a new module requirement, **When** the agent creates a file, **Then** the file is created atomically with validation and immediately available for inspection.
4. **Given** a non-text document (such as a Jupyter notebook), **When** the agent needs to view or edit cell code and markdown, **Then** the agent reads and updates specific cells while preserving notebook structure.

---

### User Story 2 - Interactive Steering & Approval Guardrails (Priority: P1)

During multi-step execution, the developer maintains steering control. The agent detects underspecified requirements and presents structured multiple-choice questions with optional custom write-ins. When encountering sensitive or destructive operations, the agent requests explicit human confirmation before proceeding.

**Why this priority**: Essential safety and steering. Prevents uncontrolled destructive changes (file deletions, branch resets) and eliminates hallucinated assumptions when requirements are ambiguous.

**Independent Test**: Can be tested by prompting the agent with an ambiguous architectural choice or asking it to delete a critical configuration; the agent pauses execution, presents a multiple-choice question or confirmation prompt, and acts strictly according to the developer's response.

**Acceptance Scenarios**:

1. **Given** ambiguous user requirements, **When** the agent identifies conflicting design paths, **Then** it pauses execution and presents a structured multiple-choice menu with explicit tradeoffs and a custom write-in option.
2. **Given** Auto Mode execution, **When** the agent attempts a potentially destructive or irreversible operation (e.g. file deletions, git branch resets, modifying sensitive configuration/environment files), **Then** it requests explicit human confirmation, halting execution until approved or rejected.
3. **Given** an ongoing agent task, **When** the developer sends an interruption signal or new steering input mid-turn, **Then** the agent halts pending tool operations and pivots to the updated instructions.

---

### User Story 3 - Shell Execution & Asynchronous Process Management (Priority: P2)

The developer requests the agent to execute build commands, test suites, or linters. The agent executes shell commands with directory persistence, strict timeouts, and output limits. When long-running processes (such as local development servers or watchers) are started, the agent tracks them as background jobs and monitors streaming output without blocking the interactive session.

**Why this priority**: Enables the perception-action-verification cycle (running tests, verifying compilation, starting services) required for full-cycle software development.

**Independent Test**: Can be tested by running a command that executes tests and another command that launches a continuous file watcher; the agent reports test results synchronously, moves the watcher to a background task, and continues accepting prompts.

**Acceptance Scenarios**:

1. **Given** a test or build command, **When** the agent executes it, **Then** command stdout and stderr are captured, execution status is evaluated, and failure outputs are parsed for diagnostic reasoning.
2. **Given** directory navigation commands, **When** working directory changes occur, **Then** subsequent commands retain the modified working directory context strictly bounded within the repository workspace root.
3. **Given** a long-running process (e.g. server or watcher), **When** execution exceeds interactive duration limits, **Then** the process is transitioned to a monitored background task with streaming output and cancellation support.

---

### User Story 4 - Multi-Turn Task Checklist & Observable Progress (Priority: P2)

For complex multi-step tasks, the developer can observe a structured checklist of planned tasks, their statuses (pending, in-progress, completed, skipped), and live progression across turns.

**Why this priority**: Prevents agent drift during long-running tasks, maintains transparency for the developer, and ensures that all sub-tasks are systematically completed.

**Independent Test**: Can be tested by requesting a complex multi-file refactoring task; the agent initializes an observable checklist, completes each task item sequentially, and reports progress at each turn until all items are completed.

**Acceptance Scenarios**:

1. **Given** a multi-step objective, **When** the agent begins execution, **Then** it initializes a structured task checklist with distinct actionable items.
2. **Given** an active checklist, **When** a sub-task is executed and verified, **Then** the checklist item status transitions to completed and the next item begins.
3. **Given** a task that becomes obsolete due to an architectural pivot, **When** the agent bypasses the task, **Then** it marks the item as skipped with an explicit rationale.

---

### User Story 5 - Intelligent Context Compaction & Token Optimization (Priority: P3)

In extended coding sessions with voluminous tool outputs and large file reads, the system automatically prunes stale output logs and compacts conversation history, preserving project memory, active rules, file paths, and current goal criteria.

**Why this priority**: Prevents context window exhaustion, reduces token costs, and keeps response latencies fast during multi-hour development sessions.

**Independent Test**: Can be tested by feeding large volumes of command output through repeated tool cycles; the system triggers context compaction, summarizes earlier conversation turns, and successfully completes the task without losing project constraints.

**Acceptance Scenarios**:

1. **Given** conversation history approaching context window limits, **When** token utilization reaches 75% of model capacity or when explicitly triggered on-demand by the developer, **Then** the system triggers history compaction, summarizing past steps while preserving key decisions, active rules, and current goals.
2. **Given** extensive command outputs in earlier turns, **When** newer actions succeed them, **Then** verbose stdout logs are pruned from immediate attention while retaining outcomes and exit statuses.

---

### User Story 6 - Specialized Subagent Delegation & Peer Advice (Priority: P3)

The primary agent delegates specialized sub-problems (e.g. broad codebase audits, deep documentation lookup, or peer architectural reviews) to dedicated subagents that run in isolated context windows with specialized toolsets and return structured summaries.

**Why this priority**: Prevents the primary context from being cluttered with hundreds of raw search results and enables parallel investigation and second-opinion architectural reviews.

**Independent Test**: Can be tested by prompting the agent to perform an architectural review; the agent delegates codebase exploration to a research subagent and consults an advisor subagent before synthesizing recommendations.

**Acceptance Scenarios**:

1. **Given** a broad investigative or modification query, **When** the primary agent delegates to a specialized subagent, **Then** the subagent executes in an isolated context window with turn caps, and any subagent performing file modifications MUST execute strictly within an isolated git worktree.
2. **Given** completion of a subagent run, **When** the subagent concludes, **Then** it delivers an executive summary and structured findings back to the parent session.
3. **Given** a high-stakes architectural decision, **When** the agent requires validation, **Then** it consults an advisor model to evaluate tradeoffs before committing changes.

---

### User Story 7 - Web Documentation Search & Content Extraction (Priority: P3)

When working with third-party libraries, updated SDKs, or unfamiliar APIs, the agent searches authoritative public web sources and extracts clean, readable markdown content to guide implementation.

**Why this priority**: Eliminates out-of-date hallucinations when working with fast-moving modern libraries and external developer APIs.

**Independent Test**: Can be tested by requesting integration code for a newly released library API; the agent performs a web search, fetches the official documentation page, and applies the verified API pattern.

**Acceptance Scenarios**:

1. **Given** an unknown error code or new library function, **When** the agent initiates a search, **Then** it returns relevant URLs and concise excerpts from authoritative documentation.
2. **Given** a documentation web page, **When** the agent fetches its content, **Then** navigation bars, advertisements, and scripts are stripped, returning clean markdown content to the agent.

---

### Edge Cases

- **File Concurrency & Target Conflicts**: When an exact string pattern occurs multiple times within a file, the editing capability must refuse ambiguous replacement and require bounded line ranges or unique context.
- **Binary & Media Files**: When inspecting non-text assets (images, PDFs), the agent must validate file types and avoid printing raw binary bytes to the conversation context.
- **Process Freezes & Hanging Commands**: When a shell command blocks indefinitely without producing output, execution timeouts must terminate the child process gracefully and report failure.
- **Context Limit Overflow**: When a single tool output exceeds the maximum token window, the output must be automatically truncated with an indication of total size and pagination instructions.
- **Recursive Subagent Spawning**: Subagent delegation must enforce strict depth and turn limits to prevent runaway resource consumption.
- **Workspace Escape Attempts**: When a command or script attempts to change directory (`cd`) outside the repository root or target external system paths, execution MUST be blocked with an informative security violation error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide targeted file reading with line numbering, offset, and limit controls.
- **FR-002**: System MUST provide exact-match file editing that requires target content validation before applying replacements.
- **FR-003**: System MUST provide atomic file creation and overwrite capabilities with directory auto-creation.
- **FR-004**: System MUST support reading and updating Jupyter notebook (`.ipynb`) cell code and markdown.
- **FR-005**: System MUST provide fast codebase search supporting recursive glob matching and regex content searching.
- **FR-006**: System MUST execute shell commands with persistent working directory tracking across commands in a session, while strictly enforcing that all working directories and file operations remain bounded within the repository workspace root.
- **FR-007**: System MUST enforce configurable execution timeouts and output buffer size limits for all shell commands.
- **FR-008**: System MUST automatically detect long-running processes and support moving them to monitored background tasks.
- **FR-009**: System MUST allow developers to list, inspect, send input to, and terminate active background tasks.
- **FR-010**: System MUST provide an interactive clarification tool allowing the agent to present single-select or multi-select menus with write-in options.
- **FR-011**: System MUST enforce Auto Mode as the default execution permission mode, automatically executing reads, searches, and routine edits/commands while intercepting high-risk or destructive actions (such as file deletions, branch resets, and modifications to sensitive configuration/environment files) with explicit human-in-the-loop approval gates.
- **FR-012**: System MUST support mid-turn interruption and steerability, canceling current tool executions upon user input.
- **FR-013**: System MUST provide structured task checklist management (create, get, list, update status).
- **FR-014**: System MUST support structured findings reporting for code audits, including location, severity, category, and remediation details.
- **FR-015**: System MUST support web search over authoritative technical resources with domain filtering.
- **FR-016**: System MUST support fetching web URLs and converting HTML content into clean markdown text for agent consumption.
- **FR-017**: System MUST support delegating tasks to specialized subagents operating in isolated context windows with bounded turn limits, and MUST enforce that any subagent granted write or file modification capabilities operates strictly within an isolated git worktree to prevent workspace conflicts.
- **FR-018**: System MUST support consulting a secondary advisor model for complex architectural decisions.
- **FR-019**: System MUST support dynamic context window monitoring that automatically triggers history compaction when token utilization reaches 75% of model capacity, and MUST support on-demand compaction triggered by developer command, preserving project memory, active rules, and current goals.
- **FR-020**: System MUST capture file modification snapshots before every turn modifying files, retaining full session-level history to enable rewinding the workspace back to any historical turn.
- **FR-021**: System MUST support scoped instruction rules that conditionally activate based on touched file path patterns.
- **FR-022**: System MUST enforce execution sandboxing boundaries for untrusted commands and code executions following Eve sandbox conventions.
- **FR-023**: System MUST route all model interactions through the Vercel AI Gateway using Anthropic model endpoints.
- **FR-024**: System MUST adhere strictly to Eve agent framework directory patterns (`agent/tools/`, `agent/skills/`, `agent/channels/`, `agent/subagents/`, `agent/sandbox/`, `agent/instructions/`).

### Key Entities

- **Coding Task**: Represents an overarching user-requested development goal, comprising a sequence of planned actions, tool calls, and verifications.
- **Checklist Item**: An atomic, observable step within a coding task, having an identifier, description, status (pending, in_progress, completed, skipped), and outcome summary.
- **Code Finding**: A structured code review or audit finding containing file location, line range, severity level (critical, high, medium, low, info), category, description, and remediation advice.
- **Execution Session**: The persistent conversation context holding session state, message history, active background tasks, checkpoints, and steering state.
- **Subagent Delegation**: An isolated worker execution instance with a designated system prompt, restricted tool subset, parent session link, and bounded turn lifecycle.
- **File Checkpoint**: A point-in-time snapshot of modified files captured before each modifying turn, indexed by turn number to enable multi-step session rewinds.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of file editing operations require exact-match target verification before changes are applied, eliminating hallucinated line drift and accidental text overwrites.
- **SC-002**: Developer can interrupt any running tool call or long-running command within 1 second of sending an interruption signal.
- **SC-003**: The agent accurately reports the pass/fail exit code and diagnostic stderr of 100% of executed test and build commands.
- **SC-004**: Multi-step coding tasks spanning 5 or more distinct sub-tasks maintain an observable checklist with 100% status tracking accuracy across turns.
- **SC-005**: Context compaction reduces conversation history token consumption by at least 40% when history crosses 75% of context window limits, without losing active project rules or task goals.
- **SC-006**: Subagent delegations complete in isolated contexts and return synthesized deliverables without leaking raw intermediate tool transcripts into the parent session.

## Assumptions

- **Model Layer**: All model routing is handled via the Vercel AI Gateway targeting Anthropic Claude models (Claude Opus, Sonnet, Haiku, Fable) in compliance with Constitution Principle II.
- **Framework Adherence**: All capabilities are authored as native Eve agent components under `agent/` following Eve filesystem conventions in compliance with Constitution Principle I.
- **Interface Scope**: The primary interactive user interface is the Eve terminal CLI/TUI (`eve dev`), with optional HTTP message routes and platform channels. Proprietary Anthropic desktop applications, closed mobile apps, and remote cloud teleportation runners are explicitly out of scope.
- **Sandboxing Implementation**: Execution sandboxing utilizes Eve's native sandbox architecture (`agent/sandbox/` and containerized microVMs) rather than custom host-level Apple Seatbelt or Bubblewrap shell wrappers.
- **Audio & Voice Hardware**: Local microphone audio recording and speech-to-text dictation are omitted from the core harness to avoid native operating system audio dependencies.
- **Enterprise Routing**: Reverse-proxy routing is provided natively by the Vercel AI Gateway; standalone custom gateway proxy daemons are omitted.
