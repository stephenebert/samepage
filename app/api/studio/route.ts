import { createStudioRoom, createStudioDemoRoom } from "@/lib/studio";
import { studioDemoFixture } from "@/lib/studio-demo";
import { insertStudioRoom } from "@/lib/studio-store";
import { RoomError } from "@/lib/room";
import { errorResponse, json, plainObject, readAction } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = plainObject(await readAction(request));
    const demo = Object.keys(body).length === 1 && body.demo === true;
    if (Object.keys(body).length && !demo) throw new RoomError("Use an empty object or {demo:true}.");
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const room = demo ? createStudioDemoRoom(id, now, studioDemoFixture) : createStudioRoom(id, now);
    await insertStudioRoom(room); return json({ room }, 201);
  } catch (error) { return errorResponse(error); }
}
