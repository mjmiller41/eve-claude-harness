import { defineAgent } from "eve";
import { auto } from "eve/models";

export default defineAgent({
  reasoning: "medium",
  compaction: {
    thresholdPercent: 0.75,
  },
  model: auto({
    options: {
      "opus_5.5": {
        model: "anthropic/claude-opus-5.5",
        description:
          "Best for frontier autonomous coding, long-running agentic tasks, complex reasoning, and high-stakes knowledge work requiring the highest intelligence and token efficiency.",
        reasoning: "high",
      },
      "opus_5.5_fast": {
        model: "anthropic/claude-opus-5.5-fast",
        description:
          "Best for latency-critical agentic workflows and interactive chat where frontier Opus 5.5 reasoning is needed at accelerated generation speeds (~300 tokens/sec).",
        reasoning: "low",
      },
      "fable_5.1": {
        model: "anthropic/claude-fable-5.1",
        description:
          "Best for unattended autonomous agents, deep research, and long-running workflows that demand rigorous instruction-following and safety over multi-hour runs.",
        reasoning: "high",
      },
      "opus_5": {
        model: "anthropic/claude-opus-5",
        description:
          "Best for complex software architecture, multi-step problem solving, and professional analysis where frontier reasoning across 1M context is required.",
        reasoning: "high",
      },
      "opus_5_fast": {
        model: "anthropic/claude-opus-5-fast",
        description:
          "Best for demanding reasoning and interactive coding assistants that need Opus 5-level capability delivered with high-throughput streaming.",
        reasoning: "low",
      },
      "fable_5": {
        model: "anthropic/claude-fable-5",
        description:
          "Best for complex, asynchronous workflow orchestration and safety-critical agentic tasks requiring Mythos-class reliability.",
        reasoning: "high",
      },
      "sonnet_5": {
        model: "anthropic/claude-sonnet-5",
        description:
          "The optimal default for everyday production workloads, agentic coding, and enterprise applications, balancing near-frontier intelligence with low cost and fast throughput.",
        reasoning: "low",
      },
      "opus_4.8": {
        model: "anthropic/claude-opus-4.8",
        description:
          "Best for enterprise-grade coding, large codebase refactoring, and multi-step agentic workflows where stable, battle-tested Opus 4.8 reliability is needed.",
        reasoning: "high",
      },
      "opus_4.8_fast": {
        model: "anthropic/claude-opus-4.8-fast",
        description:
          "Best for multi-step software development and analytical tasks that require Opus 4.8 reasoning combined with accelerated response throughput.",
        reasoning: "low",
      },
      "opus_4.7": {
        model: "anthropic/claude-opus-4.7",
        description:
          "Best for multi-step reasoning, complex document synthesis, and enterprise agent workflows tailored to the Opus 4.7 architecture.",
        reasoning: "high",
      },
      "sonnet_4.6": {
        model: "anthropic/claude-sonnet-4.6",
        description:
          "Best for cost-effective full-stack coding, extensive codebase navigation, and computer-use automations at scale.",
        reasoning: "medium",
      },
      "opus_4.6": {
        model: "anthropic/claude-opus-4.6",
        description:
          "Best for deep codebase audits, complex software debugging, and production-grade technical drafting across large repositories.",
        reasoning: "high",
      },
      "opus_4.5": {
        model: "anthropic/claude-opus-4.5",
        description:
          "Best for complex analytical problem-solving and computer-use tasks requiring established Opus 4.5 prompt behaviors within 200k context.",
        reasoning: "medium",
      },
      "haiku_4.5": {
        model: "anthropic/claude-haiku-4.5",
        description:
          "Best for high-volume sub-agents, quick data extraction, classification, and cost-sensitive applications requiring near-instant response times at minimal cost.",
        reasoning: "low",
      },
      "sonnet_4.5": {
        model: "anthropic/claude-sonnet-4.5",
        description:
          "Best for general-purpose conversational AI, structured data extraction, and content generation requiring a large 1M context window at budget-friendly rates.",
        reasoning: "medium",
      },
    },
  }),
});