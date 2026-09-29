import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Verifies observable multi-step task checklist tracking and structured findings reporting.",
  async test(t) {
    const turn = await t.send(
      "Initialize a 3-step checklist to review the codebase security, start the first step, and report any findings."
    );
    t.succeeded();
  },
});
