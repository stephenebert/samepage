import { env } from "cloudflare:workers";
import { studioModelConfig } from "./studio-model";

export function configuredStudioModel() {
  // A key alone never authorizes studio model requests. Keep opt-in server-side.
  return studioModelConfig(env as { MODEL_API_KEY?: string; SAMEPAGE_MODEL?: string; SAMEPAGE_STUDIO_META_ENABLED?: string; SAMEPAGE_STUDIO_PROTOCOL?: string; SAMEPAGE_STUDIO_REASONING_EFFORT?: string; SAMEPAGE_STUDIO_REUSE_UNCHANGED?: string });
}
