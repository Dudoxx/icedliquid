/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   Turn the LFM3 `<tool_call><function=..><parameter=..>` text into OmniToolCall objects in the browser lane, and hold streamed text while a call may be forming.
 * @status    feature-local
 */
import type { OmniTool } from '../omni/request';
import type { OmniToolCall } from '../omni/types';

/** Opening tag of one tool call in the model text. */
export const TOOL_OPEN = '<tool_call>';

/** `CALL_RE` (re.S): `[\s\S]*?` is the dotall-equivalent, parameter values span newlines. */
const CALL_RE = /<tool_call>\s*<function=([^>\s]+)>([\s\S]*?)<\/function>\s*<\/tool_call>/g;
/** `PARAM_RE` (re.S): one optional newline is trimmed on each side of the value. */
const PARAM_RE = /<parameter=([^>\s]+)>\n?([\s\S]*?)\n?<\/parameter>/g;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Result of parsing one finished turn: text outside the calls (null when empty) and the calls. */
export interface ToolCallParse {
  content: string | null;
  calls: OmniToolCall[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when the parameter schema declares `string` (alone or in a type list). */
function isStringParam(spec: unknown): boolean {
  if (!isRecord(spec)) return false;
  const stype = spec.type;
  return stype === 'string' || (Array.isArray(stype) && stype.includes('string'));
}

/** Schema-typed value of one raw parameter (gateway parse_tool_calls typing rule). */
function typedValue(raw: string, spec: unknown): JsonValue {
  if (isStringParam(spec)) return raw;
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return raw;
  }
}

/** Python `json.dumps(value, ensure_ascii=False)` with its default `, ` / `: ` separators. */
function pyJsonDumps(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(pyJsonDumps).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const items = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${pyJsonDumps(v)}`);
    return `{${items.join(', ')}}`;
  }
  return JSON.stringify(value);
}

/** Arguments of one call body; a Map keeps the gateway's insertion order for any key shape. */
function argumentsJson(body: string, properties: Record<string, unknown>): string {
  const args = new Map<string, JsonValue>();
  for (const m of body.matchAll(PARAM_RE)) {
    const key = m[1] ?? '';
    args.set(key, typedValue(m[2] ?? '', properties[key]));
  }
  const items = [...args].map(([k, v]) => `${JSON.stringify(k)}: ${pyJsonDumps(v)}`);
  return `{${items.join(', ')}}`;
}

/** `call_` + 24 lowercase hex chars (gateway `uuid4().hex[:24]`). */
function newCallId(): string {
  return `call_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

/** Declared function name -> its `parameters.properties` (empty when absent). */
function declaredTools(tools: readonly OmniTool[]): Map<string, Record<string, unknown>> {
  const declared = new Map<string, Record<string, unknown>>();
  for (const tool of tools) {
    const props = tool.function.parameters?.properties;
    declared.set(tool.function.name, isRecord(props) ? props : {});
  }
  return declared;
}

/**
 * Model text -> text outside the calls plus OmniToolCall objects. A call naming an undeclared
 * function stays in the text unchanged and yields no call.
 */
export function parseToolCalls(text: string, tools: readonly OmniTool[]): ToolCallParse {
  const declared = declaredTools(tools);
  const calls: OmniToolCall[] = [];
  const rest = text
    .replace(CALL_RE, (whole: string, name: string, body: string) => {
      const properties = declared.get(name);
      if (properties === undefined) return whole;
      calls.push({
        index: calls.length,
        id: newCallId(),
        type: 'function',
        function: { name, arguments: argumentsJson(body, properties) },
      });
      return '';
    })
    .trim();
  return { content: rest || null, calls };
}

/** Length of the longest buffer tail that is a proper prefix of `<tool_call>`. */
function openPrefixTail(buf: string): number {
  for (let n = Math.min(TOOL_OPEN.length - 1, buf.length); n > 0; n -= 1) {
    if (TOOL_OPEN.startsWith(buf.slice(buf.length - n))) return n;
  }
  return 0;
}

/**
 * Streaming hold (gateway ToolStreamFilter). `feed(delta)` returns only text that is safe to show:
 * it stops at the first `<tool_call>` and keeps back any tail that could still become one, so
 * partial markup never reaches the answer text. `finish()` parses what was held: the calls plus
 * any remaining text, or the whole held text when it held no valid call. With an empty tool pool
 * the stream passes text through, as the gateway applies no filter without tools.
 */
export class ToolCallStream {
  private buf = '';
  private held = false;
  private readonly tools: readonly OmniTool[];

  constructor(tools: readonly OmniTool[]) {
    this.tools = tools;
  }

  feed(delta: string): string {
    if (this.tools.length === 0) return delta;
    this.buf += delta;
    if (this.held) return '';
    const at = this.buf.indexOf(TOOL_OPEN);
    if (at >= 0) {
      this.held = true;
      const out = this.buf.slice(0, at);
      this.buf = this.buf.slice(at);
      return out;
    }
    const cut = this.buf.length - openPrefixTail(this.buf);
    const out = this.buf.slice(0, cut);
    this.buf = this.buf.slice(cut);
    return out;
  }

  finish(): ToolCallParse {
    const buf = this.buf;
    this.buf = '';
    this.held = false;
    if (!buf) return { content: null, calls: [] };
    return parseToolCalls(buf, this.tools);
  }
}
