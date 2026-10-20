import { createConsequencesRoom } from "@/lib/consequences";
import { insertConsequencesRoom } from "@/lib/consequences-store";
import { RoomError } from "@/lib/room";
import { errorResponse, json, plainObject, readAction } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = plainObject(await readAction(request));
    if (Object.keys(body).length) throw new RoomError("Room creation takes an empty object.");
    const room = createConsequencesRoom(crypto.randomUUID(), new Date().toISOString());
    await insertConsequencesRoom(room);
    return json({ room }, 201);
  } catch (error) { return errorResponse(error); }
}
