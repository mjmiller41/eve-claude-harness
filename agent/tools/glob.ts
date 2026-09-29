import fs from "node:fs";
import path from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getWorkspaceRoot, assertWithinWorkspace, toRelativeWorkspacePath } from "../lib/workspace.js";

const DEFAULT_IGNORE = ["node_modules/**", ".git/**", ".eve/**", "dist/**", ".worktrees/**"];

export default defineTool({
  description: "Finds files across the workspace matching a glob pattern.",
  inputSchema: z.object({
    pattern: z.string().describe("Glob pattern to match files against (e.g. '**/*.ts', 'src/*.json')"),
    baseDir: z
      .string()
      .default(".")
      .describe("Directory to start matching from, relative to workspace root (default '.')"),
  }),
  label: {
    start: ({ pattern, baseDir }) => `Glob "${pattern}" in ${baseDir}`,
  },
  async execute({ pattern, baseDir = "." }) {
    const root = getWorkspaceRoot();
    const searchRoot = assertWithinWorkspace(baseDir ?? ".", root);

    if (!fs.existsSync(searchRoot) || !fs.statSync(searchRoot).isDirectory()) {
      throw new Error(`Base directory does not exist or is not a directory: ${baseDir}`);
    }

    try {
      // Use Node.js built-in fs.globSync
      const globResults = fs.globSync(pattern, {
        cwd: searchRoot,
        exclude: (entryName) => DEFAULT_IGNORE.some((ig) => entryName.includes(ig.replace("/**", ""))),
      });

      const matches: string[] = [];
      for (const matchedPath of globResults) {
        const fullMatchedPath = path.resolve(searchRoot, matchedPath);
        if (
          !fullMatchedPath.includes("/node_modules/") &&
          !fullMatchedPath.includes("/.git/") &&
          !fullMatchedPath.includes("/.eve/") &&
          !fullMatchedPath.includes("/.worktrees/")
        ) {
          matches.push(toRelativeWorkspacePath(fullMatchedPath, root));
        }
      }

      return {
        matches: matches.sort(),
        totalMatches: matches.length,
        baseDir: toRelativeWorkspacePath(searchRoot, root),
      };
    } catch {
      // Fallback simple traversal if pattern is complex
      const matches: string[] = [];
      const wildcardRegex = new RegExp(
        "^" +
          pattern
            .replace(/\./g, "\\.")
            .replace(/\*\*/g, ".*")
            .replace(/(?<!\.)\*/g, "[^/]*") +
          "$"
      );

      function walk(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (["node_modules", ".git", ".eve", "dist", ".worktrees"].includes(entry.name)) {
            continue;
          }
          const full = path.join(dir, entry.name);
          const rel = path.relative(searchRoot, full);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile()) {
            if (wildcardRegex.test(rel) || wildcardRegex.test(entry.name)) {
              matches.push(toRelativeWorkspacePath(full, root));
            }
          }
        }
      }

      walk(searchRoot);

      return {
        matches: matches.sort(),
        totalMatches: matches.length,
        baseDir: toRelativeWorkspacePath(searchRoot, root),
      };
    }
  },
});
