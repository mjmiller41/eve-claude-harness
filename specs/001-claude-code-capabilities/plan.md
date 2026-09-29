# Implementation Plan: Claude Code Agent Harness Capabilities

**Branch**: `001-claude-code-capabilities` | **Date**: 2026-09-29 | **Spec**: [spec.md](file:///home/michael/Code/eve-claude-harness/specs/001-claude-code-capabilities/spec.md)

**Input**: Feature specification from `/specs/001-claude-code-capabilities/spec.md`

## Summary

This plan specifies the technical architecture, component breakdown, and design artifacts to implement Claude Code CLI capabilities inside the Eve agent framework. The implementation equips the harness with native file editing (`read_file`, `edit_file`, `write_file`, `notebook_edit`), codebase navigation (`grep`, `glob`), shell execution with workspace bounding (`bash`, `background_task`), steering & approvals (`ask_question`, Auto Mode approval gates), multi-turn checklists (`task_tracker`), diagnostic reporting (`report_findings`), context window compaction, file checkpointing/rollback (`rewind`), and specialist subagents (`researcher`, `advisor`, worktree workers).

## Technical Context

**Language/Version**: TypeScript 7.0+ (strict mode enabled), Node.js 24.x LTS.

**Primary Dependencies**: `eve` (^0.66.3), `@ai-sdk/anthropic` (^4.0.63), `ai` (^7.0.105), `zod` (4.5.4).

**Storage**: Local in-memory session state, disk-backed checkpoints in `.eve/checkpoints/`, and git worktrees in `.worktrees/`.

**Testing**: Automated typechecking (`tsc`), unit tests for tools and shared libraries, and behavioral evaluation suites (`eve eval` / `#evals/*`).

**Target Platform**: Linux, macOS, and POSIX development environments deployed via Eve CLI/TUI (`eve dev`) and Vercel serverless / fluid compute (`eve deploy`).

**Project Type**: Agent Harness / Autonomous Coding Agent CLI & Service.

**Performance Goals**: File search & read <100ms; subagent delegation dispatch <500ms; user interruption latency <1s; context history compaction reduces token footprint by >=40%.

**Constraints**: Strict workspace root boundary (no path escapes outside repository); read-before-edit exact string matching; model routing exclusively through Vercel AI Gateway targeting Anthropic Claude models; full adherence to Eve canonical folder structure.

**Scale/Scope**: Repository-wide codebase navigation (supporting projects up to 100k+ LOC); multi-turn sessions spanning 50+ actions; observable checklist tracking up to 30 sub-tasks.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Eve Framework & Filesystem-First Architecture (NON-NEGOTIABLE)**: **PASS**
  All features are authored strictly under `agent/` (`agent/tools/`, `agent/subagents/`, `agent/lib/`, `agent/instructions.md`, `agent/agent.ts`). No ad-hoc runtime scripts or compilation bypasses.
- **Principle II: Anthropic Models via Vercel AI Gateway (NON-NEGOTIABLE)**: **PASS**
  All model routing is centralized through `@ai-sdk/anthropic` and Eve's `auto` router via the Vercel AI Gateway (`agent/agent.ts`). No direct vendor API calls.
- **Principle III: Autonomous Perception-Action-Verification Loop**: **PASS**
  Exact-match read-before-edit verification (`edit_file`), structured command capture (`bash`), and background task tracking (`background_task`) ensure continuous self-correcting execution.
- **Principle IV: Test-First & Behavior Evals (NON-NEGOTIABLE)**: **PASS**
  Tool contracts and libraries are accompanied by automated tests, TypeScript strict checks (`npm run typecheck`), and Eve evals (`eve eval`).
- **Principle V: Safety Boundaries & Human-in-the-Loop Safeguards**: **PASS**
  Default Auto Mode with dynamic approval gates for destructive commands and sensitive files; strict workspace boundary containment; per-turn file checkpoint snapshots for rollback.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-claude-code-capabilities/
├── spec.md              # Feature specification & user stories
├── plan.md              # This technical plan
├── research.md          # Phase 0 architectural decisions & technical context
├── data-model.md        # Phase 1 domain entities, schemas & state transitions
├── quickstart.md        # Phase 1 end-to-end runnable validation scenarios
├── checklists/
│   └── requirements.md  # Spec quality & requirements validation checklist
└── contracts/
    ├── tool-interfaces.md # Formal schemas for all agent tools
    └── subagents.md       # Invocation contracts for specialist subagents
```

### Source Code Layout (repository root)

```text
agent/
├── agent.ts                   # Top-level agent definition & Anthropic model auto-router
├── instructions.md            # System prompt, core coding agent persona, and guidelines
├── tools/                     # Model-facing tools authored with defineTool
│   ├── read_file.ts           # Bounded file reading with pagination
│   ├── edit_file.ts           # Surgical exact-match string replacement
│   ├── write_file.ts          # Atomic file creation / overwrite
│   ├── notebook_edit.ts       # Jupyter notebook (.ipynb) cell manipulation
│   ├── grep.ts                # Regex codebase content search
│   ├── glob.ts                # Pattern-based file matching
│   ├── bash.ts                # Shell execution with workspace containment
│   ├── background_task.ts     # Background process lifecycle management
│   ├── ask_question.ts        # Interactive disambiguation multiple-choice menu
│   ├── task_tracker.ts        # Multi-turn checklist progress management
│   ├── report_findings.ts     # Structured code audit & review findings
│   ├── rewind.ts              # File checkpoint rollback & rewind
│   ├── web_search.ts          # Authoritative technical web search
│   └── web_fetch.ts           # Web documentation extraction as markdown
├── subagents/                 # Declared specialist subagents
│   ├── researcher/
│   │   ├── agent.ts           # Read-only exploration agent
│   │   └── instructions.md    # Codebase indexing & research persona
│   └── advisor/
│       ├── agent.ts           # Senior architectural advisor agent (Opus 5.5)
│       └── instructions.md    # Design review & tradeoff analysis persona
├── lib/                       # Shared domain utilities & infrastructure
│   ├── permissions.ts         # Auto Mode inspection & approval policy engine
│   ├── shell-manager.ts       # Process execution, timeouts, buffer caps, and cwd tracking
│   ├── checkpoint-manager.ts  # Per-turn file snapshot capture and restoration
│   ├── compaction.ts          # 75% threshold & on-demand context history summarizer
│   ├── worktree.ts            # Git worktree isolation helper for worker subagents
│   └── notebook-parser.ts     # Jupyter notebook JSON cell parser & serializer
└── sandbox/                   # Execution isolation policies & boundaries

evals/                         # Automated agent behavior evaluations
├── coding-loop.eval.ts        # Tests perception-action-verification loop
├── approval-gates.eval.ts     # Tests Auto Mode and destructive command gating
└── subagents.eval.ts          # Tests research and advisor delegation
```

**Structure Decision**: Fully adheres to Eve's canonical filesystem-first layout under `agent/`, modularizing tools under `agent/tools/`, subagents under `agent/subagents/`, and shared logic under `agent/lib/`.

---

## Complexity Tracking

> **Constitution Compliance**: 100% compliant. No violations or unwarranted complexity introduced.

| Principle / Gate | Assessment | Rationale |
|---|---|---|
| Eve Folder Conventions | Clean | Direct alignment with Eve's `agent/{tools,subagents,lib}` conventions. |
| Model Gateway | Direct | Uses Vercel AI Gateway via `@ai-sdk/anthropic` with zero intermediate proxies. |
| Worktree Subagents | Isolated | Guarantees parallel file safety without custom low-level multiplexing hacks. |
