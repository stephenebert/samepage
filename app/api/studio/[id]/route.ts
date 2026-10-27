import { applyStudioAction, parseStudioAction } from "@/lib/studio";
import { getStudioRoom, mutateStudioRoom } from "@/lib/studio-store";
import { errorResponse, json, readAction } from "@/lib/http";
import { configuredStudioModel } from "@/lib/studio-model-env";
import { publicStudioModel } from "@/lib/studio-model";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try { return json({ room: await getStudioRoom((await context.params).id), model: publicStudioModel(configuredStudioModel()) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const action = parseStudioAction(await readAction(request)), now = new Date().toISOString();
    const room = await mutateStudioRoom((await context.params).id, current => applyStudioAction(current, action, now));
    return json({ room, model: publicStudioModel(configuredStudioModel()) });
  } catch (error) { return errorResponse(error); }
}
