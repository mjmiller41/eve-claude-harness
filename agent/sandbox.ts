import { DefaultSandbox, defineSandbox } from "eve/sandbox";

/**
 * Execution sandbox environment configuration for untrusted code execution and shell boundaries.
 * Enforces Eve's canonical containerized/isolated sandbox provider (Vercel microVMs / Docker / microsandbox).
 */
export const environment = DefaultSandbox.environment();

export default defineSandbox(() => environment.open());
