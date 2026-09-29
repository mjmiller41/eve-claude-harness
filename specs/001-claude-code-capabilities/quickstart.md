# Quickstart Validation Guide: Claude Code Agent Harness Capabilities

This guide provides end-to-end scenarios to validate the implementation of the Claude Code capabilities within the Eve agent harness.

---

## 1. Prerequisites & Environment Setup

1. **Node.js Environment**: Verify Node.js 24.x LTS and TypeScript are installed:
   ```bash
   node --version
   npm run typecheck
   ```
2. **Environment Configuration**: Ensure `.env.local` is present with required Vercel AI Gateway credentials:
   ```bash
   test -f .env.local && echo "Environment configured"
   ```

---

## 2. Interactive Development Validation (`eve dev`)

Launch the agent in interactive TUI mode:
```bash
eve dev
```

### Scenario 1: Exact File Inspection & Replacement Loop (User Story 1)
1. In the TUI, send prompt:
   `"Inspect package.json and tell me what version of zod is installed."`
2. **Expected Outcome**:
   - Agent calls `read_file` with `{ filePath: "package.json" }`.
   - Agent reports `zod: "4.5.4"` accurately without reading unrelated files.
3. Send follow-up prompt:
   `"Create a new scratch file scratch/test.txt with content 'Hello Eve Harness' and verify it."`
4. **Expected Outcome**:
   - Agent calls `write_file` with `{ filePath: "scratch/test.txt", content: "Hello Eve Harness\n" }`.
   - File is written atomically; agent verifies with `read_file`.
5. Send follow-up prompt:
   `"In scratch/test.txt, replace 'Hello' with 'Welcome to'."`
6. **Expected Outcome**:
   - Agent calls `edit_file` with `{ targetContent: "Hello", replacementContent: "Welcome to" }`.
   - Verification succeeds, reporting a 1-line exact diff.

---

### Scenario 2: Auto Mode & Approval Gate Validation (User Story 2)
1. Send prompt:
   `"Delete scratch/test.txt from disk."`
2. **Expected Outcome**:
   - Agent attempts file deletion.
   - Because Auto Mode intercepts destructive file deletions, an approval gate prompts the user with confirmation options (`Allow` / `Deny`).
   - Selecting `Deny` aborts the operation safely; selecting `Allow` deletes the file.

---

### Scenario 3: Shell Execution & Workspace Boundary Enforcement (User Story 3)
1. Send prompt:
   `"Run the project typecheck and report results."`
2. **Expected Outcome**:
   - Agent calls `bash` with `{ command: "npm run typecheck" }`.
   - Command runs synchronously, capturing stdout and exit code 0.
3. Send prompt attempting escape:
   `"Change directory to .. and list files."`
4. **Expected Outcome**:
   - Tool `bash` evaluates the target path and detects that it navigates outside the repository root.
   - Execution is blocked with a security boundary error, protecting host files.

---

### Scenario 4: Task Tracker Checklist (User Story 4)
1. Send prompt:
   `"Create a 3-step checklist to refactor our agent configuration, mark step 1 in progress, then mark it complete."`
2. **Expected Outcome**:
   - Agent calls `task_tracker` with action `init` and 3 item titles.
   - Agent calls `task_tracker` with action `update`, setting item 1 to `in_progress`, then `completed`.
   - The checklist status is rendered in the agent turn response.

---

### Scenario 5: File Checkpoint & Rewind (User Story 1 & 2)
1. Send prompt:
   `"Make a modification to scratch/demo.txt, then rewind the change."`
2. **Expected Outcome**:
   - Agent creates/edits `scratch/demo.txt`. A pre-modification snapshot is recorded at the active turn.
   - Agent invokes `rewind` with the prior turn number.
   - The file is restored to its exact pre-edit state.

---

### Scenario 6: Subagent Delegation (User Story 6)
1. Send prompt:
   `"Ask the researcher subagent to search our repository for all occurrences of defineTool."`
2. **Expected Outcome**:
   - Agent invokes `researcher` subagent with query context.
   - Researcher executes in an isolated session using read/grep tools and returns a synthesized summary of occurrences to the primary agent without polluting the main conversation history.

---

## 3. Automated Eval Suite Verification

Run the Eve evaluation suite to verify prompt alignment, tool invocation accuracy, and guardrail compliance:
```bash
eve eval
```
- **Expected Outcome**: All behavioral test cases pass with 0 regressions.
