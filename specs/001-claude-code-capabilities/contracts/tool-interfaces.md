# Interface Contracts: Coding Harness Tools

This document defines the interface specifications, JSON schemas, and execution contracts for the native tools under `agent/tools/`.

---

## 1. File & Code Inspection Tools

### 1.1 `read_file`
Reads file content with line numbers and token-window pagination.

- **Model Tool Name**: `read_file`
- **File**: `agent/tools/read_file.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "filePath": { "type": "string", "description": "Path to file, relative to repository workspace root" },
    "offset": { "type": "integer", "minimum": 1, "description": "1-based line number to start reading from" },
    "limit": { "type": "integer", "minimum": 1, "maximum": 500, "description": "Maximum number of lines to return (default 200)" }
  },
  "required": ["filePath"]
}
```
- **Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "filePath": { "type": "string" },
    "totalLines": { "type": "integer" },
    "linesReturned": { "type": "integer" },
    "content": { "type": "string" },
    "hasMore": { "type": "boolean" }
  },
  "required": ["filePath", "totalLines", "content"]
}
```

---

### 1.2 `edit_file`
Performs surgical exact-match string replacement within an existing file.

- **Model Tool Name**: `edit_file`
- **File**: `agent/tools/edit_file.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "filePath": { "type": "string", "description": "Target file path relative to workspace root" },
    "targetContent": { "type": "string", "description": "Exact text chunk to be replaced; must match file contents precisely" },
    "replacementContent": { "type": "string", "description": "Replacement text to insert in place of targetContent" },
    "startLine": { "type": "integer", "description": "Optional starting line constraint for disambiguation" },
    "endLine": { "type": "integer", "description": "Optional ending line constraint for disambiguation" },
    "allowMultiple": { "type": "boolean", "default": false, "description": "Whether to replace multiple occurrences if found" }
  },
  "required": ["filePath", "targetContent", "replacementContent"]
}
```
- **Error Behavior**:
  - Target content not found -> returns `TargetNotFoundError` with nearest match guidance.
  - Target content matches multiple occurrences and `allowMultiple` is false -> returns `AmbiguousMatchError` requiring line range.

---

### 1.3 `write_file`
Creates a new file or overwrites an existing file atomically.

- **Model Tool Name**: `write_file`
- **File**: `agent/tools/write_file.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "filePath": { "type": "string", "description": "Destination file path relative to workspace root" },
    "content": { "type": "string", "description": "Complete file content to write" },
    "overwrite": { "type": "boolean", "default": false, "description": "Must be true if target file already exists" }
  },
  "required": ["filePath", "content"]
}
```

---

### 1.4 `notebook_edit`
Inspects and modifies cells in Jupyter notebooks (`.ipynb`).

- **Model Tool Name**: `notebook_edit`
- **File**: `agent/tools/notebook_edit.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "notebookPath": { "type": "string" },
    "action": { "type": "string", "enum": ["read_cells", "update_cell", "insert_cell", "delete_cell"] },
    "cellIndex": { "type": "integer", "minimum": 0 },
    "cellType": { "type": "string", "enum": ["code", "markdown"] },
    "source": { "type": "string" }
  },
  "required": ["notebookPath", "action"]
}
```

---

## 2. Search & Navigation Tools

### 2.1 `grep`
Regex content searching across project files.

- **Model Tool Name**: `grep`
- **File**: `agent/tools/grep.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "pattern": { "type": "string", "description": "Regular expression pattern to search for" },
    "pathPattern": { "type": "string", "description": "Glob filter for target file paths (e.g. 'src/**/*.ts')" },
    "caseSensitive": { "type": "boolean", "default": true },
    "maxMatches": { "type": "integer", "default": 50 }
  },
  "required": ["pattern"]
}
```

### 2.2 `glob`
Pattern-based file searching.

- **Model Tool Name**: `glob`
- **File**: `agent/tools/glob.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "pattern": { "type": "string", "description": "Glob pattern (e.g. '**/*.config.*', 'agent/**')" },
    "exclude": { "type": "array", "items": { "type": "string" }, "description": "Patterns to ignore" }
  },
  "required": ["pattern"]
}
```

---

## 3. Shell & Background Process Management

### 3.1 `bash`
Executes shell commands with directory persistence, output limits, and workspace containment.

- **Model Tool Name**: `bash`
- **File**: `agent/tools/bash.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "command": { "type": "string", "description": "The exact shell command line string to execute" },
    "cwd": { "type": "string", "description": "Optional working directory relative to workspace root" },
    "timeoutMs": { "type": "integer", "default": 30000, "maximum": 120000 },
    "isBackground": { "type": "boolean", "default": false, "description": "Set to true for long-running servers/watchers" }
  },
  "required": ["command"]
}
```
- **Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "exitCode": { "type": "integer" },
    "stdout": { "type": "string" },
    "stderr": { "type": "string" },
    "cwd": { "type": "string" },
    "isBackground": { "type": "boolean" },
    "backgroundTaskId": { "type": "string" }
  },
  "required": ["exitCode", "stdout", "stderr", "cwd"]
}
```

### 3.2 `background_task`
Inspects and controls background tasks.

- **Model Tool Name**: `background_task`
- **File**: `agent/tools/background_task.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string", "enum": ["list", "status", "kill", "send_input"] },
    "taskId": { "type": "string" },
    "input": { "type": "string" }
  },
  "required": ["action"]
}
```

---

## 4. Steering, Tracking & Checkpoints

### 4.1 `ask_question`
Presents interactive multiple-choice menus with write-in options.

- **Model Tool Name**: `ask_question`
- **File**: `agent/tools/ask_question.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "question": { "type": "string" },
          "options": { "type": "array", "items": { "type": "string" } },
          "isMultiSelect": { "type": "boolean", "default": false }
        },
        "required": ["question", "options"]
      }
    }
  },
  "required": ["questions"]
}
```

### 4.2 `task_tracker`
Manages ordered multi-step task checklists.

- **Model Tool Name**: `task_tracker`
- **File**: `agent/tools/task_tracker.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string", "enum": ["init", "list", "get", "update"] },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" }
        },
        "required": ["id", "title"]
      }
    },
    "itemId": { "type": "string" },
    "status": { "type": "string", "enum": ["pending", "in_progress", "completed", "skipped"] },
    "skipReason": { "type": "string" },
    "outcomeSummary": { "type": "string" }
  },
  "required": ["action"]
}
```

### 4.3 `rewind`
Restores workspace file state to a previous turn checkpoint.

- **Model Tool Name**: `rewind`
- **File**: `agent/tools/rewind.ts`
- **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "targetTurn": { "type": "integer", "description": "Historical turn number to restore files to" },
    "dryRun": { "type": "boolean", "default": false, "description": "Preview files that would be restored without applying changes" }
  },
  "required": ["targetTurn"]
}
```

---

## 5. Web Search & Documentation Fetch

### 5.1 `web_search` & `web_fetch`
- **File**: `agent/tools/web_search.ts`
  - Input: `{ query: string, domain?: string, limit?: number }`
  - Output: `{ results: Array<{ title: string, url: string, snippet: string }> }`
- **File**: `agent/tools/web_fetch.ts`
  - Input: `{ url: string, raw?: boolean }`
  - Output: `{ url: string, title?: string, markdown: string, status: number }`
