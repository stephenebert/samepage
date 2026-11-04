import { RoomError } from "./room";

export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function errorResponse(error: unknown): Response {
  if (error instanceof RoomError) return json({ error: error.message, code: error.code }, error.status);
  console.error("SamePage request failed", error instanceof Error ? error.message : "Unknown error");
  if (error instanceof Error && error.message.startsWith("D1_ERROR:")) return json({ error: "Workspace storage is unavailable. Please try again later.", code: "STORAGE_UNAVAILABLE" }, 503);
  return json({ error: "The room could not be updated. Please try again.", code: "SERVER_ERROR" }, 500);
}
export async function readAction(request: Request): Promise<unknown> {
  // This collaboration demo is hosted owner-private behind Sites authentication.
  // Personas are explicitly simulated, not authorization identities. Keep this
  // origin check in addition to the platform boundary; do not make it public.
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new RoomError("This action must come from the SamePage app.", "ORIGIN", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new RoomError("Cross-site actions are not allowed.", "ORIGIN", 403);
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new RoomError("Send application/json.", "CONTENT_TYPE", 415);
  if (Number(request.headers.get("content-length")) > 100000) throw new RoomError("Request is too large.", "LIMIT", 413);
  const raw = await request.text();
  if (raw.length > 100000) throw new RoomError("Request is too large.", "LIMIT", 413);
  try { return JSON.parse(raw); } catch { throw new RoomError("Invalid JSON request.", "INVALID_JSON"); }
}
export function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RoomError("Expected an object.");
  return value as Record<string, unknown>;
}
