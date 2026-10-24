import { mailDeliveryReady, sendConfiguredEmail } from './email-provider.ts';

function check(value: unknown, message: string) {
  if (!value) throw Error(message);
}
const gmailEnv: Record<string, string> = {
  EMAIL_PROVIDER: 'gmail',
  GMAIL_CLIENT_ID: 'test-client',
  GMAIL_CLIENT_SECRET: 'not-a-real-secret',
  GMAIL_REFRESH_TOKEN: 'test-refresh',
  GMAIL_FROM_EMAIL: 'sender@gmail.com',
};

Deno.test('Gmail provider accepts recipient at any domain without a verified sender domain', async () => {
  const calls: {url: string; init?: RequestInit}[] = [];
  const request: typeof fetch = async (url, init) => {
    calls.push({url: String(url), init});
    if (String(url).includes('/token')) {
      return Response.json({access_token: 'fake-access-token'});
    }
    return Response.json({id: 'gmail-message-id'});
  };
  check(mailDeliveryReady((key) => gmailEnv[key]), 'Gmail configuration should be valid');
  const id = await sendConfiguredEmail({
    to: 'someone@outlook.com',
    subject: 'Aviso de fiscalização',
    text: 'Olá,\nSeu contrato vence amanhã.',
  }, (key) => gmailEnv[key], request);
  check(id === 'gmail-message-id', 'Wrong Gmail API result');
  check(calls.length === 2, 'Expected OAuth refresh followed by message send');
  check(calls[0].url === 'https://oauth2.googleapis.com/token', 'Wrong token endpoint');
  const params = new URLSearchParams(String(calls[0].init?.body));
  check(params.get('grant_type') === 'refresh_token', 'Must refresh Gmail access token');
  check(calls[1].url.endsWith('/gmail/v1/users/me/messages/send'), 'Wrong Gmail send endpoint');
  const data = JSON.parse(String(calls[1].init?.body));
  const mime = atob(data.raw.replace(/-/g, '+').replace(/_/g, '/'));
  check(mime.includes('To: <someone@outlook.com>'), 'Recipient not present in MIME');
  check(mime.includes('From: <sender@gmail.com>'), 'Sender not present in MIME');
  check(mime.includes('Content-Transfer-Encoding: base64'), 'Unicode body must be encoded');
});

Deno.test('Gmail sends no message if OAuth refresh fails', async () => {
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    return new Response('not authorized', {status: 401});
  };
  let rejected = false;
  try {
    await sendConfiguredEmail({to:'fiscal@example.org',subject:'Teste',text:'Olá'},
      (key) => gmailEnv[key], request);
  } catch (error) {
    rejected = String(error).includes('HTTP 401');
  }
  check(rejected && calls === 1, 'Must reject OAuth failures before attempting to send');
});

Deno.test('unknown mail provider fails closed', () => {
  check(!mailDeliveryReady(() => 'unknown'), 'Unknown provider should not be marked ready');
});

Deno.test('Resend mode retains per-recipient idempotency headers', async () => {
  const config: Record<string,string> = {
    RESEND_API_KEY: 'test-key',
    RESEND_FROM_EMAIL: 'alerts@example.org',
  };
  let sent = false;
  const request: typeof fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    check(String(url) === 'https://api.resend.com/emails', 'Wrong Resend URL');
    check(headers.get('Idempotency-Key') === 'test-key-id', 'Missing idempotency header');
    sent = true;
    return Response.json({id: 'resend-message-id'});
  };
  await sendConfiguredEmail({
    to:'fiscal@example.org',subject:'Teste',text:'Corpo',
    idempotencyKey:'test-key-id',
  }, (key) => config[key], request);
  check(sent, 'Resend not invoked');
});


Deno.test('Gmail HTML messages use multipart/alternative with readable plain text fallback', async () => {
  let raw = '';
  const request: typeof fetch = async (url, init) => {
    if (String(url).includes('/token')) return Response.json({access_token: 'fake-token'});
    const data = JSON.parse(String(init?.body));
    raw = atob(data.raw.replace(/-/g, '+').replace(/_/g, '/'));
    return Response.json({id: 'gmail-html-id'});
  };
  const id = await sendConfiguredEmail({
    to:'manager@outlook.com',
    subject:'Resumo Licits',
    text:'Nenhum alerta crítico identificado hoje.',
    html:'<h2>Resumo do Licits</h2><p>✅ Nenhum alerta crítico.</p>',
  }, key => gmailEnv[key], request);
  check(id === 'gmail-html-id', 'Wrong Gmail HTML message id');
  check(raw.includes('Content-Type: multipart/alternative;'), 'Missing multipart MIME header');
  check(raw.includes('Content-Type: text/plain; charset=UTF-8'), 'Missing text/plain alternative');
  check(raw.includes('Content-Type: text/html; charset=UTF-8'), 'Missing text/html alternative');
  const decodePart = (mimeType: string): string => {
    const marker = 'Content-Type: ' + mimeType + '; charset=UTF-8';
    const part = raw.split(marker)[1];
    check(Boolean(part), 'Missing ' + mimeType + ' part');
    const encoded = part.split('\r\n\r\n')[1].split('--')[0].replace(/\s/g, '');
    return new TextDecoder().decode(Uint8Array.from(atob(encoded), char => char.charCodeAt(0)));
  };
  check(decodePart('text/plain').includes('Nenhum alerta crítico'), 'Plain text content missing');
  check(decodePart('text/html').includes('<h2>Resumo do Licits</h2>'), 'HTML content missing');
  check(decodePart('text/html').includes('✅'), 'UTF-8 HTML characters not preserved');
});

Deno.test('Resend HTML messages include explicit HTML and plain fallback', async () => {
  const env: Record<string, string> = {
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'test',
    RESEND_FROM_EMAIL: 'alerts@example.org',
  };
  let received: Record<string, unknown> = {};
  const request: typeof fetch = async (_url, init) => {
    received = JSON.parse(String(init?.body));
    return Response.json({id:'resend-html-id'});
  };
  await sendConfiguredEmail({
    to:'user@gmail.com', subject:'Teste', text:'Sem alertas', html:'<p>Sem alertas</p>',
  }, key => env[key], request);
  check(received.text === 'Sem alertas', 'Resend text body missing');
  check(received.html === '<p>Sem alertas</p>', 'Resend HTML body missing');
});
