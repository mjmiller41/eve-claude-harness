import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getWorkspaceRoot, toRelativeWorkspacePath } from "../lib/workspace.js";

interface GrepMatch {
  filePath: string;
  lineNumber: number;
  lineContent: string;
}

export default defineTool({
  description:
    "Searches workspace file contents using regular expressions, with ripgrep support and path filtering.",
  inputSchema: z.object({
    pattern: z.string().describe("Regular expression pattern to search for"),
    pathPattern: z
      .string()
      .optional()
      .describe("Glob or path filter for target file paths (e.g. 'src/**/*.ts' or '*.ts')"),
    caseSensitive: z.boolean().default(true).describe("Whether the regex search is case-sensitive"),
    maxMatches: z.number().int().min(1).max(200).default(50).describe("Maximum number of matching lines to return"),
  }),
  label: {
    start: ({ pattern, pathPattern }) =>
      `Grep "${pattern}"${pathPattern ? ` in ${pathPattern}` : ""}`,
  },
  async execute({ pattern, pathPattern, caseSensitive, maxMatches }) {
    const root = getWorkspaceRoot();
    const matches: GrepMatch[] = [];

    // Attempt ripgrep first
    try {
      const args = [
        "-n",
        "--no-heading",
        "--color=never",
        "-e",
        pattern,
        "--glob",
        "!node_modules/**",
        "--glob",
        "!.git/**",
        "--glob",
        "!.eve/**",
        "--glob",
        "!dist/**",
      ];

      if (!caseSensitive) {
        args.push("-i");
      }

      if (pathPattern) {
        args.push("--glob", pathPattern);
      }

      // Explicitly pass '.' so rg searches directory instead of waiting on stdin
      args.push(".");

      const rgProc = spawnSync("rg", args, {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });

      if (rgProc.status === 0 && rgProc.stdout) {
        const lines = rgProc.stdout.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          // Format: file:line:content
          const firstColon = line.indexOf(":");
          if (firstColon === -1) continue;
          const secondColon = line.indexOf(":", firstColon + 1);
          if (secondColon === -1) continue;

          let fileRel = line.substring(0, firstColon);
          if (fileRel.startsWith("./")) {
            fileRel = fileRel.substring(2);
          }
          const lineNumStr = line.substring(firstColon + 1, secondColon);
          const lineContent = line.substring(secondColon + 1);
          const lineNumber = parseInt(lineNumStr, 10);

          matches.push({
            filePath: fileRel,
            lineNumber,
            lineContent,
          });

          if (matches.length >= maxMatches) {
            break;
          }
        }

        return {
          matches,
          totalMatches: matches.length,
          hasMore: lines.length > maxMatches,
        };
      } else if (rgProc.status === 1) {
        // No matches found
        return {
          matches: [],
          totalMatches: 0,
          hasMore: false,
        };
      }
    } catch {
      // Fallback to pure Node.js regex traversal below
    }

    // Node.js fallback traversal
    const regex = new RegExp(pattern, caseSensitive ? "g" : "gi");
    const ignoreDirs = new Set(["node_modules", ".git", ".eve", "dist", ".worktrees"]);

    function walk(dir: string) {
      if (matches.length >= maxMatches) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= maxMatches) break;
        if (ignoreDirs.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const relPath = toRelativeWorkspacePath(fullPath, root);
          if (pathPattern && !relPath.includes(pathPattern.replace(/^\*+/, "").replace(/\*+$/, ""))) {
            continue;
          }

          try {
            const content = fs.readFileSync(fullPath, "utf8");
            const fileLines = content.split("\n");
            for (let i = 0; i < fileLines.length; i++) {
              if (matches.length >= maxMatches) break;
              regex.lastIndex = 0;
              if (regex.test(fileLines[i])) {
                matches.push({
                  filePath: relPath,
                  lineNumber: i + 1,
                  lineContent: fileLines[i],
                });
              }
            }
          } catch {
            // Ignore binary / unreadable files
          }
        }
      }
    }

    walk(root);

    return {
      matches,
      totalMatches: matches.length,
      hasMore: matches.length >= maxMatches,
    };
  },
});
