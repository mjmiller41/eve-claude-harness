import type { JupyterNotebook, NotebookCell } from "./types.js";

/**
 * Normalizes cell source to a single concatenated string.
 */
export function getCellSourceAsString(cell: NotebookCell): string {
  if (Array.isArray(cell.source)) {
    return cell.source.join("");
  }
  return typeof cell.source === "string" ? cell.source : "";
}

/**
 * Normalizes string source into an array of lines matching standard Jupyter notebook formatting.
 */
export function stringToNotebookSource(source: string): string[] {
  const lines = source.split("\n");
  return lines.map((line, idx) => (idx === lines.length - 1 ? line : `${line}\n`));
}

/**
 * Parses raw JSON string into a validated Jupyter Notebook structure.
 */
export function parseNotebook(jsonString: string): JupyterNotebook {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Invalid Jupyter Notebook JSON: ${(err as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid Jupyter Notebook format: expected root object.");
  }

  const raw = parsed as Record<string, unknown>;
  const cells = Array.isArray(raw.cells) ? (raw.cells as NotebookCell[]) : [];
  const metadata = (typeof raw.metadata === "object" && raw.metadata !== null ? raw.metadata : {}) as Record<string, unknown>;
  const nbformat = typeof raw.nbformat === "number" ? raw.nbformat : 4;
  const nbformat_minor = typeof raw.nbformat_minor === "number" ? raw.nbformat_minor : 5;

  return {
    cells,
    metadata,
    nbformat,
    nbformat_minor,
  };
}

/**
 * Serializes a Jupyter Notebook structure to formatted JSON with trailing newline.
 */
export function serializeNotebook(notebook: JupyterNotebook): string {
  return JSON.stringify(notebook, null, 1) + "\n";
}

export interface ExtractedCellInfo {
  index: number;
  cellType: "code" | "markdown" | "raw";
  source: string;
  executionCount?: number | null;
  outputsCount?: number;
}

/**
 * Extracts cell summaries and content from a notebook.
 */
export function readNotebookCells(notebook: JupyterNotebook): ExtractedCellInfo[] {
  return notebook.cells.map((cell, index) => ({
    index,
    cellType: cell.cell_type,
    source: getCellSourceAsString(cell),
    executionCount: cell.execution_count,
    outputsCount: Array.isArray(cell.outputs) ? cell.outputs.length : 0,
  }));
}

/**
 * Updates the source code of an existing cell at cellIndex.
 */
export function updateNotebookCell(
  notebook: JupyterNotebook,
  cellIndex: number,
  newSource: string
): JupyterNotebook {
  if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
    throw new Error(
      `Cell index ${cellIndex} is out of bounds (notebook has ${notebook.cells.length} cells).`
    );
  }

  const updatedCells = [...notebook.cells];
  const targetCell = { ...updatedCells[cellIndex] };

  targetCell.source = stringToNotebookSource(newSource);
  // Clear outputs on edit if it is a code cell
  if (targetCell.cell_type === "code") {
    targetCell.outputs = [];
    targetCell.execution_count = null;
  }

  updatedCells[cellIndex] = targetCell;

  return {
    ...notebook,
    cells: updatedCells,
  };
}

/**
 * Inserts a new cell at cellIndex.
 */
export function insertNotebookCell(
  notebook: JupyterNotebook,
  cellIndex: number,
  cellType: "code" | "markdown",
  source: string
): JupyterNotebook {
  const boundedIndex = Math.max(0, Math.min(cellIndex, notebook.cells.length));
  const newCell: NotebookCell = {
    cell_type: cellType,
    source: stringToNotebookSource(source),
    metadata: {},
    ...(cellType === "code" ? { execution_count: null, outputs: [] } : {}),
  };

  const updatedCells = [...notebook.cells];
  updatedCells.splice(boundedIndex, 0, newCell);

  return {
    ...notebook,
    cells: updatedCells,
  };
}

/**
 * Deletes a cell at cellIndex.
 */
export function deleteNotebookCell(notebook: JupyterNotebook, cellIndex: number): JupyterNotebook {
  if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
    throw new Error(
      `Cell index ${cellIndex} is out of bounds (notebook has ${notebook.cells.length} cells).`
    );
  }

  const updatedCells = [...notebook.cells];
  updatedCells.splice(cellIndex, 1);

  return {
    ...notebook,
    cells: updatedCells,
  };
}
