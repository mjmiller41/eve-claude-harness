import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FileSnapshot, FileCheckpoint } from "./types.js";
import { getWorkspaceRoot, assertWithinWorkspace } from "./workspace.js";

/**
 * Calculates SHA-256 checksum of content string.
 */
export function calculateChecksum(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export class CheckpointManager {
  private checkpoints: Map<number, FileCheckpoint> = new Map();
  private pendingSnapshots: Map<string, FileSnapshot> = new Map();

  /**
   * Captures a snapshot of a file's current state on disk before any modification occurs.
   * If the file does not exist yet (i.e. new file creation), contentBefore is empty and checksum is "empty".
   */
  public captureSnapshot(filePath: string, workspaceRoot?: string): FileSnapshot {
    const root = getWorkspaceRoot(workspaceRoot);
    const resolvedPath = assertWithinWorkspace(filePath, root);
    const relPath = path.relative(root, resolvedPath);

    let contentBefore = "";
    let checksum = "empty";

    if (fs.existsSync(resolvedPath)) {
      contentBefore = fs.readFileSync(resolvedPath, "utf8");
      checksum = calculateChecksum(contentBefore);
    }

    const snapshot: FileSnapshot = {
      filePath: relPath,
      contentBefore,
      checksum,
    };

    // Stash in pending snapshots for the current active turn
    if (!this.pendingSnapshots.has(relPath)) {
      this.pendingSnapshots.set(relPath, snapshot);
    }

    return snapshot;
  }

  /**
   * Records a checkpoint for the specified turn number using pending or provided snapshots.
   */
  public recordTurnCheckpoint(
    turnNumber: number,
    description: string,
    explicitSnapshots?: FileSnapshot[]
  ): FileCheckpoint {
    const snapshotsToRecord = explicitSnapshots ?? Array.from(this.pendingSnapshots.values());

    const checkpoint: FileCheckpoint = {
      turnNumber,
      timestamp: new Date().toISOString(),
      description,
      modifiedFiles: [...snapshotsToRecord],
    };

    this.checkpoints.set(turnNumber, checkpoint);
    this.pendingSnapshots.clear();

    return checkpoint;
  }

  /**
   * Retrieves a checkpoint by turn number.
   */
  public getCheckpoint(turnNumber: number): FileCheckpoint | undefined {
    return this.checkpoints.get(turnNumber);
  }

  /**
   * Lists all recorded checkpoints in chronological turn order.
   */
  public listCheckpoints(): FileCheckpoint[] {
    return Array.from(this.checkpoints.values()).sort((a, b) => a.turnNumber - b.turnNumber);
  }

  /**
   * Restores files to their state at the target turn and removes checkpoints recorded after that turn.
   */
  public restoreToCheckpoint(
    targetTurn: number,
    workspaceRoot?: string
  ): { restoredFiles: string[]; truncatedTurns: number[] } {
    const root = getWorkspaceRoot(workspaceRoot);
    const checkpoint = this.checkpoints.get(targetTurn);

    if (!checkpoint) {
      throw new Error(`Checkpoint for turn ${targetTurn} does not exist.`);
    }

    const restoredFiles: Set<string> = new Set();
    const truncatedTurns: number[] = [];

    // Find all checkpoints that occurred at or after targetTurn to gather files that need reverting
    const turnsToRevert = Array.from(this.checkpoints.keys())
      .filter((turn) => turn >= targetTurn)
      .sort((a, b) => b - a); // reverse order

    for (const turn of turnsToRevert) {
      const cp = this.checkpoints.get(turn)!;
      for (const snapshot of cp.modifiedFiles) {
        const fullPath = assertWithinWorkspace(snapshot.filePath, root);
        if (snapshot.checksum === "empty" && snapshot.contentBefore === "") {
          // File did not exist before this turn; delete it if created
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } else {
          // Restore previous content
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, snapshot.contentBefore, "utf8");
        }
        restoredFiles.add(snapshot.filePath);
      }

      if (turn > targetTurn) {
        this.checkpoints.delete(turn);
        truncatedTurns.push(turn);
      }
    }

    this.pendingSnapshots.clear();

    return {
      restoredFiles: Array.from(restoredFiles),
      truncatedTurns,
    };
  }

  /**
   * Clears all recorded checkpoints and pending snapshots.
   */
  public clear(): void {
    this.checkpoints.clear();
    this.pendingSnapshots.clear();
  }
}

// Global default instance for the active session
export const defaultCheckpointManager = new CheckpointManager();
