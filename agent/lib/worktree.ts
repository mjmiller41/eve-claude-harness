import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getWorkspaceRoot, assertWithinWorkspace } from "./workspace.js";

export interface SubagentWorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

/**
 * Sanitizes subagent ID for safe use in branch names and directory paths.
 */
function sanitizeIdentifier(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Creates an isolated Git worktree for a worker subagent with its own dedicated branch.
 */
export function createSubagentWorktree(
  subagentId: string,
  options: {
    baseBranch?: string;
    workspaceRoot?: string;
  } = {}
): { worktreePath: string; branchName: string } {
  const root = getWorkspaceRoot(options.workspaceRoot);
  const cleanId = sanitizeIdentifier(subagentId);
  const branchName = `subagent/${cleanId}`;
  const worktreesDir = path.resolve(root, ".worktrees");
  const targetWorktreePath = path.resolve(worktreesDir, cleanId);

  assertWithinWorkspace(targetWorktreePath, root);

  // Ensure parent .worktrees dir exists
  fs.mkdirSync(worktreesDir, { recursive: true });

  const baseBranch = options.baseBranch ?? "HEAD";

  // Check if worktree directory already exists
  if (fs.existsSync(targetWorktreePath)) {
    return {
      worktreePath: targetWorktreePath,
      branchName,
    };
  }

  // Create git worktree
  const proc = spawnSync(
    "git",
    ["worktree", "add", "-b", branchName, targetWorktreePath, baseBranch],
    {
      cwd: root,
      encoding: "utf8",
    }
  );

  if (proc.status !== 0) {
    // If branch already exists, try adding worktree checking out existing branch
    const fallbackProc = spawnSync(
      "git",
      ["worktree", "add", targetWorktreePath, branchName],
      {
        cwd: root,
        encoding: "utf8",
      }
    );

    if (fallbackProc.status !== 0) {
      throw new Error(
        `Failed to create git worktree at "${targetWorktreePath}": ${fallbackProc.stderr || proc.stderr}`
      );
    }
  }

  return {
    worktreePath: targetWorktreePath,
    branchName,
  };
}

/**
 * Removes an isolated subagent worktree and optionally deletes its branch.
 */
export function removeSubagentWorktree(
  subagentId: string,
  options: {
    deleteBranch?: boolean;
    workspaceRoot?: string;
  } = {}
): { removed: boolean; branchDeleted: boolean } {
  const root = getWorkspaceRoot(options.workspaceRoot);
  const cleanId = sanitizeIdentifier(subagentId);
  const branchName = `subagent/${cleanId}`;
  const targetWorktreePath = path.resolve(root, ".worktrees", cleanId);

  let removed = false;
  let branchDeleted = false;

  if (fs.existsSync(targetWorktreePath)) {
    const removeProc = spawnSync("git", ["worktree", "remove", "--force", targetWorktreePath], {
      cwd: root,
      encoding: "utf8",
    });

    if (removeProc.status === 0) {
      removed = true;
    } else {
      // Direct directory cleanup fallback
      try {
        fs.rmSync(targetWorktreePath, { recursive: true, force: true });
        spawnSync("git", ["worktree", "prune"], { cwd: root });
        removed = true;
      } catch {
        removed = false;
      }
    }
  } else {
    removed = true;
  }

  if (options.deleteBranch) {
    const branchProc = spawnSync("git", ["branch", "-D", branchName], {
      cwd: root,
      encoding: "utf8",
    });
    branchDeleted = branchProc.status === 0;
  }

  return { removed, branchDeleted };
}

/**
 * Lists all active subagent worktrees within the repository.
 */
export function listSubagentWorktrees(workspaceRoot?: string): SubagentWorktreeInfo[] {
  const root = getWorkspaceRoot(workspaceRoot);
  const proc = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });

  if (proc.status !== 0 || !proc.stdout) {
    return [];
  }

  const entries: SubagentWorktreeInfo[] = [];
  const blocks = proc.stdout.split("\n\n");

  for (const block of blocks) {
    const lines = block.split("\n");
    let wtPath = "";
    let head = "";
    let branch = "";

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        wtPath = line.substring(9).trim();
      } else if (line.startsWith("HEAD ")) {
        head = line.substring(5).trim();
      } else if (line.startsWith("branch ")) {
        branch = line.substring(7).trim();
      }
    }

    if (wtPath.includes(".worktrees")) {
      entries.push({ path: wtPath, head, branch });
    }
  }

  return entries;
}

/**
 * Generates the git diff for changes authored in a subagent worktree compared to base.
 */
export function getWorktreeDiff(
  subagentId: string,
  options: { baseBranch?: string; workspaceRoot?: string } = {}
): string {
  const root = getWorkspaceRoot(options.workspaceRoot);
  const cleanId = sanitizeIdentifier(subagentId);
  const branchName = `subagent/${cleanId}`;
  const baseBranch = options.baseBranch ?? "main";

  const proc = spawnSync("git", ["diff", `${baseBranch}...${branchName}`], {
    cwd: root,
    encoding: "utf8",
  });

  return proc.stdout ?? "";
}
