declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MODEL_API_KEY?: string;
    SAMEPAGE_MODEL?: string;
    SAMEPAGE_STUDIO_META_ENABLED?: string;
    SAMEPAGE_STUDIO_PROTOCOL?: "compact-v2" | "full-v1";
    SAMEPAGE_STUDIO_REASONING_EFFORT?: "low" | "medium";
    SAMEPAGE_STUDIO_REUSE_UNCHANGED?: string;
  }
}
