import path from "node:path";
import fs from "node:fs";

export class WorkspaceBoundaryError extends Error {
  constructor(targetPath: string, workspaceRoot: string) {
    super(
      `Access denied: path "${targetPath}" resolves outside repository workspace root "${workspaceRoot}".`
    );
    this.name = "WorkspaceBoundaryError";
  }
}

/**
 * Returns the resolved canonical workspace root directory.
 */
export function getWorkspaceRoot(customRoot?: string): string {
  const root = customRoot ?? process.cwd();
  return path.resolve(root);
}

/**
 * Determines whether a target path is safely contained within the workspace root.
 */
export function isWithinWorkspace(targetPath: string, workspaceRoot?: string): boolean {
  const root = getWorkspaceRoot(workspaceRoot);
  const resolvedTarget = path.resolve(root, targetPath);
  const relative = path.relative(root, resolvedTarget);

  // If relative path starts with '..' or is absolute, it escapes the workspace root
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }

  // Also check if realpath escapes root if target already exists
  try {
    if (fs.existsSync(resolvedTarget)) {
      const realTarget = fs.realpathSync(resolvedTarget);
      const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
      const realRelative = path.relative(realRoot, realTarget);
      if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
        return false;
      }
    }
  } catch {
    // If realpath fails (e.g. permissions or dangling links), rely on path resolution check
  }

  return true;
}

/**
 * Resolves a target path against the workspace root and asserts that it does not escape.
 * Throws WorkspaceBoundaryError if containment is violated.
 */
export function assertWithinWorkspace(targetPath: string, workspaceRoot?: string): string {
  const root = getWorkspaceRoot(workspaceRoot);
  const resolvedTarget = path.resolve(root, targetPath);

  if (!isWithinWorkspace(resolvedTarget, root)) {
    throw new WorkspaceBoundaryError(targetPath, root);
  }

  return resolvedTarget;
}

/**
 * Converts a target path to a clean normalized relative path from workspace root.
 */
export function toRelativeWorkspacePath(targetPath: string, workspaceRoot?: string): string {
  const root = getWorkspaceRoot(workspaceRoot);
  const resolvedTarget = assertWithinWorkspace(targetPath, root);
  const relative = path.relative(root, resolvedTarget);
  return relative === "" ? "." : relative;
}
