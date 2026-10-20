import { applyConsequencesAction, parseConsequencesAction } from "@/lib/consequences";
import { getConsequencesRoom, mutateConsequencesRoom } from "@/lib/consequences-store";
import { errorResponse, json, readAction } from "@/lib/http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try { return json({ room: await getConsequencesRoom((await context.params).id) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const action = parseConsequencesAction(await readAction(request)), now = new Date().toISOString();
    const room = await mutateConsequencesRoom((await context.params).id, current => applyConsequencesAction(current, action, now));
    return json({ room });
  } catch (error) { return errorResponse(error); }
}
