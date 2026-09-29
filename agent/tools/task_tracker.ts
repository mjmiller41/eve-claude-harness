import { defineTool } from "eve/tools";
import { z } from "zod";
import type { ChecklistItem } from "../lib/types.js";

// Session-level memory store for task checklist items
const checklistStore: Map<string, ChecklistItem> = new Map();

export default defineTool({
  description:
    "Manages an observable, multi-step task checklist with status progression (init, list, get, update).",
  inputSchema: z.object({
    action: z
      .enum(["init", "list", "get", "update"])
      .describe("Action to perform on the task checklist"),
    items: z
      .array(
        z.object({
          id: z.string().describe("Unique identifier for checklist item (e.g. 'CHK-001')"),
          title: z.string().describe("Succinct title/description of the task"),
        })
      )
      .optional()
      .describe("List of items to initialize (required for action 'init')"),
    itemId: z
      .string()
      .optional()
      .describe("Target item ID (required for 'get' and 'update')"),
    status: z
      .enum(["pending", "in_progress", "completed", "skipped"])
      .optional()
      .describe("New status for the checklist item (required for 'update')"),
    skipReason: z
      .string()
      .optional()
      .describe("Reason for skipping this checklist item (recommended if status is 'skipped')"),
    outcomeSummary: z
      .string()
      .optional()
      .describe("Summary of results or artifacts generated upon completing this item"),
  }),
  label: {
    start: ({ action, itemId, status }) =>
      `${action} task checklist${itemId ? ` for ${itemId} (${status ?? ""})` : ""}`,
  },
  async execute({ action, items, itemId, status, skipReason, outcomeSummary }) {
    if (action === "init") {
      if (!items || items.length === 0) {
        throw new Error("action 'init' requires a non-empty array of items.");
      }
      checklistStore.clear();
      items.forEach((item, index) => {
        checklistStore.set(item.id, {
          id: item.id,
          taskId: "session-task",
          order: index + 1,
          title: item.title,
          status: "pending",
        });
      });

      const initializedItems = Array.from(checklistStore.values()).sort(
        (a, b) => a.order - b.order
      );

      return {
        action: "init",
        totalItems: initializedItems.length,
        items: initializedItems,
        message: `Task checklist initialized with ${initializedItems.length} items.`,
      };
    }

    if (action === "list") {
      const allItems = Array.from(checklistStore.values()).sort((a, b) => a.order - b.order);
      const completedCount = allItems.filter((i) => i.status === "completed").length;
      const skippedCount = allItems.filter((i) => i.status === "skipped").length;
      const inProgressCount = allItems.filter((i) => i.status === "in_progress").length;
      const pendingCount = allItems.filter((i) => i.status === "pending").length;

      const progressPercent =
        allItems.length > 0
          ? Math.round(((completedCount + skippedCount) / allItems.length) * 100)
          : 0;

      return {
        action: "list",
        totalItems: allItems.length,
        completedCount,
        skippedCount,
        inProgressCount,
        pendingCount,
        progressPercent,
        items: allItems,
      };
    }

    if (!itemId) {
      throw new Error(`action '${action}' requires itemId.`);
    }

    const item = checklistStore.get(itemId);
    if (!item) {
      throw new Error(`Checklist item with ID '${itemId}' not found.`);
    }

    if (action === "get") {
      return {
        action: "get",
        item,
      };
    }

    if (action === "update") {
      if (!status) {
        throw new Error("action 'update' requires status parameter.");
      }

      item.status = status;
      if (skipReason !== undefined) {
        item.skipReason = skipReason;
      }
      if (outcomeSummary !== undefined) {
        item.outcomeSummary = outcomeSummary;
      }

      checklistStore.set(itemId, item);

      return {
        action: "update",
        item,
        message: `Item '${itemId}' updated to status '${status}'.`,
      };
    }

    throw new Error(`Unsupported action: ${action}`);
  },
});
