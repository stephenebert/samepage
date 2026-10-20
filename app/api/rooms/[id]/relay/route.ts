import { abandonJob, claimJob, completeJob, RoomError } from "@/lib/room";
import { mutateRoom } from "@/lib/store";
import { errorResponse, json, plainObject, readAction } from "@/lib/http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const body = plainObject(await readAction(request)), id = (await context.params).id, now = new Date().toISOString();
    if (body.type === "claim" && Object.keys(body).length === 1) {
      const jobId = crypto.randomUUID();
      const room = await mutateRoom(id, r => claimJob(r, jobId, now).room);
      return json({ room, job: room.jobs.find(j => j.id === jobId) || null });
    }
    if (body.type === "complete" && Object.keys(body).length === 3 && typeof body.jobId === "string" && typeof body.response === "string") {
      const jobId = body.jobId, response = body.response;
      const room = await mutateRoom(id, r => completeJob(r, jobId, response, now).room);
      return json({ room, job: room.jobs.find(j => j.id === jobId)! });
    }
    if (body.type === "abandon" && Object.keys(body).length === 2 && typeof body.jobId === "string") {
      const jobId = body.jobId;
      const room = await mutateRoom(id, r => abandonJob(r, jobId, now).room);
      return json({ room, job: room.jobs.find(j => j.id === jobId)! });
    }
    throw new RoomError("Unknown relay action.");
  } catch (error) { return errorResponse(error); }
}
