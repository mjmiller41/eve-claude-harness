import fs from "node:fs";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { assertWithinWorkspace, toRelativeWorkspacePath } from "../lib/workspace.js";
import { defaultCheckpointManager } from "../lib/checkpoint-manager.js";
import {
  parseNotebook,
  serializeNotebook,
  readNotebookCells,
  updateNotebookCell,
  insertNotebookCell,
  deleteNotebookCell,
} from "../lib/notebook-parser.js";

export default defineTool({
  description:
    "Inspects and modifies code and markdown cells within Jupyter notebooks (.ipynb files).",
  inputSchema: z.object({
    notebookPath: z.string().describe("Path to .ipynb file relative to workspace root"),
    action: z
      .enum(["read_cells", "update_cell", "insert_cell", "delete_cell"])
      .describe("Action to perform on the notebook"),
    cellIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("0-based index of the target cell (required for update, delete, optional for insert)"),
    cellType: z
      .enum(["code", "markdown"])
      .optional()
      .default("code")
      .describe("Cell type when inserting a cell ('code' or 'markdown')"),
    source: z
      .string()
      .optional()
      .describe("Source code or markdown content (required for update and insert)"),
  }),
  label: {
    start: ({ notebookPath, action, cellIndex }) =>
      `${action} on ${notebookPath}${cellIndex !== undefined ? ` at cell ${cellIndex}` : ""}`,
  },
  async execute({ notebookPath, action, cellIndex, cellType, source }) {
    const fullPath = assertWithinWorkspace(notebookPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Notebook not found: ${notebookPath}`);
    }

    const rawContent = fs.readFileSync(fullPath, "utf8");
    const notebook = parseNotebook(rawContent);

    if (action === "read_cells") {
      const cells = readNotebookCells(notebook);
      return {
        notebookPath: toRelativeWorkspacePath(notebookPath),
        totalCells: cells.length,
        cells,
      };
    }

    // For mutating actions, capture checkpoint snapshot before modification
    defaultCheckpointManager.captureSnapshot(notebookPath);

    let modifiedNotebook = notebook;

    if (action === "update_cell") {
      if (cellIndex === undefined) {
        throw new Error("cellIndex is required for update_cell action.");
      }
      if (source === undefined) {
        throw new Error("source is required for update_cell action.");
      }
      modifiedNotebook = updateNotebookCell(notebook, cellIndex, source);
    } else if (action === "insert_cell") {
      if (source === undefined) {
        throw new Error("source is required for insert_cell action.");
      }
      const targetIndex = cellIndex ?? notebook.cells.length;
      modifiedNotebook = insertNotebookCell(
        notebook,
        targetIndex,
        cellType ?? "code",
        source
      );
    } else if (action === "delete_cell") {
      if (cellIndex === undefined) {
        throw new Error("cellIndex is required for delete_cell action.");
      }
      modifiedNotebook = deleteNotebookCell(notebook, cellIndex);
    }

    const serialized = serializeNotebook(modifiedNotebook);
    fs.writeFileSync(fullPath, serialized, "utf8");

    return {
      notebookPath: toRelativeWorkspacePath(notebookPath),
      action,
      cellIndex,
      totalCells: modifiedNotebook.cells.length,
      message: `Notebook "${notebookPath}" updated successfully (${action}).`,
    };
  },
});
