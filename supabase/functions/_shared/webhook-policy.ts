// Outbound webhook primitives. No customer URL is contacted by this module.
// Dispatchers must provide an explicit per-organization host allowlist and durable queue.
const encoder = new TextEncoder();

export function validateWebhookUrl(raw: string, allowedHosts: readonly string[]): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw Error('Invalid webhook URL'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port ||
      host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal') || host.endsWith('.test') || host.endsWith('.invalid') ||
      host.endsWith('.example') || host.startsWith('[') ||
      /^\d+(?:\.\d+){3}$/.test(host) || !/^[a-z0-9.-]+$/.test(host) ||
      !host.includes('.') || !allowedHosts.some(h => h.toLowerCase() === host)) {
    throw Error('Webhook destination is not an approved public HTTPS host');
  }
  return url.toString();
}

export async function signWebhookBody(
  rawBody: string, secret: string, unixTime: number,
): Promise<string> {
  if (secret.length < 32 || !Number.isSafeInteger(unixTime) || unixTime <= 0) {
    throw Error('Webhook signing configuration invalid');
  }
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(unixTime + '.' + rawBody));
  return 'sha256=' + Array.from(new Uint8Array(signed), b => b.toString(16).padStart(2, '0')).join('');
}
