// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
/**
 * @ddx       router
 * @domain    integration
 * @route     /api/models/[...file]
 * @purpose   Serves the locally provisioned ONNX model files to the browser WebGPU worker, same-origin.
 * @status    active
 *
 * GET streams the file, HEAD answers size + etag only, a matching `If-None-Match` is a 304.
 * A name the webgpu config does not list is a 400; a listed file that is not on disk is a 404
 * naming `pnpm models:provision`.
 */
import { connection } from 'next/server';

import { HttpErrors } from '@/lib/server/http-errors.server';
import { ModelFileError, ModelFiles } from '@/lib/server/model-files.server';

async function serve(
  request: Request,
  context: RouteContext<'/api/models/[...file]'>,
  withBody: boolean,
): Promise<Response> {
  await connection();
  const requestId = crypto.randomUUID();
  try {
    const { file } = await context.params;
    const probe = await ModelFiles.openModelFile(file, false);
    const headers = new Headers({
      'content-type': probe.contentType,
      etag: probe.etag,
      'cache-control': 'private, no-cache',
      'x-request-id': requestId,
    });
    if (request.headers.get('if-none-match') === probe.etag) {
      return new Response(null, { status: 304, headers });
    }
    headers.set('content-length', String(probe.size));
    if (!withBody) return new Response(null, { headers });
    const opened = await ModelFiles.openModelFile(file, true);
    return new Response(opened.body, { headers });
  } catch (error) {
    if (error instanceof ModelFileError) {
      return HttpErrors.envelope(error.status, error.code, error.message, requestId);
    }
    // The detail can carry an absolute server path: it goes to the server log, not the client.
    console.error(`[models] ${requestId} model file read failed:`, error);
    return HttpErrors.envelope(500, 'MODEL_FILE_ERROR', 'model file read failed', requestId);
  }
}

export function GET(request: Request, context: RouteContext<'/api/models/[...file]'>): Promise<Response> {
  return serve(request, context, true);
}

export function HEAD(request: Request, context: RouteContext<'/api/models/[...file]'>): Promise<Response> {
  return serve(request, context, false);
}
