import { env } from "cloudflare:workers";
import type { Room } from "./types";
import { RoomError } from "./room";

function database(): D1Database {
  if (!env.DB) throw new RoomError("Room storage is unavailable.", "STORAGE_UNAVAILABLE", 503);
  return env.DB;
}
export async function insertRoom(room: Room): Promise<void> {
  await database().prepare("INSERT INTO samepage_rooms (id, revision, state, updated_at) VALUES (?, ?, ?, ?)")
    .bind(room.id, room.revision, JSON.stringify(room), room.updatedAt).run();
}
export async function getRoom(id: string): Promise<Room> {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new RoomError("Room not found.", "NOT_FOUND", 404);
  const row = await database().prepare("SELECT state FROM samepage_rooms WHERE id = ?").bind(id).first<{ state: string }>();
  if (!row) throw new RoomError("Room not found.", "NOT_FOUND", 404);
  return JSON.parse(row.state) as Room;
}
export async function mutateRoom(id: string, update: (room: Room) => Room): Promise<Room> {
  // One compare-and-swap statement commits the entire validated document. Retrying
  // reruns the pure reducer against fresh state, so concurrent edits cannot get lost.
  for (let attempt = 0; attempt < 6; attempt++) {
    const before = await getRoom(id), next = update(before);
    if (next === before) return before;
    const state = JSON.stringify(next);
    if (state.length > 900000) throw new RoomError("This test room is full. Start a new room.", "LIMIT", 429);
    if (next.revision !== before.revision + 1) throw new Error("Invalid room revision transition");
    const result = await database().prepare("UPDATE samepage_rooms SET revision = ?, state = ?, updated_at = ? WHERE id = ? AND revision = ?")
      .bind(next.revision, state, next.updatedAt, id, before.revision).run();
    if (result.meta.changes === 1) return next;
  }
  throw new RoomError("The room changed repeatedly. Please try again.", "RETRY", 409);
}
