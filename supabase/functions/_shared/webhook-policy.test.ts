import { validateWebhookUrl, signWebhookBody } from './webhook-policy.ts';
function check(condition: boolean, message: string) { if (!condition) throw Error(message); }
function rejects(fn: () => unknown, message: string) {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  check(rejected, message);
}

Deno.test('webhook endpoints require approved HTTPS host and reject SSRF destinations', () => {
  check(validateWebhookUrl('https://hooks.partner.example.org/events', ['hooks.partner.example.org']) ===
    'https://hooks.partner.example.org/events', 'Approved destination rejected');
  for (const url of [
    'http://hooks.partner.example.org/events',
    'https://127.0.0.1/events',
    'https://localhost/events',
    'https://metadata.google.internal/computeMetadata/v1/',
    'https://hooks.partner.example.org:8443/events',
    'https://user:pass@hooks.partner.example.org/events',
    'https://not-approved.example.org/events',
    'https://hooks.partner.example.org/events#secret',
  ]) rejects(() => validateWebhookUrl(url, ['hooks.partner.example.org']), 'Unsafe endpoint accepted: ' + url);
});

Deno.test('webhook HMAC signature is repeatable and binds time, body and secret', async () => {
  const secret = 'an-example-signing-secret-at-least-32-chars';
  const s1 = await signWebhookBody('{"event":"contract.created"}', secret, 1792800000);
  const s2 = await signWebhookBody('{"event":"contract.created"}', secret, 1792800000);
  const other = await signWebhookBody('{"event":"contract.updated"}', secret, 1792800000);
  const later = await signWebhookBody('{"event":"contract.created"}', secret, 1792800001);
  check(/^sha256=[0-9a-f]{64}$/.test(s1), 'Invalid webhook signature format');
  check(s1 === s2 && s1 !== other && s1 !== later, 'Signature did not bind request contents');
});
