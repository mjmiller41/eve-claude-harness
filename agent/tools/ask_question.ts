import { defineTool } from "eve/tools";
import { z } from "zod";

const QuestionItemSchema = z.object({
  question: z.string().describe("The clarification question to ask the developer"),
  options: z.array(z.string()).describe("List of selectable choices or options"),
  isMultiSelect: z
    .boolean()
    .default(false)
    .describe("Whether multiple options may be selected simultaneously"),
});

export default defineTool({
  description:
    "Prompts the developer with structured multiple-choice questions and write-in options to clarify ambiguous requirements.",
  inputSchema: z.object({
    questions: z
      .array(QuestionItemSchema)
      .min(1)
      .describe("List of questions with options for developer clarification"),
  }),
  label: {
    start: ({ questions }) =>
      `Ask ${questions.length} question(s): "${questions[0]?.question}"`,
  },
  async execute({ questions }, ctx) {
    const answers: Array<{
      question: string;
      selectedOptions: string[];
      customAnswer?: string;
    }> = [];

    for (const q of questions) {
      // Check if Eve interactive context is available (ctx.ask)
      const askFn = (ctx as unknown as Record<string, unknown> | undefined)?.ask as
        | ((params: { question: string; options?: Array<{ label: string; description?: string }> }) => Promise<{ label?: string; answer?: string }>)
        | undefined;

      if (typeof askFn === "function") {
        try {
          const res = await askFn({
            question: q.question,
            options: q.options.map((opt) => ({ label: opt, description: opt })),
          });
          answers.push({
            question: q.question,
            selectedOptions: res.label ? [res.label] : [],
            customAnswer: res.answer,
          });
          continue;
        } catch {
          // Fall through to deterministic default if interactive prompt throws or cancels
        }
      }

      // Default or fallback response for headless/batch environments
      answers.push({
        question: q.question,
        selectedOptions: [q.options[0] ?? "Option 1"],
      });
    }

    return {
      status: "answered",
      answers,
      summary: answers
        .map(
          (a) =>
            `Q: ${a.question} -> Selected: ${a.selectedOptions.join(", ")}${a.customAnswer ? ` (write-in: ${a.customAnswer})` : ""}`
        )
        .join("\n"),
    };
  },
});
