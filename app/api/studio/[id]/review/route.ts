import { runAutomaticStudioReview } from "@/lib/automatic-studio-review";
import { mutateStudioRoom } from "@/lib/studio-store";
import { configuredStudioModel } from "@/lib/studio-model-env";
import { publicStudioModel } from "@/lib/studio-model";
import { PolicyModelError } from "@/lib/policy-model";
import { errorResponse, json, plainObject, readAction } from "@/lib/http";
import { RoomError } from "@/lib/room";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const config = configuredStudioModel(), model = publicStudioModel(config);
  try {
    const body = plainObject(await readAction(request));
    if (Object.keys(body).some(key => key !== "retry" && key !== "simulation") || (body.retry !== undefined && typeof body.retry !== "boolean") || (body.simulation !== undefined && typeof body.simulation !== "boolean")) throw new RoomError("Send optional boolean retry and simulation fields only.");
    const { httpStatus, ...output } = await runAutomaticStudioReview((await context.params).id, config, { retry: body.retry === true, simulation: body.simulation === true }, { mutate: mutateStudioRoom });
    return json({ ...output, model, ...(output.automatic.error ? { error: output.automatic.error.message, code: output.automatic.error.code } : {}) }, httpStatus);
  } catch (error) {
    if (error instanceof PolicyModelError) return json({ error: error.message, code: error.code, model }, error.status);
    return errorResponse(error);
  }
}
