import { createStudioRoom, createStudioDemoRoom, createStudioSimulationRoom } from "@/lib/studio";
import { studioDemoFixture } from "@/lib/studio-demo";
import { insertStudioRoom } from "@/lib/studio-store";
import { RoomError } from "@/lib/room";
import { errorResponse, json, plainObject, readAction } from "@/lib/http";
import { configuredStudioModel } from "@/lib/studio-model-env";
import { publicStudioModel } from "@/lib/studio-model";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = plainObject(await readAction(request));
    const demo = Object.keys(body).length === 1 && body.demo === true;
    const simulation = Object.keys(body).length === 1 && body.simulation === true;
    if (Object.keys(body).length && !demo && !simulation) throw new RoomError("Use an empty object, {demo:true}, or {simulation:true}.");
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const room = simulation ? createStudioSimulationRoom(id, now, studioDemoFixture) : demo ? createStudioDemoRoom(id, now, studioDemoFixture) : createStudioRoom(id, now);
    await insertStudioRoom(room); return json({ room, model: publicStudioModel(configuredStudioModel()) }, 201);
  } catch (error) { return errorResponse(error); }
}
