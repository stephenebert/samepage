import { createRoom, RoomError } from "@/lib/room";
import { insertRoom } from "@/lib/store";
import { errorResponse, json, plainObject, readAction } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = plainObject(await readAction(request));
    if (Object.keys(body).length) throw new RoomError("Room creation takes an empty object.");
    const room = createRoom(crypto.randomUUID(), new Date().toISOString());
    await insertRoom(room);
    return json({ room }, 201);
  } catch (error) { return errorResponse(error); }
}
