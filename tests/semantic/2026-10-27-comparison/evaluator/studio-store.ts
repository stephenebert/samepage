import { env } from "cloudflare:workers";
import { RoomError } from "./room";
import type { StudioRoom } from "./studio-types";
function database(): D1Database {
  if (!env.DB) throw new RoomError("Room storage is unavailable.", "STORAGE_UNAVAILABLE", 503);
  return env.DB;
}
export async function insertStudioRoom(room: StudioRoom): Promise<void> {
  await database().prepare("INSERT INTO samepage_rooms (id, revision, state, updated_at) VALUES (?, ?, ?, ?)")
    .bind(room.id, room.revision, JSON.stringify(room), room.updatedAt).run();
}
export async function getStudioRoom(id: string): Promise<StudioRoom> {
  if (!/^studio-[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new RoomError("Studio room not found.", "NOT_FOUND", 404);
  const row = await database().prepare("SELECT state FROM samepage_rooms WHERE id = ?").bind(id).first<{ state: string }>();
  if (!row) throw new RoomError("Studio room not found.", "NOT_FOUND", 404);
  const room = JSON.parse(row.state) as StudioRoom;
  if (room.kind !== "samepage-studio-v1" || room.id !== id) throw new RoomError("Studio room not found.", "NOT_FOUND", 404);
  return room;
}
export async function mutateStudioRoom(id: string, update: (room: StudioRoom) => StudioRoom): Promise<StudioRoom> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const before = await getStudioRoom(id), next = update(before);
    if (next === before) return before;
    const state = JSON.stringify(next);
    if (state.length > 900000) throw new RoomError("This test room is full. Start a new room.", "LIMIT", 429);
    if (next.revision !== before.revision + 1) throw new Error("Invalid studio revision transition");
    const result = await database().prepare("UPDATE samepage_rooms SET revision = ?, state = ?, updated_at = ? WHERE id = ? AND revision = ?")
      .bind(next.revision, state, next.updatedAt, id, before.revision).run();
    if (result.meta.changes === 1) return next;
  }
  throw new RoomError("The room changed repeatedly. Please try again.", "RETRY", 409);
}
