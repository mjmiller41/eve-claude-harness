import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Verifies specialized subagent delegation to researcher and advisor agents, and git worktree isolation.",
  async test(t) {
    const turn = await t.send(
      "Delegate a read-only search of our workspace security tools to the researcher subagent and ask the advisor subagent for guidance on our permission policies."
    );
    t.succeeded();
  },
});
