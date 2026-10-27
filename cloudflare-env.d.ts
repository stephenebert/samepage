declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MODEL_API_KEY?: string;
    SAMEPAGE_MODEL?: string;
    SAMEPAGE_STUDIO_META_ENABLED?: string;
  }
}
