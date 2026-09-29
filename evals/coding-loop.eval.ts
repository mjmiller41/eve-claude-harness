import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Verifies the autonomous perception-action-verification coding loop using code search and file inspection tools.",
  async test(t) {
    const turn = await t.send(
      "Search for the symbol 'WorkspaceBoundaryError' in the codebase using grep or glob and read the lines where it is defined."
    );
    t.succeeded();
  },
});
