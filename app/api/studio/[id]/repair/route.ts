import { parseStudioRepairRequest, runAutomaticStudioRepair } from "@/lib/automatic-studio-repair";
import { mutateStudioRoom } from "@/lib/studio-store";
import { configuredStudioModel } from "@/lib/studio-model-env";
import { publicStudioModel } from "@/lib/studio-model";
import { PolicyModelError } from "@/lib/policy-model";
import { errorResponse, json, readAction } from "@/lib/http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const config = configuredStudioModel(), model = publicStudioModel(config);
  try {
    const input = parseStudioRepairRequest(await readAction(request));
    const { httpStatus, ...output } = await runAutomaticStudioRepair((await context.params).id, config, input, { mutate: mutateStudioRoom });
    return json({ ...output, model, ...(output.automatic.error ? { error: output.automatic.error.message, code: output.automatic.error.code } : {}) }, httpStatus);
  } catch (error) {
    if (error instanceof PolicyModelError) return json({ error: error.message, code: error.code, model }, error.status);
    return errorResponse(error);
  }
}
