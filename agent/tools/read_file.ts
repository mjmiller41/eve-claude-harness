import fs from "node:fs";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { assertWithinWorkspace, toRelativeWorkspacePath } from "../lib/workspace.js";

export default defineTool({
  description:
    "Reads file content from the workspace with line numbering and token-window pagination.",
  inputSchema: z.object({
    filePath: z.string().describe("Path to file, relative to repository workspace root"),
    offset: z.number().int().min(1).default(1).describe("1-based line number to start reading from"),
    limit: z.number().int().min(1).max(500).default(200).describe("Maximum number of lines to return (default 200)"),
  }),
  label: {
    start: ({ filePath, offset, limit }) =>
      `Read ${filePath} (lines ${offset} to ${offset + limit - 1})`,
  },
  async execute({ filePath, offset, limit }) {
    const fullPath = assertWithinWorkspace(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error(`Cannot read directory: ${filePath}. Use glob or shell to list directory contents.`);
    }

    const rawContent = fs.readFileSync(fullPath, "utf8");
    const allLines = rawContent.split("\n");
    const totalLines = allLines.length;

    const startLine = Math.min(offset, totalLines);
    const startIdx = Math.max(0, startLine - 1);
    const endIdx = Math.min(totalLines, startIdx + limit);
    const selectedLines = allLines.slice(startIdx, endIdx);
    const linesReturned = selectedLines.length;
    const hasMore = endIdx < totalLines;

    const padLength = Math.max(4, String(endIdx).length);
    const formatted = selectedLines
      .map((line, idx) => {
        const lineNum = String(startLine + idx).padStart(padLength, " ");
        return `${lineNum} | ${line}`;
      })
      .join("\n");

    return {
      filePath: toRelativeWorkspacePath(filePath),
      totalLines,
      linesReturned,
      content: formatted,
      hasMore,
    };
  },
});
