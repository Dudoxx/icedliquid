// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
/**
 * @ddx       router
 * @domain    api
 * @route     /api/agent-tools/[tool]
 * @purpose   Runs one voice-agent tool (get_weather, get_time, web_search, generate_image) server-side for the in-browser agent; keys never reach the browser.
 * @status    active
 *
 * Same-origin only: the route spends paid keys once deployed. `RequestGuard` refuses an unknown
 * `Host` or a missing / foreign `Origin` (403), a body above 16 KB (413) and more than 30 calls per
 * client in 5 minutes (429) before the body is read. The body is the model's JSON
 * arguments; `?lang=` is the session locale (absent = default locale, unknown = 400). A tool
 * failure is a 200 with `{ok:false, error}` so the model can say it; a bad tool name, locale or
 * body is a 400.
 */
import { connection, type NextRequest } from 'next/server';
import { z } from 'zod';

import { defaultLocale, isValidLocale } from '@/i18n/types';
import { AgentTools, isAgentToolName } from '@/lib/server/agent-tools.server';
import { HttpErrors } from '@/lib/server/http-errors.server';
import { MAX_TOOL_BODY_BYTES, RequestGuard } from '@/lib/server/request-guard.server';

const argsSchema = z.record(z.string(), z.unknown());

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/agent-tools/[tool]'>,
): Promise<Response> {
  await connection();
  const requestId = crypto.randomUUID();
  const refused = RequestGuard.guardToolCall(request, requestId);
  if (refused) return refused;
  const { tool } = await context.params;
  if (!isAgentToolName(tool)) {
    return HttpErrors.envelope(400, 'UNKNOWN_TOOL', `unknown tool "${tool}"`, requestId);
  }
  const lang = request.nextUrl.searchParams.get('lang') ?? defaultLocale;
  if (!isValidLocale(lang)) return HttpErrors.badRequest(`unknown locale "${lang}"`, requestId);
  // A chunked body has no content-length, so the read size is checked too.
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_TOOL_BODY_BYTES) {
    return HttpErrors.payloadTooLarge(MAX_TOOL_BODY_BYTES, requestId);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return HttpErrors.badRequest('body must be JSON', requestId);
  }
  const parsed = argsSchema.safeParse(body);
  if (!parsed.success) return HttpErrors.badRequest('arguments must be a JSON object', requestId);
  const started = performance.now();
  const result = await AgentTools.run(tool, parsed.data, lang);
  return Response.json(
    { tool, ms: Math.round(performance.now() - started), result },
    { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
  );
}
