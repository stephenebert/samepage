import { configuredPolicyModel } from "@/lib/policy-model-env";
import { publicPolicyModel } from "@/lib/policy-model";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET() { return json({ model: publicPolicyModel(configuredPolicyModel()) }); }
