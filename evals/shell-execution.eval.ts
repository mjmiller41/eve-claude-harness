import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Verifies shell execution, persistent directory tracking, and background process management capabilities.",
  async test(t) {
    const turn = await t.send("Run 'echo hello from shell' using the bash tool and report the output.");
    t.succeeded();
  },
});
