import { parseStudioReview } from "./studio.ts";
import { parseStudioRules, studioInteger, studioKeys, studioObject, STUDIO_FLAGS } from "./studio-engine.ts";
import { policyModelConfig, PolicyModelError, requestStructuredPolicy, type PolicyModelConfig, type PolicyModelRequestOptions } from "./policy-model.ts";
import type { StudioCondition, StudioJob, StudioRules } from "./studio-types";

export const MAX_STUDIO_MODEL_CALLS = 5;
export interface StudioModelConfig extends PolicyModelConfig { enabled: boolean }
export function studioModelConfig(values: { MODEL_API_KEY?: unknown; SAMEPAGE_MODEL?: unknown; SAMEPAGE_STUDIO_META_ENABLED?: unknown }): StudioModelConfig {
  return { ...policyModelConfig(values), enabled: values.SAMEPAGE_STUDIO_META_ENABLED === "true" };
}
export function publicStudioModel(config: StudioModelConfig) {
  return { provider: "Meta" as const, model: config.model, ready: config.enabled && Boolean(config.apiKey),
    mode: !config.enabled ? "disabled" as const : !config.apiKey ? "unconfigured" as const : "automatic" as const, maxCalls: MAX_STUDIO_MODEL_CALLS };
}
export function requireStudioModel(config: StudioModelConfig): void {
  if (!config.enabled) throw new PolicyModelError("MODEL_DISABLED", "Live Meta requests are disabled for this studio. The server owner must explicitly enable them after authorizing credit use.", 403);
  if (!config.apiKey) throw new PolicyModelError("MODEL_NOT_CONFIGURED", "Live review needs a server-side MODEL_API_KEY. The offline simulation remains available without a key.", 503);
}

type WireNode = Exclude<StudioCondition, { op: "all" | "any" } | { op: "not" }> | { op: "all" | "any"; args: number[] } | { op: "not"; arg: number };
export interface StudioWireRules {
  nodes: WireNode[]; eligibility: number;
  fee: { currency: "USD"; defaultCents: number; overrides: { when: number; cents: number; label: string }[] };
}
/** Postorder encoding avoids recursive schemas, unsupported by Meta strict output. */
export function encodeStudioRules(value: StudioRules): StudioWireRules {
  const rules = parseStudioRules(value), nodes: WireNode[] = [];
  function add(c: StudioCondition): number {
    const node: WireNode = c.op === "all" || c.op === "any" ? { op: c.op, args: c.args.map(add) }
      : c.op === "not" ? { op: "not", arg: add(c.arg) } : { ...c } as WireNode;
    nodes.push(node); return nodes.length - 1;
  }
  const eligibility = add(rules.eligibility);
  const overrides = rules.fee.overrides.map(o => ({ ...o, when: add(o.when) }));
  return { nodes, eligibility, fee: { ...rules.fee, overrides } };
}
/** Reject cycles, forward/dangling references, unused clauses and expansion bombs. */
export function decodeStudioRules(value: unknown): StudioRules {
  const root = studioObject(value, "wire rules"); studioKeys(root, ["nodes", "eligibility", "fee"], "wire rules");
  if (!Array.isArray(root.nodes) || root.nodes.length < 1 || root.nodes.length > 128) throw new Error("Wire rules require 1..128 nodes.");
  const nodes: unknown[] = root.nodes;
  let expanded = 0;
  const used = new Set<number>();
  function expand(reference: unknown, parent: number, depth: number): StudioCondition {
    const index = studioInteger(reference, "node reference", 0, Math.min(parent - 1, nodes.length - 1));
    if (++expanded > 128 || depth > 8) throw new Error("Wire rules exceed bounded expansion.");
    used.add(index);
    const node = studioObject(nodes[index], "wire node");
    if (node.op === "all" || node.op === "any") {
      studioKeys(node, ["op", "args"], "wire group");
      if (!Array.isArray(node.args) || node.args.length < 1 || node.args.length > 16) throw new Error("Invalid wire group.");
      return { op: node.op, args: node.args.map(ref => expand(ref, index, depth + 1)) };
    }
    if (node.op === "not") {
      studioKeys(node, ["op", "arg"], "wire negation");
      return { op: "not", arg: expand(node.arg, index, depth + 1) };
    }
    // Exact leaf keys and scalar ranges are validated by parseStudioRules below.
    return { ...node } as StudioCondition;
  }
  const eligibility = expand(root.eligibility, nodes.length, 1), fee = studioObject(root.fee, "wire fee");
  studioKeys(fee, ["currency", "defaultCents", "overrides"], "wire fee");
  if (!Array.isArray(fee.overrides) || fee.overrides.length > 16) throw new Error("Invalid wire fee overrides.");
  const overrides = fee.overrides.map(input => {
    const o = studioObject(input, "wire override"); studioKeys(o, ["when", "cents", "label"], "wire override");
    return { ...o, when: expand(o.when, nodes.length, 1) };
  });
  if (used.size !== nodes.length) throw new Error("Wire rules contain unused nodes.");
  return parseStudioRules({ eligibility, fee: { ...fee, overrides } });
}
const objectSchema = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
export function studioReviewWireSchema(job: StudioJob): Record<string, unknown> {
  const reference = { type: "integer", minimum: 0, maximum: 127 };
  const node = { anyOf: [
    objectSchema({ op: { type: "string", enum: ["always"] } }),
    objectSchema({ op: { type: "string", enum: ["all", "any"] }, args: { type: "array", minItems: 1, maxItems: 16, items: reference } }),
    objectSchema({ op: { type: "string", enum: ["not"] }, arg: reference }),
    objectSchema({ op: { type: "string", enum: ["age"] }, cmp: { type: "string", enum: ["gte", "lte"] }, value: { type: "integer", minimum: 0, maximum: 120 } }),
    objectSchema({ op: { type: "string", enum: ["flag"] }, field: { type: "string", enum: STUDIO_FLAGS }, value: { type: "boolean" } }),
    objectSchema({ op: { type: "string", enum: ["time"] }, cmp: { type: "string", enum: ["lt", "lte", "gte", "gt"] }, value: { type: "string" } }),
  ] };
  const rules = objectSchema({ nodes: { type: "array", minItems: 1, maxItems: 128, items: node }, eligibility: reference,
    fee: objectSchema({ currency: { type: "string", enum: ["USD"] }, defaultCents: { type: "integer", minimum: 0, maximum: 1000000 },
      overrides: { type: "array", maxItems: 16, items: objectSchema({ when: reference, cents: { type: "integer", minimum: 0, maximum: 1000000 }, label: { type: "string" } }) } }) });
  return objectSchema({ jobId: { type: "string", enum: [job.id] }, candidates: { type: "array", minItems: 2, maxItems: 2,
    items: objectSchema({ editor: { type: "string", enum: ["alice", "bob"] }, sourceVersion: { type: "integer" }, en: { type: "string" }, es: { type: "string" }, rules: { anyOf: [rules, { type: "null" }] }, issues: { type: "array", maxItems: 16, items: { type: "string" } } }) } });
}
export function buildStudioWirePrompt(job: StudioJob): string {
  const wire = `Supported executable WIRE schema (flat condition nodes; NOT nested trees):
Rules = {"nodes":[Node,...],"eligibility":nodeIndex,"fee":{"currency":"USD","defaultCents":integer,"overrides":[{"when":nodeIndex,"cents":integer,"label":"short description"}]}}
A node index is its zero-based position in nodes. A parent node may refer only to earlier nodes. Every node must be reachable from eligibility or a fee override; omit no clause and include no unused nodes.
Node is exactly one of:
{"op":"always"}
{"op":"all","args":[earlierNodeIndex,...]} (AND, 1..16 children)
{"op":"any","args":[earlierNodeIndex,...]} (OR, 1..16 children)
{"op":"not","arg":earlierNodeIndex}
{"op":"age","cmp":"gte"|"lte","value":integer 0..120}
{"op":"flag","field":"resident"|"student"|"member"|"guardianConsent"|"scholarship","value":boolean}
{"op":"time","cmp":"lt"|"lte"|"gte"|"gt","value":"explicit ISO UTC instant ending in Z"}
Example: age>=18 AND scholarship is nodes:[{"op":"age","cmp":"gte","value":18},{"op":"flag","field":"scholarship","value":true},{"op":"all","args":[0,1]}],eligibility:2. Fee override when also refers to an index. The server expands the graph into rules; expanded nodes across all roots must total at most128 and depth8.
`;
  const start = job.prompt.indexOf("Supported executable schema:");
  const end = job.prompt.indexOf("There may be at most 128 condition nodes total");
  if (start < 0 || end <= start) throw new PolicyModelError("MODEL_PROMPT_INVALID", "The saved review protocol is not compatible with this model adapter. Save a fresh draft and request a new review.", 409);
  return job.prompt.slice(0, start) + wire + job.prompt.slice(end);
}
function hydrateReview(value: unknown, job: StudioJob): unknown {
  const r = studioObject(value, "wire review");
  studioKeys(r, ["jobId", "candidates"], "wire review");
  if (!Array.isArray(r.candidates) || r.candidates.length !== 2) throw new Error("Two candidates required.");
  const result = { ...r, candidates: r.candidates.map(input => {
    const c = studioObject(input, "wire candidate");
    return { ...c, rules: c.rules === null ? null : decodeStudioRules(c.rules) };
  }) };
  parseStudioReview(result, job); return result;
}
export async function interpretStudioJob(job: StudioJob, config: StudioModelConfig, options: PolicyModelRequestOptions = {}): Promise<unknown> {
  requireStudioModel(config);
  let result: unknown;
  await requestStructuredPolicy({ prompt: buildStudioWirePrompt(job) }, config,
    { name: "samepage_studio_review", schema: studioReviewWireSchema(job), validate: content => { result = hydrateReview(JSON.parse(content), job); } }, options);
  return result;
}
