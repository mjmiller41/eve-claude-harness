import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Senior software architectural advisor powered by Claude Opus 5.5 with high reasoning. Consulted on complex architectural choices, tradeoffs, schema design, and difficult debugging dilemmas.",
  model: "anthropic/claude-opus-5.5",
  reasoning: "high",
});
