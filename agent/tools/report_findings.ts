import { defineTool } from "eve/tools";
import { z } from "zod";
import type { CodeFinding, FindingSeverity, FindingCategory } from "../lib/types.js";
import { toRelativeWorkspacePath, getWorkspaceRoot } from "../lib/workspace.js";

const CodeFindingSchema = z.object({
  id: z.string().optional().describe("Unique finding identifier (e.g. 'SEC-001', 'BUG-002')"),
  filePath: z.string().describe("Target file path relative to workspace root"),
  startLine: z.number().int().min(1).describe("1-based start line of code snippet"),
  endLine: z.number().int().min(1).describe("1-based end line of code snippet"),
  severity: z
    .enum(["critical", "high", "medium", "low", "info"])
    .describe("Severity impact level"),
  category: z
    .enum(["security", "bug", "performance", "style", "architecture"])
    .describe("Finding category"),
  title: z.string().describe("Succinct summary of the identified issue"),
  description: z.string().describe("Detailed analysis of why this is an issue"),
  failureScenario: z
    .string()
    .optional()
    .describe("Concrete conditions or attack vectors under which this failure occurs"),
  suggestedFix: z
    .string()
    .optional()
    .describe("Recommended code modification or remediation steps"),
});

const findingsStore: CodeFinding[] = [];

export default defineTool({
  description:
    "Records and formats structured code audit, security, performance, and bug findings with line ranges and remediation advice.",
  inputSchema: z.object({
    findings: z
      .array(CodeFindingSchema)
      .min(1)
      .describe("Array of structured diagnostic findings to report"),
    summary: z
      .string()
      .optional()
      .describe("High-level executive summary of the review or audit"),
    clearPrevious: z
      .boolean()
      .default(false)
      .describe("Whether to clear previously reported findings before adding these"),
  }),
  label: {
    start: ({ findings }) => `Report ${findings.length} code finding(s)`,
  },
  async execute({ findings, summary, clearPrevious = false }) {
    const root = getWorkspaceRoot();

    if (clearPrevious) {
      findingsStore.length = 0;
    }

    const processedFindings: CodeFinding[] = findings.map((f, idx) => {
      let relPath = f.filePath;
      try {
        relPath = toRelativeWorkspacePath(f.filePath, root);
      } catch {
        // Fallback to path as-is if unresolvable
      }

      const finding: CodeFinding = {
        id: f.id ?? `FIND-${String(findingsStore.length + idx + 1).padStart(3, "0")}`,
        filePath: relPath,
        startLine: f.startLine,
        endLine: f.endLine,
        severity: f.severity as FindingSeverity,
        category: f.category as FindingCategory,
        title: f.title,
        description: f.description,
        failureScenario: f.failureScenario,
        suggestedFix: f.suggestedFix,
      };

      return finding;
    });

    findingsStore.push(...processedFindings);

    const countsBySeverity: Record<FindingSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const f of findingsStore) {
      countsBySeverity[f.severity] = (countsBySeverity[f.severity] ?? 0) + 1;
    }

    const markdownRows = processedFindings.map(
      (f) =>
        `| **${f.id}** | \`${f.severity.toUpperCase()}\` | ${f.category} | \`${f.filePath}:${f.startLine}-${f.endLine}\` | ${f.title} |`
    );

    const formattedReport = [
      `### Code Review & Diagnostic Findings Report`,
      summary ? `\n> ${summary}\n` : "",
      `| ID | Severity | Category | Location | Title |`,
      `|---|---|---|---|---|`,
      ...markdownRows,
      "",
      `**Summary Statistics**: Critical: ${countsBySeverity.critical} | High: ${countsBySeverity.high} | Medium: ${countsBySeverity.medium} | Low: ${countsBySeverity.low} | Info: ${countsBySeverity.info}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      totalRecordedFindings: findingsStore.length,
      newFindingsCount: processedFindings.length,
      countsBySeverity,
      findings: processedFindings,
      formattedReport,
    };
  },
});
