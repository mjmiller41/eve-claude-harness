<!--
Sync Impact Report:
- Version Change: Initial Template -> 1.0.0 (Initial Ratification)
- Modified Principles: Initialized 5 core principles:
  - Principle I: Eve Framework & Filesystem-First Architecture (NON-NEGOTIABLE)
  - Principle II: Anthropic Models via Vercel AI Gateway (NON-NEGOTIABLE)
  - Principle III: Autonomous Perception-Action-Verification Loop
  - Principle IV: Test-First & Behavior Evals (NON-NEGOTIABLE)
  - Principle V: Safety Boundaries & Human-in-the-Loop Safeguards
- Added Sections:
  - Technology Stack & Architectural Constraints
  - Development Workflow & Quality Gates
- Removed Sections: None (replaced template placeholders)
- Deferred Items / TODOs: None
-->

# Eve Agent Harness Constitution

## Core Principles

### I. Eve Framework & Filesystem-First Architecture (NON-NEGOTIABLE)
All agent behaviors, capabilities, configurations, and lifecycle hooks MUST strictly adhere to the Eve agent framework conventions under `agent/`.
- File organization MUST mirror Eve canonical directories:
  - `agent/instructions.md` (or `agent/instructions/`) for core identity, tone, and operational instructions.
  - `agent/agent.ts` for top-level agent configuration, reasoning levels, and model routing.
  - `agent/tools/` for typed tool definitions using Eve's tool APIs (`defineTool`).
  - `agent/skills/` for procedural knowledge packaged according to Eve skill conventions.
  - `agent/connections/` for external HTTP integrations and MCP servers.
  - `agent/channels/` for inbound and outbound communication interfaces (CLI, custom webhooks, chat SDKs).
  - `agent/subagents/` for specialized delegable child agents.
  - `agent/sandbox/` for runtime execution boundaries and sandbox policies.
  - `agent/lib/` for shared authored domain code, utilities, and helper libraries.
- Ad-hoc runtime scripts or monkey-patching that bypass Eve's compilation, state management, or session streams are strictly prohibited.
- **Rationale**: Strict adherence to Eve's filesystem-first architecture ensures deterministic compilation, standard runtime serialization, hot-reloading in development (`eve dev`), and clean deployment on Vercel (`eve deploy`).

### II. Anthropic Models via Vercel AI Gateway (NON-NEGOTIABLE)
All model interactions MUST execute through the Vercel AI Gateway using Anthropic model endpoints (`anthropic/...`) and the Vercel AI SDK (`@ai-sdk/anthropic` / `ai`).
- Model definitions MUST utilize Eve's `auto` routing or explicit Anthropic Claude identifiers (e.g., `anthropic/claude-opus-5.5`, `anthropic/claude-sonnet-5`, `anthropic/claude-haiku-4.5`, `anthropic/claude-fable-5.1`).
- Extended reasoning and thinking budgets MUST be configured through standard reasoning parameters (`low`, `medium`, `high`, `xhigh`) aligned with task complexity.
- Bypassing the Vercel AI Gateway to call raw vendor APIs directly without gateway routing is prohibited.
- Prompt caching boundaries MUST be respected to optimize token efficiency and minimize response latencies.
- **Rationale**: Centralizing model requests via the Vercel AI Gateway provides unified observability, rate-limit resilience, cost attribution, and enterprise prompt-caching performance across Anthropic frontier models.

### III. Autonomous Perception-Action-Verification Loop
The coding agent harness MUST operate under a rigorous, self-correcting Perception-Reasoning-Action-Verification lifecycle.
- Every modification step MUST follow read-before-edit integrity: inspect file contents, verify target uniqueness, and validate syntax before and after edits.
- Tool executions MUST return structured, transparent outputs (status, stdout, stderr, diffs) to allow the agent to evaluate outcomes accurately.
- Long-running processes (development servers, file watchers, test suites) MUST be managed asynchronously with status tracking and interruptible lifecycles.
- When an action or build fails, the agent MUST inspect the failure output, isolate root causes, and iterate before declaring completion.
- **Rationale**: Reliable autonomous coding requires continuous ground-truth verification rather than blind speculative execution.

### IV. Test-First & Behavior Evals (NON-NEGOTIABLE)
All tools, domain services, and runtime utilities MUST be verified through automated testing and behavioral evals.
- Unit and contract tests MUST be authored for all tools in `agent/tools/` and shared logic in `agent/lib/` before integration into the agent loop.
- Agent prompt changes, instruction updates, and multi-step tool workflows MUST be benchmarked against Eve's evaluation framework (`eve eval` / `#evals/*`).
- Type safety is mandatory: TypeScript compilation (`npm run typecheck`) MUST pass without errors on all commits.
- **Rationale**: Agent harnesses are vulnerable to prompt drift and tool interface regressions; automated unit tests and evals serve as regression-proof guardrails.

### V. Safety Boundaries & Human-in-the-Loop Safeguards
The harness MUST enforce strict execution boundaries and human-in-the-loop (HITL) approval gates for sensitive or irreversible actions.
- Destructive filesystem operations, branch resets, secret exposure, or unconstrained external network mutations MUST require explicit confirmation via Eve's HITL mechanisms (`ctx.requestApproval` or dedicated approval tools).
- The harness MUST guarantee responsive user steerability: users can interrupt execution, provide corrective input mid-turn, or terminate runaway processes.
- Secrets, tokens, and credentials MUST NEVER be hardcoded or written to disk; they MUST be accessed exclusively via secure environment variables.
- **Rationale**: Autonomous agents with shell and filesystem capabilities must maintain absolute fail-safe operation to prevent data loss or unauthorized mutations.

## Technology Stack & Architectural Constraints

- **Core Framework**: `eve` (version 0.66.x+) powering the agent runtime, session management, and compilation.
- **Language & Runtime**: TypeScript 7+ with strict mode enabled; Node.js 24.x LTS.
- **AI & Model Layer**: Vercel AI SDK (`ai` v7+, `@ai-sdk/anthropic` v4+) integrated via Vercel AI Gateway.
- **Deployment Platform**: Vercel Serverless / Fluid Compute deployed through `eve deploy` and linked via `eve link`.
- **Directory Structure**:
  - `agent/`: Sole location for agent instructions, tools, skills, subagents, connections, channels, and runtime configuration.
  - `evals/`: Automated behavioral evaluation suites evaluated via `eve eval`.
  - `docs/`: Reference documentation, architecture guides, and feature specifications.
  - `.specify/`: Spec Kit memory, specifications, plans, and development workflows.

## Development Workflow & Quality Gates

- **Documentation First**: Before authoring new agent capabilities, consult the relevant Eve documentation in `node_modules/eve/docs/` following the bounded authoring loop.
- **Spec-Driven Feature Delivery**: All new features, tools, or major agent capabilities MUST follow the Spec Kit lifecycle:
  1. `/speckit-specify`: Create or update feature specification.
  2. `/speckit-plan`: Generate implementation plan and architecture design.
  3. `/speckit-tasks`: Produce dependency-ordered task breakdown.
  4. `/speckit-implement`: Execute tasks with continuous test verification.
- **Quality Gates**: Every pull request and release MUST pass:
  1. `npm run typecheck`: Strict TypeScript compilation without errors.
  2. Test execution: All tool and library tests passing.
  3. Behavioral evals: `eve eval` passing baseline accuracy and regression checks.
  4. Constitution compliance check: Strict adherence to Eve folder patterns and AI Gateway model routing.

## Governance

- **Supremacy**: This constitution is the foundational architectural contract for the `eve-agent-harness` project. It supersedes informal conventions and developer preferences.
- **Amendment Procedure**: Any change to principles, technology constraints, or governance requires:
  1. An explicit rationale documented in a pull request.
  2. A version bump following semantic versioning rules:
     - **MAJOR**: Backward-incompatible governance changes, removal or fundamental redefinition of core principles.
     - **MINOR**: Addition of new principles, sections, or materially expanded architectural guidance.
     - **PATCH**: Clarifications, formatting, typo fixes, or non-semantic wording refinements.
  3. An updated Sync Impact Report in the pull request description.
- **Compliance Review**: All design reviews, code reviews, and automated check runs MUST verify compliance with this constitution before merging into `main`.

**Version**: 1.0.0 | **Ratified**: 2026-09-29 | **Last Amended**: 2026-09-29
