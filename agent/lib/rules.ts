import fs from "node:fs";
import path from "node:path";
import type { ScopedRule, ScopedRuleMatchResult } from "./types.js";
import { getWorkspaceRoot, toRelativeWorkspacePath } from "./workspace.js";

/**
 * Converts a glob pattern into a regular expression for path matching.
 */
export function globToRegex(pattern: string): RegExp {
  let normalized = pattern.trim().replace(/\\/g, "/");
  if (normalized.startsWith("./")) {
    normalized = normalized.substring(2);
  }

  let regexStr = "";
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i];
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        if (normalized[i + 2] === "/") {
          regexStr += "(?:.*/)?";
          i += 3;
          continue;
        } else {
          regexStr += ".*";
          i += 2;
          continue;
        }
      } else {
        regexStr += "[^/]*";
        i += 1;
        continue;
      }
    } else if (c === "?") {
      regexStr += "[^/]";
      i += 1;
      continue;
    } else if (["[", "]", "(", ")", "{", "}", "+", ".", "^", "$", "|"].includes(c)) {
      regexStr += `\\${c}`;
      i += 1;
      continue;
    } else {
      regexStr += c;
      i += 1;
    }
  }

  return new RegExp(`^${regexStr}$`, "i");
}

/**
 * Checks whether a given relative file path matches a glob pattern.
 */
export function matchesGlob(filePath: string, globPattern: string): boolean {
  const normFile = filePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  const normPattern = globPattern.trim().replace(/\\/g, "/").replace(/^\.\//, "");

  if (normPattern === "*" || normPattern === "**" || normPattern === "**/*") {
    return true;
  }

  const regex = globToRegex(normPattern);
  return regex.test(normFile);
}

/**
 * Parses markdown content with optional YAML frontmatter into a ScopedRule.
 */
export function parseRuleContent(rawContent: string, filePath: string = "unnamed.md"): ScopedRule {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = rawContent.match(frontmatterRegex);

  const baseId = path.basename(filePath, path.extname(filePath));
  let description: string | undefined;
  const paths: string[] = [];
  let content = rawContent.trim();

  if (match) {
    const frontmatterBlock = match[1];
    content = match[2].trim();

    // Parse simple YAML fields: description / paths
    const lines = frontmatterBlock.split("\n");
    let inPathsList = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      if (line.startsWith("paths:")) {
        inPathsList = true;
        const remainder = line.substring(6).trim();
        if (remainder) {
          // Inline array or single string: paths: ["**/*.ts"] or paths: "**/*.ts"
          if (remainder.startsWith("[") && remainder.endsWith("]")) {
            const items = remainder
              .slice(1, -1)
              .split(",")
              .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
              .filter(Boolean);
            paths.push(...items);
          } else {
            paths.push(remainder.replace(/^['"]|['"]$/g, ""));
          }
          inPathsList = false;
        }
        continue;
      }

      if (inPathsList && line.startsWith("- ")) {
        const item = line.substring(2).trim().replace(/^['"]|['"]$/g, "");
        if (item) {
          paths.push(item);
        }
        continue;
      }

      inPathsList = false;

      if (line.startsWith("description:")) {
        description = line.substring(12).trim().replace(/^['"]|['"]$/g, "");
      } else if (line.startsWith("title:")) {
        description = line.substring(6).trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }

  return {
    id: baseId,
    filePath,
    description,
    paths: paths.length > 0 ? paths : ["**/*"],
    content,
  };
}

/**
 * Loads all scoped rules from a directory.
 */
export function loadRulesFromDirectory(dirPath: string): ScopedRule[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    return [];
  }

  const rules: ScopedRule[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        const rule = parseRuleContent(content, fullPath);
        rules.push(rule);
      } catch {
        // Skip unreadable files
      }
    }
  }

  return rules;
}

/**
 * Discovers and loads all scoped rules across standard project rule locations:
 * - `.claude/rules/*.md`
 * - `agent/rules/*.md`
 */
export function loadAllRules(workspaceRoot?: string): ScopedRule[] {
  const root = getWorkspaceRoot(workspaceRoot);
  const candidateDirs = [
    path.resolve(root, ".claude", "rules"),
    path.resolve(root, "agent", "rules"),
  ];

  const rules: ScopedRule[] = [];
  for (const dir of candidateDirs) {
    rules.push(...loadRulesFromDirectory(dir));
  }

  return rules;
}

/**
 * Matches a set of rules against touched file paths.
 */
export function matchRulesForFiles(
  rules: ScopedRule[],
  touchedFiles: string[],
  workspaceRoot?: string
): ScopedRuleMatchResult {
  const root = getWorkspaceRoot(workspaceRoot);
  const normalizedTouched = touchedFiles.map((f) => {
    try {
      return toRelativeWorkspacePath(f, root);
    } catch {
      return f.replace(/\\/g, "/").replace(/^\.\//, "");
    }
  });

  const matchedRules: ScopedRule[] = [];
  const seenRuleIds = new Set<string>();

  for (const rule of rules) {
    if (seenRuleIds.has(rule.id)) continue;

    // Check if any pattern in rule.paths matches any touched file
    const isMatch = rule.paths.some((pattern) =>
      normalizedTouched.some((file) => matchesGlob(file, pattern))
    );

    if (isMatch) {
      matchedRules.push(rule);
      seenRuleIds.add(rule.id);
    }
  }

  const formattedInstructions = formatActiveRulesPrompt(matchedRules);

  return {
    matchedRules,
    touchedFiles: normalizedTouched,
    formattedInstructions,
  };
}

/**
 * Formats a list of active rules into markdown instructions suitable for injection into prompt context.
 */
export function formatActiveRulesPrompt(matchedRules: ScopedRule[]): string {
  if (matchedRules.length === 0) {
    return "";
  }

  const ruleSections = matchedRules.map((r) => {
    const header = r.description ? `#### Rule: ${r.id} (${r.description})` : `#### Rule: ${r.id}`;
    const patternList = r.paths.map((p) => `\`${p}\``).join(", ");
    return `${header}\n*Applies to*: ${patternList}\n\n${r.content}`;
  });

  return [
    "### Active Scoped Rules Guidelines",
    "The following scoped project rules match the files touched in this session. Follow these guidelines strictly:",
    "",
    ...ruleSections,
  ].join("\n");
}

/**
 * Resolves all active scoped rules for a given list of touched files.
 */
export function resolveActiveRules(
  touchedFiles: string[],
  options: { rulesDirs?: string[]; workspaceRoot?: string } = {}
): ScopedRuleMatchResult {
  const root = getWorkspaceRoot(options.workspaceRoot);
  const rules: ScopedRule[] = [];

  if (options.rulesDirs && options.rulesDirs.length > 0) {
    for (const d of options.rulesDirs) {
      const fullDir = path.isAbsolute(d) ? d : path.resolve(root, d);
      rules.push(...loadRulesFromDirectory(fullDir));
    }
  } else {
    rules.push(...loadAllRules(root));
  }

  return matchRulesForFiles(rules, touchedFiles, root);
}
