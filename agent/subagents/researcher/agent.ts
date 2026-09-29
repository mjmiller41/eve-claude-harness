import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Specialized read-only codebase explorer and technical documentation researcher. Investigates symbols, code references, dependencies, and docs without modifying workspace files.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "low",
});
