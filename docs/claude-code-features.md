# Claude Code CLI Agent Harness — Features & Architecture Guide

This document provides a comprehensive overview of the features, capabilities, and architectural components of the **Claude Code CLI Agent Harness**, derived from the official documentation at [code.claude.com/docs](https://code.claude.com/docs/).

---

## 1. Core Agentic Loop & Execution Architecture

Claude Code operates as an **agentic harness** wrapped around Claude foundation models (Claude Sonnet, Opus, Haiku, and Fable). Rather than operating solely as an autocomplete or one-shot conversational bot, it continuously drives an autonomous perception-reasoning-action loop on local or cloud machines.

* **Autonomous Agentic Loop (Context → Action → Verify):**
  When given a prompt, Claude repeatedly gathers project context, plans multi-step interventions, invokes tools (running commands, reading files, searching code), inspects the results, and course-corrects until verification passes or the task is finished.
* **Human-in-the-Loop Steering & Interruption:**
  Users can interrupt the agent at any moment using `Esc` to immediately cancel the running tool call, or type messages and queue steering instructions while tools are executing without restarting the session.
* **Intelligent Context Window Management & Compaction:**
  Monitors token capacity dynamically. Older tool outputs and command logs are automatically pruned or spilled to disk. The `/compact` command (or autonomous auto-compaction) summarizes conversation history while preserving critical rules and file snippets, with thrashing protection against context overflow.
* **Prompt Caching Optimization:**
  Automatically manages Anthropic prompt caching boundaries. Static system prompts, project instructions (`CLAUDE.md`), and tool definitions remain cached across turns, dramatically reducing latency and token costs. Supports explicit caching boundaries (`__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`).
* **Multi-Model Support & Thinking/Effort Control:**
  Easily toggle models (`/model` or `--model`) between Sonnet, Opus, Haiku, and Fable. Adjust extended thinking levels (`/effort` from `low`, `medium`, `high`, `xhigh`, `max`, to `ultracode`). Fast mode (`/fast`) accelerates Opus responses for rapid iteration.
* **Automatic Fallback Model Chains:**
  Configurable fallback chains (`--fallback-model sonnet,haiku`) that automatically reroute requests if a model encounters capacity constraints or rate limits.
* **Server-Side Advisor Tool:**
  Enables pairing the primary coding model with a secondary advisor model (`/advisor`, e.g. Opus or Fable) that Claude consults at strategic decision points during architecture and debugging tasks.
* **Goal-Driven Cross-Turn Autopilot (`/goal`):**
  Allows users to set high-level success conditions (e.g. `/goal "all unit and integration tests pass"`). Claude continues executing tasks across turns until the goal criteria are verified or proven impossible.

---

## 2. Built-in Tooling & OS Capabilities

Claude Code provides an integrated suite of native tools that grant Claude safe, robust operating system access:

* **Targeted File Editing (`Edit`):**
  Executes precise, exact-string replacement (`old_string` → `new_string`) without lossy regex guessing. Enforces read-before-edit integrity and uniqueness checking.
* **File Creation & Overwrite (`Write`):**
  Creates new files or overwrites existing files with atomic validation and permission checks.
* **Multi-Format File Reading (`Read`):**
  Reads source code with line numbering and token-window pagination (`offset` and `limit`). Directly supports:
  * **Images:** Visual inspection of PNGs, JPEGs, and SVGs with automatic resizing/compression.
  * **PDF Documents:** Multi-page parsing in bounded page ranges.
  * **Jupyter Notebooks:** Reading and modifying `.ipynb` cell code, markdown, and outputs (`NotebookEdit`).
* **Codebase Search (`Grep` & `Glob`):**
  * `Grep`: Fast content regex searching powered by ripgrep with multiline, glob, and file-type filtering.
  * `Glob`: Pattern-based file matching with recursive globbing (`**/*`).
  * On POSIX systems, integrates with embedded high-performance utilities (`ugrep`, `bfs`) via the shell.
* **Native Shell Execution (`Bash` & `PowerShell`):**
  * Executes commands with automatic working directory tracking (`cd` changes persist across commands).
  * Enforces execution timeouts and output limits (streaming to disk with automatic truncation previews).
  * Automatically detects long-running commands (dev servers, watchers) and moves them to background tasks.
  * Native PowerShell 7+ support on Windows with execution policy bypass for `.ps1` automation.
* **Background Process & Event Monitoring (`Monitor`):**
  Runs background commands or connects directly to WebSocket endpoints (`ws://` / `wss://`) to stream lines (e.g. tailing logs, watching build outputs, or polling CI status) and inject notices into the conversation in real-time.
* **Web Search & Fetch (`WebSearch` & `WebFetch`):**
  * `WebSearch`: Server-side search over web resources with domain include/exclude filters.
  * `WebFetch`: Fetches web content, converts HTML to Markdown, and extracts relevant information using lightweight helper models while caching results.
* **Interactive Clarification (`AskUserQuestion`):**
  Presents multiple-choice menus with custom write-in options to disambiguate requirements, complete with optional auto-continue timers if the user steps away.
* **Code Review Findings Reporting (`ReportFindings`):**
  Emits structured code quality and security findings (location, severity, category, failure scenarios) for rich terminal or web rendering.
* **Task Checklist Tools (`TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`):**
  Maintains structured, observable task tracking and checklists throughout complex multi-turn workflows.

---

## 3. Multi-Agent Orchestration & Parallelism

Claude Code includes multi-agent primitives to scale beyond single-context limits:

* **Custom Subagents (`Agent` tool & `.claude/agents/`):**
  Spawns specialized worker agents in separate context windows with their own system prompts, restricted toolsets, custom models, and turn limits (`maxTurns`). When finished, subagents return clean executive summaries without polluting the parent conversation's context.
* **Subagent Forking (`/subtask`, `context: fork`):**
  Creates a background subagent that inherits a snapshot of the current conversation history to tackle focused side tasks in parallel.
* **Background Agent Service & Agent View (`claude agents`, `/background`, `/fork`):**
  A persistent daemon/supervisor architecture (`claude daemon`) that manages decoupled background sessions. Users can view all active jobs in an interactive dashboard, inspect live logs (`claude logs`), attach to them (`claude attach`), or respawn them.
* **Agent Teams (`agent-teams`):**
  An advanced architecture where multiple Claude instances collaborate as peers. Includes:
  * A designated **Team Lead** coordinating tasks and synthesizing deliverables.
  * Direct inter-agent communication via `SendMessage`.
  * Shared task boards and self-claiming task assignment.
  * Multi-pane rendering in terminal multiplexers (`tmux` or `iTerm2` split panes).
* **Cross-Session Messaging (`ListAgents`, `SendMessage`):**
  Allows any running Claude Code session to discover (`/list-agents` / `/peers`) and message other local sessions, remote cloud sessions, or teammates on the same machine or network.
* **Dynamic Workflows (`Workflow` tool & `/workflows`):**
  Claude generates JavaScript orchestration scripts that fan out across dozens of background subagents to perform repository audits, migrations, and cross-checked analyses.
* **Git Worktree Isolation (`EnterWorktree`, `ExitWorktree`, `--worktree`):**
  Automatically provisions and switches into clean git worktrees under `.claude/worktrees/`, enabling parallel sessions to edit code independently without branch or staging conflicts. Supports copying untracked/gitignored secrets via `.worktreeinclude`.

---

## 4. Extensibility, Customization & Project Memory

Claude Code adapts to existing repositories through layered configuration and persistent memory:

* **Persistent Project Memory (`CLAUDE.md` & `AGENTS.md`):**
  Markdown files placed at the repository root or in subdirectories containing architecture notes, build instructions, and team rules loaded at the start of every session.
* **Scoped Rules Engine (`.claude/rules/*.md`):**
  Decomposes guidelines into modular files. Rules can use `paths:` YAML frontmatter to load conditionally only when relevant files (e.g. `**/*.test.ts` or `src/api/**/*.ts`) are accessed, minimizing context overhead.
* **Custom Skills (`skills/<name>/SKILL.md`):**
  Modular directories containing instructions, checklists, and scripts invoked via `/name` or triggered dynamically by Claude based on natural language task matching. Supports:
  * Shell command injection via `` !`command` `` blocks.
  * Parameter passing with `$ARGUMENTS`, `$0`, `$1`, etc.
  * Frontmatter controls (`allowed-tools`, `model`, `effort`, `disable-model-invocation`).
* **Custom Commands (`commands/*.md`):**
  Single-file markdown shortcuts that map directly to `/command-name` prompts.
* **Custom Output Styles (`output-styles/*.md`):**
  Tailors Claude's persona, tone, verbosity, and format (e.g. Concise, Explanatory, Learning, Teaching, or custom non-engineering roles).
* **Autonomous Auto Memory (`projects/<project>/memory/MEMORY.md`):**
  Claude automatically records learnings across sessions—such as tricky build commands, recurring bug patterns, and architectural quirks—into an indexed memory directory. Subagents can also maintain isolated memory (`agent-memory/`).
* **Model Context Protocol (MCP) Integration:**
  Connects Claude to external tools, databases, APIs, and cloud services using the open MCP standard.
  * Configured via project `.mcp.json` or user `~/.claude.json`.
  * Features deferred on-demand **Tool Search** to scale to thousands of external tools without exhausting context.
  * Command-line OAuth authentication (`claude mcp login <server>`).
* **Plugins & Marketplace Ecosystem (`claude plugin`):**
  Packages skills, hooks, subagents, MCP servers, and language servers into shareable, version-controlled distributions (`plugin.json`, `marketplace.json`).
* **Code Intelligence & Language Server Protocol (LSP):**
  Connects to language servers (TypeScript, Python, Go, Rust, etc.) via code intelligence plugins to provide real-time symbol definitions, reference lookups, call hierarchies, and post-edit diagnostics.

---

## 5. Event-Driven Lifecycle Hooks & Channels

Hooks provide deterministic guardrails and automated workflows triggered during execution:

* **Comprehensive Lifecycle Events:**
  * **Session level:** `SessionStart`, `SessionEnd`, `Setup`
  * **Turn level:** `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `StopFailure`
  * **Tool level:** `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`
  * **Task & Agent level:** `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `TeammateIdle`
  * **Environment & Workspace:** `CwdChanged`, `DirectoryAdded`, `FileChanged`, `ConfigChange`, `InstructionsLoaded`, `WorktreeCreate`, `WorktreeRemove`
  * **Context & Model:** `PreCompact`, `PostCompact`, `PreModelSwitch`, `PostModelSwitch`
  * **MCP & UI:** `Elicitation`, `ElicitationResult`, `Notification`, `MessageDisplay`
* **Diverse Hook Handlers:**
  Hooks can run shell commands (`command`), make HTTP webhooks (`http`), call MCP tools (`mcp`), execute LLM evaluations (`prompt`), or spawn subagents (`agent`).
* **Deterministic Guardrails & Enforcement:**
  `PreToolUse` hooks can inspect proposed commands or edits via JSON stdin/POST, blocking risky actions (e.g. blocking `rm -rf`, preventing edits to `.env`, or enforcing code formatting with Prettier/ESLint).
* **Push Event Channels:**
  Allows MCP servers to establish long-lived channels that push external events (CI status notifications, incoming chat alerts, webhooks) directly into an active Claude Code session while the user is away.

---

## 6. Safety, Sandboxing & Security Governance

Claude Code implements defense-in-depth safety controls to balance autonomy with security:

* **Dynamic Permission Modes:**
  * **Auto Mode:** An AI-powered background classifier evaluates proposed operations, automatically permitting safe actions while intercepting high-risk steps.
  * **Manual Mode:** Prompts the user for approval on file edits and commands.
  * **Accept Edits Mode:** Automatically approves filesystem modifications while prompting for command executions.
  * **Plan Mode (`/plan`):** Enters read-only mode to research codebases and produce architectural plans before executing changes.
  * **Bypass Permissions Mode (`--dangerously-skip-permissions`):** Skips approval prompts for automated headless tasks.
* **Granular Permission Rules:**
  Declarative rule syntax (`allow`, `deny`, `ask`) supporting tool and path/command pattern matching (e.g. `Bash(npm test *)`, `Read(~/secrets/**)`, `Edit(/src/**)`).
* **Kernel-Enforced OS Sandboxing (`/sandbox`):**
  Provides OS-level filesystem and network isolation for shell commands using Apple Seatbelt on macOS and Bubblewrap (`bwrap`) + `socat` on Linux/WSL2. Enforces network proxy allowlists for external HTTP/WebSocket access.
* **Reversible Edits & File Checkpointing (`/rewind`):**
  Snapshots files before every modification. Users can press `Esc` twice or run `/rewind` to instantly restore files and conversation history to any previous checkpoint.
* **Restricted Mode (`--restricted`):**
  Specialized execution mode for shared evaluation harnesses that completely strips out shell tools, WebFetch, and external directory access.
* **Enterprise Governance & Managed Settings:**
  Supports system-level `managed-settings.json`, centralized server-managed configurations, MCP allowlists/denylists, Zero Data Retention (ZDR) policy compliance, and audit logging via OpenTelemetry (OTel).

---

## 7. Multi-Surface, Cloud & Remote Workflows

Claude Code provides seamless mobility across local, cloud, desktop, and mobile environments:

* **Supported Surfaces:**
  * **Terminal CLI:** Full-featured command-line experience with Vim mode, fullscreen rendering, and status lines.
  * **VS Code / Cursor / JetBrains Extensions:** Integrated diff viewers, @-mentions, plan reviews, and editor selection sharing.
  * **Desktop Application:** Dedicated multi-window GUI with parallel session lanes, visual diff views, and iOS simulator panes.
  * **Web (`claude.ai/code`):** Browser-based execution on Anthropic-hosted or self-hosted cloud runners.
  * **Mobile App (iOS & Android):** Monitor, steer, and receive push notifications for long-running jobs from mobile devices.
* **Remote Control (`/remote-control` or `claude remote-control`):**
  Allows users to drive and monitor a local terminal session running on their development machine from `claude.ai/code` or the Claude mobile app without exposing ports or moving code off-machine.
* **Cloud Teleportation (`claude --teleport`, `claude --cloud`):**
  Start a task locally and send it to cloud compute with `--cloud`, or pull an existing cloud session back to your local terminal with `/teleport`.
* **Self-Hosted Runner Infrastructure (`claude self-hosted-runner`):**
  Enables organizations to host their own compute runners for Claude Code cloud sessions in internal VPCs or Kubernetes clusters.
* **Live Web App & Design Artifacts (`Artifact` tool, `/design`, `/slides`):**
  Publishes session outputs (interactive HTML pages, UI artboards, slide presentations, data visualizations) as private or shareable interactive web artifacts on claude.ai.
* **Browser Automation via Chrome Integration (`/chrome`, `--chrome`):**
  Connects Claude Code to a local Google Chrome instance to navigate web apps, test frontends, inspect DOM/console logs, and fill forms.

---

## 8. Interactive CLI Experience & Ergonomics

The terminal interface includes rich productivity tools designed for daily developer use:

* **Fullscreen Alt-Screen TUI (`/tui fullscreen`):**
  Flicker-free interactive terminal UI with smooth mouse wheel scrolling (`/scroll-speed`) and dialog overlays.
* **Custom Themes & Daltonization (`/theme`):**
  Light, dark, system-adaptive, ANSI terminal palette, and colorblind-accessible (daltonized) themes, with support for custom JSON themes in `~/.claude/themes/`.
* **Custom Status Lines (`/statusline`):**
  Customizable status bar displaying real-time token usage, session costs, active git branches, and model effort.
* **Vim Mode & Custom Keybindings (`/keybindings`):**
  Supports standard Emacs/Readline keybindings, Vim modal editing, and custom shortcut maps in `~/.claude/keybindings.json`.
* **Voice Dictation (`/voice`):**
  Direct voice-to-text prompt dictation with push-to-talk (hold) or toggle (tap) modes.
* **Session Recap & Focus Views (`/recap`, `/focus`):**
  Summarizes what transpired while away, or activates a minimal focus view showing only diffstats and final responses.
* **Diagnostic & Self-Healing Utilities:**
  * `/doctor`: Analyzes system health, stale configs, large `CLAUDE.md` files, and unused skills.
  * `/insights`: Generates visual HTML analytics covering tool usage, session trends, and efficiency.
  * `/heapdump` & `/debug`: Profiles memory and runtime logs.

---

## 9. Enterprise, CI/CD & Headless Automation

Claude Code integrates into production pipelines and enterprise environments:

* **Scriptable Non-Interactive Execution (`claude -p`):**
  Supports Unix pipe workflows (`cat logs.txt | claude -p "find anomalies"`), formatted standard output (`--output-format text|json|stream-json`), structured schemas (`--json-schema`), and turn caps (`--max-turns`).
* **CI/CD Integrations:**
  * **GitHub Actions & GitLab CI/CD:** Triggers automated PR reviews, issue triage, and auto-fixes upon `@claude` mentions or branch updates.
  * **Automated Code Review (`/code-review`, `/ultrareview`):** Multi-agent PR review analyzing logic bugs, security issues, and performance regressions with optional auto-fix patches (`--fix`).
* **Enterprise Cloud Gateways (`claude gateway`):**
  Self-hosted reverse proxy supporting corporate SSO (OIDC), developer spend caps, and model routing across Amazon Bedrock, Google Cloud Agent Platform, and Microsoft Foundry.

---

## 10. Claude Agent SDK (Programmatic Library)

For building custom agentic applications, the Claude Agent SDK exposes Claude Code's engine as a library:

* **Python & TypeScript SDKs:**
  Enables developers to programmatically instantiate Claude Code sessions, inject custom tools, manage conversation threads, and stream structured responses.
* **Type-Safe Structured Output:**
  Validates agent deliverables directly against Zod schemas (TypeScript) or Pydantic models (Python).
* **In-Process Custom Tools & Scalable MCP:**
  Equips SDK agents with in-process tools and auto-discovered MCP tool catalogs.
* **Session Persistence & Checkpointing:**
  Allows external applications to pause, resume, fork, and rewind agent state across independent infrastructure nodes.
* **Full Observability:**
  Native OpenTelemetry (OTel) instrumentation for tracing tool invocations, token costs, latency, and agent decisions.

---

## Summary Matrix

| Capability Area | Core Components / Commands |
| :--- | :--- |
| **Agentic Loop** | Autonomous cycle, `/compact`, `/model`, `/effort`, `/fast`, `/advisor`, `/goal`, prompt caching |
| **OS Tools** | `Read`, `Write`, `Edit`, `Bash`, `PowerShell`, `Grep`, `Glob`, `Monitor`, `WebSearch`, `WebFetch` |
| **Multi-Agent** | `Agent`, `/subtask`, `claude agents`, `agent-teams`, `SendMessage`, `Workflow`, worktrees |
| **Customization** | `CLAUDE.md`, `rules/*.md`, `skills/`, `commands/`, `output-styles/`, auto memory, `.mcp.json`, plugins |
| **Hooks** | 30+ lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`), command/http/mcp/prompt hooks, channels |
| **Security** | Auto mode, Manual, Plan mode, OS sandboxing (`Seatbelt`/`bwrap`), `/rewind` checkpoints, managed settings |
| **Platforms** | Terminal CLI, VS Code, JetBrains, Desktop app, Web (`claude.ai/code`), Mobile, Remote Control |
| **SDK** | TypeScript and Python Agent SDK, structured outputs (Zod/Pydantic), in-process tools, OTel tracing |
