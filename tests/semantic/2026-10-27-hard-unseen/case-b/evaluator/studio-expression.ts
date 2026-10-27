import { parseStudioRules, STUDIO_FLAGS, studioInteger, studioKeys, studioObject, studioText, studioUTC } from "./studio-engine.ts";
import type { StudioCondition, StudioFlag, StudioRules } from "./studio-types";

export interface StudioExpressionRules {
  eligibility: string;
  fee: { currency: "USD"; defaultCents: number; overrides: { when: string; cents: number; label: string }[] };
}

/** A small data grammar, never JavaScript or executable model-generated code. */
export const STUDIO_EXPRESSION_GRAMMAR = `Write eligibility and each fee override's when as a boolean expression string, not a node graph.
Atoms: true; false; resident; student; member; guardianConsent; scholarship; age >= N; age <= N; submittedAt < "ISO UTC"; submittedAt <= "ISO UTC"; submittedAt >= "ISO UTC"; submittedAt > "ISO UTC".
N is an integer 0..120. ISO UTC is an explicit valid instant such as "2032-02-29T09:00:00.000Z". JSON-escape the quotes around instants. Combine atoms using ! (NOT), && (AND), || (OR), and parentheses. Precedence: ! first, then &&, then ||. Use parentheses to make scope clear. A bare flag means true; !member means member is false. Example: age >= 16 && (age >= 18 || guardianConsent) && (resident || member).
There are no other identifiers, functions, properties, operators, arithmetic, comments or implicit conditions. Age > or < is unsupported; express an integer-age strict boundary using >= or <= with the exact adjusted integer. Maximum4096 characters per expression,128 condition nodes across eligibility and all fee conditions,depth8,16 operands per AND/OR group,16 fee overrides. Keep first-match fee order exactly; express each condition directly without node indices.`;

type Token = { kind: "identifier" | "number" | "string" | "symbol"; value: string };
const error = (message: string): never => { throw new Error(`Invalid policy expression: ${message}`); };
function tokenize(value: unknown): Token[] {
  const text = studioText(value, "policy expression", 4096), tokens: Token[] = [];
  let offset = 0;
  while (offset < text.length) {
    if (/[ \t\r\n]/.test(text[offset])) { offset++; continue; }
    if (tokens.length >= 1024) error("too many tokens.");
    const remaining = text.slice(offset);
    const symbol = /^(?:&&|\|\||>=|<=|[!()<>])/.exec(remaining);
    if (symbol) { tokens.push({ kind: "symbol", value: symbol[0] }); offset += symbol[0].length; continue; }
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(remaining);
    if (identifier) { tokens.push({ kind: "identifier", value: identifier[0] }); offset += identifier[0].length; continue; }
    const number = /^[0-9]+/.exec(remaining);
    if (number) { tokens.push({ kind: "number", value: number[0] }); offset += number[0].length; continue; }
    if (text[offset] === '"') {
      const end = text.indexOf('"', offset + 1);
      if (end < 0) error("unterminated UTC instant.");
      const instant = text.slice(offset + 1, end);
      if (instant.includes("\\") || /[\r\n]/.test(instant)) error("escapes and newlines are not allowed in UTC instants.");
      tokens.push({ kind: "string", value: instant }); offset = end + 1; continue;
    }
    error("unsupported character.");
  }
  return tokens;
}

/** Recursive descent has bounded syntax nesting; loops handle flat groups. */
function condition(value: unknown): StudioCondition {
  const tokens = tokenize(value);
  let cursor = 0;
  function take(symbol: string): boolean {
    if (tokens[cursor]?.kind === "symbol" && tokens[cursor].value === symbol) { cursor++; return true; }
    return false;
  }
  function group(op: "all" | "any", separator: string, child: (depth: number) => StudioCondition, depth: number): StudioCondition {
    const args = [child(depth)];
    while (take(separator)) {
      if (args.length >= 16) error("a boolean group may have at most16 operands.");
      args.push(child(depth));
    }
    return args.length === 1 ? args[0] : { op, args };
  }
  function or(depth: number): StudioCondition { return group("any", "||", and, depth); }
  function and(depth: number): StudioCondition { return group("all", "&&", unary, depth); }
  function unary(depth: number): StudioCondition {
    if (depth > 32) error("syntax nesting exceeds32 levels.");
    if (take("!")) {
      const arg = unary(depth + 1);
      // The AST already has negative flag leaves. Preserve their compact form
      // so encoding a valid negative flag does not add an artificial AST level.
      return arg.op === "flag" ? { ...arg, value: !arg.value } : { op: "not", arg };
    }
    if (take("(")) {
      const result = or(depth + 1);
      if (!take(")")) error("missing closing parenthesis.");
      return result;
    }
    const token = tokens[cursor++];
    if (!token || token.kind !== "identifier") return error("expected a boolean atom.");
    if (token.value === "true") return { op: "always" };
    if (token.value === "false") return { op: "not", arg: { op: "always" } };
    if (STUDIO_FLAGS.includes(token.value as StudioFlag)) return { op: "flag", field: token.value as StudioFlag, value: true };
    const comparison = tokens[cursor++], boundary = tokens[cursor++];
    if (token.value === "age") {
      if (comparison?.kind !== "symbol" || ![">=", "<="].includes(comparison.value) || boundary?.kind !== "number" || !/^(?:0|[1-9][0-9]{0,2})$/.test(boundary.value)) return error("age requires >= or <= and an integer0..120.");
      return { op: "age", cmp: comparison.value === ">=" ? "gte" : "lte", value: studioInteger(Number(boundary.value), "expression age boundary", 0, 120) };
    }
    if (token.value === "submittedAt") {
      const comparisons = { "<": "lt", "<=": "lte", ">=": "gte", ">": "gt" } as const;
      if (comparison?.kind !== "symbol" || !Object.hasOwn(comparisons, comparison.value) || boundary?.kind !== "string") return error("submittedAt requires a comparison and a quoted UTC instant.");
      return { op: "time", cmp: comparisons[comparison.value as keyof typeof comparisons], value: studioUTC(boundary.value, "expression UTC boundary") };
    }
    return error("unknown identifier.");
  }
  const result = or(0);
  if (cursor !== tokens.length) error("unexpected trailing input.");
  return result;
}

export function decodeStudioExpressionRules(value: unknown): StudioRules {
  const root = studioObject(value, "expression rules"); studioKeys(root, ["eligibility", "fee"], "expression rules");
  const fee = studioObject(root.fee, "expression fee"); studioKeys(fee, ["currency", "defaultCents", "overrides"], "expression fee");
  if (!Array.isArray(fee.overrides) || fee.overrides.length > 16) error("at most16 fee overrides are supported.");
  const overrides = fee.overrides as unknown[];
  // The shared validator enforces scalar ranges and the total AST budget across
  // every root, preserving exactly the studio's existing execution boundary.
  return parseStudioRules({ eligibility: condition(root.eligibility), fee: { ...fee, overrides: overrides.map(input => {
    const override = studioObject(input, "expression fee override"); studioKeys(override, ["when", "cents", "label"], "expression fee override");
    return { ...override, when: condition(override.when) };
  }) } });
}

export function encodeStudioExpressionRules(value: StudioRules): StudioExpressionRules {
  const rules = parseStudioRules(value);
  function encode(c: StudioCondition): string {
    switch (c.op) {
      case "always": return "true";
      case "flag": return `${c.value ? "" : "!"}${c.field}`;
      case "age": return `age ${c.cmp === "gte" ? ">=" : "<="} ${c.value}`;
      case "time": return `submittedAt ${{ lt: "<", lte: "<=", gte: ">=", gt: ">" }[c.cmp]} ${JSON.stringify(c.value)}`;
      case "not": return `!(${encode(c.arg)})`;
      default: return `(${c.args.map(encode).join(c.op === "all" ? " && " : " || ")})`;
    }
  }
  const result: StudioExpressionRules = { eligibility: encode(rules.eligibility), fee: { ...rules.fee, overrides: rules.fee.overrides.map(o => ({ ...o, when: encode(o.when) })) } };
  // Reject an oversized encoding instead of producing a wire object that the
  // decoder could not accept. The DSL has its own explicit expression bounds.
  decodeStudioExpressionRules(result);
  return result;
}
