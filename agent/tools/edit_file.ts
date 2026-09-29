import fs from "node:fs";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { assertWithinWorkspace, toRelativeWorkspacePath } from "../lib/workspace.js";
import { defaultCheckpointManager } from "../lib/checkpoint-manager.js";

export default defineTool({
  description:
    "Performs surgical exact-match string replacement within an existing file, with uniqueness and line-range validation.",
  inputSchema: z.object({
    filePath: z.string().describe("Target file path relative to workspace root"),
    targetContent: z
      .string()
      .describe("Exact text chunk to be replaced; must match file contents precisely"),
    replacementContent: z
      .string()
      .describe("Replacement text to insert in place of targetContent"),
    startLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Optional starting line constraint for disambiguation (1-based)"),
    endLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Optional ending line constraint for disambiguation (1-based)"),
    allowMultiple: z
      .boolean()
      .default(false)
      .describe("Whether to replace multiple occurrences if found (default false)"),
  }),
  label: {
    start: ({ filePath }) => `Edit ${filePath}`,
  },
  async execute({
    filePath,
    targetContent,
    replacementContent,
    startLine,
    endLine,
    allowMultiple,
  }) {
    const fullPath = assertWithinWorkspace(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error(`Target path is a directory, not a file: ${filePath}`);
    }

    const currentContent = fs.readFileSync(fullPath, "utf8");

    // Capture checkpoint snapshot prior to edit
    defaultCheckpointManager.captureSnapshot(filePath);

    let searchArea = currentContent;
    let prefixOffset = 0;

    // Apply line range scoping if specified
    if (startLine !== undefined || endLine !== undefined) {
      const lines = currentContent.split("\n");
      const effectiveStartLine = Math.max(1, startLine ?? 1);
      const effectiveEndLine = Math.min(lines.length, endLine ?? lines.length);

      if (effectiveStartLine > effectiveEndLine) {
        throw new Error(
          `Invalid line range: startLine (${effectiveStartLine}) cannot be greater than endLine (${effectiveEndLine}).`
        );
      }

      const preLines = lines.slice(0, effectiveStartLine - 1);
      const scopedLines = lines.slice(effectiveStartLine - 1, effectiveEndLine);
      const postLines = lines.slice(effectiveEndLine);

      prefixOffset = preLines.length > 0 ? preLines.join("\n").length + 1 : 0;
      searchArea = scopedLines.join("\n");

      // Check occurrences in search area
      const occurrences: number[] = [];
      let idx = searchArea.indexOf(targetContent);
      while (idx !== -1) {
        occurrences.push(idx);
        idx = searchArea.indexOf(targetContent, idx + targetContent.length);
      }

      if (occurrences.length === 0) {
        throw new Error(
          `TargetContent not found within lines ${effectiveStartLine}-${effectiveEndLine} of "${filePath}". Ensure exact whitespace and linebreaks match.`
        );
      }

      if (occurrences.length > 1 && !allowMultiple) {
        throw new Error(
          `TargetContent matched ${occurrences.length} times within lines ${effectiveStartLine}-${effectiveEndLine} of "${filePath}". Narrow the line range or set allowMultiple=true.`
        );
      }

      let updatedScopedArea: string;
      if (allowMultiple) {
        updatedScopedArea = searchArea.replaceAll(targetContent, replacementContent);
      } else {
        updatedScopedArea =
          searchArea.substring(0, occurrences[0]) +
          replacementContent +
          searchArea.substring(occurrences[0] + targetContent.length);
      }

      const finalContent =
        (preLines.length > 0 ? preLines.join("\n") + "\n" : "") +
        updatedScopedArea +
        (postLines.length > 0 ? "\n" + postLines.join("\n") : "");

      fs.writeFileSync(fullPath, finalContent, "utf8");

      return {
        filePath: toRelativeWorkspacePath(filePath),
        replacementsMade: occurrences.length,
        linesAffected: `${effectiveStartLine}-${effectiveEndLine}`,
        message: `Successfully replaced ${occurrences.length} occurrence(s) in "${filePath}".`,
      };
    }

    // Global file scope
    const occurrences: number[] = [];
    let idx = currentContent.indexOf(targetContent);
    while (idx !== -1) {
      occurrences.push(idx);
      idx = currentContent.indexOf(targetContent, idx + targetContent.length);
    }

    if (occurrences.length === 0) {
      throw new Error(
        `TargetContent not found in "${filePath}". Inspect the file with read_file to verify exact line contents and whitespace before editing.`
      );
    }

    if (occurrences.length > 1 && !allowMultiple) {
      throw new Error(
        `TargetContent matched ${occurrences.length} times in "${filePath}". Provide startLine/endLine to disambiguate or set allowMultiple=true.`
      );
    }

    let finalContent: string;
    if (allowMultiple) {
      finalContent = currentContent.replaceAll(targetContent, replacementContent);
    } else {
      finalContent =
        currentContent.substring(0, occurrences[0]) +
        replacementContent +
        currentContent.substring(occurrences[0] + targetContent.length);
    }

    fs.writeFileSync(fullPath, finalContent, "utf8");

    // Compute approximate line number of first replacement
    const beforeText = currentContent.substring(0, occurrences[0]);
    const matchedLineNumber = beforeText.split("\n").length;

    return {
      filePath: toRelativeWorkspacePath(filePath),
      replacementsMade: occurrences.length,
      firstReplacementLine: matchedLineNumber,
      message: `Successfully replaced ${occurrences.length} occurrence(s) in "${filePath}".`,
    };
  },
});
