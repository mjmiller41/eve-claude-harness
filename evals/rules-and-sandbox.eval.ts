import { defineEval } from "eve/evals";
import { parseRuleContent, matchesGlob, matchRulesForFiles } from "../agent/lib/rules.js";
import { environment } from "../agent/sandbox.js";

export default defineEval({
  description:
    "Verifies scoped instruction rules resolution based on touched file path patterns and execution sandbox environment initialization.",
  async test(t) {
    // 1. Verify glob pattern matching logic
    if (!matchesGlob("src/api/users.ts", "src/**/*.ts")) {
      throw new Error("Glob matching failed for src/**/*.ts against src/api/users.ts");
    }
    if (matchesGlob("docs/readme.md", "src/**/*.ts")) {
      throw new Error("Glob matching falsely matched docs/readme.md against src/**/*.ts");
    }

    // 2. Verify rule parsing and path scoping
    const sampleRuleRaw = `---
description: "TypeScript and API guidelines"
paths:
  - "src/**/*.ts"
  - "agent/**/*.ts"
---
# TypeScript API Standards
Always validate payloads with Zod schemas.
`;
    const parsedRule = parseRuleContent(sampleRuleRaw, "api-standards.md");
    if (parsedRule.id !== "api-standards") {
      throw new Error(`Expected rule id 'api-standards', got '${parsedRule.id}'`);
    }

    const matchResult = matchRulesForFiles([parsedRule], ["src/routes/auth.ts"]);
    if (matchResult.matchedRules.length !== 1) {
      throw new Error("Expected parsed rule to match src/routes/auth.ts");
    }
    if (!matchResult.formattedInstructions.includes("TypeScript API Standards")) {
      throw new Error("Formatted active rules prompt missing expected rule content");
    }

    // 3. Verify sandbox environment export
    if (!environment || typeof environment.open !== "function") {
      throw new Error("Default sandbox environment is missing required open() method");
    }

    // 4. Test agent interaction
    await t.send(
      "Explain how scoped rules under .claude/rules/*.md conditionally activate based on touched file path patterns, and confirm our execution sandbox boundaries."
    );

    t.succeeded();
  },
});
