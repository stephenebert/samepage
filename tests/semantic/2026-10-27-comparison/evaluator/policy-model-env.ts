import { env } from "cloudflare:workers";
import { policyModelConfig } from "./policy-model";

export function configuredPolicyModel() {
  // Read only server bindings. Never expose the key through a NEXT_PUBLIC value.
  return policyModelConfig(env as { MODEL_API_KEY?: string; SAMEPAGE_MODEL?: string });
}
