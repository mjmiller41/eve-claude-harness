import { defineTool } from "eve/tools";
import { z } from "zod";
import { defaultCheckpointManager } from "../lib/checkpoint-manager.js";

export default defineTool({
  description:
    "Restores workspace files to their recorded state at a previous turn checkpoint, undoing modifications made in subsequent turns.",
  inputSchema: z.object({
    targetTurn: z
      .number()
      .int()
      .min(0)
      .describe("Historical turn number to restore workspace files to"),
    dryRun: z
      .boolean()
      .default(false)
      .describe("Whether to preview files that would be restored without modifying disk"),
  }),
  label: {
    start: ({ targetTurn, dryRun }) =>
      `${dryRun ? "Preview rewind" : "Rewind"} workspace to turn ${targetTurn}`,
  },
  async execute({ targetTurn, dryRun = false }) {
    const checkpoint = defaultCheckpointManager.getCheckpoint(targetTurn);

    if (!checkpoint) {
      const allCheckpoints = defaultCheckpointManager.listCheckpoints();
      const availableTurns = allCheckpoints.map((cp) => cp.turnNumber);
      throw new Error(
        `Checkpoint for turn ${targetTurn} does not exist. Available turn checkpoints: [${availableTurns.join(", ")}].`
      );
    }

    if (dryRun) {
      const allCheckpoints = defaultCheckpointManager.listCheckpoints();
      const affectedTurns = allCheckpoints.filter((cp) => cp.turnNumber >= targetTurn);
      const affectedFiles = new Set<string>();

      for (const cp of affectedTurns) {
        for (const snap of cp.modifiedFiles) {
          affectedFiles.add(snap.filePath);
        }
      }

      return {
        targetTurn,
        dryRun: true,
        restoredFiles: Array.from(affectedFiles),
        affectedTurnsCount: affectedTurns.length,
        message: `Dry run: rewinding to turn ${targetTurn} would revert ${affectedFiles.size} file(s) across ${affectedTurns.length} turn(s).`,
      };
    }

    const { restoredFiles, truncatedTurns } = defaultCheckpointManager.restoreToCheckpoint(targetTurn);

    return {
      targetTurn,
      dryRun: false,
      restoredFiles,
      truncatedTurns,
      message: `Successfully rewound workspace to turn ${targetTurn}. Reverted ${restoredFiles.length} file(s) and pruned ${truncatedTurns.length} later checkpoint(s).`,
    };
  },
});
