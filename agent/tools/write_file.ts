import fs from "node:fs";
import path from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { assertWithinWorkspace, toRelativeWorkspacePath } from "../lib/workspace.js";
import { defaultCheckpointManager } from "../lib/checkpoint-manager.js";

export default defineTool({
  description:
    "Creates a new file or overwrites an existing file atomically with recursive directory creation.",
  inputSchema: z.object({
    filePath: z.string().describe("Destination file path relative to workspace root"),
    content: z.string().describe("Complete file content to write"),
    overwrite: z
      .boolean()
      .default(false)
      .describe("Must be true if target file already exists"),
  }),
  label: {
    start: ({ filePath, overwrite }) =>
      `${overwrite ? "Overwrite" : "Write"} ${filePath}`,
  },
  async execute({ filePath, content, overwrite }) {
    const fullPath = assertWithinWorkspace(filePath);
    const fileExists = fs.existsSync(fullPath);

    if (fileExists && !overwrite) {
      throw new Error(
        `File already exists at "${filePath}". Pass overwrite=true to replace its contents.`
      );
    }

    // Capture checkpoint snapshot prior to modification
    defaultCheckpointManager.captureSnapshot(filePath);

    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file atomically via temp file
    const tempPath = `${fullPath}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, content, "utf8");
    fs.renameSync(tempPath, fullPath);

    const bytesWritten = Buffer.byteLength(content, "utf8");

    return {
      filePath: toRelativeWorkspacePath(filePath),
      bytesWritten,
      created: !fileExists,
      message: fileExists ? `File "${filePath}" overwritten successfully.` : `File "${filePath}" created successfully.`,
    };
  },
});
