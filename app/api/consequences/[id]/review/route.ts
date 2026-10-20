import { runAutomaticPolicyReview } from "@/lib/automatic-policy-review";
import { mutateConsequencesRoom } from "@/lib/consequences-store";
import { configuredPolicyModel } from "@/lib/policy-model-env";
import { PolicyModelError } from "@/lib/policy-model";
import { errorResponse, json, plainObject, readAction } from "@/lib/http";
import { RoomError } from "@/lib/room";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const body = plainObject(await readAction(request));
    if (Object.keys(body).some(key => key !== "retry") || (body.retry !== undefined && typeof body.retry !== "boolean")) throw new RoomError("Send an optional boolean retry field only.");
    const { httpStatus, ...output } = await runAutomaticPolicyReview((await context.params).id, configuredPolicyModel(), body.retry === true, { mutate: mutateConsequencesRoom });
    return json({ ...output, ...(output.automatic.error ? { error: output.automatic.error.message, code: output.automatic.error.code } : {}) }, httpStatus);
  } catch (error) {
    if (error instanceof PolicyModelError) return json({ error: error.message, code: error.code }, error.status);
    return errorResponse(error);
  }
}
