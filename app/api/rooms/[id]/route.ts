import { applyAction, parseAction } from "@/lib/room";
import { getRoom, mutateRoom } from "@/lib/store";
import { errorResponse, json, readAction } from "@/lib/http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try { return json({ room: await getRoom((await context.params).id) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const action = parseAction(await readAction(request)), now = new Date().toISOString();
    const room = await mutateRoom((await context.params).id, r => applyAction(r, action, now));
    return json({ room });
  } catch (error) { return errorResponse(error); }
}
