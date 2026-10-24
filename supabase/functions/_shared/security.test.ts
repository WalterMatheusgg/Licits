import { errorResponse, HttpError, readJson } from './security.ts';

async function responseFor(result: Promise<unknown>): Promise<Response> {
  try {
    await result;
    throw new Error('Expected request to be rejected');
  } catch (error) {
    return errorResponse(error);
  }
}

Deno.test('readJson rejects malformed JSON with a client error', async () => {
  const response = await responseFor(readJson(new Request('https://example.test', {
    method: 'POST',
    body: '{',
  })));

  if (response.status !== 400) throw new Error('Expected HTTP 400 for malformed JSON');
});

Deno.test('readJson rejects JSON values that are not objects', async () => {
  const response = await responseFor(readJson(new Request('https://example.test', {
    method: 'POST',
    body: '[]',
  })));

  if (response.status !== 400) throw new Error('Expected HTTP 400 for a non-object JSON body');
});

Deno.test('readJson rejects oversized bodies before parsing', async () => {
  const response = await responseFor(readJson(new Request('https://example.test', {
    method: 'POST',
    body: JSON.stringify({payload: 'x'.repeat(32)}),
  }), 16));

  if (response.status !== 413) throw new Error('Expected HTTP 413 for oversized JSON');
});

Deno.test('readJson enforces content-length before reading a body', async () => {
  const response = await responseFor(readJson(new Request('https://example.test', {
    method: 'POST',
    headers: {'content-length': '1024'},
    body: '{}',
  }), 16));

  if (response.status !== 413) throw new Error('Expected HTTP 413 from content-length');
});

Deno.test('errorResponse preserves only explicitly safe public errors', async () => {
  const safe = errorResponse(new HttpError('Sem permissão.', 403));
  const internal = errorResponse(new Error('provider-secret-response'), 'test-request-id');
  const internalBody = await internal.json();

  if (safe.status !== 403) throw new Error('Expected safe status 403');
  if (internal.status !== 500) throw new Error('Expected generic status 500');
  if (JSON.stringify(internalBody).includes('provider-secret-response')) {
    throw new Error('Internal error details must not be returned to callers');
  }
  if (internalBody.request_id !== 'test-request-id') throw new Error('Expected request id');
});